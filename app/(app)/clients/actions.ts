"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getMe, can } from "@/lib/auth/can";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeHealth } from "@/lib/modules/clients/queries";
import { addWorkingHours, CHANNELS, CLIENT_STATUSES, CURRENCIES, dubaiDate, isEnded, LOG_KINDS, SERVICES, SEVERITY, TEAM_ROLES, type Severity } from "@/lib/modules/clients/logic";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const FORM_ERROR = { ok: false as const, error: "Check the form and try again." };
const NO_ACCESS = { ok: false as const, error: "You don't have access to do that." };

const uuid = z.string().uuid();
const optUuid = z.union([uuid, z.literal("")]).transform((v) => v || null);
const optText = (max: number) => z.string().trim().max(max).transform((v) => v || null);
const optDate = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]).transform((v) => v || null);
const optNum = z.union([z.coerce.number().min(0), z.literal("")]).transform((v) => (v === "" ? null : v));
const keys = <T extends object>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]];

function refresh(id?: string) {
  revalidatePath("/clients");
  if (id) revalidatePath(`/clients/${id}`);
}

// ---------------------------------------------------------------- add / edit client
const ClientInput = z
  .object({
    id: optUuid,
    name: z.string().trim().min(1).max(120),
    site: optText(200),
    services: z.array(z.enum(SERVICES)).max(6),
    country: optText(60),
    start_date: optDate,
    channel: z.enum(keys(CHANNELS)),
    currency: z.enum(CURRENCIES),
    owner_id: optUuid,
    manager_id: optUuid,
    notes: optText(2000),
    status: z.enum(CLIENT_STATUSES).optional(),
    end_date: optDate.optional(),
    end_reason: optText(200).optional(),
    monthly_fee: optNum,
    hours_per_month: optNum,
    contact_name: optText(120).optional(),
    contact_email: z.union([z.string().trim().email(), z.literal("")]).optional(),
  })
  .refine((v) => !v.status || !isEnded(v.status) || (v.end_date && v.end_reason), {
    message: "Ending a client needs an end date and a reason.",
  });

export async function saveClient(raw: unknown): Promise<Result<{ id: string }>> {
  const parsed = ClientInput.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? FORM_ERROR.error };
  const v = parsed.data;
  const me = await getMe();
  if (!me || me.kind !== "staff" || !can(me, "clients.manage")) return NO_ACCESS;
  const db = await createClient();

  const row = {
    name: v.name,
    site: v.site,
    services: v.services,
    country: v.country,
    start_date: v.start_date,
    channel: v.channel,
    currency: v.currency,
    owner_id: v.owner_id,
    manager_id: v.manager_id,
    notes: v.notes,
  };

  let id = v.id;
  if (id) {
    const status = v.status;
    const ended = status ? isEnded(status) : false;
    const { error } = await db
      .from("clients")
      .update({ ...row, ...(status ? { status, end_date: ended ? v.end_date : null, end_reason: ended ? v.end_reason : null } : {}) })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { data, error } = await db
      .from("clients")
      .insert({ ...row, status: "onboarding", health_band: "new", owner_id: v.owner_id ?? me.id })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Couldn't add the client." };
    id = data.id as string;
    const team = [
      { client_id: id, member_id: v.owner_id ?? me.id, role: "account_executive" },
      ...(v.manager_id && v.manager_id !== (v.owner_id ?? me.id) ? [{ client_id: id, member_id: v.manager_id, role: "delivery_lead" }] : []),
    ];
    await db.from("client_team").insert(team);
    if (v.contact_name || v.contact_email) {
      await db.from("client_contacts").insert({
        client_id: id,
        name: v.contact_name ?? v.contact_email ?? "Main contact",
        email: v.contact_email || null,
        is_main: true,
        gets_reports: true,
      });
    }
  }

  // Fee and hours live in client_terms (billing data). Only touch them when the user may.
  if ((v.monthly_fee != null || v.hours_per_month != null) && (can(me, "clients.billing.edit") || can(me, "clients.manage"))) {
    const { error } = await db
      .from("client_terms")
      .upsert({ client_id: id, monthly_fee: v.monthly_fee, hours_per_month: v.hours_per_month, currency: v.currency }, { onConflict: "client_id" });
    if (error) return { ok: false, error: `Client saved, but the fee wasn't: ${error.message}` };
  }

  refresh(id);
  return { ok: true, id };
}

// ---------------------------------------------------------------- terms
const TermsInput = z.object({
  client_id: uuid,
  monthly_fee: optNum,
  currency: z.enum(CURRENCIES),
  term_months: optNum,
  term_start: optDate,
  notice_days: optNum,
  renewal_date: optDate,
  hours_per_month: optNum,
  in_scope: optText(2000),
  out_of_scope: optText(2000),
  agreement_name: optText(200),
});

export async function saveTerms(raw: unknown): Promise<Result> {
  const v = TermsInput.safeParse(raw);
  if (!v.success) return FORM_ERROR;
  const me = await getMe();
  if (!me || me.kind !== "staff" || !(can(me, "clients.billing.edit") || can(me, "clients.manage"))) return NO_ACCESS;
  const db = await createClient();
  const { error } = await db.from("client_terms").upsert(v.data, { onConflict: "client_id" });
  if (error) return { ok: false, error: error.message };
  refresh(v.data.client_id);
  return { ok: true };
}

// ---------------------------------------------------------------- timeline: calls, chats, notes
const LogInput = z.object({
  client_id: uuid,
  kind: z.enum(keys(LOG_KINDS)),
  happened_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  with_name: optText(120),
  mood: z.union([z.enum(["happy", "neutral", "unhappy"]), z.literal("")]).transform((v) => v || null),
  body: z.string().trim().min(1).max(4000),
});

export async function logEntry(raw: unknown): Promise<Result> {
  const v = LogInput.safeParse(raw);
  if (!v.success) return FORM_ERROR;
  const me = await getMe();
  if (!me || me.kind !== "staff" || !can(me, "clients.view")) return NO_ACCESS;
  const db = await createClient();
  const { error } = await db.from("client_timeline").insert({ ...v.data, created_by: me.id });
  if (error) return { ok: false, error: error.message };
  refresh(v.data.client_id);
  return { ok: true };
}

const NotesInput = z.object({
  client_id: uuid,
  title: z.string().trim().min(1).max(200),
  happened_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  decisions: optText(4000),
  concerns: optText(4000),
  action_items: z.string().max(4000),
});

export async function saveMeetingNotes(raw: unknown): Promise<Result> {
  const v = NotesInput.safeParse(raw);
  if (!v.success) return FORM_ERROR;
  const me = await getMe();
  if (!me || me.kind !== "staff" || !can(me, "clients.view")) return NO_ACCESS;
  const db = await createClient();
  const { action_items, title, ...rest } = v.data;
  const { error } = await db.from("client_timeline").insert({
    ...rest,
    kind: "meeting_notes",
    body: title,
    action_items: action_items.split("\n").map((s) => s.trim()).filter(Boolean),
    created_by: me.id,
  });
  if (error) return { ok: false, error: error.message };
  refresh(v.data.client_id);
  return { ok: true };
}

// ---------------------------------------------------------------- escalations
const EscInput = z.object({
  client_id: uuid,
  title: z.string().trim().min(1).max(200),
  severity: z.enum(keys(SEVERITY)),
  owner_id: optUuid,
  details: optText(4000),
  create_ticket: z.boolean(),
  ask_rating: z.boolean(),
});

export async function raiseEscalation(raw: unknown): Promise<Result<{ warning?: string }>> {
  const v = EscInput.safeParse(raw);
  if (!v.success) return FORM_ERROR;
  const me = await getMe();
  if (!me || me.kind !== "staff" || !can(me, "clients.view")) return NO_ACCESS;
  const db = await createClient();
  const now = new Date();
  const severity = v.data.severity as Severity;
  const due = addWorkingHours(now, SEVERITY[severity].hours);

  let ticketId: string | null = null;
  let warning: string | undefined;
  if (v.data.create_ticket) {
    if (!can(me, "tickets.manage")) warning = "No ticket created: you can't create tickets.";
    else {
      const proj = await db.from("projects").select("id").eq("client_id", v.data.client_id).limit(1);
      const { data, error } = await db
        .from("tickets")
        .insert({
          title: `Escalation: ${v.data.title}`.slice(0, 200),
          description: v.data.details,
          priority: "urgent",
          assignee_id: v.data.owner_id,
          reporter_id: me.id,
          project_id: proj.error ? null : (proj.data?.[0]?.id ?? null),
          client_id: v.data.client_id,
          due_date: dubaiDate(due),
          source: "escalation",
          tags: ["escalation"],
        })
        .select("id")
        .single();
      if (error) warning = `No ticket created: ${error.message}`;
      else ticketId = data.id as string;
    }
  }

  const { error } = await db.from("escalations").insert({
    client_id: v.data.client_id,
    title: v.data.title,
    details: v.data.details,
    severity,
    owner_id: v.data.owner_id,
    ticket_id: ticketId,
    opened_at: now.toISOString(),
    due_at: due.toISOString(),
    ask_rating: v.data.ask_rating,
    created_by: me.id,
  });
  if (error) return { ok: false, error: error.message };
  await db.from("client_timeline").insert({
    client_id: v.data.client_id,
    kind: "escalation",
    happened_on: dubaiDate(now),
    body: `Escalation raised: ${v.data.title} (${SEVERITY[severity].label})`,
    created_by: me.id,
  });
  refresh(v.data.client_id);
  return { ok: true, warning };
}

const CloseInput = z.object({
  id: uuid,
  client_id: uuid,
  client_rating: z.union([z.coerce.number().int().min(1).max(5), z.literal("")]).transform((v) => (v === "" ? null : v)),
});

export async function closeEscalation(raw: unknown): Promise<Result> {
  const v = CloseInput.safeParse(raw);
  if (!v.success) return FORM_ERROR;
  const me = await getMe();
  if (!me || me.kind !== "staff" || !can(me, "clients.view")) return NO_ACCESS;
  const db = await createClient();
  const { error } = await db
    .from("escalations")
    .update({ status: "closed", closed_at: new Date().toISOString(), client_rating: v.data.client_rating })
    .eq("id", v.data.id)
    .eq("client_id", v.data.client_id);
  if (error) return { ok: false, error: error.message };
  refresh(v.data.client_id);
  return { ok: true };
}

// ---------------------------------------------------------------- contacts
const ContactInput = z.object({
  id: optUuid,
  client_id: uuid,
  name: z.string().trim().min(1).max(120),
  role: optText(120),
  email: z.union([z.string().trim().email(), z.literal("")]).transform((v) => v || null),
  phone: optText(40),
  is_main: z.boolean(),
  gets_reports: z.boolean(),
});

export async function saveContact(raw: unknown): Promise<Result> {
  const v = ContactInput.safeParse(raw);
  if (!v.success) return FORM_ERROR;
  const me = await getMe();
  if (!me || me.kind !== "staff" || !can(me, "clients.manage")) return NO_ACCESS;
  const db = await createClient();
  const { id, ...row } = v.data;
  if (row.is_main) {
    await db.from("client_contacts").update({ is_main: false }).eq("client_id", row.client_id).neq("id", id ?? "00000000-0000-0000-0000-000000000000");
  }
  const { error } = id ? await db.from("client_contacts").update(row).eq("id", id) : await db.from("client_contacts").insert(row);
  if (error) return { ok: false, error: error.message };
  refresh(row.client_id);
  return { ok: true };
}

export async function deleteContact(raw: unknown): Promise<Result> {
  const v = z.object({ id: uuid, client_id: uuid }).safeParse(raw);
  if (!v.success) return FORM_ERROR;
  const me = await getMe();
  if (!me || me.kind !== "staff" || !can(me, "clients.manage")) return NO_ACCESS;
  const db = await createClient();
  const { error } = await db.from("client_contacts").delete().eq("id", v.data.id).eq("client_id", v.data.client_id);
  if (error) return { ok: false, error: error.message };
  refresh(v.data.client_id);
  return { ok: true };
}

// ---------------------------------------------------------------- our team
const TeamInput = z.object({ client_id: uuid, member_id: uuid, role: z.enum(keys(TEAM_ROLES)) });

export async function setTeamMember(raw: unknown): Promise<Result> {
  const v = TeamInput.safeParse(raw);
  if (!v.success) return FORM_ERROR;
  const me = await getMe();
  if (!me || me.kind !== "staff" || !can(me, "clients.manage")) return NO_ACCESS;
  const db = await createClient();
  const { error } = await db.from("client_team").upsert(v.data, { onConflict: "client_id,member_id" });
  if (error) return { ok: false, error: error.message };
  refresh(v.data.client_id);
  return { ok: true };
}

export async function removeTeamMember(raw: unknown): Promise<Result> {
  const v = z.object({ client_id: uuid, member_id: uuid }).safeParse(raw);
  if (!v.success) return FORM_ERROR;
  const me = await getMe();
  if (!me || me.kind !== "staff" || !can(me, "clients.manage")) return NO_ACCESS;
  const db = await createClient();
  const { error } = await db.from("client_team").delete().eq("client_id", v.data.client_id).eq("member_id", v.data.member_id);
  if (error) return { ok: false, error: error.message };
  refresh(v.data.client_id);
  return { ok: true };
}

// ---------------------------------------------------------------- health
export async function recalcHealth(raw: unknown): Promise<Result<{ score: number | null }>> {
  const v = z.object({ client_id: uuid }).safeParse(raw);
  if (!v.success) return FORM_ERROR;
  const me = await getMe();
  if (!me || me.kind !== "staff" || !can(me, "clients.manage")) return NO_ACCESS;
  const db = await createClient();
  // Make sure the caller may edit this client before reading with the service client.
  const { data: visible } = await db.from("clients").select("id").eq("id", v.data.client_id).maybeSingle();
  if (!visible) return NO_ACCESS;
  const h = await computeHealth(createAdminClient(), v.data.client_id, new Date());
  if (!h) return NO_ACCESS;
  const { error } = await db
    .from("clients")
    .update({ health_score: h.score, health_band: h.band, health_factors: h.factors, health_at: new Date().toISOString() })
    .eq("id", v.data.client_id);
  if (error) return { ok: false, error: error.message };
  refresh(v.data.client_id);
  return { ok: true, score: h.score };
}

// ---------------------------------------------------------------- client portal settings
const BrandInput = z.object({
  client_id: uuid,
  portal_color: z.union([z.string().regex(/^#[0-9a-fA-F]{6}$/), z.literal("")]).transform((v) => v || null),
  portal_welcome: optText(200),
  portal_logo_url: z.union([z.string().trim().url().max(500), z.literal("")]).transform((v) => v || null),
});

export async function saveBranding(raw: unknown): Promise<Result> {
  const v = BrandInput.safeParse(raw);
  if (!v.success) return FORM_ERROR;
  const me = await getMe();
  if (!me || me.kind !== "staff" || !can(me, "clients.manage")) return NO_ACCESS;
  const db = await createClient();
  const { client_id, ...row } = v.data;
  const { error } = await db.from("clients").update(row).eq("id", client_id);
  if (error) return { ok: false, error: error.message };
  refresh(client_id);
  return { ok: true };
}

const LoginInput = z.object({ client_id: uuid, member_id: uuid, role: z.enum(["client_owner", "client_viewer", "remove"]) });

/** Change a client login's role, or remove its access (suspends the member). Admins only. */
export async function setPortalLogin(raw: unknown): Promise<Result> {
  const v = LoginInput.safeParse(raw);
  if (!v.success) return FORM_ERROR;
  const me = await getMe();
  if (!me || !can(me, "admin.access.manage", "all")) return NO_ACCESS;
  const db = await createClient();
  const { data: m } = await db.from("members").select("id").eq("id", v.data.member_id).eq("kind", "client").eq("client_id", v.data.client_id).maybeSingle();
  if (!m) return NO_ACCESS;
  if (v.data.role === "remove") {
    const { error } = await db.from("members").update({ status: "suspended" }).eq("id", v.data.member_id);
    if (error) return { ok: false, error: error.message };
  } else {
    const del = await db.from("member_roles").delete().eq("member_id", v.data.member_id).in("role", ["client_owner", "client_viewer"]);
    if (del.error) return { ok: false, error: del.error.message };
    const { error } = await db.from("member_roles").insert({ member_id: v.data.member_id, role: v.data.role });
    if (error) return { ok: false, error: error.message };
  }
  refresh(v.data.client_id);
  return { ok: true };
}

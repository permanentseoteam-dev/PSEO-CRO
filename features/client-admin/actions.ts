"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getMe, can } from "@/lib/auth/can";
import { END_REASONS } from "@/lib/modules/clients/logic";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmailDrafter } from "./ai";
import { buildEmailPrompt, deleteCheck, hasOpenAlert, isEnded, nameMatches } from "./logic";
import { todayIso } from "./queries";
import {
  CHURN_OUTCOMES,
  CHURN_TRIGGERS,
  CURRENCIES,
  SENTIMENTS,
  TONES,
  VISIBILITIES,
  WINBACK_STATUSES,
  type ChurnAlert,
  type ClientHistory,
  type Result,
} from "./types";

// Every action: zod parse -> can() check -> Supabase write (RLS is the real guard) -> revalidate.

const FORM_ERROR = "Check the form and try again.";
const NO_ACCESS = "You don't have access to do that.";

const id = z.uuid();
const optText = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));
const optDate = z
  .union([z.iso.date(), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null));
const optNum = (min: number, max: number) =>
  z
    .union([z.coerce.number().min(min).max(max), z.literal(""), z.null()])
    .optional()
    .transform((v) => (v === "" || v == null ? null : v));

async function staff(perm = "clients.manage") {
  const me = await getMe();
  return me && me.kind === "staff" && can(me, perm) ? me : null;
}

function done(clientId: string): Result {
  revalidatePath(`/clients/${clientId}`);
  return { ok: true };
}

/** Runs an RLS-guarded write and turns "0 rows changed" into a no-access error. */
async function changed(q: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<string | null> {
  const { data, error } = await q;
  if (error) return error.message;
  return Array.isArray(data) && data.length === 0 ? NO_ACCESS : null;
}

// ---------------------------------------------------------------- terms

const AgreementInput = z.object({
  clientId: id,
  monthly_fee: optNum(0, 1e11),
  currency: z.enum(CURRENCIES),
  start_date: optDate,
  term_months: optNum(1, 120),
  notice_days: optNum(0, 365),
  hours_per_month: optNum(0, 10000),
  in_scope: optText(),
  out_of_scope: optText(),
  renewal_on: optDate,
  auto_renews: z.boolean(),
});

export async function saveAgreement(raw: unknown): Promise<Result> {
  const p = AgreementInput.safeParse(raw);
  if (!p.success) return { ok: false, error: FORM_ERROR };
  if (!(await staff())) return { ok: false, error: NO_ACCESS };
  const { clientId, start_date, renewal_on, hours_per_month, ...fields } = p.data;
  const supabase = await createClient();
  // Terms live in 0108 client_terms (term_start, renewal_date, whole hours); 0203 adds auto_renews and agreement_path.
  const row = {
    client_id: clientId,
    ...fields,
    term_start: start_date,
    renewal_date: renewal_on,
    hours_per_month: hours_per_month == null ? null : Math.round(hours_per_month),
  };
  const err = await changed(supabase.from("client_terms").upsert(row, { onConflict: "client_id" }).select("client_id"));
  return err ? { ok: false, error: err } : done(clientId);
}

const FileInput = z.object({ clientId: id, path: z.string().min(1).max(500), name: z.string().trim().min(1).max(200) });

/** Called after the browser uploaded the signed agreement to "client-agreements/<clientId>/...". */
export async function setAgreementFile(raw: unknown): Promise<Result> {
  const p = FileInput.safeParse(raw);
  if (!p.success || !p.data.path.startsWith(`${p.data.clientId}/`)) return { ok: false, error: FORM_ERROR };
  if (!(await staff())) return { ok: false, error: NO_ACCESS };
  const supabase = await createClient();
  const err = await changed(
    supabase
      .from("client_terms")
      .upsert({ client_id: p.data.clientId, agreement_path: p.data.path, agreement_name: p.data.name }, { onConflict: "client_id" })
      .select("client_id"),
  );
  return err ? { ok: false, error: err } : done(p.data.clientId);
}

// ---------------------------------------------------------------- health

const SentimentInput = z.object({ clientId: id, sentiment: z.enum(SENTIMENTS), note: optText(500) });

export async function addSentiment(raw: unknown): Promise<Result> {
  const p = SentimentInput.safeParse(raw);
  if (!p.success) return { ok: false, error: FORM_ERROR };
  const me = await staff();
  if (!me) return { ok: false, error: NO_ACCESS };
  const supabase = await createClient();
  const { error } = await supabase
    .from("client_sentiments")
    .insert({ client_id: p.data.clientId, sentiment: p.data.sentiment, note: p.data.note, recorded_by: me.id });
  return error ? { ok: false, error: error.message } : done(p.data.clientId);
}

const AlertInput = z.object({
  clientId: id,
  trigger_kind: z.enum(CHURN_TRIGGERS),
  detail: z.string().trim().min(1).max(1000),
  nps_score: optNum(0, 10),
});

export async function raiseChurnAlert(raw: unknown): Promise<Result> {
  const p = AlertInput.safeParse(raw);
  if (!p.success) return { ok: false, error: FORM_ERROR };
  const me = await staff();
  if (!me) return { ok: false, error: NO_ACCESS };
  const { clientId, ...fields } = p.data;
  const supabase = await createClient();
  const existing = await supabase.from("churn_alerts").select("trigger_kind, outcome").eq("client_id", clientId).eq("trigger_kind", fields.trigger_kind).eq("outcome", "open");
  if (hasOpenAlert((existing.data ?? []) as Pick<ChurnAlert, "trigger_kind" | "outcome">[], fields.trigger_kind))
    return { ok: false, error: "There is already an open alert of this kind. Update that one instead." };
  const { error } = await supabase.from("churn_alerts").insert({ client_id: clientId, ...fields, raised_by: me.id });
  return error ? { ok: false, error: error.message } : done(clientId);
}

const OutcomeInput = z.object({ clientId: id, alertId: id, outcome: z.enum(CHURN_OUTCOMES), note: optText(500) });

export async function setChurnOutcome(raw: unknown): Promise<Result> {
  const p = OutcomeInput.safeParse(raw);
  if (!p.success) return { ok: false, error: FORM_ERROR };
  if (!(await staff())) return { ok: false, error: NO_ACCESS };
  const open = p.data.outcome === "open";
  const supabase = await createClient();
  const err = await changed(
    supabase
      .from("churn_alerts")
      .update({
        outcome: p.data.outcome,
        outcome_note: p.data.note,
        closed_on: open ? null : new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" }),
      })
      .eq("id", p.data.alertId)
      .eq("client_id", p.data.clientId)
      .select("id"),
  );
  return err ? { ok: false, error: err } : done(p.data.clientId);
}

// ---------------------------------------------------------------- vault

const VaultInput = z.object({
  clientId: id,
  itemId: id.optional().nullable(),
  service: z.string().trim().min(1).max(120),
  username: z.string().trim().max(200),
  password: z.string().max(500),
  notes: optText(500),
});

export async function saveVaultItem(raw: unknown): Promise<Result> {
  const p = VaultInput.safeParse(raw);
  if (!p.success || (!p.data.itemId && !p.data.password)) return { ok: false, error: FORM_ERROR };
  if (!(await staff("clients.vault.manage"))) return { ok: false, error: NO_ACCESS };
  const supabase = await createClient();
  const { error } = await supabase.rpc("client_vault_save", {
    p_client: p.data.clientId,
    p_service: p.data.service,
    p_username: p.data.username,
    p_secret: p.data.password,
    p_notes: p.data.notes,
    p_item: p.data.itemId ?? null,
  });
  return error ? { ok: false, error: error.code === "42501" ? NO_ACCESS : error.message } : done(p.data.clientId);
}

/** Returns the password once and logs the reveal (in SQL). The UI hides it again after 30 seconds. */
export async function revealVaultItem(raw: unknown): Promise<{ ok: true; value: string } | { ok: false; error: string }> {
  const p = z.object({ clientId: id, itemId: id }).safeParse(raw);
  if (!p.success) return { ok: false, error: FORM_ERROR };
  if (!(await staff("clients.vault.view"))) return { ok: false, error: NO_ACCESS };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("client_vault_reveal", { p_item: p.data.itemId });
  if (error) return { ok: false, error: error.code === "42501" ? NO_ACCESS : error.message };
  revalidatePath(`/clients/${p.data.clientId}`);
  return { ok: true, value: (data as string | null) ?? "" };
}

export async function deleteVaultItem(raw: unknown): Promise<Result> {
  const p = z.object({ clientId: id, itemId: id }).safeParse(raw);
  if (!p.success) return { ok: false, error: FORM_ERROR };
  if (!(await staff("clients.vault.manage"))) return { ok: false, error: NO_ACCESS };
  const supabase = await createClient();
  const err = await changed(
    supabase.from("client_vault_items").delete().eq("id", p.data.itemId).eq("client_id", p.data.clientId).select("id"),
  );
  return err ? { ok: false, error: err } : done(p.data.clientId);
}

// ---------------------------------------------------------------- portal activity lines

const LineInput = z.object({
  clientId: id,
  body: z.string().trim().min(1).max(300),
  happened_on: z.iso.date(),
  visibility: z.enum(VISIBILITIES),
});

export async function addActivityLine(raw: unknown): Promise<Result> {
  const p = LineInput.safeParse(raw);
  if (!p.success) return { ok: false, error: FORM_ERROR };
  const me = await staff();
  if (!me) return { ok: false, error: NO_ACCESS };
  const { clientId, body, happened_on, visibility } = p.data;
  const supabase = await createClient();
  // Lines live in 0114 shared_activity (the portal Home feed): action = the line, happened_at = the day.
  const { error } = await supabase.from("shared_activity").insert({
    client_id: clientId,
    actor_id: me.id,
    actor_name: me.name,
    action: body,
    happened_at: `${happened_on}T12:00:00+04:00`,
    visibility,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/portal");
  return done(clientId);
}

export async function setActivityVisibility(raw: unknown): Promise<Result> {
  const p = z.object({ clientId: id, lineId: id, visibility: z.enum(VISIBILITIES) }).safeParse(raw);
  if (!p.success) return { ok: false, error: FORM_ERROR };
  if (!(await staff())) return { ok: false, error: NO_ACCESS };
  const supabase = await createClient();
  const err = await changed(
    supabase
      .from("shared_activity")
      .update({ visibility: p.data.visibility })
      .eq("id", p.data.lineId)
      .eq("client_id", p.data.clientId)
      .select("id"),
  );
  if (err) return { ok: false, error: err };
  revalidatePath("/portal");
  return done(p.data.clientId);
}

// ---------------------------------------------------------------- win-back

export async function startWinback(raw: unknown): Promise<Result> {
  const p = z.object({ clientId: id }).safeParse(raw);
  if (!p.success) return { ok: false, error: FORM_ERROR };
  const me = await staff();
  if (!me) return { ok: false, error: NO_ACCESS };
  const supabase = await createClient();
  const { error } = await supabase
    .from("client_winbacks")
    .insert({ client_id: p.data.clientId, owner_id: me.id, created_by: me.id, next_step: "Reach out and offer a catch-up call" });
  if (error) return { ok: false, error: error.code === "23505" ? "A win-back is already in progress for this client." : error.message };
  revalidatePath("/clients");
  return done(p.data.clientId);
}

const WinbackInput = z.object({ clientId: id, winbackId: id, status: z.enum(WINBACK_STATUSES), next_step: optText(300), due_on: optDate });

export async function updateWinback(raw: unknown): Promise<Result> {
  const p = WinbackInput.safeParse(raw);
  if (!p.success) return { ok: false, error: FORM_ERROR };
  if (!(await staff())) return { ok: false, error: NO_ACCESS };
  const { clientId, winbackId, ...fields } = p.data;
  const supabase = await createClient();
  const err = await changed(
    supabase.from("client_winbacks").update(fields).eq("id", winbackId).eq("client_id", clientId).select("id"),
  );
  if (err) return { ok: false, error: err };
  revalidatePath("/clients");
  return done(clientId);
}

// ---------------------------------------------------------------- AI email draft

const DraftInput = z.object({
  clientId: id,
  tone: z.enum(TONES),
  contactName: z.string().trim().max(120),
  subject: z.string().trim().min(1).max(200),
  points: z.string().trim().min(1).max(4000),
});

export async function draftClientEmail(raw: unknown): Promise<{ ok: true; body: string } | { ok: false; error: string }> {
  const p = DraftInput.safeParse(raw);
  if (!p.success) return { ok: false, error: "Add a subject and the points to cover." };
  const me = await staff("clients.view");
  if (!me) return { ok: false, error: NO_ACCESS };
  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("name").eq("id", p.data.clientId).maybeSingle();
  if (!client) return { ok: false, error: NO_ACCESS };
  const prompt = buildEmailPrompt({ ...p.data, clientName: client.name as string, senderName: me.name });
  const r = await getEmailDrafter().draft(prompt);
  return r.ok ? { ok: true, body: r.body } : { ok: false, error: r.message };
}

// ---------------------------------------------------------------- delete client

/**
 * Counts what is attached to the client. Uses the service client (after the clients.delete check) so the
 * counts aren't cut down by the caller's RLS. Phase 1 table and column names: see WIRING.md.
 */
async function history(clientId: string): Promise<ClientHistory | null> {
  const admin = createAdminClient();
  const count = (table: string) => admin.from(table).select("id", { count: "exact", head: true }).eq("client_id", clientId);
  const [t, f, l, i] = await Promise.all([count("tickets"), count("client_files"), count("members"), count("invoices")]);
  if (t.error || f.error || l.error || i.error) return null;
  return { tickets: t.count ?? 0, files: f.count ?? 0, logins: l.count ?? 0, invoices: i.count ?? 0 };
}

type CheckResult = { ok: true; allowed: boolean; blockers: string[]; removes: string[] } | { ok: false; error: string };

export async function checkDeleteClient(raw: unknown): Promise<CheckResult> {
  const p = z.object({ clientId: id }).safeParse(raw);
  if (!p.success) return { ok: false, error: FORM_ERROR };
  const me = await staff("clients.delete");
  if (!me || !can(me, "clients.delete", "all")) return { ok: false, error: NO_ACCESS };
  const h = await history(p.data.clientId);
  if (!h) return { ok: false, error: "Couldn't check this client's history. Try again." };
  return { ok: true, ...deleteCheck(h) };
}

export async function deleteClient(raw: unknown): Promise<Result> {
  const p = z.object({ clientId: id, typedName: z.string().max(200) }).safeParse(raw);
  if (!p.success) return { ok: false, error: FORM_ERROR };
  const me = await staff("clients.delete");
  if (!me || !can(me, "clients.delete", "all")) return { ok: false, error: NO_ACCESS };
  const admin = createAdminClient();
  const { data: client } = await admin.from("clients").select("id, name").eq("id", p.data.clientId).maybeSingle();
  if (!client) return { ok: false, error: "This client no longer exists." };
  if (!nameMatches(p.data.typedName, client.name as string)) return { ok: false, error: "The name doesn't match." };
  const h = await history(p.data.clientId);
  if (!h) return { ok: false, error: "Couldn't check this client's history. Try again." };
  const check = deleteCheck(h);
  if (!check.allowed) return { ok: false, error: check.blockers.join(" ") };
  const { error } = await admin.from("clients").delete().eq("id", client.id);
  if (error) return { ok: false, error: error.message };
  // Rows cascade with the client; stored files and the log entry are handled here.
  const files = await admin.storage.from("client-agreements").list(client.id);
  if (files.data?.length) await admin.storage.from("client-agreements").remove(files.data.map((f) => `${client.id}/${f.name}`));
  await admin.from("client_deletions").insert({ client_id: client.id, client_name: client.name, history: h, deleted_by: me.id });
  revalidatePath("/clients");
  return { ok: true };
}

/** A client with invoices is never deleted: it is ended (status churned) so Finance keeps its history. */
export async function archiveClient(raw: unknown): Promise<Result> {
  const p = z.object({ clientId: id, typedName: z.string().max(200), reason: z.enum(END_REASONS) }).safeParse(raw);
  if (!p.success) return { ok: false, error: "Choose a reason and type the client's name." };
  const me = await staff("clients.delete");
  if (!me || !can(me, "clients.delete", "all")) return { ok: false, error: NO_ACCESS };
  const admin = createAdminClient();
  const { data: client } = await admin.from("clients").select("id, name, status").eq("id", p.data.clientId).maybeSingle();
  if (!client) return { ok: false, error: "This client no longer exists." };
  if (!nameMatches(p.data.typedName, client.name as string)) return { ok: false, error: "The name doesn't match." };
  if (isEnded(client.status as string)) return { ok: false, error: "This client is already archived." };
  const { error } = await admin
    .from("clients")
    .update({ status: "churned", end_date: todayIso(), end_reason: p.data.reason })
    .eq("id", client.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/clients");
  return done(client.id);
}

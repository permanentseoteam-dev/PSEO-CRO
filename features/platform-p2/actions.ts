"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { can, getMe } from "@/lib/auth/can";
import { createClient } from "@/lib/supabase/server";
import { getFirefliesAdapter, getGmailInboxAdapter, getGoogleCalendarAdapter, getSummaryAdapter, type AdapterResult } from "./adapters";
import { generateApiKey } from "./api-keys";
import { API_SCOPES, LEAVE_TABLE, ONBOARDING_STEPS, type Provider, type Result } from "./types";

// Every action: zod parse -> can() check -> Supabase write (RLS is the real guard) -> revalidate.
const bad = { ok: false as const, error: "Check the form and try again." };
const no = { ok: false as const, error: "You don't have access to do that." };
const id = z.uuid();
type DB = Awaited<ReturnType<typeof createClient>>;

async function staff() {
  const me = await getMe();
  return me && me.kind === "staff" ? me : null;
}

// ---------------------------------------------------------------- announcements
const Post = z.object({
  title: z.string().trim().min(1).max(140),
  body: z.string().trim().max(4000).default(""),
  departmentId: id.nullable(),
  expiresOn: z.iso.date().nullable(),
  pinned: z.boolean().default(false),
});

export async function postAnnouncement(raw: unknown): Promise<Result> {
  const p = Post.safeParse(raw);
  if (!p.success) return bad;
  const me = await staff();
  if (!me || !can(me, "home.announcements.post")) return no;
  const d = p.data;
  if (!can(me, "home.announcements.post", "all") && d.departmentId !== me.departmentId) {
    return { ok: false, error: "You can post to your own department only." };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("announcements").insert({
    title: d.title,
    body: d.body,
    department_id: d.departmentId,
    expires_on: d.expiresOn,
    pinned: d.pinned,
    author_id: me.id,
  });
  if (error) return { ok: false, error: error.code === "42501" ? no.error : error.message };
  revalidatePath("/home");
  return { ok: true };
}

export async function setAnnouncementPinned(raw: unknown): Promise<Result> {
  const p = z.object({ id, pinned: z.boolean() }).safeParse(raw);
  if (!p.success) return bad;
  const me = await staff();
  if (!me || !can(me, "home.announcements.post")) return no;
  const supabase = await createClient();
  const { data, error } = await supabase.from("announcements").update({ pinned: p.data.pinned }).eq("id", p.data.id).select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return no;
  revalidatePath("/home");
  return { ok: true };
}

export async function deleteAnnouncement(raw: unknown): Promise<Result> {
  const p = z.object({ id }).safeParse(raw);
  if (!p.success) return bad;
  const me = await staff();
  if (!me || !can(me, "home.announcements.post")) return no;
  const supabase = await createClient();
  const { data, error } = await supabase.from("announcements").delete().eq("id", p.data.id).select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return no;
  revalidatePath("/home");
  return { ok: true };
}

// ---------------------------------------------------------------- getting started
const STEP_KEYS = ONBOARDING_STEPS.map((s) => s.key) as [string, ...string[]];

export async function setOnboardingStep(raw: unknown): Promise<Result> {
  const p = z.object({ step: z.enum(STEP_KEYS), done: z.boolean() }).safeParse(raw);
  if (!p.success) return bad;
  const me = await staff();
  if (!me) return no;
  const supabase = await createClient();
  const { error } = p.data.done
    ? await supabase.from("onboarding_steps").upsert({ member_id: me.id, step: p.data.step }, { onConflict: "member_id,step", ignoreDuplicates: true })
    : await supabase.from("onboarding_steps").delete().eq("member_id", me.id).eq("step", p.data.step);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/home");
  return { ok: true };
}

// ---------------------------------------------------------------- HR today
export async function decideLeave(raw: unknown): Promise<Result> {
  const p = z.object({ id, decision: z.enum(["approved", "declined"]) }).safeParse(raw);
  if (!p.success) return bad;
  const me = await staff();
  if (!me || !can(me, "time.approve", "team")) return no;
  const supabase = await createClient();
  const { data, error } = await supabase.from(LEAVE_TABLE).update({ status: p.data.decision, decided_by: me.id, decided_at: new Date().toISOString() }).eq("id", p.data.id).eq("status", "pending").select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "This request was already handled." };
  revalidatePath("/home");
  return { ok: true };
}

// ---------------------------------------------------------------- API keys
const NewKey = z.object({
  name: z.string().trim().min(1).max(80),
  scopes: z.array(z.enum(API_SCOPES)).min(1).max(API_SCOPES.length),
});

/** Returns the full key once. Only its hash and display prefix are saved. */
export async function createApiKey(raw: unknown): Promise<Result<{ key: string }>> {
  const p = NewKey.safeParse(raw);
  if (!p.success) return { ok: false, error: "Give the key a name and pick at least one scope." };
  const me = await staff();
  if (!me || !can(me, "admin.access.manage", "all")) return no;
  const { key, prefix, hash } = generateApiKey();
  const supabase = await createClient();
  const { error } = await supabase.from("api_keys").insert({
    name: p.data.name,
    prefix,
    key_hash: hash,
    scopes: [...new Set(p.data.scopes)],
    created_by: me.id,
  });
  if (error) return { ok: false, error: error.message };
  await audit(supabase, me.id, "api_key.create", `Created API key "${p.data.name}" (${prefix})`);
  revalidatePath("/settings");
  return { ok: true, data: { key } };
}

export async function revokeApiKey(raw: unknown): Promise<Result> {
  const p = z.object({ id }).safeParse(raw);
  if (!p.success) return bad;
  const me = await staff();
  if (!me || !can(me, "admin.access.manage", "all")) return no;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString(), revoked_by: me.id })
    .eq("id", p.data.id)
    .is("revoked_at", null)
    .select("name, prefix");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "That key is already revoked." };
  await audit(supabase, me.id, "api_key.revoke", `Revoked API key "${data[0].name}" (${data[0].prefix})`);
  revalidatePath("/settings");
  return { ok: true };
}

/** Best effort: the Phase 1 audit_log (0102_access) may not exist in every environment. */
async function audit(supabase: DB, actorId: string, action: string, summary: string) {
  await supabase.from("audit_log").insert({ actor_id: actorId, action, summary, target_type: "api_key" });
}

// ---------------------------------------------------------------- integrations
const NOT_SET_UP: Record<Provider, string> = {
  google_calendar: "Google Calendar isn't connected yet. An admin needs to add the Google account first.",
  fireflies: "Fireflies isn't connected yet. An admin needs to add the Fireflies API key first.",
  gmail: "The client inbox isn't connected yet. It needs Gmail domain-wide access first.",
  ai: "AI summaries aren't set up yet. An admin needs to add an AI provider key first.",
};

function adapterError(provider: Provider, r: AdapterResult<unknown>) {
  return r.ok ? null : r.reason === "not_configured" ? NOT_SET_UP[provider] : r.message;
}

/** Find (or for Google, create) the connection row, then log the run. */
async function logRun(supabase: DB, provider: Provider, memberId: string | null, kind: "sync" | "import" | "poll" | "summary", err: string | null, notConfigured: boolean) {
  let q = supabase.from("integration_connections").select("id").eq("provider", provider);
  q = memberId ? q.eq("member_id", memberId) : q.is("member_id", null);
  let conn = (await q.maybeSingle()).data as { id: string } | null;
  if (!conn && memberId) {
    conn = (await supabase.from("integration_connections").insert({ provider, member_id: memberId }).select("id").single()).data as { id: string } | null;
  }
  if (!conn) return;
  const now = new Date().toISOString();
  await supabase.from("integration_runs").insert({
    connection_id: conn.id,
    kind,
    status: notConfigured ? "not_configured" : err ? "error" : "ok",
    message: err,
    finished_at: now,
  });
}

export async function connectGoogleCalendar(): Promise<Result<{ url: string }>> {
  const me = await staff();
  if (!me || !can(me, "calendar.use")) return no;
  const r = getGoogleCalendarAdapter().connectUrl(me.id, "/calendar");
  if (!r.ok) return { ok: false, error: adapterError("google_calendar", r)! };
  return { ok: true, data: { url: r.data } };
}

export async function syncGoogleCalendar(): Promise<Result> {
  const me = await staff();
  if (!me || !can(me, "calendar.use")) return no;
  const supabase = await createClient();
  const r = await getGoogleCalendarAdapter().pullChanges(me.id, null);
  const err = adapterError("google_calendar", r);
  await logRun(supabase, "google_calendar", me.id, "sync", err, !r.ok && r.reason === "not_configured");
  if (err) return { ok: false, error: err };
  await supabase.from("integration_connections").update({ last_sync_at: new Date().toISOString(), last_error: null }).eq("provider", "google_calendar").eq("member_id", me.id);
  revalidatePath("/calendar");
  return { ok: true };
}

export async function importFireflies(): Promise<Result> {
  const me = await staff();
  if (!me || !can(me, "clients.view")) return no;
  const supabase = await createClient();
  const r = await getFirefliesAdapter().listTranscripts(new Date(Date.now() - 30 * 86400000).toISOString());
  const err = adapterError("fireflies", r);
  await logRun(supabase, "fireflies", null, "import", err, !r.ok && r.reason === "not_configured");
  if (err) return { ok: false, error: err };
  // A configured adapter would upsert fireflies_calls here (service role), using matchCall() from logic.ts.
  revalidatePath("/meetings");
  return { ok: true };
}

export async function summarizeCall(raw: unknown): Promise<Result> {
  const p = z.object({ id }).safeParse(raw);
  if (!p.success) return bad;
  const me = await staff();
  if (!me || !can(me, "clients.view")) return no;
  const supabase = await createClient();
  const { data: call } = await supabase.from("fireflies_calls").select("id, title").eq("id", p.data.id).maybeSingle();
  if (!call) return no;
  const r = await getSummaryAdapter().summarize({ title: call.title, transcript: "" });
  if (!r.ok) {
    if (r.reason === "not_configured") await supabase.from("fireflies_calls").update({ summary_status: "not_configured" }).eq("id", call.id);
    await logRun(supabase, "ai", null, "summary", adapterError("ai", r), r.reason === "not_configured");
    return { ok: false, error: adapterError("ai", r)! };
  }
  const { error } = await supabase
    .from("fireflies_calls")
    .update({ summary: r.data, summary_status: "ready", summarized_at: new Date().toISOString() })
    .eq("id", call.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/meetings");
  return { ok: true };
}

export async function assignCallClient(raw: unknown): Promise<Result> {
  const p = z.object({ id, clientId: id.nullable() }).safeParse(raw);
  if (!p.success) return bad;
  const me = await staff();
  if (!me || !can(me, "clients.view")) return no;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fireflies_calls")
    .update({ client_id: p.data.clientId, match_method: p.data.clientId ? "manual" : "none" })
    .eq("id", p.data.id)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return no;
  revalidatePath("/meetings");
  return { ok: true };
}

export async function checkInbox(): Promise<Result> {
  const me = await staff();
  if (!me || !can(me, "clients.view")) return no;
  const supabase = await createClient();
  const { data: conn } = await supabase.from("integration_connections").select("account_label").eq("provider", "gmail").is("member_id", null).maybeSingle();
  const r = await getGmailInboxAdapter().listMessages(conn?.account_label ?? "", new Date(Date.now() - 10 * 60000).toISOString());
  const err = adapterError("gmail", r);
  await logRun(supabase, "gmail", null, "poll", err, !r.ok && r.reason === "not_configured");
  if (err) return { ok: false, error: err };
  revalidatePath("/response-times");
  return { ok: true };
}

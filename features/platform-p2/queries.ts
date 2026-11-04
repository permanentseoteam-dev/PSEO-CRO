import "server-only";
import { createClient } from "@/lib/supabase/server";
import { monthBounds, workdaysElapsed } from "./logic";
import { LEAVE_TABLE } from "./types";
import type {
  Announcement,
  ApiKeyRow,
  Connection,
  Deal,
  DeliveryRow,
  FirefliesCall,
  InboxOutcome,
  LeaveRow,
  OnboardingStep,
  OpenInvoice,
  OverdueTicket,
  PulseInput,
  Provider,
} from "./types";

// Reads run as the signed-in user, so RLS limits every result. Phase 1 tables that may not exist yet
// (or a missing column) give an empty result instead of crashing the page.
type Res = { data: unknown; error: unknown };
const rows = <T>(r: Res): T[] => (r.error || !Array.isArray(r.data) ? [] : (r.data as T[]));
const one = <T>(r: Res): T | null => (r.error ? null : ((r.data as T) ?? null));

export const today = () => new Date().toISOString().slice(0, 10);


export async function memberNames(ids: (string | null)[]) {
  const list = [...new Set(ids.filter((x): x is string => !!x))];
  if (!list.length) return new Map<string, string>();
  const supabase = await createClient();
  const data = rows<{ id: string; name: string }>(await supabase.from("members").select("id, name").in("id", list));
  return new Map(data.map((m) => [m.id, m.name]));
}

// ---------------------------------------------------------------- Home
export async function listAnnouncements(): Promise<Announcement[]> {
  const supabase = await createClient();
  const data = rows<Announcement & { author: { name: string } | null; department: { name: string } | null }>(
    await supabase
      .from("announcements")
      .select("id, title, body, department_id, pinned, expires_on, author_id, created_at, author:members!author_id(name), department:departments(name)")
      .or(`expires_on.is.null,expires_on.gte.${today()}`)
      .order("created_at", { ascending: false })
      .limit(30),
  );
  return data.map(({ author, department, ...a }) => ({ ...a, author_name: author?.name ?? null, department_name: department?.name ?? null }));
}

export async function listDepartments() {
  const supabase = await createClient();
  return rows<{ id: string; name: string }>(await supabase.from("departments").select("id, name").order("name"));
}

export async function getOnboardingDone(memberId: string): Promise<OnboardingStep[]> {
  const supabase = await createClient();
  return rows<{ step: OnboardingStep }>(await supabase.from("onboarding_steps").select("step").eq("member_id", memberId)).map((r) => r.step);
}

export async function listOverdueTickets(): Promise<OverdueTicket[]> {
  const supabase = await createClient();
  return rows<OverdueTicket>(
    await supabase.from("tickets").select("assignee_id, due_date").neq("status", "done").lt("due_date", today()).limit(2000),
  );
}

export async function getFinanceSnapshot() {
  const supabase = await createClient();
  const t = today();
  const weekAgo = new Date(Date.parse(t) - 6 * 86400000).toISOString().slice(0, 10);
  const [inv, rec] = await Promise.all([
    supabase.from("invoices").select("currency, total, amount_paid, due_on, status").in("status", ["issued", "partly_paid", "disputed"]),
    supabase.from("receipts").select("currency, amount").gte("received_on", weekAgo).lte("received_on", t),
  ]);
  return { invoices: rows<OpenInvoice>(inv), receivedThisWeek: rows<{ currency: string; amount: number }>(rec) };
}

export async function getPulseInput(): Promise<PulseInput> {
  const supabase = await createClient();
  const t = today();
  const { start, prevStart, nextStart } = monthBounds(t);
  const [now, prev, clients, time, staff] = await Promise.all([
    supabase.from("invoices").select("currency, total").gte("issued_on", start).lt("issued_on", nextStart).not("status", "in", "(draft,void)"),
    supabase.from("invoices").select("currency, total").gte("issued_on", prevStart).lt("issued_on", start).not("status", "in", "(draft,void)"),
    supabase.from("clients").select("name, status, created_at, health_score, health_band"),
    supabase.from("time_entries").select("minutes").gte("date", start).lte("date", t),
    supabase.from("members").select("id", { count: "exact", head: true }).eq("kind", "staff").eq("status", "active"),
  ]);
  return {
    invoicesThisMonth: rows(now),
    invoicesLastMonth: rows(prev),
    clients: rows(clients),
    loggedMinutes: rows<{ minutes: number }>(time).reduce((s, r) => s + Number(r.minutes), 0),
    staffCount: staff.error ? 0 : (staff.count ?? 0),
    workdaysElapsed: workdaysElapsed(t),
  };
}

export async function listMyDeals(memberId: string): Promise<Deal[]> {
  const supabase = await createClient();
  return rows<Deal>(
    await supabase.from("pipeline_deals").select("id, name, service, stage, value, currency").eq("owner_id", memberId).neq("stage", "lost").order("value", { ascending: false }).limit(8),
  ).map((d) => ({ ...d, value: Number(d.value) }));
}

/** Pending leave requests plus anyone off today. */
export async function getHrToday() {
  const supabase = await createClient();
  const t = today();
  const [pending, off] = await Promise.all([
    supabase.from(LEAVE_TABLE).select("id, member_id, kind, starts_on, ends_on, status").eq("status", "pending").order("starts_on").limit(8),
    supabase.from(LEAVE_TABLE).select("id, member_id, kind, starts_on, ends_on, status").eq("status", "approved").lte("starts_on", t).gte("ends_on", t).limit(12),
  ]);
  return { pending: rows<LeaveRow>(pending), offToday: rows<LeaveRow>(off) };
}

// ---------------------------------------------------------------- Settings
export async function listApiKeys(): Promise<ApiKeyRow[]> {
  const supabase = await createClient();
  return rows<ApiKeyRow>(
    await supabase.from("api_keys").select("id, name, prefix, scopes, created_at, last_used_at, revoked_at").order("created_at", { ascending: false }),
  );
}

export async function listDeliveries(limit = 50): Promise<DeliveryRow[]> {
  const supabase = await createClient();
  const data = rows<{ id: string; sent_at: string; to_address: string | null; channel: DeliveryRow["channel"]; message: string; result: DeliveryRow["result"]; member: { name: string } | null }>(
    await supabase
      .from("notification_deliveries")
      .select("id, sent_at, to_address, channel, message, result, member:members!member_id(name)")
      .order("sent_at", { ascending: false })
      .limit(limit),
  );
  return data.map((d) => ({ id: d.id, sent_at: d.sent_at, to: d.member?.name ?? d.to_address ?? "", channel: d.channel, message: d.message, result: d.result }));
}

// ---------------------------------------------------------------- Integrations
const CONN_COLS = "id, provider, status, account_label, last_sync_at, last_error";

export async function getConnection(provider: Provider, memberId?: string): Promise<Connection | null> {
  const supabase = await createClient();
  let q = supabase.from("integration_connections").select(CONN_COLS).eq("provider", provider);
  q = memberId ? q.eq("member_id", memberId) : q.is("member_id", null);
  return one<Connection>(await q.maybeSingle());
}

export async function listFirefliesCalls(opts: { clientId?: string; unmatchedOnly?: boolean; limit?: number } = {}): Promise<FirefliesCall[]> {
  const supabase = await createClient();
  let q = supabase
    .from("fireflies_calls")
    .select("id, title, occurred_at, minutes, participants, client_id, match_method, summary, summary_status, client:clients(name)")
    .order("occurred_at", { ascending: false })
    .limit(opts.limit ?? 20);
  if (opts.clientId) q = q.eq("client_id", opts.clientId);
  if (opts.unmatchedOnly) q = q.is("client_id", null);
  const data = rows<FirefliesCall & { client: { name: string } | null }>(await q);
  return data.map(({ client, ...c }) => ({ ...c, client_name: client?.name ?? null }));
}

export async function listClientOptions() {
  const supabase = await createClient();
  return rows<{ id: string; name: string }>(await supabase.from("clients").select("id, name").order("name"));
}

export async function getInboxSummary(days = 7) {
  const supabase = await createClient();
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const [msgs, conn] = await Promise.all([
    supabase.from("inbox_messages").select("outcome").gte("received_at", since).limit(5000),
    getConnection("gmail"),
  ]);
  return { rows: rows<{ outcome: InboxOutcome }>(msgs), connection: conn };
}

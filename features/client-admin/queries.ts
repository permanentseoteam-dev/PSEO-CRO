import "server-only";
import { addMonths, format, parseISO, startOfMonth } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import type { HealthPoint } from "@/lib/modules/clients/logic";
import type { ActivityLine, Agreement, ChurnAlert, Currency, EndedClient, SentimentRow, VaultItem, Winback } from "./types";

// Reads run as the signed-in user, so RLS decides what comes back. Errors read as empty.
const rows = <T,>(r: { data: unknown }) => (r.data ?? []) as T[];
const one = <T,>(v: unknown) => (Array.isArray(v) ? v[0] : v) as T | null;

/** Today as YYYY-MM-DD in the agency's timezone (Asia/Dubai). */
export const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" });

/** Name, status and health score from the Phase 1 clients table. */
export async function getClientBasics(clientId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("id, name, status, health_score").eq("id", clientId).maybeSingle();
  return (data ?? null) as { id: string; name: string; status: string; health_score: number | null } | null;
}

// ---------------------------------------------------------------- health history (0211)

/**
 * Daily snapshots from `from` (yyyy-mm-dd) on, oldest first, plus the newest one before `from`
 * so a "score N days ago" lookup still finds the nearest earlier row.
 */
export async function getHealthHistory(clientId: string, from: string): Promise<HealthPoint[]> {
  const supabase = await createClient();
  const [recent, before] = await Promise.all([
    supabase.from("client_health_history").select("day, score").eq("client_id", clientId).gte("day", from).order("day"),
    supabase.from("client_health_history").select("day, score").eq("client_id", clientId).lt("day", from).order("day", { ascending: false }).limit(1),
  ]);
  return [...rows<HealthPoint>(before), ...rows<HealthPoint>(recent)];
}

// ---------------------------------------------------------------- terms

export async function getAgreement(clientId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_terms")
    .select("*, start_date:term_start, renewal_on:renewal_date")
    .eq("client_id", clientId)
    .maybeSingle();
  const agreement = (data ?? null) as Agreement | null;
  let fileUrl: string | null = null;
  if (agreement?.agreement_path) {
    const s = await supabase.storage.from("client-agreements").createSignedUrl(agreement.agreement_path, 600);
    fileUrl = s.data?.signedUrl ?? null;
  }
  return { agreement, fileUrl };
}

/**
 * Hours logged this month on the client's tickets, or null when they can't be read.
 * Assumes Phase 1 `time_entries(minutes, date, ticket_id -> tickets.client_id)`; see WIRING.md.
 */
export async function getHoursThisMonth(clientId: string, today: string) {
  const from = startOfMonth(parseISO(today));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("time_entries")
    .select("minutes, tickets!inner(client_id)")
    .eq("tickets.client_id", clientId)
    .gte("date", format(from, "yyyy-MM-dd"))
    .lt("date", format(addMonths(from, 1), "yyyy-MM-dd"));
  if (error) return null;
  const minutes = (data ?? []).reduce((s, r) => s + Number((r as { minutes: number }).minutes ?? 0), 0);
  return Math.round((minutes / 60) * 10) / 10;
}

// ---------------------------------------------------------------- health

export async function getHealth(clientId: string) {
  const supabase = await createClient();
  const [s, a] = await Promise.all([
    supabase
      .from("client_sentiments")
      .select("id, sentiment, note, recorded_on")
      .eq("client_id", clientId)
      .order("recorded_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("churn_alerts")
      .select("id, trigger_kind, detail, nps_score, raised_on, outcome, outcome_note, closed_on")
      .eq("client_id", clientId)
      .order("raised_on", { ascending: false }),
  ]);
  return { sentiments: rows<SentimentRow>(s), alerts: rows<ChurnAlert>(a) };
}

// ---------------------------------------------------------------- vault and activity lines

export async function getVault(clientId: string): Promise<VaultItem[]> {
  const supabase = await createClient();
  const [items, reveals] = await Promise.all([
    supabase.from("client_vault_items").select("id, service, username, notes").eq("client_id", clientId).order("service"),
    supabase
      .from("client_vault_reveals")
      .select("item_id, revealed_at, members(name)")
      .eq("client_id", clientId)
      .order("revealed_at", { ascending: false })
      .limit(200),
  ]);
  const last = new Map<string, { name: string; at: string }>();
  for (const r of rows<{ item_id: string; revealed_at: string; members: unknown }>(reveals)) {
    if (last.has(r.item_id)) continue;
    last.set(r.item_id, { name: one<{ name: string }>(r.members)?.name ?? "Someone", at: r.revealed_at });
  }
  return rows<Omit<VaultItem, "last_reveal">>(items).map((i) => ({ ...i, last_reveal: last.get(i.id) ?? null }));
}

export async function getActivityLines(clientId: string) {
  const supabase = await createClient();
  const r = await supabase
    .from("shared_activity")
    .select("id, action, happened_at, visibility")
    .eq("client_id", clientId)
    .order("happened_at", { ascending: false })
    .limit(50);
  return toLines(r);
}

/** Shared lines for the client portal Home. RLS limits a client login to its own shared rows. */
export async function getSharedActivityLines(clientId: string, limit = 10) {
  const supabase = await createClient();
  const r = await supabase
    .from("shared_activity")
    .select("id, action, happened_at, visibility")
    .eq("client_id", clientId)
    .eq("visibility", "shared")
    .order("happened_at", { ascending: false })
    .limit(limit);
  return toLines(r);
}

/** 0114 shared_activity rows as activity lines (day in Asia/Dubai). */
function toLines(r: { data: unknown }): ActivityLine[] {
  return rows<{ id: string; action: string; happened_at: string; visibility: ActivityLine["visibility"] }>(r).map((a) => ({
    id: a.id,
    body: a.action,
    happened_on: new Date(a.happened_at).toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" }),
    visibility: a.visibility,
  }));
}

// ---------------------------------------------------------------- win-back

/**
 * Ended clients (status churned or terminated) with their last fee and latest win-back.
 * End date and reason are read from Phase 1 `clients.ended_on` / `clients.end_reason` when present; see WIRING.md.
 */
export async function listEndedClients(): Promise<EndedClient[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("*").in("status", ["churned", "terminated"]).order("name");
  const clients = (data ?? []) as Record<string, unknown>[];
  if (!clients.length) return [];
  const ids = clients.map((c) => c.id as string);
  const [ag, wb] = await Promise.all([
    supabase.from("client_terms").select("client_id, monthly_fee, currency").in("client_id", ids),
    supabase
      .from("client_winbacks")
      .select("id, client_id, status, next_step, due_on, created_at, owner:members!client_winbacks_owner_id_fkey(name)")
      .in("client_id", ids)
      .order("created_at", { ascending: false }),
  ]);
  const fees = new Map(rows<{ client_id: string; monthly_fee: number | null; currency: Currency }>(ag).map((a) => [a.client_id, a]));
  const winbacks = new Map<string, Winback>();
  for (const w of rows<Winback & { client_id: string; owner: unknown }>(wb)) {
    if (winbacks.has(w.client_id)) continue;
    winbacks.set(w.client_id, {
      id: w.id,
      status: w.status,
      next_step: w.next_step,
      due_on: w.due_on,
      owner_name: one<{ name: string }>(w.owner)?.name ?? null,
    });
  }
  const str = (v: unknown) => (typeof v === "string" && v ? v : null);
  return clients
    .map((c) => {
      const id = c.id as string;
      const fee = fees.get(id);
      return {
        id,
        name: c.name as string,
        ended_on: str(c.ended_on) ?? str(c.end_date),
        end_reason: str(c.end_reason),
        monthly_fee: fee?.monthly_fee != null ? Number(fee.monthly_fee) : null,
        currency: fee?.currency ?? null,
        winback: winbacks.get(id) ?? null,
      };
    })
    .sort((a, b) => (b.ended_on ?? "").localeCompare(a.ended_on ?? ""));
}

export async function listStaff() {
  const supabase = await createClient();
  const r = await supabase.from("members").select("id, name").eq("kind", "staff").eq("status", "active").order("name");
  return rows<{ id: string; name: string }>(r);
}

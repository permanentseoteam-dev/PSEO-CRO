// Pure logic for the platform extras. No I/O.
import type { Tone } from "@/components/ui";
import {
  API_SCOPES,
  INBOX_OUTCOMES,
  ONBOARDING_STEPS,
  type Announcement,
  type ApiScope,
  type CurrencyBalance,
  type Deal,
  type DeliveryResult,
  type InboxOutcome,
  type MatchMethod,
  type OpenInvoice,
  type OverdueRow,
  type OverdueTicket,
  type PulseInput,
} from "./types";

const ymd = (d: Date) => d.toISOString().slice(0, 10);

// ---------------------------------------------------------------- dates
/** First day of the month and of the previous month, as YYYY-MM-DD. `today` is YYYY-MM-DD. */
export function monthBounds(today: string) {
  const [y, m] = today.split("-").map(Number);
  const start = ymd(new Date(Date.UTC(y, m - 1, 1)));
  const prevStart = ymd(new Date(Date.UTC(y, m - 2, 1)));
  const nextStart = ymd(new Date(Date.UTC(y, m, 1)));
  return { start, prevStart, nextStart };
}

/** Monday-to-Friday days from the 1st of the month up to and including today. */
export function workdaysElapsed(today: string) {
  const [y, m, d] = today.split("-").map(Number);
  let n = 0;
  for (let i = 1; i <= d; i++) {
    const wd = new Date(Date.UTC(y, m - 1, i)).getUTCDay();
    if (wd !== 0 && wd !== 6) n++;
  }
  return n;
}

/** "Never", "Just now", "12 min ago", "3 h ago", or "4 Nov 10:40" (UTC formatting kept simple and stable). */
export function syncLabel(lastIso: string | null, now: Date) {
  if (!lastIso) return "Never";
  const mins = Math.floor((now.getTime() - new Date(lastIso).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60) return `${Math.floor(mins / 60)} h ago`;
  const d = new Date(lastIso);
  const mon = d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
  return `${d.getUTCDate()} ${mon} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

// ---------------------------------------------------------------- announcements
/** Drop expired posts (expiry day still shows), then pinned first, newest first. */
export function visibleAnnouncements<T extends Pick<Announcement, "pinned" | "expires_on" | "created_at">>(rows: T[], today: string): T[] {
  return rows
    .filter((a) => !a.expires_on || a.expires_on >= today)
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.created_at.localeCompare(a.created_at));
}

// ---------------------------------------------------------------- getting started
export function checklistProgress(done: Iterable<string>) {
  const set = new Set(done);
  const total = ONBOARDING_STEPS.length;
  const count = ONBOARDING_STEPS.filter((s) => set.has(s.key)).length;
  return { count, total, pct: Math.round((count / total) * 100), complete: count === total };
}

// ---------------------------------------------------------------- overdue by person
export function overdueByPerson(tickets: OverdueTicket[], today: string): OverdueRow[] {
  const map = new Map<string | null, OverdueRow>();
  for (const t of tickets) {
    if (!t.due_date || t.due_date >= today) continue;
    const row = map.get(t.assignee_id) ?? { memberId: t.assignee_id, count: 0, oldest: t.due_date };
    row.count++;
    if (t.due_date < row.oldest) row.oldest = t.due_date;
    map.set(t.assignee_id, row);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.oldest.localeCompare(b.oldest));
}

export function daysBetween(fromYmd: string, toYmd: string) {
  return Math.round((Date.parse(toYmd) - Date.parse(fromYmd)) / 86400000);
}

// ---------------------------------------------------------------- finance & accounts
const OPEN_STATUSES = new Set(["issued", "partly_paid", "disputed"]);
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Outstanding and overdue per currency, plus the number of overdue invoices. Overdue = open and past due. */
export function balancesByCurrency(invoices: OpenInvoice[], today: string) {
  const map = new Map<string, CurrencyBalance>();
  let overdueCount = 0;
  for (const inv of invoices) {
    if (!OPEN_STATUSES.has(inv.status)) continue;
    const bal = round2(Number(inv.total) - Number(inv.amount_paid));
    if (bal <= 0) continue;
    const row = map.get(inv.currency) ?? { currency: inv.currency, outstanding: 0, overdue: 0 };
    row.outstanding = round2(row.outstanding + bal);
    if (inv.due_on && inv.due_on < today) {
      row.overdue = round2(row.overdue + bal);
      overdueCount++;
    }
    map.set(inv.currency, row);
  }
  const order = ["AED", "USD", "PKR"];
  const rows = [...map.values()].sort((a, b) => order.indexOf(a.currency) - order.indexOf(b.currency));
  return { rows, overdueCount };
}

export function sumByCurrency(rows: { currency: string; total?: number; amount?: number }[]) {
  const out: Record<string, number> = {};
  for (const r of rows) out[r.currency] = round2((out[r.currency] ?? 0) + Number(r.total ?? r.amount ?? 0));
  return out;
}

// ---------------------------------------------------------------- CEO pulse
export function pulse(input: PulseInput, monthStart: string) {
  const now = sumByCurrency(input.invoicesThisMonth);
  const prev = sumByCurrency(input.invoicesLastMonth);
  const base = "AED";
  const revenue = now[base] ?? 0;
  const prevRevenue = prev[base] ?? 0;
  const changePct = prevRevenue > 0 ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100) : null;
  const others = Object.entries(now).filter(([c, v]) => c !== base && v > 0);

  const active = input.clients.filter((c) => c.status === "active");
  const newThisMonth = active.filter((c) => c.created_at.slice(0, 10) >= monthStart).length;
  const atRisk = active.filter((c) => c.health_band === "at_risk");
  const lowest = atRisk.reduce<(typeof atRisk)[number] | null>(
    (lo, c) => (lo === null || (c.health_score ?? 101) < (lo.health_score ?? 101) ? c : lo),
    null,
  );

  const capacityMin = input.staffCount * input.workdaysElapsed * 8 * 60;
  const utilisationPct = capacityMin > 0 ? Math.min(100, Math.round((input.loggedMinutes / capacityMin) * 100)) : 0;

  return { base, revenue, changePct, others, activeClients: active.length, newThisMonth, atRisk: atRisk.length, lowest, utilisationPct };
}

// ---------------------------------------------------------------- pipeline
export const STAGE_INFO: Record<Deal["stage"], { label: string; tone: Tone }> = {
  discovery: { label: "Discovery", tone: "muted" },
  proposal: { label: "Proposal sent", tone: "blue" },
  negotiation: { label: "Negotiation", tone: "violet" },
  won: { label: "Won", tone: "ok" },
  lost: { label: "Lost", tone: "danger" },
};

/** Open value per currency (won and lost are not open). */
export function pipelineOpen(deals: Pick<Deal, "stage" | "value" | "currency">[]) {
  return sumByCurrency(deals.filter((d) => d.stage !== "won" && d.stage !== "lost").map((d) => ({ currency: d.currency, amount: d.value })));
}

// ---------------------------------------------------------------- API keys
export function isApiScope(s: string): s is ApiScope {
  return (API_SCOPES as readonly string[]).includes(s);
}

/** Read the bearer key from an Authorization header. */
export function bearerKey(header: string | null) {
  const m = header?.match(/^Bearer\s+(pk_[a-z0-9]{6}_[A-Za-z0-9_-]{32,})$/);
  return m ? m[1] : null;
}

export const DELIVERY_TONE: Record<DeliveryResult, { label: string; tone: Tone }> = {
  queued: { label: "Queued", tone: "muted" },
  delivered: { label: "Delivered", tone: "ok" },
  held: { label: "Held", tone: "muted" },
  bounced: { label: "Bounced", tone: "danger" },
  failed: { label: "Failed", tone: "danger" },
};

// ---------------------------------------------------------------- Fireflies matching
export type MatchClient = { id: string; name: string; emails: string[]; domains: string[] };

const FREE_MAIL = new Set(["gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com", "live.com"]);
const domainOf = (email: string) => email.split("@")[1]?.toLowerCase() ?? "";
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Match a call to a client: a participant's exact email first, then a participant's company domain
 * (never our own or free-mail domains), then the client's name in the title.
 */
export function matchCall(
  call: { title: string; participants: string[] },
  clients: MatchClient[],
  ourDomains: string[],
): { clientId: string | null; method: MatchMethod } {
  const emails = call.participants.map((e) => e.toLowerCase());
  for (const c of clients) if (c.emails.some((e) => emails.includes(e.toLowerCase()))) return { clientId: c.id, method: "email" };

  const ours = new Set(ourDomains.map((d) => d.toLowerCase()));
  const domains = emails.map(domainOf).filter((d) => d && !ours.has(d) && !FREE_MAIL.has(d));
  for (const c of clients) if (c.domains.some((d) => domains.includes(d.toLowerCase()))) return { clientId: c.id, method: "domain" };

  const title = ` ${norm(call.title)} `;
  // Longest name first so "Alba Motors Group" beats "Alba Motors".
  for (const c of [...clients].sort((a, b) => b.name.length - a.name.length)) {
    const n = norm(c.name);
    if (n && title.includes(` ${n} `)) return { clientId: c.id, method: "title" };
  }
  return { clientId: null, method: "none" };
}

export const MATCH_LABEL: Record<MatchMethod, string> = {
  email: "matched by email",
  domain: "matched by domain",
  title: "matched by title",
  manual: "assigned by hand",
  none: "no client",
};

// ---------------------------------------------------------------- inbox counts
export function inboxCounts(rows: { outcome: InboxOutcome }[]) {
  const counts = Object.fromEntries(INBOX_OUTCOMES.map((o) => [o.key, 0])) as Record<InboxOutcome, number>;
  for (const r of rows) if (r.outcome in counts) counts[r.outcome]++;
  return counts;
}

// ---------------------------------------------------------------- formatting
export function money(amount: number, currency: string) {
  const digits = currency === "PKR" ? 0 : Number.isInteger(amount) ? 0 : 2;
  return `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

/** "4 Nov" from YYYY-MM-DD or an ISO timestamp. */
export function shortDate(value: string) {
  const d = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  return `${d.getUTCDate()} ${d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" })}`;
}

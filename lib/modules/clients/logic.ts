// Pure client logic: health score, bands, escalation windows, portfolio grouping. No I/O.
import type { Tone } from "@/components/ui";

export const SERVICES = ["SEO", "PPC", "Social", "Content", "Web", "Design"] as const;
export const CURRENCIES = ["AED", "USD", "PKR"] as const;
export const COUNTRIES = ["UAE", "Saudi Arabia", "Pakistan", "UK", "USA"] as const;
export const CHANNELS = { whatsapp: "WhatsApp", email: "Email", slack: "Slack", phone: "Phone" } as const;
export const CLIENT_STATUSES = ["onboarding", "active", "paused", "churned", "terminated", "internal"] as const;
export const END_REASONS = ["Budget cut", "Moved in-house", "Unhappy with results", "Business closed", "Other"] as const;
export const TEAM_ROLES = { delivery_lead: "Delivery lead", delivery: "Delivery", account_executive: "Account executive", backup: "Backup" } as const;
export const LOG_KINDS = { call: "Call", whatsapp: "WhatsApp", email: "Email", meeting: "Meeting", note: "Note" } as const;
/** Timeline kinds that count as talking to the client. */
export const CONTACT_KINDS = ["call", "whatsapp", "email", "meeting"];

export type ClientStatus = (typeof CLIENT_STATUSES)[number];
export type Band = "healthy" | "watch" | "at_risk" | "new" | "no_data";
export type Severity = "critical" | "high" | "medium" | "low";

/** Filter labels in the order the portfolio shows them. */
export const BAND_LABEL: Record<Band, string> = { at_risk: "At risk", watch: "Watch", healthy: "Healthy", new: "New", no_data: "No data" };
export const BAND_TONE: Record<Band, Tone> = { healthy: "ok", watch: "warn", at_risk: "danger", new: "blue", no_data: "muted" };

export function statusLabel(s: string): string {
  if (s === "churned" || s === "terminated") return "Ended";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export function statusTone(s: string): Tone {
  return s === "active" ? "ok" : s === "onboarding" ? "blue" : s === "paused" ? "warn" : "muted";
}
export const isEnded = (s: string) => s === "churned" || s === "terminated";

// ---------------------------------------------------------------- dates (Asia/Dubai, UTC+4, no DST)
const DUBAI_MS = 4 * 3600_000;
const DAY_MS = 86_400_000;

/** yyyy-mm-dd in Dubai for an instant. */
export const dubaiDate = (d: Date) => new Date(d.getTime() + DUBAI_MS).toISOString().slice(0, 10);

/** Whole days from a to b (yyyy-mm-dd). */
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY_MS);

// ---------------------------------------------------------------- health score
export type HealthInput = {
  status: string;
  startDate: string | null;
  today: string; // yyyy-mm-dd
  overdueTickets: number;
  lastContact: string | null; // yyyy-mm-dd
  openWaits: number;
  overdueInvoices: number;
  openEscalations: Severity[];
};
export type HealthFactor = { label: string; points: number };
export type Health = { score: number | null; band: Band; factors: HealthFactor[] };

const ESC_POINTS: Record<Severity, number> = { critical: 10, high: 6, medium: 3, low: 1 };

export function bandFor(score: number): Band {
  return score >= 75 ? "healthy" : score >= 50 ? "watch" : "at_risk";
}

/**
 * 100 minus deductions:
 *  overdue work 6 each (max 30), days since contact 1 per day after 2 days (max 20; never contacted = 20),
 *  unanswered client waits 4 each (max 20), overdue invoices 10 each (max 20),
 *  open escalations critical 10 / high 6 / medium 3 / low 1 (max 20).
 * New for the first 30 days, No data when the client isn't active or onboarding.
 */
export function healthScore(i: HealthInput): Health {
  if (i.status !== "active" && i.status !== "onboarding") return { score: null, band: "no_data", factors: [] };
  if (i.startDate && daysBetween(i.startDate, i.today) < 30) return { score: null, band: "new", factors: [] };
  const days = i.lastContact ? Math.max(0, daysBetween(i.lastContact, i.today)) : null;
  const neg = (n: number) => (n === 0 ? 0 : -n);
  const factors: HealthFactor[] = [
    { label: "Overdue work", points: neg(Math.min(30, 6 * i.overdueTickets)) },
    { label: "Days since contact", points: neg(days == null ? 20 : Math.min(20, Math.max(0, days - 2))) },
    { label: "Unanswered client waits", points: neg(Math.min(20, 4 * i.openWaits)) },
    { label: "Overdue invoices", points: neg(Math.min(20, 10 * i.overdueInvoices)) },
    { label: "Open escalations", points: neg(Math.min(20, i.openEscalations.reduce((a, s) => a + ESC_POINTS[s], 0))) },
  ];
  const score = Math.max(0, 100 + factors.reduce((a, f) => a + f.points, 0));
  return { score, band: bandFor(score), factors };
}

// ---------------------------------------------------------------- health history (client_health_history, 0211)
export type HealthPoint = { day: string; score: number }; // day yyyy-mm-dd

/** Points the "Falling" filter needs: a 7-day change of this or worse. */
export const FALLING_POINTS = -10;

/** yyyy-mm-dd plus n days (n may be negative). */
export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

/** Score on `day`, or on the nearest earlier day with a snapshot. Null when no snapshot is that old. */
export function scoreOnOrBefore(points: HealthPoint[], day: string): number | null {
  let best: HealthPoint | null = null;
  for (const p of points) if (p.day <= day && (!best || p.day > best.day)) best = p;
  return best ? best.score : null;
}

/** Current score minus the score `days` ago (nearest earlier snapshot). Null when either is unknown. */
export function healthChange(current: number | null, points: HealthPoint[], today: string, days = 7): number | null {
  const prev = scoreOnOrBefore(points, addDays(today, -days));
  return current == null || prev == null ? null : current - prev;
}

export const isFalling = (change: number | null | undefined) => change != null && change <= FALLING_POINTS;

/** "−12 in 7 days", "+4 in 7 days", "No change in 7 days". Tone: danger when down, ok otherwise. */
export function changeLabel(change: number | null, days = 7): { text: string; tone: Tone } {
  if (change == null) return { text: `No score from ${days} days ago yet`, tone: "muted" };
  if (change === 0) return { text: `No change in ${days} days`, tone: "ok" };
  return { text: `${change < 0 ? "−" : "+"}${Math.abs(change)} in ${days} days`, tone: change < 0 ? "danger" : "ok" };
}

// ---------------------------------------------------------------- escalations
export const SEVERITY: Record<Severity, { label: string; hours: number; tone: Tone }> = {
  critical: { label: "Critical", hours: 2, tone: "danger" },
  high: { label: "High", hours: 8, tone: "warn" },
  medium: { label: "Medium", hours: 24, tone: "blue" },
  low: { label: "Low", hours: 72, tone: "muted" },
};

const WORK_START = 9;
const WORK_END = 18;

/** Adds working hours (Mon-Fri 09:00-18:00 Dubai time) to an instant. */
export function addWorkingHours(start: Date, hours: number): Date {
  // Work in "Dubai wall clock as UTC" so getUTC* give local fields.
  let t = start.getTime() + DUBAI_MS;
  let left = Math.round(hours * 60) * 60_000;
  for (let guard = 0; guard < 400; guard++) {
    const d = new Date(t);
    const dow = d.getUTCDay();
    const dayStart = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    const open = dayStart + WORK_START * 3600_000;
    const close = dayStart + WORK_END * 3600_000;
    if (dow === 0 || dow === 6 || t >= close) {
      t = dayStart + DAY_MS + WORK_START * 3600_000;
      continue;
    }
    if (t < open) t = open;
    const room = close - t;
    if (left <= room) return new Date(t + left - DUBAI_MS);
    left -= room;
    t = dayStart + DAY_MS + WORK_START * 3600_000;
  }
  return new Date(t - DUBAI_MS);
}

/** "8 working hours · passed", "· 9h left", "· met", "· missed". */
export function windowStatus(e: { severity: Severity; dueAt: string; closedAt: string | null }, now: Date): { text: string; tone: Tone; past: boolean } {
  const due = Date.parse(e.dueAt);
  const base = `${SEVERITY[e.severity].hours} working hours`;
  if (e.closedAt) {
    const met = Date.parse(e.closedAt) <= due;
    return { text: `${base} · ${met ? "met" : "missed"}`, tone: met ? "ok" : "danger", past: false };
  }
  if (now.getTime() > due) return { text: `${base} · passed`, tone: "danger", past: true };
  const h = Math.max(1, Math.ceil((due - now.getTime()) / 3600_000));
  return { text: `${base} · ${h}h left`, tone: "ok", past: false };
}

// ---------------------------------------------------------------- portfolio
export type CardClient = {
  id: string;
  name: string;
  status: string;
  band: Band;
  ownerName: string;
  services: string[];
  /** Score change over the last 7 days, when known. */
  change7?: number | null;
};
export type PortfolioFilter = { band: string; owner: string; service: string; status: string; q: string };
export const NO_FILTER: PortfolioFilter = { band: "all", owner: "", service: "", status: "", q: "" };

/** Status filter uses the shown label (Ended covers churned and terminated). Health "falling" = 7-day change of −10 or worse. */
export function matches(c: CardClient, f: PortfolioFilter): boolean {
  return (
    (f.band === "all" || (f.band === "falling" ? isFalling(c.change7) : c.band === f.band)) &&
    (!f.owner || c.ownerName === f.owner) &&
    (!f.service || c.services.includes(f.service)) &&
    (!f.status || statusLabel(c.status) === f.status) &&
    (!f.q || c.name.toLowerCase().includes(f.q.trim().toLowerCase()))
  );
}

export type OwnerRow = {
  owner: string;
  clients: number;
  healthy: number;
  watch: number;
  atRisk: number;
  newOrNoData: number;
  escalations: number;
  fees: { currency: string; amount: number }[];
};

/** "By owner" table: one row per account executive, fees summed per currency. */
export function byOwner(
  clients: { ownerName: string; band: Band; escalations: number; fee: number | null; currency: string }[],
): OwnerRow[] {
  const map = new Map<string, OwnerRow>();
  for (const c of clients) {
    const key = c.ownerName || "No owner";
    const r =
      map.get(key) ?? { owner: key, clients: 0, healthy: 0, watch: 0, atRisk: 0, newOrNoData: 0, escalations: 0, fees: [] };
    r.clients++;
    if (c.band === "healthy") r.healthy++;
    else if (c.band === "watch") r.watch++;
    else if (c.band === "at_risk") r.atRisk++;
    else r.newOrNoData++;
    r.escalations += c.escalations;
    if (c.fee != null) {
      const f = r.fees.find((x) => x.currency === c.currency);
      if (f) f.amount += c.fee;
      else r.fees.push({ currency: c.currency, amount: c.fee });
    }
    map.set(key, r);
  }
  return [...map.values()].sort((a, b) => a.owner.localeCompare(b.owner));
}

/** Monday of the week containing `day` (yyyy-mm-dd). */
export function weekStart(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  const back = (d.getUTCDay() + 6) % 7;
  return new Date(d.getTime() - back * DAY_MS).toISOString().slice(0, 10);
}

export function money(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export function daysAgo(n: number | null): string {
  if (n == null) return "Never";
  if (n <= 0) return "Today";
  if (n === 1) return "Yesterday";
  return `${n} days ago`;
}

// ---------------------------------------------------------------- display formats (Dubai time)
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "3 Nov", or "3 Nov 2025" when not in `thisYear`. */
export function fmtDay(day: string, thisYear?: string): string {
  const [y, m, d] = day.slice(0, 10).split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1]}${thisYear && y !== thisYear ? ` ${y}` : ""}`;
}

/** "Wed 5 Nov, 14:30" in Dubai time. */
export function fmtMeeting(iso: string): string {
  const d = new Date(Date.parse(iso) + DUBAI_MS);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${hh}:${mm}`;
}

/** "Feb 2025". */
export function fmtMonth(day: string): string {
  const [y, m] = day.split("-");
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

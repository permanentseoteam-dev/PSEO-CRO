// Pure logic for Projects, Reviews and Templates. No I/O.
import { addDays } from "@/lib/modules/tickets/logic";
import type { QualityRow, ReviewFact, Subtask } from "./types";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MON = MONTHS.map((m) => m.slice(0, 3));

/** Project keys are 2 to 8 letters, stored upper case. Returns null when invalid. */
export function normalizeKey(input: string): string | null {
  const k = input.trim().toUpperCase();
  return /^[A-Z]{2,8}$/.test(k) ? k : null;
}

/** Open, overdue and done-in-30-days counts per project. */
export function projectStats(
  tickets: { project_id: string | null; status: string; due_date: string | null; completed_at: string | null }[],
  today: string,
): Record<string, { open: number; overdue: number; done30: number }> {
  const since = addDays(today, -30);
  const out: Record<string, { open: number; overdue: number; done30: number }> = {};
  for (const t of tickets) {
    if (!t.project_id) continue;
    const s = (out[t.project_id] ??= { open: 0, overdue: 0, done30: 0 });
    if (t.status === "done") {
      if (t.completed_at && t.completed_at.slice(0, 10) >= since) s.done30++;
    } else {
      s.open++;
      if (t.due_date && t.due_date < today) s.overdue++;
    }
  }
  return out;
}

/** Fills {client} {project} {month} {date} in a template title. `today` is YYYY-MM-DD. */
export function fillTitle(pattern: string, ctx: { client?: string; project?: string; today: string }): string {
  const [y, m, d] = ctx.today.split("-").map(Number);
  return pattern
    .replaceAll("{client}", ctx.client ?? "")
    .replaceAll("{project}", ctx.project ?? "")
    .replaceAll("{month}", `${MONTHS[m - 1]} ${y}`)
    .replaceAll("{date}", `${MON[m - 1]} ${d}`)
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Non-empty trimmed lines. */
export function parseLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

/** Subtasks, one per line as "title | +Nd" (the offset is optional). */
export function parseSubtasks(text: string): Subtask[] {
  return parseLines(text).map((line) => {
    const m = line.match(/^(.*?)\s*\|\s*\+?(\d{1,3})\s*d?\s*$/i);
    return m && m[1] ? { title: m[1].trim(), due_offset_days: Number(m[2]) } : { title: line.replace(/\|\s*$/, "").trim(), due_offset_days: null };
  });
}

export function formatSubtasks(list: Subtask[]): string {
  return list.map((s) => (s.due_offset_days != null ? `${s.title} | +${s.due_offset_days}d` : s.title)).join("\n");
}

export type Range = "30d" | "90d" | "year";
export const RANGES: { value: Range; label: string }[] = [
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "year", label: "Last year" },
];

/** First day (inclusive) of a report range. */
export function rangeStart(range: Range, today: string): string {
  return addDays(today, range === "30d" ? -30 : range === "90d" ? -90 : -365);
}

export function hoursBetween(fromIso: string, to: Date | string): number {
  const end = typeof to === "string" ? new Date(to) : to;
  return Math.max(0, (end.getTime() - new Date(fromIso).getTime()) / 3_600_000);
}

/**
 * Quality numbers for a set of decided review rounds:
 * reviewed = distinct tickets; first-time pass = share of tickets approved in round 1;
 * avg rounds = mean of the highest round per ticket; avg wait = mean submit-to-decision hours;
 * over 24h = rounds that waited longer than a day.
 */
export function qualityStats(reviews: ReviewFact[]): Omit<QualityRow, "key" | "label"> {
  const decided = reviews.filter((r) => r.status !== "waiting" && r.decided_at);
  const tickets = new Map<string, { max: number; firstPass: boolean }>();
  let waitSum = 0;
  let over24 = 0;
  for (const r of decided) {
    const t = tickets.get(r.ticket_id) ?? { max: 0, firstPass: false };
    t.max = Math.max(t.max, r.round);
    if (r.round === 1 && r.status === "approved") t.firstPass = true;
    tickets.set(r.ticket_id, t);
    const h = hoursBetween(r.submitted_at, r.decided_at!);
    waitSum += h;
    if (h > 24) over24++;
  }
  const n = tickets.size;
  const all = [...tickets.values()];
  return {
    reviewed: n,
    firstPass: n ? all.filter((t) => t.firstPass).length / n : null,
    avgRounds: n ? all.reduce((a, t) => a + t.max, 0) / n : null,
    avgWaitH: decided.length ? waitSum / decided.length : null,
    over24,
  };
}

/** Quality rows grouped by a key (person, department, client), most reviewed first. */
export function qualityBy(reviews: ReviewFact[], keyOf: (r: ReviewFact) => string | null, labelOf: (key: string) => string): QualityRow[] {
  const groups = new Map<string, ReviewFact[]>();
  for (const r of reviews) {
    const k = keyOf(r);
    if (!k) continue;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  return [...groups.entries()]
    .map(([key, rs]) => ({ key, label: labelOf(key), ...qualityStats(rs) }))
    .filter((r) => r.reviewed > 0)
    .sort((a, b) => b.reviewed - a.reviewed || a.label.localeCompare(b.label));
}

/** How often each send-back reason was picked, most common first. */
export function reasonCounts(reviews: ReviewFact[]): [string, number][] {
  const c = new Map<string, number>();
  for (const r of reviews) if (r.status === "changes") for (const x of r.reasons) c.set(x, (c.get(x) ?? 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

export const pct = (v: number | null) => (v == null ? "–" : `${Math.round(v * 100)}%`);
export const oneDp = (v: number | null) => (v == null ? "–" : v.toFixed(1));
export const hrs = (v: number | null) => (v == null ? "–" : `${Math.round(v)}h`);

/** Groups items by a label, keeping the order given in `order` first, then any others A–Z. */
export function groupInOrder<T>(items: T[], labelOf: (t: T) => string, order: string[] = []): [string, T[]][] {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const l = labelOf(it);
    m.set(l, [...(m.get(l) ?? []), it]);
  }
  const rank = (l: string) => {
    const i = order.indexOf(l);
    return i === -1 ? order.length : i;
  };
  return [...m.entries()].sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0]));
}

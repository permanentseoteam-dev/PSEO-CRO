// Pure logic for Home and My work: dates, grouping, stats, Today list. No I/O.
import type { Tone } from "@/components/ui";
import type { DueGroup, MyEvent, MyTicket, TodayItem, View } from "./types";

export const TZ = "Asia/Dubai";
const PRI_ORDER = ["urgent", "high", "normal", "low"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_L = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MON_L = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** yyyy-mm-dd of an instant in the agency time zone. */
export function localDate(at: Date | string, tz = TZ) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(at));
}

/** hh:mm (24h) of an instant in the agency time zone. */
export function localTime(at: Date | string, tz = TZ) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(at));
}

const utc = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

/** Whole days from `today` to `date` (negative = past). */
export function dayDiff(date: string, today: string) {
  return Math.round((utc(date).getTime() - utc(today).getTime()) / 86400000);
}

/** "Wed 4 Nov" */
export function fmtShort(date: string) {
  const d = utc(date);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`;
}

/** "Wednesday, 4 November 2026" */
export function fmtLong(date: string) {
  const d = utc(date);
  return `${DAYS_L[d.getUTCDay()]}, ${d.getUTCDate()} ${MON_L[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "Good morning" / "Good afternoon" / "Good evening" for an hour 0-23. */
export function greeting(hour: number) {
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

/** Overdue, Today, This week (until Sunday), Later, No due date. */
export function dueGroup(due: string | null, today: string): DueGroup {
  if (!due) return "none";
  const n = dayDiff(due, today);
  if (n < 0) return "overdue";
  if (n === 0) return "today";
  const weekLeft = (7 - utc(today).getUTCDay()) % 7; // days until Sunday
  return n <= weekLeft ? "week" : "later";
}

export const GROUPS: [DueGroup, string][] = [
  ["overdue", "Overdue"],
  ["today", "Today"],
  ["week", "This week"],
  ["later", "Later"],
  ["none", "No due date"],
];

export const VIEWS: [View, string][] = [
  ["assigned", "Assigned to me"],
  ["on", "Everything I'm on"],
  ["watching", "Watching"],
  ["asked", "I asked for"],
];

export function inView(t: MyTicket, view: View, meId: string) {
  switch (view) {
    case "assigned":
      return t.assigneeId === meId;
    case "on":
      return t.assigneeId === meId || t.reporterId === meId || t.watching;
    case "watching":
      return t.watching;
    case "asked":
      return t.reporterId === meId && t.assigneeId !== meId;
  }
}

export function parseView(v: string | undefined): View {
  return VIEWS.some(([k]) => k === v) ? (v as View) : "assigned";
}

/** Open tickets split into due groups, each sorted by due date (oldest first). */
export function groupTickets(list: MyTicket[], today: string) {
  const out: Record<DueGroup, MyTicket[]> = { overdue: [], today: [], week: [], later: [], none: [] };
  for (const t of list) if (t.status !== "done") out[dueGroup(t.due, today)].push(t);
  for (const g of Object.values(out)) g.sort((a, b) => (a.due ?? "").localeCompare(b.due ?? ""));
  return out;
}

/** The last 40 done tickets, newest first. */
export function lastDone(list: MyTicket[], n = 40) {
  return list
    .filter((t) => t.status === "done")
    .sort((a, b) => (b.doneOn ?? "").localeCompare(a.doneOn ?? ""))
    .slice(0, n);
}

/** Due cell: "2 days late" (danger), "Today" (bold), a date, or "None". */
export function dueLabel(due: string | null, today: string): { text: string; tone: "late" | "today" | "date" | "none" } {
  if (!due) return { text: "None", tone: "none" };
  const n = dayDiff(due, today);
  if (n < 0) return { text: `${plural(-n, "day")} late`, tone: "late" };
  if (n === 0) return { text: "Today", tone: "today" };
  return { text: fmtShort(due), tone: "date" };
}

/** "Project · 3 subtasks · 2/5 checklist · 4 comments" */
export function metaLine(t: MyTicket) {
  const bits: string[] = [];
  if (t.projectName) bits.push(t.projectName);
  if (t.subtasks) bits.push(plural(t.subtasks, "subtask"));
  if (t.checklistTotal) bits.push(`${t.checklistDone}/${t.checklistTotal} checklist`);
  if (t.comments) bits.push(plural(t.comments, "comment"));
  return bits.join(" · ");
}

/** The four stat cards on Home, from my open assigned tickets. */
export function homeStats(mine: MyTicket[], today: string) {
  const open = mine.filter((t) => t.status !== "done");
  const overdue = open.filter((t) => t.due && dayDiff(t.due, today) < 0);
  const dueToday = open.filter((t) => t.due === today);
  return {
    open: open.length,
    urgent: open.filter((t) => t.priority === "high" || t.priority === "urgent").length,
    overdue: overdue.length,
    oldestLate: overdue.reduce((m, t) => Math.max(m, -dayDiff(t.due!, today)), 0),
    dueToday: dueToday.length,
    dueTodayInProgress: dueToday.filter((t) => t.status === "in_progress").length,
    blocked: open.filter((t) => t.status === "blocked").length,
    review: open.filter((t) => t.status === "in_review").length,
  };
}

/** Up next: my open, unblocked tickets by due date (none last), then priority. */
export function upNext(mine: MyTicket[], n = 6) {
  return mine
    .filter((t) => t.status !== "done" && t.status !== "blocked")
    .sort(
      (a, b) =>
        (a.due ?? "9999").localeCompare(b.due ?? "9999") || PRI_ORDER.indexOf(a.priority) - PRI_ORDER.indexOf(b.priority),
    )
    .slice(0, n);
}

/**
 * Today list: overdue tickets (Late, Now), today's meetings still running or ahead
 * (Now if running or starting within 30 min, Soon if within 30 min, else Later), then tickets due today.
 */
export function todayItems(mine: MyTicket[], events: MyEvent[], now: Date, today: string): TodayItem[] {
  const open = mine.filter((t) => t.status !== "done");
  const nowMs = now.getTime();
  const items: TodayItem[] = [];
  for (const t of open) {
    if (t.due && dayDiff(t.due, today) < 0)
      items.push({ sort: -1, time: "Late", title: `${t.key} ${t.title}`, href: `/t/${t.key}`, tag: "now", join: null });
  }
  for (const e of events) {
    if (localDate(e.startsAt) !== today) continue;
    const st = new Date(e.startsAt).getTime();
    if (new Date(e.endsAt).getTime() <= nowMs) continue;
    const tag = st <= nowMs ? "now" : st - nowMs <= 30 * 60000 ? "soon" : "later";
    items.push({ sort: st, time: localTime(e.startsAt), title: e.title, href: "/calendar", tag, join: e.meetLink });
  }
  const endOfDay = Number.MAX_SAFE_INTEGER;
  open
    .filter((t) => t.due === today)
    .forEach((t, i) =>
      items.push({ sort: endOfDay - 100 + i, time: "Due", title: `${t.key} ${t.title}`, href: `/t/${t.key}`, tag: i === 0 ? "soon" : "later", join: null }),
    );
  return items.sort((a, b) => a.sort - b.sort);
}

/** Why an update reached me. */
export function whyFor(t: Pick<MyTicket, "assigneeId" | "reporterId" | "watching"> | undefined, meId: string) {
  if (!t) return null;
  if (t.assigneeId === meId) return "assigned" as const;
  if (t.reporterId === meId) return "reported" as const;
  if (t.watching) return "watching" as const;
  return null;
}

export const WHY_TEXT = { assigned: "you are assigned", reported: "you reported it", watching: "you are watching" } as const;

/** "12 min ago", "3 h ago", "Yesterday", "Mon 2 Nov". */
export function ago(at: string, now: Date) {
  const mins = Math.floor((now.getTime() - new Date(at).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60 && localDate(at) === localDate(now)) return `${Math.floor(mins / 60)} h ago`;
  const days = dayDiff(localDate(now), localDate(at));
  if (days === 1) return "Yesterday";
  return fmtShort(localDate(at));
}

/** Monthly report status from the client's latest report ticket this month. */
export function reportStatus(r: { status: string; due: string | null; doneOn: string | null } | null, today: string): { label: string; tone: Tone } {
  if (!r) return { label: "Not sent", tone: "warn" };
  if (r.status === "done") return { label: r.doneOn ? `Sent ${fmtShort(r.doneOn).slice(4)}` : "Sent", tone: "ok" };
  if (!r.due) return { label: "Not sent", tone: "warn" };
  const n = dayDiff(r.due, today);
  if (n < 0) return { label: `${plural(-n, "day")} late`, tone: "danger" };
  return { label: n === 0 ? "Due today" : `Due ${fmtShort(r.due).slice(4)}`, tone: "warn" };
}

/** Health band colour. */
export function bandTone(band: string | null): Tone {
  const b = (band ?? "").toLowerCase();
  if (b === "healthy") return "ok";
  if (b === "watch") return "warn";
  if (b === "at risk" || b === "at_risk") return "danger";
  return "muted";
}

/** Load bar: percentage of capacity and its tone. */
export function loadBar(open: number, cap: number): { pct: number; tone: Tone | null } {
  const pct = cap > 0 ? Math.min(100, Math.round((open / cap) * 100)) : 100;
  return { pct, tone: open > cap ? "danger" : pct > 85 ? "warn" : null };
}

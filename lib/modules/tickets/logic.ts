// Pure ticket logic: filters, counts, grouping, sorting, dates, durations, files. No I/O.
import type { DueFilter, Filters, GroupBy, PriorityLevel, SortBy, StatusTab, TicketRow, TicketStatus, View } from "./types";

export const STATUSES: TicketStatus[] = ["todo", "in_progress", "in_review", "blocked", "done"];
export const PRIORITIES: PriorityLevel[] = ["urgent", "high", "normal", "low"];
export const STATUS_LABEL: Record<TicketStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  in_review: "In review",
  blocked: "Blocked",
  done: "Done",
};
export const PRIORITY_LABEL: Record<PriorityLevel, string> = { urgent: "Urgent", high: "High", normal: "Normal", low: "Low" };
export const SEND_BACK_REASONS = ["Missed the brief", "Quality", "Accuracy", "Brand or tone", "Missing parts"];
export const MAX_FILE_BYTES = 2 * 1024 * 1024;

const oneOf = <T extends string>(v: string | undefined, list: readonly T[], dflt: T): T =>
  v && (list as readonly string[]).includes(v) ? (v as T) : dflt;

/** Today's date (YYYY-MM-DD) in the agency's time zone. */
export function todayIn(tz = "Asia/Dubai", now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Sunday of the week that contains `iso` (weeks run Monday to Sunday). */
export function weekEnd(iso: string) {
  const dow = (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  return addDays(iso, 6 - dow);
}

export function parseFilters(sp: Record<string, string | string[] | undefined>, today: string): Filters {
  const s = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
  };
  const month = /^\d{4}-\d{2}$/.test(s("month")) ? s("month") : today.slice(0, 7);
  return {
    view: oneOf<View>(s("view"), ["list", "board", "cal"], "board"),
    st: oneOf<StatusTab>(s("st"), ["active", ...STATUSES], "active"),
    q: s("q").slice(0, 100),
    who: s("who"),
    pri: oneOf<"" | PriorityLevel>(s("pri"), ["", ...PRIORITIES], ""),
    due: oneOf<DueFilter>(s("due"), ["", "overdue", "today", "week", "none"], ""),
    tag: s("tag"),
    proj: s("proj"),
    group: oneOf<GroupBy>(s("group"), ["", "status", "assignee", "project", "priority", "due"], ""),
    sort: oneOf<SortBy>(s("sort"), ["due", "priority", "updated", "key"], "due"),
    month,
  };
}

const DEFAULTS: Omit<Filters, "month"> = {
  view: "board", st: "active", q: "", who: "", pri: "", due: "", tag: "", proj: "", group: "", sort: "due",
};

/** Query string for filters, leaving out defaults. `month` is kept only on the calendar. */
export function toQuery(f: Partial<Filters>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) {
    if (v == null || v === "") continue;
    if (k === "month") {
      if (f.view === "cal") p.set(k, v);
      continue;
    }
    if (DEFAULTS[k as keyof typeof DEFAULTS] === v) continue;
    p.set(k, v);
  }
  return p.toString();
}

export function dueBucket(due: string | null, status: TicketStatus, today: string): "overdue" | "today" | "week" | "later" | "none" {
  if (!due) return "none";
  if (due < today && status !== "done") return "overdue";
  if (due === today) return "today";
  if (due > today && due <= weekEnd(today)) return "week";
  return "later"; // later this year, or a done ticket with a past due date
}

export type Ctx = { meId: string; teamIds: string[]; today: string };

function matchWho(t: TicketRow, who: string, ctx: Ctx) {
  if (!who) return true;
  const people = [t.assigneeId, ...t.coAssigneeIds].filter(Boolean) as string[];
  if (who === "none") return !t.assigneeId;
  if (who === "me") return people.includes(ctx.meId);
  if (who === "team") return people.some((p) => ctx.teamIds.includes(p));
  return people.includes(who);
}

/** All filters except the status tab (so tab counts reflect the other filters). */
export function filterTickets(rows: TicketRow[], f: Filters, ctx: Ctx): TicketRow[] {
  const q = f.q.toLowerCase();
  return rows.filter((t) => {
    if (q && !`${t.key} ${t.title} ${t.tags.join(" ")}`.toLowerCase().includes(q)) return false;
    if (!matchWho(t, f.who, ctx)) return false;
    if (f.pri && t.priority !== f.pri) return false;
    if (f.tag && !t.tags.includes(f.tag)) return false;
    if (f.proj && t.projectId !== f.proj) return false;
    if (f.due) {
      const b = dueBucket(t.due, t.status, ctx.today);
      if (f.due === "week" ? !(b === "today" || b === "week") : b !== f.due) return false;
    }
    return true;
  });
}

export function byStatusTab(rows: TicketRow[], st: StatusTab) {
  return rows.filter((t) => (st === "active" ? t.status !== "done" : t.status === st));
}

export function statusCounts(rows: TicketRow[]): Record<StatusTab, number> {
  const out = { active: 0, todo: 0, in_progress: 0, in_review: 0, blocked: 0, done: 0 } as Record<StatusTab, number>;
  for (const t of rows) {
    out[t.status]++;
    if (t.status !== "done") out.active++;
  }
  return out;
}

const PRI_RANK: Record<PriorityLevel, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

function keyParts(key: string): [string, number] {
  const i = key.lastIndexOf("-");
  return [key.slice(0, i), Number(key.slice(i + 1)) || 0];
}

export function sortTickets(rows: TicketRow[], sort: SortBy): TicketRow[] {
  const byKey = (a: TicketRow, b: TicketRow) => {
    const [pa, na] = keyParts(a.key);
    const [pb, nb] = keyParts(b.key);
    return pa === pb ? na - nb : pa < pb ? -1 : 1;
  };
  const byDue = (a: TicketRow, b: TicketRow) => (a.due ?? "9999") < (b.due ?? "9999") ? -1 : (a.due ?? "9999") > (b.due ?? "9999") ? 1 : 0;
  const cmp: Record<SortBy, (a: TicketRow, b: TicketRow) => number> = {
    due: (a, b) => byDue(a, b) || PRI_RANK[a.priority] - PRI_RANK[b.priority] || byKey(a, b),
    priority: (a, b) => PRI_RANK[a.priority] - PRI_RANK[b.priority] || byDue(a, b) || byKey(a, b),
    updated: (a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : byKey(a, b)),
    key: byKey,
  };
  return [...rows].sort(cmp[sort]);
}

export type Group = { key: string; label: string; rows: TicketRow[] };

const DUE_GROUPS: [ReturnType<typeof dueBucket>, string][] = [
  ["overdue", "Overdue"], ["today", "Due today"], ["week", "This week"], ["later", "Later"], ["none", "No due date"],
];

/** Groups in a stable, meaningful order. Rows keep their sort order inside each group. */
export function groupTickets(
  rows: TicketRow[],
  by: GroupBy,
  names: { people: Record<string, string>; projects: Record<string, string>; today: string },
): Group[] {
  if (!by) return [{ key: "all", label: "", rows }];
  const keyOf = (t: TicketRow): [string, string] => {
    switch (by) {
      case "status": return [t.status, STATUS_LABEL[t.status]];
      case "priority": return [t.priority, PRIORITY_LABEL[t.priority]];
      case "assignee": return t.assigneeId ? [t.assigneeId, names.people[t.assigneeId] ?? "Unknown"] : ["none", "Unassigned"];
      case "project": return t.projectId ? [t.projectId, names.projects[t.projectId] ?? "Unknown project"] : ["none", "No project"];
      case "due": {
        const b = dueBucket(t.due, t.status, names.today);
        return [b, DUE_GROUPS.find(([k]) => k === b)![1]];
      }
    }
  };
  const map = new Map<string, Group>();
  for (const t of rows) {
    const [k, label] = keyOf(t);
    if (!map.has(k)) map.set(k, { key: k, label, rows: [] });
    map.get(k)!.rows.push(t);
  }
  const order: string[] =
    by === "status" ? STATUSES
    : by === "priority" ? PRIORITIES
    : by === "due" ? DUE_GROUPS.map(([k]) => k)
    : [...map.values()].sort((a, b) => (a.key === "none" ? 1 : b.key === "none" ? -1 : a.label.localeCompare(b.label))).map((g) => g.key);
  return order.filter((k) => map.has(k)).map((k) => map.get(k)!);
}

/** "Nov 4" from YYYY-MM-DD. */
export function fmtDate(iso: string) {
  const [, m, d] = iso.split("-").map(Number);
  return `${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]} ${d}`;
}

/** "6h 40m", "45m", "2h". */
export function fmtMinutes(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Parse "1h 30m", "1.5h", "90m", "90", "1:30" into minutes. Null when it can't be read. */
export function parseDuration(input: string): number | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d+):([0-5]\d)$/))) return Number(m[1]) * 60 + Number(m[2]);
  if (/^\d+$/.test(s)) return Number(s);
  m = s.match(/^(?:(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?)?\s*(?:(\d+)\s*m(?:in(?:utes?|s)?)?)?$/);
  if (!m || (!m[1] && !m[2])) return null;
  const total = Math.round(Number(m[1] ?? 0) * 60) + Number(m[2] ?? 0);
  return total > 0 ? total : null;
}

/** Whole minutes between two instants, never negative. */
export function minutesBetween(startIso: string, end: Date) {
  return Math.max(0, Math.floor((end.getTime() - new Date(startIso).getTime()) / 60000));
}

/** "05:07" or "1:05:07" for a running timer. */
export function fmtClock(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`;
}

/** Comma or space separated tags, lowercased, unique, without "#". */
export function parseTags(input: string): string[] {
  return [...new Set(input.split(/[,\s]+/).map((t) => t.replace(/^#/, "").trim().toLowerCase()).filter(Boolean))].slice(0, 20);
}

const BLOCKED_EXT = ["exe", "msi", "bat", "cmd", "com", "scr", "ps1", "vbs", "js", "jar", "sh", "app", "dmg", "apk", "dll", "hta", "lnk", "reg", "html", "htm", "svg"];

/** Why a file can't be uploaded, or null when it's fine. */
export function fileProblem(name: string, size: number): string | null {
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  if (BLOCKED_EXT.includes(ext)) return `${name}: .${ext} files are blocked for safety.`;
  if (size > MAX_FILE_BYTES) return `${name} is over 2 MB.`;
  return null;
}

/** Safe storage object name. */
export function storageName(name: string) {
  return name.normalize("NFKD").replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").slice(-80) || "file";
}

export const isImage = (mime: string | null, name: string) => (mime ?? "").startsWith("image/") || /\.(png|jpe?g|gif|webp|avif)$/i.test(name);

/** 42 cells (6 weeks, Monday first) covering `month` (YYYY-MM). */
export function monthCells(month: string): { date: string; inMonth: boolean }[] {
  const first = `${month}-01`;
  const dow = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
  const start = addDays(first, -dow);
  return Array.from({ length: 42 }, (_, i) => {
    const date = addDays(start, i);
    return { date, inMonth: date.slice(0, 7) === month };
  });
}

export function shiftMonth(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return `${["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][m - 1]} ${y}`;
}

/** Move item i by dir (-1 up, +1 down). Returns a new array; out-of-range moves return a copy. */
export function moveItem<T>(arr: T[], i: number, dir: -1 | 1): T[] {
  const out = [...arr];
  const j = i + dir;
  if (i < 0 || i >= out.length || j < 0 || j >= out.length) return out;
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

/** One line of history in plain words. `name` resolves member ids. */
export function historyText(h: { actor: string; field: string; oldValue: string | null; newValue: string | null }, name: (id: string | null) => string) {
  const st = (v: string | null) => (v && v in STATUS_LABEL ? STATUS_LABEL[v as TicketStatus] : v ?? "none");
  const pr = (v: string | null) => (v && v in PRIORITY_LABEL ? PRIORITY_LABEL[v as PriorityLevel] : v ?? "none");
  const a = h.actor;
  switch (h.field) {
    case "created": return h.newValue ? `${a} created this ticket (${h.newValue})` : `${a} created this ticket`;
    case "status": return `${a} changed status from ${st(h.oldValue)} to ${st(h.newValue)}`;
    case "priority": return `${a} changed priority from ${pr(h.oldValue)} to ${pr(h.newValue)}`;
    case "assignee": return h.newValue ? `${a} assigned ${name(h.newValue)}` : `${a} removed the assignee`;
    case "due": return h.newValue ? `${a} set the due date to ${fmtDate(h.newValue)}` : `${a} cleared the due date`;
    case "title": return `${a} renamed this ticket to "${h.newValue ?? ""}"`;
    case "project": return `${a} moved this ticket to another project`;
    case "checklist": return `${a} checked "${h.newValue ?? ""}"`;
    case "time": return `${a} logged ${fmtMinutes(Number(h.newValue) || 0)}`;
    case "file": return `${a} added ${h.newValue ?? "a file"}`;
    case "review_submit": return `${a} submitted for review`;
    case "review_approve": return `${a} approved the work`;
    case "review_back": return `${a} sent back with changes (${h.oldValue ?? ""})`;
    default: return `${a} updated ${h.field}`;
  }
}

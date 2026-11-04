// Pure calendar helpers. Dates are "YYYY-MM-DD" strings in office time (Asia/Dubai, UTC+4, no DST);
// times of day are minutes after midnight.

export const TZ_OFFSET_MIN = 240;
export const VIEWS = ["month", "week", "day", "agenda"] as const;
export type View = (typeof VIEWS)[number];
export const REPEATS = ["none", "daily", "weekly", "biweekly", "monthly"] as const;
export type Repeat = (typeof REPEATS)[number];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAYS_L = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MON_L = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const D = (s: string) => new Date(s + "T00:00:00Z");
const iso = (d: Date) => d.toISOString().slice(0, 10);

export const isDate = (s: string | undefined | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(D(s).getTime()) && iso(D(s)) === s;
export const addDays = (s: string, n: number) => iso(new Date(D(s).getTime() + n * 864e5));
export const addMonths = (s: string, n: number) => {
  const d = D(s);
  const y = d.getUTCFullYear(), m = d.getUTCMonth() + n, day = d.getUTCDate();
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return iso(new Date(Date.UTC(y, m, Math.min(day, last))));
};
/** 0 = Sunday … 6 = Saturday. */
export const dow = (s: string) => D(s).getUTCDay();
export const dnum = (s: string) => D(s).getUTCDate();
export const weekStart = (s: string) => addDays(s, -((dow(s) + 6) % 7));
export const isWeekend = (s: string) => dow(s) === 0 || dow(s) === 6;
export const monthStart = (s: string) => s.slice(0, 8) + "01";

export const fmtT = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
export const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
export const timeRange = (start: number, mins: number) => `${fmtT(start)}–${fmtT(start + mins)}`;
export const fmtShort = (s: string) => `${DAYS[dow(s)]} ${dnum(s)} ${MON[D(s).getUTCMonth()]}`;
export const fmtLong = (s: string) => `${DAYS_L[dow(s)]}, ${dnum(s)} ${MON_L[D(s).getUTCMonth()]} ${D(s).getUTCFullYear()}`;
export const dayHead = (s: string) => `${DAYS[dow(s)]} ${dnum(s)}`;

/** A UTC instant to office date + minutes. */
export function toLocal(instant: string | Date) {
  const t = new Date(new Date(instant).getTime() + TZ_OFFSET_MIN * 6e4);
  return { date: iso(t), min: t.getUTCHours() * 60 + t.getUTCMinutes() };
}

/** Office date + "HH:MM" to an ISO instant. */
export function fromLocal(date: string, time: string) {
  return new Date(D(date).getTime() + (toMin(time) - TZ_OFFSET_MIN) * 6e4).toISOString();
}

/** Dates shown by a view: [from, to) as office dates. */
export function viewRange(view: View, cursor: string): { from: string; to: string } {
  if (view === "month") {
    const from = weekStart(monthStart(cursor));
    const next = addMonths(monthStart(cursor), 1);
    const lastWeek = weekStart(addDays(next, -1));
    return { from, to: addDays(lastWeek, 7) };
  }
  if (view === "week") {
    const from = weekStart(cursor);
    return { from, to: addDays(from, 7) };
  }
  if (view === "day") return { from: cursor, to: addDays(cursor, 1) };
  return { from: cursor, to: addDays(cursor, 30) };
}

export function daysBetween(from: string, to: string) {
  const out: string[] = [];
  for (let d = from; d < to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Cursor after pressing prev (-1) or next (1). */
export function stepCursor(view: View, cursor: string, dir: 1 | -1) {
  if (view === "month") return addMonths(monthStart(cursor), dir);
  return addDays(cursor, dir * { week: 7, day: 1, agenda: 30 }[view]);
}

export function viewTitle(view: View, cursor: string) {
  const d = D(cursor);
  if (view === "month") return `${MON_L[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  if (view === "day") return fmtLong(cursor);
  const a = view === "week" ? weekStart(cursor) : cursor;
  const b = addDays(a, view === "week" ? 6 : 29);
  return `${dnum(a)} ${MON[D(a).getUTCMonth()]} – ${dnum(b)} ${MON[D(b).getUTCMonth()]} ${D(b).getUTCFullYear()}`;
}

/** Dates of every occurrence of a meeting, the first one included. Series run 90 days ahead. */
export function occurrences(first: string, repeat: Repeat, horizonDays = 90): string[] {
  if (repeat === "none") return [first];
  const end = addDays(first, horizonDays);
  const out: string[] = [];
  for (let i = 0; ; i++) {
    let d: string;
    if (repeat === "monthly") d = addMonths(first, i);
    else if (repeat === "daily") d = addDays(first, i);
    else d = addDays(first, i * (repeat === "weekly" ? 7 : 14));
    if (d > end) break;
    if (repeat === "daily" && isWeekend(d) && d !== first) continue;
    out.push(d);
  }
  return out;
}

/**
 * Up to `max` start times (minutes) between 09:00 and 18:00, every 30 minutes, that clash with none of the
 * busy blocks [start, end). Nothing on weekends. `notBefore` skips times already past today.
 */
export function freeSlots(opts: { date: string; len: number; blocks: [number, number][]; notBefore?: number; max?: number }) {
  const { date, len, blocks, notBefore = 0, max = 5 } = opts;
  if (isWeekend(date)) return [];
  const out: number[] = [];
  for (let m = 9 * 60; m + len <= 18 * 60 && out.length < max; m += 30) {
    if (m < notBefore) continue;
    if (!blocks.some(([a, b]) => m < b && m + len > a)) out.push(m);
  }
  return out;
}

/** "a@x.com, b@y.com" to a clean list of emails. Returns null if any entry is not an email. */
export function parseGuests(s: string): string[] | null {
  const list = s.split(/[,;\s]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
  return list.every((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x)) ? [...new Set(list)] : null;
}

export const RSVP = {
  yes: { label: "Going", tone: "ok" },
  maybe: { label: "Maybe", tone: "warn" },
  no: { label: "Declined", tone: "danger" },
  pending: { label: "No reply", tone: "muted" },
} as const;
export type Rsvp = keyof typeof RSVP;

export const REPEAT_LABEL: Record<Repeat, string> = {
  none: "Does not repeat",
  daily: "Every weekday",
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
};

/** Read ?view=&d=&col= safely. */
export function parseParams(p: Record<string, string | undefined>, today: string) {
  const view: View = (VIEWS as readonly string[]).includes(p.view ?? "") ? (p.view as View) : "month";
  return { view, cursor: isDate(p.d) ? p.d : today, showCol: p.col === "1" };
}

export function calHref(view: View, cursor: string, showCol: boolean) {
  return `/calendar?view=${view}&d=${cursor}${showCol ? "&col=1" : ""}`;
}

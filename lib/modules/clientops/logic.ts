// Pure logic for Response times, Meetings and Files. No I/O.
import type { Tone } from "@/components/ui/tone";

// ---------------------------------------------------------------- working hours

/** Work week settings. Workdays are ISO weekdays: 1 = Monday ... 7 = Sunday. Times are "HH:MM". */
export type WorkHours = { timezone: string; dayStart: string; dayEnd: string; workdays: number[] };

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    fmtCache.set(tz, f);
  }
  return f;
}

/** Wall-clock parts of an instant in a time zone. */
function localParts(ms: number, tz: string) {
  const p: Record<string, number> = {};
  for (const x of fmt(tz).formatToParts(new Date(ms))) if (x.type !== "literal") p[x.type] = Number(x.value);
  return { y: p.year, m: p.month, d: p.day, h: p.hour % 24, min: p.minute, s: p.second };
}

/** Offset of the zone from UTC at an instant, in ms (Dubai = +4h). */
function offsetMs(ms: number, tz: string) {
  const l = localParts(ms, tz);
  return Date.UTC(l.y, l.m - 1, l.d, l.h, l.min, l.s) - Math.floor(ms / 1000) * 1000;
}

/** The instant when the zone's wall clock shows y-m-d hh:mm. */
function zonedToUtc(y: number, m: number, d: number, hh: number, mm: number, tz: string) {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = guess - offsetMs(guess, tz);
  return guess - offsetMs(first, tz);
}

const hm = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return { h: h || 0, m: m || 0 };
};

/** Working time between two instants, in minutes. Counts only workdays between dayStart and dayEnd in the zone. */
export function workingMinutes(start: Date, end: Date, hours: WorkHours): number {
  const a = start.getTime();
  const b = end.getTime();
  if (!(b > a) || hours.workdays.length === 0) return 0;
  const s = hm(hours.dayStart);
  const e = hm(hours.dayEnd);
  const first = localParts(a, hours.timezone);
  let total = 0;
  for (let k = 0; k < 3700; k++) {
    const day = new Date(Date.UTC(first.y, first.m - 1, first.d + k));
    const y = day.getUTCFullYear();
    const m = day.getUTCMonth() + 1;
    const d = day.getUTCDate();
    const ws = zonedToUtc(y, m, d, s.h, s.m, hours.timezone);
    if (ws >= b) break;
    const iso = day.getUTCDay() || 7;
    if (!hours.workdays.includes(iso)) continue;
    const we = zonedToUtc(y, m, d, e.h, e.m, hours.timezone);
    const from = Math.max(a, ws);
    const to = Math.min(b, we);
    if (to > from) total += to - from;
  }
  return Math.round(total / 60000);
}

// ---------------------------------------------------------------- formatting

/** 48m, 2h 05m, 4h, 1d 6h. */
export function formatMinutes(min: number): string {
  const v = Math.max(0, Math.round(min));
  if (v < 60) return `${v}m`;
  if (v < 24 * 60) {
    const h = Math.floor(v / 60);
    const m = v % 60;
    return m ? `${h}h ${String(m).padStart(2, "0")}m` : `${h}h`;
  }
  const d = Math.floor(v / 1440);
  const h = Math.floor((v % 1440) / 60);
  return h ? `${d}d ${h}h` : `${d}d`;
}

/** 1 h -> "1h", 0.5 h -> "30m". */
export const formatTarget = (hours: number) => formatMinutes(hours * 60);

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  if (n < 1024 * 1024 * 1024) {
    const mb = n / (1024 * 1024);
    return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
  }
  return `${(n / 1024 ** 3).toFixed(1)} GB`;
}

// ---------------------------------------------------------------- SLA rules

export type WaitKind = "message" | "comment" | "request" | "changes";
export const KIND_LABEL: Record<WaitKind, string> = { message: "Message", comment: "Comment", request: "Request", changes: "Changes" };

export type Targets = { replyHours: number; requestHours: number; changesHours: number };

/** Messages and comments use the reply target; requests and changes have their own. */
export function targetHours(kind: WaitKind, t: Targets): number {
  if (kind === "request") return t.requestHours;
  if (kind === "changes") return t.changesHours;
  return t.replyHours;
}

export type State = { label: string; tone: Tone; late: boolean; past2x: boolean };

/** State of an open wait: past 2x target, late, due soon (last quarter of the target), or on time. */
export function waitState(waitedMin: number, targetMin: number): State {
  if (waitedMin >= 2 * targetMin) return { label: "Past 2× target", tone: "danger", late: true, past2x: true };
  if (waitedMin >= targetMin) return { label: "Late", tone: "danger", late: true, past2x: false };
  const left = targetMin - waitedMin;
  if (left <= targetMin * 0.25) return { label: `Due in ${formatMinutes(left)}`, tone: "warn", late: false, past2x: false };
  return { label: "On time", tone: "ok", late: false, past2x: false };
}

export const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};

/** A wait with its working-time figures already worked out. */
export type Measured = {
  clientId: string;
  clientName: string;
  answererId: string | null;
  answeredById: string | null;
  targetMin: number;
  /** Working minutes waited so far (open) or taken to answer (answered). */
  minutes: number;
  answered: boolean;
};

export type Summary = {
  answered: number;
  onTimePct: number | null;
  typicalMin: number | null;
  slowest: { minutes: number; clientName: string } | null;
};

export function summarize(answered: Measured[]): Summary {
  const done = answered.filter((w) => w.answered);
  if (!done.length) return { answered: 0, onTimePct: null, typicalMin: null, slowest: null };
  const onTime = done.filter((w) => w.minutes <= w.targetMin).length;
  const slow = done.reduce((x, w) => (w.minutes > x.minutes ? w : x));
  return {
    answered: done.length,
    onTimePct: Math.round((onTime / done.length) * 100),
    typicalMin: median(done.map((w) => w.minutes)),
    slowest: { minutes: slow.minutes, clientName: slow.clientName },
  };
}

export type PersonRow = { id: string; answered: number; onTimePct: number | null; typicalMin: number | null; lateNow: number };

/** By person: answered waits credit whoever replied; "late now" counts open late waits on the answerer. */
export function byPerson(answered: Measured[], open: Measured[]): PersonRow[] {
  const map = new Map<string, { done: Measured[]; late: number }>();
  const at = (id: string) => {
    let r = map.get(id);
    if (!r) map.set(id, (r = { done: [], late: 0 }));
    return r;
  };
  for (const w of answered) if (w.answeredById) at(w.answeredById).done.push(w);
  for (const w of open) if (w.answererId && w.minutes >= w.targetMin) at(w.answererId).late++;
  return [...map.entries()]
    .map(([id, r]) => {
      const s = summarize(r.done);
      return { id, answered: s.answered, onTimePct: s.onTimePct, typicalMin: s.typicalMin, lateNow: r.late };
    })
    .sort((a, b) => b.answered - a.answered);
}

export type ClientRow = {
  clientId: string;
  clientName: string;
  waits: number;
  onTimePct: number | null;
  typicalMin: number | null;
  slowestMin: number | null;
  waitingNow: number;
};

export function byClient(answered: Measured[], open: Measured[]): ClientRow[] {
  const map = new Map<string, { name: string; done: Measured[]; open: number }>();
  const at = (w: Measured) => {
    let r = map.get(w.clientId);
    if (!r) map.set(w.clientId, (r = { name: w.clientName, done: [], open: 0 }));
    return r;
  };
  for (const w of answered) at(w).done.push(w);
  for (const w of open) at(w).open++;
  return [...map.entries()]
    .map(([clientId, r]) => {
      const s = summarize(r.done);
      return {
        clientId,
        clientName: r.name,
        waits: r.done.length + r.open,
        onTimePct: s.onTimePct,
        typicalMin: s.typicalMin,
        slowestMin: s.slowest?.minutes ?? null,
        waitingNow: r.open,
      };
    })
    .sort((a, b) => b.waits - a.waits);
}

export const RANGES = [7, 30, 90] as const;
export type Range = (typeof RANGES)[number];
export const parseRange = (v: string | undefined): Range => (v === "7" ? 7 : v === "90" ? 90 : 30);

// ---------------------------------------------------------------- meetings

export type Concern = { topic: string; quote: string | null };

/** One concern per line: "Topic: quote" or just "Topic". Surrounding quote marks are dropped. */
export function parseConcerns(text: string): Concern[] {
  return lines(text).map((l) => {
    const i = l.indexOf(":");
    if (i <= 0) return { topic: l, quote: null };
    const quote = l.slice(i + 1).trim().replace(/^["“']+|["”']+$/g, "").trim();
    return { topic: l.slice(0, i).trim(), quote: quote || null };
  });
}

/** Non-empty trimmed lines, list bullets removed. */
export function lines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim())
    .filter(Boolean);
}

export type ParsedAction = { title: string; ownerName: string | null; assigneeId: string | null };

/**
 * One action per line. An owner can follow a spaced dash: "Send price list - Rania Youssef".
 * The owner is matched to a staff member by full or first name (case-insensitive).
 */
export function parseActions(text: string, people: { id: string; name: string }[]): ParsedAction[] {
  return lines(text).map((l) => {
    const m = l.match(/^(.*\S)\s+[-–—]\s+(.+)$/);
    const title = m ? m[1] : l;
    const ownerName = m ? m[2].trim() : null;
    let assigneeId: string | null = null;
    if (ownerName) {
      const o = ownerName.toLowerCase();
      const hit = people.find((p) => p.name.toLowerCase() === o) ?? people.find((p) => p.name.toLowerCase().split(" ")[0] === o);
      assigneeId = hit?.id ?? null;
    }
    return { title, ownerName, assigneeId };
  });
}

export type Outcome = "ticket" | "todo" | "skip";
export const OUTCOME_LABEL: Record<Outcome, string> = { ticket: "Ticket", todo: "Client's to-do", skip: "Skip" };

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "5 · 2 tickets, 2 to-dos, 1 skipped" */
export function actionSummary(outcomes: Outcome[]): string {
  if (!outcomes.length) return "None";
  const n = (o: Outcome) => outcomes.filter((x) => x === o).length;
  const parts = [
    n("ticket") ? plural(n("ticket"), "ticket", "tickets") : "",
    n("todo") ? plural(n("todo"), "to-do", "to-dos") : "",
    n("skip") ? `${n("skip")} skipped` : "",
  ].filter(Boolean);
  return `${outcomes.length} · ${parts.join(", ")}`;
}

export const saveLabel = (tickets: number) => `Create ${plural(tickets, "ticket", "tickets")} and save`;

// ---------------------------------------------------------------- files

export type Colour = { name: string; hex: string };

/** "Alba red #c8102e" per line. Lines without a valid hex are skipped. */
export function parseColours(text: string): Colour[] {
  const out: Colour[] = [];
  for (const l of lines(text)) {
    const m = l.match(/^(.*?)[\s:,-]*(#[0-9a-fA-F]{6})\b/);
    if (m) out.push({ name: m[1].trim() || m[2].toLowerCase(), hex: m[2].toLowerCase() });
  }
  return out;
}

/** Safe Storage object name: keeps letters, digits, dot, dash and underscore. */
export function storageName(name: string): string {
  const clean = name.normalize("NFKD").replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return (clean || "file").slice(-120);
}

// ---------------------------------------------------------------- dates (display, in a time zone)

/** "2026-11-04" in the zone. */
export function zoneDate(d: Date, tz: string): string {
  const p = localParts(d.getTime(), tz);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

/** Monday of the week containing d, as "YYYY-MM-DD" in the zone. */
export function weekStartDate(d: Date, tz: string): string {
  const day = new Date(`${zoneDate(d, tz)}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day.toISOString().slice(0, 10);
}

/** Midnight of a zone date as an instant. */
export function zoneMidnight(date: string, tz: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(zonedToUtc(y, m, d, 0, 0, tz));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "3 Nov", or "1 Feb 2025" when not this year. */
export function shortDate(iso: string, now: Date, tz: string): string {
  const p = localParts(new Date(iso).getTime(), tz);
  const y = localParts(now.getTime(), tz).y;
  return `${p.d} ${MONTHS[p.m - 1]}${p.y === y ? "" : ` ${p.y}`}`;
}

/** "Today 09:02", "Yesterday 15:40", "2 Nov 16:05". */
export function whenLabel(iso: string, now: Date, tz: string): string {
  const t = new Date(iso);
  const p = localParts(t.getTime(), tz);
  const time = `${String(p.h).padStart(2, "0")}:${String(p.min).padStart(2, "0")}`;
  const today = zoneDate(now, tz);
  const day = zoneDate(t, tz);
  const y = new Date(`${today}T00:00:00Z`);
  y.setUTCDate(y.getUTCDate() - 1);
  if (day === today) return `Today ${time}`;
  if (day === y.toISOString().slice(0, 10)) return `Yesterday ${time}`;
  return `${shortDate(iso, now, tz)} ${time}`;
}

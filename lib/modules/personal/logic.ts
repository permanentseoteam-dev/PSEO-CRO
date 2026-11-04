// Pure logic for My profile, Time and Settings. No I/O.
// Dates are ISO "YYYY-MM-DD". Local time is Asia/Dubai (UTC+4, no daylight saving).
import type { Balance, Entry, LeaveRequest, LeaveType, NotifEvent, RequestType, Session, SheetStatus } from "./types";
import type { Tone } from "@/components/ui/tone";

const DUBAI_OFFSET_MS = 4 * 3600 * 1000;
export const LATE_AFTER = "09:15";
export const LOG_DAYS_BACK = 7;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ---------------------------------------------------------------- dates

const utc = (iso: string) => new Date(`${iso}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function addDays(day: string, n: number) {
  const d = utc(day);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}

/** 0 = Monday … 6 = Sunday. */
export function dow(day: string) {
  return (utc(day).getUTCDay() + 6) % 7;
}

export const isWeekend = (day: string) => dow(day) >= 5;

/** The Monday of the week that holds `day`. */
export function weekStart(day: string) {
  return addDays(day, -dow(day));
}

export function weekDays(start: string) {
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Dubai calendar date of an instant. */
export function localDate(instant: string | Date) {
  return iso(new Date(new Date(instant).getTime() + DUBAI_OFFSET_MS));
}

/** Dubai clock time "08:56" of an instant. */
export function localTime(instant: string | Date) {
  return new Date(new Date(instant).getTime() + DUBAI_OFFSET_MS).toISOString().slice(11, 16);
}

export function today(now = new Date()) {
  return localDate(now);
}

/** "4 Nov 2026" */
export function fmtDay(day: string) {
  const [y, m, d] = day.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** "Mon 2" */
export function fmtDow(day: string) {
  return `${DOW[dow(day)]} ${Number(day.slice(8, 10))}`;
}

/** "22–24 Dec 2026", "15 Oct 2026", "29 Oct – 2 Nov 2026". */
export function fmtRange(start: string, end: string) {
  if (start === end) return fmtDay(start);
  const [y1, m1, d1] = start.split("-").map(Number);
  const [y2, m2, d2] = end.split("-").map(Number);
  if (y1 === y2 && m1 === m2) return `${d1}–${d2} ${MONTHS[m2 - 1]} ${y2}`;
  if (y1 === y2) return `${d1} ${MONTHS[m1 - 1]} – ${d2} ${MONTHS[m2 - 1]} ${y2}`;
  return `${fmtDay(start)} – ${fmtDay(end)}`;
}

/** "November 2026" from "2026-11". */
export function monthLabel(month: string) {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

export function shiftMonth(month: string, n: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return iso(d).slice(0, 7);
}

export function monthDays(month: string) {
  const out: string[] = [];
  for (let d = `${month}-01`; d.startsWith(month); d = addDays(d, 1)) out.push(d);
  return out;
}

export function daysBetween(from: string, to: string) {
  return Math.round((utc(to).getTime() - utc(from).getTime()) / 864e5);
}

// ---------------------------------------------------------------- durations

/** "6h 40m", "45m", "2h", "0m". */
export function fmtMinutes(min: number) {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Parse "1h 30m", "1.5h", "90m", "90", "1:30" into minutes. Empty = 0. Null when it can't be read. */
export function parseDuration(input: string): number | null {
  const s = input.trim().toLowerCase();
  if (!s) return 0;
  let m: RegExpMatchArray | null;
  if ((m = s.match(/^(\d+):([0-5]\d)$/))) return Number(m[1]) * 60 + Number(m[2]);
  if (/^\d+$/.test(s)) return Number(s);
  m = s.match(/^(?:(\d+(?:\.\d+)?)\s*h(?:ours?|rs?)?)?\s*(?:(\d+)\s*m(?:in(?:utes?|s)?)?)?$/);
  if (!m || (!m[1] && !m[2])) return null;
  return Math.round(Number(m[1] ?? 0) * 60) + Number(m[2] ?? 0);
}

/** "00:05:07" for a running timer. */
export function fmtClock(sec: number) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(Math.floor(sec / 3600))}:${p(Math.floor(sec / 60) % 60)}:${p(sec % 60)}`;
}

// ---------------------------------------------------------------- manual time entry

/** Checks a manual entry: date up to 7 days back, never ahead; a note is needed for past days. */
export function checkLogEntry(date: string, note: string, todayIso: string): string | null {
  const back = daysBetween(date, todayIso);
  if (back < 0) return "You can't log time ahead of today.";
  if (back > LOG_DAYS_BACK) return `You can log up to ${LOG_DAYS_BACK} days back.`;
  if (back > 0 && !note.trim()) return "Add a note for past days.";
  return null;
}

/** Billable choice: "auto" bills client tickets only. */
export function resolveBillable(choice: "auto" | "yes" | "no", hasClient: boolean) {
  return choice === "auto" ? hasClient : choice === "yes";
}

// ---------------------------------------------------------------- week grid

export type GridRow = { ticketId: string | null; key: string | null; title: string; days: number[]; total: number };
export type WeekGrid = { days: string[]; rows: GridRow[]; dayTotals: number[]; total: number; billable: number };

/** Mon–Sun grid per ticket. Entries without a ticket share one "No ticket" row, listed last. */
export function buildWeekGrid(entries: Entry[], start: string): WeekGrid {
  const days = weekDays(start);
  const byTicket = new Map<string, GridRow>();
  let billable = 0;
  for (const e of entries) {
    const d = days.indexOf(e.date);
    if (d < 0) continue;
    const k = e.ticketId ?? "";
    let row = byTicket.get(k);
    if (!row) {
      row = { ticketId: e.ticketId, key: e.ticketKey, title: e.ticketId ? (e.ticketTitle ?? "") : "No ticket", days: Array(7).fill(0), total: 0 };
      byTicket.set(k, row);
    }
    row.days[d] += e.minutes;
    row.total += e.minutes;
    if (e.billable) billable += e.minutes;
  }
  const rows = [...byTicket.values()].sort((a, b) => (a.ticketId ? 0 : 1) - (b.ticketId ? 0 : 1) || (a.key ?? "").localeCompare(b.key ?? ""));
  const dayTotals = days.map((_, i) => rows.reduce((s, r) => s + r.days[i], 0));
  return { days, rows, dayTotals, total: dayTotals.reduce((a, b) => a + b, 0), billable };
}

// ---------------------------------------------------------------- clocked time

/** Worked minutes of one session (open sessions count up to `now`), breaks taken out. */
export function sessionMinutes(s: Session, now: Date) {
  const end = s.clockOut ? new Date(s.clockOut) : now;
  const openBreak = s.breakStartedAt && !s.clockOut ? Math.floor((now.getTime() - new Date(s.breakStartedAt).getTime()) / 60000) : 0;
  return Math.max(0, Math.floor((end.getTime() - new Date(s.clockIn).getTime()) / 60000) - s.breakMinutes - Math.max(0, openBreak));
}

/** Clocked minutes per Dubai date. */
export function clockedByDay(sessions: Session[], now: Date): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of sessions) {
    const d = localDate(s.clockIn);
    out[d] = (out[d] ?? 0) + sessionMinutes(s, now);
  }
  return out;
}

/** The flag shown when logged time is under half of clocked time. */
export const underLogged = (logged: number, clocked: number) => clocked > 0 && logged < clocked * 0.5;

export const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

export const SHEET_STATUS: Record<SheetStatus, { label: string; tone: Tone }> = {
  open: { label: "Open", tone: "blue" },
  submitted: { label: "Submitted", tone: "violet" },
  approved: { label: "Approved", tone: "ok" },
  returned: { label: "Returned", tone: "warn" },
};

export const isLocked = (s: SheetStatus | undefined) => s === "submitted" || s === "approved";

// ---------------------------------------------------------------- attendance month

export type AttDay = {
  date: string;
  off: boolean;
  inTime: string | null;
  outTime: string | null;
  late: boolean;
  wfh: boolean;
  minutes: number;
  absent: string | null;
};

const LEAVE_LABEL: Record<RequestType, string> = { annual: "Annual leave", sick: "Sick", wfh: "Work from home", unpaid: "Unpaid leave", overtime: "Overtime" };
export const requestLabel = (t: RequestType) => ({ annual: "Annual", sick: "Sick", wfh: "Work from home", unpaid: "Unpaid", overtime: "Overtime" })[t];

/** One cell per day of the month: first clock-in, last clock-out, late flag, or an absence label from approved leave. */
export function attendanceMonth(sessions: Session[], leave: LeaveRequest[], month: string, now: Date): AttDay[] {
  const t = today(now);
  return monthDays(month).map((date) => {
    const mine = sessions.filter((s) => localDate(s.clockIn) === date).sort((a, b) => a.clockIn.localeCompare(b.clockIn));
    const first = mine[0];
    const last = mine[mine.length - 1];
    const away = leave.find((l) => l.status === "approved" && l.type !== "wfh" && l.type !== "overtime" && l.start <= date && l.end >= date);
    const inTime = first ? localTime(first.clockIn) : null;
    const off = isWeekend(date);
    return {
      date,
      off,
      inTime,
      outTime: last?.clockOut ? localTime(last.clockOut) : null,
      late: !!inTime && !off && inTime > LATE_AFTER,
      wfh: mine.some((s) => s.wfh),
      minutes: mine.reduce((a, s) => a + sessionMinutes(s, now), 0),
      absent: !first && !off && date < t ? (away ? LEAVE_LABEL[away.type] : "Absent") : null,
    };
  });
}

export function attendanceStats(days: AttDay[]) {
  const worked = days.filter((d) => d.inTime);
  const late = worked.filter((d) => d.late).length;
  const absent = days.filter((d) => d.absent).length;
  return {
    worked: worked.length,
    minutes: worked.reduce((a, d) => a + d.minutes, 0),
    late,
    punctuality: worked.length ? Math.round(((worked.length - late) / worked.length) * 100) : 0,
    absent,
    sick: days.filter((d) => d.absent === "Sick").length,
  };
}

// ---------------------------------------------------------------- leave

/** Working days (Mon–Fri) from start to end; 0.5 for a half day. */
export function workingDays(start: string, end: string, halfDay: boolean) {
  if (end < start) return 0;
  if (halfDay) return isWeekend(start) ? 0 : 0.5;
  let n = 0;
  for (let d = start; d <= end; d = addDays(d, 1)) if (!isWeekend(d)) n++;
  return n;
}

export type BalanceView = { type: LeaveType; label: string; left: number; used: number; allowance: number; per: "year" | "month" };

/** Left and used per type. Yearly types count approved days in `year`; work from home counts the month of `todayIso`. */
export function leaveSummary(balances: Balance[], requests: LeaveRequest[], todayIso: string): BalanceView[] {
  const year = todayIso.slice(0, 4);
  const month = todayIso.slice(0, 7);
  const types: LeaveType[] = ["annual", "sick", "wfh", "unpaid"];
  return types.map((type) => {
    const b = balances.find((x) => x.type === type);
    const per = b?.per ?? (type === "wfh" ? "month" : "year");
    const used = requests
      .filter((r) => r.type === type && r.status === "approved" && r.start.startsWith(per === "month" ? month : year))
      .reduce((a, r) => a + r.days, 0);
    const allowance = b?.allowance ?? 0;
    return { type, label: requestLabel(type), used, allowance, per, left: Math.max(0, allowance - used) };
  });
}

export function balanceSub(b: BalanceView) {
  if (b.allowance === 0) return b.used ? `${fmtDays(b.used)} taken` : "None taken";
  return `${trim(b.used)} of ${trim(b.allowance)} used${b.per === "month" ? " this month" : ""}`;
}

const trim = (n: number) => String(Number(n.toFixed(1)));
export const fmtDays = (n: number) => `${trim(n)} ${n === 1 ? "day" : "days"}`;

export function requestStatus(r: Pick<LeaveRequest, "status">, approver: string | null): { label: string; tone: Tone } {
  switch (r.status) {
    case "pending":
      return { label: approver ? `Waiting for ${approver.split(" ")[0]}` : "Waiting", tone: "warn" };
    case "approved":
      return { label: "Approved", tone: "ok" };
    case "declined":
      return { label: "Declined", tone: "danger" };
    default:
      return { label: "Cancelled", tone: "muted" };
  }
}

/** Annual leave needs 7 days' notice. */
export function checkLeave(type: RequestType, start: string, end: string, todayIso: string): string | null {
  if (end < start) return "The end date is before the start date.";
  if (type === "annual" && daysBetween(todayIso, start) < 7) return "Annual leave needs 7 days' notice.";
  return null;
}

// ---------------------------------------------------------------- documents

export function expiryInfo(expires: string | null, todayIso: string): { label: string; warn: boolean } | null {
  if (!expires) return null;
  const left = daysBetween(todayIso, expires);
  if (left < 0) return { label: `${fmtDay(expires)} · expired`, warn: true };
  return left < 60 ? { label: `${fmtDay(expires)} · ${left} days`, warn: true } : { label: fmtDay(expires), warn: false };
}

export const DOC_TYPE_LABEL = { id: "ID", visa: "Visa", contract: "Contract", letter: "Letter", education: "Education", other: "Other" } as const;

// ---------------------------------------------------------------- settings

export const NOTIF_EVENTS: { event: NotifEvent; label: string; inApp: boolean; email: boolean; phone: boolean }[] = [
  { event: "assigned", label: "I am assigned a ticket", inApp: true, email: true, phone: true },
  { event: "mention", label: "Someone mentions me", inApp: true, email: false, phone: true },
  { event: "client_reply", label: "A client replies", inApp: true, email: true, phone: true },
  { event: "watch_change", label: "A ticket I watch changes", inApp: true, email: false, phone: false },
  { event: "review_wait", label: "A review waits for me", inApp: true, email: true, phone: false },
  { event: "invoice_overdue", label: "An invoice is overdue", inApp: true, email: true, phone: false },
];

export const EMAIL_HINT = {
  daily: "One email at 08:00 with everything from the day before.",
  urgent: "Email only for urgent tickets and client escalations.",
  off: "No email. You still get alerts in the app.",
} as const;

/** Merge saved rows over the defaults. */
export function notifMatrix(saved: { event: string; in_app: boolean; email: boolean; phone: boolean }[]) {
  return NOTIF_EVENTS.map((d) => {
    const s = saved.find((x) => x.event === d.event);
    return { event: d.event, label: d.label, inApp: s ? s.in_app : d.inApp, email: s ? s.email : d.email, phone: s ? s.phone : d.phone };
  });
}

// ---------------------------------------------------------------- scope

/** People I may see for a scoped permission: all, my team (me, my reports, my department) or only me. */
export function inScope(
  p: { id: string; managerId: string | null; departmentId: string | null },
  me: { id: string; departmentId: string | null },
  scope: "none" | "own" | "team" | "all",
) {
  if (scope === "all") return true;
  if (p.id === me.id) return scope !== "none";
  return scope === "team" && (p.managerId === me.id || (!!me.departmentId && p.departmentId === me.departmentId));
}

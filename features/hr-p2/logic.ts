// Pure HR rules: pay maths, masking, clock times, probation, offboarding, KPI weights, training progress. No I/O.
import { addDays, format, parseISO } from "date-fns";
import type { ClockDay, ExitTask, Kpi, ProbationStatus, StepKind, TrainingStep } from "./types";
import { STEP_KINDS } from "./types";
import type { Tone } from "@/components/ui";

export const TZ = "Asia/Dubai";

// ---------------------------------------------------------------- pay

export const PAY_COMPONENTS = [
  { key: "basic", label: "Basic" },
  { key: "house_rent", label: "House rent" },
  { key: "utilities", label: "Utilities" },
  { key: "medical", label: "Medical" },
  { key: "other", label: "Other" },
] as const;
export type PayKey = (typeof PAY_COMPONENTS)[number]["key"];
export type PayParts = Record<PayKey, number>;

/** The usual split used to start the helper: 60 / 25 / 5 / 5 / 5. */
export const DEFAULT_SPLIT: PayParts = { basic: 60, house_rent: 25, utilities: 5, medical: 5, other: 5 };

const cents = (n: number) => Math.round(n * 100);

export function payGross(p: PayParts): number {
  return PAY_COMPONENTS.reduce((s, c) => s + cents(Number(p[c.key]) || 0), 0) / 100;
}

/**
 * Split a monthly gross into components by percent. Works in cents. When the percents total 100,
 * any rounding remainder goes to Basic, so the parts always add up to the gross exactly.
 */
export function splitGross(gross: number, pcts: PayParts) {
  const g = Math.max(0, cents(Number(gross) || 0));
  const totalPct = PAY_COMPONENTS.reduce((s, c) => s + (Number(pcts[c.key]) || 0), 0);
  const partsC = {} as PayParts;
  for (const c of PAY_COMPONENTS) partsC[c.key] = Math.round((g * (Number(pcts[c.key]) || 0)) / 100);
  const sumC = PAY_COMPONENTS.reduce((s, c) => s + partsC[c.key], 0);
  const ok = Math.abs(totalPct - 100) < 1e-9;
  if (ok) partsC.basic += g - sumC;
  const parts = {} as PayParts;
  for (const c of PAY_COMPONENTS) parts[c.key] = partsC[c.key] / 100;
  return { parts, totalPct, total: payGross(parts), ok };
}

export function money(n: number, currency: string) {
  return `${currency} ${Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

// ---------------------------------------------------------------- masking

/**
 * Mask an ID, tax number or IBAN, keeping spaces and dashes. Long values keep the first 4 and last 4
 * letters/digits; values of 8 or fewer keep only the last 2.
 */
export function maskSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  const chars = [...value];
  const alnum = chars.filter((c) => /[a-z0-9]/i.test(c)).length;
  const head = alnum > 8 ? 4 : 0;
  const tail = alnum > 8 ? 4 : Math.min(2, alnum);
  let i = 0;
  return chars
    .map((c) => {
      if (!/[a-z0-9]/i.test(c)) return c;
      const pos = i++;
      return pos < head || pos >= alnum - tail ? c : "*";
    })
    .join("");
}

/** The personal fields that are masked until someone with access presses Show. */
export const SECRET_FIELDS = ["id_number", "tax_number", "iban"] as const;

export const PERSONAL_FIELD_LABELS: Record<string, string> = {
  date_of_birth: "Date of birth",
  id_type: "ID type",
  id_number: "ID number",
  tax_number: "Tax number",
  bank_name: "Bank",
  iban: "IBAN",
};

// ---------------------------------------------------------------- dates and clock

/** Minutes since local midnight in the agency timezone. */
export function localMinutes(d: Date, tz = TZ): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

/** YYYY-MM-DD in the agency timezone. */
export function localDate(d: Date, tz = TZ): string {
  return d.toLocaleDateString("en-CA", { timeZone: tz });
}

/** "18:00" or "18:00:00" -> 1080. */
export function parseHm(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

export const hm = (t: string) => t.slice(0, 5);

/** Local clock time "08:56" for a timestamp. */
export function localHm(iso: string, tz = TZ): string {
  const m = localMinutes(new Date(iso), tz);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** True when clocking out now would be before the shift ends (local time). */
export function isEarlyClockOut(now: Date, shiftEnd: string, tz = TZ): boolean {
  return localMinutes(now, tz) < parseHm(shiftEnd);
}

export type ClockState = "out" | "in" | "break" | "done";

/** out: not clocked in today; in: working; break: on a break; done: clocked out for the day. */
export function clockState(day: Pick<ClockDay, "clock_out_at" | "break_started_at"> | null): ClockState {
  if (!day) return "out";
  if (day.clock_out_at) return "done";
  return day.break_started_at ? "break" : "in";
}

/** Minutes worked so far: from clock-in to clock-out (or now), minus finished and running breaks. */
/** A 0113 attendance row (one clock-in session). */
export type AttendanceRow = {
  id: string;
  member_id: string;
  clock_in: string;
  clock_out: string | null;
  break_started_at: string | null;
  break_minutes: number;
};

/** attendance row -> the widget's ClockDay shape (work_date = the Asia/Dubai day of clock_in). */
export function clockDay(a: AttendanceRow): ClockDay {
  return {
    id: a.id,
    member_id: a.member_id,
    work_date: localDate(new Date(a.clock_in)),
    clock_in_at: a.clock_in,
    clock_out_at: a.clock_out,
    break_started_at: a.break_started_at,
    break_minutes: a.break_minutes,
  };
}

export function workedMinutes(day: Pick<ClockDay, "clock_in_at" | "clock_out_at" | "break_started_at" | "break_minutes">, now: Date): number {
  const end = day.clock_out_at ? new Date(day.clock_out_at) : now;
  const span = (end.getTime() - new Date(day.clock_in_at).getTime()) / 60000;
  const running = day.break_started_at && !day.clock_out_at ? (now.getTime() - new Date(day.break_started_at).getTime()) / 60000 : 0;
  return Math.max(0, Math.floor(span - day.break_minutes - running));
}

/** 425 -> "7h 05m". */
export function fmtMinutes(m: number): string {
  const v = Math.max(0, Math.round(m));
  return `${Math.floor(v / 60)}h ${String(v % 60).padStart(2, "0")}m`;
}

export const fmtDate = (iso: string | null | undefined) => (iso ? format(parseISO(iso.slice(0, 10)), "d MMM yyyy") : "");
export const fmtMonth = (iso: string) => format(parseISO(iso.slice(0, 10)), "MMMM yyyy");

// ---------------------------------------------------------------- probation

export const PROBATION_EXTENSIONS = [30, 60, 90] as const;

/** New probation end date: the current end (or today when there is none) plus the days. */
export function extendProbation(currentEnd: string | null, days: number, today: string): string {
  return format(addDays(parseISO(currentEnd ?? today), days), "yyyy-MM-dd");
}

export const PROBATION_LABEL: Record<ProbationStatus, { label: string; tone: Tone }> = {
  on_probation: { label: "On probation", tone: "warn" },
  extended: { label: "Probation extended", tone: "warn" },
  confirmed: { label: "Confirmed", tone: "ok" },
  ended: { label: "Ended", tone: "danger" },
};

// ---------------------------------------------------------------- leaving

export const EXIT_REASONS = ["Resigned", "New opportunity", "Relocation", "End of contract", "Let go"] as const;

/** The offboarding checklist every exit starts with. */
export const EXIT_CHECKLIST = [
  "Hand over clients to a named owner",
  "Reassign open tickets",
  "Revoke tool access",
  "Return laptop and access card",
  "Final pay and gratuity worked out",
  "Exit interview",
  "Cancel visa",
] as const;

export function checklistProgress(tasks: Pick<ExitTask, "done_at">[]) {
  const done = tasks.filter((t) => t.done_at).length;
  return { done, total: tasks.length, complete: tasks.length > 0 && done === tasks.length };
}

// ---------------------------------------------------------------- KPIs

/** Total weight of the active KPIs that apply to a department (department-less KPIs apply to everyone). */
export function kpiWeightTotal(kpis: Pick<Kpi, "weight" | "department_id" | "active">[], departmentId: string | null): number {
  return kpis.filter((k) => k.active && (k.department_id === null || k.department_id === departmentId)).reduce((s, k) => s + k.weight, 0);
}

export const KPI_SOURCE_LABEL = { portal: "Portal", manual: "Manual" } as const;
export const KPI_DIRECTION_LABEL = { higher: "Higher is better", lower: "Lower is better" } as const;

// ---------------------------------------------------------------- training

export const STEP_KIND_LABEL: Record<StepKind, string> = {
  course: "Course",
  video: "Video",
  reading: "Reading",
  practice: "Practice",
  certification: "Certification",
};

/**
 * Parse the "one step per line" box: "Course: Running client QBRs". Lines without a known type
 * become errors. Blank lines are skipped.
 */
export function parseSteps(text: string): { steps: { kind: StepKind; title: string }[]; errors: number[] } {
  const steps: { kind: StepKind; title: string }[] = [];
  const errors: number[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    const m = line.match(/^([a-z]+)\s*[:|-]\s*(.+)$/i);
    const kind = m?.[1].toLowerCase() as StepKind | undefined;
    if (!m || !kind || !STEP_KINDS.includes(kind) || !m[2].trim()) errors.push(i + 1);
    else steps.push({ kind, title: m[2].trim().slice(0, 200) });
  });
  return { steps, errors };
}

export type StepStatus = "done" | "next" | "not_started";
export const STEP_STATUS: Record<StepStatus, { label: string; tone: Tone }> = {
  done: { label: "Done", tone: "ok" },
  next: { label: "Next", tone: "blue" },
  not_started: { label: "Not started", tone: "muted" },
};

/** Status of each step in order: done ones are Done, the first open one is Next, the rest Not started. */
export function stepStatuses(steps: Pick<TrainingStep, "id" | "position">[], doneIds: string[]) {
  const done = new Set(doneIds);
  let nextGiven = false;
  return [...steps]
    .sort((a, b) => a.position - b.position)
    .map((s) => {
      if (done.has(s.id)) return { id: s.id, status: "done" as StepStatus };
      if (!nextGiven) {
        nextGiven = true;
        return { id: s.id, status: "next" as StepStatus };
      }
      return { id: s.id, status: "not_started" as StepStatus };
    });
}

export function pathProgress(steps: Pick<TrainingStep, "id">[], doneIds: string[]) {
  const ids = new Set(steps.map((s) => s.id));
  const done = doneIds.filter((d) => ids.has(d)).length;
  return { done, total: steps.length, pct: steps.length ? Math.round((done / steps.length) * 100) : 0 };
}

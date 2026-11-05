// Pure rules for the scheduled jobs. No I/O. Tested in __tests__/logic.test.ts.
// Every date here is a Dubai calendar date (Asia/Dubai is UTC+4 all year, no DST).

export const JOB_TZ = "Asia/Dubai";

export type JobStatus = "ok" | "skipped" | "error";
export type JobOutcome = { status: JobStatus; detail: string };

// ---------------------------------------------------------------- the jobs
/** How the job runs: SQL inside Postgres, or pg_cron -> pg_net -> app/api/cron/[job]. */
export type JobVia = "database" | "app";
export type JobDef = { name: string; label: string; schedule: string; via: JobVia };

/** Every job scheduled in supabase/migrations/0210_scheduled_jobs.sql, in display order. */
export const JOBS = [
  { name: "recurring-tickets", label: "Recurring tickets", schedule: "Daily 06:00", via: "database" },
  { name: "reminders-sync", label: "Payment reminders: sync", schedule: "Daily 07:00", via: "database" },
  { name: "reminders-autosend", label: "Payment reminders: auto-send", schedule: "Daily 08:00", via: "app" },
  { name: "monthly-drafts", label: "Monthly draft invoices", schedule: "1st of the month 06:00", via: "app" },
  { name: "report-autosend", label: "Monthly client reports: auto-send", schedule: "Daily 09:00", via: "app" },
  { name: "title-changes", label: "Future-dated title changes", schedule: "Daily 00:05", via: "database" },
  { name: "health-recalc", label: "Client health recalculation", schedule: "Daily 01:30", via: "app" },
  { name: "calendar-sync", label: "Google Calendar sync", schedule: "Every 15 min", via: "app" },
  { name: "inbox-poll", label: "Client inbox poll (Gmail)", schedule: "Every 10 min", via: "app" },
  { name: "fireflies-import", label: "Fireflies import", schedule: "Hourly", via: "app" },
  { name: "huddle-cleanup", label: "End stale huddles", schedule: "Every 15 min", via: "database" },
  { name: "sla-alerts", label: "Response time alerts", schedule: "Every 15 min", via: "app" },
  { name: "timer-cleanup", label: "Stop timers with no heartbeat", schedule: "Every 10 min", via: "database" },
  { name: "profitability-alert", label: "Monthly profitability alert", schedule: "2nd of the month 09:00", via: "app" },
] as const satisfies readonly JobDef[];

export type JobName = (typeof JOBS)[number]["name"];
export type AppJobName = Extract<(typeof JOBS)[number], { via: "app" }>["name"];

export function isAppJob(name: string): name is AppJobName {
  return JOBS.some((j) => j.name === name && j.via === "app");
}

// ---------------------------------------------------------------- auth
/** True when the Authorization header is exactly "Bearer <secret>". An empty secret never matches. */
export function bearerOk(header: string | null | undefined, secret: string | null | undefined): boolean {
  if (!secret || !header) return false;
  const want = `Bearer ${secret}`;
  if (header.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= header.charCodeAt(i) ^ want.charCodeAt(i);
  return diff === 0;
}

// ---------------------------------------------------------------- dates (Dubai)
const dateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: JOB_TZ, year: "numeric", month: "2-digit", day: "2-digit" });

/** The Dubai calendar date of an instant, "YYYY-MM-DD". */
export function dubaiDate(now: Date): string {
  return dateFmt.format(now);
}

/** True on the given day of the month in Dubai (1 = the 1st). */
export function isDubaiDayOfMonth(now: Date, day: number): boolean {
  return Number(dubaiDate(now).slice(8, 10)) === day;
}

/** First day of the date's month, "YYYY-MM-01". */
export function monthStartOf(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

/** The month before the date's month, "YYYY-MM". */
export function previousMonth(date: string): string {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7)); // 1-12
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** "2026-10" or "2026-10-01" -> "October 2026". */
export function monthLabel(ym: string): string {
  return `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
}

// ---------------------------------------------------------------- monthly reports
export type ReportForSend = { status: string; autoSend: boolean; dueOn: string; sentAt: string | null };

/** An approved auto-send report goes out on its due day, or on the first run after it (a missed day catches up). */
export function isReportDue(r: ReportForSend, today: string): boolean {
  return r.status === "approved" && r.autoSend && !r.sentAt && r.dueOn <= today;
}

// ---------------------------------------------------------------- response times (SLA)
/** Which marks an open wait needs now: late at the target, and past 2x the target. Each fires once. */
export function slaMarks(
  waitedMin: number,
  targetHours: number,
  w: { lateAt: string | null; late2xAt: string | null },
): { late: boolean; late2x: boolean } {
  const target = targetHours * 60;
  return { late: !w.lateAt && waitedMin >= target, late2x: !w.late2xAt && waitedMin >= 2 * target };
}

/** "4h", "30m", "1h 30m". */
export function hoursLabel(hours: number): string {
  const min = Math.round(hours * 60);
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
}

// ---------------------------------------------------------------- profitability
/** Detail line of the monthly profitability notification. */
export function profitabilityDetail(marginPct: number, below: number, alertPct: number): string {
  const margin = `margin ${Math.round(marginPct)}%`;
  if (!below) return `is ready: ${margin}.`;
  return `is ready: ${margin}, ${below} ${below === 1 ? "client" : "clients"} under ${Math.round(alertPct)}%.`;
}

// ---------------------------------------------------------------- admin view
export type JobRunRow = { job: string; started_at: string; finished_at: string | null; status: JobStatus; detail: string | null };

export const STATUS_LABEL: Record<JobStatus, { label: string; tone: "ok" | "muted" | "danger" }> = {
  ok: { label: "OK", tone: "ok" },
  skipped: { label: "Skipped", tone: "muted" },
  error: { label: "Error", tone: "danger" },
};

/** Each job with its latest run (null when it has never run). */
export function withLastRuns(runs: JobRunRow[]): { job: (typeof JOBS)[number]; last: JobRunRow | null }[] {
  const latest = new Map<string, JobRunRow>();
  for (const r of runs) {
    const cur = latest.get(r.job);
    if (!cur || r.started_at > cur.started_at) latest.set(r.job, r);
  }
  return JOBS.map((job) => ({ job, last: latest.get(job.name) ?? null }));
}

/** "just now", "12 min ago", "3 h ago", "2 days ago". */
export function agoLabel(iso: string, now: Date): string {
  const min = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  return `${d} ${d === 1 ? "day" : "days"} ago`;
}

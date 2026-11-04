// Pure rules for the client-success tabs. No I/O. Dates are ISO "YYYY-MM-DD" strings, handled in UTC.
import type { Tone } from "@/components/ui";
import type {
  CommitmentStatus,
  DeliveryRating,
  OpportunityStage,
  QbrStatus,
  RelDate,
  RelPerson,
  ReportStatus,
  SuccessProfile,
} from "./types";

// ---------------------------------------------------------------- dates
const MS_DAY = 86_400_000;
const toUtc = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const daysBetween = (fromIso: string, toIsoDate: string) => Math.round((toUtc(toIsoDate) - toUtc(fromIso)) / MS_DAY);

/** "3 Nov" in the current year, "1 Feb 2027" otherwise. */
export function shortDate(iso: string, today: string) {
  const d = `${+iso.slice(8, 10)} ${MONTHS[+iso.slice(5, 7) - 1]}`;
  return iso.slice(0, 4) === today.slice(0, 4) ? d : `${d} ${iso.slice(0, 4)}`;
}

/** "October 2026" for "2026-10-01". */
export const monthLabel = (month: string) => `${MONTHS_LONG[+month.slice(5, 7) - 1]} ${month.slice(0, 4)}`;

/** First day of the month of `iso`, shifted by `delta` months. */
export function monthStart(iso: string, delta = 0) {
  const total = +iso.slice(0, 4) * 12 + (+iso.slice(5, 7) - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
}

// ---------------------------------------------------------------- commitments
export const COMMITMENT_STATUS: Record<CommitmentStatus, { label: string; tone: Tone }> = {
  met: { label: "Met", tone: "ok" },
  on_track: { label: "On track", tone: "blue" },
  at_risk: { label: "At risk", tone: "warn" },
  missed: { label: "Missed", tone: "danger" },
};

export function commitmentCounts(rows: { status: CommitmentStatus }[]) {
  const out = { total: rows.length, met: 0, on_track: 0, at_risk: 0, missed: 0 };
  for (const r of rows) out[r.status]++;
  return out;
}

const CADENCE_DAYS = { weekly: 7, monthly: 31, quarterly: 92, once: Infinity } as const;

/** A check-in is overdue when the last one is older than the cadence (never checked in counts as overdue). */
export function checkInOverdue(cadence: keyof typeof CADENCE_DAYS, lastOn: string | null, today: string) {
  if (cadence === "once") return false;
  if (!lastOn) return true;
  return daysBetween(lastOn, today) > CADENCE_DAYS[cadence];
}

// ---------------------------------------------------------------- relationship
/** Next occurrence on or after today: yearly dates roll forward, one-off dates stay as they are. */
export function nextOccurrence(d: Pick<RelDate, "on_date" | "yearly">, today: string) {
  if (!d.yearly) return d.on_date;
  const year = +today.slice(0, 4);
  const md = d.on_date.slice(5);
  // 29 Feb in a non-leap year falls on 28 Feb.
  const fix = (y: number) => (md === "02-29" && !(y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? `${y}-02-28` : `${y}-${md}`);
  const thisYear = fix(year);
  return thisYear >= today ? thisYear : fix(year + 1);
}

/** Moments in the next `days` days (today included), soonest first. People's birthdays count as yearly dates. */
export function upcomingMoments(dates: RelDate[], people: Pick<RelPerson, "name" | "birthday">[], today: string, days = 90) {
  const all = [
    ...dates.map((d) => ({ title: d.title, on: nextOccurrence(d, today) })),
    ...people.filter((p) => p.birthday).map((p) => ({ title: `${p.name} birthday`, on: nextOccurrence({ on_date: p.birthday!, yearly: true }, today) })),
  ];
  return all
    .filter((m) => {
      const diff = daysBetween(today, m.on);
      return diff >= 0 && diff <= days;
    })
    .sort((a, b) => a.on.localeCompare(b.on));
}

/** Share of the relationship profile that is filled in, 0–100. */
export function profileCompletion(input: {
  profile: Pick<SuccessProfile, "tier" | "rapport" | "niche_profile"> | null;
  people: Pick<RelPerson, "role" | "decision_power" | "personal_notes" | "birthday">[];
  hasDates: boolean;
  hasBrief: boolean;
  hasSocial: boolean;
}) {
  const p = input.profile;
  const checks = [
    !!p?.tier,
    p?.rapport != null,
    !!p?.niche_profile?.trim(),
    input.people.length > 0,
    input.hasDates,
    input.hasBrief,
    input.hasSocial,
  ];
  // Each person adds four checks: role, decision power, notes, birthday.
  for (const x of input.people) checks.push(!!x.role, !!x.decision_power, !!x.personal_notes?.trim(), !!x.birthday);
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export const OPPORTUNITY_STAGE: Record<OpportunityStage, { label: string; tone: Tone }> = {
  idea: { label: "Idea", tone: "muted" },
  pitch: { label: "Pitch", tone: "blue" },
  quote_sent: { label: "Quote sent", tone: "violet" },
  won: { label: "Won", tone: "ok" },
  lost: { label: "Lost", tone: "danger" },
};

// ---------------------------------------------------------------- reports
const REPORT_FLOW: Record<ReportStatus, ReportStatus[]> = {
  draft: ["submitted"],
  submitted: ["approved", "changes"],
  changes: ["submitted"],
  approved: ["sent", "changes"],
  sent: [],
};

export const canMoveReport = (from: ReportStatus, to: ReportStatus) => REPORT_FLOW[from].includes(to);

export function reportStatus(status: ReportStatus, hadChanges: boolean): { label: string; tone: Tone } {
  switch (status) {
    case "draft":
      return { label: "Draft", tone: "muted" };
    case "submitted":
      return { label: "Submitted, in review", tone: "violet" };
    case "changes":
      return { label: "Changes requested", tone: "warn" };
    case "approved":
      return { label: "Approved", tone: "blue" };
    case "sent":
      return { label: hadChanges ? "Sent after changes" : "Sent", tone: "ok" };
  }
}

/** A report for `month` is due on `dueDay` of the following month (day clamped to 1–28). */
export function reportDueOn(month: string, dueDay: number) {
  const day = Math.min(28, Math.max(1, Math.round(dueDay)));
  return `${monthStart(month, 1).slice(0, 8)}${String(day).padStart(2, "0")}`;
}

export const reportLate = (status: ReportStatus, dueOn: string, today: string) => status !== "sent" && today > dueOn;

const QBR_FLOW: Record<QbrStatus, QbrStatus | null> = { draft: "ready", ready: "presented", presented: null };
export const nextQbrStatus = (s: QbrStatus) => QBR_FLOW[s];

export const QBR_STATUS: Record<QbrStatus, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "muted" },
  ready: { label: "Ready", tone: "blue" },
  presented: { label: "Presented", tone: "ok" },
};

/** "2026-Q4" for a date. */
export const quarterOf = (iso: string) => `${iso.slice(0, 4)}-Q${Math.floor((+iso.slice(5, 7) - 1) / 3) + 1}`;
export const quarterLabel = (q: string) => `${q.slice(5)} ${q.slice(0, 4)}`;

// ---------------------------------------------------------------- delivery ratings
/** Average of each score over the last `months` full months before `today`'s month, one decimal. Null when no ratings. */
export function ratingAverages(rows: Pick<DeliveryRating, "month" | "quality" | "on_time" | "communication">[], today: string, months = 3) {
  const from = monthStart(today, -months);
  const to = monthStart(today);
  const inRange = rows.filter((r) => r.month >= from && r.month < to);
  const avg = (k: "quality" | "on_time" | "communication") =>
    inRange.length ? Math.round((inRange.reduce((s, r) => s + r[k], 0) / inRange.length) * 10) / 10 : null;
  return { quality: avg("quality"), on_time: avg("on_time"), communication: avg("communication"), count: inRange.length };
}

/** Tone for an average score: under 3 is a problem, under 4 is worth watching. */
export const scoreTone = (v: number | null): Tone | undefined => (v == null ? undefined : v < 3 ? "danger" : v < 4 ? "warn" : undefined);

/** One line per text block, blank lines dropped. */
export const lines = (s: string | null | undefined) => (s ?? "").split("\n").map((l) => l.trim()).filter(Boolean);

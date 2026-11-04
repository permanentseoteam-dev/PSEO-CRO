// Types for the Phase 2 work extras: Workload, Recurring rules, ticket extras, Quality report extras.

export type Result<T = null> = { ok: true; data?: T } | { ok: false; error: string };

export type Person = { id: string; name: string; departmentId: string | null; managerId: string | null };

// ---------------------------------------------------------------- workload
export type WorkloadSettings = {
  overloaded_pct: number;
  overdue_count: number;
  has_room_pct: number;
  default_estimate_min: number;
};

export const DEFAULT_SETTINGS: WorkloadSettings = { overloaded_pct: 110, overdue_count: 2, has_room_pct: 60, default_estimate_min: 60 };

/** Weekly capacity in hours; workdays are ISO weekdays (1 = Mon … 7 = Sun). */
export type Capacity = { member_id: string; weekly_hours: number; workdays: number[] };

export const DEFAULT_CAPACITY: Omit<Capacity, "member_id"> = { weekly_hours: 38, workdays: [1, 2, 3, 4, 5] };

/** An open ticket as the workload grid needs it. Dates are "YYYY-MM-DD". */
export type LoadTicket = {
  id: string;
  key: string;
  title: string;
  assigneeId: string | null;
  estimateMin: number | null;
  start: string | null;
  due: string | null;
};

export type AlertKind = "overloaded" | "overdue" | "has_room" | "unestimated";

export type WorkloadAlert = {
  memberId: string;
  kind: AlertKind;
  detail: string;
  /** Ticket suggested for "Move to…", if any. */
  moveTicket: { id: string; key: string } | null;
};

export type HandledAlert = {
  id: string;
  member_id: string;
  week_start: string;
  kind: AlertKind;
  moved_ticket_id: string | null;
  moved_from: string | null;
  moved_to: string | null;
};

export type WorkloadRow = {
  person: Person;
  /** Planned and capacity hours per day, Mon → Sun. */
  days: { planned: number; capacity: number }[];
  planned: number;
  capacity: number;
  pct: number;
};

// ---------------------------------------------------------------- recurring
export const FREQUENCIES = ["daily", "weekdays", "weekly", "monthly"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export type RecurringRule = {
  id: string;
  template_id: string | null;
  title_pattern: string;
  description: string | null;
  project_id: string;
  assignee_id: string | null;
  priority: "urgent" | "high" | "normal" | "low";
  frequency: Frequency;
  weekday: number | null;
  month_day: number | null;
  due_offset_days: number;
  starts_on: string;
  next_run: string | null;
  last_run: string | null;
  paused: boolean;
};

export type Option = { id: string; name: string };

// ---------------------------------------------------------------- ticket extras
export type TicketLite = { id: string; key: string; title: string; status: string };

export type Dependency = { id: string; ticket: TicketLite };

export type ClientCard = {
  show_in_portal: boolean;
  client_title: string;
  client_details: string;
  needs_approval: boolean;
  shared_file_ids: string[];
};

export const SCOPE_STATUSES = ["in_scope", "out_of_scope", "unsure"] as const;
export type ScopeStatus = (typeof SCOPE_STATUSES)[number];

export type ScopeTerms = { inScope: string[]; outOfScope: string[] };

export type ScopeFlag = { status: ScopeStatus; reason: string | null; matched_term: string | null; flagged_by_name: string | null };

// ---------------------------------------------------------------- quality
/** One review round. `reasons` are the send-back reasons ("Missed the brief", …). */
export type ReviewRound = {
  ticketId: string;
  round: number;
  status: "waiting" | "approved" | "changes";
  reasons: string[];
  submittedAt: string;
  decidedAt: string | null;
};

export type QualityGroupRow = { name: string; reviewed: number; firstTimePct: number | null; avgRounds: number | null; avgWaitH: number | null };

export type MostRevisedRow = { ticketId: string; rounds: number; mainReason: string | null };

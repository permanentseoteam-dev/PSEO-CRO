// Row and view types for the HR Phase 2 tables (0207_hr_p2.sql).

export type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export const CURRENCIES = ["AED", "USD", "PKR"] as const;
export type Currency = (typeof CURRENCIES)[number];

export type PayRecord = {
  id: string;
  member_id: string;
  effective_from: string;
  basic: number;
  house_rent: number;
  utilities: number;
  medical: number;
  other: number;
  gross: number;
  currency: Currency;
  reason: string | null;
};

export type Payslip = {
  id: string;
  member_id: string;
  month: string; // YYYY-MM-01
  gross: number;
  deductions: number;
  net: number;
  currency: Currency;
  notes: string | null;
};

export type ToolAccess = {
  id: string;
  member_id: string;
  tool: string;
  login: string | null;
  access_level: string | null;
  granted_on: string;
  revoked_at: string | null;
};

/** Personal details as sent to the browser: secrets are already masked unless revealed on purpose. */
export type PersonalView = {
  date_of_birth: string | null;
  id_type: string;
  id_number: string | null;
  tax_number: string | null;
  bank_name: string | null;
  iban: string | null;
};

export type PersonalChange = { id: string; field: string; changed_by: string | null; created_at: string };

export const EXIT_STATUSES = ["started", "cancelled", "completed"] as const;
export type ExitStatus = (typeof EXIT_STATUSES)[number];

export type ExitTask = { id: string; position: number; label: string; done_at: string | null };
export type Exit = {
  id: string;
  member_id: string;
  status: ExitStatus;
  last_day: string | null;
  reason: string;
  notes: string | null;
  created_at: string;
  tasks: ExitTask[];
};

export const CONTRACTS = ["full_time", "part_time", "contractor"] as const;
export type Contract = (typeof CONTRACTS)[number];
export const PROBATION_STATUSES = ["on_probation", "extended", "confirmed", "ended"] as const; // 0113 member_details
export type ProbationStatus = (typeof PROBATION_STATUSES)[number];

export type Employment = {
  member_id: string;
  contract: Contract;
  joined_on: string | null;
  shift_start: string; // HH:MM[:SS]
  shift_end: string;
  location: string | null;
  probation_status: ProbationStatus;
  probation_start: string | null;
  probation_end: string | null;
  probation_decided_by: string | null;
  probation_decided_at: string | null;
};

export const TITLE_CHANGE_KINDS = ["promotion", "transfer", "title"] as const;
export type TitleChangeKind = (typeof TITLE_CHANGE_KINDS)[number];

export type ClockDay = {
  id: string;
  member_id: string;
  work_date: string;
  clock_in_at: string;
  clock_out_at: string | null;
  break_started_at: string | null;
  break_minutes: number;
};

export const KPI_SOURCES = ["portal", "manual"] as const;
export const KPI_DIRECTIONS = ["higher", "lower"] as const;
export type Kpi = {
  id: string;
  name: string;
  source: (typeof KPI_SOURCES)[number];
  weight: number;
  direction: (typeof KPI_DIRECTIONS)[number];
  department_id: string | null;
  active: boolean;
};

export type ReviewCycle = {
  id: string;
  name: string;
  self_due: string;
  manager_due: string;
  status: "open" | "closed";
};

export const STEP_KINDS = ["course", "video", "reading", "practice", "certification"] as const;
export type StepKind = (typeof STEP_KINDS)[number];
export type TrainingStep = { id: string; path_id: string; position: number; kind: StepKind; title: string; url: string | null };
export type TrainingPath = { id: string; name: string; steps: TrainingStep[]; assigned: number; finished: number };
export type MyPath = { assignmentId: string; pathId: string; name: string; steps: TrainingStep[]; doneStepIds: string[] };

export type Option = { id: string; name: string };

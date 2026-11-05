// Row types for the client-success tables (supabase/migrations/0201_client_success.sql).

export const COMMITMENT_KINDS = ["kpi", "deliverable", "milestone"] as const;
export const CADENCES = ["weekly", "monthly", "quarterly", "once"] as const;
export const COMMITMENT_STATUSES = ["met", "on_track", "at_risk", "missed"] as const;
export const TIERS = ["A", "B", "C"] as const;
export const LOG_KINDS = ["touch", "call", "whatsapp", "email", "meeting", "note", "wish", "gift", "card", "win", "complaint"] as const;
export const MOODS = ["happy", "neutral", "unhappy"] as const;
/** Portfolio "Status review": the account person's weekly read on a client. */
export const REVIEW_STATUSES = ["on_track", "watch", "at_risk"] as const;
export const OPPORTUNITY_STAGES = ["idea", "pitch", "quote_sent", "won", "lost"] as const;
export const REPORT_STATUSES = ["draft", "submitted", "changes", "approved", "sent"] as const;
export const QBR_STATUSES = ["draft", "ready", "presented"] as const;

export type CommitmentKind = (typeof COMMITMENT_KINDS)[number];
export type Cadence = (typeof CADENCES)[number];
export type CommitmentStatus = (typeof COMMITMENT_STATUSES)[number];
export type Tier = (typeof TIERS)[number];
export type LogKind = (typeof LOG_KINDS)[number];
export type Mood = (typeof MOODS)[number];
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];
export type ReportStatus = (typeof REPORT_STATUSES)[number];
export type QbrStatus = (typeof QBR_STATUSES)[number];

export type Person = { id: string; name: string };

export type Commitment = {
  id: string;
  client_id: string;
  title: string;
  kind: CommitmentKind;
  cadence: Cadence;
  target: string;
  latest: string | null;
  status: CommitmentStatus;
  owner: Person | null;
  client_visible: boolean;
  last_checkin_on: string | null;
};

export type CheckIn = {
  id: string;
  commitment_id: string;
  commitment_title: string;
  value: string | null;
  status: CommitmentStatus;
  note: string | null;
  checked_on: string;
  by: Person | null;
};

export type SuccessProfile = {
  client_id: string;
  tier: Tier | null;
  rapport: number | null;
  rapport_note: string | null;
  niche_profile: string | null;
  report_due_day: number;
  auto_send: boolean;
  report_recipient: string | null;
};

export type RelPerson = {
  id: string;
  name: string;
  role: string | null;
  decision_power: string | null;
  personal_notes: string | null;
  birthday: string | null;
};

export type RelDate = { id: string; title: string; on_date: string; yearly: boolean; person_id: string | null };

export type LogEntry = {
  id: string;
  kind: LogKind;
  mood: Mood | null;
  note: string;
  on_date: string;
  person_name: string | null;
  by: Person | null;
};

export type Brief = { id: string; title: string; meeting_on: string; points: string };
export type SocialProfile = { id: string; name: string; is_client: boolean; instagram_followers: number | null; ads_running: number | null; note: string | null };
export type Opportunity = { id: string; title: string; value: number | null; currency: string; billing: "monthly" | "once"; stage: OpportunityStage; stage_note: string | null };
export type Removal = { id: string; person_name: string; removed_at: string; by: Person | null };

export type MonthlyReport = {
  id: string;
  month: string; // YYYY-MM-01
  status: ReportStatus;
  due_on: string;
  owner: Person | null;
  auto_send: boolean;
  had_changes: boolean;
  summary: string | null;
  highlights: string | null;
  plan: string | null;
  changes_note: string | null;
  sent_at: string | null;
};

export type Qbr = { id: string; quarter: string; status: QbrStatus; meeting_on: string | null; deck_url: string | null };

export type DeliveryRating = {
  id: string;
  month: string; // YYYY-MM-01
  department_id: string;
  department_name: string;
  quality: number;
  on_time: number;
  communication: number;
  rated_by_name: string | null;
};

export type Result = { ok: true } | { ok: false; error: string };

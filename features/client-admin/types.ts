// Row and view types for client-admin (migration 0203_client_admin).

export type Result = { ok: true } | { ok: false; error: string };

export const CURRENCIES = ["AED", "USD", "PKR"] as const;
export type Currency = (typeof CURRENCIES)[number];

export type Agreement = {
  client_id: string;
  monthly_fee: number | null;
  currency: Currency;
  start_date: string | null;
  term_months: number | null;
  notice_days: number | null;
  hours_per_month: number | null;
  in_scope: string | null;
  out_of_scope: string | null;
  renewal_on: string | null;
  auto_renews: boolean;
  agreement_path: string | null;
  agreement_name: string | null;
};

export const SENTIMENTS = ["positive", "neutral", "negative"] as const;
export type Sentiment = (typeof SENTIMENTS)[number];
export type SentimentRow = { id: string; sentiment: Sentiment; note: string | null; recorded_on: string };

export const CHURN_TRIGGERS = ["risk", "drop", "sentiment", "not_renewing", "nps"] as const;
export type ChurnTrigger = (typeof CHURN_TRIGGERS)[number];
export const CHURN_OUTCOMES = ["open", "saved", "reduced_scope", "lost"] as const;
export type ChurnOutcome = (typeof CHURN_OUTCOMES)[number];
export type ChurnAlert = {
  id: string;
  trigger_kind: ChurnTrigger;
  detail: string;
  nps_score: number | null;
  raised_on: string;
  outcome: ChurnOutcome;
  outcome_note: string | null;
  closed_on: string | null;
};

export type VaultItem = {
  id: string;
  service: string;
  username: string;
  notes: string | null;
  last_reveal: { name: string; at: string } | null;
};

export const VISIBILITIES = ["draft", "shared", "hidden"] as const;
export type Visibility = (typeof VISIBILITIES)[number];
export type ActivityLine = { id: string; body: string; happened_on: string; visibility: Visibility };

export const WINBACK_STATUSES = ["open", "won", "lost"] as const;
export type WinbackStatus = (typeof WINBACK_STATUSES)[number];
export type Winback = { id: string; status: WinbackStatus; next_step: string | null; due_on: string | null; owner_name: string | null };

export type EndedClient = {
  id: string;
  name: string;
  ended_on: string | null;
  end_reason: string | null;
  monthly_fee: number | null;
  currency: Currency | null;
  winback: Winback | null;
};

/** What a client still has attached, counted before a delete. */
export type ClientHistory = { tickets: number; files: number; logins: number; invoices: number };

export const TONES = ["Friendly", "Formal", "Brief"] as const;
export type EmailTone = (typeof TONES)[number];

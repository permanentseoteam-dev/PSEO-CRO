export type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export const CURRENCIES = ["AED", "USD", "PKR"] as const;
export type Currency = (typeof CURRENCIES)[number];

// ---------------------------------------------------------------- Home
export type Announcement = {
  id: string;
  title: string;
  body: string;
  department_id: string | null;
  department_name?: string | null;
  pinned: boolean;
  expires_on: string | null;
  author_id: string | null;
  author_name?: string | null;
  created_at: string;
};

export const ONBOARDING_STEPS = [
  { key: "photo", label: "Add a profile photo", href: "/me" },
  { key: "calendar", label: "Connect Google Calendar", href: "/calendar" },
  { key: "hours", label: "Set your working hours", href: "/settings" },
  { key: "channel", label: "Join your department channel", href: "/chat" },
  { key: "push", label: "Turn on notifications", href: "/settings#push" },
  { key: "first_hour", label: "Log your first hour", href: "/time" },
] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number]["key"];

export const DEAL_STAGES = ["discovery", "proposal", "negotiation", "won", "lost"] as const;
export type DealStage = (typeof DEAL_STAGES)[number];
export type Deal = { id: string; name: string; service: string | null; stage: DealStage; value: number; currency: Currency };

export type OverdueTicket = { assignee_id: string | null; due_date: string };
export type OverdueRow = { memberId: string | null; count: number; oldest: string };

export type OpenInvoice = { currency: string; total: number; amount_paid: number; due_on: string | null; status: string };
export type CurrencyBalance = { currency: string; outstanding: number; overdue: number };

export type PulseInput = {
  invoicesThisMonth: { currency: string; total: number }[];
  invoicesLastMonth: { currency: string; total: number }[];
  clients: { status: string; created_at: string; health_score: number | null; health_band: string | null; name: string }[];
  loggedMinutes: number;
  staffCount: number;
  workdaysElapsed: number;
};

/**
 * Phase 1 leave table (0113_personal). Adjust here at wire-in if 0113 uses other names.
 * Expected: id, member_id, kind, starts_on, ends_on, status ('pending' | 'approved' | 'declined' …).
 */
export const LEAVE_TABLE = "leave_requests";
export type LeaveRow = { id: string; member_id: string; kind: string; starts_on: string; ends_on: string; status: string };

// ---------------------------------------------------------------- Settings
export const API_SCOPES = ["time.view", "clients.view", "tickets.view", "finance.invoices.view"] as const;
export type ApiScope = (typeof API_SCOPES)[number];
export type ApiKeyRow = {
  id: string;
  name: string;
  prefix: string;
  scopes: ApiScope[];
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

export type DeliveryResult = "queued" | "delivered" | "held" | "bounced" | "failed";
export type DeliveryRow = {
  id: string;
  sent_at: string;
  to: string;
  channel: "push" | "email" | "in_app";
  message: string;
  result: DeliveryResult;
};

// ---------------------------------------------------------------- Integrations
export type Provider = "google_calendar" | "fireflies" | "gmail" | "ai";
export type ConnectionStatus = "not_configured" | "connected" | "error" | "disconnected";
export type Connection = {
  id: string;
  provider: Provider;
  status: ConnectionStatus;
  account_label: string | null;
  last_sync_at: string | null;
  last_error: string | null;
};

export type CallSummary = {
  decisions: string[];
  concerns: { text: string; quote?: string }[];
  actions: { text: string; owner?: string }[];
};
export type MatchMethod = "email" | "domain" | "title" | "manual" | "none";
export type FirefliesCall = {
  id: string;
  title: string;
  occurred_at: string;
  minutes: number;
  participants: string[];
  client_id: string | null;
  client_name?: string | null;
  match_method: MatchMethod;
  summary: CallSummary | null;
  summary_status: "none" | "not_configured" | "ready" | "error";
};

export const INBOX_OUTCOMES = [
  { key: "new_ticket", label: "New tickets" },
  { key: "added_to_ticket", label: "Added to tickets" },
  { key: "not_client", label: "Not from a client" },
  { key: "automatic", label: "Automatic" },
  { key: "from_us", label: "From us" },
] as const;
export type InboxOutcome = (typeof INBOX_OUTCOMES)[number]["key"];

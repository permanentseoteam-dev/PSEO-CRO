// Pure rules for client-admin. No I/O.
import { addMonths, format, parseISO, subMonths } from "date-fns";
import type { Tone } from "@/components/ui";
import type {
  Agreement,
  ChurnAlert,
  ChurnOutcome,
  ChurnTrigger,
  ClientHistory,
  EmailTone,
  Sentiment,
  SentimentRow,
  Visibility,
  WinbackStatus,
} from "./types";

const iso = (d: Date) => format(d, "yyyy-MM-dd");

/** "1 Feb 2025" */
export const fmtDate = (d: string | null | undefined) => (d ? format(parseISO(d), "d MMM yyyy") : "");

export const fmtMoney = (amount: number, currency: string) =>
  `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

// ---------------------------------------------------------------- terms

/** Renewal date: the stored one, else start + term. */
export function renewalDate(a: Pick<Agreement, "renewal_on" | "start_date" | "term_months">): string | null {
  if (a.renewal_on) return a.renewal_on;
  if (!a.start_date || !a.term_months) return null;
  return iso(addMonths(parseISO(a.start_date), a.term_months));
}

/** The renewal reminder goes out two months before renewal. */
export const renewalReminder = (renewal: string) => iso(subMonths(parseISO(renewal), 2));

export function termLabel(a: Pick<Agreement, "term_months" | "start_date">): string {
  if (!a.term_months) return "Rolling";
  const months = `${a.term_months} month${a.term_months === 1 ? "" : "s"}`;
  return a.start_date ? `${months}, from ${fmtDate(a.start_date)}` : months;
}

/** Hours logged against the monthly budget: 80% warns, 100% is over. */
export function hoursUsage(used: number, budget: number): { pct: number; tone: Tone; note: string | null } {
  if (budget <= 0) return { pct: 0, tone: "muted", note: null };
  const ratio = used / budget;
  const pct = Math.round(ratio * 100);
  if (ratio >= 1) return { pct, tone: "danger", note: "Over the monthly hours budget" };
  if (ratio >= 0.8) return { pct, tone: "warn", note: "Past 80% of the monthly hours budget" };
  return { pct, tone: "ok", note: null };
}

// ---------------------------------------------------------------- health

const SENTIMENT_RANK: Record<Sentiment, number> = { negative: 0, neutral: 1, positive: 2 };

/** Newest first in, "Sentiment: neutral, trending down" out. */
export function sentimentLine(rows: Pick<SentimentRow, "sentiment">[]): string {
  if (!rows.length) return "Sentiment: not recorded";
  const [now, before] = rows;
  if (!before) return `Sentiment: ${now.sentiment}`;
  const d = SENTIMENT_RANK[now.sentiment] - SENTIMENT_RANK[before.sentiment];
  return `Sentiment: ${now.sentiment}, ${d > 0 ? "trending up" : d < 0 ? "trending down" : "steady"}`;
}

export const CHURN_TRIGGER: Record<ChurnTrigger, string> = {
  risk: "Health at risk",
  drop: "Health dropped",
  sentiment: "Sentiment fell",
  not_renewing: "Not renewing",
  nps: "Low NPS",
};

export const CHURN_OUTCOME: Record<ChurnOutcome, { label: string; tone: Tone }> = {
  open: { label: "Open", tone: "warn" },
  saved: { label: "Saved", tone: "ok" },
  reduced_scope: { label: "Reduced scope", tone: "blue" },
  lost: { label: "Lost", tone: "danger" },
};

/** NPS 0–6 is a detractor. */
export const isDetractor = (score: number) => score <= 6;

/**
 * Churn triggers the data suggests that have no open alert yet:
 *  - risk: health score under 50
 *  - drop: health fell 15+ points from the previous score (when known)
 *  - sentiment: latest sentiment is negative or lower than the one before
 * "not_renewing" and "nps" come from people, so they are raised by hand.
 */
export function suggestChurnTriggers(input: {
  healthScore: number | null;
  prevHealthScore: number | null;
  sentiments: Pick<SentimentRow, "sentiment">[];
  alerts: Pick<ChurnAlert, "trigger_kind" | "outcome">[];
}): ChurnTrigger[] {
  const open = new Set(input.alerts.filter((a) => a.outcome === "open").map((a) => a.trigger_kind));
  const out: ChurnTrigger[] = [];
  const { healthScore: score, prevHealthScore: prev } = input;
  if (score != null && score < 50) out.push("risk");
  if (score != null && prev != null && prev - score >= 15) out.push("drop");
  const [now, before] = input.sentiments;
  if (now && (now.sentiment === "negative" || (before && SENTIMENT_RANK[now.sentiment] < SENTIMENT_RANK[before.sentiment])))
    out.push("sentiment");
  return out.filter((t) => !open.has(t));
}

// ---------------------------------------------------------------- vault and activity lines

/** Seconds a revealed password stays on screen. */
export const REVEAL_SECONDS = 30;

export const VISIBILITY: Record<Visibility, string> = { draft: "Draft", shared: "Shared", hidden: "Hidden" };

// ---------------------------------------------------------------- win-back

/** Clients that have ended (Phase 1 statuses). */
export const isEnded = (status: string) => status === "churned" || status === "terminated";

export const WINBACK: Record<WinbackStatus, { label: string; tone: Tone }> = {
  open: { label: "In progress", tone: "blue" },
  won: { label: "Won back", tone: "ok" },
  lost: { label: "Closed", tone: "muted" },
};

/** "Ended 30 Jun 2026 · Budget cut after Q2 · was AED 7,500/month" */
export function endedLine(c: { ended_on: string | null; end_reason: string | null; monthly_fee: number | null; currency: string | null }) {
  return [
    c.ended_on ? `Ended ${fmtDate(c.ended_on)}` : "Ended",
    c.end_reason,
    c.monthly_fee != null && c.currency ? `was ${fmtMoney(c.monthly_fee, c.currency)}/month` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

// ---------------------------------------------------------------- delete client

/** The typed name must match the client name exactly (spaces at the ends and doubled spaces ignored). */
export function nameMatches(typed: string, name: string) {
  const norm = (s: string) => s.trim().replace(/\s+/g, " ");
  return norm(name).length > 0 && norm(typed) === norm(name);
}

/**
 * History check before a delete. Invoices are financial records, so a client with invoices can't be deleted:
 * end the client instead. Everything else is listed so the person knows what goes with it.
 */
export function deleteCheck(h: ClientHistory): { allowed: boolean; blockers: string[]; removes: string[] } {
  const n = (count: number, one: string) => `${count} ${one}${count === 1 ? "" : "s"}`;
  const blockers = h.invoices > 0 ? [`${n(h.invoices, "invoice")} in Finance, so it is archived instead and its records are kept.`] : [];
  const removes = [
    h.tickets ? n(h.tickets, "ticket") : null,
    h.files ? n(h.files, "file") : null,
    h.logins ? n(h.logins, "portal login") : null,
  ].filter((s): s is string => !!s);
  return { allowed: blockers.length === 0, blockers, removes };
}

// ---------------------------------------------------------------- AI email draft

const TONE_RULES: Record<EmailTone, string> = {
  Friendly: "Warm and personal, first names, short paragraphs, sign off with the sender's first name.",
  Formal: "Polite and formal, full sentences, 'Dear <name>', sign off with full name and title.",
  Brief: "Three sentences at most, no greeting line, plain facts and one ask.",
};

/** Prompt for the AI adapter. Facts come only from what the person typed; the model must not invent numbers. */
export function buildEmailPrompt(input: {
  tone: EmailTone;
  clientName: string;
  contactName: string;
  senderName: string;
  subject: string;
  points: string;
}) {
  const system = [
    "You write short client emails for a digital marketing agency.",
    `Tone: ${TONE_RULES[input.tone]}`,
    "Use only the facts given. Never invent numbers, dates or promises. Plain words, no buzzwords, no emoji.",
    "Return only the email body.",
  ].join("\n");
  const user = [
    `Client: ${input.clientName}`,
    `To: ${input.contactName || "the client"}`,
    `From: ${input.senderName}`,
    `Subject: ${input.subject}`,
    "Points to cover:",
    input.points.trim(),
  ].join("\n");
  return { system, user };
}

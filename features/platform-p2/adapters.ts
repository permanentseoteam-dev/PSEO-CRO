// Integration adapters. No accounts are connected yet, so every adapter is the "not configured" one.
// A real implementation (OAuth tokens kept in Supabase Vault or env, never in our tables) plugs in behind
// the same interface and is returned from the matching get…Adapter() function.
import type { CallSummary } from "./types";

export type NotConfigured = { ok: false; reason: "not_configured" };
export type AdapterResult<T> = { ok: true; data: T } | NotConfigured | { ok: false; reason: "error"; message: string };
const no: NotConfigured = { ok: false, reason: "not_configured" };

// ---------------------------------------------------------------- Google Calendar (two-way sync)
export type GoogleEvent = { id: string; title: string; startsAt: string; minutes: number; meetLink?: string; attendees: string[] };
export type BusyBlock = { email: string; startsAt: string; endsAt: string };

export interface GoogleCalendarAdapter {
  readonly configured: boolean;
  /** URL that starts the Google OAuth consent for this member. */
  connectUrl(memberId: string, returnTo: string): AdapterResult<string>;
  /** Pull changes since the last sync token; returns the next token. */
  pullChanges(memberId: string, syncToken: string | null): Promise<AdapterResult<{ events: GoogleEvent[]; nextToken: string }>>;
  /** Push a portal event to the member's Google Calendar. */
  pushEvent(memberId: string, event: GoogleEvent): Promise<AdapterResult<{ googleId: string }>>;
  /** Colleague busy/free from Google. */
  freeBusy(emails: string[], fromIso: string, toIso: string): Promise<AdapterResult<BusyBlock[]>>;
}

export const notConfiguredGoogleCalendar: GoogleCalendarAdapter = {
  configured: false,
  connectUrl: () => no,
  pullChanges: async () => no,
  pushEvent: async () => no,
  freeBusy: async () => no,
};

export function getGoogleCalendarAdapter(): GoogleCalendarAdapter {
  return notConfiguredGoogleCalendar;
}

// ---------------------------------------------------------------- Fireflies (call import)
export type FirefliesTranscript = {
  id: string;
  title: string;
  occurredAt: string;
  minutes: number;
  participants: string[];
  transcriptUrl: string;
  text: string;
};

export interface FirefliesAdapter {
  readonly configured: boolean;
  /** Transcripts recorded after `sinceIso`, oldest first. */
  listTranscripts(sinceIso: string): Promise<AdapterResult<FirefliesTranscript[]>>;
  getTranscript(id: string): Promise<AdapterResult<FirefliesTranscript>>;
}

export const notConfiguredFireflies: FirefliesAdapter = {
  configured: false,
  listTranscripts: async () => no,
  getTranscript: async () => no,
};

export function getFirefliesAdapter(): FirefliesAdapter {
  return notConfiguredFireflies;
}

// ---------------------------------------------------------------- AI summary (meetings)
export interface SummaryAdapter {
  readonly configured: boolean;
  /** Decisions, concerns with quotes, and action items from a call transcript. */
  summarize(input: { title: string; transcript: string; clientName?: string }): Promise<AdapterResult<CallSummary>>;
}

export const notConfiguredSummary: SummaryAdapter = { configured: false, summarize: async () => no };

export function getSummaryAdapter(): SummaryAdapter {
  return notConfiguredSummary;
}

// ---------------------------------------------------------------- Gmail client inbox (Response times)
export type InboxEmail = { id: string; threadId: string; from: string; to: string[]; subject: string; receivedAt: string; automatic: boolean };

export interface GmailInboxAdapter {
  readonly configured: boolean;
  /** Messages in the shared mailbox since `sinceIso` (domain-wide delegation). Polled every 10 minutes. */
  listMessages(mailbox: string, sinceIso: string): Promise<AdapterResult<InboxEmail[]>>;
}

export const notConfiguredGmail: GmailInboxAdapter = { configured: false, listMessages: async () => no };

export function getGmailInboxAdapter(): GmailInboxAdapter {
  return notConfiguredGmail;
}

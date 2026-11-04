// Slack adapter. No Slack app is set up yet, so the only implementation reports "not configured".
// A real implementation (OAuth bot token, conversations.history, Events API for the bridge) plugs in here.
import type { ImportDays } from "./types";

export type SlackChannelRef = { id: string; name: string };
export type SlackMessage = { ts: string; channel: string; userName: string; text: string; files: { name: string; url: string }[] };

export type NotConfigured = { ok: false; reason: "not_configured" };
export type AdapterResult<T> = { ok: true; data: T } | NotConfigured | { ok: false; reason: "error"; message: string };

export interface SlackAdapter {
  readonly configured: boolean;
  /** URL to start the Slack OAuth install. */
  connectUrl(returnTo: string): AdapterResult<string>;
  listChannels(): Promise<AdapterResult<SlackChannelRef[]>>;
  /** One page of history for the import, oldest first; pass the returned cursor back to resume. */
  fetchHistory(channel: string, sinceIso: string, cursor?: string | null): Promise<AdapterResult<{ messages: SlackMessage[]; cursor: string | null }>>;
  /** Bridge outbound: post a portal message into the linked Slack channel. */
  postMessage(channel: string, text: string, asName: string): Promise<AdapterResult<{ ts: string }>>;
  estimateCount(days: ImportDays): Promise<AdapterResult<number>>;
}

const no: NotConfigured = { ok: false, reason: "not_configured" };

export const notConfiguredSlack: SlackAdapter = {
  configured: false,
  connectUrl: () => no,
  listChannels: async () => no,
  fetchHistory: async () => no,
  postMessage: async () => no,
  estimateCount: async () => no,
};

/** The adapter in use. Swap for a real one once SLACK_CLIENT_ID / SLACK_CLIENT_SECRET exist. */
export function getSlackAdapter(): SlackAdapter {
  return notConfiguredSlack;
}

// Types for the Phase 2 chat extras: voice notes, huddles, channel meeting, channel settings, Slack, Web Push.
// Phase 1 tables (0105_chat, 0104_calendar, 0101_shell) are referenced by name only.

export type Result<T = null> = { ok: true; data?: T } | { ok: false; error: string };

/** One item of messages.files (0105_chat). Voice notes add duration and peaks. */
export type ChatFile = {
  path: string;
  name: string;
  mime: string;
  size: number;
  /** Voice notes only: length in seconds and 0..1 waveform peaks. */
  duration?: number;
  peaks?: number[];
};

export type ChannelKind = "public" | "private" | "client" | "dm" | "group";

export type ChannelP2 = {
  id: string;
  kind: ChannelKind;
  name: string | null;
  topic: string | null;
  clientId: string | null;
  adminsOnly: boolean;
  archivedAt: string | null;
};

export type HuddleMedia = "audio" | "video";

export type Huddle = {
  id: string;
  channelId: string;
  media: HuddleMedia;
  startedBy: string;
  startedAt: string;
  participants: { memberId: string; name: string }[];
};

export type Person = { id: string; name: string };

// ---------------------------------------------------------------- Slack
export const SLACK_STATUS = ["not_connected", "connected", "error"] as const;
export type SlackStatus = (typeof SLACK_STATUS)[number];
export const BRIDGE_STATES = ["running", "paused"] as const;
export type BridgeState = (typeof BRIDGE_STATES)[number];
export const IMPORT_DAYS = [30, 90, 365] as const;
export type ImportDays = (typeof IMPORT_DAYS)[number];
export const IMPORT_STATUS = ["queued", "running", "paused", "done", "failed", "not_configured"] as const;
export type ImportStatus = (typeof IMPORT_STATUS)[number];

export type SlackWorkspace = {
  id: string;
  workspace: string;
  status: SlackStatus;
  bridge: BridgeState;
  importDays: ImportDays;
  lastSyncAt: string | null;
  importedCount: number;
};

export type SlackLink = { id: string; slackChannel: string; channelId: string | null; bridge: BridgeState };

export type SlackImportJob = {
  id: string;
  days: ImportDays;
  status: ImportStatus;
  importedCount: number;
  totalEstimate: number | null;
  createdAt: string;
};

export type SlackSetup = {
  workspace: SlackWorkspace | null;
  links: SlackLink[];
  lastJob: SlackImportJob | null;
  channels: { id: string; name: string }[];
};

// ---------------------------------------------------------------- Web Push
export type PushSubscriptionInput = { endpoint: string; p256dh: string; auth: string; userAgent?: string };

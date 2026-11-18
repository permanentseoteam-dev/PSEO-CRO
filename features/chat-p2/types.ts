// Types for the Phase 2 chat extras: voice notes, huddles, channel meeting, channel settings, Web Push.
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

// ---------------------------------------------------------------- Web Push
export type PushSubscriptionInput = { endpoint: string; p256dh: string; auth: string; userAgent?: string };

// Pure logic for the chat extras. No I/O.
import type { BridgeState, ChannelKind } from "./types";

// ---------------------------------------------------------------- voice notes
export const MAX_VOICE_SECONDS = 300;
export const VOICE_BARS = 32;

const VOICE_MIMES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

/** First recorder format the browser supports, or "" to let the browser pick. */
export function pickVoiceMime(isSupported: (mime: string) => boolean): string {
  return VOICE_MIMES.find((m) => isSupported(m)) ?? "";
}

export function extForMime(mime: string): string {
  if (mime.startsWith("audio/mp4")) return "m4a";
  if (mime.startsWith("audio/ogg")) return "ogg";
  return "webm";
}

/** Storage path inside the chat-files bucket: <channel_id>/<uuid>-voice-note.<ext> (0105_chat layout). */
export function voicePath(channelId: string, id: string, mime: string): string {
  return `${channelId}/${id}-voice-note.${extForMime(mime)}`;
}

/** 0:07, 4:59. */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Downsample level readings into `bars` peaks scaled to 0..1 (loudest = 1). */
export function downsamplePeaks(levels: number[], bars = VOICE_BARS): number[] {
  if (levels.length === 0) return Array(bars).fill(0);
  const out: number[] = [];
  for (let i = 0; i < bars; i++) {
    const from = Math.floor((i * levels.length) / bars);
    const to = Math.max(from + 1, Math.floor(((i + 1) * levels.length) / bars));
    out.push(Math.max(...levels.slice(from, to).map((v) => Math.abs(v))));
  }
  const top = Math.max(...out);
  return out.map((v) => (top > 0 ? Math.round((v / top) * 100) / 100 : 0));
}

// ---------------------------------------------------------------- huddles
export const MAX_HUDDLE_PEOPLE = 6;
export const STUN_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

/** Realtime topic for a channel's huddle (private broadcast + presence, guarded by RLS on realtime.messages). */
export const huddleTopic = (channelId: string) => `huddle:${channelId}`;

/** Exactly one side of each pair sends the offer, so two people joining together don't collide. */
export const shouldOffer = (myId: string, peerId: string) => myId < peerId;

export type Signal =
  | { type: "offer"; from: string; to: string; sdp: string }
  | { type: "answer"; from: string; to: string; sdp: string }
  | { type: "ice"; from: string; to: string; candidate: { candidate: string; sdpMid: string | null; sdpMLineIndex: number | null } };

/** Validate a broadcast payload addressed to me. */
export function readSignal(raw: unknown, myId: string): Signal | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  if (s.to !== myId || typeof s.from !== "string" || s.from === myId) return null;
  if ((s.type === "offer" || s.type === "answer") && typeof s.sdp === "string") return s as unknown as Signal;
  if (s.type === "ice" && s.candidate && typeof (s.candidate as { candidate?: unknown }).candidate === "string") return s as unknown as Signal;
  return null;
}

// ---------------------------------------------------------------- channel settings
/** DMs have no settings to archive; channels and groups can be archived by an admin. */
export const canArchive = (kind: ChannelKind) => kind !== "dm";
export const canSetAdminsOnly = (kind: ChannelKind) => kind !== "dm" && kind !== "group";

// ---------------------------------------------------------------- schedule meeting
export const MEETING_MINUTES = [15, 30, 45, 60] as const;

/** "Thu 5 Nov at 15:00" from a local date and time. */
export function meetingWhen(date: string, time: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const day = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  return `${day} at ${time}`;
}

export function meetingMessage(by: string, title: string, when: string, minutes: number, people: number): string {
  return `${by} scheduled "${title}" for ${when} (${minutes} min) with ${people} ${people === 1 ? "person" : "people"}.`;
}

// ---------------------------------------------------------------- quiet hours and push
/** "22:00" or "22:00:00" -> minutes after midnight, or null. */
export function parseTime(t: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(t ?? "");
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/** Minutes after midnight for `date` in an IANA time zone. */
export function minutesInZone(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const get = (k: string) => Number(parts.find((p) => p.type === k)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}

/** Quiet from 22:00 to 07:00 wraps midnight. Equal or missing ends mean no quiet hours. */
export function inQuietHours(nowMin: number, from: string | null, to: string | null): boolean {
  const f = parseTime(from);
  const t = parseTime(to);
  if (f == null || t == null || f === t) return false;
  return f < t ? nowMin >= f && nowMin < t : nowMin >= f || nowMin < t;
}

/** Push or not: muted never, mentions-only needs a mention, quiet hours hold everything. */
export function shouldPush(o: { notify: "all" | "mentions" | "mute"; isMention: boolean; quiet: boolean }): boolean {
  if (o.quiet || o.notify === "mute") return false;
  return o.notify === "all" || o.isMention;
}

/** base64url VAPID key -> bytes for PushManager.subscribe. */
export function urlBase64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

// ---------------------------------------------------------------- Slack
/** Start of the import window. */
export function importSince(now: Date, days: number): string {
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}

/** Portal channels mapped from more than one Slack channel (not allowed: the bridge would echo). */
export function duplicateTargets(links: { channelId: string | null }[]): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const l of links) {
    if (!l.channelId) continue;
    if (seen.has(l.channelId)) dup.add(l.channelId);
    seen.add(l.channelId);
  }
  return [...dup];
}

export function importProgress(imported: number, total: number | null): number | null {
  if (!total || total <= 0) return null;
  return Math.min(100, Math.round((imported / total) * 100));
}

export const bridgeTone = (b: BridgeState) => (b === "running" ? "ok" : "warn");

export type ChannelKind = "public" | "private" | "client" | "dm" | "group";
export type Notify = "all" | "mentions" | "mute";
export type LiveState = "live" | "reconnecting" | "offline";

/** Voice notes (chat-p2) add duration in seconds and 0..1 waveform peaks. */
export type FileRef = { path: string; name: string; mime: string; size: number; duration?: number; peaks?: number[] };
export type Forward = { by: string; ch: string; text: string };

export type Message = {
  id: number;
  clientKey: string | null;
  channelId: string;
  authorId: string | null;
  parentId: number | null;
  body: string;
  mentions: string[];
  alsoInChannel: boolean;
  forward: Forward | null;
  files: FileRef[];
  pinnedAt: string | null;
  editedAt: string | null;
  deletedAt: string | null;
  ticketKey: string | null;
  createdAt: string;
  /** Client-only: optimistic copy waiting for the server. */
  pending?: boolean;
  /** Client-only: the send failed; offer Retry. */
  failed?: boolean;
};

/** Raw row from Postgres / realtime payloads. */
export type MessageRow = {
  id: number;
  client_key: string | null;
  channel_id: string;
  author_id: string | null;
  parent_id: number | null;
  body: string;
  mentions: string[] | null;
  also_in_channel: boolean;
  forward: Forward | null;
  files: FileRef[] | null;
  pinned_at: string | null;
  edited_at: string | null;
  deleted_at: string | null;
  ticket_key: string | null;
  created_at: string;
};

export type Reaction = { messageId: number; memberId: string; emoji: string };

export type Person = {
  id: string;
  name: string;
  title: string | null;
  kind: "staff" | "client";
  presence: string;
  clientId: string | null;
};

export type ConvMember = { memberId: string; role: "member" | "admin"; lastReadId: number };

export type Conversation = {
  id: string;
  kind: ChannelKind;
  name: string | null;
  topic: string | null;
  clientId: string | null;
  adminsOnly: boolean;
  /** Set when archived (0205): hidden from the sidebar, no new messages. */
  archivedAt: string | null;
  lastMessageAt: string | null;
  createdBy: string | null;
  members: ConvMember[];
  notify: Notify;
  lastReadId: number;
  unread: number;
  mentions: number;
};

export type ClientOption = { id: string; name: string };

export type BrowseRow = { id: string; name: string; topic: string | null; members: number };

export type SearchHit = { message: Message; channelId: string };

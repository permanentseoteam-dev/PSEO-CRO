// Pure chat logic: no I/O. Times are shown in Asia/Dubai (UTC+4, no daylight saving).
import type { Conversation, Message, MessageRow, Person, Reaction } from "./types";

const DUBAI_MS = 4 * 60 * 60 * 1000;
const GROUP_MS = 5 * 60 * 1000;
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function toMessage(r: MessageRow): Message {
  return {
    id: Number(r.id),
    clientKey: r.client_key,
    channelId: r.channel_id,
    authorId: r.author_id,
    parentId: r.parent_id == null ? null : Number(r.parent_id),
    body: r.body ?? "",
    mentions: r.mentions ?? [],
    alsoInChannel: !!r.also_in_channel,
    forward: r.forward ?? null,
    files: r.files ?? [],
    pinnedAt: r.pinned_at,
    editedAt: r.edited_at,
    deletedAt: r.deleted_at,
    ticketKey: r.ticket_key,
    createdAt: r.created_at,
  };
}

/** Dubai calendar day ("2026-11-04") and clock time ("09:14") of an ISO timestamp. */
export function dubai(iso: string) {
  const s = new Date(Date.parse(iso) + DUBAI_MS).toISOString();
  return { day: s.slice(0, 10), time: s.slice(11, 16) };
}

/** "Today, Wednesday 4 November", "Yesterday, Tuesday 3 November", "Monday 2 November" (+ year if not this year). */
export function dayLabel(day: string, today: string) {
  const d = new Date(day + "T00:00:00Z");
  const base = `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  const diff = Math.round((Date.parse(today + "T00:00:00Z") - d.getTime()) / 86400000);
  if (diff === 0) return `Today, ${base}`;
  if (diff === 1) return `Yesterday, ${base}`;
  return day.slice(0, 4) === today.slice(0, 4) ? base : `${base} ${day.slice(0, 4)}`;
}

/** Shown in the conversation itself: top-level messages and thread replies also sent to the channel. */
export const inChannel = (m: Message) => m.parentId == null || m.alsoInChannel;

/** Counts towards unread: in the channel, not mine, not deleted, newer than my last read. */
const unreadBy = (m: Message, lastReadId: number, meId: string) =>
  m.id > lastReadId && !m.pending && !m.deletedAt && m.authorId !== meId;

/** Unread and @mention counts for one conversation (mirrors chat_unread() in 0105_chat.sql). */
export function countUnread(msgs: Message[], lastReadId: number, meId: string) {
  let unread = 0;
  let mentions = 0;
  for (const m of msgs) {
    if (!unreadBy(m, lastReadId, meId)) continue;
    if (inChannel(m)) unread++;
    if (m.mentions.includes(meId)) mentions++;
  }
  return { unread, mentions };
}

/** Sidebar counts after a live message arrives in a conversation I am not looking at. */
export function bumpUnread(c: Conversation, m: Message, meId: string): Conversation {
  const { unread, mentions } = countUnread([m], c.lastReadId, meId);
  if (!unread && !mentions) return c;
  return { ...c, unread: c.unread + unread, mentions: c.mentions + mentions };
}

/** Id of the first unread message, where the "New messages" divider goes. */
export function firstUnreadId(msgs: Message[], lastReadId: number, meId: string): number | null {
  const m = msgs.find((x) => inChannel(x) && unreadBy(x, lastReadId, meId));
  return m ? m.id : null;
}

export type Row =
  | { type: "day"; key: string; label: string }
  | { type: "new"; key: string }
  | { type: "msg"; key: string; msg: Message; grouped: boolean };

/**
 * Turns a conversation's messages (sorted by id) into rows: day dividers, the "New messages" divider and
 * messages. A message is grouped under the previous one (no avatar or name) when the same person wrote it
 * within 5 minutes on the same day, nothing broke the run, the previous one is not deleted, and it is not pinned.
 */
export function buildRows(msgs: Message[], opts: { today: string; newFromId: number | null }): Row[] {
  const rows: Row[] = [];
  let day = "";
  let prev: Message | null = null;
  for (const m of msgs) {
    if (!inChannel(m)) continue;
    const d = dubai(m.createdAt).day;
    let broke = false;
    if (d !== day) {
      rows.push({ type: "day", key: "d" + d, label: dayLabel(d, opts.today) });
      day = d;
      broke = true;
    }
    if (opts.newFromId != null && m.id === opts.newFromId) {
      rows.push({ type: "new", key: "new" });
      broke = true;
    }
    const grouped =
      !broke &&
      prev != null &&
      !prev.deletedAt &&
      prev.authorId === m.authorId &&
      Date.parse(m.createdAt) - Date.parse(prev.createdAt) <= GROUP_MS &&
      !m.pinnedAt;
    rows.push({ type: "msg", key: m.clientKey ?? String(m.id), msg: m, grouped });
    prev = m;
  }
  return rows;
}

/** Thread summary for a top-level message: reply count, up to 3 distinct authors, last reply time. */
export function threadInfo(msgs: Message[], parentId: number) {
  const replies = msgs.filter((m) => m.parentId === parentId && !m.deletedAt);
  const authors = [...new Set(replies.map((r) => r.authorId).filter((a): a is string => !!a))].slice(0, 3);
  return { count: replies.length, authors, last: replies.length ? replies[replies.length - 1].createdAt : null };
}

/** Insert or replace a message (matching id, or the optimistic copy's client key), keeping id order. */
export function upsertMessage(list: Message[], m: Message): Message[] {
  const i = list.findIndex((x) => x.id === m.id || (m.clientKey != null && x.clientKey === m.clientKey));
  const next = i >= 0 ? list.map((x, j) => (j === i ? m : x)) : [...list, m];
  return next.sort((a, b) => sortKey(a) - sortKey(b));
}

// Pending messages have negative temporary ids; keep them at the bottom until the server answers.
const sortKey = (m: Message) => (m.id < 0 ? 2 ** 50 - m.id : m.id);

/** Reactions on one message, grouped by emoji in first-used order. */
export function reactionSummary(rx: Reaction[], messageId: number, meId: string) {
  const out: { emoji: string; count: number; mine: boolean; memberIds: string[] }[] = [];
  for (const r of rx) {
    if (r.messageId !== messageId) continue;
    let g = out.find((x) => x.emoji === r.emoji);
    if (!g) out.push((g = { emoji: r.emoji, count: 0, mine: false, memberIds: [] }));
    g.count++;
    g.memberIds.push(r.memberId);
    if (r.memberId === meId) g.mine = true;
  }
  return out;
}

/** "Seen" when every other member of a DM or group has read up to my last message. */
export function seenByAll(lastMineId: number, others: { lastReadId: number }[]) {
  return others.length > 0 && others.every((o) => o.lastReadId >= lastMineId);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Ids of the people @mentioned in a message, matching full names (longest first so "Ali" never beats "Yusuf Ali"). */
export function parseMentions(text: string, people: Pick<Person, "id" | "name">[]): string[] {
  const ids: string[] = [];
  const sorted = [...people].sort((a, b) => b.name.length - a.name.length);
  for (const p of sorted) {
    const re = new RegExp(`(^|[^\\w])@${escapeRe(p.name)}(?![\\w])`, "i");
    if (re.test(text) && !ids.includes(p.id)) ids.push(p.id);
  }
  return ids;
}

export type Token =
  | { t: "text"; v: string }
  | { t: "b" | "i" | "code"; v: string }
  | { t: "link"; v: string }
  | { t: "mention"; v: string; me: boolean };

/** Markdown basics (**bold**, _italic_, `code`, links) and @mentions as tokens. Rendered as React text, never HTML. */
export function tokenize(text: string, names: string[], meName: string): Token[] {
  const sorted = [...names].sort((a, b) => b.length - a.length).map(escapeRe);
  const mention = sorted.length ? `|(@(?:${sorted.join("|")}))(?![\\w])` : "";
  const re = new RegExp("(`[^`\\n]+`)|(\\*\\*[^*\\n]+\\*\\*)|((?<![\\w])_[^_\\n]+_(?![\\w]))|(https?:\\/\\/[^\\s<>]+[^\\s<>.,;:!?)\\]'\"])" + mention, "g");
  const out: Token[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ t: "text", v: text.slice(last, i) });
    const s = m[0];
    if (m[1]) out.push({ t: "code", v: s.slice(1, -1) });
    else if (m[2]) out.push({ t: "b", v: s.slice(2, -2) });
    else if (m[3]) out.push({ t: "i", v: s.slice(1, -1) });
    else if (m[4]) out.push({ t: "link", v: s });
    else out.push({ t: "mention", v: s.slice(1), me: s.slice(1).toLowerCase() === meName.toLowerCase() });
    last = i + s.length;
  }
  if (last < text.length) out.push({ t: "text", v: text.slice(last) });
  return out;
}

/** The @query being typed just before the caret, for mention autocomplete. Null when not in a mention. */
export function mentionQuery(text: string, caret: number): { start: number; q: string } | null {
  const m = /(^|\s)@([^\s@]{0,20}(?: [^\s@]{0,20})?)$/.exec(text.slice(0, caret));
  if (!m) return null;
  return { start: caret - m[2].length - 1, q: m[2] };
}

/** People whose name matches a mention query (name start or any word start). */
export function mentionMatches<T extends Pick<Person, "name">>(people: T[], q: string, limit = 6): T[] {
  const s = q.toLowerCase();
  return people.filter((p) => p.name.toLowerCase().split(" ").some((_, i, w) => w.slice(i).join(" ").startsWith(s))).slice(0, limit);
}

/** Conversation name for the sidebar and header: #name for channels, other people's names for DMs and groups. */
export function convLabel(c: Pick<Conversation, "kind" | "name" | "members">, people: Map<string, Pick<Person, "name">>, meId: string) {
  if (c.kind !== "dm" && c.kind !== "group") return "#" + (c.name ?? "");
  const names = c.members.filter((m) => m.memberId !== meId).map((m) => people.get(m.memberId)?.name ?? "Someone");
  return names.length ? names.join(", ") : "Just you";
}

const BLOCKED = /\.(exe|msi|bat|cmd|com|scr|pif|vbs|vbe|js|jse|wsf|wsh|ps1|psm1|sh|jar|apk|dll|lnk|reg|hta|cpl)$/i;
export const MAX_FILES = 10;
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

/** Why a file can't be sent, or null when it is fine. */
export function fileProblem(f: { name: string; size: number }) {
  if (BLOCKED.test(f.name)) return `${f.name}: this file type is blocked.`;
  if (f.size > MAX_FILE_BYTES) return `${f.name} is over 25 MB.`;
  return null;
}

export function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Storage-safe file name: letters, digits, dot, dash, underscore. */
export function safeFileName(name: string) {
  return name.normalize("NFKD").replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").slice(-120) || "file";
}

/** Escape % and _ for a Postgres ILIKE pattern. */
export const escapeLike = (q: string) => q.replace(/[\\%_]/g, (c) => "\\" + c);

/** Channel names: lowercase letters, digits and dashes. */
export function slugChannel(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

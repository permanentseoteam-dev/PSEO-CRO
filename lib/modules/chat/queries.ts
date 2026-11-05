import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { congratsMessage, dubai, toMessage } from "./logic";
import type { BrowseRow, ClientOption, Conversation, Message, MessageRow, Person, Reaction } from "./types";

// Reads run as the signed-in user, so RLS decides what comes back.
// clients (0108_clients: id, name) may not exist yet; then the client list is empty.

export const MESSAGE_COLS =
  "id, client_key, channel_id, author_id, parent_id, body, mentions, also_in_channel, forward, files, pinned_at, edited_at, deleted_at, ticket_key, created_at";

/** How many recent messages (with their thread replies) a conversation loads. */
const PAGE = 300;

type ChannelRow = {
  id: string;
  kind: Conversation["kind"];
  name: string | null;
  topic: string | null;
  client_id: string | null;
  admins_only: boolean;
  archived_at: string | null;
  last_message_at: string | null;
  created_by: string | null;
};

/** My conversations with members, notify setting, read position and unread counts. Archived ones only with `withArchived`. */
export async function listConversations(meId: string, { withArchived = false } = {}): Promise<Conversation[]> {
  const supabase = await createClient();
  const { data: mine } = await supabase
    .from("channel_members")
    .select("channel_id, notify, last_read_id, channel:channels(id, kind, name, topic, client_id, admins_only, archived_at, last_message_at, created_by)")
    .eq("member_id", meId);
  const rows = (mine ?? []) as unknown as { channel_id: string; notify: Conversation["notify"]; last_read_id: number; channel: ChannelRow | ChannelRow[] | null }[];
  const ids = rows.map((r) => r.channel_id);
  if (!ids.length) return [];

  const [{ data: members }, { data: unread }] = await Promise.all([
    supabase.from("channel_members").select("channel_id, member_id, role, last_read_id").in("channel_id", ids),
    supabase.rpc("chat_unread"),
  ]);
  const counts = new Map(((unread ?? []) as { channel_id: string; unread: number; mentions: number }[]).map((u) => [u.channel_id, u]));

  const out: Conversation[] = [];
  for (const r of rows) {
    const c = Array.isArray(r.channel) ? r.channel[0] : r.channel;
    if (!c || (c.archived_at && !withArchived)) continue;
    out.push({
      id: c.id,
      kind: c.kind,
      name: c.name,
      topic: c.topic,
      clientId: c.client_id,
      adminsOnly: c.admins_only,
      archivedAt: c.archived_at,
      lastMessageAt: c.last_message_at,
      createdBy: c.created_by,
      members: (members ?? [])
        .filter((m) => m.channel_id === c.id)
        .map((m) => ({ memberId: m.member_id as string, role: m.role as "member" | "admin", lastReadId: Number(m.last_read_id) })),
      notify: r.notify,
      lastReadId: Number(r.last_read_id),
      unread: counts.get(c.id)?.unread ?? 0,
      mentions: counts.get(c.id)?.mentions ?? 0,
    });
  }
  return out;
}

/** People I can see: all staff, plus client logins of my own client (members RLS). */
export async function listPeople(): Promise<Person[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("members")
    .select("id, name, title, kind, presence, client_id")
    .in("status", ["active", "invited"])
    .order("name");
  return (data ?? []).map((m) => ({ id: m.id, name: m.name, title: m.title, kind: m.kind, presence: m.presence, clientId: m.client_id }));
}

/** The latest messages of a conversation, oldest first, with their reactions. */
export async function getMessages(channelId: string): Promise<{ messages: Message[]; reactions: Reaction[] }> {
  const supabase = await createClient();
  const [{ data: msgs }, { data: rx }] = await Promise.all([
    supabase.from("messages").select(MESSAGE_COLS).eq("channel_id", channelId).order("id", { ascending: false }).limit(PAGE),
    supabase.from("message_reactions").select("message_id, member_id, emoji").eq("channel_id", channelId).order("created_at"),
  ]);
  const messages = ((msgs ?? []) as MessageRow[]).map(toMessage).reverse();
  const ids = new Set(messages.map((m) => m.id));
  const reactions = (rx ?? [])
    .map((r) => ({ messageId: Number(r.message_id), memberId: r.member_id as string, emoji: r.emoji as string }))
    .filter((r) => ids.has(r.messageId));
  return { messages, reactions };
}

/** Newest message id I can see, the starting point for reconnect catch-up. */
export async function latestMessageId(): Promise<number> {
  const supabase = await createClient();
  const { data } = await supabase.from("messages").select("id").order("id", { ascending: false }).limit(1).maybeSingle();
  return data ? Number(data.id) : 0;
}

/** Messages newer than an id across all my conversations (RLS keeps it to mine). */
export async function messagesAfter(afterId: number): Promise<Message[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("messages").select(MESSAGE_COLS).gt("id", afterId).order("id").limit(500);
  return ((data ?? []) as MessageRow[]).map(toMessage);
}

/** Public channels I have not joined, for Browse channels. */
export async function listBrowsable(): Promise<BrowseRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("chat_browse");
  return ((data ?? []) as BrowseRow[]).map((c) => ({ ...c, members: Number(c.members) }));
}

export async function listClients(): Promise<ClientOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").select("id, name").order("name");
  if (error) return [];
  return (data ?? []).map((c) => ({ id: c.id as string, name: c.name as string }));
}

/**
 * Posts the #general congratulations for title changes that asked for one (career_steps.post_congrats, 0207)
 * once their date has come, then stamps congrats_posted_at. Runs on the service client because the HR row
 * and the #general post belong to other people; each row is claimed first so two page loads can't post twice.
 * Best effort: any failure leaves the rest for the next load.
 */
export async function postCareerCongrats(): Promise<void> {
  try {
    const admin = createAdminClient();
    const today = dubai(new Date().toISOString()).day;
    const { data: due } = await admin
      .from("career_steps")
      .select("id, kind, title, created_by, member:members!career_steps_member_id_fkey(name)")
      .eq("post_congrats", true)
      .is("congrats_posted_at", null)
      .lte("on_date", today)
      .limit(20);
    if (!due?.length) return;
    const { data: general } = await admin.from("channels").select("id").eq("kind", "public").eq("name", "general").is("archived_at", null).maybeSingle();
    if (!general) return;
    for (const row of due) {
      const { data: claimed } = await admin
        .from("career_steps")
        .update({ congrats_posted_at: new Date().toISOString() })
        .eq("id", row.id)
        .is("congrats_posted_at", null)
        .select("id");
      if (!claimed?.length) continue;
      const m = row.member as unknown as { name: string } | { name: string }[] | null;
      const name = (Array.isArray(m) ? m[0]?.name : m?.name) ?? "A teammate";
      const { error } = await admin
        .from("messages")
        .insert({ channel_id: general.id, author_id: row.created_by, body: congratsMessage(name, row.kind, row.title) });
      if (error) await admin.from("career_steps").update({ congrats_posted_at: null }).eq("id", row.id);
    }
  } catch {
    // No service key (local dev) or a missing table: skip quietly.
  }
}

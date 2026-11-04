"use server";

import { z } from "zod";
import { getMe, can } from "@/lib/auth/can";
import { createClient } from "@/lib/supabase/server";
import { escapeLike, parseMentions, slugChannel, toMessage } from "@/lib/modules/chat/logic";
import { getMessages, listBrowsable, listConversations, MESSAGE_COLS, messagesAfter } from "@/lib/modules/chat/queries";
import type { MessageRow } from "@/lib/modules/chat/types";

// Chat writes go through these actions (zod -> can() -> Supabase as the user; RLS is the real guard).
// No revalidatePath: the chat screen keeps its own state and gets changes over Realtime.

const NO_ACCESS = { ok: false as const, error: "You don't have access to do that." };
const BAD_INPUT = { ok: false as const, error: "Check the form and try again." };

async function session() {
  const me = await getMe();
  if (!me || !can(me, "chat.use")) return null;
  return { me, supabase: await createClient() };
}

const id = z.string().uuid();
const msgId = z.number().int().positive();
const fileRef = z.object({ path: z.string().min(3).max(400), name: z.string().min(1).max(200), mime: z.string().max(200), size: z.number().int().nonnegative() });

async function channelPeople(supabase: Awaited<ReturnType<typeof createClient>>, channelId: string) {
  const { data } = await supabase.from("channel_members").select("member_id, member:members(name)").eq("channel_id", channelId);
  return (data ?? []).map((r) => {
    const m = r.member as unknown as { name: string } | { name: string }[] | null;
    return { id: r.member_id as string, name: (Array.isArray(m) ? m[0]?.name : m?.name) ?? "" };
  });
}

// ---------------------------------------------------------------- reads used by the live screen

export async function loadConversation(raw: unknown) {
  const p = id.safeParse(raw);
  if (!p.success) return BAD_INPUT;
  const s = await session();
  if (!s) return NO_ACCESS;
  return { ok: true as const, ...(await getMessages(p.data)) };
}

export async function refreshConversations() {
  const s = await session();
  if (!s) return NO_ACCESS;
  return { ok: true as const, conversations: await listConversations(s.me.id) };
}

/** Reconnect catch-up and the 12s poll: new messages after an id, plus fresh sidebar counts. */
export async function catchUp(raw: unknown) {
  const p = z.number().int().nonnegative().safeParse(raw);
  if (!p.success) return BAD_INPUT;
  const s = await session();
  if (!s) return NO_ACCESS;
  const [messages, conversations] = await Promise.all([messagesAfter(p.data), listConversations(s.me.id)]);
  return { ok: true as const, messages, conversations };
}

export async function browseChannels() {
  const s = await session();
  if (!s || s.me.kind !== "staff") return NO_ACCESS;
  return { ok: true as const, rows: await listBrowsable() };
}

const SearchInput = z.object({ q: z.string().trim().min(2).max(100), channelId: id.nullable() });

export async function searchMessages(raw: unknown) {
  const p = SearchInput.safeParse(raw);
  if (!p.success) return BAD_INPUT;
  const s = await session();
  if (!s) return NO_ACCESS;
  let q = s.supabase
    .from("messages")
    .select(MESSAGE_COLS)
    .is("deleted_at", null)
    .ilike("search_text", `%${escapeLike(p.data.q.toLowerCase())}%`)
    .order("id", { ascending: false })
    .limit(50);
  if (p.data.channelId) q = q.eq("channel_id", p.data.channelId);
  const { data, error } = await q;
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, messages: ((data ?? []) as MessageRow[]).map(toMessage) };
}

// ---------------------------------------------------------------- messages

const SendInput = z.object({
  channelId: id,
  clientKey: z.string().uuid(),
  body: z.string().max(8000),
  parentId: msgId.nullable(),
  alsoInChannel: z.boolean(),
  files: z.array(fileRef).max(10),
});

export async function sendMessage(raw: unknown) {
  const p = SendInput.safeParse(raw);
  if (!p.success) return BAD_INPUT;
  const { channelId, clientKey, parentId, alsoInChannel, files } = p.data;
  const body = p.data.body.trim();
  if (!body && !files.length) return { ok: false as const, error: "Write a message or attach a file." };
  if (files.some((f) => !f.path.startsWith(channelId + "/"))) return BAD_INPUT;
  const s = await session();
  if (!s) return NO_ACCESS;

  const mentions = body ? parseMentions(body, await channelPeople(s.supabase, channelId)) : [];
  const { data, error } = await s.supabase
    .from("messages")
    .insert({
      channel_id: channelId,
      client_key: clientKey,
      author_id: s.me.id,
      parent_id: parentId,
      also_in_channel: parentId != null && alsoInChannel,
      body,
      mentions,
      files,
    })
    .select(MESSAGE_COLS)
    .single();
  if (error) {
    // A retry after the first insert landed: return the stored copy.
    if (error.code === "23505") {
      const { data: existing } = await s.supabase.from("messages").select(MESSAGE_COLS).eq("client_key", clientKey).maybeSingle();
      if (existing) return { ok: true as const, message: toMessage(existing as MessageRow) };
    }
    return { ok: false as const, error: error.code === "42501" ? "You can't post in this conversation." : error.message };
  }
  return { ok: true as const, message: toMessage(data as MessageRow) };
}

const EditInput = z.object({ id: msgId, body: z.string().trim().min(1).max(8000) });

export async function editMessage(raw: unknown) {
  const p = EditInput.safeParse(raw);
  if (!p.success) return BAD_INPUT;
  const s = await session();
  if (!s) return NO_ACCESS;
  const { data: cur } = await s.supabase.from("messages").select("channel_id, author_id").eq("id", p.data.id).maybeSingle();
  if (!cur || cur.author_id !== s.me.id) return { ok: false as const, error: "You can only edit your own messages." };
  const mentions = parseMentions(p.data.body, await channelPeople(s.supabase, cur.channel_id));
  const { data, error } = await s.supabase
    .from("messages")
    .update({ body: p.data.body, mentions })
    .eq("id", p.data.id)
    .select(MESSAGE_COLS)
    .single();
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, message: toMessage(data as MessageRow) };
}

export async function deleteMessage(raw: unknown) {
  const p = msgId.safeParse(raw);
  if (!p.success) return BAD_INPUT;
  const s = await session();
  if (!s) return NO_ACCESS;
  const { data: cur } = await s.supabase.from("messages").select("files").eq("id", p.data).maybeSingle();
  const { data, error } = await s.supabase
    .from("messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", p.data)
    .select(MESSAGE_COLS)
    .single();
  if (error) return { ok: false as const, error: error.code === "42501" ? "Only the author or a moderator can delete this." : error.message };
  const paths = ((cur?.files ?? []) as { path: string }[]).map((f) => f.path);
  if (paths.length) await s.supabase.storage.from("chat-files").remove(paths); // owner-only; others' files stay
  return { ok: true as const, message: toMessage(data as MessageRow) };
}

export async function setPinned(raw: unknown) {
  const p = z.object({ id: msgId, pinned: z.boolean() }).safeParse(raw);
  if (!p.success) return BAD_INPUT;
  const s = await session();
  if (!s) return NO_ACCESS;
  const { data, error } = await s.supabase
    .from("messages")
    .update(p.data.pinned ? { pinned_at: new Date().toISOString(), pinned_by: s.me.id } : { pinned_at: null, pinned_by: null })
    .eq("id", p.data.id)
    .select(MESSAGE_COLS)
    .single();
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, message: toMessage(data as MessageRow) };
}

const ReactInput = z.object({ messageId: msgId, channelId: id, emoji: z.string().min(1).max(16), on: z.boolean() });

export async function setReaction(raw: unknown) {
  const p = ReactInput.safeParse(raw);
  if (!p.success) return BAD_INPUT;
  const s = await session();
  if (!s) return NO_ACCESS;
  const { messageId, channelId, emoji, on } = p.data;
  const { error } = on
    ? await s.supabase.from("message_reactions").upsert(
        { message_id: messageId, member_id: s.me.id, emoji, channel_id: channelId },
        { onConflict: "message_id,member_id,emoji", ignoreDuplicates: true },
      )
    : await s.supabase.from("message_reactions").delete().match({ message_id: messageId, member_id: s.me.id, emoji });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

const ForwardInput = z.object({ messageId: msgId, targetIds: z.array(id).min(1).max(10), note: z.string().trim().max(2000) });

export async function forwardMessage(raw: unknown) {
  const p = ForwardInput.safeParse(raw);
  if (!p.success) return BAD_INPUT;
  const s = await session();
  if (!s) return NO_ACCESS;
  const { data: src } = await s.supabase
    .from("messages")
    .select("body, deleted_at, author:members!messages_author_id_fkey(name), channel:channels(kind, name)")
    .eq("id", p.data.messageId)
    .maybeSingle();
  if (!src || src.deleted_at) return { ok: false as const, error: "That message is no longer available." };
  const one = <T,>(v: T | T[] | null) => (Array.isArray(v) ? v[0] : v);
  const author = one(src.author as unknown as { name: string } | null);
  const ch = one(src.channel as unknown as { kind: string; name: string | null } | null);
  const forward = {
    by: author?.name ?? "Someone",
    ch: ch && ch.kind !== "dm" && ch.kind !== "group" ? "#" + ch.name : "a direct message",
    text: src.body,
  };
  const { error } = await s.supabase.from("messages").insert(
    p.data.targetIds.map((channelId) => ({ channel_id: channelId, author_id: s.me.id, body: p.data.note, forward })),
  );
  if (error) return { ok: false as const, error: error.code === "42501" ? "You can't post in one of those conversations." : error.message };
  return { ok: true as const };
}

/** For the Tickets module: record the ticket created from a message so the message links to it. */
export async function linkTicket(raw: unknown) {
  const p = z.object({ messageId: msgId, ticketKey: z.string().regex(/^[A-Z]{2,8}-\d+$/) }).safeParse(raw);
  if (!p.success) return BAD_INPUT;
  const s = await session();
  if (!s) return NO_ACCESS;
  const { error } = await s.supabase.from("messages").update({ ticket_key: p.data.ticketKey }).eq("id", p.data.messageId);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

// ---------------------------------------------------------------- membership and settings

export async function markRead(raw: unknown) {
  const p = z.object({ channelId: id, lastId: msgId }).safeParse(raw);
  if (!p.success) return BAD_INPUT;
  const s = await session();
  if (!s) return NO_ACCESS;
  const { error } = await s.supabase
    .from("channel_members")
    .update({ last_read_id: p.data.lastId })
    .eq("channel_id", p.data.channelId)
    .eq("member_id", s.me.id)
    .lt("last_read_id", p.data.lastId);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function setNotify(raw: unknown) {
  const p = z.object({ channelId: id, notify: z.enum(["all", "mentions", "mute"]) }).safeParse(raw);
  if (!p.success) return BAD_INPUT;
  const s = await session();
  if (!s) return NO_ACCESS;
  const { error } = await s.supabase
    .from("channel_members")
    .update({ notify: p.data.notify })
    .eq("channel_id", p.data.channelId)
    .eq("member_id", s.me.id);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

const ChannelInput = z.object({
  kind: z.enum(["public", "private", "client"]),
  name: z.string().trim().min(1).max(80),
  topic: z.string().trim().max(250),
  clientId: id.nullable(),
  adminsOnly: z.boolean(),
  memberIds: z.array(id).max(200),
});

export async function createChannel(raw: unknown) {
  const p = ChannelInput.safeParse(raw);
  if (!p.success) return BAD_INPUT;
  const s = await session();
  if (!s || s.me.kind !== "staff") return NO_ACCESS;
  const name = slugChannel(p.data.name);
  if (!name) return { ok: false as const, error: "Use letters, numbers or dashes for the name." };
  if (p.data.kind === "client" && !p.data.clientId) return { ok: false as const, error: "Pick the client for this channel." };

  const channelId = crypto.randomUUID();
  const { error } = await s.supabase.from("channels").insert({
    id: channelId,
    kind: p.data.kind,
    name,
    topic: p.data.topic || null,
    client_id: p.data.kind === "client" ? p.data.clientId : null,
    admins_only: p.data.adminsOnly,
    created_by: s.me.id,
  });
  if (error) return { ok: false as const, error: error.code === "23505" ? `#${name} already exists.` : error.message };

  // Client channels include that client's portal logins.
  let clientLogins: string[] = [];
  if (p.data.kind === "client") {
    const { data } = await s.supabase.from("members").select("id").eq("kind", "client").eq("client_id", p.data.clientId!).in("status", ["active", "invited"]);
    clientLogins = (data ?? []).map((m) => m.id as string);
  }
  const ids = [...new Set([...p.data.memberIds, ...clientLogins])].filter((m) => m !== s.me.id);
  const { error: mErr } = await s.supabase.from("channel_members").insert([
    { channel_id: channelId, member_id: s.me.id, role: "admin" },
    ...ids.map((m) => ({ channel_id: channelId, member_id: m, role: "member" })),
  ]);
  if (mErr) return { ok: false as const, error: mErr.message };
  return { ok: true as const, id: channelId };
}

const StartInput = z.object({ memberIds: z.array(id).min(1).max(8), text: z.string().trim().max(8000) });

/** New DM (1 person, reuses an existing one) or group (2 to 8 people), with an optional first message. */
export async function startConversation(raw: unknown) {
  const p = StartInput.safeParse(raw);
  if (!p.success) return { ok: false as const, error: "Pick 1 person for a direct message, or up to 8 for a group." };
  const s = await session();
  if (!s || s.me.kind !== "staff") return NO_ACCESS;
  const others = [...new Set(p.data.memberIds)].filter((m) => m !== s.me.id);
  if (!others.length) return BAD_INPUT;

  let channelId: string | null = null;
  if (others.length === 1) {
    const { data: mine } = await s.supabase.from("channel_members").select("channel_id, channel:channels!inner(kind)").eq("member_id", s.me.id).eq("channel.kind", "dm");
    const dmIds = (mine ?? []).map((r) => r.channel_id as string);
    if (dmIds.length) {
      const { data: hit } = await s.supabase.from("channel_members").select("channel_id").in("channel_id", dmIds).eq("member_id", others[0]).limit(1).maybeSingle();
      channelId = (hit?.channel_id as string | undefined) ?? null;
    }
  }
  if (!channelId) {
    channelId = crypto.randomUUID();
    const { error } = await s.supabase.from("channels").insert({ id: channelId, kind: others.length === 1 ? "dm" : "group", created_by: s.me.id });
    if (error) return { ok: false as const, error: error.message };
    const { error: mErr } = await s.supabase.from("channel_members").insert([
      { channel_id: channelId, member_id: s.me.id, role: "admin" },
      ...others.map((m) => ({ channel_id: channelId, member_id: m, role: "member" })),
    ]);
    if (mErr) return { ok: false as const, error: mErr.message };
  }
  if (p.data.text) {
    const mentions = parseMentions(p.data.text, await channelPeople(s.supabase, channelId));
    const { error } = await s.supabase.from("messages").insert({ channel_id: channelId, author_id: s.me.id, body: p.data.text, mentions });
    if (error) return { ok: false as const, error: error.message };
  }
  return { ok: true as const, id: channelId };
}

export async function joinChannel(raw: unknown) {
  const p = id.safeParse(raw);
  if (!p.success) return BAD_INPUT;
  const s = await session();
  if (!s || s.me.kind !== "staff") return NO_ACCESS;
  const { error } = await s.supabase.from("channel_members").upsert(
    { channel_id: p.data, member_id: s.me.id, role: "member" },
    { onConflict: "channel_id,member_id", ignoreDuplicates: true },
  );
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function leaveChannel(raw: unknown) {
  const p = id.safeParse(raw);
  if (!p.success) return BAD_INPUT;
  const s = await session();
  if (!s) return NO_ACCESS;
  const { error } = await s.supabase.from("channel_members").delete().eq("channel_id", p.data).eq("member_id", s.me.id);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

const UpdateInput = z.object({ channelId: id, topic: z.string().trim().max(250), adminsOnly: z.boolean() });

export async function updateChannel(raw: unknown) {
  const p = UpdateInput.safeParse(raw);
  if (!p.success) return BAD_INPUT;
  const s = await session();
  if (!s) return NO_ACCESS;
  const { data, error } = await s.supabase
    .from("channels")
    .update({ topic: p.data.topic || null, admins_only: p.data.adminsOnly })
    .eq("id", p.data.channelId)
    .select("id");
  if (error) return { ok: false as const, error: error.message };
  if (!data?.length) return { ok: false as const, error: "Only the conversation's admins can change its settings." };
  return { ok: true as const };
}

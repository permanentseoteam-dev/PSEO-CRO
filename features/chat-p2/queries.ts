import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ChannelP2, Huddle, Person } from "./types";

// Reads run as the signed-in user, so RLS decides what comes back. Errors (e.g. a missing Phase 1 table) read as empty.
// Phase 1 names (0105_chat): channels(id, kind, name, topic, client_id, admins_only, archived_at),
// channel_members(channel_id, member_id, role), rpc is_chat_admin(cid). members(id, name, kind) is 0001_core.

export type ChannelExtras = {
  channel: ChannelP2;
  isAdmin: boolean;
  huddle: Huddle | null;
  /** Staff in the conversation, for meeting attendees. */
  staff: Person[];
};

export async function getChannelExtras(channelId: string): Promise<ChannelExtras | null> {
  const supabase = await createClient();
  const { data: c } = await supabase
    .from("channels")
    .select("id, kind, name, topic, client_id, admins_only, archived_at")
    .eq("id", channelId)
    .maybeSingle();
  if (!c) return null;

  const [{ data: isAdmin }, { data: h }, { data: people }] = await Promise.all([
    supabase.rpc("is_chat_admin", { cid: channelId }),
    supabase
      .from("huddles")
      .select("id, channel_id, media, started_by, started_at, huddle_participants(member_id, left_at, members(name))")
      .eq("channel_id", channelId)
      .is("ended_at", null)
      .maybeSingle(),
    supabase.from("channel_members").select("member_id, members(name, kind)").eq("channel_id", channelId),
  ]);

  type Joined = { name: string; kind?: string } | { name: string; kind?: string }[] | null;
  const one = (m: Joined) => (Array.isArray(m) ? m[0] : m);

  const huddle: Huddle | null = h
    ? {
        id: h.id,
        channelId: h.channel_id,
        media: h.media,
        startedBy: h.started_by,
        startedAt: h.started_at,
        participants: ((h.huddle_participants ?? []) as { member_id: string; left_at: string | null; members: Joined }[])
          .filter((p) => !p.left_at)
          .map((p) => ({ memberId: p.member_id, name: one(p.members)?.name ?? "Someone" })),
      }
    : null;

  const staff = ((people ?? []) as { member_id: string; members: Joined }[])
    .filter((p) => one(p.members)?.kind === "staff")
    .map((p) => ({ id: p.member_id, name: one(p.members)?.name ?? "" }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    channel: {
      id: c.id,
      kind: c.kind,
      name: c.name,
      topic: c.topic,
      clientId: c.client_id,
      adminsOnly: c.admins_only,
      archivedAt: c.archived_at,
    },
    isAdmin: Boolean(isAdmin),
    huddle,
    staff,
  };
}

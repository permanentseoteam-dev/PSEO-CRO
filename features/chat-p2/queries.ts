import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ChannelP2, Huddle, ImportDays, Person, SlackSetup } from "./types";

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

/** Slack workspace, channel map, last import job and the portal channels to map to. RLS: chat.slack.manage (all). */
export async function getSlackSetup(): Promise<SlackSetup> {
  const supabase = await createClient();
  const [{ data: ws }, { data: channels }] = await Promise.all([
    supabase
      .from("slack_workspaces")
      .select("id, workspace, status, bridge, import_days, last_sync_at, imported_count")
      .order("created_at")
      .limit(1)
      .maybeSingle(),
    supabase.from("channels").select("id, name").in("kind", ["public", "private", "client"]).is("archived_at", null).order("name"),
  ]);
  const portal = ((channels ?? []) as { id: string; name: string | null }[]).map((c) => ({ id: c.id, name: c.name ?? "" }));
  if (!ws) return { workspace: null, links: [], lastJob: null, channels: portal };

  const [{ data: links }, { data: job }] = await Promise.all([
    supabase.from("slack_channel_links").select("id, slack_channel, channel_id, bridge").eq("workspace_id", ws.id).order("slack_channel"),
    supabase
      .from("slack_import_jobs")
      .select("id, days, status, imported_count, total_estimate, created_at")
      .eq("workspace_id", ws.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    workspace: {
      id: ws.id,
      workspace: ws.workspace,
      status: ws.status,
      bridge: ws.bridge,
      importDays: ws.import_days as ImportDays,
      lastSyncAt: ws.last_sync_at,
      importedCount: ws.imported_count,
    },
    links: (links ?? []).map((l) => ({ id: l.id, slackChannel: l.slack_channel, channelId: l.channel_id, bridge: l.bridge })),
    lastJob: job
      ? {
          id: job.id,
          days: job.days as ImportDays,
          status: job.status,
          importedCount: job.imported_count,
          totalEstimate: job.total_estimate,
          createdAt: job.created_at,
        }
      : null,
    channels: portal,
  };
}

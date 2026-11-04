"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { can, getMe } from "@/lib/auth/can";
import { createClient } from "@/lib/supabase/server";
import { getSlackAdapter } from "./adapters";
import { MAX_HUDDLE_PEOPLE, MAX_VOICE_SECONDS, MEETING_MINUTES, canArchive, canSetAdminsOnly, duplicateTargets, meetingMessage } from "./logic";
import { BRIDGE_STATES, IMPORT_DAYS, type Result } from "./types";

// Every action: zod parse -> can() check -> Supabase write (RLS is the real guard) -> revalidate.
const bad = { ok: false as const, error: "Check the form and try again." };
const no = { ok: false as const, error: "You don't have access to do that." };
const id = z.uuid();
const chatPage = () => revalidatePath("/chat");

async function chatter() {
  const me = await getMe();
  return me && can(me, "chat.use") ? me : null;
}

type DB = Awaited<ReturnType<typeof createClient>>;

/** System-style note in the conversation. Best effort: an admins-only channel may refuse it. */
async function postNote(supabase: DB, channelId: string, authorId: string, body: string) {
  await supabase.from("messages").insert({ channel_id: channelId, author_id: authorId, body });
}

// ---------------------------------------------------------------- voice notes
const Voice = z.object({
  channelId: id,
  clientKey: id,
  path: z.string().min(3).max(300),
  name: z.string().min(1).max(120),
  mime: z.string().regex(/^audio\//),
  size: z.number().int().positive().max(25 * 1024 * 1024),
  duration: z.number().min(0.5).max(MAX_VOICE_SECONDS + 1),
  peaks: z.array(z.number().min(0).max(1)).max(64),
});

/** The browser uploads the audio to chat-files first, then this posts the message that carries it. */
export async function sendVoiceNote(raw: unknown): Promise<Result> {
  const input = Voice.safeParse(raw);
  if (!input.success || !input.data.path.startsWith(`${input.data.channelId}/`)) return bad;
  const me = await chatter();
  if (!me) return no;
  const v = input.data;
  const supabase = await createClient();
  const { error } = await supabase.from("messages").insert({
    channel_id: v.channelId,
    author_id: me.id,
    client_key: v.clientKey,
    body: "",
    files: [{ path: v.path, name: v.name, mime: v.mime, size: v.size, duration: Math.round(v.duration * 10) / 10, peaks: v.peaks }],
  });
  if (error) return { ok: false, error: error.code === "42501" ? "You can't post in this conversation." : error.message };
  chatPage();
  return { ok: true };
}

// ---------------------------------------------------------------- huddles
const Start = z.object({ channelId: id, media: z.enum(["audio", "video"]) });

/** Start a huddle (or join the live one) in a conversation. Returns the huddle id. */
export async function startHuddle(raw: unknown): Promise<Result<{ huddleId: string }>> {
  const input = Start.safeParse(raw);
  if (!input.success) return bad;
  const me = await chatter();
  if (!me) return no;
  const supabase = await createClient();
  const { channelId, media } = input.data;

  let huddleId: string | null = null;
  const { data: made, error } = await supabase
    .from("huddles")
    .insert({ channel_id: channelId, media, started_by: me.id })
    .select("id")
    .maybeSingle();
  if (made) {
    huddleId = made.id;
    await postNote(supabase, channelId, me.id, `${me.name} started a ${media === "video" ? "video " : ""}huddle.`);
  } else if (error?.code === "23505") {
    const { data: live } = await supabase.from("huddles").select("id").eq("channel_id", channelId).is("ended_at", null).maybeSingle();
    huddleId = live?.id ?? null;
  } else if (error) {
    return { ok: false, error: error.code === "42501" ? "You can't start a huddle here." : error.message };
  }
  if (!huddleId) return { ok: false, error: "Couldn't start the huddle. Try again." };

  const joined = await joinHuddle({ huddleId });
  if (!joined.ok) return joined;
  chatPage();
  return { ok: true, data: { huddleId } };
}

export async function joinHuddle(raw: unknown): Promise<Result> {
  const input = z.object({ huddleId: id }).safeParse(raw);
  if (!input.success) return bad;
  const me = await chatter();
  if (!me) return no;
  const supabase = await createClient();
  const { count } = await supabase
    .from("huddle_participants")
    .select("member_id", { count: "exact", head: true })
    .eq("huddle_id", input.data.huddleId)
    .is("left_at", null)
    .neq("member_id", me.id);
  if ((count ?? 0) >= MAX_HUDDLE_PEOPLE) return { ok: false, error: `Huddles hold up to ${MAX_HUDDLE_PEOPLE} people.` };
  const { error } = await supabase
    .from("huddle_participants")
    .upsert({ huddle_id: input.data.huddleId, member_id: me.id, joined_at: new Date().toISOString(), left_at: null });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/** Leave; the last person out ends the huddle. */
export async function leaveHuddle(raw: unknown): Promise<Result> {
  const input = z.object({ huddleId: id }).safeParse(raw);
  if (!input.success) return bad;
  const me = await chatter();
  if (!me) return no;
  const supabase = await createClient();
  const now = new Date().toISOString();
  await supabase.from("huddle_participants").update({ left_at: now }).eq("huddle_id", input.data.huddleId).eq("member_id", me.id);
  const { count } = await supabase
    .from("huddle_participants")
    .select("member_id", { count: "exact", head: true })
    .eq("huddle_id", input.data.huddleId)
    .is("left_at", null);
  if ((count ?? 0) === 0) await supabase.from("huddles").update({ ended_at: now }).eq("id", input.data.huddleId).is("ended_at", null);
  chatPage();
  return { ok: true };
}

// ---------------------------------------------------------------- schedule meeting
const Meeting = z.object({
  channelId: id,
  title: z.string().trim().min(1).max(200),
  /** Start as an ISO instant, built in the browser from the local date and time. */
  startsAt: z.iso.datetime({ offset: true }),
  /** Display text for the channel note, e.g. "Thu 5 Nov at 15:00". */
  when: z.string().max(60),
  minutes: z.coerce.number().refine((m) => (MEETING_MINUTES as readonly number[]).includes(m)),
  attendees: z.array(id).max(50),
});

/** Calendar event (0104_calendar) with the chosen channel members, plus a note in the conversation. */
export async function scheduleChannelMeeting(raw: unknown): Promise<Result> {
  const input = Meeting.safeParse(raw);
  if (!input.success) return bad;
  const me = await getMe();
  if (!me || me.kind !== "staff" || !can(me, "calendar.use") || !can(me, "chat.use")) return no;
  const m = input.data;
  const supabase = await createClient();

  const { data: c } = await supabase.from("channels").select("kind, client_id").eq("id", m.channelId).maybeSingle();
  if (!c) return no;
  const isClient = c.kind === "client" && c.client_id;

  const { data: ev, error } = await supabase
    .from("events")
    .insert({
      title: m.title,
      kind: isClient ? "client_meeting" : "internal",
      client_id: isClient ? c.client_id : null,
      visibility: isClient ? "client" : "team",
      starts_at: m.startsAt,
      minutes: m.minutes,
      created_by: me.id,
    })
    .select("id")
    .single();
  if (error || !ev) return { ok: false, error: error?.message ?? "Couldn't create the meeting." };

  const people = [...new Set([me.id, ...m.attendees])];
  const { error: aErr } = await supabase
    .from("event_attendees")
    .insert(people.map((p) => ({ event_id: ev.id, member_id: p, rsvp: p === me.id ? "yes" : "pending" })));
  if (aErr) return { ok: false, error: aErr.message };

  await postNote(supabase, m.channelId, me.id, meetingMessage(me.name, m.title, m.when, m.minutes, m.attendees.length));
  chatPage();
  revalidatePath("/calendar");
  return { ok: true };
}

// ---------------------------------------------------------------- channel settings
const Settings = z.object({ channelId: id, adminsOnly: z.boolean() });

export async function setAdminsOnly(raw: unknown): Promise<Result> {
  const input = Settings.safeParse(raw);
  if (!input.success) return bad;
  const me = await chatter();
  if (!me) return no;
  const supabase = await createClient();
  const { data: c } = await supabase.from("channels").select("kind").eq("id", input.data.channelId).maybeSingle();
  if (!c || !canSetAdminsOnly(c.kind)) return bad;
  const { data, error } = await supabase
    .from("channels")
    .update({ admins_only: input.data.adminsOnly })
    .eq("id", input.data.channelId)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "Only conversation admins can change this." };
  chatPage();
  return { ok: true };
}

/** Archive hides the conversation for everyone and blocks new messages (0205 trigger); history stays searchable. */
export async function setArchived(raw: unknown): Promise<Result> {
  const input = z.object({ channelId: id, archived: z.boolean() }).safeParse(raw);
  if (!input.success) return bad;
  const me = await chatter();
  if (!me || me.kind !== "staff") return no;
  const supabase = await createClient();
  const { data: c } = await supabase.from("channels").select("kind").eq("id", input.data.channelId).maybeSingle();
  if (!c || !canArchive(c.kind)) return bad;
  const { data, error } = await supabase
    .from("channels")
    .update({ archived_at: input.data.archived ? new Date().toISOString() : null })
    .eq("id", input.data.channelId)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "Only conversation admins can archive it." };
  chatPage();
  return { ok: true };
}

// ---------------------------------------------------------------- Slack import and bridge
const SlackForm = z.object({
  workspace: z.string().trim().min(3).max(120).regex(/^[a-z0-9.-]+$/i),
  importDays: z.coerce.number().refine((d) => (IMPORT_DAYS as readonly number[]).includes(d)),
  bridge: z.enum(BRIDGE_STATES),
  links: z.array(z.object({ id, channelId: id.nullable() })).max(200),
});

async function slackAdmin() {
  const me = await getMe();
  return me && me.kind === "staff" && can(me, "chat.slack.manage", "all") ? me : null;
}

export async function saveSlackSetup(raw: unknown): Promise<Result> {
  const input = SlackForm.safeParse(raw);
  if (!input.success) return bad;
  if (duplicateTargets(input.data.links).length) return { ok: false, error: "Each portal channel can link to one Slack channel only." };
  const me = await slackAdmin();
  if (!me) return no;
  const supabase = await createClient();
  const s = input.data;
  const { data: ws, error } = await supabase
    .from("slack_workspaces")
    .upsert({ workspace: s.workspace.toLowerCase(), import_days: s.importDays, bridge: s.bridge }, { onConflict: "workspace" })
    .select("id")
    .single();
  if (error || !ws) return { ok: false, error: error?.message ?? "Couldn't save." };
  // Clear first so swapping two targets doesn't trip the one-link-per-channel index.
  const ids = s.links.map((l) => l.id);
  if (ids.length) {
    const { error: clr } = await supabase.from("slack_channel_links").update({ channel_id: null }).in("id", ids);
    if (clr) return { ok: false, error: clr.message };
  }
  for (const l of s.links) {
    const { error: e } = await supabase.from("slack_channel_links").update({ channel_id: l.channelId }).eq("id", l.id).eq("workspace_id", ws.id);
    if (e) return { ok: false, error: e.message };
  }
  revalidatePath("/chat");
  return { ok: true };
}

export async function setLinkBridge(raw: unknown): Promise<Result> {
  const input = z.object({ linkId: id, bridge: z.enum(BRIDGE_STATES) }).safeParse(raw);
  if (!input.success) return bad;
  if (!(await slackAdmin())) return no;
  const supabase = await createClient();
  const { error } = await supabase.from("slack_channel_links").update({ bridge: input.data.bridge }).eq("id", input.data.linkId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/chat");
  return { ok: true };
}

/** Queue an import. Until Slack is connected the job is recorded as not_configured and nothing is fetched. */
export async function startSlackImport(raw: unknown): Promise<Result<{ configured: boolean }>> {
  const input = z.object({ workspaceId: id }).safeParse(raw);
  if (!input.success) return bad;
  const me = await slackAdmin();
  if (!me) return no;
  const adapter = getSlackAdapter();
  const supabase = await createClient();
  const { data: ws } = await supabase.from("slack_workspaces").select("import_days, status").eq("id", input.data.workspaceId).maybeSingle();
  if (!ws) return bad;
  const ready = adapter.configured && ws.status === "connected";
  const { error } = await supabase.from("slack_import_jobs").insert({
    workspace_id: input.data.workspaceId,
    days: ws.import_days,
    status: ready ? "queued" : "not_configured",
    started_by: me.id,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/chat");
  return { ok: true, data: { configured: ready } };
}

export async function connectSlack(): Promise<Result<{ url: string }>> {
  if (!(await slackAdmin())) return no;
  const r = getSlackAdapter().connectUrl("/chat");
  if (r.ok) return { ok: true, data: { url: r.data } };
  return { ok: false, error: r.reason === "not_configured" ? "Slack isn't set up for this workspace yet. Ask the lead to add the Slack app." : r.message };
}

// ---------------------------------------------------------------- Web Push
const Sub = z.object({
  endpoint: z.url().startsWith("https://").max(1000),
  p256dh: z.string().min(10).max(200),
  auth: z.string().min(8).max(100),
  userAgent: z.string().max(300).optional(),
});

export async function savePushSubscription(raw: unknown): Promise<Result> {
  const input = Sub.safeParse(raw);
  if (!input.success) return bad;
  const me = await getMe();
  if (!me) return no;
  const supabase = await createClient();
  const s = input.data;
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert({ member_id: me.id, endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth, user_agent: s.userAgent ?? null }, { onConflict: "endpoint" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deletePushSubscription(raw: unknown): Promise<Result> {
  const input = z.object({ endpoint: z.url() }).safeParse(raw);
  if (!input.success) return bad;
  const me = await getMe();
  if (!me) return no;
  const supabase = await createClient();
  const { error } = await supabase.from("push_subscriptions").delete().eq("endpoint", input.data.endpoint).eq("member_id", me.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

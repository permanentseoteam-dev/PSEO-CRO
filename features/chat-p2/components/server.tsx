import { can, getMe } from "@/lib/auth/can";
import { getChannelExtras, getSlackSetup } from "../queries";
import { ChannelSettingsP2 } from "./channel-settings";
import { Huddle } from "./huddle";
import { ScheduleMeeting } from "./schedule-meeting";
import { SlackImport } from "./slack-import";

// Server entry points for the Phase 1 chat page. See ../WIRING.md.

/** Tomorrow as YYYY-MM-DD (default meeting date). */
const tomorrow = () => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

/** Huddle + Schedule meeting buttons for the conversation header. */
export async function ChatHeaderExtras({ channelId }: { channelId: string }) {
  const me = await getMe();
  if (!me || !can(me, "chat.use")) return null;
  const x = await getChannelExtras(channelId);
  if (!x) return null;
  const archived = Boolean(x.channel.archivedAt);
  const mayPost = !archived && (!x.channel.adminsOnly || x.isAdmin);
  return (
    <>
      <Huddle channelId={channelId} me={{ id: me.id, name: me.name }} huddle={archived ? null : x.huddle} canStart={mayPost} />
      {me.kind === "staff" && can(me, "calendar.use") && !archived ? (
        <ScheduleMeeting channelId={channelId} meId={me.id} people={x.staff} defaultDate={tomorrow()} />
      ) : null}
    </>
  );
}

/** Admin-only rows (only admins can post, archive) for the conversation settings dialog. */
export async function ChannelSettingsExtras({ channelId }: { channelId: string }) {
  const me = await getMe();
  if (!me || me.kind !== "staff" || !can(me, "chat.use")) return null;
  const x = await getChannelExtras(channelId);
  if (!x) return null;
  return <ChannelSettingsP2 channel={x.channel} isAdmin={x.isAdmin} />;
}

/** "Slack import" button for the chat sidebar. Hidden without chat.slack.manage (all). */
export async function SlackImportButton() {
  const me = await getMe();
  if (!me || me.kind !== "staff" || !can(me, "chat.slack.manage", "all")) return null;
  return <SlackImport setup={await getSlackSetup()} />;
}

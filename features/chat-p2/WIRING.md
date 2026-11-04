# chat-p2 wiring

Phase 2 chat extras: voice notes, huddles, schedule meeting from a channel, channel settings (admins-only, archive), Slack import and bridge, Web Push. Everything lives in `features/chat-p2/`. Nothing here is mounted yet. These steps connect it to the Phase 1 chat module (`app/(app)/chat`, `components/chat`, `0105_chat`).

## Database
- Migration `supabase/migrations/0205_chat_p2.sql` runs after `0105_chat`. It needs these from 0105:
  - tables `channels` and `messages`
  - functions `is_chat_member`, `is_chat_member_path` and `can_post_chat`
  - Storage bucket `chat-files`
- New tables:
  - `huddles`
  - `huddle_participants`
  - `push_subscriptions`
  - `slack_workspaces`
  - `slack_channel_links`
  - `slack_import_jobs`
- Also adds:
  - the helper `can_see_huddle(uuid)`
  - the trigger `messages_block_archived`, which blocks new messages in archived conversations
  - two RLS policies on `realtime.messages` that admit conversation members to private topics `huddle:<channel_id>`
- None of these tables join the realtime publication. Huddle signalling uses Broadcast and Presence only.
- Seed `supabase/seed/0205_chat_p2.sql` adds:
  - the permission `chat.slack.manage`, granted to `admin` at scope `all`
  - one finished huddle in `seo-team`
  - the Slack workspace `brandsurge.slack.com` (not connected) with 4 channel links

## Conversation header (`app/(app)/chat`, Phase 1 conversation header)
- `import { ChatHeaderExtras } from "@/features/chat-p2/components/server";`
- Render `<ChatHeaderExtras channelId={id} />` in the header actions, in place of the mockup's "Huddle (phase 2)" button and the calendar icon. It is a server component. It shows:
  - **Huddle**: "Huddle" opens a choice of audio or video. When a huddle is live it shows "Join huddle N" instead. The call panel is fixed at the bottom right and fits a 390px screen.
  - **Schedule meeting**: a calendar icon that opens a dialog. It inserts into `events` and `event_attendees` (0104) and posts a note in the conversation. It shows only for staff with `calendar.use`.
- If the header is a client component, render `ChatHeaderExtras` in the server page and pass it in as a `ReactNode` prop or slot.

## Composer (Phase 1 composer, mockup mic button)
- `import { VoiceRecorder } from "@/features/chat-p2/components/voice-recorder";` and render `<VoiceRecorder channelId={id} disabled={!canPost} />` next to the attach button.
- It records up to 5 minutes, uploads to `chat-files/<channel_id>/<uuid>-voice-note.<ext>`, then calls `sendVoiceNote`, which inserts a `messages` row with `files[0] = {path, name, mime, size, duration, peaks}` and `client_key` = the uuid. The realtime echo then shows it like any other message.

## Message attachments (Phase 1 message renderer)
- `import { VoiceNote } from "@/features/chat-p2/components/voice-note";`
- For a `files` item where `mime` starts with `audio/`, render `<VoiceNote file={f} />` instead of the plain file row. Items without `duration` or `peaks` (ordinary uploaded audio) still play.

## Conversation settings dialog (Phase 1, mockup "chat-settings")
- `import { ChannelSettingsExtras } from "@/features/chat-p2/components/server";` (server). Or, from a client dialog, use `ChannelSettingsP2` from `components/channel-settings.tsx` with `channel` and `isAdmin` from `getChannelExtras(channelId)` in `features/chat-p2/queries.ts`.
- It replaces the dialog's "Only admins can post" checkbox and the "Archive this conversation" row. Both save at once and only admins see them.
- The Phase 1 sidebar should hide channels with `archived_at` set. History stays in search.
- The composer should be disabled when `archived_at` is set, because the database now rejects those inserts.

## Chat sidebar (mockup "Slack import" button)
- `import { SlackImportButton } from "@/features/chat-p2/components/server";` and render `<SlackImportButton />` in the sidebar footer or toolbar. It renders nothing unless the user has `chat.slack.manage` at scope `all`.
- The adapter is `features/chat-p2/adapters.ts` (`SlackAdapter`, `notConfiguredSlack`):
  - "Connect Slack" returns a "not set up" message.
  - "Start import" records a `slack_import_jobs` row with status `not_configured`.
  - To go live, implement `SlackAdapter` and return it from `getSlackAdapter()`.

## Web Push
1. Copy `features/chat-p2/sw/push-sw.js` to `public/push-sw.js`. Keep the same name, because `PUSH_SW_URL` is `/push-sw.js`.
2. Settings: render `<PushToggle />` from `features/chat-p2/components/push-toggle.tsx` in Settings → Notifications, next to the Phase 1 quiet-hours fields (`user_settings.quiet_from` and `quiet_to`). Optionally also use it for the Home "push-notification nudge".
3. Edge Function: move `features/chat-p2/edge/notify-push/index.ts` to `supabase/functions/notify-push/index.ts`. Then add a Database Webhook (Supabase dashboard → Database → Webhooks) on INSERT into `public.notifications` → `notify-push`, with header `x-webhook-secret: <NOTIFY_PUSH_SECRET>`.
4. Settings it needs before anything is sent. Until then the toggle shows "Browser notifications aren't set up yet" and the function answers `push not configured`:
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` for the app
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `NOTIFY_PUSH_SECRET` as function secrets
   - optionally `PORTAL_TIME_ZONE` (default `Asia/Dubai`)
   - a real `PushSender`

## Client portal
- `/portal/messages` can reuse `ChatHeaderExtras` for huddles, which works for client logins in their own client channel. It can also reuse `VoiceRecorder` and `VoiceNote`. Schedule meeting, settings and Slack hide themselves for client logins.

## Nav
- No new routes or nav entries. Everything mounts inside `/chat`, `/portal/messages` and `/settings`.

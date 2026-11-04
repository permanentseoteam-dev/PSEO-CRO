-- 0205_chat_p2 seed: one finished huddle, the Slack workspace (not connected) with the mockup's channel map,
-- and the chat.slack.manage permission. Push subscriptions are per device, so none are seeded.
-- Fixed ids: huddles e5200000-0000-4000-8000-0000000000NN, Slack rows e5210000-0000-4000-8000-0000000000NN.
-- Channels come from the 0105_chat seed (e5000000-...-01 general, 02 seo-team, 03 ppc-team, 05 alba-motors).

insert into public.permissions (key, area, label) values
  ('chat.slack.manage', 'Core', 'Manage the Slack import and bridge')
on conflict do nothing;
insert into public.role_permissions (role, perm_key, scope) values
  ('admin', 'chat.slack.manage', 'all')
on conflict do nothing;

-- Yesterday's SEO stand-up huddle: Omar started it, Sara and Priya joined.
insert into public.huddles (id, channel_id, media, started_by, started_at, ended_at) values
  ('e5200000-0000-4000-8000-000000000001', 'e5000000-0000-4000-8000-000000000002', 'audio',
   '00000000-0000-4000-8000-000000000002', '2026-11-03 09:30:00+04', '2026-11-03 09:48:00+04')
on conflict (id) do nothing;
insert into public.huddle_participants (huddle_id, member_id, joined_at, left_at) values
  ('e5200000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '2026-11-03 09:30:00+04', '2026-11-03 09:48:00+04'),
  ('e5200000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '2026-11-03 09:31:00+04', '2026-11-03 09:48:00+04'),
  ('e5200000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005', '2026-11-03 09:33:00+04', '2026-11-03 09:45:00+04')
on conflict do nothing;

insert into public.slack_workspaces (id, workspace, status, bridge, import_days) values
  ('e5210000-0000-4000-8000-000000000001', 'brandsurge.slack.com', 'not_connected', 'paused', 90)
on conflict (id) do nothing;

insert into public.slack_channel_links (id, workspace_id, slack_channel, channel_id, bridge) values
  ('e5210000-0000-4000-8000-000000000011', 'e5210000-0000-4000-8000-000000000001', '#general',     'e5000000-0000-4000-8000-000000000001', 'running'),
  ('e5210000-0000-4000-8000-000000000012', 'e5210000-0000-4000-8000-000000000001', '#seo',         'e5000000-0000-4000-8000-000000000002', 'running'),
  ('e5210000-0000-4000-8000-000000000013', 'e5210000-0000-4000-8000-000000000001', '#paid-media',  'e5000000-0000-4000-8000-000000000003', 'paused'),
  ('e5210000-0000-4000-8000-000000000014', 'e5210000-0000-4000-8000-000000000001', '#client-alba', 'e5000000-0000-4000-8000-000000000005', 'running')
on conflict (id) do nothing;

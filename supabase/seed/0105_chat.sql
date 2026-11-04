-- 0105_chat seed: conversations and messages from the chat mockup, as seen by Sara Malik on 2026-11-04.
-- Fixed ids: channels e5000000-0000-4000-8000-0000000000NN (01 general, 02 seo-team, 03 ppc-team,
-- 04 announcements, 05 alba-motors, 06 luma-skincare, 07 cedar-pine, 08 DM Sara/Omar, 09 DM Sara/Ayesha,
-- 10 DM Sara/Daniel, 11 group Sara/Priya/Lina/Zara, 12 random, 13 design-crit, 14 wins, 15 web-dev).
-- Message ids 1..44. Client logins (Karim Nassar, created later by the clients seed) join the client
-- channels automatically through the members_chat_join trigger, so client messages are not seeded here.
-- Attachments point at Storage paths that the seed does not upload; they show but do not download.

insert into public.channels (id, kind, name, topic, client_id, admins_only, created_by) values
  ('e5000000-0000-4000-8000-000000000001', 'public',  'general',       'Agency-wide updates and questions', null, false, '00000000-0000-4000-8000-000000000010'),
  ('e5000000-0000-4000-8000-000000000002', 'public',  'seo-team',      'SEO delivery, audits and rankings', null, false, '00000000-0000-4000-8000-000000000002'),
  ('e5000000-0000-4000-8000-000000000003', 'public',  'ppc-team',      'Paid search and paid social', null, false, '00000000-0000-4000-8000-000000000003'),
  ('e5000000-0000-4000-8000-000000000004', 'public',  'announcements', 'Company news. Only admins can post.', null, true, '00000000-0000-4000-8000-000000000010'),
  ('e5000000-0000-4000-8000-000000000005', 'client',  'alba-motors',   'Shared with Alba Motors. November showroom offer.', 'c0000000-0000-4000-8000-000000000002', false, '00000000-0000-4000-8000-000000000001'),
  ('e5000000-0000-4000-8000-000000000006', 'client',  'luma-skincare', 'Shared with Luma Skincare. Launch on 20 Nov.', 'c0000000-0000-4000-8000-000000000003', false, '00000000-0000-4000-8000-000000000001'),
  ('e5000000-0000-4000-8000-000000000007', 'client',  'cedar-pine',    'Shared with Cedar & Pine Dental. Monthly SEO.', 'c0000000-0000-4000-8000-000000000001', false, '00000000-0000-4000-8000-000000000001'),
  ('e5000000-0000-4000-8000-000000000008', 'dm',      null, null, null, false, '00000000-0000-4000-8000-000000000001'),
  ('e5000000-0000-4000-8000-000000000009', 'dm',      null, null, null, false, '00000000-0000-4000-8000-000000000001'),
  ('e5000000-0000-4000-8000-000000000010', 'dm',      null, null, null, false, '00000000-0000-4000-8000-000000000004'),
  ('e5000000-0000-4000-8000-000000000011', 'group',   null, null, null, false, '00000000-0000-4000-8000-000000000007'),
  ('e5000000-0000-4000-8000-000000000012', 'public',  'random',        'Off-topic chat and team lunches', null, false, '00000000-0000-4000-8000-000000000004'),
  ('e5000000-0000-4000-8000-000000000013', 'public',  'design-crit',   'Weekly design feedback, Tuesdays', null, false, '00000000-0000-4000-8000-000000000007'),
  ('e5000000-0000-4000-8000-000000000014', 'public',  'wins',          'Client wins and kind words', null, false, '00000000-0000-4000-8000-000000000010'),
  ('e5000000-0000-4000-8000-000000000015', 'public',  'web-dev',       'Builds, deploys and staging', null, false, '00000000-0000-4000-8000-000000000004')
on conflict (id) do nothing;

-- Members: (channel nn, member nn, role)
insert into public.channel_members (channel_id, member_id, role)
select ('e5000000-0000-4000-8000-' || lpad(v.c::text, 12, '0'))::uuid,
       ('00000000-0000-4000-8000-' || lpad(v.m::text, 12, '0'))::uuid, v.r
from (values
  (1,1,'admin'),(1,2,'member'),(1,3,'member'),(1,4,'member'),(1,5,'member'),(1,6,'member'),(1,7,'member'),(1,8,'member'),(1,9,'member'),(1,10,'admin'),
  (2,2,'admin'),(2,5,'member'),(2,1,'member'),(2,10,'member'),(2,7,'member'),(2,4,'member'),
  (3,3,'admin'),(3,1,'member'),(3,8,'member'),(3,6,'member'),(3,9,'member'),
  (4,1,'admin'),(4,2,'member'),(4,3,'member'),(4,4,'member'),(4,5,'member'),(4,6,'member'),(4,7,'member'),(4,8,'member'),(4,9,'member'),(4,10,'admin'),
  (5,1,'admin'),(5,3,'member'),(5,9,'member'),(5,8,'member'),(5,6,'member'),
  (6,1,'admin'),(6,2,'member'),(6,8,'member'),(6,7,'member'),
  (7,1,'admin'),(7,2,'member'),(7,5,'member'),(7,8,'member'),
  (8,1,'admin'),(8,2,'member'),
  (9,1,'admin'),(9,3,'member'),
  (10,4,'admin'),(10,1,'member'),
  (11,7,'admin'),(11,1,'member'),(11,5,'member'),(11,9,'member'),
  (12,4,'admin'),(12,2,'member'),(12,3,'member'),(12,5,'member'),(12,6,'member'),(12,7,'member'),(12,8,'member'),(12,9,'member'),(12,10,'member'),
  (13,7,'admin'),(13,9,'member'),(13,5,'member'),(13,4,'member'),(13,2,'member'),
  (14,10,'admin'),(14,2,'member'),(14,3,'member'),(14,4,'member'),(14,5,'member'),(14,6,'member'),(14,7,'member'),(14,8,'member'),(14,9,'member'),
  (15,4,'admin'),(15,2,'member'),(15,7,'member'),(15,10,'member')
) as v (c, m, r)
on conflict do nothing;

-- Messages. Times are Asia/Dubai (+04). x holds optional forward, files, pinned (by member nn) and edited.
insert into public.messages (id, channel_id, author_id, parent_id, body, mentions, forward, files, pinned_at, pinned_by, edited_at, created_at)
select v.id,
  ('e5000000-0000-4000-8000-' || lpad(v.c::text, 12, '0'))::uuid,
  ('00000000-0000-4000-8000-' || lpad(v.a::text, 12, '0'))::uuid,
  v.parent, v.body,
  case when v.body like '@Sara Malik%' then array['00000000-0000-4000-8000-000000000001'::uuid] else '{}'::uuid[] end,
  v.x -> 'forward',
  coalesce(v.x -> 'files', '[]'::jsonb),
  case when v.x ? 'pinned' then v.ts::timestamptz + interval '5 minutes' end,
  case when v.x ? 'pinned' then ('00000000-0000-4000-8000-' || lpad(v.x ->> 'pinned', 12, '0'))::uuid end,
  case when v.x ? 'edited' then v.ts::timestamptz + interval '3 minutes' end,
  v.ts::timestamptz
from (values
  -- general
  (1, 1, 10, null::bigint, 'Reminder: quarterly reviews start next week. Your slots are in Meetings.', '2026-11-03 15:00+04', '{}'::jsonb),
  (2, 1, 6, null, 'October invoices go out today. Flag any extra hours before 2pm.', '2026-11-04 08:45+04', '{}'),
  (3, 1, 7, null, 'Brand kit for Nova Fitness is uploaded to Files.', '2026-11-04 08:47+04', '{}'),
  (4, 1, 4, null, 'Staging restarts at 6pm for about 10 minutes.', '2026-11-04 09:05+04', '{}'),
  -- seo-team
  (5, 2, 2, null, 'Luma lost 4 positions on ''vitamin c serum uae''. Checking last week''s canonical change.', '2026-11-03 11:20+04', '{}'),
  (6, 2, 5, null, 'Two blog posts for Cedar & Pine are ready for edit.', '2026-11-03 11:45+04', '{}'),
  (7, 2, 2, null, 'Found it. The canonical on the product listing points to page 2. Daniel is fixing it.', '2026-11-04 10:02+04', '{}'),
  (8, 2, 2, null, '@Sara Malik can you tell the Luma team before the Thursday call?', '2026-11-04 10:03+04', '{}'),
  (9, 2, 5, null, 'Keyword map for Harbor Legal.', '2026-11-04 10:20+04',
     '{"files":[{"path":"e5000000-0000-4000-8000-000000000002/seed-harbor-keyword-map.xlsx","name":"harbor-keyword-map.xlsx","mime":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","size":90112}]}'),
  -- ppc-team
  (10, 3, 3, null, 'Zest Kitchen CPA is down to PKR 610 this week.', '2026-11-03 14:00+04', '{}'),
  (11, 3, 6, null, 'Alba Motors November media budget approved: AED 38,000.', '2026-11-04 09:30+04', '{"pinned":"6"}'),
  (12, 3, 8, null, 'Can someone pull last month''s Alba search terms for the QBR deck?', '2026-11-04 10:15+04', '{}'),
  -- announcements
  (13, 4, 10, null, 'We hit 98% on-time delivery in October. Thank you, everyone.', '2026-11-04 08:30+04', '{"pinned":"10"}'),
  -- alba-motors
  (14, 5, 8, null, 'Karim confirmed the November showroom offer goes live on the 10th. He wants the ads ready by Friday.', '2026-11-03 16:05+04', '{}'),
  (15, 5, 3, null, 'Yes. I''ll build the Search and Performance Max campaigns tomorrow and share the copy for sign-off.', '2026-11-03 16:20+04', '{}'),
  (16, 5, 3, null, 'Budget split will be 60% Search and 40% PMax, unless you want to push the SUV range harder.', '2026-11-03 16:22+04', '{}'),
  (17, 5, 9, null, 'First drafts of the social creatives for the offer.', '2026-11-03 17:10+04',
     '{"files":[{"path":"e5000000-0000-4000-8000-000000000005/seed-alba-nov-offer-feed.png","name":"alba-nov-offer-feed.png","mime":"image/png","size":655360}]}'),
  (18, 5, 3, null, 'Draft ad copy is ready for review.', '2026-11-04 09:14+04',
     '{"pinned":"3","files":[{"path":"e5000000-0000-4000-8000-000000000005/seed-Alba-Nov-Offer-Ad-Copy.pdf","name":"Alba-Nov-Offer-Ad-Copy.pdf","mime":"application/pdf","size":319488}]}'),
  (19, 5, 8, 18, 'Headline 3 says ''zero down''. Their legal team wants ''0% down payment''.', '2026-11-04 09:22+04', '{}'),
  (20, 5, 3, 18, 'Fixed. Updated PDF in 5 minutes.', '2026-11-04 09:26+04', '{}'),
  (21, 5, 1, 18, 'Thanks both. Ayesha, please re-share here once fixed.', '2026-11-04 09:31+04', '{}'),
  (22, 5, 8, null, '@Sara Malik can we also add the Hatta test-drive event to the same campaign?', '2026-11-04 09:40+04', '{}'),
  (23, 5, 8, null, 'Forwarding for context.', '2026-11-04 09:52+04',
     '{"forward":{"by":"Bilal Ahmed","ch":"#ppc-team","text":"Alba Motors November media budget approved: AED 38,000."}}'),
  (24, 5, 9, null, 'Updated the story frames with the new price.', '2026-11-04 10:31+04', '{"edited":"1"}'),
  -- luma-skincare
  (25, 6, 8, null, 'The Luma product launch moved to the 20th. Does that change the content calendar?', '2026-11-03 17:40+04', '{}'),
  (26, 6, 7, null, 'Slightly. I''ll send a revised calendar tomorrow.', '2026-11-03 17:55+04', '{}'),
  (27, 6, 2, null, '@Sara Malik the Luma team is seeing a drop in organic traffic on the serum page. I''ll brief them on the canonical fix.', '2026-11-04 10:12+04', '{}'),
  -- cedar-pine
  (28, 7, 8, null, 'Dr. Faris says the new implant service page looks great.', '2026-11-03 12:00+04', '{}'),
  (29, 7, 5, null, 'Two more posts go live this week.', '2026-11-04 09:10+04', '{}'),
  (30, 7, 2, null, 'October rankings report is in Files.', '2026-11-04 09:12+04',
     '{"files":[{"path":"e5000000-0000-4000-8000-000000000007/seed-CPD-Oct-Rankings.pdf","name":"CPD-Oct-Rankings.pdf","mime":"application/pdf","size":1258291}]}'),
  -- DM Sara / Omar
  (31, 8, 1, null, 'Can you join the Luma call on Thursday?', '2026-11-03 18:02+04', '{}'),
  (32, 8, 2, null, 'Yes, 3pm works. I''ll bring the canonical fix timeline.', '2026-11-04 10:44+04', '{}'),
  -- DM Sara / Ayesha
  (33, 9, 1, null, 'Great work on the Zest numbers.', '2026-11-04 08:50+04', '{}'),
  (34, 9, 3, null, 'Thanks! Using the same structure for Alba.', '2026-11-04 08:58+04', '{}'),
  -- DM Sara / Daniel
  (35, 10, 4, null, 'Canonical fix is on staging.', '2026-11-04 09:20+04', '{}'),
  (36, 10, 1, null, 'Thanks. Ship it once Omar confirms.', '2026-11-04 09:25+04', '{}'),
  (37, 10, 1, null, 'Also, Harbor''s contact form is sending duplicate emails.', '2026-11-04 09:26+04', '{}'),
  -- group Sara / Priya / Lina / Zara
  (38, 11, 7, null, 'Moodboard for Nova''s January campaign.', '2026-11-04 10:00+04',
     '{"files":[{"path":"e5000000-0000-4000-8000-000000000011/seed-nova-jan-moodboard.png","name":"nova-jan-moodboard.png","mime":"image/png","size":1153434}]}'),
  (39, 11, 9, null, 'Love the second row.', '2026-11-04 10:05+04', '{}'),
  (40, 11, 5, null, 'I''ll write captions to match.', '2026-11-04 10:08+04', '{}'),
  -- channels Sara can browse and join
  (41, 12, 4, null, 'Lunch at the Lebanese place on Thursday? Reply here.', '2026-11-03 13:10+04', '{}'),
  (42, 13, 7, null, 'Crit this Tuesday: Nova January moodboards.', '2026-11-03 10:00+04', '{}'),
  (43, 14, 10, null, 'Cedar & Pine left us a five-star review. Well done, SEO team.', '2026-11-03 16:30+04', '{}'),
  (44, 15, 4, null, 'Deploy to staging at 6pm today.', '2026-11-04 09:00+04', '{}')
) as v (id, c, a, parent, body, ts, x)
on conflict (id) do nothing;

select setval(pg_get_serial_sequence('public.messages', 'id'), greatest((select max(id) from public.messages), 1));

-- Reactions: (message id, member nn, emoji)
insert into public.message_reactions (message_id, member_id, emoji, channel_id)
select v.mid, ('00000000-0000-4000-8000-' || lpad(v.m::text, 12, '0'))::uuid, v.e, msg.channel_id
from (values
  (1, 2, '✅'), (1, 3, '✅'), (1, 5, '✅'), (1, 8, '✅'),
  (10, 8, '🎉'), (10, 1, '🎉'),
  (13, 2, '🎉'), (13, 3, '🎉'), (13, 5, '🎉'), (13, 7, '🎉'), (13, 9, '🎉'), (13, 8, '🎉'),
  (15, 1, '👍'), (15, 8, '👍'),
  (17, 8, '🔥'),
  (20, 8, '👍'),
  (24, 3, '🔥'),
  (39, 5, '❤️')
) as v (mid, m, e)
join public.messages msg on msg.id = v.mid
on conflict do nothing;

-- Read state: everyone has read everything, then Sara's unread and Daniel's unseen DM.
update public.channel_members cm set last_read_id = x.max_id
from (select channel_id, max(id) as max_id from public.messages group by channel_id) x
where x.channel_id = cm.channel_id;

update public.channel_members cm set last_read_id = v.last_read
from (values (2, 1, 6), (3, 1, 10), (4, 1, 0), (5, 1, 17), (6, 1, 26), (7, 1, 28), (8, 1, 31), (10, 4, 35)) as v (c, m, last_read)
where cm.channel_id = ('e5000000-0000-4000-8000-' || lpad(v.c::text, 12, '0'))::uuid
  and cm.member_id = ('00000000-0000-4000-8000-' || lpad(v.m::text, 12, '0'))::uuid;

-- Sara's notification choices.
update public.channel_members set notify = 'mentions'
where channel_id = 'e5000000-0000-4000-8000-000000000004' and member_id = '00000000-0000-4000-8000-000000000001';
update public.channel_members set notify = 'mute'
where channel_id = 'e5000000-0000-4000-8000-000000000007' and member_id = '00000000-0000-4000-8000-000000000001';

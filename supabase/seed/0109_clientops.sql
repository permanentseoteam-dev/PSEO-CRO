-- Seed 0109_clientops: response-time waits, meetings with action items, client files and brand kits,
-- matching docs/ui-preview (Response times, Meetings, Files). Today is 2026-11-04, times Asia/Dubai (+04).
-- Fixed ids:
--   sla_waits (named)   c9200000-0000-4000-8000-0000000000NN  (generated history uses random ids)
--   meetings            c9000000-0000-4000-8000-0000000000NN
--   meeting_actions     c9100000-0000-4000-8000-0000000000NN
--   client_files        c9300000-0000-4000-8000-0000000000NN
--   client_folders      default ones come from the clients trigger; custom ones c9500000-0000-4000-8000-0000000000NN
-- Seeded file versions point at Storage paths with no object behind them, so Download reports
-- "file not found" until real files are uploaded.

-- ---------------------------------------------------------------- SLA settings (defaults, explicit)
update public.sla_settings set reply_hours = 1, request_hours = 4, changes_hours = 8, timezone = 'Asia/Dubai',
  day_start = '09:00', day_end = '18:00', workdays = '{1,2,3,4,5}', ontime_goal = 90
where id;

-- ---------------------------------------------------------------- waiting now
insert into public.sla_waits (id, client_id, kind, subject, from_name, ticket_id, answerer_id, target_hours, started_at) values
  ('c9200000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000003', 'request', 'Request: new landing page copy', 'Megan Cole', null,
    '00000000-0000-4000-8000-000000000002', 4, '2026-11-03 10:40+04'),
  ('c9200000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 'comment', 'Comment on ALB-90', 'Rania Youssef', 'e0600000-0000-4000-8000-000000000008',
    '00000000-0000-4000-8000-000000000003', 1, '2026-11-04 08:55+04'),
  ('c9200000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000006', 'message', 'Message in client chat', 'Ali Raza', null,
    '00000000-0000-4000-8000-000000000003', 1, '2026-11-04 10:15+04'),
  ('c9200000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', 'changes', 'Changes on blog draft', 'Dr. Nadia Rahman', null,
    '00000000-0000-4000-8000-000000000005', 8, '2026-11-04 09:30+04'),
  ('c9200000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000005', 'message', 'Message in client chat', 'Omar Siddiqui', null,
    '00000000-0000-4000-8000-000000000009', 1, '2026-11-04 10:40+04'),
  ('c9200000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000004', 'request', 'Request: add attorney bio page', 'James Whitfield', null,
    '00000000-0000-4000-8000-000000000004', 4, '2026-11-04 09:10+04')
on conflict (id) do nothing;

-- ---------------------------------------------------------------- answered (recent, named)
insert into public.sla_waits (id, client_id, kind, subject, from_name, answerer_id, target_hours, started_at, answered_at, answered_by) values
  ('c9200000-0000-4000-8000-000000000011', 'c0000000-0000-4000-8000-000000000002', 'message', 'Message in client chat', 'Rania Youssef',
    '00000000-0000-4000-8000-000000000003', 1, '2026-11-04 09:02+04', '2026-11-04 09:20+04', '00000000-0000-4000-8000-000000000003'),
  ('c9200000-0000-4000-8000-000000000012', 'c0000000-0000-4000-8000-000000000001', 'request', 'Request: add new dentist profile', 'Dr. Nadia Rahman',
    '00000000-0000-4000-8000-000000000002', 4, '2026-11-03 15:40+04', '2026-11-04 09:10+04', '00000000-0000-4000-8000-000000000002'),
  ('c9200000-0000-4000-8000-000000000013', 'c0000000-0000-4000-8000-000000000003', 'changes', 'Changes on serum page copy', 'Megan Cole',
    '00000000-0000-4000-8000-000000000005', 8, '2026-11-03 11:15+04', '2026-11-04 11:55+04', '00000000-0000-4000-8000-000000000005'),
  ('c9200000-0000-4000-8000-000000000014', 'c0000000-0000-4000-8000-000000000004', 'comment', 'Comment on HBR-63', 'James Whitfield',
    '00000000-0000-4000-8000-000000000004', 1, '2026-11-02 16:05+04', '2026-11-03 10:15+04', '00000000-0000-4000-8000-000000000004'),
  ('c9200000-0000-4000-8000-000000000015', 'c0000000-0000-4000-8000-000000000005', 'message', 'Message in client chat', 'Omar Siddiqui',
    '00000000-0000-4000-8000-000000000009', 1, '2026-11-03 10:20+04', '2026-11-03 10:32+04', '00000000-0000-4000-8000-000000000009'),
  ('c9200000-0000-4000-8000-000000000016', 'c0000000-0000-4000-8000-000000000006', 'request', 'Request: Foodpanda banner sizes', 'Ali Raza',
    '00000000-0000-4000-8000-000000000003', 4, '2026-11-03 13:00+04', '2026-11-03 16:05+04', '00000000-0000-4000-8000-000000000003')
on conflict (id) do nothing;

-- ---------------------------------------------------------------- answered history (90 days, generated)
-- Deterministic: about 800 waits, mostly answered within target, every 9th one slow.
-- Ids are derived from the row number so a re-run inserts nothing new.
insert into public.sla_waits (id, client_id, kind, subject, from_name, answerer_id, target_hours, started_at, answered_at, answered_by)
select
  ('c9210000-0000-4000-8000-' || lpad(i::text, 12, '0'))::uuid,
  ('c0000000-0000-4000-8000-' || lpad(c::text, 12, '0'))::uuid,
  k.kind,
  case k.kind when 'message' then 'Message in client chat' when 'comment' then 'Comment on a ticket'
    when 'request' then 'Request from the portal' else 'Changes on a draft' end,
  (array['Dr. Nadia Rahman', 'Rania Youssef', 'Megan Cole', 'James Whitfield', 'Omar Siddiqui', 'Ali Raza'])[c],
  ans, k.target, st,
  st + make_interval(mins => took),
  ans
from (
  select i,
    1 + (i * 7) % 6 as c,
    (('2026-11-03'::date - (i * 90 / 800)) + time '09:00' + make_interval(mins => (i * 53) % 480)) at time zone 'Asia/Dubai' as st,
    case when i % 9 = 0 then 240 + (i * 31) % 480 else 5 + (i * 29) % 150 end as took,
    i % 4 as kn
  from generate_series(1, 800) as i
) g
cross join lateral (
  select (array['message', 'comment', 'request', 'changes'])[g.kn + 1] as kind,
         (array[1, 1, 4, 8])[g.kn + 1]::numeric as target
) k
cross join lateral (
  -- the client's usual people; every 23rd wait is picked up by Sara (1) or Hamza (8)
  select ('00000000-0000-4000-8000-' || lpad((
    case when g.i % 23 = 0 then (case when g.i % 2 = 0 then 1 else 8 end)
         else (array[array[2, 5], array[3, 9], array[2, 7], array[4, 2], array[9, 5], array[3, 1]])[g.c][1 + g.i % 2] end
  )::text, 12, '0'))::uuid as ans
) a
on conflict (id) do nothing;

-- ---------------------------------------------------------------- meetings
insert into public.meetings (id, client_id, title, held_at, duration_min, our_people, guests, attendee_emails, summary, decisions, concerns, status, reviewed_by, reviewed_at, created_by) values
  -- to review
  ('c9000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'Alba x Permanent SEO monthly', '2026-10-28 15:00+04', 41,
    '{00000000-0000-4000-8000-000000000001,00000000-0000-4000-8000-000000000003}', 'Karim Nassar, Rania Youssef', null,
    'October performance review. Leads are up, but the team lost two Patrol sales because lead emails arrived a day late. Karim wants to see Meta prove itself before Q1.',
    '{"Move AED 5,000 from Meta to Google Search for November.","Hold the SUV carousel until new creatives are ready."}',
    '[{"topic":"Lead emails late","quote":"We got the Patrol leads a day late, that cost us two sales."},{"topic":"Meta value","quote":"If Meta can''t beat 200 a lead, I''d rather go Google only in Q1."}]',
    'to_review', null, null, '00000000-0000-4000-8000-000000000001'),
  ('c9000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000003', 'Luma Q4 planning', '2026-11-03 17:00+04', 52,
    '{00000000-0000-4000-8000-000000000008,00000000-0000-4000-8000-000000000002}', 'Megan Cole', null,
    'Megan is unhappy with Q3 ROAS and wants a clear plan before Black Friday. Agreed to focus spend on the two best-selling serums and fix product page speed.',
    '{"Black Friday budget capped at USD 6,000.","Pause the body-care line in ads until stock is back."}',
    '[{"topic":"Returns on ads","quote":"Honestly we''re paying for traffic that doesn''t buy."}]',
    'to_review', null, null, '00000000-0000-4000-8000-000000000008'),
  ('c9000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000005', 'Nova Fitness content kickoff', '2026-10-30 10:00+04', 34,
    '{00000000-0000-4000-8000-000000000008,00000000-0000-4000-8000-000000000009}', 'Omar Siddiqui', null,
    'Kickoff for the November content calendar. Omar wants member stories and trainer reels, three a week.',
    '{"Three reels a week, Monday, Wednesday, Friday."}',
    '[{"topic":"Approvals","quote":"I travel a lot, so approvals need to work from my phone."}]',
    'to_review', null, null, '00000000-0000-4000-8000-000000000008'),
  -- reviewed (recent calls)
  ('c9000000-0000-4000-8000-000000000011', 'c0000000-0000-4000-8000-000000000001', 'Cedar & Pine content review', '2026-10-27 11:00+04', 30,
    '{00000000-0000-4000-8000-000000000002,00000000-0000-4000-8000-000000000005}', 'Dr. Nadia Rahman', null,
    'Reviewed October blog posts and the implants page plan.', '{"Two blog posts a month move to three from December."}', '[]',
    'reviewed', '00000000-0000-4000-8000-000000000002', '2026-10-27 13:00+04', '00000000-0000-4000-8000-000000000002'),
  ('c9000000-0000-4000-8000-000000000012', 'c0000000-0000-4000-8000-000000000004', 'Harbor Legal site walkthrough', '2026-10-24 14:00+04', 48,
    '{00000000-0000-4000-8000-000000000004,00000000-0000-4000-8000-000000000001}', 'James Whitfield', null,
    'Walked through the new site templates with the partners.', '{"Launch after compliance sign-off, target 25 Nov."}', '[]',
    'reviewed', '00000000-0000-4000-8000-000000000001', '2026-10-24 16:30+04', '00000000-0000-4000-8000-000000000001'),
  ('c9000000-0000-4000-8000-000000000013', 'c0000000-0000-4000-8000-000000000006', 'Zest Kitchen menu launch ads', '2026-10-22 12:00+04', 25,
    '{00000000-0000-4000-8000-000000000003}', 'Ali Raza', null,
    'Planned ads for the winter menu launch.', '{"Launch on 5 Nov with a PKR 150,000 budget."}', '[]',
    'reviewed', '00000000-0000-4000-8000-000000000003', '2026-10-22 13:00+04', '00000000-0000-4000-8000-000000000003'),
  ('c9000000-0000-4000-8000-000000000014', 'c0000000-0000-4000-8000-000000000002', 'Motor Show planning', '2026-10-16 11:00+04', 23,
    '{00000000-0000-4000-8000-000000000001,00000000-0000-4000-8000-000000000007}', 'Rania Youssef', null,
    'Planned the Motor Show landing page and stand creatives.', '{"Landing page live from 15 Nov."}', '[]',
    'reviewed', '00000000-0000-4000-8000-000000000001', '2026-10-16 12:00+04', '00000000-0000-4000-8000-000000000001'),
  ('c9000000-0000-4000-8000-000000000015', 'c0000000-0000-4000-8000-000000000003', 'Luma Q3 business review', '2026-10-09 17:00+04', 55,
    '{00000000-0000-4000-8000-000000000008,00000000-0000-4000-8000-000000000002}', 'Megan Cole', null,
    'Q3 results and the plan for Q4.', '{"Weekly numbers by email every Monday."}', '[]',
    'reviewed', '00000000-0000-4000-8000-000000000008', '2026-10-09 19:00+04', '00000000-0000-4000-8000-000000000008'),
  -- no client yet
  ('c9000000-0000-4000-8000-000000000021', null, 'Weekly SEO standup', '2026-11-03 09:30+04', 20,
    '{00000000-0000-4000-8000-000000000002,00000000-0000-4000-8000-000000000005}', null, 'omar@permanentseo.ae, priya@permanentseo.ae',
    null, '{}', '[]', 'to_review', null, null, '00000000-0000-4000-8000-000000000002'),
  ('c9000000-0000-4000-8000-000000000022', null, 'Intro call: Marina Bay Realty', '2026-10-31 15:00+04', 30,
    '{00000000-0000-4000-8000-000000000001}', null, 'leen@marinabayrealty.ae',
    null, '{}', '[]', 'to_review', null, null, '00000000-0000-4000-8000-000000000001')
on conflict (id) do nothing;

insert into public.meeting_actions (id, meeting_id, position, title, owner_name, assignee_id, outcome, ticket_id, done) values
  -- Alba monthly (to review; suggested outcomes)
  ('c9100000-0000-4000-8000-000000000001', 'c9000000-0000-4000-8000-000000000001', 0, 'Fix lead email routing to the sales inbox', 'Daniel Reyes', '00000000-0000-4000-8000-000000000004', 'ticket', null, false),
  ('c9100000-0000-4000-8000-000000000002', 'c9000000-0000-4000-8000-000000000001', 1, 'Make 6 new SUV creatives', 'Lina Saeed', '00000000-0000-4000-8000-000000000007', 'ticket', null, false),
  ('c9100000-0000-4000-8000-000000000003', 'c9000000-0000-4000-8000-000000000001', 2, 'Send Motor Show stand dimensions', 'Rania Youssef', null, 'todo', null, false),
  ('c9100000-0000-4000-8000-000000000004', 'c9000000-0000-4000-8000-000000000001', 3, 'Share Q4 price list', 'Rania Youssef', null, 'todo', null, false),
  ('c9100000-0000-4000-8000-000000000005', 'c9000000-0000-4000-8000-000000000001', 4, 'Look into a TikTok test', 'Zara Farooq', '00000000-0000-4000-8000-000000000009', 'skip', null, false),
  -- Luma Q4 planning
  ('c9100000-0000-4000-8000-000000000006', 'c9000000-0000-4000-8000-000000000002', 0, 'Speed up product pages (LCP under 2.5s)', 'Daniel Reyes', '00000000-0000-4000-8000-000000000004', 'ticket', null, false),
  ('c9100000-0000-4000-8000-000000000007', 'c9000000-0000-4000-8000-000000000002', 1, 'Black Friday ad plan', 'Ayesha Khan', '00000000-0000-4000-8000-000000000003', 'ticket', null, false),
  ('c9100000-0000-4000-8000-000000000008', 'c9000000-0000-4000-8000-000000000002', 2, 'Send stock dates for body-care line', 'Megan Cole', null, 'todo', null, false),
  -- Nova kickoff
  ('c9100000-0000-4000-8000-000000000009', 'c9000000-0000-4000-8000-000000000003', 0, 'Build November content calendar', 'Zara Farooq', '00000000-0000-4000-8000-000000000009', 'ticket', null, false),
  ('c9100000-0000-4000-8000-000000000010', 'c9000000-0000-4000-8000-000000000003', 1, 'Send list of trainers for filming', 'Omar Siddiqui', null, 'todo', null, false),
  -- reviewed
  ('c9100000-0000-4000-8000-000000000021', 'c9000000-0000-4000-8000-000000000011', 0, 'Implants page draft', 'Priya Nair', '00000000-0000-4000-8000-000000000005', 'ticket', 'e0600000-0000-4000-8000-000000000001', false),
  ('c9100000-0000-4000-8000-000000000022', 'c9000000-0000-4000-8000-000000000011', 1, 'Whitening myths blog', 'Priya Nair', '00000000-0000-4000-8000-000000000005', 'ticket', 'e0600000-0000-4000-8000-000000000003', false),
  ('c9100000-0000-4000-8000-000000000023', 'c9000000-0000-4000-8000-000000000011', 2, 'Dentist profile schema', 'Daniel Reyes', '00000000-0000-4000-8000-000000000004', 'ticket', 'e0600000-0000-4000-8000-000000000006', false),
  ('c9100000-0000-4000-8000-000000000031', 'c9000000-0000-4000-8000-000000000012', 0, 'Practice area templates', 'Daniel Reyes', '00000000-0000-4000-8000-000000000004', 'ticket', 'e0600000-0000-4000-8000-000000000019', false),
  ('c9100000-0000-4000-8000-000000000032', 'c9000000-0000-4000-8000-000000000012', 1, 'Redirect map', 'Omar Haddad', '00000000-0000-4000-8000-000000000002', 'ticket', 'e0600000-0000-4000-8000-000000000022', false),
  ('c9100000-0000-4000-8000-000000000033', 'c9000000-0000-4000-8000-000000000012', 2, 'Blog migration', 'Priya Nair', '00000000-0000-4000-8000-000000000005', 'ticket', 'e0600000-0000-4000-8000-000000000021', false),
  ('c9100000-0000-4000-8000-000000000034', 'c9000000-0000-4000-8000-000000000012', 3, 'Spam protection on contact form', 'Daniel Reyes', '00000000-0000-4000-8000-000000000004', 'ticket', 'e0600000-0000-4000-8000-000000000020', false),
  ('c9100000-0000-4000-8000-000000000035', 'c9000000-0000-4000-8000-000000000012', 4, 'Send final attorney bios', 'James Whitfield', null, 'todo', null, true),
  ('c9100000-0000-4000-8000-000000000036', 'c9000000-0000-4000-8000-000000000012', 5, 'Compliance sign-off on templates', 'James Whitfield', null, 'todo', null, false),
  ('c9100000-0000-4000-8000-000000000041', 'c9000000-0000-4000-8000-000000000013', 0, 'Winter menu ad set', 'Ayesha Khan', '00000000-0000-4000-8000-000000000003', 'ticket', null, false),
  ('c9100000-0000-4000-8000-000000000042', 'c9000000-0000-4000-8000-000000000013', 1, 'Send winter menu photos', 'Ali Raza', null, 'todo', null, true),
  ('c9100000-0000-4000-8000-000000000051', 'c9000000-0000-4000-8000-000000000014', 0, 'Motor Show landing page', 'Daniel Reyes', '00000000-0000-4000-8000-000000000004', 'ticket', 'e0600000-0000-4000-8000-000000000012', false),
  ('c9100000-0000-4000-8000-000000000052', 'c9000000-0000-4000-8000-000000000014', 1, 'SUV creative set', 'Lina Saeed', '00000000-0000-4000-8000-000000000007', 'ticket', 'e0600000-0000-4000-8000-000000000008', false),
  ('c9100000-0000-4000-8000-000000000061', 'c9000000-0000-4000-8000-000000000015', 0, 'Serum keyword map', 'Omar Haddad', '00000000-0000-4000-8000-000000000002', 'ticket', 'e0600000-0000-4000-8000-000000000013', false),
  ('c9100000-0000-4000-8000-000000000062', 'c9000000-0000-4000-8000-000000000015', 1, 'Fix Shopping feed errors', 'Ayesha Khan', '00000000-0000-4000-8000-000000000003', 'ticket', 'e0600000-0000-4000-8000-000000000015', false),
  ('c9100000-0000-4000-8000-000000000063', 'c9000000-0000-4000-8000-000000000015', 2, 'Core Web Vitals on collections', 'Daniel Reyes', '00000000-0000-4000-8000-000000000004', 'ticket', 'e0600000-0000-4000-8000-000000000017', false),
  ('c9100000-0000-4000-8000-000000000064', 'c9000000-0000-4000-8000-000000000015', 3, 'Influencer shortlist', 'Zara Farooq', '00000000-0000-4000-8000-000000000009', 'skip', null, false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------- custom folders
insert into public.client_folders (id, client_id, name, kind, client_visible, position, created_by) values
  ('c9500000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'Campaign creatives', 'custom', true, 10, '00000000-0000-4000-8000-000000000007'),
  ('c9500000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', 'Blog drafts', 'custom', true, 10, '00000000-0000-4000-8000-000000000005'),
  ('c9500000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000004', 'Website build', 'custom', true, 10, '00000000-0000-4000-8000-000000000004')
on conflict do nothing;

-- ---------------------------------------------------------------- files and versions
-- n, client, folder (name), file name, shared, versions, size bytes (latest), uploader member (null = client contact), uploader name, latest date
with f (n, c, folder, name, shared, vers, size, who, who_name, ts) as (
  values
  (1,  2, 'Brand assets',       'Alba logo pack.zip',            true,  2, 19293798, 7, null, '2026-03-12 10:00'),
  (2,  2, 'Brand assets',       'Alba brand guide 2026.pdf',     true,  1, 6501171,  null, 'Rania Youssef', '2026-01-08 12:00'),
  (3,  2, 'Brand assets',       'Signed agreement 2025.pdf',     true,  2, 839680,   1, null, '2025-02-01 11:00'),
  (4,  2, 'Brand assets',       'Showroom photos SZR.zip',       false, 1, 148897792, 7, null, '2026-09-20 15:00'),
  (5,  2, 'From the client',    'Q4 price list.xlsx',            true,  1, 98304,    null, 'Rania Youssef', '2026-11-01 09:30'),
  (6,  2, 'From the client',    'Motor Show stand plan.pdf',     true,  1, 2202009,  null, 'Rania Youssef', '2026-10-30 14:00'),
  (7,  2, 'From the client',    'Dealer co-op rules.pdf',        true,  3, 1468006,  null, 'Karim Nassar', '2026-08-14 10:00'),
  (8,  2, 'Campaign creatives', 'Motor Show landing page.fig',   false, 3, 25165824, 7, null, '2026-11-03 16:20'),
  (9,  2, 'Campaign creatives', 'SUV reels November.mp4',        false, 2, 92274688, 9, null, '2026-11-02 12:00'),
  (10, 2, 'Campaign creatives', 'Patrol search ads copy.docx',   true,  4, 43008,    3, null, '2026-10-29 11:00'),
  (11, 1, 'Brand assets',       'Cedar & Pine logo.svg',         true,  1, 22528,    7, null, '2024-03-15 10:00'),
  (12, 1, 'Brand assets',       'Clinic photography.zip',        true,  2, 100663296, null, 'Dr. Nadia Rahman', '2026-06-10 10:00'),
  (13, 1, 'From the client',    'Treatment price list 2026.pdf', true,  2, 317440,   null, 'Dr. Nadia Rahman', '2026-10-06 10:00'),
  (14, 1, 'Blog drafts',        'Invisalign vs braces.docx',     true,  3, 59392,    5, null, '2026-11-03 13:00'),
  (15, 1, 'Blog drafts',        'Teeth whitening myths.docx',    false, 1, 45056,    5, null, '2026-10-31 15:00'),
  (16, 3, 'Brand assets',       'Luma brand book.pdf',           true,  1, 12582912, null, 'Megan Cole', '2026-01-02 18:00'),
  (17, 3, 'Brand assets',       'Product packshots.zip',         true,  4, 220200960, 7, null, '2026-10-18 12:00'),
  (18, 3, 'From the client',    'Black Friday offers.xlsx',      true,  1, 65536,    null, 'Megan Cole', '2026-11-03 19:00'),
  (19, 3, 'From the client',    'Stock forecast Q4.xlsx',        true,  2, 122880,   null, 'Megan Cole', '2026-10-28 18:00'),
  (20, 4, 'Brand assets',       'Harbor logo pack.zip',          true,  1, 5033164,  4, null, '2026-04-04 10:00'),
  (21, 4, 'From the client',    'Attorney bios.docx',            true,  2, 90112,    null, 'James Whitfield', '2026-11-02 13:00'),
  (22, 4, 'From the client',    'Practice areas copy.docx',      true,  1, 52224,    null, 'James Whitfield', '2026-10-20 13:00'),
  (23, 4, 'Website build',      'Sitemap v4.pdf',                true,  4, 389120,   4, null, '2026-11-01 10:00'),
  (24, 4, 'Website build',      'Homepage design.fig',           false, 6, 32505856, 7, null, '2026-10-30 16:00'),
  (25, 5, 'Brand assets',       'Nova logo.png',                 true,  1, 348160,   null, 'Omar Siddiqui', '2026-10-20 10:00'),
  (26, 5, 'From the client',    'Trainer list.xlsx',             true,  1, 28672,    null, 'Omar Siddiqui', '2026-10-31 10:00'),
  (27, 6, 'Brand assets',       'Zest menu photos.zip',          true,  1, 67108864, null, 'Ali Raza', '2026-09-05 10:00'),
  (28, 6, 'From the client',    'Winter menu.pdf',               true,  1, 2411724,  null, 'Ali Raza', '2026-11-01 10:00')
),
ins as (
  insert into public.client_files (id, client_id, folder_id, name, shared, created_by, created_at, updated_at)
  select ('c9300000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
    ('c0000000-0000-4000-8000-' || lpad(c::text, 12, '0'))::uuid,
    (select d.id from public.client_folders d where d.client_id = ('c0000000-0000-4000-8000-' || lpad(c::text, 12, '0'))::uuid and d.name = folder),
    name, shared,
    case when who is null then null else ('00000000-0000-4000-8000-' || lpad(who::text, 12, '0'))::uuid end,
    (ts::timestamp at time zone 'Asia/Dubai') - make_interval(days => (vers - 1) * 3),
    (ts::timestamp at time zone 'Asia/Dubai')
  from f
  on conflict do nothing
  returning id
)
insert into public.file_versions (file_id, version, path, size_bytes, mime, uploaded_by, uploader_name, created_at)
select ('c9300000-0000-4000-8000-' || lpad(f.n::text, 12, '0'))::uuid, v,
  'c0000000-0000-4000-8000-' || lpad(f.c::text, 12, '0') || '/seed-' || f.n || '-v' || v || '-' || replace(f.name, ' ', '-'),
  greatest(1024, f.size - (f.vers - v) * (f.size / 10)),
  null,
  case when f.who is null then null else ('00000000-0000-4000-8000-' || lpad(f.who::text, 12, '0'))::uuid end,
  f.who_name,
  (f.ts::timestamp at time zone 'Asia/Dubai') - make_interval(days => (f.vers - v) * 3)
from f
cross join lateral generate_series(1, f.vers) as v
on conflict (file_id, version) do nothing;

-- ---------------------------------------------------------------- brand kits
insert into public.brand_kits (client_id, colours, fonts, tone, dos, donts, updated_by) values
  ('c0000000-0000-4000-8000-000000000002',
    '[{"name":"Alba red","hex":"#c8102e"},{"name":"Charcoal","hex":"#2b2b2b"},{"name":"Silver","hex":"#c0c4c8"}]',
    'Montserrat for headings, Open Sans for body', 'Confident, helpful, never pushy. Prices always include VAT.',
    '{"Show real showroom staff","Lead with the monthly payment","Arabic and English on every ad"}',
    '{"No competitor names","No \"cheapest\" claims","No old logo (pre-2024)"}', '00000000-0000-4000-8000-000000000007'),
  ('c0000000-0000-4000-8000-000000000001',
    '[{"name":"Pine green","hex":"#2f5d50"},{"name":"Cedar","hex":"#a0522d"},{"name":"Cream","hex":"#f5f0e6"}]',
    'Lora for headings, Inter for body', 'Calm, reassuring, plain English. No scare tactics.',
    '{"Real patients with consent","Mention DHA licence"}',
    '{"No before/after without consent","No discounts on treatments"}', '00000000-0000-4000-8000-000000000007')
on conflict (client_id) do nothing;

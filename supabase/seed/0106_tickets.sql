-- Seed 0106_tickets: permission keys, sample tickets from the mockup, checklist, subtasks, comments,
-- history, watchers, time entries and saved views. Today is 2026-11-04 (Asia/Dubai).
-- Fixed ids: tickets e0600000-0000-4000-8000-0000000000NN (NN = row number below).
-- Tickets are linked to projects by key prefix (CPD, ALB, LUM, HBR, NOV) after the work seed runs:
--   select public.tickets_link_projects();

-- ---------------------------------------------------------------- permissions
insert into public.permissions (key, area, label) values
  ('tickets.view',   'Work', 'See tickets'),
  ('tickets.manage', 'Work', 'Create and edit tickets')
on conflict (key) do nothing;

insert into public.role_permissions (role, perm_key, scope) values
  ('admin',         'tickets.view',   'all'),
  ('admin',         'tickets.manage', 'all'),
  ('dept_head',     'tickets.view',   'all'),
  ('dept_head',     'tickets.manage', 'team'),
  ('member',        'tickets.view',   'all'),
  ('member',        'tickets.manage', 'own'),
  ('finance_head',  'tickets.view',   'all'),
  ('finance_head',  'tickets.manage', 'own'),
  ('client_owner',  'tickets.view',   'own'),
  ('client_viewer', 'tickets.view',   'own')
on conflict do nothing;

-- ---------------------------------------------------------------- tickets
-- n, key, title, status, priority, assignee, co-assignees, reporter, due, tags, estimate (min), created
with t (n, key, title, status, priority, who, co, rep, due, tags, est, created) as (
  values
  (1,  'CPD-142', 'Rewrite service pages for implants and veneers', 'in_review', 'high', 5, array[2,4], 8, '2026-11-04', array['content','onpage'], 360, '2026-10-26'),
  (2,  'CPD-139', 'Fix duplicate title tags on location pages', 'done', 'normal', 2, array[]::int[], 2, '2026-10-30', array['technical'], 120, '2026-10-20'),
  (3,  'CPD-145', 'Publish November blog: whitening myths', 'todo', 'normal', 5, array[]::int[], 2, '2026-11-12', array['content'], 240, '2026-10-28'),
  (4,  'CPD-147', 'Monthly SEO report for October', 'in_progress', 'high', 2, array[]::int[], 1, '2026-11-05', array['report'], 180, '2026-11-01'),
  (5,  'CPD-150', 'Build 10 local citations (Dubai Marina)', 'todo', 'low', 8, array[]::int[], 2, '2026-11-20', array['local'], 300, '2026-11-02'),
  (6,  'CPD-151', 'Schema markup for dentist profiles', 'blocked', 'normal', 4, array[]::int[], 2, '2026-11-02', array['technical'], 150, '2026-10-27'),
  (7,  'ALB-88',  'Launch winter service campaign on Google Ads', 'in_progress', 'urgent', 3, array[]::int[], 1, '2026-11-04', array['ads','launch'], 420, '2026-10-24'),
  (8,  'ALB-90',  'New ad creative set for SUV range', 'in_review', 'high', 7, array[]::int[], 3, '2026-11-06', array['design','ads'], 300, '2026-10-29'),
  (9,  'ALB-91',  'Negative keyword cleanup', 'todo', 'normal', 3, array[]::int[], 3, '2026-11-10', array['ads'], 90, '2026-11-01'),
  (10, 'ALB-93',  'Instagram reels plan for November', 'in_progress', 'normal', 9, array[]::int[], 8, '2026-11-08', array['social'], 240, '2026-10-30'),
  (11, 'ALB-95',  'Weekly budget pacing check', 'done', 'low', 3, array[]::int[], 3, '2026-11-03', array['ads','report'], 30, '2026-11-02'),
  (12, 'ALB-96',  'Landing page A/B test: test drive form', 'blocked', 'high', 4, array[3], 3, '2026-10-31', array['web','cro'], 360, '2026-10-22'),
  (13, 'LUM-210', 'Keyword map for serum category', 'in_progress', 'high', 2, array[]::int[], 1, '2026-11-03', array['research'], 300, '2026-10-25'),
  (14, 'LUM-212', 'Product page copy: vitamin C line', 'todo', 'normal', 5, array[]::int[], 2, '2026-11-14', array['content'], 420, '2026-10-28'),
  (15, 'LUM-215', 'Shopping feed errors (124 items)', 'in_progress', 'urgent', 3, array[]::int[], 1, '2026-10-29', array['ads','technical'], 240, '2026-10-21'),
  (16, 'LUM-218', 'Banner set for Black Friday', 'todo', 'high', 7, array[]::int[], 8, '2026-11-18', array['design'], 360, '2026-11-03'),
  (17, 'LUM-219', 'Core Web Vitals fixes on collection pages', 'in_review', 'normal', 4, array[]::int[], 2, '2026-11-07', array['technical','web'], 480, '2026-10-23'),
  (18, 'LUM-220', 'Client call notes and next steps', 'done', 'low', 8, array[]::int[], 8, '2026-11-02', array['account'], 30, '2026-11-02'),
  (19, 'HBR-58',  'Practice area page templates', 'in_progress', 'high', 4, array[7], 1, '2026-11-11', array['web'], 720, '2026-10-19'),
  (20, 'HBR-60',  'Contact form spam protection', 'in_progress', 'urgent', 4, array[]::int[], 8, '2026-11-04', array['web'], 90, '2026-11-01'),
  (21, 'HBR-61',  'Migrate 40 blog posts to new site', 'todo', 'normal', 5, array[4], 4, '2026-11-25', array['web','content'], 600, '2026-10-30'),
  (22, 'HBR-63',  'Redirect map from old URLs', 'in_review', 'high', 2, array[]::int[], 4, '2026-11-09', array['technical'], 180, '2026-10-27'),
  (23, 'HBR-64',  'Attorney headshots retouching', 'done', 'normal', 7, array[]::int[], 8, '2026-10-28', array['design'], 240, '2026-10-20'),
  (24, 'NOV-12',  'Content calendar for November', 'in_review', 'high', 9, array[]::int[], 8, '2026-11-05', array['social'], 180, '2026-10-27'),
  (25, 'NOV-14',  'Gym opening video edit', 'in_progress', 'normal', 7, array[9], 9, '2026-11-13', array['social','design'], 300, '2026-10-29'),
  (26, 'NOV-15',  'Blog: 5 beginner mistakes at the gym', 'todo', 'low', 5, array[]::int[], 9, '2026-11-21', array['content'], 180, '2026-11-02'),
  (27, 'NOV-17',  'TikTok account setup and bio', 'blocked', 'normal', 9, array[]::int[], 8, '2026-11-01', array['social'], 60, '2026-10-26'),
  (28, 'NOV-18',  'Onboarding questionnaire follow-up', 'todo', 'normal', 1, array[]::int[], 1, '2026-11-06', array['account'], 45, '2026-11-01')
)
insert into public.tickets (id, key, title, status, priority, assignee_id, co_assignee_ids, reporter_id, due_date, tags, estimate_min, completed_at, created_at, updated_at)
select
  ('e0600000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  key, title, status, priority,
  ('00000000-0000-4000-8000-' || lpad(who::text, 12, '0'))::uuid,
  coalesce(array(select ('00000000-0000-4000-8000-' || lpad(c::text, 12, '0'))::uuid from unnest(co) c), '{}'),
  ('00000000-0000-4000-8000-' || lpad(rep::text, 12, '0'))::uuid,
  due::date, tags, est,
  case when status = 'done' then (due || ' 17:00:00+04')::timestamptz end,
  (created || ' 09:00:00+04')::timestamptz,
  (created || ' 09:00:00+04')::timestamptz
from t
on conflict (id) do nothing;

-- CPD-142 details
update public.tickets set
  description = 'Rewrite the implants and veneers service pages using the new keyword map. Keep the existing URLs. Pricing must match the October price list the client sent.',
  done_when = 'Both pages are live, pass QA, and the client has approved the pricing section.',
  start_date = '2026-10-27',
  source = 'Client request · Oct 26 call',
  reviewer_id = '00000000-0000-4000-8000-000000000002',
  review_round = 3,
  client_visible = true,
  client_title = 'New implants and veneers pages'
where id = 'e0600000-0000-4000-8000-000000000001' and description is null;

update public.tickets set
  description = 'Pull October rankings, traffic and leads into the monthly report template. Add three clear next steps.',
  done_when = 'Report is sent to Dr. Rania and logged on the client page.'
where id = 'e0600000-0000-4000-8000-000000000004' and description is null;

update public.tickets set
  description = '124 products are disapproved in Merchant Center for missing GTINs and price mismatch.',
  done_when = 'Feed shows zero errors for two days in a row.'
where id = 'e0600000-0000-4000-8000-000000000015' and description is null;

-- CPD-142 subtasks
insert into public.tickets (id, key, parent_id, title, status, priority, assignee_id, reporter_id, due_date, tags, created_at, updated_at)
values
  ('e0600000-0000-4000-8000-000000000101', 'CPD-152', 'e0600000-0000-4000-8000-000000000001', 'Implants page draft', 'done', 'normal', '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000008', '2026-10-29', '{content}', '2026-10-26 10:00+04', '2026-10-26 10:00+04'),
  ('e0600000-0000-4000-8000-000000000102', 'CPD-153', 'e0600000-0000-4000-8000-000000000001', 'Veneers page draft', 'done', 'normal', '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000008', '2026-10-30', '{content}', '2026-10-26 10:00+04', '2026-10-26 10:00+04'),
  ('e0600000-0000-4000-8000-000000000103', 'CPD-154', 'e0600000-0000-4000-8000-000000000001', 'On-page SEO pass', 'in_review', 'normal', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000008', '2026-11-03', '{onpage}', '2026-10-26 10:00+04', '2026-10-26 10:00+04'),
  ('e0600000-0000-4000-8000-000000000104', 'CPD-155', 'e0600000-0000-4000-8000-000000000001', 'Upload to CMS', 'todo', 'normal', '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000008', '2026-11-05', '{web}', '2026-10-26 10:00+04', '2026-10-26 10:00+04')
on conflict (id) do nothing;

-- ---------------------------------------------------------------- checklist
-- CPD-142 has its real list; other tickets get a short list sized like the mockup's done/total counts.
insert into public.checklist_items (ticket_id, label, done, position)
select 'e0600000-0000-4000-8000-000000000001', label, done, pos
from (values
  (1, 'Use client tone guide (warm, no jargon)', true),
  (2, 'Primary keyword in H1 and first 100 words', true),
  (3, 'Add FAQ block with 4 questions', true),
  (4, 'Internal links to booking and pricing pages', true),
  (5, 'Before / after image alt text', true),
  (6, 'Client sign-off on pricing claims', false)
) v (pos, label, done)
where not exists (select 1 from public.checklist_items where ticket_id = 'e0600000-0000-4000-8000-000000000001');

with ck (n, done_n, total) as (
  values (2,4,4),(3,0,5),(4,3,7),(5,0,10),(6,1,4),(7,6,9),(8,3,3),(9,0,4),(10,2,5),(11,3,3),(12,2,6),(13,4,8),(14,0,6),
         (15,5,9),(16,0,4),(17,7,7),(18,2,2),(19,9,14),(20,1,3),(21,0,40),(22,3,3),(23,12,12),(24,4,4),(25,2,5),(26,0,5),(27,1,3),(28,0,2)
),
steps (i, label) as (
  values (1,'Read the brief and client notes'),(2,'Agree scope with the lead'),(3,'First draft or build'),(4,'Self-check against the brief'),
         (5,'Internal review'),(6,'Fix review notes'),(7,'Client approval'),(8,'Publish or launch'),(9,'Check it is live and tracked'),
         (10,'Log the result on the client page'),(11,'Share in the client channel'),(12,'Update the report sheet'),
         (13,'Archive working files'),(14,'Close out with the account lead')
)
insert into public.checklist_items (ticket_id, label, done, position)
select ('e0600000-0000-4000-8000-' || lpad(ck.n::text, 12, '0'))::uuid,
       case when ck.total > 14 then 'Post ' || g.i || ' of ' || ck.total || ' migrated' else s.label end,
       g.i <= ck.done_n, g.i
from ck
cross join lateral generate_series(1, ck.total) g (i)
left join steps s on s.i = g.i
where not exists (
  select 1 from public.checklist_items x where x.ticket_id = ('e0600000-0000-4000-8000-' || lpad(ck.n::text, 12, '0'))::uuid
);

-- ---------------------------------------------------------------- watchers
insert into public.ticket_watchers (ticket_id, member_id) values
  ('e0600000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001'),
  ('e0600000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000008'),
  ('e0600000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'),
  ('e0600000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000001'),
  ('e0600000-0000-4000-8000-000000000015', '00000000-0000-4000-8000-000000000001'),
  ('e0600000-0000-4000-8000-000000000020', '00000000-0000-4000-8000-000000000008')
on conflict do nothing;

-- ---------------------------------------------------------------- comments (CPD-142 and a few others)
insert into public.comments (id, ticket_id, author_id, body, is_update, to_client, created_at, updated_at) values
  ('e0610000-0000-4000-8000-000000000001', 'e0600000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000008',
   'Dr. Rania confirmed the October price list is final. Attached in files.', false, true, '2026-11-02 11:20+04', '2026-11-02 11:20+04'),
  ('e0610000-0000-4000-8000-000000000002', 'e0600000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005',
   'Round 3 ready. Updated veneers price to AED 1,450 and added the FAQ block.', true, false, '2026-11-03 17:40+04', '2026-11-03 17:40+04'),
  ('e0610000-0000-4000-8000-000000000003', 'e0600000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
   'Pricing now matches. One alt text still says "image1". Fix that and I will approve.', false, false, '2026-11-04 10:12+04', '2026-11-04 10:12+04'),
  ('e0610000-0000-4000-8000-000000000004', 'e0600000-0000-4000-8000-000000000015', '00000000-0000-4000-8000-000000000003',
   'GTINs fixed for 80 items. Waiting on the client for the last 44 barcodes.', true, false, '2026-11-03 15:05+04', '2026-11-03 15:05+04'),
  ('e0610000-0000-4000-8000-000000000005', 'e0600000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000003',
   'Campaign built. Ads go live at 18:00 once the budget is confirmed.', true, false, '2026-11-04 09:30+04', '2026-11-04 09:30+04'),
  ('e0610000-0000-4000-8000-000000000006', 'e0600000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000004',
   'Blocked until the spam fix on HBR-60 ships; same form library.', false, false, '2026-11-01 12:00+04', '2026-11-01 12:00+04')
on conflict (id) do nothing;

insert into public.ticket_reads (ticket_id, member_id, read_at) values
  ('e0600000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '2026-11-04 10:30+04'),
  ('e0600000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005', '2026-11-04 10:20+04'),
  ('e0600000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000008', '2026-11-04 10:25+04'),
  ('e0600000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '2026-11-04 10:12+04')
on conflict do nothing;

-- ---------------------------------------------------------------- history (CPD-142); "created" rows come from the trigger
insert into public.ticket_history (id, ticket_id, actor_id, field, old_value, new_value, created_at) values
  ('e0620000-0000-4000-8000-000000000001', 'e0600000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'review_back', 'Missed the brief, Missing parts', 'FAQ block missing and H1 does not use the main keyword.', '2026-10-29 16:10+04'),
  ('e0620000-0000-4000-8000-000000000002', 'e0600000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'priority', 'normal', 'high', '2026-10-30 10:00+04'),
  ('e0620000-0000-4000-8000-000000000003', 'e0600000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005', 'time', null, '130', '2026-11-02 18:00+04'),
  ('e0620000-0000-4000-8000-000000000004', 'e0600000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'review_back', 'Accuracy', 'Veneers price says AED 1,200; client list says AED 1,450.', '2026-11-02 15:04+04'),
  ('e0620000-0000-4000-8000-000000000005', 'e0600000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005', 'checklist', null, 'Before / after image alt text', '2026-11-03 17:31+04'),
  ('e0620000-0000-4000-8000-000000000006', 'e0600000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005', 'review_submit', null, 'Pricing section updated to the October list. FAQ added.', '2026-11-04 09:58+04'),
  ('e0620000-0000-4000-8000-000000000007', 'e0600000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'status', 'in_progress', 'in_review', '2026-11-04 09:58+04')
on conflict (id) do nothing;

-- ---------------------------------------------------------------- time entries (this week and last)
insert into public.time_entries (id, member_id, ticket_id, date, minutes, billable, note) values
  ('e0630000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005', 'e0600000-0000-4000-8000-000000000001', '2026-10-28', 150, true, 'Implants page draft'),
  ('e0630000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000005', 'e0600000-0000-4000-8000-000000000001', '2026-11-02', 130, true, 'Round 2 fixes'),
  ('e0630000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000005', 'e0600000-0000-4000-8000-000000000001', '2026-11-03', 120, true, 'Round 3 and FAQ block'),
  ('e0630000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002', 'e0600000-0000-4000-8000-000000000004', '2026-11-03', 95, true, 'Pulled October data'),
  ('e0630000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000002', 'e0600000-0000-4000-8000-000000000013', '2026-11-02', 180, true, 'Serum keyword research'),
  ('e0630000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000003', 'e0600000-0000-4000-8000-000000000007', '2026-11-03', 240, true, 'Campaign build'),
  ('e0630000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000003', 'e0600000-0000-4000-8000-000000000015', '2026-11-03', 120, true, 'GTIN fixes'),
  ('e0630000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000004', 'e0600000-0000-4000-8000-000000000019', '2026-11-02', 300, true, 'Template build'),
  ('e0630000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000004', 'e0600000-0000-4000-8000-000000000020', '2026-11-03', 60, true, 'Honeypot and rate limit'),
  ('e0630000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000007', 'e0600000-0000-4000-8000-000000000008', '2026-11-02', 210, true, 'SUV creative set'),
  ('e0630000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000009', 'e0600000-0000-4000-8000-000000000024', '2026-11-03', 150, true, 'Calendar draft'),
  ('e0630000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000008', null, '2026-11-03', 45, false, 'Internal team meeting')
on conflict (id) do nothing;

-- ---------------------------------------------------------------- saved views
insert into public.saved_filters (id, member_id, department_id, name, query, shared) values
  ('e0640000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', null, 'My overdue', 'st=active&who=me&due=overdue', false),
  ('e0640000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', null, 'Waiting review', 'st=in_review', false),
  ('e0640000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002', 'd0000000-0000-4000-8000-000000000002', 'SEO this week', 'st=active&tag=technical&due=week', true)
on conflict (id) do nothing;

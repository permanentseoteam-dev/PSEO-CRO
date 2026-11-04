-- Seed 0107_work: projects, QA checklists, templates, recurring rules and review rounds from the mockup.
-- Today is 2026-11-04 (Asia/Dubai). Fixed ids:
--   projects        e0700000-0000-4000-8000-0000000000NN  (01 CPD, 02 ALB, 03 LUM, 04 HBR, 05 NOV, 06 ZST, 07 CNT)
--   qa_checklists   e0710000-0000-4000-8000-0000000000NN
--   templates       e0720000-0000-4000-8000-0000000000NN
--   recurring_rules e0730000-0000-4000-8000-0000000000NN
-- Clients use the fixed ids from 0108_clients (c0000000-...-0000000000NN); no FK yet, so order doesn't matter.

-- ---------------------------------------------------------------- projects
insert into public.projects (id, key, name, description, department_id, client_id, lead_id, reviewer_id, review_required, status) values
  ('e0700000-0000-4000-8000-000000000001', 'CPD', 'Cedar & Pine SEO', 'Monthly SEO retainer: on-page, content, local listings and reporting.',
    'd0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', true, 'active'),
  ('e0700000-0000-4000-8000-000000000002', 'ALB', 'Alba Motors Ads', 'Google Ads and Meta campaigns for the service centre and SUV range.',
    'd0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', true, 'active'),
  ('e0700000-0000-4000-8000-000000000003', 'LUM', 'Luma Growth', 'SEO and shopping ads for the skincare store.',
    'd0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', true, 'active'),
  ('e0700000-0000-4000-8000-000000000004', 'HBR', 'Harbor Website', 'New website build and migration for Harbor Legal.',
    'd0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', true, 'active'),
  ('e0700000-0000-4000-8000-000000000005', 'NOV', 'Nova Social', 'Social content, reels and community for the new gym.',
    'd0000000-0000-4000-8000-000000000008', 'c0000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000001', true, 'active'),
  ('e0700000-0000-4000-8000-000000000006', 'ZST', 'Zest Kitchen Search Ads', 'Search campaigns for delivery orders in Lahore and Karachi.',
    'd0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000003', null, false, 'active'),
  ('e0700000-0000-4000-8000-000000000007', 'CNT', 'Content Retainer 2025', 'Last year''s blog retainer. Finished in December.',
    'd0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005', null, false, 'archived')
on conflict (id) do nothing;

-- Tickets were seeded before projects existed: link them by key prefix now (also fills client_id).
-- tickets.client_id has an FK to clients (added in 0108), but the clients seed runs after this file.
-- Replica role skips FK checks for this one statement; 0108_clients seeds the same client ids.
set session_replication_role = replica;
select public.tickets_link_projects();
set session_replication_role = origin;

-- ---------------------------------------------------------------- QA checklists
insert into public.qa_checklists (id, name, services, items, active) values
  ('e0710000-0000-4000-8000-000000000001', 'SEO content QA', '{SEO,Content}',
    '{"Keyword placement matches brief","Meta title under 60 characters","Links tested","Images compressed","Spelling and grammar checked"}', true),
  ('e0710000-0000-4000-8000-000000000002', 'Web page QA', '{Web}',
    '{"Works at 390px","Forms submit and arrive","Links tested","Images compressed","Page speed above 80","Tracking fires","Redirects in place"}', true),
  ('e0710000-0000-4000-8000-000000000003', 'Ad launch QA', '{PPC}',
    '{"Budgets match the plan","Conversion tracking tested","Negative keywords added","Ad copy approved","Landing page live","Location targeting checked"}', true),
  ('e0710000-0000-4000-8000-000000000004', 'Social post QA', '{Social}',
    '{"Brand colours and fonts","Caption proofread","Hashtags agreed","Right size for each platform"}', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------- templates
-- n, name, service, pattern, dept, priority, due days, estimate, qa list, checklist, subtasks, uses, active
with t (n, name, svc, pattern, dept, pri, due, est, qa, ck, sub, uses, active, done_when) as (
  values
  (1, 'Monthly SEO report', 'SEO', '{client} SEO report · {month}', 2, 'high', 5, 180, 1,
    array['Export Search Console data','Export GA4 conversions','Update rank tracker','Write summary','Add next month plan','Design check','Send to client'],
    '[]'::jsonb, 38, true, 'Report sent to the client and logged in the client file.'),
  (2, 'Technical SEO audit', 'SEO', '{client} technical audit', 2, 'normal', 10, 600, 1,
    array['Crawl the site','Check indexing','Check Core Web Vitals','Check redirects','Check canonicals','Check sitemaps','Check robots.txt','Check structured data','Check internal links','Check hreflang','Prioritise fixes','Write summary'],
    '[{"title":"Crawl and export","due_offset_days":2},{"title":"Fix list for web team","due_offset_days":7},{"title":"Client walkthrough","due_offset_days":10}]'::jsonb, 9, true, 'Audit shared with the client and fixes ticketed.'),
  (3, 'Local citations batch', 'SEO', '{project} citations · {date}', 2, 'low', 14, 300, null,
    array['Pick 10 directories','Match NAP exactly','Add photos','Add opening hours','Add services','Verify listings','Log logins','Screenshot live listings','Update citation sheet','Note next batch'],
    '[]'::jsonb, 14, true, 'Ten listings live and logged in the citation sheet.'),
  (4, 'Blog post', 'Content', '{client} blog: {month}', 5, 'normal', 7, 240, 1,
    array['Brief approved','Outline','Draft','Internal links','Images with alt text','Meta title and description'],
    '[{"title":"Outline","due_offset_days":2},{"title":"Draft","due_offset_days":5}]'::jsonb, 52, true, 'Post published and shared with the client.'),
  (5, 'Service page rewrite', 'Content', '{client} service page rewrite', 5, 'high', 10, 360, 1,
    array['Keyword map checked','Draft','Pricing matches client list','FAQ block','Internal links','Client approval'],
    '[{"title":"Page draft","due_offset_days":3},{"title":"On-page SEO pass","due_offset_days":6},{"title":"Upload to CMS","due_offset_days":8},{"title":"Client approval","due_offset_days":10}]'::jsonb, 14, true, 'Pages live, QA passed and client approved.'),
  (6, 'Campaign launch', 'PPC', '{client} campaign launch · {date}', 3, 'urgent', 5, 420, 3,
    array['Brief approved','Keyword list','Negative keywords','Ad copy','Extensions','Conversion tracking','Budget set','Location targeting','Launch check'],
    '[{"title":"Ad copy for approval","due_offset_days":2},{"title":"Tracking test","due_offset_days":4}]'::jsonb, 21, true, 'Campaign live with tracking tested.'),
  (7, 'Weekly budget pacing', 'PPC', '{project} pacing · {date}', 3, 'low', 1, 30, null,
    array['Check spend against plan','Adjust bids','Note in client file'],
    '[]'::jsonb, 64, true, 'Spend within 5% of plan.'),
  (8, 'Landing page build', 'Web', '{client} landing page', 4, 'high', 10, 720, 2,
    array['Wireframe approved','Design approved','Build','Form test','Tracking','Speed check','Mobile check','Copy proofread','SEO basics','Client preview','Go live'],
    '[{"title":"Wireframe","due_offset_days":2},{"title":"Design","due_offset_days":5},{"title":"Build","due_offset_days":9}]'::jsonb, 7, true, 'Page live and form leads arriving.'),
  (9, 'WordPress plugin updates', 'Web', '{project} updates · {month}', 4, 'normal', 3, 60, 2,
    array['Backup','Update plugins','Update theme','Check forms','Check key pages'],
    '[]'::jsonb, 18, false, 'Everything updated and the site works.'),
  (10, 'Monthly content calendar', 'Social', '{client} content calendar · {month}', 8, 'normal', 5, 180, 4,
    array['Pick themes','Write captions','Design posts','Client approval'],
    '[{"title":"Design the posts","due_offset_days":4}]'::jsonb, 23, true, 'Calendar approved by the client.')
)
insert into public.templates (id, name, service, title_pattern, department_id, priority, due_in_days, estimate_min, qa_checklist_id,
  checklist, subtasks, uses, active, done_when, review_required)
select
  ('e0720000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  name, svc, pattern,
  ('d0000000-0000-4000-8000-' || lpad(dept::text, 12, '0'))::uuid,
  pri, due, est,
  case when qa is not null then ('e0710000-0000-4000-8000-' || lpad(qa::text, 12, '0'))::uuid end,
  ck, sub, uses, active, done_when, qa is not null
from t
on conflict (id) do nothing;

update public.templates
   set description = 'Pull rankings, traffic and conversions for {month}. Summarise wins and next steps for {client}.'
 where id = 'e0720000-0000-4000-8000-000000000001' and description is null;

-- ---------------------------------------------------------------- recurring rules
insert into public.recurring_rules (id, template_id, title_pattern, project_id, assignee_id, frequency, day, due_offset_days, start_date, next_run, paused, created_by) values
  ('e0730000-0000-4000-8000-000000000001', 'e0720000-0000-4000-8000-000000000001', '{client} SEO report · {month}', 'e0700000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'monthly', 1, 5, '2026-01-01', '2026-12-01', false, '00000000-0000-4000-8000-000000000002'),
  ('e0730000-0000-4000-8000-000000000002', 'e0720000-0000-4000-8000-000000000001', '{client} SEO report · {month}', 'e0700000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002', 'monthly', 1, 5, '2026-03-01', '2026-12-01', false, '00000000-0000-4000-8000-000000000002'),
  ('e0730000-0000-4000-8000-000000000003', 'e0720000-0000-4000-8000-000000000007', '{project} pacing · {date}', 'e0700000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', 'weekly', 1, 1, '2026-02-02', '2026-11-09', false, '00000000-0000-4000-8000-000000000003'),
  ('e0730000-0000-4000-8000-000000000004', 'e0720000-0000-4000-8000-000000000010', '{client} content calendar · {month}', 'e0700000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000009', 'monthly', 20, 5, '2026-09-20', '2026-11-20', false, '00000000-0000-4000-8000-000000000001'),
  ('e0730000-0000-4000-8000-000000000005', 'e0720000-0000-4000-8000-000000000009', '{project} updates · {month}', 'e0700000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000004', 'monthly', 15, 3, '2026-06-15', null, true, '00000000-0000-4000-8000-000000000004'),
  ('e0730000-0000-4000-8000-000000000006', 'e0720000-0000-4000-8000-000000000004', '{client} blog: {month}', 'e0700000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005', 'monthly', 5, 7, '2026-01-05', '2026-12-05', false, '00000000-0000-4000-8000-000000000001'),
  ('e0730000-0000-4000-8000-000000000007', null, 'Client inbox triage · {date}', 'e0700000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000008', 'weekdays', null, 0, '2026-04-01', '2026-11-05', false, '00000000-0000-4000-8000-000000000001')
on conflict (id) do nothing;

-- ---------------------------------------------------------------- review queue on the seeded tickets
-- Reviewers for in-review tickets that have none yet (CPD-142 already has Omar, round 3).
update public.tickets k set reviewer_id = v.reviewer::uuid, review_round = v.round
from (values
  ('e0600000-0000-4000-8000-000000000022', '00000000-0000-4000-8000-000000000001', 1), -- HBR-63
  ('e0600000-0000-4000-8000-000000000024', '00000000-0000-4000-8000-000000000001', 1), -- NOV-12
  ('e0600000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000001', 1), -- CPD-154
  ('e0600000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000003', 1), -- ALB-90
  ('e0600000-0000-4000-8000-000000000017', '00000000-0000-4000-8000-000000000002', 2)  -- LUM-219
) as v (id, reviewer, round)
where k.id = v.id::uuid and k.reviewer_id is null;

-- Review rounds. ticket n, round, owner n, reviewer n, status, reasons, submitted, decided
with r (n, round, owner, reviewer, status, reasons, sub, dec) as (
  values
  (1,   1, 5, 2, 'changes',  array['Missed the brief','Missing parts'], '2026-10-29 10:00', '2026-10-29 16:10'),
  (1,   2, 5, 2, 'changes',  array['Accuracy'],                         '2026-11-01 11:00', '2026-11-02 15:04'),
  (1,   3, 5, 2, 'waiting',  array[]::text[],                            '2026-11-04 09:58', null),
  (2,   1, 2, 1, 'approved', array[]::text[],                            '2026-10-29 15:00', '2026-10-30 10:00'),
  (11,  1, 3, 1, 'approved', array[]::text[],                            '2026-11-03 10:00', '2026-11-03 13:00'),
  (18,  1, 8, 1, 'approved', array[]::text[],                            '2026-11-02 12:00', '2026-11-02 15:00'),
  (23,  1, 7, 4, 'changes',  array['Brand or tone'],                     '2026-10-24 09:00', '2026-10-25 11:00'),
  (23,  2, 7, 4, 'approved', array[]::text[],                            '2026-10-27 10:00', '2026-10-28 09:00'),
  (101, 1, 5, 2, 'approved', array[]::text[],                            '2026-10-29 09:00', '2026-10-29 14:00'),
  (102, 1, 5, 2, 'changes',  array['Accuracy'],                          '2026-10-30 09:00', '2026-10-31 10:00'),
  (102, 2, 5, 2, 'approved', array[]::text[],                            '2026-11-01 09:00', '2026-11-01 12:00'),
  (19,  1, 4, 2, 'changes',  array['Missing parts'],                     '2026-10-28 09:00', '2026-10-30 01:00'),
  (13,  1, 2, 1, 'changes',  array['Missed the brief'],                  '2026-10-31 10:00', '2026-11-01 09:00'),
  (25,  1, 7, 9, 'changes',  array['Quality'],                           '2026-11-01 10:00', '2026-11-02 08:00'),
  (12,  1, 4, 3, 'changes',  array['Missing parts'],                     '2026-10-27 09:00', '2026-10-28 10:00'),
  (7,   1, 3, 1, 'changes',  array['Accuracy'],                          '2026-11-01 09:00', '2026-11-02 09:30'),
  (10,  1, 9, 1, 'changes',  array['Brand or tone','Quality'],           '2026-11-01 08:00', '2026-11-03 10:00'),
  (15,  1, 3, 2, 'changes',  array['Missed the brief'],                  '2026-10-25 10:00', '2026-10-26 09:00'),
  (17,  1, 4, 2, 'changes',  array['Quality'],                           '2026-10-30 10:00', '2026-10-31 12:00'),
  (17,  2, 4, 2, 'waiting',  array[]::text[],                            '2026-11-03 15:00', null),
  (22,  1, 2, 1, 'waiting',  array[]::text[],                            '2026-11-04 04:00', null),
  (24,  1, 9, 1, 'waiting',  array[]::text[],                            '2026-11-03 07:00', null),
  (103, 1, 2, 1, 'waiting',  array[]::text[],                            '2026-11-02 08:00', null),
  (8,   1, 7, 3, 'waiting',  array[]::text[],                            '2026-11-04 06:00', null)
)
insert into public.reviews (ticket_id, round, owner_id, reviewer_id, department_id, project_id, client_id, qa_checklist_id, status, reasons, submitted_at, decided_at)
select
  k.id, r.round,
  ('00000000-0000-4000-8000-' || lpad(r.owner::text, 12, '0'))::uuid,
  ('00000000-0000-4000-8000-' || lpad(r.reviewer::text, 12, '0'))::uuid,
  m.department_id, k.project_id, k.client_id,
  case split_part(k.key, '-', 1)
    when 'CPD' then 'e0710000-0000-4000-8000-000000000001'::uuid
    when 'LUM' then 'e0710000-0000-4000-8000-000000000001'::uuid
    when 'HBR' then 'e0710000-0000-4000-8000-000000000002'::uuid
    when 'ALB' then 'e0710000-0000-4000-8000-000000000003'::uuid
  end,
  r.status, r.reasons,
  (r.sub || '+04')::timestamptz,
  (r.dec || '+04')::timestamptz
from r
join public.tickets k on k.id = ('e0600000-0000-4000-8000-' || lpad(r.n::text, 12, '0'))::uuid
left join public.members m on m.id = ('00000000-0000-4000-8000-' || lpad(r.owner::text, 12, '0'))::uuid
on conflict (ticket_id, round) do nothing;

-- Rows the history trigger made during the tickets seed had no project yet.
update public.reviews v set project_id = k.project_id, client_id = k.client_id
from public.tickets k
where k.id = v.ticket_id and v.project_id is null and k.project_id is not null;

-- QA results for a few rounds (feeds "QA checks failed most" in phase 2).
insert into public.qa_results (review_id, item, passed)
select v.id, x.item, x.passed
from public.reviews v
join public.tickets k on k.id = v.ticket_id
join (values
  ('CPD-142', 1, 'Keyword placement matches brief', false),
  ('CPD-142', 1, 'Links tested', true),
  ('CPD-142', 2, 'Meta title under 60 characters', false),
  ('CPD-153', 1, 'Links tested', false),
  ('LUM-219', 1, 'Images compressed', false),
  ('HBR-58',  1, 'Links tested', false),
  ('ALB-96',  1, 'Conversion tracking tested', false)
) as x (key, round, item, passed) on x.key = k.key and x.round = v.round
where not exists (select 1 from public.qa_results q where q.review_id = v.id and q.item = x.item);

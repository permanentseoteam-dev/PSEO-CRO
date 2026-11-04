-- Seed 0204_work_p2: permission keys, workload settings and capacity, recurring rules, ticket extras.
-- Fixed ids: recurring rules e2040000-0000-4000-8000-0000000000NN.
-- Rows that need Phase 1 data (projects by key, tickets by key) join on it, so they are skipped when it's missing.
-- Today is 2026-11-04. Fictional names from docs/ui-preview/kit.js.

-- ---------------------------------------------------------------- permissions
insert into public.permissions (key, area, label) values
  ('work.workload.view',    'Work', 'See the workload view'),
  ('work.workload.manage',  'Work', 'Edit capacity and workload alert settings, handle alerts'),
  ('work.recurring.manage', 'Work', 'Create and edit recurring ticket rules')
on conflict (key) do nothing;

insert into public.role_permissions (role, perm_key, scope) values
  ('admin',     'work.workload.view',    'all'),
  ('admin',     'work.workload.manage',  'all'),
  ('admin',     'work.recurring.manage', 'all'),
  ('dept_head', 'work.workload.view',    'team'),
  ('dept_head', 'work.workload.manage',  'team'),
  ('dept_head', 'work.recurring.manage', 'team'),
  ('member',    'work.workload.view',    'own'),
  ('member',    'work.recurring.manage', 'own')
on conflict do nothing;

-- ---------------------------------------------------------------- workload
insert into public.workload_settings (singleton, overloaded_pct, overdue_count, has_room_pct, default_estimate_min)
values (true, 110, 2, 60, 60)
on conflict (singleton) do nothing;

insert into public.member_capacity (member_id, weekly_hours, workdays) values
  ('00000000-0000-4000-8000-000000000001', 30, '{1,2,3,4,5}'), -- Sara Malik
  ('00000000-0000-4000-8000-000000000002', 30, '{1,2,3,4,5}'), -- Omar Haddad
  ('00000000-0000-4000-8000-000000000003', 38, '{1,2,3,4,5}'), -- Ayesha Khan
  ('00000000-0000-4000-8000-000000000004', 35, '{1,2,3,4,5}'), -- Daniel Reyes
  ('00000000-0000-4000-8000-000000000005', 38, '{1,2,3,4,5}'), -- Priya Nair
  ('00000000-0000-4000-8000-000000000006', 38, '{1,2,3,4,5}'), -- Bilal Ahmed
  ('00000000-0000-4000-8000-000000000007', 38, '{1,2,3,4,5}'), -- Lina Saeed
  ('00000000-0000-4000-8000-000000000008', 30, '{1,2,3,4,5}'), -- Hamza Qureshi
  ('00000000-0000-4000-8000-000000000009', 38, '{1,2,3,4,5}'), -- Zara Farooq
  ('00000000-0000-4000-8000-000000000010', 20, '{1,2,3,4,5}')  -- Yusuf Ali
on conflict (member_id) do nothing;

-- ---------------------------------------------------------------- recurring rules (mockup "Recurring tickets")
insert into public.recurring_ticket_rules
  (id, title_pattern, description, project_id, assignee_id, priority, frequency, weekday, month_day, due_offset_days, starts_on, next_run, paused, created_by)
select r.id::uuid, r.pattern, r.descr, p.id, r.assignee::uuid, 'normal', r.freq, r.wd, r.md, r.offs, '2026-10-01'::date,
       public.recurring_next_run(r.freq, r.wd, r.md, '2026-11-04'::date), r.paused, '00000000-0000-4000-8000-000000000001'::uuid
from (values
  ('e2040000-0000-4000-8000-000000000001', '{client} SEO report · {month}', 'Pull rankings, traffic and conversions. Summarise wins and next steps.', 'CPD', '00000000-0000-4000-8000-000000000002', 'monthly', null::smallint, 1::smallint, 5, false),
  ('e2040000-0000-4000-8000-000000000002', '{client} SEO report · {month}', 'Pull rankings, traffic and conversions. Summarise wins and next steps.', 'LUM', '00000000-0000-4000-8000-000000000002', 'monthly', null, 1, 5, false),
  ('e2040000-0000-4000-8000-000000000003', '{project} pacing · {date}', 'Check spend against the monthly budget and adjust bids.', 'ALB', '00000000-0000-4000-8000-000000000003', 'weekly', 1, null, 1, false),
  ('e2040000-0000-4000-8000-000000000004', '{client} content calendar · {month}', 'Plan next month''s posts and send for approval.', 'NOV', '00000000-0000-4000-8000-000000000009', 'monthly', null, 20, 7, false),
  ('e2040000-0000-4000-8000-000000000005', '{project} updates · {month}', 'Update WordPress core and plugins, then check the site.', 'HBR', '00000000-0000-4000-8000-000000000004', 'monthly', null, 15, 3, true),
  ('e2040000-0000-4000-8000-000000000006', '{client} blog: {month}', null, 'CPD', '00000000-0000-4000-8000-000000000005', 'monthly', null, 5, 10, false),
  ('e2040000-0000-4000-8000-000000000007', 'Client inbox triage · {date}', 'Reply or ticket every client email from the last day.', 'CPD', '00000000-0000-4000-8000-000000000008', 'weekdays', null, null, 0, false)
) as r (id, pattern, descr, project_key, assignee, freq, wd, md, offs, paused)
join public.projects p on p.key = r.project_key
on conflict (id) do nothing;

-- ---------------------------------------------------------------- ticket extras (mockup ticket CPD-142)
-- Dependencies: CPD-142 is blocked by CPD-139 and blocks CPD-145.
insert into public.ticket_blockers (ticket_id, blocked_by_id, created_by)
select t.id, b.id, '00000000-0000-4000-8000-000000000005'::uuid
from (values ('CPD-142', 'CPD-139'), ('CPD-145', 'CPD-142')) as d (ticket_key, blocker_key)
join public.tickets t on t.key = d.ticket_key
join public.tickets b on b.key = d.blocker_key
on conflict (ticket_id, blocked_by_id) do nothing;

-- Co-assignees on CPD-142: Omar Haddad and Daniel Reyes.
insert into public.ticket_co_assignees (ticket_id, member_id, added_by)
select t.id, m.id::uuid, '00000000-0000-4000-8000-000000000005'::uuid
from public.tickets t
cross join (values ('00000000-0000-4000-8000-000000000002'), ('00000000-0000-4000-8000-000000000004')) as m (id)
where t.key = 'CPD-142'
on conflict (ticket_id, member_id) do nothing;

-- Client card on CPD-142.
insert into public.ticket_client_cards (ticket_id, client_id, show_in_portal, client_title, client_details, needs_approval, updated_by)
select t.id, p.client_id, true, 'New implants and veneers pages',
       'We are refreshing both pages so they rank for the treatments you want more bookings for.', true,
       '00000000-0000-4000-8000-000000000005'::uuid
from public.tickets t
join public.projects p on p.id = t.project_id
where t.key = 'CPD-142' and p.client_id is not null
on conflict (ticket_id) do nothing;

-- Scope decision on CPD-142.
insert into public.ticket_scope_flags (ticket_id, client_id, status, matched_term, reason, flagged_by)
select t.id, p.client_id, 'in_scope', 'Service page content', 'Covered by the monthly SEO content allowance.',
       '00000000-0000-4000-8000-000000000001'::uuid
from public.tickets t
join public.projects p on p.id = t.project_id
where t.key = 'CPD-142' and p.client_id is not null
on conflict (ticket_id) do nothing;

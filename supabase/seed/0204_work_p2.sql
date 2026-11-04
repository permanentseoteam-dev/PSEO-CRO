-- Seed 0204_work_p2: permission keys, workload settings and capacity, recurring rules, ticket extras.
-- Recurring rules are the 0107 seed rows (e0730000-…-0000000000NN); this only fills the Phase 2 columns.
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

-- ---------------------------------------------------------------- recurring rules (0107 seed rows)
update public.recurring_rules r set description = v.descr
from (values
  ('e0730000-0000-4000-8000-000000000001', 'Pull rankings, traffic and conversions. Summarise wins and next steps.'),
  ('e0730000-0000-4000-8000-000000000002', 'Pull rankings, traffic and conversions. Summarise wins and next steps.'),
  ('e0730000-0000-4000-8000-000000000003', 'Check spend against the monthly budget and adjust bids.'),
  ('e0730000-0000-4000-8000-000000000004', 'Plan next month''s posts and send for approval.'),
  ('e0730000-0000-4000-8000-000000000005', 'Update WordPress core and plugins, then check the site.'),
  ('e0730000-0000-4000-8000-000000000007', 'Reply or ticket every client email from the last day.')
) as v (id, descr)
where r.id = v.id::uuid and r.description is null;

-- ---------------------------------------------------------------- ticket extras (mockup ticket CPD-142)
-- Dependencies: CPD-142 is blocked by CPD-139 and blocks CPD-145.
insert into public.ticket_blockers (ticket_id, blocked_by_id, created_by)
select t.id, b.id, '00000000-0000-4000-8000-000000000005'::uuid
from (values ('CPD-142', 'CPD-139'), ('CPD-145', 'CPD-142')) as d (ticket_key, blocker_key)
join public.tickets t on t.key = d.ticket_key
join public.tickets b on b.key = d.blocker_key
on conflict (ticket_id, blocked_by_id) do nothing;

-- Co-assignees on CPD-142 (Omar Haddad, Daniel Reyes) are already in the 0106 seed (tickets.co_assignee_ids).

-- Client card on CPD-142 (columns on tickets).
update public.tickets
set client_visible = true,
    client_title = coalesce(client_title, 'New implants and veneers pages'),
    client_details = 'We are refreshing both pages so they rank for the treatments you want more bookings for.',
    client_needs_approval = true
where key = 'CPD-142' and client_details is null;

-- Scope decision on CPD-142.
insert into public.ticket_scope_flags (ticket_id, client_id, status, matched_term, reason, flagged_by)
select t.id, p.client_id, 'in_scope', 'Service page content', 'Covered by the monthly SEO content allowance.',
       '00000000-0000-4000-8000-000000000001'::uuid
from public.tickets t
join public.projects p on p.id = t.project_id
where t.key = 'CPD-142' and p.client_id is not null
on conflict (ticket_id) do nothing;

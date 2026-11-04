-- Seed 0207_hr_p2: permission keys and grants, shifts, title-change details, pay components, payslips, tools,
-- personal details and training paths. Matches docs/ui-preview/screens/team.js (Sara Malik's profile).
-- HR details, career steps, salaries, attendance, KPIs and review cycles come from the 0111/0112/0113 seeds;
-- this only fills the columns 0207 adds to them.
-- Fixed ids: e2070000-0000-4000-8000-0000000000NN (paths 01-03, steps 1N, assignments 2N, tools 3N, personal log 7N).
-- Today is 2026-11-04. Fictional names only. Safe to re-run.

-- ---------------------------------------------------------------- permissions
insert into public.permissions (key, area, label) values
  ('hr.records.manage',  'Team', 'Edit HR details, probation, title changes, tool access and exits'),
  ('hr.pay.view',        'Team', 'See other people''s pay and payslips'),
  ('hr.pay.manage',      'Team', 'Change pay and add payslips'),
  ('hr.personal.view',   'Team', 'See other people''s personal details'),
  ('perf.setup.manage',  'Team', 'Set up KPIs, review cycles and training paths')
on conflict (key) do nothing;

insert into public.role_permissions (role, perm_key, scope) values
  ('admin',        'hr.records.manage',  'all'),
  ('admin',        'hr.pay.view',        'all'),
  ('admin',        'hr.pay.manage',      'all'),
  ('admin',        'hr.personal.view',   'all'),
  ('admin',        'perf.setup.manage',  'all'),
  ('finance_head', 'hr.pay.view',        'all'),
  ('finance_head', 'hr.pay.manage',      'all'),
  ('finance_head', 'hr.personal.view',   'all'),
  ('dept_head',    'perf.setup.manage',  'team')
on conflict do nothing;

-- ---------------------------------------------------------------- shifts (0113 member_details)
update public.member_details set shift_start = '10:00', shift_end = '19:00'
 where member_id = '00000000-0000-4000-8000-000000000004' and shift_start = '09:00' and shift_end = '18:00';
update public.member_details set shift_start = '09:00', shift_end = '14:00'
 where member_id = '00000000-0000-4000-8000-000000000005' and shift_start = '09:00' and shift_end = '18:00';

-- ---------------------------------------------------------------- title changes (0113 career_steps rows for Sara Malik)
update public.career_steps c set old_title = v.old_title, old_department_id = v.dept::uuid, new_department_id = v.dept::uuid,
       post_congrats = true, congrats_posted_at = v.posted::timestamptz, created_by = '00000000-0000-4000-8000-000000000010'
from (values
  ('e1130000-0000-4000-8000-000000000002', 'Account Manager', 'd0000000-0000-4000-8000-000000000001', '2024-07-01 09:00+04'),
  ('e1130000-0000-4000-8000-000000000001', 'Senior Account Manager', 'd0000000-0000-4000-8000-000000000001', '2026-04-01 09:00+04')
) as v (id, old_title, dept, posted)
where c.id = v.id::uuid and c.old_title is null;

-- ---------------------------------------------------------------- pay components (0111 salaries; 60 / 25 / 5 / 5 / 5 of monthly_amount)
update public.salaries
   set basic = round(monthly_amount * 0.60, 2),
       house_rent = round(monthly_amount * 0.25, 2),
       utilities = round(monthly_amount * 0.05, 2),
       medical = round(monthly_amount * 0.05, 2),
       other = monthly_amount - round(monthly_amount * 0.60, 2) - round(monthly_amount * 0.25, 2) - 2 * round(monthly_amount * 0.05, 2)
 where basic = 0 and house_rent = 0 and utilities = 0 and medical = 0 and other = 0 and monthly_amount > 0;

-- Payslips from the current salary row.
insert into public.hr_payslips (member_id, month, gross, deductions, currency, created_by)
select s.member_id, v.month::date, s.monthly_amount, v.deductions, s.currency, '00000000-0000-4000-8000-000000000006'::uuid
from (values
  ('00000000-0000-4000-8000-000000000001', '2026-07-01', 0),
  ('00000000-0000-4000-8000-000000000001', '2026-08-01', 0),
  ('00000000-0000-4000-8000-000000000001', '2026-09-01', 0),
  ('00000000-0000-4000-8000-000000000001', '2026-10-01', 0),
  ('00000000-0000-4000-8000-000000000008', '2026-10-01', 25)
) as v (member_id, month, deductions)
join lateral (
  select member_id, monthly_amount, currency from public.salaries
   where member_id = v.member_id::uuid and valid_from <= v.month::date
   order by valid_from desc limit 1
) s on true
on conflict (member_id, month) do nothing;

-- ---------------------------------------------------------------- tools (logins only, never passwords)
insert into public.hr_tool_access (id, member_id, tool, login, access_level, granted_on, granted_by) values
  ('e2070000-0000-4000-8000-000000000031', '00000000-0000-4000-8000-000000000001', 'Google Workspace', 'sara@permanentseo.ae', 'Admin', '2023-03-12', '00000000-0000-4000-8000-000000000010'),
  ('e2070000-0000-4000-8000-000000000032', '00000000-0000-4000-8000-000000000001', 'Slack', 'sara@permanentseo.ae', 'Workspace admin', '2023-03-12', '00000000-0000-4000-8000-000000000010'),
  ('e2070000-0000-4000-8000-000000000033', '00000000-0000-4000-8000-000000000001', 'HubSpot', 'sara@permanentseo.ae', 'Sales editor', '2024-06-04', '00000000-0000-4000-8000-000000000010'),
  ('e2070000-0000-4000-8000-000000000034', '00000000-0000-4000-8000-000000000001', 'Semrush', 'team@permanentseo.ae', 'Viewer', '2025-01-10', '00000000-0000-4000-8000-000000000010'),
  ('e2070000-0000-4000-8000-000000000035', '00000000-0000-4000-8000-000000000001', 'Canva', 'sara@permanentseo.ae', 'Member', '2025-02-02', '00000000-0000-4000-8000-000000000010'),
  ('e2070000-0000-4000-8000-000000000036', '00000000-0000-4000-8000-000000000001', 'Xero', 'sara@permanentseo.ae', 'Read only', '2026-04-01', '00000000-0000-4000-8000-000000000006'),
  ('e2070000-0000-4000-8000-000000000037', '00000000-0000-4000-8000-000000000008', 'HubSpot', 'hamza@permanentseo.ae', 'Sales editor', '2026-06-01', '00000000-0000-4000-8000-000000000001')
on conflict (id) do nothing;

-- ---------------------------------------------------------------- personal details + change log
insert into public.hr_personal_details (member_id, date_of_birth, id_type, id_number, tax_number, bank_name, iban) values
  ('00000000-0000-4000-8000-000000000001', '1991-08-17', 'Emirates ID', '784-1991-4471321-1', 'PK 35202-8812345-6', 'Emirates NBD', 'AE07 0260 0010 1234 5674 521')
on conflict (member_id) do nothing;
-- The insert trigger logs a "system" row per field; swap those for the history shown in the mockup.
delete from public.hr_personal_changes
 where member_id = '00000000-0000-4000-8000-000000000001' and changed_by is null;
insert into public.hr_personal_changes (id, member_id, field, changed_by, created_at) values
  ('e2070000-0000-4000-8000-000000000071', '00000000-0000-4000-8000-000000000001', 'iban', '00000000-0000-4000-8000-000000000006', '2026-04-03 10:12+04'),
  ('e2070000-0000-4000-8000-000000000072', '00000000-0000-4000-8000-000000000001', 'id_number', '00000000-0000-4000-8000-000000000001', '2025-03-20 15:40+04'),
  ('e2070000-0000-4000-8000-000000000073', '00000000-0000-4000-8000-000000000001', 'tax_number', '00000000-0000-4000-8000-000000000006', '2023-03-15 11:05+04')
on conflict (id) do nothing;

-- ---------------------------------------------------------------- training paths
insert into public.hr_training_paths (id, name, created_by) values
  ('e2070000-0000-4000-8000-000000000001', 'Account manager to senior', '00000000-0000-4000-8000-000000000001'),
  ('e2070000-0000-4000-8000-000000000002', 'SEO basics for client success', '00000000-0000-4000-8000-000000000002'),
  ('e2070000-0000-4000-8000-000000000003', 'Google Ads certification', '00000000-0000-4000-8000-000000000003')
on conflict (id) do nothing;

insert into public.hr_training_steps (id, path_id, position, kind, title) values
  ('e2070000-0000-4000-8000-000000000011', 'e2070000-0000-4000-8000-000000000001', 1, 'course', 'Running client QBRs'),
  ('e2070000-0000-4000-8000-000000000012', 'e2070000-0000-4000-8000-000000000001', 2, 'video', 'Handling an unhappy client'),
  ('e2070000-0000-4000-8000-000000000013', 'e2070000-0000-4000-8000-000000000001', 3, 'reading', 'The Trusted Advisor, ch. 1–4'),
  ('e2070000-0000-4000-8000-000000000014', 'e2070000-0000-4000-8000-000000000001', 4, 'practice', 'Lead the Luma health-check call'),
  ('e2070000-0000-4000-8000-000000000015', 'e2070000-0000-4000-8000-000000000001', 5, 'certification', 'HubSpot Inbound'),
  ('e2070000-0000-4000-8000-000000000016', 'e2070000-0000-4000-8000-000000000002', 1, 'course', 'How Google ranks pages'),
  ('e2070000-0000-4000-8000-000000000017', 'e2070000-0000-4000-8000-000000000002', 2, 'reading', 'Reading a Search Console report'),
  ('e2070000-0000-4000-8000-000000000018', 'e2070000-0000-4000-8000-000000000002', 3, 'practice', 'Explain a ranking drop to a client'),
  ('e2070000-0000-4000-8000-000000000019', 'e2070000-0000-4000-8000-000000000003', 1, 'course', 'Google Ads fundamentals'),
  ('e2070000-0000-4000-8000-00000000001a', 'e2070000-0000-4000-8000-000000000003', 2, 'video', 'Search campaign walkthrough'),
  ('e2070000-0000-4000-8000-00000000001b', 'e2070000-0000-4000-8000-000000000003', 3, 'practice', 'Build a test campaign for Nova Fitness'),
  ('e2070000-0000-4000-8000-00000000001c', 'e2070000-0000-4000-8000-000000000003', 4, 'certification', 'Google Ads Search certification')
on conflict (id) do nothing;

insert into public.hr_training_assignments (id, path_id, member_id, assigned_by) values
  ('e2070000-0000-4000-8000-000000000021', 'e2070000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000010'),
  ('e2070000-0000-4000-8000-000000000022', 'e2070000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002'),
  ('e2070000-0000-4000-8000-000000000023', 'e2070000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000001'),
  ('e2070000-0000-4000-8000-000000000024', 'e2070000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000010')
on conflict (path_id, member_id) do nothing;

insert into public.hr_training_progress (assignment_id, step_id, done_at) values
  ('e2070000-0000-4000-8000-000000000021', 'e2070000-0000-4000-8000-000000000011', '2026-07-10 12:00+04'),
  ('e2070000-0000-4000-8000-000000000021', 'e2070000-0000-4000-8000-000000000012', '2026-08-02 12:00+04'),
  ('e2070000-0000-4000-8000-000000000021', 'e2070000-0000-4000-8000-000000000013', '2026-09-18 12:00+04'),
  ('e2070000-0000-4000-8000-000000000022', 'e2070000-0000-4000-8000-000000000016', '2026-10-05 12:00+04'),
  ('e2070000-0000-4000-8000-000000000024', 'e2070000-0000-4000-8000-000000000019', '2026-05-01 12:00+04'),
  ('e2070000-0000-4000-8000-000000000024', 'e2070000-0000-4000-8000-00000000001a', '2026-05-12 12:00+04'),
  ('e2070000-0000-4000-8000-000000000024', 'e2070000-0000-4000-8000-00000000001b', '2026-06-02 12:00+04'),
  ('e2070000-0000-4000-8000-000000000024', 'e2070000-0000-4000-8000-00000000001c', '2026-06-20 12:00+04')
on conflict (assignment_id, step_id) do nothing;

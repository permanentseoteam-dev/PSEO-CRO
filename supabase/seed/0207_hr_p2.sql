-- Seed 0207_hr_p2: permission keys and grants, HR details, pay, payslips, tools, personal details, clock,
-- KPIs, review cycles and training paths. Matches docs/ui-preview/screens/team.js (Sara Malik's profile).
-- Fixed ids: e2070000-0000-4000-8000-0000000000NN (paths 01-03, steps 1N, assignments 2N, tools 3N, cycles 4N, kpis 5N).
-- Today is 2026-11-04. Fictional names only. Safe to re-run.

-- ---------------------------------------------------------------- permissions
insert into public.permissions (key, area, label) values
  ('hr.records.manage',  'Team', 'Edit HR details, probation, title changes, tool access and exits'),
  ('hr.pay.view',        'Team', 'See other people''s pay and payslips'),
  ('hr.pay.manage',      'Team', 'Change pay and add payslips'),
  ('hr.personal.view',   'Team', 'See other people''s personal details'),
  ('hr.attendance.view', 'Team', 'See other people''s clock-in times'),
  ('perf.setup.manage',  'Team', 'Set up KPIs, review cycles and training paths')
on conflict (key) do nothing;

insert into public.role_permissions (role, perm_key, scope) values
  ('admin',        'hr.records.manage',  'all'),
  ('admin',        'hr.pay.view',        'all'),
  ('admin',        'hr.pay.manage',      'all'),
  ('admin',        'hr.personal.view',   'all'),
  ('admin',        'hr.attendance.view', 'all'),
  ('admin',        'perf.setup.manage',  'all'),
  ('finance_head', 'hr.pay.view',        'all'),
  ('finance_head', 'hr.pay.manage',      'all'),
  ('finance_head', 'hr.personal.view',   'all'),
  ('dept_head',    'hr.attendance.view', 'team'),
  ('dept_head',    'perf.setup.manage',  'team')
on conflict do nothing;

-- ---------------------------------------------------------------- HR details and probation
insert into public.hr_employment (member_id, contract, joined_on, shift_start, shift_end, location,
  probation_status, probation_start, probation_end, probation_decided_by, probation_decided_at) values
  ('00000000-0000-4000-8000-000000000001', 'full_time', '2023-03-12', '09:00', '18:00', 'Dubai office', 'confirmed', '2023-03-12', '2023-09-12', '00000000-0000-4000-8000-000000000010', '2023-09-12 09:00+04'),
  ('00000000-0000-4000-8000-000000000002', 'full_time', '2022-08-01', '09:00', '18:00', 'Dubai office', 'confirmed', '2022-08-01', '2023-02-01', '00000000-0000-4000-8000-000000000010', '2023-02-01 09:00+04'),
  ('00000000-0000-4000-8000-000000000003', 'full_time', '2024-01-15', '09:00', '18:00', 'Dubai office', 'confirmed', '2024-01-15', '2024-07-15', '00000000-0000-4000-8000-000000000010', '2024-07-15 09:00+04'),
  ('00000000-0000-4000-8000-000000000004', 'full_time', '2023-06-04', '10:00', '19:00', 'Remote', 'confirmed', '2023-06-04', '2023-12-04', '00000000-0000-4000-8000-000000000010', '2023-12-04 09:00+04'),
  ('00000000-0000-4000-8000-000000000005', 'part_time', '2025-02-10', '09:00', '14:00', 'Remote', 'confirmed', '2025-02-10', '2025-08-10', '00000000-0000-4000-8000-000000000001', '2025-08-10 09:00+04'),
  ('00000000-0000-4000-8000-000000000006', 'full_time', '2022-04-03', '09:00', '18:00', 'Dubai office', 'confirmed', '2022-04-03', '2022-10-03', '00000000-0000-4000-8000-000000000010', '2022-10-03 09:00+04'),
  ('00000000-0000-4000-8000-000000000007', 'contractor', '2025-09-01', '09:00', '18:00', 'Remote', 'confirmed', '2025-09-01', '2026-03-01', '00000000-0000-4000-8000-000000000010', '2026-03-01 09:00+04'),
  ('00000000-0000-4000-8000-000000000008', 'full_time', '2026-06-01', '09:00', '18:00', 'Dubai office', 'on_probation', '2026-06-01', '2026-12-01', null, null),
  ('00000000-0000-4000-8000-000000000009', 'full_time', '2026-05-20', '09:00', '18:00', 'Dubai office', 'on_probation', '2026-05-20', '2026-11-20', null, null),
  ('00000000-0000-4000-8000-000000000010', 'full_time', '2021-01-10', '09:00', '18:00', 'Dubai office', 'confirmed', '2021-01-10', '2021-01-10', null, null)
on conflict (member_id) do nothing;

insert into public.hr_title_changes (id, member_id, kind, effective_on, old_title, new_title, old_department_id, new_department_id, post_congrats, congrats_posted_at, created_by) values
  ('e2070000-0000-4000-8000-000000000061', '00000000-0000-4000-8000-000000000001', 'promotion', '2024-07-01', 'Account Manager', 'Senior Account Manager',
   'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', true, '2024-07-01 09:00+04', '00000000-0000-4000-8000-000000000010'),
  ('e2070000-0000-4000-8000-000000000062', '00000000-0000-4000-8000-000000000001', 'promotion', '2026-04-01', 'Senior Account Manager', 'Head of Client Success',
   'd0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', true, '2026-04-01 09:00+04', '00000000-0000-4000-8000-000000000010')
on conflict (id) do nothing;

-- ---------------------------------------------------------------- pay (60 / 25 / 5 / 5 / 5)
insert into public.hr_pay_records (member_id, effective_from, basic, house_rent, utilities, medical, other, currency, reason, created_by) values
  ('00000000-0000-4000-8000-000000000001', '2023-03-12', 6600, 2750, 550, 550, 550, 'AED', 'Joined', '00000000-0000-4000-8000-000000000006'),
  ('00000000-0000-4000-8000-000000000001', '2024-07-01', 8700, 3625, 725, 725, 725, 'AED', 'Promotion', '00000000-0000-4000-8000-000000000006'),
  ('00000000-0000-4000-8000-000000000001', '2026-04-01', 10800, 4500, 900, 900, 900, 'AED', 'Promotion', '00000000-0000-4000-8000-000000000006'),
  ('00000000-0000-4000-8000-000000000008', '2026-06-01', 4800, 2000, 400, 400, 400, 'AED', 'Joined', '00000000-0000-4000-8000-000000000006'),
  ('00000000-0000-4000-8000-000000000004', '2023-06-04', 270000, 112500, 22500, 22500, 22500, 'PKR', 'Joined', '00000000-0000-4000-8000-000000000006')
on conflict (member_id, effective_from) do nothing;

insert into public.hr_payslips (member_id, month, gross, deductions, currency, created_by) values
  ('00000000-0000-4000-8000-000000000001', '2026-07-01', 18000, 0, 'AED', '00000000-0000-4000-8000-000000000006'),
  ('00000000-0000-4000-8000-000000000001', '2026-08-01', 18000, 0, 'AED', '00000000-0000-4000-8000-000000000006'),
  ('00000000-0000-4000-8000-000000000001', '2026-09-01', 18000, 0, 'AED', '00000000-0000-4000-8000-000000000006'),
  ('00000000-0000-4000-8000-000000000001', '2026-10-01', 18000, 0, 'AED', '00000000-0000-4000-8000-000000000006'),
  ('00000000-0000-4000-8000-000000000008', '2026-10-01', 8000, 250, 'AED', '00000000-0000-4000-8000-000000000006')
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

-- ---------------------------------------------------------------- clock (today)
insert into public.hr_clock_days (member_id, work_date, clock_in_at, break_minutes) values
  ('00000000-0000-4000-8000-000000000001', '2026-11-04', '2026-11-04 08:56+04', 0),
  ('00000000-0000-4000-8000-000000000002', '2026-11-04', '2026-11-04 08:49+04', 0),
  ('00000000-0000-4000-8000-000000000006', '2026-11-04', '2026-11-04 08:58+04', 0),
  ('00000000-0000-4000-8000-000000000008', '2026-11-04', '2026-11-04 09:24+04', 0)
on conflict (member_id, work_date) do nothing;

-- ---------------------------------------------------------------- KPIs and review cycles
insert into public.hr_kpis (id, name, source, weight, direction, department_id) values
  ('e2070000-0000-4000-8000-000000000051', 'On-time delivery', 'portal', 25, 'higher', null),
  ('e2070000-0000-4000-8000-000000000052', 'Average client health', 'portal', 25, 'higher', 'd0000000-0000-4000-8000-000000000001'),
  ('e2070000-0000-4000-8000-000000000053', 'Replies within SLA', 'portal', 20, 'higher', 'd0000000-0000-4000-8000-000000000001'),
  ('e2070000-0000-4000-8000-000000000054', 'Upsells closed', 'manual', 15, 'higher', 'd0000000-0000-4000-8000-000000000001'),
  ('e2070000-0000-4000-8000-000000000055', 'Ad cost per lead', 'manual', 15, 'lower', 'd0000000-0000-4000-8000-000000000003')
on conflict (id) do nothing;

insert into public.hr_review_cycles (id, name, self_due, manager_due, status, opened_at, closed_at) values
  ('e2070000-0000-4000-8000-000000000041', 'Q4 2026', '2026-11-14', '2026-11-28', 'open', '2026-10-01 09:00+04', null),
  ('e2070000-0000-4000-8000-000000000042', 'Q3 2026', '2026-08-15', '2026-08-29', 'closed', '2026-07-01 09:00+04', '2026-09-01 09:00+04')
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

-- Seed 0113_personal: HR permission, profile extras, career, leave, documents, attendance, time entries
-- and timesheets matching the mockup (My profile as Sara Malik, Time, Settings). Today is 2026-11-04 (Asia/Dubai).
-- Ids: fixed rows use the prefix e1130000-…; generated rows use md5('<kind>-<member>-<date>')::uuid,
-- so a re-run inserts nothing new. Time entries go in before timesheets because submitted weeks are locked.

-- ---------------------------------------------------------------- permission
insert into public.permissions (key, area, label) values
  ('hr.manage', 'Team', 'Edit HR details, documents and leave balances')
on conflict (key) do nothing;

insert into public.role_permissions (role, perm_key, scope) values
  ('admin', 'hr.manage', 'all')
on conflict do nothing;

-- ---------------------------------------------------------------- profile extras
insert into public.member_details
  (member_id, bio, linkedin, emergency_name, emergency_phone, slack_user_id, location, contract,
   probation_start, probation_end, probation_status, probation_confirmed_by, job_summary, job_duties)
values
  ('00000000-0000-4000-8000-000000000001',
   'I look after our clients from signing to renewal, and I run the weekly client health review.',
   'linkedin.com/in/sara-malik-cs', 'Adeel Malik (brother)', '+971 50 663 2190', 'U04QJ7K2M1P', 'Dubai office', 'full_time',
   '2023-03-12', '2023-09-12', 'confirmed', '00000000-0000-4000-8000-000000000010',
   'Own the relationship with every retained client and keep them growing.',
   array['Run onboarding for new clients within 10 working days', 'Hold monthly reviews and send reports by the 5th',
         'Watch client health and act on anything below 60', 'Find and close upsells with the department leads',
         'Manage and coach the account executives']),
  ('00000000-0000-4000-8000-000000000002', 'Technical SEO lead. I fix crawl problems before they cost rankings.', 'linkedin.com/in/omar-haddad-seo',
   'Rana Haddad (wife)', '+971 55 310 9981', 'U04QJ7K2M2A', 'Dubai office', 'full_time', '2022-09-01', '2023-03-01', 'confirmed',
   '00000000-0000-4000-8000-000000000010', 'Lead SEO delivery across all retained clients.', array['Own technical audits', 'Review on-page work', 'Report rankings monthly']),
  ('00000000-0000-4000-8000-000000000004', null, null, 'Maria Reyes (mother)', '+63 917 555 0142', null, 'Remote, Lahore', 'contractor',
   '2023-11-06', '2024-02-06', 'confirmed', '00000000-0000-4000-8000-000000000010', 'Build and maintain client websites.', array['WordPress builds', 'Speed fixes', 'Site QA before launch']),
  ('00000000-0000-4000-8000-000000000007', null, null, 'Omar Saeed (father)', '+971 50 771 3022', null, 'Dubai office', 'full_time',
   '2025-02-10', '2025-08-10', 'confirmed', '00000000-0000-4000-8000-000000000010', 'Design ads, brand assets and social creative.', array['Ad creative sets', 'Brand kits', 'Retouching'])
on conflict (member_id) do nothing;

insert into public.career_steps (id, member_id, title, kind, on_date) values
  ('e1130000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Head of Client Success', 'promoted', '2026-04-01'),
  ('e1130000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'Senior Account Manager', 'promoted', '2024-07-01'),
  ('e1130000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', 'Account Manager', 'joined', '2023-03-12'),
  ('e1130000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002', 'SEO Lead', 'promoted', '2024-01-01'),
  ('e1130000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000002', 'SEO Specialist', 'joined', '2022-09-01')
on conflict (id) do nothing;

-- ---------------------------------------------------------------- leave balances (2026)
insert into public.leave_balances (member_id, year, type, allowance, per)
select m.id, 2026, b.type, b.allowance, b.per
from public.members m
cross join (values ('annual', 22.0, 'year'), ('sick', 10.0, 'year'), ('wfh', 4.0, 'month'), ('unpaid', 0.0, 'year')) as b (type, allowance, per)
where m.id in (
  '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000006',
  '00000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000009',
  '00000000-0000-4000-8000-000000000010')
on conflict do nothing;

-- ---------------------------------------------------------------- leave requests
insert into public.leave_requests (id, member_id, type, start_date, end_date, half_day, days, minutes, reason, status, decided_by, decided_at) values
  -- Sara: 8 of 22 annual used, 2 of 10 sick, 1 WFH this month, one waiting for Yusuf
  ('e1130000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000001', 'annual', '2026-12-22', '2026-12-24', false, 3,   null, 'Family visit', 'pending', null, null),
  ('e1130000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000001', 'sick',   '2026-10-15', '2026-10-15', false, 1,   null, 'Flu', 'approved', '00000000-0000-4000-8000-000000000010', '2026-10-15 07:10+04'),
  ('e1130000-0000-4000-8000-000000000103', '00000000-0000-4000-8000-000000000001', 'annual', '2026-08-10', '2026-08-14', false, 5,   null, 'Holiday', 'approved', '00000000-0000-4000-8000-000000000010', '2026-07-20 10:00+04'),
  ('e1130000-0000-4000-8000-000000000104', '00000000-0000-4000-8000-000000000001', 'annual', '2026-06-02', '2026-06-02', true,  0.5, null, 'Appointment', 'approved', '00000000-0000-4000-8000-000000000010', '2026-05-20 10:00+04'),
  ('e1130000-0000-4000-8000-000000000105', '00000000-0000-4000-8000-000000000001', 'annual', '2026-03-16', '2026-03-17', false, 2,   null, 'Eid break', 'approved', '00000000-0000-4000-8000-000000000010', '2026-03-02 10:00+04'),
  ('e1130000-0000-4000-8000-000000000106', '00000000-0000-4000-8000-000000000001', 'annual', '2026-01-05', '2026-01-05', true,  0.5, null, 'Bank appointment', 'approved', '00000000-0000-4000-8000-000000000010', '2025-12-22 10:00+04'),
  ('e1130000-0000-4000-8000-000000000107', '00000000-0000-4000-8000-000000000001', 'sick',   '2026-06-03', '2026-06-03', false, 1,   null, 'Migraine', 'approved', '00000000-0000-4000-8000-000000000010', '2026-06-03 08:00+04'),
  ('e1130000-0000-4000-8000-000000000108', '00000000-0000-4000-8000-000000000001', 'wfh',    '2026-11-03', '2026-11-03', false, 1,   null, 'Contractor at home', 'approved', '00000000-0000-4000-8000-000000000010', '2026-11-01 09:00+04'),
  -- Zara: on annual leave till 9 Nov
  ('e1130000-0000-4000-8000-000000000109', '00000000-0000-4000-8000-000000000009', 'annual', '2026-11-02', '2026-11-09', false, 6,   null, 'Family wedding in Lahore', 'approved', '00000000-0000-4000-8000-000000000001', '2026-10-12 11:00+04'),
  -- waiting for a decision (Approvals tab)
  ('e1130000-0000-4000-8000-000000000110', '00000000-0000-4000-8000-000000000008', 'annual', '2026-11-23', '2026-11-24', false, 2,   null, 'Sister''s graduation', 'pending', null, null),
  ('e1130000-0000-4000-8000-000000000111', '00000000-0000-4000-8000-000000000003', 'wfh',    '2026-11-06', '2026-11-06', false, 1,   null, 'Contractor visiting the flat', 'pending', null, null),
  ('e1130000-0000-4000-8000-000000000112', '00000000-0000-4000-8000-000000000003', 'overtime', '2026-11-03', '2026-11-03', false, 0, 120, 'Alba Motors launch went late', 'pending', null, null)
on conflict (id) do nothing;

-- ---------------------------------------------------------------- documents (no files in the seed; Open stays off)
insert into public.documents (id, member_id, name, type, hr_only, expires_on, uploaded_by, created_at) values
  ('e1130000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000001', 'Passport', 'id', false, '2031-05-14', '00000000-0000-4000-8000-000000000001', '2023-03-12 10:00+04'),
  ('e1130000-0000-4000-8000-000000000202', '00000000-0000-4000-8000-000000000001', 'Emirates ID', 'id', false, '2026-12-20', '00000000-0000-4000-8000-000000000001', '2023-03-12 10:05+04'),
  ('e1130000-0000-4000-8000-000000000203', '00000000-0000-4000-8000-000000000001', 'UAE residence visa', 'visa', false, '2027-03-02', '00000000-0000-4000-8000-000000000001', '2025-03-20 09:30+04'),
  ('e1130000-0000-4000-8000-000000000204', '00000000-0000-4000-8000-000000000001', 'Employment contract', 'contract', true, null, '00000000-0000-4000-8000-000000000010', '2023-03-12 11:00+04'),
  ('e1130000-0000-4000-8000-000000000205', '00000000-0000-4000-8000-000000000001', 'Promotion letter', 'letter', true, null, '00000000-0000-4000-8000-000000000010', '2026-04-01 09:00+04'),
  ('e1130000-0000-4000-8000-000000000206', '00000000-0000-4000-8000-000000000001', 'Degree certificate', 'education', false, null, '00000000-0000-4000-8000-000000000001', '2023-03-12 10:10+04')
on conflict (id) do nothing;

-- ---------------------------------------------------------------- attendance
-- Sara, October 2026: weekdays except 15 Oct (sick). A few late arrivals, one WFH day. Breaks of 45 minutes.
insert into public.attendance (id, member_id, clock_in, clock_out, break_minutes, wfh)
select md5('att-01-' || d::date)::uuid,
       '00000000-0000-4000-8000-000000000001',
       ((d::date + time '08:40' + make_interval(mins => case when extract(day from d)::int % 6 = 0 then 38 else (extract(day from d)::int * 7) % 30 end))::timestamp at time zone 'Asia/Dubai'),
       ((d::date + time '18:05' + make_interval(mins => (extract(day from d)::int * 11) % 40))::timestamp at time zone 'Asia/Dubai'),
       45,
       extract(day from d)::int = 22
from generate_series(date '2026-10-01', date '2026-10-31', interval '1 day') d
where extract(isodow from d) < 6 and d::date <> date '2026-10-15'
on conflict (id) do nothing;

-- Sara this week: Mon 520m, Tue 535m (WFH), today clocked in at 08:56 and still in.
insert into public.attendance (id, member_id, clock_in, clock_out, break_minutes, wfh) values
  ('e1130000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000001', '2026-11-02 08:52+04', '2026-11-02 18:12+04', 40, false),
  ('e1130000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000001', '2026-11-03 08:47+04', '2026-11-03 18:22+04', 40, true),
  ('e1130000-0000-4000-8000-000000000303', '00000000-0000-4000-8000-000000000001', '2026-11-04 08:56+04', null, 0, false)
on conflict (id) do nothing;

-- Everyone else: 26 Oct to 3 Nov, clocked minutes per day as in the Approvals tab (Zara is on leave from 2 Nov).
insert into public.attendance (id, member_id, clock_in, clock_out, break_minutes)
select md5('att-' || p.n || '-' || d::date)::uuid,
       ('00000000-0000-4000-8000-0000000000' || p.n)::uuid,
       ((d::date + time '08:50' + make_interval(mins => (p.n::int * 3 + extract(day from d)::int) % 20))::timestamp at time zone 'Asia/Dubai'),
       ((d::date + time '08:50' + make_interval(mins => (p.n::int * 3 + extract(day from d)::int) % 20 + p.mins + 45))::timestamp at time zone 'Asia/Dubai'),
       45
from (values ('01', 480), ('02', 492), ('03', 480), ('04', 432), ('05', 468), ('06', 480), ('07', 480), ('08', 480), ('09', 480)) as p (n, mins)
cross join generate_series(date '2026-10-26', date '2026-11-03', interval '1 day') d
where extract(isodow from d) < 6
  and not (p.n = '01' and d::date >= date '2026-11-02')
  and not (p.n = '09' and d::date >= date '2026-11-02')
on conflict (id) do nothing;

-- Open sessions today for people already in.
insert into public.attendance (id, member_id, clock_in) values
  ('e1130000-0000-4000-8000-000000000304', '00000000-0000-4000-8000-000000000002', '2026-11-04 08:49+04'),
  ('e1130000-0000-4000-8000-000000000305', '00000000-0000-4000-8000-000000000003', '2026-11-04 09:02+04'),
  ('e1130000-0000-4000-8000-000000000306', '00000000-0000-4000-8000-000000000005', '2026-11-04 08:58+04')
on conflict (id) do nothing;

-- ---------------------------------------------------------------- time entries
-- Sara this week (Mon 2 – Wed 4 Nov). Tickets from 0106 seed: 04 CPD-147, 07 ALB-88, 18 LUM-220, 22 HBR-63, 28 NOV-18.
insert into public.time_entries (id, member_id, ticket_id, date, minutes, billable, note)
select md5('te-01-' || x.t || '-' || x.d)::uuid, '00000000-0000-4000-8000-000000000001',
       case when x.t = '00' then null else ('e0600000-0000-4000-8000-0000000000' || x.t)::uuid end,
       x.d::date, x.m, x.t <> '00', x.note
from (values
  ('04', '2026-11-02', 95, 'Pulled numbers for the October report'), ('04', '2026-11-03', 40, 'Report review with Omar'), ('04', '2026-11-04', 30, 'Final edits'),
  ('07', '2026-11-02', 120, 'November ad plan with Ayesha'), ('07', '2026-11-03', 90, 'Budget sign-off call'), ('07', '2026-11-04', 45, 'Launch check'),
  ('18', '2026-11-02', 60, 'Health check call'), ('18', '2026-11-03', 75, 'Follow-up notes'),
  ('22', '2026-11-03', 45, 'Redirect map review'), ('22', '2026-11-04', 30, 'Sign-off prep'),
  ('28', '2026-11-02', 90, 'Onboarding questionnaire'), ('28', '2026-11-03', 60, 'Kick-off deck'), ('28', '2026-11-04', 40, 'Access checklist'),
  ('00', '2026-11-02', 45, 'Team 1:1s'), ('00', '2026-11-03', 90, 'Hiring interviews'), ('00', '2026-11-04', 30, 'Team 1:1s')
) as x (t, d, m, note)
on conflict (id) do nothing;

-- Week of 26 Oct for the timesheets waiting for approval: per day, billable minutes on a client ticket plus internal time.
insert into public.time_entries (id, member_id, ticket_id, date, minutes, billable, note)
select md5('te-' || p.n || '-' || k.kind || '-' || d::date)::uuid,
       ('00000000-0000-4000-8000-0000000000' || p.n)::uuid,
       case when k.kind = 'bill' then ('e0600000-0000-4000-8000-0000000000' || p.ticket)::uuid end,
       d::date,
       case when k.kind = 'bill' then p.bill else p.internal end,
       k.kind = 'bill',
       case when k.kind = 'bill' then 'Client work' else 'Internal meetings' end
from (values
  ('01', '04', 390, 66),   -- Sara
  ('02', '22', 396, 60),   -- Omar 1980 billable / 2280 logged
  ('03', '07', 204, 24),   -- Ayesha 1020 / 1140 (under half of clocked)
  ('04', '19', 120, 24),   -- Daniel 600 / 720
  ('05', '01', 360, 48),   -- Priya 1800 / 2040
  ('07', '08', 330, 60),   -- Lina
  ('08', '18', 270, 90),   -- Hamza 1350 / 1800
  ('09', '24', 300, 60)    -- Zara
) as p (n, ticket, bill, internal)
cross join (values ('bill'), ('int')) as k (kind)
cross join generate_series(date '2026-10-26', date '2026-10-30', interval '1 day') d
on conflict (id) do nothing;

-- Earlier October (1–23 Oct) for the month view and By client: one client ticket per day, rotating, plus 45m internal.
insert into public.time_entries (id, member_id, ticket_id, date, minutes, billable, note)
select md5('te-oct-' || p.n || '-' || d::date)::uuid,
       ('00000000-0000-4000-8000-0000000000' || p.n)::uuid,
       ('e0600000-0000-4000-8000-0000000000' || lpad((((p.n::int * 5 + extract(day from d)::int) % 28) + 1)::text, 2, '0'))::uuid,
       d::date,
       300 + ((p.n::int * 13 + extract(day from d)::int * 7) % 120),
       (p.n::int + extract(day from d)::int) % 5 <> 0,
       'Client work'
from (values ('01'), ('02'), ('03'), ('04'), ('05'), ('07'), ('08'), ('09')) as p (n)
cross join generate_series(date '2026-10-01', date '2026-10-23', interval '1 day') d
where extract(isodow from d) < 6 and not (p.n = '01' and d::date = date '2026-10-15')
on conflict (id) do nothing;

insert into public.time_entries (id, member_id, ticket_id, date, minutes, billable, note)
select md5('te-oct-int-' || p.n || '-' || d::date)::uuid, ('00000000-0000-4000-8000-0000000000' || p.n)::uuid, null, d::date, 45, false, 'Stand-ups and 1:1s'
from (values ('01'), ('02'), ('03'), ('04'), ('05'), ('07'), ('08'), ('09')) as p (n)
cross join generate_series(date '2026-10-01', date '2026-10-23', interval '1 day') d
where extract(isodow from d) < 6 and not (p.n = '01' and d::date = date '2026-10-15')
on conflict (id) do nothing;

-- ---------------------------------------------------------------- timesheets (after entries: submitted weeks are locked)
-- Earlier weeks approved; week of 26 Oct submitted for five people, approved for the rest. This week is open (no row).
insert into public.timesheets (member_id, week_start, status, submitted_at, decided_by, decided_at)
select ('00000000-0000-4000-8000-0000000000' || p.n)::uuid, w::date, 'approved',
       (w::date + 5 + time '17:00')::timestamp at time zone 'Asia/Dubai',
       case when p.n = '01' then '00000000-0000-4000-8000-000000000010'::uuid else '00000000-0000-4000-8000-000000000001'::uuid end,
       (w::date + 7 + time '10:00')::timestamp at time zone 'Asia/Dubai'
from (values ('01'), ('02'), ('03'), ('04'), ('05'), ('07'), ('08'), ('09')) as p (n)
cross join generate_series(date '2026-09-28', date '2026-10-19', interval '7 days') w
on conflict (member_id, week_start) do nothing;

insert into public.timesheets (member_id, week_start, status, submitted_at, decided_by, decided_at)
select ('00000000-0000-4000-8000-0000000000' || p.n)::uuid, date '2026-10-26',
       case when p.n in ('02', '03', '04', '05', '08') then 'submitted' else 'approved' end,
       '2026-10-30 17:30+04',
       case when p.n in ('02', '03', '04', '05', '08') then null
            when p.n = '01' then '00000000-0000-4000-8000-000000000010'::uuid
            else '00000000-0000-4000-8000-000000000001'::uuid end,
       case when p.n in ('02', '03', '04', '05', '08') then null else timestamptz '2026-11-02 10:00+04' end
from (values ('01'), ('02'), ('03'), ('04'), ('05'), ('07'), ('08'), ('09')) as p (n)
on conflict (member_id, week_start) do nothing;

-- 0112_team seed: directory extras, reporting lines, KPIs, OKRs, review cycles.
-- Fixed id prefixes (for other modules that want to refer to these rows):
--   new staff logins     00000000-0000-4000-8000-0000000012NN  (01 Noor Hassan, 02 Faisal Raza; not placed in the org chart yet)
--   kpis                 12000000-0000-4000-8000-0000000000NN
--   review_cycles        12100000-0000-4000-8000-0000000000NN  (01 Q4 2026, 02 Q3 2026)
--   okrs                 12200000-0000-4000-8000-0000000000NN
--   key_results          12300000-0000-4000-8000-0000000000NN
--   kr_checkins          12400000-0000-4000-8000-0000000000NN
-- Sample logins use the dev password Portal-dev-2026.

-- ---------------------------------------------------------------- permissions

insert into public.permissions (key, area, label) values
  ('performance.team.view', 'Team', 'See team performance'),
  ('performance.manage',    'Team', 'Manage KPIs, review cycles and team scores')
on conflict (key) do nothing;

insert into public.role_permissions (role, perm_key, scope) values
  ('admin',     'performance.team.view', 'all'),
  ('admin',     'performance.manage',    'all'),
  ('dept_head', 'performance.team.view', 'team'),
  ('dept_head', 'performance.manage',    'team')
on conflict do nothing;

-- ---------------------------------------------------------------- two new joiners (no manager, no department yet)

with people (n, email, name, title, joined) as (
  values
    (1, 'noor.hassan@permanentseo.test', 'Noor Hassan', 'Junior SEO Executive', date '2026-11-02'),
    (2, 'faisal.raza@permanentseo.test', 'Faisal Raza', 'Video Editor',         date '2026-10-27')
),
ids as (
  select p.*, ('00000000-0000-4000-8000-0000000012' || lpad(p.n::text, 2, '0'))::uuid as id from people p
),
u as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  )
  select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
    extensions.crypt('Portal-dev-2026', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('name', name), now(), now(),
    '', '', '', '', '', '', '', ''
  from ids
  on conflict (id) do nothing
  returning id
),
i as (
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select gen_random_uuid(), ids.id, ids.id::text,
    jsonb_build_object('sub', ids.id::text, 'email', ids.email, 'email_verified', true),
    'email', now(), now(), now()
  from ids join u on u.id = ids.id
  returning user_id
)
insert into public.members (id, email, name, title, presence, kind)
select ids.id, ids.email, ids.name, ids.title, 'available', 'staff'
from ids
where exists (select 1 from u where u.id = ids.id) or exists (select 1 from auth.users au where au.id = ids.id)
on conflict (id) do nothing;

insert into public.member_roles (member_id, role) values
  ('00000000-0000-4000-8000-000000001201', 'member'),
  ('00000000-0000-4000-8000-000000001202', 'member')
on conflict do nothing;

-- ---------------------------------------------------------------- reporting lines and presence (as in the mockup)
-- Ayesha, Daniel, Priya report to Omar; Zara to Sara; Lina has no manager yet.

update public.members m set manager_id = v.mgr, presence = v.presence
from (values
  ('00000000-0000-4000-8000-000000000001'::uuid, '00000000-0000-4000-8000-000000000010'::uuid, 'available'),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000010', 'focus'),
  ('00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002', 'meeting'),
  ('00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002', 'available'),
  ('00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000002', 'away'),
  ('00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000010', 'available'),
  ('00000000-0000-4000-8000-000000000007', null, 'sick'),
  ('00000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000001', 'meeting'),
  ('00000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000001', 'offline'),
  ('00000000-0000-4000-8000-000000000010', null, 'available')
) as v (id, mgr, presence)
where m.id = v.id;

-- ---------------------------------------------------------------- profiles

insert into public.member_profiles (member_id, status_note, skills, phone, joined_on, shift) values
  ('00000000-0000-4000-8000-000000000001', 'In the office today',     array['Account management', 'Client onboarding', 'Reporting'], '+971 50 214 7781', '2023-03-12', '09:00 to 18:00 GST'),
  ('00000000-0000-4000-8000-000000000002', 'Luma audit till 2pm',     array['Technical SEO', 'Link building', 'Search Console'],     '+971 55 310 4420', '2022-09-01', '09:00 to 18:00 GST'),
  ('00000000-0000-4000-8000-000000000003', 'Alba Motors weekly call', array['Google Ads', 'Meta Ads', 'GA4'],                        '+971 52 118 9034', '2024-01-15', '09:00 to 18:00 GST'),
  ('00000000-0000-4000-8000-000000000004', 'Harbor site QA',          array['WordPress', 'Elementor', 'Core Web Vitals'],            '+92 300 455 1290', '2023-11-06', '10:00 to 19:00 PKT'),
  ('00000000-0000-4000-8000-000000000005', 'Lunch, back 2:30',        array['Blog writing', 'On-page SEO', 'Arabic copy'],           '+971 56 702 3318', '2024-05-20', '09:00 to 18:00 GST'),
  ('00000000-0000-4000-8000-000000000006', 'Month-end close',         array['Invoicing', 'Payroll', 'Xero'],                         '+971 50 889 1402', '2022-04-03', '09:00 to 18:00 GST'),
  ('00000000-0000-4000-8000-000000000007', 'Back Thursday',           array['Figma', 'Brand design', 'Ad creatives'],                '+971 58 220 6671', '2025-02-10', '09:00 to 18:00 GST'),
  ('00000000-0000-4000-8000-000000000008', 'Cedar & Pine onboarding', array['Proposals', 'HubSpot', 'Upsells'],                      '+971 54 671 0095', '2025-06-01', '09:00 to 18:00 GST'),
  ('00000000-0000-4000-8000-000000000009', 'Annual leave till 9 Nov', array['Instagram', 'TikTok', 'Content calendars'],             '+971 55 903 7712', '2024-08-19', '09:00 to 18:00 GST'),
  ('00000000-0000-4000-8000-000000000010', 'Board prep from home',    array['Strategy', 'Sales', 'Hiring'],                          '+971 50 100 2020', '2021-01-04', 'Flexible'),
  ('00000000-0000-4000-8000-000000001201', 'Onboarding week',         array['Keyword research'],                                     '+971 55 418 2201', '2026-11-02', '09:00 to 18:00 GST'),
  ('00000000-0000-4000-8000-000000001202', 'Setting up his kit',      array['Premiere Pro', 'Reels'],                                '+92 301 772 9045', '2026-10-27', '10:00 to 19:00 PKT')
on conflict (member_id) do nothing;

-- ---------------------------------------------------------------- KPIs

insert into public.kpis (id, name, unit, direction, weight, source, department_id) values
  ('12000000-0000-4000-8000-000000000001', 'On-time delivery',         '%',   'higher', 25, 'portal', null),
  ('12000000-0000-4000-8000-000000000002', 'Average client health',    '',    'higher', 25, 'portal', 'd0000000-0000-4000-8000-000000000001'),
  ('12000000-0000-4000-8000-000000000003', 'Replies within SLA',       '%',   'higher', 20, 'portal', 'd0000000-0000-4000-8000-000000000001'),
  ('12000000-0000-4000-8000-000000000004', 'Upsells closed',           '',    'higher', 15, 'manual', 'd0000000-0000-4000-8000-000000000001'),
  ('12000000-0000-4000-8000-000000000005', 'First-time-right reviews', '%',   'higher', 15, 'portal', null),
  ('12000000-0000-4000-8000-000000000006', 'Ad cost per lead',         ' AED','lower',  15, 'manual', 'd0000000-0000-4000-8000-000000000003')
on conflict (id) do nothing;

-- Sara (Q4 and Q3), Hamza (Q4): all five Client Success KPIs.
insert into public.kpi_values (kpi_id, member_id, quarter, value, target) values
  ('12000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Q4 2026', 92, 95),
  ('12000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'Q4 2026', 67, 75),
  ('12000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', 'Q4 2026', 88, 90),
  ('12000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', 'Q4 2026', 2, 3),
  ('12000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000001', 'Q4 2026', 81, 85),
  ('12000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Q3 2026', 94, 95),
  ('12000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'Q3 2026', 70, 75),
  ('12000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', 'Q3 2026', 91, 90),
  ('12000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', 'Q3 2026', 3, 3),
  ('12000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000001', 'Q3 2026', 79, 85),
  ('12000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000008', 'Q4 2026', 90, 95),
  ('12000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000008', 'Q4 2026', 66, 75),
  ('12000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000008', 'Q4 2026', 86, 90),
  ('12000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000008', 'Q4 2026', 1, 2),
  ('12000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000008', 'Q4 2026', 72, 85)
on conflict (kpi_id, member_id, quarter) do nothing;

-- Everyone else in Q4: the two company-wide KPIs, scaled to give the mockup's spread of scores.
insert into public.kpi_values (kpi_id, member_id, quarter, value, target)
select k.id, p.id, 'Q4 2026', round(k.target * p.f), k.target
from (values
  ('00000000-0000-4000-8000-000000000002'::uuid, 0.88),
  ('00000000-0000-4000-8000-000000000003', 0.76),
  ('00000000-0000-4000-8000-000000000004', 0.54),
  ('00000000-0000-4000-8000-000000000005', 0.63),
  ('00000000-0000-4000-8000-000000000009', 0.71)
) as p (id, f)
cross join (values
  ('12000000-0000-4000-8000-000000000001'::uuid, 95),
  ('12000000-0000-4000-8000-000000000005', 85)
) as k (id, target)
on conflict (kpi_id, member_id, quarter) do nothing;

-- Ayesha also tracks ad cost per lead (lower is better): 46 AED against a 40 AED target.
insert into public.kpi_values (kpi_id, member_id, quarter, value, target) values
  ('12000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000003', 'Q4 2026', 46, 40)
on conflict (kpi_id, member_id, quarter) do nothing;

-- ---------------------------------------------------------------- review cycles and reviews

insert into public.review_cycles (id, quarter, self_due, manager_due, status) values
  ('12100000-0000-4000-8000-000000000001', 'Q4 2026', '2026-11-14', '2026-11-28', 'open'),
  ('12100000-0000-4000-8000-000000000002', 'Q3 2026', '2026-08-15', '2026-08-29', 'closed')
on conflict (id) do nothing;

insert into public.perf_reviews (cycle_id, member_id, reviewer_id, status, went_well, self_rating) values
  ('12100000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000001', 'shared',         'Ran the Cedar & Pine onboarding end to end.', 4),
  ('12100000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000001', 'self_review',    null, null),
  ('12100000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000010', 'acknowledged',   'Luma technical audit shipped on time.', 4),
  ('12100000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002', 'manager_review', 'Cut Alba Motors cost per lead by 18%.', 4),
  ('12100000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000002', 'self_review',    null, null),
  ('12100000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002', 'manager_review', 'Harbor Legal site went live.', 3),
  ('12100000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000010', 'self_review',    null, null)
on conflict (cycle_id, member_id) do nothing;

-- ---------------------------------------------------------------- OKRs (Q4 2026)

insert into public.okrs (id, title, owner_id, quarter, created_by) values
  ('12200000-0000-4000-8000-000000000001', 'Keep every client healthy through Q4', '00000000-0000-4000-8000-000000000001', 'Q4 2026', '00000000-0000-4000-8000-000000000001'),
  ('12200000-0000-4000-8000-000000000002', 'Grow revenue from existing clients',   '00000000-0000-4000-8000-000000000001', 'Q4 2026', '00000000-0000-4000-8000-000000000001'),
  ('12200000-0000-4000-8000-000000000003', 'Answer clients faster',                '00000000-0000-4000-8000-000000000008', 'Q4 2026', '00000000-0000-4000-8000-000000000001')
on conflict (id) do nothing;

insert into public.key_results (id, okr_id, position, title, progress, confidence) values
  ('12300000-0000-4000-8000-000000000001', '12200000-0000-4000-8000-000000000001', 1, 'Average health score from 64 to 75',             67,  'at_risk'),
  ('12300000-0000-4000-8000-000000000002', '12200000-0000-4000-8000-000000000001', 2, 'No client below 50 for more than 2 weeks',       80,  'on_track'),
  ('12300000-0000-4000-8000-000000000003', '12200000-0000-4000-8000-000000000001', 3, 'Monthly report sent by the 5th for all 6 clients', 100, 'on_track'),
  ('12300000-0000-4000-8000-000000000004', '12200000-0000-4000-8000-000000000002', 1, 'Close 3 upsells',                                67,  'on_track'),
  ('12300000-0000-4000-8000-000000000005', '12200000-0000-4000-8000-000000000002', 2, 'Renew Alba Motors for 12 months',                40,  'at_risk'),
  ('12300000-0000-4000-8000-000000000006', '12200000-0000-4000-8000-000000000002', 3, 'Add Content to 2 SEO-only clients',              0,   'off_track'),
  ('12300000-0000-4000-8000-000000000007', '12200000-0000-4000-8000-000000000003', 1, '90% of replies within 4 working hours',          88,  'on_track'),
  ('12300000-0000-4000-8000-000000000008', '12200000-0000-4000-8000-000000000003', 2, 'Typical answer under 2h',                        75,  'on_track')
on conflict (id) do nothing;

insert into public.kr_checkins (id, key_result_id, member_id, progress, confidence, note, created_at) values
  ('12400000-0000-4000-8000-000000000001', '12300000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 67, 'at_risk',  'Luma Skincare dropped to 44. Two clients still below target.', '2026-11-02 10:15+04'),
  ('12400000-0000-4000-8000-000000000002', '12300000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', 67, 'on_track', 'Nova Fitness added Content.',                                  '2026-11-03 16:40+04'),
  ('12400000-0000-4000-8000-000000000003', '12300000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000008', 88, 'on_track', 'Alba Motors replies all inside the window this week.',        '2026-11-03 12:05+04')
on conflict (id) do nothing;

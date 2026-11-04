-- Seed 0108_clients: sample clients matching docs/ui-preview (Client portfolio and the Alba Motors page).
-- Fixed ids:
--   clients        c0000000-0000-4000-8000-0000000000NN  (01 Cedar & Pine Dental, 02 Alba Motors, 03 Luma Skincare,
--                  04 Harbor Legal, 05 Nova Fitness, 06 Zest Kitchen, 07 Qamar Interiors, 08 Desert Bloom Florists,
--                  09 Peak Physio Clinic)
--   contacts       c1000000-0000-4000-8000-0000000000NN
--   timeline       c2000000-0000-4000-8000-0000000000NN
--   escalations    c3000000-0000-4000-8000-0000000000NN
--   client login   Karim Nassar (Alba Motors, client_owner), member 00000000-0000-4000-8000-000000000101,
--                  email karim@albamotors.ae, dev password Portal-dev-2026.
-- Today is 2026-11-04. Times are Asia/Dubai (+04).

-- ---------------------------------------------------------------- clients
insert into public.clients (id, name, site, services, country, channel, currency, status, start_date, end_date, end_reason,
  owner_id, manager_id, notes, health_score, health_band, health_factors, health_at, portal_color, portal_welcome) values
  ('c0000000-0000-4000-8000-000000000001', 'Cedar & Pine Dental', 'cedarpinedental.ae', '{SEO,Content}', 'UAE', 'email', 'AED', 'active',
    '2024-06-01', null, null, '00000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000002',
    'Two clinics in Jumeirah and JLT. Dr. Nadia approves all content.', 83, 'healthy',
    '[{"label":"Overdue work","points":-12},{"label":"Days since contact","points":-1},{"label":"Unanswered client waits","points":-4},{"label":"Overdue invoices","points":0},{"label":"Open escalations","points":0}]',
    '2026-11-04 03:00+04', null, null),
  ('c0000000-0000-4000-8000-000000000002', 'Alba Motors', 'albamotors.ae', '{PPC,Social}', 'UAE', 'whatsapp', 'AED', 'active',
    '2025-02-01', null, null, '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003',
    'Karim decides, Rania runs it. Always preview creatives 48h before launch. Never call before 10:00.', 61, 'watch',
    '[{"label":"Overdue work","points":-12},{"label":"Days since contact","points":0},{"label":"Unanswered client waits","points":-8},{"label":"Overdue invoices","points":-10},{"label":"Open escalations","points":-9}]',
    '2026-11-04 03:00+04', '#c8102e', 'Welcome back to your Alba Motors workspace'),
  ('c0000000-0000-4000-8000-000000000003', 'Luma Skincare', 'lumaskin.co', '{SEO,PPC,Design}', 'USA', 'email', 'USD', 'active',
    '2025-09-15', null, null, '00000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000002',
    'Founder-led DTC brand. Unhappy with Q3 ROAS. Wants weekly numbers by email.', 44, 'at_risk',
    '[{"label":"Overdue work","points":-18},{"label":"Days since contact","points":-10},{"label":"Unanswered client waits","points":-12},{"label":"Overdue invoices","points":-10},{"label":"Open escalations","points":-6}]',
    '2026-11-04 03:00+04', null, null),
  ('c0000000-0000-4000-8000-000000000004', 'Harbor Legal', 'harborlegal.co.uk', '{Web,SEO}', 'UK', 'email', 'USD', 'active',
    '2025-05-01', null, null, '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004',
    'Partners sign off on every page. Compliance review adds a week.', 77, 'healthy',
    '[{"label":"Overdue work","points":-6},{"label":"Days since contact","points":-3},{"label":"Unanswered client waits","points":-4},{"label":"Overdue invoices","points":-10},{"label":"Open escalations","points":0}]',
    '2026-11-04 03:00+04', null, null),
  ('c0000000-0000-4000-8000-000000000005', 'Nova Fitness', 'novafit.ae', '{Social,Content}', 'UAE', 'whatsapp', 'AED', 'onboarding',
    '2026-10-20', null, null, '00000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000009',
    'Three gyms in Dubai Marina. Launching a members app in January.', null, 'new', '[]', '2026-11-04 03:00+04', null, null),
  ('c0000000-0000-4000-8000-000000000006', 'Zest Kitchen', 'zestkitchen.pk', '{PPC}', 'Pakistan', 'whatsapp', 'PKR', 'active',
    '2025-11-01', null, null, '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003',
    'Cloud kitchen in Lahore. Orders through Foodpanda and their own site.', 69, 'watch',
    '[{"label":"Overdue work","points":-6},{"label":"Days since contact","points":-7},{"label":"Unanswered client waits","points":-8},{"label":"Overdue invoices","points":-10},{"label":"Open escalations","points":0}]',
    '2026-11-04 03:00+04', null, null),
  ('c0000000-0000-4000-8000-000000000007', 'Qamar Interiors', 'qamarinteriors.ae', '{SEO}', 'UAE', 'phone', 'AED', 'paused',
    '2025-03-01', null, null, '00000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000005',
    'Paused until the new showroom opens in Q1.', null, 'no_data', '[]', null, null, null),
  ('c0000000-0000-4000-8000-000000000008', 'Desert Bloom Florists', 'desertbloom.ae', '{Social}', 'UAE', 'whatsapp', 'AED', 'churned',
    '2025-01-15', '2026-06-30', 'Budget cut', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000009',
    'Budget cut after Q2.', null, 'no_data', '[]', null, null, null),
  ('c0000000-0000-4000-8000-000000000009', 'Peak Physio Clinic', 'peakphysio.com', '{SEO,Content}', 'USA', 'email', 'USD', 'churned',
    '2024-09-01', '2026-03-15', 'Moved in-house', '00000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000002',
    'Hired an in-house marketer.', null, 'no_data', '[]', null, null, null)
on conflict (id) do nothing;

-- ---------------------------------------------------------------- terms
insert into public.client_terms (client_id, monthly_fee, currency, term_months, term_start, notice_days, renewal_date, hours_per_month, in_scope, out_of_scope, agreement_name) values
  ('c0000000-0000-4000-8000-000000000001', 9500, 'AED', 12, '2024-06-01', 30, '2027-06-01', 45, 'Local SEO for two clinics, 4 blog posts a month, monthly report.', 'Paid ads, website rebuild.', 'Signed agreement 2024.pdf'),
  ('c0000000-0000-4000-8000-000000000002', 14000, 'AED', 12, '2025-02-01', 30, '2027-02-01', 60, 'Google Ads, Meta Ads, 5 social posts a week, monthly report, landing page edits.', 'New website builds, video shoots, SEO.', 'Signed agreement 2025.pdf'),
  ('c0000000-0000-4000-8000-000000000003', 4200, 'USD', 6, '2025-09-15', 30, '2026-03-15', 40, 'SEO, Google Shopping, banner design.', 'Email marketing, influencer outreach.', 'Signed agreement 2025.pdf'),
  ('c0000000-0000-4000-8000-000000000004', 3000, 'USD', 12, '2025-05-01', 60, '2027-05-01', 25, 'Website care, technical SEO, 2 practice-area pages a month.', 'Paid ads, social media.', 'Signed agreement 2025.pdf'),
  ('c0000000-0000-4000-8000-000000000005', 6000, 'AED', 6, '2026-10-20', 30, '2027-04-20', 30, '4 social posts a week, 2 blog posts a month.', 'Ads, website.', 'Signed agreement 2026.pdf'),
  ('c0000000-0000-4000-8000-000000000006', 450000, 'PKR', 12, '2025-11-01', 30, '2026-11-01', 30, 'Google Ads and Meta Ads for delivery orders.', 'Social content, SEO.', 'Signed agreement 2025.pdf'),
  ('c0000000-0000-4000-8000-000000000007', 5000, 'AED', 12, '2025-03-01', 30, null, 20, 'Local SEO.', 'Everything else.', null)
on conflict (client_id) do nothing;

-- ---------------------------------------------------------------- our team
insert into public.client_team (client_id, member_id, role) values
  ('c0000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'delivery_lead'),
  ('c0000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005', 'delivery'),
  ('c0000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000008', 'account_executive'),
  ('c0000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', 'delivery_lead'),
  ('c0000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000009', 'delivery'),
  ('c0000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000007', 'delivery'),
  ('c0000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'account_executive'),
  ('c0000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000008', 'backup'),
  ('c0000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002', 'delivery_lead'),
  ('c0000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000003', 'delivery'),
  ('c0000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000007', 'delivery'),
  ('c0000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000008', 'account_executive'),
  ('c0000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000004', 'delivery_lead'),
  ('c0000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002', 'delivery'),
  ('c0000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', 'account_executive'),
  ('c0000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000009', 'delivery_lead'),
  ('c0000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000005', 'delivery'),
  ('c0000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000008', 'account_executive'),
  ('c0000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000003', 'delivery_lead'),
  ('c0000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000001', 'account_executive'),
  ('c0000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000005', 'delivery_lead'),
  ('c0000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000008', 'account_executive')
on conflict do nothing;

-- ---------------------------------------------------------------- contacts
insert into public.client_contacts (id, client_id, name, role, email, phone, is_main, gets_reports) values
  ('c1000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'Rania Youssef', 'Marketing manager', 'rania@albamotors.ae', '+971 50 412 7781', true, true),
  ('c1000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 'Karim Nassar', 'Owner and CEO', 'karim@albamotors.ae', '+971 50 300 1122', false, true),
  ('c1000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002', 'Faisal Noor', 'Finance manager', 'accounts@albamotors.ae', '+971 4 338 9000', false, false),
  ('c1000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000002', 'Joseph Mathew', 'Sales manager, Sharjah', 'joseph@albamotors.ae', '+971 55 921 4410', false, false),
  ('c1000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000001', 'Dr. Nadia Rahman', 'Clinic director', 'nadia@cedarpinedental.ae', '+971 4 355 2210', true, true),
  ('c1000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000003', 'Megan Cole', 'Founder', 'megan@lumaskin.co', '+1 415 555 0142', true, true),
  ('c1000000-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-000000000004', 'James Whitfield', 'Managing partner', 'j.whitfield@harborlegal.co.uk', '+44 20 7946 0321', true, true),
  ('c1000000-0000-4000-8000-000000000008', 'c0000000-0000-4000-8000-000000000005', 'Omar Siddiqui', 'Co-founder', 'omar@novafit.ae', '+971 52 811 4090', true, true),
  ('c1000000-0000-4000-8000-000000000009', 'c0000000-0000-4000-8000-000000000006', 'Ali Raza', 'Owner', 'ali@zestkitchen.pk', '+92 300 845 1123', true, true),
  ('c1000000-0000-4000-8000-000000000010', 'c0000000-0000-4000-8000-000000000007', 'Huda Qamar', 'Owner', 'huda@qamarinteriors.ae', '+971 50 221 9087', true, false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------- timeline
insert into public.client_timeline (id, client_id, kind, happened_on, with_name, mood, body, decisions, concerns, action_items, created_by) values
  -- Alba Motors
  ('c2000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'whatsapp', '2026-11-03', 'Rania Youssef', 'neutral',
    'WhatsApp with Rania about Motor Show budget', null, null, '{}', '00000000-0000-4000-8000-000000000001'),
  ('c2000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 'escalation', '2026-10-31', null, null,
    'Escalation raised: lead form emails delayed (High)', null, null, '{}', '00000000-0000-4000-8000-000000000001'),
  ('c2000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002', 'meeting', '2026-10-28', 'Karim Nassar', 'unhappy',
    'Monthly call. Karim mentioned trimming spend in Q1', null, null, '{}', '00000000-0000-4000-8000-000000000001'),
  ('c2000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000002', 'meeting', '2026-10-14', 'Rania Youssef', 'happy',
    'Q3 business review presented', null, null, '{}', '00000000-0000-4000-8000-000000000003'),
  ('c2000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000002', 'email', '2026-10-02', 'Rania Youssef', 'happy',
    'September report sent and approved', null, null, '{}', '00000000-0000-4000-8000-000000000003'),
  ('c2000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000002', 'meeting_notes', '2026-10-28', null, null,
    'Monthly call', 'Move AED 5,000 from Meta to Google Search for November. Hold the SUV carousel.',
    '"We got the Patrol leads a day late, that cost us two sales."',
    '{"ALB-214 fix lead email routing (ticket)","Send stand dimensions (client to-do)","Price list for Q4 (client to-do)"}',
    '00000000-0000-4000-8000-000000000001'),
  ('c2000000-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-000000000002', 'meeting_notes', '2026-10-16', null, null,
    'Motor Show planning', 'Landing page with test-drive booking, live by 15 Nov.', null,
    '{"ALB-207 landing page design (ticket)","ALB-208 booking form (ticket)"}',
    '00000000-0000-4000-8000-000000000009'),
  -- Last contact for the other clients (matches the portfolio cards)
  ('c2000000-0000-4000-8000-000000000011', 'c0000000-0000-4000-8000-000000000001', 'email', '2026-11-01', 'Dr. Nadia Rahman', 'happy',
    'Sent the implants page draft for approval', null, null, '{}', '00000000-0000-4000-8000-000000000008'),
  ('c2000000-0000-4000-8000-000000000012', 'c0000000-0000-4000-8000-000000000003', 'call', '2026-10-23', 'Megan Cole', 'unhappy',
    'Founder unhappy with Q3 ROAS, asked for a rescue plan', null, null, '{}', '00000000-0000-4000-8000-000000000008'),
  ('c2000000-0000-4000-8000-000000000013', 'c0000000-0000-4000-8000-000000000004', 'meeting', '2026-10-30', 'James Whitfield', 'neutral',
    'Reviewed the new practice-area page structure', null, null, '{}', '00000000-0000-4000-8000-000000000001'),
  ('c2000000-0000-4000-8000-000000000014', 'c0000000-0000-4000-8000-000000000005', 'whatsapp', '2026-11-02', 'Omar Siddiqui', 'happy',
    'Shared the content calendar for November', null, null, '{}', '00000000-0000-4000-8000-000000000009'),
  ('c2000000-0000-4000-8000-000000000015', 'c0000000-0000-4000-8000-000000000006', 'whatsapp', '2026-10-26', 'Ali Raza', 'neutral',
    'Asked about the Foodpanda campaign budget', null, null, '{}', '00000000-0000-4000-8000-000000000001'),
  ('c2000000-0000-4000-8000-000000000016', 'c0000000-0000-4000-8000-000000000007', 'call', '2026-10-14', 'Huda Qamar', 'neutral',
    'Confirmed the pause until the showroom opens', null, null, '{}', '00000000-0000-4000-8000-000000000008')
on conflict (id) do nothing;

-- ---------------------------------------------------------------- escalations
insert into public.escalations (id, client_id, title, details, severity, owner_id, ticket_id, status, opened_at, due_at, closed_at, client_rating, created_by) values
  ('c3000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'Lead form emails delayed by a day',
    'Patrol leads reached the sales team a day late. Karim says it cost two sales.', 'high', '00000000-0000-4000-8000-000000000004',
    (select id from public.tickets where key = 'ALB-214'), 'open', '2026-10-31 10:00+04', '2026-11-02 17:00+04', null, null, '00000000-0000-4000-8000-000000000001'),
  ('c3000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 'Wrong price on Nissan Patrol ad',
    'Ad shows last year''s price. Client spotted it.', 'medium', '00000000-0000-4000-8000-000000000003',
    (select id from public.tickets where key = 'ALB-219'), 'open', '2026-11-03 15:00+04', '2026-11-06 12:00+04', null, null, '00000000-0000-4000-8000-000000000001'),
  ('c3000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002', 'Instagram story posted with old logo',
    null, 'low', '00000000-0000-4000-8000-000000000009', null, 'closed', '2026-09-12 11:00+04', '2026-09-23 11:00+04', '2026-09-14 16:00+04', 5, '00000000-0000-4000-8000-000000000001'),
  ('c3000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000002', 'Google Ads account suspended for 6 hours',
    null, 'critical', '00000000-0000-4000-8000-000000000003', null, 'closed', '2026-07-20 09:30+04', '2026-07-20 11:30+04', '2026-07-20 11:10+04', 4, '00000000-0000-4000-8000-000000000001'),
  ('c3000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000003', 'Shopping feed rejected for 124 products',
    'Products missing from Google Shopping since 28 Oct.', 'high', '00000000-0000-4000-8000-000000000003',
    (select id from public.tickets where key = 'LUM-215'), 'open', '2026-11-03 09:00+04', '2026-11-03 17:00+04', null, null, '00000000-0000-4000-8000-000000000008')
on conflict (id) do nothing;

-- ---------------------------------------------------------------- client login: Karim Nassar (Alba Motors, client_owner)
with ids (id, email, name) as (
  values ('00000000-0000-4000-8000-000000000101'::uuid, 'karim@albamotors.ae', 'Karim Nassar')
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
insert into public.members (id, email, name, title, kind, client_id)
select ids.id, ids.email, ids.name, 'Owner and CEO', 'client', 'c0000000-0000-4000-8000-000000000002'
from ids
where exists (select 1 from u where u.id = ids.id) or exists (select 1 from auth.users au where au.id = ids.id)
on conflict (id) do nothing;

insert into public.member_roles (member_id, role) values
  ('00000000-0000-4000-8000-000000000101', 'client_owner')
on conflict do nothing;

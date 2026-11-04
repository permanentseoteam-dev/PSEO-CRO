-- Seed 0201_client_success: commitments, relationship, reports, QBRs and delivery ratings.
-- Matches the client page mockup for Alba Motors (c0000000-...-02), with a little data for other clients.
-- Runs after 0108_clients (clients exist). Fixed ids use the prefix a201TTTT-0000-4000-8000-0000000000NN,
-- where TTTT is the table: 0001 commitments, 0002 checkins, 0003 people, 0004 dates, 0005 log, 0006 briefs,
-- 0007 social, 0008 opportunities, 0009 monthly reports, 0010 qbrs, 0011 delivery ratings.
-- Today is 2026-11-04. Fictional names only.

-- ---------------------------------------------------------------- permission
insert into public.permissions (key, area, label) values
  ('clients.reports.approve', 'Clients', 'Approve and send monthly client reports')
on conflict (key) do nothing;

insert into public.role_permissions (role, perm_key, scope) values
  ('admin', 'clients.reports.approve', 'all'),
  ('dept_head', 'clients.reports.approve', 'team')
on conflict do nothing;

-- ---------------------------------------------------------------- profiles
insert into public.client_success_profiles (client_id, tier, rapport, rapport_note, niche_profile, report_due_day, auto_send, report_recipient) values
  ('c0000000-0000-4000-8000-000000000002', 'A', 4, 'Strong with Rania, cooling with Karim',
   'New and certified pre-owned Nissan and Kia dealer, 2 showrooms (Sheikh Zayed Road, Sharjah Industrial 4). Peak demand in Ramadan and year-end. Buyers compare price on WhatsApp, so ads lead to a WhatsApp chat first. Average car value AED 118,000.',
   5, true, 'rania.youssef@albamotors.test'),
  ('c0000000-0000-4000-8000-000000000001', 'A', 5, 'Dr. Leen replies within the hour', null, 5, true, null),
  ('c0000000-0000-4000-8000-000000000003', 'B', 3, 'Quiet since the September report', null, 5, false, null)
on conflict (client_id) do nothing;

-- ---------------------------------------------------------------- commitments (Alba Motors)
insert into public.commitments (id, client_id, title, kind, cadence, target, latest, status, owner_id, client_visible, last_checkin_on) values
  ('a2010001-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'Qualified leads per month', 'kpi', 'monthly', '130', '142 (Oct)', 'met', '00000000-0000-4000-8000-000000000003', true, '2026-11-03'),
  ('a2010001-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 'Cost per lead under AED 300', 'kpi', 'monthly', 'AED 300', 'AED 269', 'on_track', '00000000-0000-4000-8000-000000000003', true, '2026-11-03'),
  ('a2010001-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002', '5 social posts a week', 'deliverable', 'weekly', '5', '4 this week', 'at_risk', '00000000-0000-4000-8000-000000000009', true, '2026-11-02'),
  ('a2010001-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000002', 'Monthly report by the 5th', 'deliverable', 'monthly', '5th', 'In review', 'on_track', '00000000-0000-4000-8000-000000000003', true, '2026-11-01'),
  ('a2010001-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000002', 'Quarterly business review', 'milestone', 'quarterly', 'Q3 by 15 Oct', 'Presented 14 Oct', 'met', '00000000-0000-4000-8000-000000000001', true, '2026-10-14'),
  ('a2010001-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000002', 'Motor Show landing page live', 'milestone', 'once', '15 Nov', 'Design in review', 'on_track', '00000000-0000-4000-8000-000000000007', true, '2026-10-30'),
  ('a2010001-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-000000000002', 'Meta lead form CPL under AED 180', 'kpi', 'monthly', 'AED 180', 'AED 212', 'missed', '00000000-0000-4000-8000-000000000003', false, '2026-11-03'),
  ('a2010001-0000-4000-8000-000000000008', 'c0000000-0000-4000-8000-000000000001', '20 Google reviews a month', 'kpi', 'monthly', '20', '17 (Oct)', 'at_risk', '00000000-0000-4000-8000-000000000002', true, '2026-11-02')
on conflict (id) do nothing;

-- Inserted oldest first so the trigger leaves each commitment on its newest check-in.
insert into public.commitment_checkins (id, commitment_id, client_id, value, status, note, checked_on, by_id) values
  ('a2010002-0000-4000-8000-000000000001', 'a2010001-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002', '4 this week', 'at_risk', 'One reel held for the client''s price approval.', '2026-11-02', '00000000-0000-4000-8000-000000000009'),
  ('a2010002-0000-4000-8000-000000000002', 'a2010001-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', '142 (Oct)', 'met', '142 leads in October. Search campaigns carried 61%.', '2026-11-03', '00000000-0000-4000-8000-000000000003'),
  ('a2010002-0000-4000-8000-000000000003', 'a2010001-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-000000000002', 'AED 212', 'missed', 'Audience fatigue on the SUV set; new creatives go live 7 Nov.', '2026-11-03', '00000000-0000-4000-8000-000000000003')
on conflict (id) do nothing;

-- ---------------------------------------------------------------- relationship (Alba Motors)
insert into public.relationship_people (id, client_id, name, role, decision_power, personal_notes, birthday) values
  ('a2010003-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'Karim Alba', 'Owner and CEO', 'Final say on budget', 'Plays padel Fridays. Two kids at GEMS Wellington. Prefers short WhatsApp voice notes.', '1979-12-14'),
  ('a2010003-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 'Rania Youssef', 'Marketing manager', 'Day-to-day approvals', 'Ex-agency, reads every report. Wants creative previews 48h ahead. Loves Lebanese food, vegetarian.', null),
  ('a2010003-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002', 'Faisal Noor', 'Finance manager', 'Approves invoices', 'Pays on the 25th. Needs PO numbers on every invoice. Email only.', null)
on conflict (id) do nothing;

insert into public.relationship_dates (id, client_id, person_id, title, on_date, yearly) values
  ('a2010004-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', null, 'Dubai Motor Show', '2026-11-18', false),
  ('a2010004-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', null, 'UAE National Day', '1971-12-02', true),
  ('a2010004-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002', null, 'Contract renewal', '2027-02-01', false),
  ('a2010004-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000002', null, 'Client since', '2025-02-01', true),
  ('a2010004-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000002', null, 'Showroom opening anniversary', '2019-03-09', true),
  ('a2010004-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000002', 'a2010003-0000-4000-8000-000000000002', 'Rania Youssef work anniversary', '2023-04-20', true)
on conflict (id) do nothing;

insert into public.relationship_log (id, client_id, person_id, kind, mood, note, on_date, by_id) values
  ('a2010005-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'a2010003-0000-4000-8000-000000000002', 'touch', 'neutral', 'WhatsApp check-in on Motor Show stand budget', '2026-11-03', '00000000-0000-4000-8000-000000000001'),
  ('a2010005-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 'a2010003-0000-4000-8000-000000000001', 'complaint', 'unhappy', 'Karim unhappy that lead emails arrived late', '2026-10-28', '00000000-0000-4000-8000-000000000001'),
  ('a2010005-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002', null, 'win', 'happy', 'Q3 review: leads up 34% year on year', '2026-10-14', '00000000-0000-4000-8000-000000000003'),
  ('a2010005-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000002', 'a2010003-0000-4000-8000-000000000002', 'card', null, 'Card for Rania''s 3-year work anniversary', '2026-04-20', '00000000-0000-4000-8000-000000000008'),
  ('a2010005-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000002', null, 'gift', null, 'Eid hamper to the showroom team', '2026-03-30', '00000000-0000-4000-8000-000000000001'),
  ('a2010005-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000002', 'a2010003-0000-4000-8000-000000000001', 'wish', null, 'Birthday message to Karim', '2025-12-14', '00000000-0000-4000-8000-000000000001')
on conflict (id) do nothing;

insert into public.meeting_briefs (id, client_id, title, meeting_on, points, by_id) values
  ('a2010006-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'Monthly review', '2026-11-05',
   E'Open with the October win: 142 leads, CPL down 12%.\nOwn the lead email delay; show the fix in ALB-214.\nKarim floated cutting Meta in Q1. Bring the Meta-assisted sales numbers.\nAsk for the Motor Show stand number and launch dates.\nPitch Alba Rentals search campaign (AED 4,000/month).',
   '00000000-0000-4000-8000-000000000001')
on conflict (id) do nothing;

insert into public.social_profiles (id, client_id, name, is_client, instagram_followers, ads_running, note) values
  ('a2010007-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'Alba Motors', true, 24900, 18, 'Reels outperform carousels 3 to 1'),
  ('a2010007-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 'Gulf Auto Hub', false, 61200, 42, 'Heavy 0% finance offers'),
  ('a2010007-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002', 'Marina Cars', false, 15400, 9, 'Strong Google reviews, 4.8 stars')
on conflict (id) do nothing;

insert into public.client_opportunities (id, client_id, title, value, currency, billing, stage, stage_note, owner_id) values
  ('a2010008-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'Alba Rentals search ads', 4000, 'AED', 'monthly', 'pitch', 'Pitch on 5 Nov', '00000000-0000-4000-8000-000000000001'),
  ('a2010008-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 'SEO for pre-owned inventory pages', 6500, 'AED', 'monthly', 'idea', null, '00000000-0000-4000-8000-000000000002'),
  ('a2010008-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002', 'Motor Show stand video', 9000, 'AED', 'once', 'quote_sent', null, '00000000-0000-4000-8000-000000000007')
on conflict (id) do nothing;

-- ---------------------------------------------------------------- reports
insert into public.monthly_reports (id, client_id, month, status, due_on, owner_id, auto_send, had_changes, summary, highlights, plan, approved_by, approved_at, sent_at) values
  ('a2010009-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', '2026-10-01', 'submitted', '2026-11-05', '00000000-0000-4000-8000-000000000003', true, false,
   '142 qualified leads (+18%), cost per lead AED 269 (-12%), ad spend AED 38,200.',
   E'142 qualified leads, up 18% on September.\nCost per lead down to AED 269.\nSearch campaigns drove 61% of leads.',
   E'Motor Show landing page and test-drive ads from 15 Nov.\nShift AED 5,000 from Meta to Search.', null, null, null),
  ('a2010009-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', '2026-09-01', 'sent', '2026-10-05', '00000000-0000-4000-8000-000000000003', true, false,
   '120 qualified leads, cost per lead AED 305.', 'Patrol campaign launched.', 'Motor Show planning.', '00000000-0000-4000-8000-000000000001', '2026-10-02 08:00+04', '2026-10-02 09:00+04'),
  ('a2010009-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002', '2026-08-01', 'sent', '2026-09-05', '00000000-0000-4000-8000-000000000003', true, true,
   '108 qualified leads.', 'Search impression share up to 71%.', 'Patrol campaign.', '00000000-0000-4000-8000-000000000001', '2026-09-04 12:00+04', '2026-09-04 13:00+04'),
  ('a2010009-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000002', '2026-07-01', 'sent', '2026-08-05', '00000000-0000-4000-8000-000000000003', false, false,
   '96 qualified leads.', 'Summer service offer.', 'Search restructure.', '00000000-0000-4000-8000-000000000001', '2026-08-03 10:00+04', '2026-08-03 11:00+04'),
  ('a2010009-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000003', '2026-10-01', 'draft', '2026-11-05', '00000000-0000-4000-8000-000000000002', false, false,
   null, null, null, null, null, null)
on conflict (id) do nothing;

insert into public.qbrs (id, client_id, quarter, status, meeting_on, deck_url) values
  ('a2010010-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', '2026-Q4', 'draft', '2027-01-15', null),
  ('a2010010-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', '2026-Q3', 'presented', '2026-10-14', null),
  ('a2010010-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002', '2026-Q2', 'presented', '2026-07-10', null)
on conflict (id) do nothing;

-- ---------------------------------------------------------------- delivery ratings (departments: 03 PPC, 07 Design, 08 Social)
insert into public.delivery_ratings (id, client_id, month, department_id, quality, on_time, communication, rated_by, rated_by_name) values
  ('a2010011-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', '2026-10-01', 'd0000000-0000-4000-8000-000000000003', 4, 3, 4, null, 'Rania Youssef'),
  ('a2010011-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', '2026-10-01', 'd0000000-0000-4000-8000-000000000008', 4, 4, 5, null, 'Rania Youssef'),
  ('a2010011-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002', '2026-10-01', 'd0000000-0000-4000-8000-000000000007', 5, 4, 5, null, 'Rania Youssef'),
  ('a2010011-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000002', '2026-09-01', 'd0000000-0000-4000-8000-000000000003', 5, 4, 5, null, 'Rania Youssef'),
  ('a2010011-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000002', '2026-09-01', 'd0000000-0000-4000-8000-000000000008', 4, 4, 4, null, 'Rania Youssef'),
  ('a2010011-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000002', '2026-08-01', 'd0000000-0000-4000-8000-000000000003', 4, 4, 4, null, 'Karim Alba')
on conflict (id) do nothing;

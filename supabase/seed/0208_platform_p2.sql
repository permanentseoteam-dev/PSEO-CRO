-- 0208_platform_p2 seed: announcements, getting-started ticks, pipeline deals, API keys (fake hashes, no usable
-- keys), notifications log, integration connections (all not configured), Fireflies calls and inbox triage rows.
-- Fixed ids: e8000000-0000-4000-8000-0000000000NN. Today is 2026-11-04.
-- Clients come from the 0108_clients seed (c0000000-...-02 Alba Motors, 03 Luma Skincare, 01 Cedar & Pine Dental).

insert into public.permissions (key, area, label) values
  ('home.announcements.post', 'Core', 'Post announcements on Home (own = own department, all = everyone)')
on conflict do nothing;
insert into public.role_permissions (role, perm_key, scope) values
  ('admin', 'home.announcements.post', 'all'),
  ('finance_head', 'home.announcements.post', 'own'),
  ('dept_head', 'home.announcements.post', 'own')
on conflict do nothing;

-- ---------------------------------------------------------------- announcements
insert into public.announcements (id, title, body, department_id, pinned, expires_on, author_id, created_at) values
  ('e8000000-0000-4000-8000-000000000001', 'Office closed 1–3 December',
   'Commemoration Day and National Day. Client meetings move to 4 December.',
   null, true, '2026-12-04', '00000000-0000-4000-8000-000000000010', '2026-11-02 09:00:00+04'),
  ('e8000000-0000-4000-8000-000000000002', 'New time-logging rule',
   'Log time on the ticket, not in a spreadsheet. Weekly totals go to finance every Friday.',
   null, false, '2026-11-30', '00000000-0000-4000-8000-000000000006', '2026-11-03 10:15:00+04'),
  ('e8000000-0000-4000-8000-000000000003', 'SEO stand-up moves to 09:30',
   'From Monday the SEO stand-up starts at 09:30 in the seo-team huddle.',
   'd0000000-0000-4000-8000-000000000002', false, '2026-11-15', '00000000-0000-4000-8000-000000000002', '2026-11-04 08:40:00+04'),
  ('e8000000-0000-4000-8000-000000000004', 'October payroll is out',
   'Payslips are in your profile.', null, false, '2026-10-31', '00000000-0000-4000-8000-000000000006', '2026-10-28 12:00:00+04')
on conflict (id) do nothing;

-- ---------------------------------------------------------------- getting started (Sara: 4 of 6)
insert into public.onboarding_steps (member_id, step, done_at) values
  ('00000000-0000-4000-8000-000000000001', 'photo', '2026-09-01 10:00:00+04'),
  ('00000000-0000-4000-8000-000000000001', 'calendar', '2026-09-01 10:05:00+04'),
  ('00000000-0000-4000-8000-000000000001', 'hours', '2026-09-01 10:07:00+04'),
  ('00000000-0000-4000-8000-000000000001', 'channel', '2026-09-02 09:00:00+04')
on conflict do nothing;

-- ---------------------------------------------------------------- pipeline (Sara and Hamza)
insert into public.pipeline_deals (id, name, service, stage, value, currency, owner_id, expected_on) values
  ('e8000000-0000-4000-8000-000000000011', 'Desert Rose Interiors', 'SEO + Content retainer', 'proposal', 18000, 'AED', '00000000-0000-4000-8000-000000000001', '2026-11-20'),
  ('e8000000-0000-4000-8000-000000000012', 'Orbit Logistics', 'PPC management', 'negotiation', 22500, 'AED', '00000000-0000-4000-8000-000000000001', '2026-11-28'),
  ('e8000000-0000-4000-8000-000000000013', 'Falcon Realty', 'Website rebuild', 'discovery', 21000, 'AED', '00000000-0000-4000-8000-000000000001', '2026-12-15'),
  ('e8000000-0000-4000-8000-000000000014', 'Mint Pharmacy', 'Local SEO', 'won', 8500, 'AED', '00000000-0000-4000-8000-000000000001', '2026-11-01'),
  ('e8000000-0000-4000-8000-000000000015', 'Summit Clinics', 'Google Ads', 'proposal', 2400, 'USD', '00000000-0000-4000-8000-000000000008', '2026-11-25')
on conflict (id) do nothing;

-- ---------------------------------------------------------------- API keys (hashes of no real key)
insert into public.api_keys (id, name, prefix, key_hash, scopes, created_by, last_used_at, revoked_at, revoked_by, created_at) values
  ('e8000000-0000-4000-8000-000000000021', 'Looker Studio sync', 'pk_lk4s7q',
   repeat('a1', 32), array['time.view', 'clients.view'], '00000000-0000-4000-8000-000000000010',
   '2026-11-04 06:00:00+04', null, null, '2026-09-04 11:00:00+04'),
  ('e8000000-0000-4000-8000-000000000022', 'Zapier invoices', 'pk_zp8m2x',
   repeat('b2', 32), array['finance.invoices.view'], '00000000-0000-4000-8000-000000000006',
   '2026-11-02 14:10:00+04', null, null, '2026-07-12 09:30:00+04'),
  ('e8000000-0000-4000-8000-000000000023', 'Old reporting script', 'pk_old9a1',
   repeat('c3', 32), array['tickets.view'], '00000000-0000-4000-8000-000000000010',
   '2026-05-30 08:00:00+04', '2026-06-01 10:00:00+04', '00000000-0000-4000-8000-000000000010', '2026-01-10 09:00:00+04')
on conflict (id) do nothing;

-- ---------------------------------------------------------------- notifications log
insert into public.notification_deliveries (id, member_id, to_address, channel, message, result, error, sent_at) values
  ('e8000000-0000-4000-8000-000000000031', '00000000-0000-4000-8000-000000000008', null, 'push', 'Luma Skincare replied on LUM-77', 'delivered', null, '2026-11-04 09:30:00+04'),
  ('e8000000-0000-4000-8000-000000000032', '00000000-0000-4000-8000-000000000001', null, 'email', 'Daily digest', 'delivered', null, '2026-11-04 08:00:00+04'),
  ('e8000000-0000-4000-8000-000000000033', '00000000-0000-4000-8000-000000000003', null, 'push', 'ALB-214 is due tomorrow', 'held', 'Quiet hours', '2026-11-03 22:10:00+04'),
  ('e8000000-0000-4000-8000-000000000034', null, 'marketing@albamotors.ae', 'email', 'Approval reminder for ALB-48', 'bounced', 'Mailbox full', '2026-11-03 16:45:00+04')
on conflict (id) do nothing;

-- ---------------------------------------------------------------- integrations (nothing connected yet)
insert into public.integration_connections (id, provider, member_id, status, account_label, settings) values
  ('e8000000-0000-4000-8000-000000000041', 'google_calendar', '00000000-0000-4000-8000-000000000001', 'not_configured', 'sara@permanentseo.ae', '{}'),
  ('e8000000-0000-4000-8000-000000000042', 'fireflies', null, 'not_configured', null, '{"lookback_days": 30}'),
  ('e8000000-0000-4000-8000-000000000043', 'gmail', null, 'not_configured', 'clients@permanentseo.ae', '{"poll_minutes": 10}'),
  ('e8000000-0000-4000-8000-000000000044', 'ai', null, 'not_configured', null, '{}')
on conflict (id) do nothing;

-- ---------------------------------------------------------------- Fireflies calls (sample, as if imported earlier)
insert into public.fireflies_calls (id, external_id, title, occurred_at, minutes, participants, client_id, match_method, summary, summary_status, summarized_at) values
  ('e8000000-0000-4000-8000-000000000051', 'ff-sample-0001', 'Alba x Permanent SEO monthly', '2026-10-28 14:30:00+04', 41,
   array['sara@permanentseo.ae', 'ayesha@permanentseo.ae', 'rania@albamotors.ae'], 'c0000000-0000-4000-8000-000000000002', 'domain',
   '{"decisions": ["Move AED 5,000 from Meta to Google Search for November.", "Hold the SUV carousel."],
     "concerns": [{"text": "Patrol leads arrived a day late", "quote": "We got the Patrol leads a day late, that cost us two sales."}],
     "actions": [{"text": "Fix lead email routing to the sales inbox", "owner": "Daniel Reyes"}, {"text": "Send Motor Show stand dimensions", "owner": "Rania Youssef"}]}',
   'ready', '2026-10-28 15:20:00+04'),
  ('e8000000-0000-4000-8000-000000000052', 'ff-sample-0002', 'Motor Show planning', '2026-10-16 11:00:00+04', 23,
   array['zara@permanentseo.ae', 'lina@permanentseo.ae'], 'c0000000-0000-4000-8000-000000000002', 'title', null, 'none', null),
  ('e8000000-0000-4000-8000-000000000053', 'ff-sample-0003', 'Intro call', '2026-11-03 16:00:00+04', 18,
   array['omar@permanentseo.ae', 'hello@gmail.com'], null, 'none', null, 'none', null)
on conflict (id) do nothing;

-- ---------------------------------------------------------------- client inbox triage (last few days)
insert into public.inbox_messages (id, external_id, mailbox, from_address, subject, received_at, client_id, outcome) values
  ('e8000000-0000-4000-8000-000000000061', 'gm-sample-0001', 'clients@permanentseo.ae', 'rania@albamotors.ae', 'New offer banner for the weekend', '2026-11-04 09:02:00+04', 'c0000000-0000-4000-8000-000000000002', 'new_ticket'),
  ('e8000000-0000-4000-8000-000000000062', 'gm-sample-0002', 'clients@permanentseo.ae', 'dina@lumaskin.com', 'Re: November content plan', '2026-11-03 11:15:00+04', 'c0000000-0000-4000-8000-000000000003', 'added_to_ticket'),
  ('e8000000-0000-4000-8000-000000000063', 'gm-sample-0003', 'clients@permanentseo.ae', 'office@cedarpine.ae', 'Re: Blog topics', '2026-11-03 15:40:00+04', 'c0000000-0000-4000-8000-000000000001', 'added_to_ticket'),
  ('e8000000-0000-4000-8000-000000000064', 'gm-sample-0004', 'clients@permanentseo.ae', 'sales@randomvendor.com', 'Boost your rankings today', '2026-11-03 07:00:00+04', null, 'not_client'),
  ('e8000000-0000-4000-8000-000000000065', 'gm-sample-0005', 'clients@permanentseo.ae', 'no-reply@google.com', 'Search Console: new issue detected', '2026-11-02 06:00:00+04', null, 'automatic'),
  ('e8000000-0000-4000-8000-000000000066', 'gm-sample-0006', 'clients@permanentseo.ae', 'sara@permanentseo.ae', 'Re: New offer banner for the weekend', '2026-11-04 09:20:00+04', 'c0000000-0000-4000-8000-000000000002', 'from_us')
on conflict (id) do nothing;

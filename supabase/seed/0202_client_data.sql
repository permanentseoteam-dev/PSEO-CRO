-- Seed 0202_client_data: client page data tabs (Performance, Analysis, Ads, Leads, Website, SEO).
-- Fictional sample data for Alba Motors (c02) and Cedar & Pine Dental (c01). Today is 2026-11-04.
-- Fixed id prefix for rows other modules may reference: 20200000-0000-4000-8000-000000000NNN
--   ad_campaigns 1NN, client_leads 2NN.
-- Every insert joins public.clients, so rows for a missing client are skipped instead of failing.
-- No sub-account links are seeded: the 0108 sample clients are all independent businesses.

-- ---------------------------------------------------------------- permissions
insert into public.permissions (key, area, label) values
  ('clients.data.manage', 'Clients', 'Connect data sources and edit client data'),
  ('clients.leads.view',  'Clients', 'See leads (client portal)')
on conflict (key) do nothing;

insert into public.role_permissions (role, perm_key, scope) values
  ('admin',         'clients.data.manage', 'all'),
  ('admin',         'clients.leads.view',  'all'),
  ('dept_head',     'clients.data.manage', 'team'),
  ('member',        'clients.data.manage', 'own'),
  ('client_owner',  'clients.leads.view',  'own'),
  ('client_viewer', 'clients.leads.view',  'own')
on conflict do nothing;

-- ---------------------------------------------------------------- data sources
insert into public.client_data_sources (client_id, source, status, account_label, external_id, last_refresh_at, connected_by, connected_at)
select c.id, v.source, 'connected', v.label, v.ext, v.refreshed::timestamptz, v.by_member::uuid, '2025-02-20 10:00+04'::timestamptz
from (values
  ('c0000000-0000-4000-8000-000000000002'::uuid, 'gsc',        'sc-domain:albamotors.ae',  'sc-domain:albamotors.ae', '2026-11-04 06:00+04', '00000000-0000-4000-8000-000000000003'),
  ('c0000000-0000-4000-8000-000000000002'::uuid, 'ga4',        'Alba Motors · 318902211',  '318902211',               '2026-11-04 06:00+04', '00000000-0000-4000-8000-000000000003'),
  ('c0000000-0000-4000-8000-000000000002'::uuid, 'gbp',        '2 locations',              'accounts/1180022',        '2026-11-03 22:10+04', '00000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000002'::uuid, 'google_ads', '412-889-2031',             '4128892031',              '2026-11-04 06:05+04', '00000000-0000-4000-8000-000000000003'),
  ('c0000000-0000-4000-8000-000000000002'::uuid, 'meta_ads',   'act_10223399',             'act_10223399',            '2026-11-04 06:05+04', '00000000-0000-4000-8000-000000000003'),
  ('c0000000-0000-4000-8000-000000000001'::uuid, 'gsc',        'sc-domain:cedarpinedental.ae', 'sc-domain:cedarpinedental.ae', '2026-11-04 06:00+04', '00000000-0000-4000-8000-000000000002'),
  ('c0000000-0000-4000-8000-000000000001'::uuid, 'ga4',        'Cedar & Pine · 299104577', '299104577',               '2026-11-04 06:00+04', '00000000-0000-4000-8000-000000000002'),
  ('c0000000-0000-4000-8000-000000000001'::uuid, 'gbp',        '1 location',               'accounts/2290315',        '2026-11-03 22:10+04', '00000000-0000-4000-8000-000000000002')
) as v (client_id, source, label, ext, refreshed, by_member)
join public.clients c on c.id = v.client_id
on conflict (client_id, source) do nothing;

-- ---------------------------------------------------------------- daily metrics, 56 days ending 2026-11-03
-- Each metric has a 28-day total for the last window and the prior one; days wobble around the average.
insert into public.client_metric_daily (client_id, source, metric, day, value, currency)
select c.id, v.source, v.metric, d.day,
       round((((case when d.day > date '2026-10-06' then v.last28 else v.prior28 end) / 28.0)
             * (1 + 0.15 * sin(extract(doy from d.day)::double precision)))::numeric, 2),
       v.currency
from (values
  ('c0000000-0000-4000-8000-000000000002'::uuid, 'ga4',        'sessions',       38420, 34110, null),
  ('c0000000-0000-4000-8000-000000000002'::uuid, 'gsc',        'organic_clicks',  6210,  6480, null),
  ('c0000000-0000-4000-8000-000000000002'::uuid, 'gsc',        'impressions',   188400, 179200, null),
  ('c0000000-0000-4000-8000-000000000002'::uuid, 'ga4',        'leads',            142,   120, null),
  ('c0000000-0000-4000-8000-000000000002'::uuid, 'gbp',        'gbp_calls',        318,   296, null),
  ('c0000000-0000-4000-8000-000000000002'::uuid, 'google_ads', 'ad_spend',       23600, 22100, 'AED'),
  ('c0000000-0000-4000-8000-000000000002'::uuid, 'meta_ads',   'ad_spend',       14600, 14600, 'AED'),
  ('c0000000-0000-4000-8000-000000000001'::uuid, 'ga4',        'sessions',        9840,  9120, null),
  ('c0000000-0000-4000-8000-000000000001'::uuid, 'gsc',        'organic_clicks',  4310,  3980, null),
  ('c0000000-0000-4000-8000-000000000001'::uuid, 'gsc',        'impressions',    96200, 90400, null),
  ('c0000000-0000-4000-8000-000000000001'::uuid, 'ga4',        'leads',             64,    58, null),
  ('c0000000-0000-4000-8000-000000000001'::uuid, 'gbp',        'gbp_calls',        212,   190, null)
) as v (client_id, source, metric, last28, prior28, currency)
join public.clients c on c.id = v.client_id
cross join lateral (
  select gs::date as day from generate_series(date '2026-09-09', date '2026-11-03', interval '1 day') gs
) d
on conflict (client_id, source, metric, day) do nothing;

-- ---------------------------------------------------------------- analysis
insert into public.client_analyses (client_id, period, what_changed, why, next_steps, author_id)
select c.id, date '2026-10-01',
  array['Leads up 18%, almost all from Google Search brand and model terms.',
        'Meta lead forms got more expensive (CPL AED 212, up from 171).',
        'Organic clicks dipped 4% after a competitor launched 0% finance pages.'],
  array['New Patrol and X-Trail ad groups matched high-intent searches.',
        'The same 4 SUV creatives ran for 7 weeks; frequency hit 5.8.',
        'No finance-offer page on albamotors.ae to compete in search.'],
  array['Ship 6 new SUV creatives on 7 Nov (Lina, Zara).',
        'Move AED 5,000 to Search for November (Ayesha).',
        'Propose a finance-offer landing page in the 5 Nov call (Sara).'],
  '00000000-0000-4000-8000-000000000003'::uuid
from public.clients c where c.id = 'c0000000-0000-4000-8000-000000000002'
on conflict (client_id, period) do nothing;

-- ---------------------------------------------------------------- ads
insert into public.ad_budgets (client_id, month, amount, currency)
select c.id, date '2026-11-01', 40000, 'AED'
from public.clients c where c.id = 'c0000000-0000-4000-8000-000000000002'
on conflict (client_id, month) do nothing;

insert into public.ad_campaigns (id, client_id, platform, external_id, name, status, currency, spend_28d, clicks_28d, leads_28d, spend_mtd, leads_mtd, synced_at)
select v.id, c.id, v.platform, v.ext, v.name, v.status, 'AED', v.spend, v.clicks, v.leads, v.spend_mtd, v.leads_mtd, '2026-11-04 06:05+04'::timestamptz
from (values
  ('20200000-0000-4000-8000-000000000101'::uuid, 'google_ads', '20118841', 'Search · Nissan Patrol',        'running',  9800, 2410, 48, 1300, 7),
  ('20200000-0000-4000-8000-000000000102'::uuid, 'google_ads', '20118842', 'Search · X-Trail and Kicks',    'running',  8600, 2960, 39, 1150, 5),
  ('20200000-0000-4000-8000-000000000103'::uuid, 'google_ads', '20118850', 'PMax · Certified pre-owned',    'learning', 5200, 3880, 14,  700, 2),
  ('20200000-0000-4000-8000-000000000104'::uuid, 'meta_ads',   '6120091',  'Lead form · SUV range',         'fatigued', 7200, 5120, 34,  960, 5),
  ('20200000-0000-4000-8000-000000000105'::uuid, 'meta_ads',   '6120092',  'Retargeting · site visitors',   'running',  4100, 1940,  7,  810, 2),
  ('20200000-0000-4000-8000-000000000106'::uuid, 'meta_ads',   '6120040',  'Ramadan 2026 offers',           'paused',      0,    0,  0,    0, 0)
) as v (id, platform, ext, name, status, spend, clicks, leads, spend_mtd, leads_mtd)
join public.clients c on c.id = 'c0000000-0000-4000-8000-000000000002'
on conflict (id) do nothing;

-- ---------------------------------------------------------------- leads
insert into public.client_leads (id, client_id, received_at, name, email, phone, source, interest, outcome, first_contact_at, value, currency, campaign_id)
select v.id, v.client_id, v.received::timestamptz, v.name, v.email, v.phone, v.source, v.interest, v.outcome,
       v.contacted::timestamptz, v.value, v.currency, v.campaign_id
from (values
  ('20200000-0000-4000-8000-000000000201'::uuid, 'c0000000-0000-4000-8000-000000000002'::uuid, '2026-11-04 09:12+04', 'Mohammed R.', 'mohammed.r@example.com', null, 'google_ads', 'Nissan Patrol 2026', 'new', null, null::numeric, null, '20200000-0000-4000-8000-000000000101'::uuid),
  ('20200000-0000-4000-8000-000000000202'::uuid, 'c0000000-0000-4000-8000-000000000002'::uuid, '2026-11-03 18:40+04', 'Anjali S.', 'anjali.s@example.com', null, 'meta_lead_form', 'Kia Sportage', 'contacted', '2026-11-03 19:05+04', null, null, '20200000-0000-4000-8000-000000000104'::uuid),
  ('20200000-0000-4000-8000-000000000203'::uuid, 'c0000000-0000-4000-8000-000000000002'::uuid, '2026-11-03 11:05+04', 'Tariq H.', 'tariq.h@example.com', null, 'website_form', 'Certified pre-owned Altima', 'booked', '2026-11-03 11:40+04', null, null, null),
  ('20200000-0000-4000-8000-000000000204'::uuid, 'c0000000-0000-4000-8000-000000000002'::uuid, '2026-11-02 16:22+04', 'Emma W.', null, '+971 50 000 0204', 'whatsapp', 'X-Trail finance offer', 'contacted', '2026-11-02 18:30+04', null, null, null),
  ('20200000-0000-4000-8000-000000000205'::uuid, 'c0000000-0000-4000-8000-000000000002'::uuid, '2026-11-01 10:48+04', 'Saeed K.', 'saeed.k@example.com', null, 'google_ads', 'Nissan Patrol 2026', 'won', '2026-11-01 11:02+04', 118000, 'AED', '20200000-0000-4000-8000-000000000101'::uuid),
  ('20200000-0000-4000-8000-000000000206'::uuid, 'c0000000-0000-4000-8000-000000000002'::uuid, '2026-10-31 14:30+04', 'Leila M.', 'leila.m@example.com', null, 'meta_lead_form', 'Kia Seltos', 'lost', '2026-10-31 14:52+04', null, null, '20200000-0000-4000-8000-000000000104'::uuid),
  ('20200000-0000-4000-8000-000000000207'::uuid, 'c0000000-0000-4000-8000-000000000002'::uuid, '2026-10-30 12:02+04', 'Rahul P.', 'rahul.p@example.com', null, 'website_form', 'Service booking', 'not_lead', '2026-10-30 13:30+04', null, null, null),
  ('20200000-0000-4000-8000-000000000211'::uuid, 'c0000000-0000-4000-8000-000000000001'::uuid, '2026-11-03 15:20+04', 'Hana T.', 'hana.t@example.com', null, 'gbp', 'Teeth whitening', 'booked', '2026-11-03 15:45+04', null, null, null),
  ('20200000-0000-4000-8000-000000000212'::uuid, 'c0000000-0000-4000-8000-000000000001'::uuid, '2026-11-02 10:05+04', 'Omar S.', 'omar.s@example.com', null, 'website_form', 'Invisalign consultation', 'contacted', '2026-11-02 12:30+04', null, null, null),
  ('20200000-0000-4000-8000-000000000213'::uuid, 'c0000000-0000-4000-8000-000000000001'::uuid, '2026-10-29 09:40+04', 'Maya K.', null, '+971 55 000 0213', 'phone', 'Emergency appointment', 'won', '2026-10-29 09:40+04', 1450, 'AED', null)
) as v (id, client_id, received, name, email, phone, source, interest, outcome, contacted, value, currency, campaign_id)
join public.clients c on c.id = v.client_id
on conflict (id) do nothing;

-- ---------------------------------------------------------------- website
insert into public.client_websites (client_id, url, platform, hosting, ssl_renews_on, domain_renews_on, tracking,
  uptime_30d, mobile_speed, lcp_ms, forms_total, forms_working, forms_tested_at, last_backup_at)
select c.id, 'albamotors.ae', 'WordPress 6.6', 'hosted by client', date '2027-02-19', date '2027-08-03',
  array['GA4', 'Google Ads', 'Meta pixel'], 99.98, 71, 2900, 4, 4, '2026-11-04 07:00+04'::timestamptz, '2026-11-04 03:00+04'::timestamptz
from public.clients c where c.id = 'c0000000-0000-4000-8000-000000000002'
on conflict (client_id) do nothing;

-- ---------------------------------------------------------------- SEO queries (28 days to 2026-11-03)
insert into public.seo_queries (client_id, query, position, prior_position, clicks, impressions, period_end)
select c.id, v.query, v.pos, v.prior, v.clicks, v.impr, date '2026-11-03'
from (values
  ('alba motors',                   1.0,  1.0, 2140,  4020),
  ('nissan patrol 2026 price uae',  6.3,  8.4,  412, 18900),
  ('used nissan dubai',            11.8,  8.4,  188, 22400),
  ('kia sportage offers sharjah',   8.2,  9.1,  141,  6700),
  ('car finance 0% uae',           27.5, 21.5,   12, 31000)
) as v (query, pos, prior, clicks, impr)
join public.clients c on c.id = 'c0000000-0000-4000-8000-000000000002'
on conflict (client_id, query) do nothing;

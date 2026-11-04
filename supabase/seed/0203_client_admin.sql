-- Seed 0203_client_admin: permission keys, terms, sentiment, churn alerts, vault logins, portal activity lines,
-- two ended clients with a win-back. Fictional data matching docs/ui-preview/screens/clients.js. Today is 2026-11-04.
-- Fixed ids for this module's rows: ca000000-0000-4000-8000-0000000000NN.
-- Ended sample clients (added here if the clients table accepts them): c0000000-0000-4000-8000-000000000021 Desert Bloom Florists,
-- c0000000-0000-4000-8000-000000000022 Peak Physio Clinic.
-- Vault passwords are fake sample values (dev/preview only).

-- ---------------------------------------------------------------- permissions
insert into public.permissions (key, area, label) values
  ('clients.vault.view',   'Clients', 'See and reveal saved client logins'),
  ('clients.vault.manage', 'Clients', 'Add, edit and delete saved client logins'),
  ('clients.delete',       'Clients', 'Delete a client for good')
on conflict (key) do nothing;

insert into public.role_permissions (role, perm_key, scope) values
  ('admin', 'clients.vault.view', 'all'),
  ('admin', 'clients.vault.manage', 'all'),
  ('admin', 'clients.delete', 'all'),
  ('dept_head', 'clients.vault.view', 'team'),
  ('dept_head', 'clients.vault.manage', 'team'),
  ('member', 'clients.vault.view', 'own')
on conflict do nothing;

-- ---------------------------------------------------------------- ended clients (Phase 1 table; skipped if its shape differs)
do $$
begin
  insert into public.clients (id, name, status) values
    ('c0000000-0000-4000-8000-000000000021', 'Desert Bloom Florists', 'churned'),
    ('c0000000-0000-4000-8000-000000000022', 'Peak Physio Clinic', 'churned')
  on conflict (id) do nothing;
exception when others then
  raise notice '0203 seed: ended sample clients skipped (%)', sqlerrm;
end;
$$;

-- ---------------------------------------------------------------- terms
insert into public.client_agreements
  (client_id, monthly_fee, currency, start_date, term_months, notice_days, hours_per_month, in_scope, out_of_scope, renewal_on, auto_renews)
select v.* from (values
  ('c0000000-0000-4000-8000-000000000001'::uuid, 9500.00, 'AED', '2025-06-01'::date, 12::smallint, 30::smallint, 40.0,
   'Local SEO, Google Business Profile, 4 blog posts a month, monthly report.', 'Paid ads, website rebuild.', '2026-06-01'::date, true),
  ('c0000000-0000-4000-8000-000000000002', 14000.00, 'AED', '2025-02-01', 12, 30, 60.0,
   'Google Ads, Meta Ads, 5 social posts a week, monthly report, landing page edits.', 'New website builds, video shoots, SEO.', '2027-02-01', false),
  ('c0000000-0000-4000-8000-000000000003', 4200.00, 'USD', '2025-09-01', 6, 30, 30.0,
   'Meta Ads, Instagram content, monthly report.', 'Influencer management, product photography.', null, false),
  ('c0000000-0000-4000-8000-000000000004', 18500.00, 'USD', '2026-08-15', 4, 14, 80.0,
   'Website design and build, 12 pages, launch support.', 'Copywriting beyond 12 pages, hosting.', null, false),
  ('c0000000-0000-4000-8000-000000000005', 6000.00, 'AED', '2026-09-01', 12, 30, 25.0,
   'SEO, Google Business Profile, 3 social posts a week.', 'Paid ads.', null, false),
  ('c0000000-0000-4000-8000-000000000006', 180000.00, 'PKR', '2025-11-01', 12, 30, 35.0,
   'Social media, Meta Ads, monthly report.', 'Menu design, photo shoots.', '2026-11-01', true),
  ('c0000000-0000-4000-8000-000000000021', 7500.00, 'AED', '2025-07-01', 12, 30, 30.0, 'Social media and Meta Ads.', null, null, false),
  ('c0000000-0000-4000-8000-000000000022', 2800.00, 'USD', '2024-09-15', 6, 30, 20.0, 'Local SEO and Google Ads.', null, null, false)
) as v (client_id, monthly_fee, currency, start_date, term_months, notice_days, hours_per_month, in_scope, out_of_scope, renewal_on, auto_renews)
where exists (select 1 from public.clients c where c.id = v.client_id)
on conflict (client_id) do nothing;

-- Optional Phase 1 columns for the ended clients' end date and reason.
do $$
begin
  update public.clients set ended_on = '2026-06-30', end_reason = 'Budget cut after Q2'
   where id = 'c0000000-0000-4000-8000-000000000021' and ended_on is null;
  update public.clients set ended_on = '2026-03-15', end_reason = 'Moved in-house'
   where id = 'c0000000-0000-4000-8000-000000000022' and ended_on is null;
exception when others then
  raise notice '0203 seed: end date and reason skipped (%)', sqlerrm;
end;
$$;

-- ---------------------------------------------------------------- health
insert into public.client_sentiments (id, client_id, sentiment, note, recorded_on, recorded_by)
select v.* from (values
  ('ca000000-0000-4000-8000-000000000001'::uuid, 'c0000000-0000-4000-8000-000000000002'::uuid, 'positive', 'Rania happy with September leads.', '2026-09-30'::date, '00000000-0000-4000-8000-000000000001'::uuid),
  ('ca000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 'neutral', 'Karim asked about trimming spend in Q1 on the monthly call.', '2026-10-28', '00000000-0000-4000-8000-000000000001'),
  ('ca000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000003', 'negative', 'Megan disputed the October invoice and asked for a results review.', '2026-11-02', '00000000-0000-4000-8000-000000000008'),
  ('ca000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', 'positive', 'Dr. Rania shared two patient reviews that mention us.', '2026-10-20', '00000000-0000-4000-8000-000000000001')
) as v (id, client_id, sentiment, note, recorded_on, recorded_by)
where exists (select 1 from public.clients c where c.id = v.client_id)
on conflict (id) do nothing;

insert into public.churn_alerts (id, client_id, trigger_kind, detail, nps_score, raised_on, raised_by, outcome, outcome_note, closed_on)
select v.* from (values
  ('ca000000-0000-4000-8000-000000000011'::uuid, 'c0000000-0000-4000-8000-000000000002'::uuid, 'sentiment',
   'Karim said on 28 Oct he may "pull back to Google only" in Q1.', null::smallint, '2026-10-28'::date, '00000000-0000-4000-8000-000000000001'::uuid, 'open', null, null::date),
  ('ca000000-0000-4000-8000-000000000012', 'c0000000-0000-4000-8000-000000000003', 'risk',
   'Health score fell to 42 after the invoice dispute and two late reports.', null, '2026-11-03', null, 'open', null, null),
  ('ca000000-0000-4000-8000-000000000013', 'c0000000-0000-4000-8000-000000000006', 'nps',
   'Faisal scored us 5 in the Q2 survey: slow replies on WhatsApp.', 5, '2026-07-08', '00000000-0000-4000-8000-000000000008', 'saved',
   'Moved Zest to a shared WhatsApp group with a 2-hour reply target.', '2026-08-01')
) as v (id, client_id, trigger_kind, detail, nps_score, raised_on, raised_by, outcome, outcome_note, closed_on)
where exists (select 1 from public.clients c where c.id = v.client_id)
on conflict (id) do nothing;

-- ---------------------------------------------------------------- vault (secrets go into vault.secrets once)
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('ca000000-0000-4000-8000-000000000021'::uuid, 'Google Ads', 'ads@albamotors.ae', 'Gk7!pR2#xLm9'),
      ('ca000000-0000-4000-8000-000000000022'::uuid, 'WordPress admin', 'permanentseo', 'wp-Alba-2026-qT4'),
      ('ca000000-0000-4000-8000-000000000023'::uuid, 'Meta Business', 'marketing@albamotors.ae', 'Mb#88sunset')
    ) as v (id, service, username, pw)
  loop
    if not exists (select 1 from public.client_vault_items where id = r.id)
       and exists (select 1 from public.clients where id = 'c0000000-0000-4000-8000-000000000002') then
      insert into public.client_vault_items (id, client_id, service, username, secret_id, created_by)
      values (r.id, 'c0000000-0000-4000-8000-000000000002', r.service, r.username,
              vault.create_secret(r.pw, null, 'client vault login (sample)'), '00000000-0000-4000-8000-000000000001');
    end if;
  end loop;
end;
$$;

insert into public.client_vault_reveals (id, item_id, client_id, member_id, revealed_at)
select v.* from (values
  ('ca000000-0000-4000-8000-000000000031'::uuid, 'ca000000-0000-4000-8000-000000000021'::uuid, 'c0000000-0000-4000-8000-000000000002'::uuid, '00000000-0000-4000-8000-000000000003'::uuid, '2026-11-02 10:14+04'::timestamptz),
  ('ca000000-0000-4000-8000-000000000032', 'ca000000-0000-4000-8000-000000000022', 'c0000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000004', '2026-10-30 15:40+04'),
  ('ca000000-0000-4000-8000-000000000033', 'ca000000-0000-4000-8000-000000000023', 'c0000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000009', '2026-10-27 09:05+04')
) as v (id, item_id, client_id, member_id, revealed_at)
where exists (select 1 from public.client_vault_items i where i.id = v.item_id)
on conflict (id) do nothing;

-- ---------------------------------------------------------------- portal activity lines
insert into public.client_activity_lines (id, client_id, body, happened_on, visibility, created_by)
select v.* from (values
  ('ca000000-0000-4000-8000-000000000041'::uuid, 'c0000000-0000-4000-8000-000000000002'::uuid, 'October report submitted for review', '2026-11-01'::date, 'draft', '00000000-0000-4000-8000-000000000001'::uuid),
  ('ca000000-0000-4000-8000-000000000042', 'c0000000-0000-4000-8000-000000000002', '6 new SUV creatives ready for your approval', '2026-11-03', 'shared', '00000000-0000-4000-8000-000000000009'),
  ('ca000000-0000-4000-8000-000000000043', 'c0000000-0000-4000-8000-000000000002', 'Lead email routing fix in progress', '2026-11-01', 'shared', '00000000-0000-4000-8000-000000000004'),
  ('ca000000-0000-4000-8000-000000000044', 'c0000000-0000-4000-8000-000000000002', 'Internal: budget reallocation debate', '2026-10-29', 'hidden', '00000000-0000-4000-8000-000000000003')
) as v (id, client_id, body, happened_on, visibility, created_by)
where exists (select 1 from public.clients c where c.id = v.client_id)
on conflict (id) do nothing;

-- ---------------------------------------------------------------- win-back
insert into public.client_winbacks (id, client_id, owner_id, status, next_step, due_on, note, created_by)
select v.* from (values
  ('ca000000-0000-4000-8000-000000000051'::uuid, 'c0000000-0000-4000-8000-000000000021'::uuid, '00000000-0000-4000-8000-000000000008'::uuid, 'open',
   'Send the Mother''s Day social plan with a 3-month trial price', '2026-11-12'::date, 'Budget was the reason, not results.', '00000000-0000-4000-8000-000000000001'::uuid)
) as v (id, client_id, owner_id, status, next_step, due_on, note, created_by)
where exists (select 1 from public.clients c where c.id = v.client_id)
on conflict (id) do nothing;

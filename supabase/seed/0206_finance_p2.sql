-- Seed 0206_finance_p2: email sending settings and log, Upwork earnings and withdrawals, recent exports,
-- one past invoice with portal visibility, and Alba Motors' two sub-accounts billed under it.
-- Fictional data matching docs/ui-preview/screens/finance.js. Today is 2026-11-04.
-- Fixed ids for this module's rows: f2000000-0000-4000-8000-0000000000NN.
-- Sub-account clients (added here if the clients table accepts them):
--   c0000000-0000-4000-8000-000000000031 Alba Motors Service Centre, c0000000-0000-4000-8000-000000000032 Alba Rent a Car.
-- Permission keys used (finance.drafts.create, finance.invoices.record_past, ...) are already in 0001_core.

-- ---------------------------------------------------------------- email sending
insert into public.email_settings (id, provider, from_name, from_email, reply_to, domain, domain_status, spf, dkim, dmarc, checked_at, updated_by)
values ('f2000000-0000-4000-8000-000000000001', 'none', 'Permanent SEO Billing', 'billing@permanentseo.com', 'bilal@permanentseo.com',
        'permanentseo.com', 'verified', 'passing', 'passing', 'missing', '2026-11-03 09:00+04', '00000000-0000-4000-8000-000000000006')
on conflict do nothing;

insert into public.email_log (id, kind, to_email, subject, provider, status, error, created_by, created_at) values
  ('f2000000-0000-4000-8000-000000000011', 'invoice',  'accounts@cedarpine.ae', 'Invoice INV-PS-0142 from Permanent SEO', 'resend', 'sent', null, '00000000-0000-4000-8000-000000000006', '2026-11-01 10:05+04'),
  ('f2000000-0000-4000-8000-000000000012', 'reminder', 'ap@albamotors.ae', 'Reminder: PS-2026-104 is 20 days late', 'resend', 'sent', null, '00000000-0000-4000-8000-000000000006', '2026-11-04 09:00+04'),
  ('f2000000-0000-4000-8000-000000000013', 'receipt',  'billing@harborlegal.com', 'Receipt for your payment P-1089', 'resend', 'sent', null, '00000000-0000-4000-8000-000000000006', '2026-11-02 15:20+04'),
  ('f2000000-0000-4000-8000-000000000014', 'invoice',  'finance@novafit.example', 'Invoice INV-PU-0057 from Permanent SEO', 'resend', 'bounced', 'Mailbox does not exist', '00000000-0000-4000-8000-000000000006', '2026-10-28 11:40+04'),
  ('f2000000-0000-4000-8000-000000000015', 'reminder', 'hello@zestkitchen.example', 'Your invoice is due in 3 days', 'resend', 'sent', null, '00000000-0000-4000-8000-000000000006', '2026-10-22 09:00+04'),
  ('f2000000-0000-4000-8000-000000000016', 'test',     'bilal@permanentseo.com', 'Test email from the finance portal', 'none', 'failed', 'Email sending isn''t set up yet. Pick a provider in Finance settings.', '00000000-0000-4000-8000-000000000006', '2026-11-03 09:02+04')
on conflict do nothing;

-- ---------------------------------------------------------------- Upwork
insert into public.upwork_earnings (id, contract, upwork_client, kind, hours, earned, fee, currency, status, earned_on, created_by) values
  ('f2000000-0000-4000-8000-000000000021', 'Shopify SEO audit', 'Brightline Home (Upwork)', 'fixed', null, 1200.00, 120.00, 'USD', 'released', '2026-11-02', '00000000-0000-4000-8000-000000000006'),
  ('f2000000-0000-4000-8000-000000000022', 'Local SEO retainer', 'Maple Physio (Upwork)', 'hourly', 32.5, 1300.00, 130.00, 'USD', 'in_review', '2026-11-03', '00000000-0000-4000-8000-000000000006'),
  ('f2000000-0000-4000-8000-000000000023', 'Blog content, 6 posts', 'Orbit Labs (Upwork)', 'fixed', null, 680.00, 68.00, 'USD', 'pending_release', '2026-11-01', '00000000-0000-4000-8000-000000000006'),
  ('f2000000-0000-4000-8000-000000000024', 'Local SEO retainer', 'Maple Physio (Upwork)', 'hourly', 30, 1200.00, 120.00, 'USD', 'released', '2026-10-06', '00000000-0000-4000-8000-000000000006')
on conflict do nothing;

insert into public.upwork_withdrawals (id, amount, currency, withdrawn_on, to_account, reference, created_by) values
  ('f2000000-0000-4000-8000-000000000031', 4600.00, 'USD', '2026-11-03', 'Wise USD ••7720', 'UPW-WD-88213', '00000000-0000-4000-8000-000000000006'),
  ('f2000000-0000-4000-8000-000000000032', 2150.00, 'USD', '2026-10-04', 'Wise USD ••7720', 'UPW-WD-87102', '00000000-0000-4000-8000-000000000006')
on conflict do nothing;

-- ---------------------------------------------------------------- recent exports
insert into public.finance_exports (id, kind, entity_label, from_date, to_date, row_count, created_by, created_at) values
  ('f2000000-0000-4000-8000-000000000041', 'invoices', 'Permanent SEO FZ-LLC', '2026-10-01', '2026-10-31', 14, '00000000-0000-4000-8000-000000000006', '2026-11-02 12:10+04'),
  ('f2000000-0000-4000-8000-000000000042', 'aging', 'All entities', null, '2026-09-30', 6, '00000000-0000-4000-8000-000000000006', '2026-10-12 16:30+04'),
  ('f2000000-0000-4000-8000-000000000043', 'payments', 'All entities', '2026-09-01', '2026-09-30', 11, '00000000-0000-4000-8000-000000000010', '2026-10-03 10:00+04')
on conflict do nothing;

-- ---------------------------------------------------------------- past invoice (Phase 1 invoices table; skipped if its shape differs)
do $$
declare ent uuid;
begin
  select id into ent from public.entities where invoice_prefix = 'PS' limit 1;
  if ent is null then
    raise notice '0206 seed: past invoice skipped (no PS entity)';
    return;
  end if;
  insert into public.invoices (id, number, client_id, entity_id, currency, status, title, issued_on, due_on, total)
  values ('f2000000-0000-4000-8000-000000000051', 'PS-2025-118', 'c0000000-0000-4000-8000-000000000001', ent, 'AED', 'paid',
          'December 2025 retainer', '2025-12-01', '2025-12-15', 9975.00)
  on conflict do nothing;
  insert into public.invoice_extras (invoice_id, client_id, portal_visible, is_past, paid_before_portal, recorded_by)
  values ('f2000000-0000-4000-8000-000000000051', 'c0000000-0000-4000-8000-000000000001', true, true, 9975.00, '00000000-0000-4000-8000-000000000006')
  on conflict do nothing;
exception when others then
  raise notice '0206 seed: past invoice skipped (%)', sqlerrm;
end;
$$;

-- ---------------------------------------------------------------- Alba Motors sub-accounts billed under it
do $$
begin
  insert into public.clients (id, name, status) values
    ('c0000000-0000-4000-8000-000000000031', 'Alba Motors Service Centre', 'active'),
    ('c0000000-0000-4000-8000-000000000032', 'Alba Rent a Car', 'active')
  on conflict (id) do nothing;
  insert into public.client_sub_accounts (parent_client_id, child_client_id, billing, linked_by) values
    ('c0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000031', 'parent', '00000000-0000-4000-8000-000000000006'),
    ('c0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000032', 'parent', '00000000-0000-4000-8000-000000000006')
  on conflict (child_client_id) do nothing;
exception when others then
  raise notice '0206 seed: sub-accounts skipped (%)', sqlerrm;
end;
$$;

-- 0206_finance_p2: Phase 2 finance extras.
--   Monthly drafts (monthly_drafts), record past invoice + original document + portal visibility (invoice_extras,
--   private bucket "invoice-originals"), client credit apply / give back (credit_movements, view invoice_credit_applied),
--   Upwork earnings (upwork_earnings, upwork_withdrawals), exports log (finance_exports),
--   email sending status (email_settings, email_log).
-- Sub-account linked billing has no table here: it reads and sets client_sub_accounts.billing from 0202_client_data.
-- Depends on 0001_core (members, helpers), 0108_clients (clients), 0110_finance_core (invoices).
-- No provider API keys are stored: the email adapter is "not configured" until the lead adds one on the server.
--
-- Access model
--   Staff: finance permission keys from 0001_core (finance.invoices.*, finance.drafts.create, finance.payments.*,
--   finance.settings.manage). Finance data is workspace-wide, so scope 'own' or more is enough.
--   Client logins: invoice_extras rows of their own client, original documents of invoices shown in the portal,
--   and (restrictive policy on invoices) no invoice marked hidden. Nothing else here is visible to clients.

-- ---------------------------------------------------------------- helper
create or replace function public.fp2_staff(perm text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_staff() and public.has_perm(perm, 'own');
$$;
grant execute on function public.fp2_staff(text) to authenticated, service_role;
revoke execute on function public.fp2_staff(text) from public, anon;

-- ---------------------------------------------------------------- invoice extras (past invoices, original document, portal visibility)
create table public.invoice_extras (
  invoice_id uuid primary key references public.invoices (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  portal_visible boolean not null default true,
  is_past boolean not null default false,
  paid_before_portal numeric(14,2) not null default 0 check (paid_before_portal >= 0),
  original_doc_path text,      -- object path in "invoice-originals": <client_id>/<invoice_id>/<file>
  original_doc_name text,
  recorded_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index invoice_extras_client_idx on public.invoice_extras (client_id);
create trigger invoice_extras_updated_at before update on public.invoice_extras
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- monthly drafts (one per client per month)
create table public.monthly_drafts (
  id uuid primary key default gen_random_uuid(),
  month date not null check (extract(day from month) = 1),
  client_id uuid not null references public.clients (id) on delete cascade,
  invoice_id uuid references public.invoices (id) on delete set null,
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null check (currency in ('AED', 'USD', 'PKR')),
  sub_client_ids uuid[] not null default '{}',
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, month)
);
create index monthly_drafts_month_idx on public.monthly_drafts (month);
create index monthly_drafts_invoice_idx on public.monthly_drafts (invoice_id);
create trigger monthly_drafts_updated_at before update on public.monthly_drafts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- client credit movements
-- Credit comes in through client_credit (0111). This ledger records what was used:
--   applied    = credit put against an open invoice (lowers that invoice's balance)
--   given_back = credit refunded to the client (reason required)
create table public.credit_movements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  kind text not null check (kind in ('applied', 'given_back')),
  amount numeric(14,2) not null check (amount > 0),
  currency text not null check (currency in ('AED', 'USD', 'PKR')),
  invoice_id uuid references public.invoices (id) on delete set null,
  channel text,
  reference text,
  reason text,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint credit_movements_applied_has_invoice check (kind <> 'applied' or invoice_id is not null),
  constraint credit_movements_giveback_has_reason check (kind <> 'given_back' or length(trim(coalesce(reason, ''))) > 0)
);
create index credit_movements_client_idx on public.credit_movements (client_id);
create index credit_movements_invoice_idx on public.credit_movements (invoice_id);
create trigger credit_movements_updated_at before update on public.credit_movements
  for each row execute function public.set_updated_at();

-- Credit applied per invoice, for the invoice balance (runs under the caller's RLS).
create view public.invoice_credit_applied with (security_invoker = true) as
  select invoice_id, currency, sum(amount)::numeric(14,2) as amount
  from public.credit_movements
  where kind = 'applied' and invoice_id is not null
  group by invoice_id, currency;

-- ---------------------------------------------------------------- Upwork earnings (manual entry)
create table public.upwork_earnings (
  id uuid primary key default gen_random_uuid(),
  contract text not null check (length(trim(contract)) > 0),
  upwork_client text not null,
  client_id uuid references public.clients (id) on delete set null,
  kind text not null default 'fixed' check (kind in ('fixed', 'hourly')),
  hours numeric(7,2) check (hours is null or hours >= 0),
  earned numeric(14,2) not null check (earned >= 0),
  fee numeric(14,2) not null default 0 check (fee >= 0),
  currency text not null default 'USD' check (currency in ('AED', 'USD', 'PKR')),
  status text not null default 'in_review' check (status in ('in_review', 'pending_release', 'released')),
  earned_on date not null,
  note text,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index upwork_earnings_earned_on_idx on public.upwork_earnings (earned_on);
create trigger upwork_earnings_updated_at before update on public.upwork_earnings
  for each row execute function public.set_updated_at();

create table public.upwork_withdrawals (
  id uuid primary key default gen_random_uuid(),
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'USD' check (currency in ('AED', 'USD', 'PKR')),
  withdrawn_on date not null,
  to_account text not null,
  reference text,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index upwork_withdrawals_on_idx on public.upwork_withdrawals (withdrawn_on);
create trigger upwork_withdrawals_updated_at before update on public.upwork_withdrawals
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- exports log
create table public.finance_exports (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('invoices', 'payments', 'aging')),
  format text not null default 'csv' check (format in ('csv')),
  entity_id uuid,               -- entities (0110); no FK so a deleted entity keeps the log line
  entity_label text,
  from_date date,
  to_date date,
  row_count integer not null default 0,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index finance_exports_created_idx on public.finance_exports (created_at desc);
create trigger finance_exports_updated_at before update on public.finance_exports
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- email sending
-- One row (singleton = true): sender details and the last DNS check. The API key lives in server env, never here.
create table public.email_settings (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique check (singleton),
  provider text not null default 'none' check (provider in ('none', 'resend', 'brevo', 'smtp')),
  from_name text,
  from_email text,
  reply_to text,
  domain text,
  domain_status text not null default 'unknown' check (domain_status in ('unknown', 'pending', 'verified', 'failed')),
  spf text not null default 'unknown' check (spf in ('unknown', 'passing', 'failing', 'missing')),
  dkim text not null default 'unknown' check (dkim in ('unknown', 'passing', 'failing', 'missing')),
  dmarc text not null default 'unknown' check (dmarc in ('unknown', 'passing', 'failing', 'missing')),
  checked_at timestamptz,
  updated_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger email_settings_updated_at before update on public.email_settings
  for each row execute function public.set_updated_at();

create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'other' check (kind in ('invoice', 'reminder', 'receipt', 'statement', 'test', 'other')),
  to_email text not null,
  subject text not null,
  provider text not null check (provider in ('none', 'resend', 'brevo', 'smtp')),
  status text not null check (status in ('sent', 'bounced', 'failed')),
  error text,
  invoice_id uuid references public.invoices (id) on delete set null,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index email_log_created_idx on public.email_log (created_at desc);
create index email_log_invoice_idx on public.email_log (invoice_id);
create trigger email_log_updated_at before update on public.email_log
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- RLS
alter table public.invoice_extras enable row level security;
alter table public.monthly_drafts enable row level security;
alter table public.credit_movements enable row level security;
alter table public.upwork_earnings enable row level security;
alter table public.upwork_withdrawals enable row level security;
alter table public.finance_exports enable row level security;
alter table public.email_settings enable row level security;
alter table public.email_log enable row level security;

-- invoice_extras
create policy invoice_extras_staff_select on public.invoice_extras for select to authenticated
  using (public.fp2_staff('finance.invoices.view'));
create policy invoice_extras_client_select on public.invoice_extras for select to authenticated
  using (client_id = public.my_client_id() and public.has_perm('finance.invoices.view', 'own'));
create policy invoice_extras_staff_insert on public.invoice_extras for insert to authenticated
  with check (public.fp2_staff('finance.invoices.create') or public.fp2_staff('finance.invoices.record_past'));
create policy invoice_extras_staff_update on public.invoice_extras for update to authenticated
  using (public.fp2_staff('finance.invoices.create') or public.fp2_staff('finance.invoices.record_past'))
  with check (public.fp2_staff('finance.invoices.create') or public.fp2_staff('finance.invoices.record_past'));
create policy invoice_extras_staff_delete on public.invoice_extras for delete to authenticated
  using (public.fp2_staff('finance.invoices.void'));

-- monthly_drafts
create policy monthly_drafts_select on public.monthly_drafts for select to authenticated
  using (public.fp2_staff('finance.invoices.view'));
create policy monthly_drafts_insert on public.monthly_drafts for insert to authenticated
  with check (public.fp2_staff('finance.drafts.create'));
create policy monthly_drafts_update on public.monthly_drafts for update to authenticated
  using (public.fp2_staff('finance.drafts.create')) with check (public.fp2_staff('finance.drafts.create'));
create policy monthly_drafts_delete on public.monthly_drafts for delete to authenticated
  using (public.fp2_staff('finance.drafts.create'));

-- credit_movements: an append-only ledger (no update or delete policy)
create policy credit_movements_select on public.credit_movements for select to authenticated
  using (public.fp2_staff('finance.payments.view'));
create policy credit_movements_insert on public.credit_movements for insert to authenticated
  with check (public.fp2_staff('finance.payments.record') and created_by = auth.uid());

-- Upwork
create policy upwork_earnings_select on public.upwork_earnings for select to authenticated
  using (public.fp2_staff('finance.payments.view'));
create policy upwork_earnings_insert on public.upwork_earnings for insert to authenticated
  with check (public.fp2_staff('finance.payments.record'));
create policy upwork_earnings_update on public.upwork_earnings for update to authenticated
  using (public.fp2_staff('finance.payments.record')) with check (public.fp2_staff('finance.payments.record'));
create policy upwork_earnings_delete on public.upwork_earnings for delete to authenticated
  using (public.fp2_staff('finance.payments.record'));
create policy upwork_withdrawals_select on public.upwork_withdrawals for select to authenticated
  using (public.fp2_staff('finance.payments.view'));
create policy upwork_withdrawals_insert on public.upwork_withdrawals for insert to authenticated
  with check (public.fp2_staff('finance.payments.record'));
create policy upwork_withdrawals_delete on public.upwork_withdrawals for delete to authenticated
  using (public.fp2_staff('finance.payments.record'));

-- finance_exports: anyone who can export invoices or payments sees the log and writes their own line
create policy finance_exports_select on public.finance_exports for select to authenticated
  using (public.fp2_staff('finance.invoices.view') or public.fp2_staff('finance.payments.view'));
create policy finance_exports_insert on public.finance_exports for insert to authenticated
  with check ((public.fp2_staff('finance.invoices.view') or public.fp2_staff('finance.payments.view')) and created_by = auth.uid());

-- email settings and log
create policy email_settings_select on public.email_settings for select to authenticated
  using (public.fp2_staff('finance.settings.manage') or public.fp2_staff('finance.invoices.send'));
create policy email_settings_insert on public.email_settings for insert to authenticated
  with check (public.fp2_staff('finance.settings.manage'));
create policy email_settings_update on public.email_settings for update to authenticated
  using (public.fp2_staff('finance.settings.manage')) with check (public.fp2_staff('finance.settings.manage'));
create policy email_log_select on public.email_log for select to authenticated
  using (public.fp2_staff('finance.settings.manage') or public.fp2_staff('finance.invoices.send'));
create policy email_log_insert on public.email_log for insert to authenticated
  with check (public.fp2_staff('finance.invoices.send') and created_by = auth.uid());

-- Portal visibility is enforced on the invoices table itself: a restrictive policy (ANDed with 0110's own
-- policies) hides invoices marked "not in portal" from client logins. Staff (my_client_id() is null) are unaffected.
create or replace function public.fp2_invoice_hidden(inv uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.invoice_extras x where x.invoice_id = inv and not x.portal_visible);
$$;
grant execute on function public.fp2_invoice_hidden(uuid) to authenticated, service_role;
revoke execute on function public.fp2_invoice_hidden(uuid) from public, anon;

create policy invoices_portal_visibility on public.invoices as restrictive for select to authenticated
  using (public.my_client_id() is null or not public.fp2_invoice_hidden(id));

-- ---------------------------------------------------------------- original invoice documents bucket (private)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('invoice-originals', 'invoice-originals', false, 15728640, array['application/pdf', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;

-- Object path: <client_id>/<invoice_id>/<file>. Staff by finance permission; clients only their own client's
-- documents on invoices shown in the portal.
create policy invoice_originals_staff_select on storage.objects for select to authenticated
  using (bucket_id = 'invoice-originals' and public.fp2_staff('finance.invoices.view'));
create policy invoice_originals_client_select on storage.objects for select to authenticated
  using (
    bucket_id = 'invoice-originals'
    and (storage.foldername(name))[1] = public.my_client_id()::text
    and exists (
      select 1 from public.invoice_extras x
      where x.original_doc_path = name and x.client_id = public.my_client_id() and x.portal_visible
    )
  );
create policy invoice_originals_staff_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'invoice-originals'
    and (public.fp2_staff('finance.invoices.create') or public.fp2_staff('finance.invoices.record_past')));
create policy invoice_originals_staff_update on storage.objects for update to authenticated
  using (bucket_id = 'invoice-originals'
    and (public.fp2_staff('finance.invoices.create') or public.fp2_staff('finance.invoices.record_past')))
  with check (bucket_id = 'invoice-originals'
    and (public.fp2_staff('finance.invoices.create') or public.fp2_staff('finance.invoices.record_past')));
create policy invoice_originals_staff_delete on storage.objects for delete to authenticated
  using (bucket_id = 'invoice-originals'
    and (public.fp2_staff('finance.invoices.create') or public.fp2_staff('finance.invoices.record_past')));

-- 0111_finance_ops: billing profiles, payments received (receipts) and their allocation to invoices, client credit,
-- payment reminders, salaries (for profitability) and finance ops settings. Owned by module 11 (Finance B).
--
-- Money moves only through record_payment() and void_receipt(): they keep invoices.amount_paid and status in step
-- (same rule as finance_status_from_amounts() in 0110). Proof files live in the private Storage bucket payment-proofs.

-- ---------------------------------------------------------------- settings (one row)
create table public.finance_ops_settings (
  id boolean primary key default true check (id),
  margin_alert_pct numeric(5,2) not null default 35 check (margin_alert_pct between 0 and 100),
  working_hours integer not null default 160 check (working_hours between 1 and 400),
  alert_margin boolean not null default true,
  alert_budget boolean not null default true,
  alert_negative boolean not null default false,
  alert_to text not null default 'leaders' check (alert_to in ('leaders', 'finance')),
  reminder_stages text[] not null default array['before', 'late_1', 'late_7', 'late_14', 'late_30']
    check (reminder_stages <@ array['before', 'late_1', 'late_7', 'late_14', 'late_30']::text[]),
  tell_am_at_30 boolean not null default true,
  reminder_run_time time not null default '10:00',
  reminder_from text not null default 'billing@permanentseo.com',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger finance_ops_settings_updated_at before update on public.finance_ops_settings for each row execute function public.set_updated_at();
insert into public.finance_ops_settings (id) values (true) on conflict do nothing;

-- ---------------------------------------------------------------- billing profiles (one per client)
create table public.billing_profiles (
  client_id uuid primary key references public.clients (id) on delete cascade,
  legal_name text check (char_length(legal_name) <= 200),
  contact text check (char_length(contact) <= 120),
  billing_email text check (char_length(billing_email) <= 300),
  cc text check (char_length(cc) <= 300),
  country text,
  address text check (char_length(address) <= 500),
  tax_id text,
  entity_id uuid references public.entities (id) on delete set null,
  currency text not null default 'AED' check (currency in ('AED', 'USD', 'PKR')),
  channel_id uuid references public.channels_pay (id) on delete set null,
  terms_days integer not null default 14 check (terms_days between 0 and 180),
  agreed_fee numeric(14,2) not null default 0 check (agreed_fee >= 0),
  fee_basis text not null default 'monthly' check (fee_basis in ('monthly', 'weekly', 'hourly', 'one_time')),
  hours_budget numeric(6,1) check (hours_budget is null or hours_budget >= 0),
  notes text check (char_length(notes) <= 2000),
  auto_reminders boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger billing_profiles_updated_at before update on public.billing_profiles for each row execute function public.set_updated_at();
create index billing_profiles_entity_idx on public.billing_profiles (entity_id);
create index billing_profiles_channel_idx on public.billing_profiles (channel_id);

-- ---------------------------------------------------------------- receipts (payments received)
create sequence public.receipt_no_seq start 1090;

create table public.receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_no integer not null unique default nextval('public.receipt_no_seq'),  -- shown as P-1089
  client_id uuid not null references public.clients (id) on delete restrict,
  received_on date not null default current_date,
  currency text not null check (currency in ('AED', 'USD', 'PKR')),
  amount numeric(14,2) not null check (amount > 0),
  fee numeric(14,2) not null default 0 check (fee >= 0),
  landed_amount numeric(14,2) not null,
  fx_rate_usd numeric(18,8),                         -- 1 unit = rate USD, saved when recorded
  channel_id uuid references public.channels_pay (id) on delete set null,
  account text,
  reference text check (char_length(reference) <= 120),
  note text check (char_length(note) <= 1000),
  proof_paths text[] not null default '{}',          -- objects in the payment-proofs bucket
  no_proof_reason text,
  status text not null default 'recorded' check (status in ('recorded', 'void')),
  void_reason text,
  voided_at timestamptz,
  voided_by uuid references public.members (id) on delete set null,
  created_by uuid references public.members (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint receipts_fee_le_amount check (fee <= amount),
  constraint receipts_proof_or_reason check (cardinality(proof_paths) > 0 or coalesce(no_proof_reason, '') <> ''),
  constraint receipts_void_reason check (status <> 'void' or coalesce(void_reason, '') <> '')
);
create trigger receipts_updated_at before update on public.receipts for each row execute function public.set_updated_at();
create index receipts_client_idx on public.receipts (client_id);
create index receipts_received_idx on public.receipts (received_on desc);
create index receipts_channel_idx on public.receipts (channel_id);

create table public.receipt_allocations (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.receipts (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (receipt_id, invoice_id)
);
create trigger receipt_allocations_updated_at before update on public.receipt_allocations for each row execute function public.set_updated_at();
create index receipt_allocations_invoice_idx on public.receipt_allocations (invoice_id);

-- Credit ledger: + when a payment leaves money over, − when credit is used or given back (phase 2).
create table public.client_credit (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  currency text not null check (currency in ('AED', 'USD', 'PKR')),
  amount numeric(14,2) not null check (amount <> 0),
  receipt_id uuid references public.receipts (id) on delete cascade,
  note text,
  created_by uuid references public.members (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger client_credit_updated_at before update on public.client_credit for each row execute function public.set_updated_at();
create index client_credit_client_idx on public.client_credit (client_id);
create index client_credit_receipt_idx on public.client_credit (receipt_id);

-- ---------------------------------------------------------------- payment reminders (one row per invoice and stage)
create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  stage text not null check (stage in ('before', 'late_1', 'late_7', 'late_14', 'late_30')),
  send_on date not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'skipped')),
  auto boolean not null default true,
  paused_until date,
  pause_note text check (char_length(pause_note) <= 500),
  sent_at timestamptz,
  sent_by uuid references public.members (id) on delete set null,   -- null with auto = the daily run
  result text,                                                      -- Delivered, Opened, Reply received, Marked as sent, Missed
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (invoice_id, stage)
);
create trigger reminders_updated_at before update on public.reminders for each row execute function public.set_updated_at();
create index reminders_send_on_idx on public.reminders (status, send_on);

-- ---------------------------------------------------------------- salaries (profitability cost)
create table public.salaries (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  monthly_amount numeric(14,2) not null check (monthly_amount >= 0),
  currency text not null default 'USD' check (currency in ('AED', 'USD', 'PKR')),
  valid_from date not null default current_date,
  created_by uuid references public.members (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, valid_from)
);
create trigger salaries_updated_at before update on public.salaries for each row execute function public.set_updated_at();
create index salaries_member_idx on public.salaries (member_id, valid_from desc);

-- ---------------------------------------------------------------- functions
-- USD rate for a currency on a date: the latest rate from on or before it, else the oldest one.
create or replace function public.finance_fx_rate(cur text, on_date date)
returns numeric
language sql stable
set search_path = ''
as $$
  select coalesce(
    (select rate_to_usd from public.fx_rates where currency = cur and valid_from <= on_date order by valid_from desc limit 1),
    (select rate_to_usd from public.fx_rates where currency = cur order by valid_from limit 1),
    case when cur = 'USD' then 1 end);
$$;

-- Days from the due date for each reminder stage. Same as STAGE_OFFSET in lib/modules/finance/ops/logic.ts.
create or replace function public.reminder_offset(stage text)
returns integer
language sql immutable
set search_path = ''
as $$
  select case stage when 'before' then -3 when 'late_1' then 1 when 'late_7' then 7 when 'late_14' then 14 when 'late_30' then 30 end;
$$;

-- Record a payment: save the receipt with today's USD rate, apply it to open invoices of the same client and
-- currency, and turn any remainder into client credit. Runs as the caller, so RLS still applies.
create or replace function public.record_payment(
  p_id uuid, p_client uuid, p_date date, p_currency text, p_amount numeric, p_fee numeric,
  p_channel uuid, p_account text, p_reference text, p_note text, p_proof text[], p_no_proof_reason text,
  p_allocations jsonb)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_no integer;
  v_left numeric := round(p_amount, 2);
  v_alloc jsonb;
  v_inv public.invoices;
  v_amt numeric;
  v_paid numeric;
begin
  if not public.is_staff() or not public.has_perm('finance.payments.record', 'all') then
    raise exception 'You can''t record payments' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter the amount received' using errcode = '22023';
  end if;

  insert into public.receipts (id, client_id, received_on, currency, amount, fee, landed_amount, fx_rate_usd, channel_id,
                               account, reference, note, proof_paths, no_proof_reason)
  values (coalesce(p_id, gen_random_uuid()), p_client, p_date, p_currency, round(p_amount, 2), round(coalesce(p_fee, 0), 2),
          round(p_amount - coalesce(p_fee, 0), 2), public.finance_fx_rate(p_currency, p_date), p_channel,
          nullif(p_account, ''), nullif(p_reference, ''), nullif(p_note, ''), coalesce(p_proof, '{}'), nullif(p_no_proof_reason, ''))
  returning id, receipt_no into p_id, v_no;

  for v_alloc in select * from jsonb_array_elements(coalesce(p_allocations, '[]'::jsonb)) loop
    v_amt := round((v_alloc ->> 'amount')::numeric, 2);
    continue when v_amt is null or v_amt <= 0;
    select * into v_inv from public.invoices where id = (v_alloc ->> 'invoice_id')::uuid for update;
    if not found or v_inv.client_id <> p_client or v_inv.currency <> p_currency
       or v_inv.status not in ('issued', 'partly_paid', 'disputed') then
      raise exception 'One of the invoices can''t take this payment. Reload and try again.' using errcode = '22023';
    end if;
    if v_amt > v_inv.total - v_inv.amount_paid then
      raise exception '% only has % left to pay', v_inv.number, v_inv.total - v_inv.amount_paid using errcode = '22023';
    end if;
    v_left := v_left - v_amt;
    if v_left < 0 then
      raise exception 'You applied more than was received' using errcode = '22023';
    end if;
    insert into public.receipt_allocations (receipt_id, invoice_id, amount) values (p_id, v_inv.id, v_amt);
    v_paid := v_inv.amount_paid + v_amt;
    update public.invoices
       set amount_paid = v_paid,
           status = case when v_inv.status = 'disputed' then 'disputed'
                         else public.finance_status_from_amounts(v_inv.total, v_paid, v_inv.amount_refunded) end
     where id = v_inv.id;
    insert into public.invoice_events (invoice_id, kind, actor_id, note, amount, meta)
    values (v_inv.id, 'payment', auth.uid(), 'Recorded payment P-' || v_no || ', ' || p_currency || ' ' || to_char(v_amt, 'FM999,999,999,990.00'),
            v_amt, jsonb_build_object('receipt', 'P-' || v_no, 'receipt_id', p_id));
  end loop;

  if v_left > 0 then
    insert into public.client_credit (client_id, currency, amount, receipt_id, note)
    values (p_client, p_currency, v_left, p_id, 'Left over from P-' || v_no);
  end if;
  return v_no;
end;
$$;
revoke execute on function public.record_payment(uuid, uuid, date, text, numeric, numeric, uuid, text, text, text, text[], text, jsonb) from public, anon;
grant execute on function public.record_payment(uuid, uuid, date, text, numeric, numeric, uuid, text, text, text, text[], text, jsonb) to authenticated, service_role;

-- Void a payment: take its allocations back off the invoices and remove the credit it created.
create or replace function public.void_receipt(p_id uuid, p_reason text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_rc public.receipts;
  v_a record;
  v_paid numeric;
begin
  if not public.is_staff() or not public.has_perm('finance.payments.record', 'all') then
    raise exception 'You can''t void payments' using errcode = '42501';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Give a reason for voiding' using errcode = '22023';
  end if;
  select * into v_rc from public.receipts where id = p_id for update;
  if not found then
    raise exception 'Payment not found' using errcode = 'P0002';
  end if;
  if v_rc.status = 'void' then
    raise exception 'This payment is already void' using errcode = '22023';
  end if;

  for v_a in
    select a.amount, i.id, i.total, i.amount_paid, i.amount_refunded, i.status
      from public.receipt_allocations a join public.invoices i on i.id = a.invoice_id
     where a.receipt_id = p_id for update of i
  loop
    if v_a.amount_refunded > 0 or v_a.status in ('void', 'written_off') then
      raise exception 'An invoice this payment paid was refunded, written off or voided. Sort that out first.' using errcode = '22023';
    end if;
    v_paid := greatest(v_a.amount_paid - v_a.amount, 0);
    update public.invoices
       set amount_paid = v_paid,
           status = case when v_a.status = 'disputed' then 'disputed'
                         else public.finance_status_from_amounts(v_a.total, v_paid, 0) end
     where id = v_a.id;
    insert into public.invoice_events (invoice_id, kind, actor_id, note, amount, meta)
    values (v_a.id, 'payment', auth.uid(), 'Voided payment P-' || v_rc.receipt_no || ': ' || p_reason, -v_a.amount,
            jsonb_build_object('receipt', 'P-' || v_rc.receipt_no, 'receipt_id', p_id, 'void', true));
  end loop;

  delete from public.receipt_allocations where receipt_id = p_id;
  delete from public.client_credit where receipt_id = p_id;
  update public.receipts set status = 'void', void_reason = p_reason, voided_at = now(), voided_by = auth.uid() where id = p_id;
end;
$$;
revoke execute on function public.void_receipt(uuid, text) from public, anon;
grant execute on function public.void_receipt(uuid, text) to authenticated, service_role;

-- Keep reminder rows in step with open invoices. Idempotent: called by the reminders page and the daily job.
-- Adds the enabled stages from the latest one already due onwards, moves pending dates when a due date changes,
-- drops pending rows of invoices that are no longer open, and marks stages overtaken by a later due stage as missed.
create or replace function public.sync_payment_reminders()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stages text[];
begin
  if auth.uid() is not null and not (public.is_staff() and public.has_perm('finance.invoices.send', 'all')) then
    raise exception 'You can''t manage reminders' using errcode = '42501';
  end if;
  select reminder_stages into v_stages from public.finance_ops_settings where id;
  v_stages := coalesce(v_stages, array['before', 'late_1', 'late_7', 'late_14', 'late_30']);

  delete from public.reminders r using public.invoices i
   where r.invoice_id = i.id and r.status = 'pending'
     and (i.status not in ('issued', 'partly_paid', 'disputed') or i.amount_paid >= i.total);

  update public.reminders r set send_on = i.due_on + public.reminder_offset(r.stage)
    from public.invoices i
   where r.invoice_id = i.id and r.status = 'pending' and r.send_on <> i.due_on + public.reminder_offset(r.stage);

  insert into public.reminders (invoice_id, stage, send_on, auto, paused_until, pause_note)
  select i.id, s.stage, i.due_on + public.reminder_offset(s.stage), coalesce(bp.auto_reminders, true), p.paused_until, p.pause_note
    from public.invoices i
    cross join unnest(v_stages) as s(stage)
    left join public.billing_profiles bp on bp.client_id = i.client_id
    left join lateral (
      select max(r.paused_until) as paused_until, max(r.pause_note) as pause_note
        from public.reminders r where r.invoice_id = i.id and r.paused_until >= current_date
    ) p on true
   where i.status in ('issued', 'partly_paid', 'disputed') and i.amount_paid < i.total
     and i.due_on + public.reminder_offset(s.stage) >= coalesce(
       (select max(i.due_on + public.reminder_offset(x)) from unnest(v_stages) as x
         where i.due_on + public.reminder_offset(x) <= current_date), '-infinity'::date)
  on conflict (invoice_id, stage) do nothing;

  update public.reminders r set status = 'skipped', result = 'Missed'
   where r.status = 'pending' and r.send_on < current_date
     and exists (select 1 from public.reminders l
                  where l.invoice_id = r.invoice_id and l.send_on > r.send_on and l.send_on <= current_date);
end;
$$;
revoke execute on function public.sync_payment_reminders() from public, anon;
grant execute on function public.sync_payment_reminders() to authenticated, service_role;

-- ---------------------------------------------------------------- RLS
alter table public.finance_ops_settings enable row level security;
alter table public.billing_profiles enable row level security;
alter table public.receipts enable row level security;
alter table public.receipt_allocations enable row level security;
alter table public.client_credit enable row level security;
alter table public.reminders enable row level security;
alter table public.salaries enable row level security;

create policy finance_ops_settings_select on public.finance_ops_settings for select to authenticated using (
  public.is_staff() and (public.has_perm('finance.profitability.view', 'own') or public.has_perm('finance.invoices.send', 'own')
    or public.has_perm('finance.settings.manage', 'own') or public.has_perm('finance.dashboard.view', 'own'))
);
create policy finance_ops_settings_update on public.finance_ops_settings for update to authenticated
  using (public.is_staff() and (public.has_perm('finance.settings.manage', 'all') or public.has_perm('finance.invoices.send', 'all')))
  with check (public.is_staff() and (public.has_perm('finance.settings.manage', 'all') or public.has_perm('finance.invoices.send', 'all')));

-- Billing profiles: staff by billing scope (own/team via the client's owner and manager); client logins their own.
create policy billing_profiles_staff_select on public.billing_profiles for select to authenticated using (
  public.is_staff() and (
    public.has_perm('clients.billing.view', 'all') or public.has_perm('finance.invoices.view', 'all')
    or public.has_perm('finance.payments.view', 'all')
    or exists (
      select 1 from public.clients c
      where c.id = billing_profiles.client_id and (
        (public.has_perm('clients.billing.view', 'team') and (public.in_my_team(c.owner_id) or public.in_my_team(c.manager_id)))
        or (public.has_perm('clients.billing.view', 'own') and auth.uid() in (c.owner_id, c.manager_id))
      )
    )
  )
);
create policy billing_profiles_client_select on public.billing_profiles for select to authenticated using (
  client_id = public.my_client_id() and public.has_perm('clients.billing.view', 'own')
);
create policy billing_profiles_write on public.billing_profiles for all to authenticated
  using (public.is_staff() and public.has_perm('clients.billing.edit', 'all'))
  with check (public.is_staff() and public.has_perm('clients.billing.edit', 'all'));

-- Receipts: finance staff; client logins see their own client's recorded payments.
create policy receipts_staff_select on public.receipts for select to authenticated using (
  public.is_staff() and (public.has_perm('finance.payments.view', 'all') or public.has_perm('finance.dashboard.view', 'all'))
);
create policy receipts_client_select on public.receipts for select to authenticated using (
  client_id = public.my_client_id() and public.has_perm('finance.invoices.view', 'own') and status = 'recorded'
);
create policy receipts_insert on public.receipts for insert to authenticated
  with check (public.is_staff() and public.has_perm('finance.payments.record', 'all') and status = 'recorded');
create policy receipts_update on public.receipts for update to authenticated
  using (public.is_staff() and public.has_perm('finance.payments.record', 'all'))
  with check (public.is_staff() and public.has_perm('finance.payments.record', 'all'));

create policy receipt_allocations_select on public.receipt_allocations for select to authenticated using (
  exists (select 1 from public.receipts r where r.id = receipt_allocations.receipt_id)
);
create policy receipt_allocations_write on public.receipt_allocations for all to authenticated
  using (public.is_staff() and public.has_perm('finance.payments.record', 'all'))
  with check (public.is_staff() and public.has_perm('finance.payments.record', 'all'));

create policy client_credit_staff_select on public.client_credit for select to authenticated using (
  public.is_staff() and (public.has_perm('finance.payments.view', 'all') or public.has_perm('finance.dashboard.view', 'all'))
);
create policy client_credit_client_select on public.client_credit for select to authenticated using (
  client_id = public.my_client_id() and public.has_perm('finance.invoices.view', 'own')
);
create policy client_credit_write on public.client_credit for all to authenticated
  using (public.is_staff() and public.has_perm('finance.payments.record', 'all'))
  with check (public.is_staff() and public.has_perm('finance.payments.record', 'all'));

create policy reminders_select on public.reminders for select to authenticated using (
  public.is_staff() and (public.has_perm('finance.invoices.send', 'own') or public.has_perm('finance.dashboard.view', 'all')
    or public.has_perm('finance.invoices.view', 'all'))
);
create policy reminders_write on public.reminders for all to authenticated
  using (public.is_staff() and public.has_perm('finance.invoices.send', 'all'))
  with check (public.is_staff() and public.has_perm('finance.invoices.send', 'all'));

create policy salaries_select on public.salaries for select to authenticated using (
  public.is_staff() and (public.has_perm('finance.profitability.view', 'all') or public.has_perm('finance.settings.manage', 'all'))
);
create policy salaries_write on public.salaries for all to authenticated
  using (public.is_staff() and public.has_perm('finance.settings.manage', 'all'))
  with check (public.is_staff() and public.has_perm('finance.settings.manage', 'all'));

-- ---------------------------------------------------------------- storage: payment proofs (private)
insert into storage.buckets (id, name, public) values ('payment-proofs', 'payment-proofs', false) on conflict (id) do nothing;

create policy payment_proofs_select on storage.objects for select to authenticated using (
  bucket_id = 'payment-proofs' and public.is_staff() and public.has_perm('finance.payments.view', 'all')
);
create policy payment_proofs_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'payment-proofs' and public.is_staff() and public.has_perm('finance.payments.record', 'all')
);
create policy payment_proofs_delete on storage.objects for delete to authenticated using (
  bucket_id = 'payment-proofs' and public.is_staff() and public.has_perm('finance.payments.record', 'all')
);

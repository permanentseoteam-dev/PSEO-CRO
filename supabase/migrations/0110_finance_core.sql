-- 0110_finance_core: billing entities, payment channels, FX rates, invoices, invoice lines and invoice history.
-- Owned by module 10 (Finance A). Payments, allocations and billing profiles live in 0111_finance_ops.
--
-- Contract for 0111 (Finance B) and 0114 (portal):
--   invoices.amount_paid is the money received against an invoice. Payment allocation keeps it up to date
--   and sets status with the same rule as finance_status_from_amounts() below.
--   invoices.fx_rate_usd is the USD rate saved when the invoice was issued.

-- ---------------------------------------------------------------- entities
create table public.entities (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z]{2,8}$'),
  name text not null check (char_length(name) between 1 and 120),
  short_name text not null check (char_length(short_name) between 1 and 40),
  country text,
  address text,
  tax_id text,
  invoice_prefix text not null unique check (invoice_prefix ~ '^[A-Z0-9]{1,6}$'),
  tax_label text not null default 'VAT',
  tax_rate numeric(5,2) not null default 0 check (tax_rate between 0 and 100),
  currency text not null default 'AED' check (currency in ('AED', 'USD', 'PKR')),
  next_number integer not null default 1 check (next_number > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger entities_updated_at before update on public.entities for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- payment channels
create table public.channels_pay (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  type text not null check (type in ('wise', 'paypal', 'slash', 'bank', 'payoneer', 'other')),
  account text,
  details text,
  fee_note text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger channels_pay_updated_at before update on public.channels_pay for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- FX rates (1 unit of currency = rate_to_usd USD)
create table public.fx_rates (
  id uuid primary key default gen_random_uuid(),
  currency text not null check (currency in ('AED', 'USD', 'PKR')),
  rate_to_usd numeric(18,8) not null check (rate_to_usd > 0),
  valid_from date not null default current_date,
  created_by uuid references public.members (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (currency, valid_from)
);
create trigger fx_rates_updated_at before update on public.fx_rates for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- invoices
create sequence public.invoice_draft_seq;

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete restrict,
  entity_id uuid not null references public.entities (id) on delete restrict,
  number text unique,                                   -- assigned on issue, e.g. INV-PS-0144
  draft_no integer not null default nextval('public.invoice_draft_seq'),
  status text not null default 'draft' check (status in (
    'draft', 'issued', 'partly_paid', 'paid', 'void', 'refunded', 'partly_refunded', 'written_off', 'disputed')),
  currency text not null check (currency in ('AED', 'USD', 'PKR')),
  issued_on date not null default current_date,
  due_on date not null default (current_date + 14),
  po_ref text,
  title text not null default '' check (char_length(title) <= 200),
  discount numeric(14,2) not null default 0 check (discount >= 0),
  subtotal numeric(14,2) not null default 0,
  tax_total numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0 check (total >= 0),
  amount_paid numeric(14,2) not null default 0 check (amount_paid >= 0),
  amount_refunded numeric(14,2) not null default 0 check (amount_refunded >= 0),
  written_off_amount numeric(14,2) not null default 0 check (written_off_amount >= 0),
  fx_rate_usd numeric(18,8),
  channel_id uuid references public.channels_pay (id) on delete set null,
  pay_link text,
  notes text,
  terms text,
  bill_to jsonb not null default '{}',                  -- snapshot: name, address, tax_id, email, cc, contact
  status_reason text,                                   -- void, dispute or write-off reason
  created_by uuid references public.members (id) on delete set null default auth.uid(),
  issued_by uuid references public.members (id) on delete set null,
  issued_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_due_after_issue check (due_on >= issued_on),
  constraint invoices_number_when_issued check (status = 'draft' or number is not null)
);
create trigger invoices_updated_at before update on public.invoices for each row execute function public.set_updated_at();
create index invoices_client_idx on public.invoices (client_id);
create index invoices_entity_idx on public.invoices (entity_id);
create index invoices_status_idx on public.invoices (status);
create index invoices_issued_idx on public.invoices (issued_on);
create index invoices_due_idx on public.invoices (due_on);
create index invoices_channel_idx on public.invoices (channel_id);

create table public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  position integer not null default 0,
  description text not null default '' check (char_length(description) <= 300),
  detail text,
  qty numeric(10,2) not null default 1 check (qty >= 0),
  rate numeric(14,2) not null default 0 check (rate >= 0),
  tax_pct numeric(5,2) not null default 0 check (tax_pct between 0 and 100),
  amount numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger invoice_lines_updated_at before update on public.invoice_lines for each row execute function public.set_updated_at();
create index invoice_lines_invoice_idx on public.invoice_lines (invoice_id, position);

create table public.invoice_events (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  kind text not null check (kind in (
    'created', 'edited', 'issued', 'email_requested', 'payment', 'refund', 'disputed', 'resolved',
    'written_off', 'voided', 'duplicated', 'reminder')),
  actor_id uuid references public.members (id) on delete set null,   -- null = automatic
  note text,
  amount numeric(14,2),
  meta jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger invoice_events_updated_at before update on public.invoice_events for each row execute function public.set_updated_at();
create index invoice_events_invoice_idx on public.invoice_events (invoice_id, created_at desc);
create index invoice_events_kind_idx on public.invoice_events (kind, created_at);

-- ---------------------------------------------------------------- rules
-- Status after money moves. Same rule as statusFromAmounts() in lib/modules/finance/core/logic.ts.
create or replace function public.finance_status_from_amounts(total numeric, paid numeric, refunded numeric)
returns text
language sql immutable
set search_path = ''
as $$
  select case
    when refunded > 0 and refunded >= paid then 'refunded'
    when refunded > 0 then 'partly_refunded'
    when paid >= total and total > 0 then 'paid'
    when paid > 0 then 'partly_paid'
    else 'issued'
  end;
$$;

-- Guard: issued invoices keep their client, entity and number; void needs the void permission;
-- the total can't drop below what was paid; only issue_invoice() moves a draft out of draft.
create or replace function public.invoices_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if old.status <> 'draft' then
    if new.client_id is distinct from old.client_id or new.entity_id is distinct from old.entity_id
       or new.number is distinct from old.number or new.currency is distinct from old.currency then
      raise exception 'Client, entity, currency and number are locked once issued' using errcode = '42501';
    end if;
    if new.status = 'draft' then
      raise exception 'An issued invoice cannot go back to draft' using errcode = '42501';
    end if;
    if (new.total, new.discount, new.issued_on, new.due_on, new.title, new.po_ref)
       is distinct from (old.total, old.discount, old.issued_on, old.due_on, old.title, old.po_ref)
       and not public.has_perm('finance.invoices.edit_issued', 'all') then
      raise exception 'You can''t edit issued invoices' using errcode = '42501';
    end if;
  elsif new.status <> 'draft' and coalesce(current_setting('app.issuing', true), '') <> 'on' then
    raise exception 'Use issue_invoice() to issue a draft' using errcode = '42501';
  end if;
  if new.status = 'void' and old.status <> 'void' and not public.has_perm('finance.invoices.void', 'all') then
    raise exception 'You can''t void invoices' using errcode = '42501';
  end if;
  if new.status <> 'draft' and new.total < new.amount_paid - new.amount_refunded then
    raise exception 'The total can''t drop below the amount already paid' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger invoices_guard before update on public.invoices for each row execute function public.invoices_guard();

-- Issue a draft: take the next number for its entity, save today's USD rate, log the event.
create or replace function public.issue_invoice(inv uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inv public.invoices;
  v_ent public.entities;
  v_num text;
  v_rate numeric;
begin
  if not public.has_perm('finance.invoices.create', 'all') then
    raise exception 'You can''t issue invoices' using errcode = '42501';
  end if;
  select * into v_inv from public.invoices where id = inv for update;
  if not found then
    raise exception 'Invoice not found' using errcode = 'P0002';
  end if;
  if v_inv.status <> 'draft' then
    raise exception 'Only drafts can be issued' using errcode = '22023';
  end if;
  if v_inv.total <= 0 then
    raise exception 'Add at least one line with an amount before issuing' using errcode = '22023';
  end if;
  select * into v_ent from public.entities where id = v_inv.entity_id for update;
  v_num := 'INV-' || v_ent.invoice_prefix || '-' || lpad(v_ent.next_number::text, 4, '0');
  update public.entities set next_number = next_number + 1 where id = v_ent.id;
  select rate_to_usd into v_rate from public.fx_rates
    where currency = v_inv.currency and valid_from <= v_inv.issued_on
    order by valid_from desc limit 1;
  if v_rate is null then
    select rate_to_usd into v_rate from public.fx_rates where currency = v_inv.currency order by valid_from limit 1;
  end if;
  perform set_config('app.issuing', 'on', true);
  update public.invoices
     set number = v_num, status = 'issued', fx_rate_usd = coalesce(v_rate, case when v_inv.currency = 'USD' then 1 end),
         issued_by = auth.uid(), issued_at = now()
   where id = inv;
  perform set_config('app.issuing', 'off', true);
  insert into public.invoice_events (invoice_id, kind, actor_id, note)
    values (inv, 'issued', auth.uid(), 'Issued. Number ' || v_num || ' assigned');
  return v_num;
end;
$$;
revoke execute on function public.issue_invoice(uuid) from public, anon;
grant execute on function public.issue_invoice(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------- RLS
alter table public.entities enable row level security;
alter table public.channels_pay enable row level security;
alter table public.fx_rates enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.invoice_events enable row level security;

-- Anyone working with finance reads entities and channels. Client logins read them for their invoice PDF.
create policy entities_select on public.entities for select to authenticated using (
  (public.is_staff() and (public.has_perm('finance.invoices.view', 'own') or public.has_perm('finance.dashboard.view', 'own')
     or public.has_perm('finance.payments.view', 'own') or public.has_perm('finance.settings.manage', 'own')
     or public.has_perm('clients.billing.view', 'own')))
  or (public.my_client_id() is not null and public.has_perm('finance.invoices.view', 'own'))
);
create policy entities_write on public.entities for all to authenticated
  using (public.has_perm('finance.settings.manage', 'all'))
  with check (public.has_perm('finance.settings.manage', 'all'));

create policy channels_pay_select on public.channels_pay for select to authenticated using (
  (public.is_staff() and (public.has_perm('finance.invoices.view', 'own') or public.has_perm('finance.dashboard.view', 'own')
     or public.has_perm('finance.payments.view', 'own') or public.has_perm('finance.settings.manage', 'own')
     or public.has_perm('clients.billing.view', 'own')))
  or (public.my_client_id() is not null and public.has_perm('finance.invoices.view', 'own'))
);
create policy channels_pay_write on public.channels_pay for all to authenticated
  using (public.has_perm('finance.settings.manage', 'all'))
  with check (public.has_perm('finance.settings.manage', 'all'));

create policy fx_rates_select on public.fx_rates for select to authenticated using (
  public.is_staff() and (public.has_perm('finance.invoices.view', 'own') or public.has_perm('finance.dashboard.view', 'own')
    or public.has_perm('finance.payments.view', 'own') or public.has_perm('finance.profitability.view', 'own')
    or public.has_perm('finance.settings.manage', 'own'))
);
create policy fx_rates_write on public.fx_rates for all to authenticated
  using (public.has_perm('finance.settings.manage', 'all'))
  with check (public.has_perm('finance.settings.manage', 'all'));

-- Staff: all, or invoices of clients they own or manage (team: clients owned or managed by their team).
create policy invoices_staff_select on public.invoices for select to authenticated using (
  public.is_staff() and (
    public.has_perm('finance.invoices.view', 'all')
    or exists (
      select 1 from public.clients c
      where c.id = invoices.client_id and (
        (public.has_perm('finance.invoices.view', 'team') and (public.in_my_team(c.owner_id) or public.in_my_team(c.manager_id)))
        or (public.has_perm('finance.invoices.view', 'own') and auth.uid() in (c.owner_id, c.manager_id))
      )
    )
  )
);
-- Client logins: their own client's invoices once issued.
create policy invoices_client_select on public.invoices for select to authenticated using (
  client_id = public.my_client_id() and public.has_perm('finance.invoices.view', 'own') and status <> 'draft'
);
create policy invoices_insert on public.invoices for insert to authenticated
  with check (public.is_staff() and public.has_perm('finance.invoices.create', 'all') and status = 'draft');
create policy invoices_update on public.invoices for update to authenticated
  using (public.is_staff() and (public.has_perm('finance.invoices.create', 'all') or public.has_perm('finance.payments.record', 'all')))
  with check (public.is_staff() and (public.has_perm('finance.invoices.create', 'all') or public.has_perm('finance.payments.record', 'all')));
create policy invoices_delete on public.invoices for delete to authenticated
  using (public.is_staff() and public.has_perm('finance.invoices.create', 'all') and status = 'draft');

-- Lines follow the invoice: whoever can see the invoice sees its lines.
create policy invoice_lines_select on public.invoice_lines for select to authenticated using (
  exists (select 1 from public.invoices i where i.id = invoice_lines.invoice_id)
);
create policy invoice_lines_write on public.invoice_lines for all to authenticated
  using (
    public.is_staff() and exists (
      select 1 from public.invoices i where i.id = invoice_lines.invoice_id and (
        (i.status = 'draft' and public.has_perm('finance.invoices.create', 'all'))
        or public.has_perm('finance.invoices.edit_issued', 'all')))
  )
  with check (
    public.is_staff() and exists (
      select 1 from public.invoices i where i.id = invoice_lines.invoice_id and (
        (i.status = 'draft' and public.has_perm('finance.invoices.create', 'all'))
        or public.has_perm('finance.invoices.edit_issued', 'all')))
  );

-- History is staff only and append-only.
create policy invoice_events_select on public.invoice_events for select to authenticated using (
  public.is_staff() and exists (select 1 from public.invoices i where i.id = invoice_events.invoice_id)
);
create policy invoice_events_insert on public.invoice_events for insert to authenticated with check (
  public.is_staff()
  and (actor_id is null or actor_id = auth.uid())
  and (public.has_perm('finance.invoices.create', 'all') or public.has_perm('finance.invoices.send', 'all')
       or public.has_perm('finance.payments.record', 'all'))
  and exists (select 1 from public.invoices i where i.id = invoice_events.invoice_id)
);

-- 0203_client_admin: client page admin extras (Phase 2).
--   Terms card (client_agreements + private bucket "client-agreements"), Health card (client_sentiments, churn_alerts),
--   Vault (client_vault_items + client_vault_reveals, secrets in Supabase Vault), portal activity lines,
--   win-back for ended clients (client_winbacks), and a log of deleted clients (client_deletions).
-- Depends on 0001_core (members, helpers), 0108_clients (clients, client_team) and 0201_client_success (cs_staff_can).
--
-- Access model
--   Staff read: clients.view, scoped by public.cs_staff_can (all = every client; own/team = on the client's account team).
--   Staff write: clients.manage, same scoping.
--   Vault: clients.vault.view lists items and reveals (every reveal is logged by client_vault_reveal()); clients.vault.manage adds,
--     edits and deletes. Passwords live only in vault.secrets; the table holds the secret id, never the password.
--   Delete client: clients.delete 'all' (done by the server action with the service client after the check).
--   Client logins: only activity lines with visibility 'shared' for their own client. Everything else is staff only.

create extension if not exists supabase_vault with schema vault;

-- ---------------------------------------------------------------- terms
create table public.client_agreements (
  client_id uuid primary key references public.clients (id) on delete cascade,
  monthly_fee numeric(14,2) check (monthly_fee is null or monthly_fee >= 0),
  currency text not null default 'AED' check (currency in ('AED', 'USD', 'PKR')),
  start_date date,
  term_months smallint check (term_months is null or term_months between 1 and 120),
  notice_days smallint check (notice_days is null or notice_days between 0 and 365),
  hours_per_month numeric(6,1) check (hours_per_month is null or hours_per_month >= 0),
  in_scope text,
  out_of_scope text,
  renewal_on date,            -- null = start_date + term_months
  auto_renews boolean not null default false,
  agreement_path text,        -- object path in the "client-agreements" bucket: <client_id>/<file>
  agreement_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger client_agreements_updated_at before update on public.client_agreements
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- health: sentiment and churn alerts
create table public.client_sentiments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  sentiment text not null check (sentiment in ('positive', 'neutral', 'negative')),
  note text,
  recorded_on date not null default current_date,
  recorded_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index client_sentiments_client_idx on public.client_sentiments (client_id, recorded_on desc);
create trigger client_sentiments_updated_at before update on public.client_sentiments
  for each row execute function public.set_updated_at();

create table public.churn_alerts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  trigger_kind text not null check (trigger_kind in ('risk', 'drop', 'sentiment', 'not_renewing', 'nps')),
  detail text not null,
  nps_score smallint check (nps_score is null or nps_score between 0 and 10),
  raised_on date not null default current_date,
  raised_by uuid references public.members (id) on delete set null,
  outcome text not null default 'open' check (outcome in ('open', 'saved', 'reduced_scope', 'lost')),
  outcome_note text,
  closed_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint churn_alerts_closed check ((outcome = 'open') = (closed_on is null))
);
create index churn_alerts_client_idx on public.churn_alerts (client_id, outcome);
create trigger churn_alerts_updated_at before update on public.churn_alerts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- vault
create table public.client_vault_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  service text not null check (length(service) between 1 and 120),
  username text not null default '',
  secret_id uuid not null,    -- vault.secrets(id); read only through client_vault_reveal()
  notes text,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index client_vault_items_client_idx on public.client_vault_items (client_id);
create trigger client_vault_items_updated_at before update on public.client_vault_items
  for each row execute function public.set_updated_at();

create table public.client_vault_reveals (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.client_vault_items (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  member_id uuid references public.members (id) on delete set null,
  revealed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index client_vault_reveals_item_idx on public.client_vault_reveals (item_id, revealed_at desc);
create index client_vault_reveals_client_idx on public.client_vault_reveals (client_id);
create trigger client_vault_reveals_updated_at before update on public.client_vault_reveals
  for each row execute function public.set_updated_at();

-- Add or update a vault login. Returns the item id. The password goes straight into vault.secrets.
create or replace function public.client_vault_save(
  p_client uuid, p_service text, p_username text, p_secret text, p_notes text default null, p_item uuid default null
) returns uuid
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_item uuid := p_item;
  v_secret uuid;
begin
  if not public.cs_staff_can('clients.vault.manage', p_client) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if v_item is null then
    if coalesce(p_secret, '') = '' then
      raise exception 'password required' using errcode = '22023';
    end if;
    v_secret := vault.create_secret(p_secret, null, 'client vault login');
    insert into public.client_vault_items (client_id, service, username, secret_id, notes, created_by)
    values (p_client, p_service, coalesce(p_username, ''), v_secret, p_notes, auth.uid())
    returning id into v_item;
  else
    update public.client_vault_items
       set service = p_service, username = coalesce(p_username, ''), notes = p_notes
     where id = v_item and client_id = p_client
    returning secret_id into v_secret;
    if v_secret is null then
      raise exception 'not found' using errcode = 'P0002';
    end if;
    if coalesce(p_secret, '') <> '' then
      perform vault.update_secret(v_secret, p_secret);
    end if;
  end if;
  return v_item;
end;
$$;
revoke execute on function public.client_vault_save(uuid, text, text, text, text, uuid) from public, anon;
grant execute on function public.client_vault_save(uuid, text, text, text, text, uuid) to authenticated;

-- Reveal one password. Logs the reveal first; the caller hides it again after 30 seconds.
create or replace function public.client_vault_reveal(p_item uuid)
returns text
language plpgsql volatile security definer
set search_path = ''
as $$
declare
  v_client uuid;
  v_secret uuid;
  v_value text;
begin
  select client_id, secret_id into v_client, v_secret from public.client_vault_items where id = p_item;
  if v_client is null or not public.cs_staff_can('clients.vault.view', v_client) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  insert into public.client_vault_reveals (item_id, client_id, member_id) values (p_item, v_client, auth.uid());
  select decrypted_secret into v_value from vault.decrypted_secrets where id = v_secret;
  return v_value;
end;
$$;
revoke execute on function public.client_vault_reveal(uuid) from public, anon;
grant execute on function public.client_vault_reveal(uuid) to authenticated;

-- Remove the stored secret when its vault item goes (direct delete or client cascade).
create or replace function public.client_vault_drop_secret()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  delete from vault.secrets where id = old.secret_id;
  return old;
end;
$$;
revoke execute on function public.client_vault_drop_secret() from public, anon;
create trigger client_vault_items_drop_secret after delete on public.client_vault_items
  for each row execute function public.client_vault_drop_secret();

-- ---------------------------------------------------------------- portal activity lines
create table public.client_activity_lines (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  body text not null check (length(body) between 1 and 300),
  happened_on date not null default current_date,
  visibility text not null default 'draft' check (visibility in ('draft', 'shared', 'hidden')),
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index client_activity_lines_client_idx on public.client_activity_lines (client_id, happened_on desc);
create trigger client_activity_lines_updated_at before update on public.client_activity_lines
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- win-back
create table public.client_winbacks (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  owner_id uuid references public.members (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'won', 'lost')),
  next_step text,
  due_on date,
  note text,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index client_winbacks_one_open on public.client_winbacks (client_id) where status = 'open';
create index client_winbacks_owner_idx on public.client_winbacks (owner_id);
create trigger client_winbacks_updated_at before update on public.client_winbacks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- deleted clients log (no FK: the client is gone)
create table public.client_deletions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null,
  client_name text not null,
  history jsonb not null default '{}'::jsonb,
  deleted_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger client_deletions_updated_at before update on public.client_deletions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- RLS
alter table public.client_agreements enable row level security;
alter table public.client_sentiments enable row level security;
alter table public.churn_alerts enable row level security;
alter table public.client_vault_items enable row level security;
alter table public.client_vault_reveals enable row level security;
alter table public.client_activity_lines enable row level security;
alter table public.client_winbacks enable row level security;
alter table public.client_deletions enable row level security;

-- Staff tables with the standard view/manage split.
do $$
declare t text;
begin
  foreach t in array array['client_agreements', 'client_sentiments', 'churn_alerts', 'client_activity_lines', 'client_winbacks'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.cs_staff_can(''clients.view'', client_id))', t || '_staff_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.cs_staff_can(''clients.manage'', client_id))', t || '_staff_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.cs_staff_can(''clients.manage'', client_id)) with check (public.cs_staff_can(''clients.manage'', client_id))', t || '_staff_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.cs_staff_can(''clients.manage'', client_id))', t || '_staff_delete', t);
  end loop;
end;
$$;

-- Vault: list with vault.view; insert/update only through client_vault_save(); delete with vault.manage.
create policy client_vault_items_staff_select on public.client_vault_items for select to authenticated
  using (public.cs_staff_can('clients.vault.view', client_id));
create policy client_vault_items_staff_delete on public.client_vault_items for delete to authenticated
  using (public.cs_staff_can('clients.vault.manage', client_id));
-- Reveal log: read-only to staff who can see the vault; rows are written by client_vault_reveal().
create policy client_vault_reveals_staff_select on public.client_vault_reveals for select to authenticated
  using (public.cs_staff_can('clients.vault.view', client_id));

-- Client logins: shared activity lines for their own client only.
create policy client_activity_lines_client_select on public.client_activity_lines for select to authenticated
  using (client_id = public.my_client_id() and visibility = 'shared');

-- Deletion log: read by people who can delete clients; written by the server action (service client).
create policy client_deletions_select on public.client_deletions for select to authenticated
  using (public.is_staff() and public.has_perm('clients.delete', 'all'));

-- ---------------------------------------------------------------- signed agreements bucket (private)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('client-agreements', 'client-agreements', false, 15728640, array['application/pdf', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;

-- Object path: <client_id>/<file>. The first folder decides access.
create or replace function public.ca_object_client(object_name text)
returns uuid
language sql stable
set search_path = ''
as $$
  select case when (storage.foldername(object_name))[1] ~ '^[0-9a-f-]{36}$'
              then ((storage.foldername(object_name))[1])::uuid end;
$$;

create policy client_agreements_obj_select on storage.objects for select to authenticated
  using (bucket_id = 'client-agreements' and public.ca_object_client(name) is not null and public.cs_staff_can('clients.view', public.ca_object_client(name)));
create policy client_agreements_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'client-agreements' and public.ca_object_client(name) is not null and public.cs_staff_can('clients.manage', public.ca_object_client(name)));
create policy client_agreements_obj_update on storage.objects for update to authenticated
  using (bucket_id = 'client-agreements' and public.ca_object_client(name) is not null and public.cs_staff_can('clients.manage', public.ca_object_client(name)))
  with check (bucket_id = 'client-agreements' and public.ca_object_client(name) is not null and public.cs_staff_can('clients.manage', public.ca_object_client(name)));
create policy client_agreements_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'client-agreements' and public.ca_object_client(name) is not null and public.cs_staff_can('clients.manage', public.ca_object_client(name)));

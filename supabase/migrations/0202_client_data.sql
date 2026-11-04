-- 0202_client_data: Phase 2 client page data tabs.
-- Accounts & projects (sub-accounts), Performance (data sources + daily metrics), Analysis, Ads, Leads, Website, SEO.
-- Depends on 0001_core (members, helpers) and 0108_clients (clients).
-- No OAuth tokens are stored here: the source adapters are "not configured" until the lead adds API access.

-- ---------------------------------------------------------------- access helpers
-- security invoker on purpose: the exists() runs under the clients table's own RLS,
-- so "which clients can I see" stays defined in one place (0108_clients).
create or replace function public.client_data_can_view(cid uuid)
returns boolean
language sql stable security invoker
set search_path = ''
as $$
  select public.is_staff()
     and public.has_perm('clients.view', 'own')
     and exists (select 1 from public.clients c where c.id = cid);
$$;

create or replace function public.client_data_can_manage(cid uuid)
returns boolean
language sql stable security invoker
set search_path = ''
as $$
  select public.is_staff()
     and public.has_perm('clients.data.manage', 'own')
     and exists (select 1 from public.clients c where c.id = cid);
$$;

grant execute on function public.client_data_can_view(uuid), public.client_data_can_manage(uuid) to authenticated, service_role;
revoke execute on function public.client_data_can_view(uuid), public.client_data_can_manage(uuid) from public, anon;

-- ---------------------------------------------------------------- sub-accounts (agency clients)
create table if not exists public.client_sub_accounts (
  id uuid primary key default gen_random_uuid(),
  parent_client_id uuid not null references public.clients (id) on delete cascade,
  child_client_id uuid not null references public.clients (id) on delete cascade,
  billing text not null default 'parent' check (billing in ('parent', 'own')),
  linked_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_sub_accounts_not_self check (parent_client_id <> child_client_id),
  constraint client_sub_accounts_child_once unique (child_client_id)
);
create index if not exists client_sub_accounts_parent_idx on public.client_sub_accounts (parent_client_id);
drop trigger if exists client_sub_accounts_updated_at on public.client_sub_accounts;
create trigger client_sub_accounts_updated_at before update on public.client_sub_accounts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- data sources
create table if not exists public.client_data_sources (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  source text not null check (source in ('gsc', 'ga4', 'gbp', 'google_ads', 'meta_ads')),
  status text not null default 'not_connected' check (status in ('not_connected', 'connected', 'refreshing', 'error')),
  account_label text,
  external_id text,
  last_refresh_at timestamptz,
  last_error text,
  connected_by uuid references public.members (id) on delete set null,
  connected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, source)
);
drop trigger if exists client_data_sources_updated_at on public.client_data_sources;
create trigger client_data_sources_updated_at before update on public.client_data_sources
  for each row execute function public.set_updated_at();

-- One value per client, source, metric and day. 28-day snapshots are summed from these.
create table if not exists public.client_metric_daily (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  source text not null check (source in ('gsc', 'ga4', 'gbp', 'google_ads', 'meta_ads')),
  metric text not null check (metric in ('sessions', 'organic_clicks', 'impressions', 'leads', 'gbp_calls', 'ad_spend', 'ad_clicks', 'ad_leads')),
  day date not null,
  value numeric(14,2) not null default 0,
  currency text check (currency in ('AED', 'USD', 'PKR')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, source, metric, day)
);
create index if not exists client_metric_daily_client_day_idx on public.client_metric_daily (client_id, day);
drop trigger if exists client_metric_daily_updated_at on public.client_metric_daily;
create trigger client_metric_daily_updated_at before update on public.client_metric_daily
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- analysis
create table if not exists public.client_analyses (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  period date not null, -- first day of the month analysed
  what_changed text[] not null default '{}',
  why text[] not null default '{}',
  next_steps text[] not null default '{}',
  author_id uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, period)
);
drop trigger if exists client_analyses_updated_at on public.client_analyses;
create trigger client_analyses_updated_at before update on public.client_analyses
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- ads
create table if not exists public.ad_budgets (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  month date not null, -- first day of the month
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'AED' check (currency in ('AED', 'USD', 'PKR')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, month)
);
drop trigger if exists ad_budgets_updated_at on public.ad_budgets;
create trigger ad_budgets_updated_at before update on public.ad_budgets
  for each row execute function public.set_updated_at();

-- Campaign rows with rolling totals, refreshed by the Google Ads / Meta adapters.
create table if not exists public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  platform text not null check (platform in ('google_ads', 'meta_ads')),
  external_id text,
  name text not null,
  status text not null default 'running' check (status in ('running', 'learning', 'fatigued', 'paused', 'ended')),
  currency text not null default 'AED' check (currency in ('AED', 'USD', 'PKR')),
  spend_28d numeric(14,2) not null default 0,
  clicks_28d integer not null default 0,
  leads_28d integer not null default 0,
  spend_mtd numeric(14,2) not null default 0,
  leads_mtd integer not null default 0,
  synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ad_campaigns_client_idx on public.ad_campaigns (client_id);
drop trigger if exists ad_campaigns_updated_at on public.ad_campaigns;
create trigger ad_campaigns_updated_at before update on public.ad_campaigns
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- leads
create table if not exists public.client_leads (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  received_at timestamptz not null default now(),
  name text not null,
  email text,
  phone text,
  source text not null check (source in ('google_ads', 'meta_lead_form', 'website_form', 'whatsapp', 'phone', 'gbp', 'other')),
  interest text,
  outcome text not null default 'new' check (outcome in ('new', 'contacted', 'booked', 'won', 'lost', 'not_lead')),
  first_contact_at timestamptz,
  value numeric(14,2),
  currency text check (currency in ('AED', 'USD', 'PKR')),
  campaign_id uuid references public.ad_campaigns (id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists client_leads_client_received_idx on public.client_leads (client_id, received_at desc);
create index if not exists client_leads_campaign_idx on public.client_leads (campaign_id);
drop trigger if exists client_leads_updated_at on public.client_leads;
create trigger client_leads_updated_at before update on public.client_leads
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- website
create table if not exists public.client_websites (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique references public.clients (id) on delete cascade,
  url text not null,
  platform text,
  hosting text,
  ssl_renews_on date,
  domain_renews_on date,
  tracking text[] not null default '{}',
  uptime_30d numeric(5,2),
  mobile_speed integer check (mobile_speed between 0 and 100),
  lcp_ms integer,
  forms_total integer not null default 0,
  forms_working integer not null default 0,
  forms_tested_at timestamptz,
  last_backup_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists client_websites_updated_at on public.client_websites;
create trigger client_websites_updated_at before update on public.client_websites
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- SEO (Search Console queries, last 28 days)
create table if not exists public.seo_queries (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  query text not null,
  position numeric(6,2) not null,
  prior_position numeric(6,2),
  clicks integer not null default 0,
  impressions integer not null default 0,
  period_end date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, query)
);
drop trigger if exists seo_queries_updated_at on public.seo_queries;
create trigger seo_queries_updated_at before update on public.seo_queries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- RLS
alter table public.client_sub_accounts enable row level security;
alter table public.client_data_sources enable row level security;
alter table public.client_metric_daily enable row level security;
alter table public.client_analyses enable row level security;
alter table public.ad_budgets enable row level security;
alter table public.ad_campaigns enable row level security;
alter table public.client_leads enable row level security;
alter table public.client_websites enable row level security;
alter table public.seo_queries enable row level security;

-- Sub-accounts: staff who can see the parent; managers write.
drop policy if exists client_sub_accounts_staff_select on public.client_sub_accounts;
create policy client_sub_accounts_staff_select on public.client_sub_accounts for select to authenticated
  using (public.client_data_can_view(parent_client_id));
drop policy if exists client_sub_accounts_staff_insert on public.client_sub_accounts;
create policy client_sub_accounts_staff_insert on public.client_sub_accounts for insert to authenticated
  with check (public.client_data_can_manage(parent_client_id) and public.client_data_can_view(child_client_id));
drop policy if exists client_sub_accounts_staff_update on public.client_sub_accounts;
create policy client_sub_accounts_staff_update on public.client_sub_accounts for update to authenticated
  using (public.client_data_can_manage(parent_client_id))
  with check (public.client_data_can_manage(parent_client_id));
drop policy if exists client_sub_accounts_staff_delete on public.client_sub_accounts;
create policy client_sub_accounts_staff_delete on public.client_sub_accounts for delete to authenticated
  using (public.client_data_can_manage(parent_client_id));

-- Same staff pattern for every client_id table; clients only read their own leads.
do $$
declare t text; a text;
begin
  foreach t in array array['client_data_sources', 'client_metric_daily', 'client_analyses', 'ad_budgets',
                           'ad_campaigns', 'client_leads', 'client_websites', 'seo_queries']
  loop
    foreach a in array array['select', 'insert', 'update', 'delete'] loop
      execute format('drop policy if exists %1$s_staff_%2$s on public.%1$s', t, a);
    end loop;
    execute format('create policy %1$s_staff_select on public.%1$s for select to authenticated using (public.client_data_can_view(client_id))', t);
    execute format('create policy %1$s_staff_insert on public.%1$s for insert to authenticated with check (public.client_data_can_manage(client_id))', t);
    execute format('create policy %1$s_staff_update on public.%1$s for update to authenticated using (public.client_data_can_manage(client_id)) with check (public.client_data_can_manage(client_id))', t);
    execute format('create policy %1$s_staff_delete on public.%1$s for delete to authenticated using (public.client_data_can_manage(client_id))', t);
  end loop;
end $$;

drop policy if exists client_leads_client_select on public.client_leads;
create policy client_leads_client_select on public.client_leads for select to authenticated
  using (client_id = public.my_client_id() and public.has_perm('clients.leads.view', 'own'));

-- 0208_platform_p2: Phase 2 platform extras.
-- Home: announcements (post, pin, expire), getting-started progress, pipeline deals (My pipeline panel).
-- Settings: api_keys (scoped, hashed, shown once), notification_deliveries (notifications log).
-- Integrations (all "not configured" until the user gives access): integration_connections + integration_runs
-- (Google Calendar per person; Fireflies, Gmail inbox and the AI provider per workspace), fireflies_calls
-- (imported calls with AI summary), inbox_messages (client email inbox triage counts).
-- No tokens or secrets are stored here. Real credentials will live in Supabase Vault / env, not in these tables.
-- Depends on 0001_core, 0101_shell (notifications), 0106_tickets (tickets), 0108_clients (clients).

-- ---------------------------------------------------------------- announcements
create table public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 140),
  body text not null default '' check (char_length(body) <= 4000),
  department_id uuid references public.departments (id) on delete cascade, -- null = everyone
  pinned boolean not null default false,
  expires_on date,
  author_id uuid references public.members (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index announcements_dept_idx on public.announcements (department_id);
create index announcements_author_idx on public.announcements (author_id);
create index announcements_created_idx on public.announcements (created_at desc);
create trigger announcements_updated_at before update on public.announcements
  for each row execute function public.set_updated_at();

create or replace function public.announcement_my_department()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select department_id from public.members where id = auth.uid() and status = 'active';
$$;

alter table public.announcements enable row level security;
-- Staff read everything for everyone plus their own department's posts. Posters also see what they wrote.
create policy announcements_select on public.announcements for select to authenticated using (
  public.is_staff() and (
    department_id is null
    or department_id = public.announcement_my_department()
    or author_id = auth.uid()
    or public.has_perm('home.announcements.post', 'all')
  )
);
-- 'all' posts to anyone; 'own'/'team' posts only to the poster's department.
create policy announcements_insert on public.announcements for insert to authenticated with check (
  public.is_staff() and author_id = auth.uid() and (
    public.has_perm('home.announcements.post', 'all')
    or (public.has_perm('home.announcements.post', 'own') and department_id = public.announcement_my_department())
  )
);
create policy announcements_update on public.announcements for update to authenticated
  using (public.has_perm('home.announcements.post', 'all') or (author_id = auth.uid() and public.has_perm('home.announcements.post', 'own')))
  with check (public.has_perm('home.announcements.post', 'all') or (author_id = auth.uid() and department_id = public.announcement_my_department()));
create policy announcements_delete on public.announcements for delete to authenticated
  using (public.has_perm('home.announcements.post', 'all') or (author_id = auth.uid() and public.has_perm('home.announcements.post', 'own')));

-- ---------------------------------------------------------------- getting started
create table public.onboarding_steps (
  member_id uuid not null references public.members (id) on delete cascade default auth.uid(),
  step text not null check (step in ('photo', 'calendar', 'hours', 'channel', 'push', 'first_hour')),
  done_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (member_id, step)
);
create trigger onboarding_steps_updated_at before update on public.onboarding_steps
  for each row execute function public.set_updated_at();
alter table public.onboarding_steps enable row level security;
create policy onboarding_steps_own on public.onboarding_steps for all to authenticated
  using (member_id = auth.uid() and public.is_staff())
  with check (member_id = auth.uid() and public.is_staff());

-- ---------------------------------------------------------------- pipeline deals (Home "My pipeline")
create table public.pipeline_deals (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 160),
  service text,
  stage text not null default 'discovery' check (stage in ('discovery', 'proposal', 'negotiation', 'won', 'lost')),
  value numeric(14,2) not null default 0 check (value >= 0),
  currency text not null default 'AED' check (currency in ('AED', 'USD', 'PKR')),
  owner_id uuid not null references public.members (id) on delete cascade default auth.uid(),
  expected_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pipeline_deals_owner_idx on public.pipeline_deals (owner_id);
create trigger pipeline_deals_updated_at before update on public.pipeline_deals
  for each row execute function public.set_updated_at();
alter table public.pipeline_deals enable row level security;
create policy pipeline_deals_select on public.pipeline_deals for select to authenticated using (
  public.has_perm('clients.view', 'all')
  or (public.has_perm('clients.view', 'team') and public.in_my_team(owner_id))
  or (owner_id = auth.uid() and public.is_staff())
);
create policy pipeline_deals_write on public.pipeline_deals for all to authenticated
  using ((owner_id = auth.uid() and public.is_staff()) or public.has_perm('clients.manage', 'all'))
  with check ((owner_id = auth.uid() and public.is_staff()) or public.has_perm('clients.manage', 'all'));

-- ---------------------------------------------------------------- API keys
-- The full key is shown once at creation. Only its SHA-256 hash and a short display prefix are stored.
create table public.api_keys (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  prefix text not null check (prefix ~ '^pk_[a-z0-9]{6}$'),
  key_hash text not null unique check (key_hash ~ '^[0-9a-f]{64}$'),
  scopes text[] not null check (cardinality(scopes) between 1 and 10
    and scopes <@ array['time.view', 'clients.view', 'tickets.view', 'finance.invoices.view']::text[]),
  created_by uuid references public.members (id) on delete set null default auth.uid(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index api_keys_created_by_idx on public.api_keys (created_by);
create index api_keys_revoked_by_idx on public.api_keys (revoked_by);
create trigger api_keys_updated_at before update on public.api_keys
  for each row execute function public.set_updated_at();
alter table public.api_keys enable row level security;
create policy api_keys_admin_select on public.api_keys for select to authenticated
  using (public.has_perm('admin.access.manage', 'all'));
create policy api_keys_admin_insert on public.api_keys for insert to authenticated
  with check (public.has_perm('admin.access.manage', 'all') and created_by = auth.uid() and revoked_at is null);
create policy api_keys_admin_update on public.api_keys for update to authenticated
  using (public.has_perm('admin.access.manage', 'all'))
  with check (public.has_perm('admin.access.manage', 'all'));
-- No delete: revoked keys stay for the record.

-- ---------------------------------------------------------------- notifications log
-- One row per delivery attempt (phone push, email, in-app). Written by the service role (Edge Functions).
create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid references public.notifications (id) on delete set null,
  member_id uuid references public.members (id) on delete cascade, -- null when sent to an outside address
  to_address text,
  channel text not null check (channel in ('push', 'email', 'in_app')),
  message text not null,
  result text not null check (result in ('queued', 'delivered', 'held', 'bounced', 'failed')),
  error text,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_deliveries_target check (member_id is not null or to_address is not null)
);
create index notification_deliveries_sent_idx on public.notification_deliveries (sent_at desc);
create index notification_deliveries_member_idx on public.notification_deliveries (member_id);
create index notification_deliveries_notification_idx on public.notification_deliveries (notification_id);
create trigger notification_deliveries_updated_at before update on public.notification_deliveries
  for each row execute function public.set_updated_at();
alter table public.notification_deliveries enable row level security;
create policy notification_deliveries_select on public.notification_deliveries for select to authenticated using (
  public.has_perm('admin.access.manage', 'all') or (member_id = auth.uid() and public.is_staff())
);
-- No insert/update policy: only the service role writes delivery results.

-- ---------------------------------------------------------------- integrations
create table public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('google_calendar', 'fireflies', 'gmail', 'ai')),
  member_id uuid references public.members (id) on delete cascade, -- set for per-person providers (google_calendar)
  status text not null default 'not_configured' check (status in ('not_configured', 'connected', 'error', 'disconnected')),
  account_label text,           -- e.g. sara@permanentseo.ae or clients@permanentseo.ae
  last_sync_at timestamptz,
  last_error text,
  settings jsonb not null default '{}'::jsonb, -- non-secret options only (poll minutes, calendar id…)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint integration_connections_scope check ((provider = 'google_calendar') = (member_id is not null)),
  unique nulls not distinct (provider, member_id)
);
create index integration_connections_member_idx on public.integration_connections (member_id);
create trigger integration_connections_updated_at before update on public.integration_connections
  for each row execute function public.set_updated_at();
alter table public.integration_connections enable row level security;
create policy integration_connections_select on public.integration_connections for select to authenticated using (
  public.is_staff() and (member_id is null or member_id = auth.uid() or public.has_perm('admin.access.manage', 'all'))
);
create policy integration_connections_write on public.integration_connections for all to authenticated
  using (public.is_staff() and ((member_id = auth.uid()) or (member_id is null and public.has_perm('admin.access.manage', 'all'))))
  with check (public.is_staff() and ((member_id = auth.uid()) or (member_id is null and public.has_perm('admin.access.manage', 'all'))));

create table public.integration_runs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.integration_connections (id) on delete cascade,
  kind text not null check (kind in ('sync', 'import', 'poll', 'summary')),
  status text not null check (status in ('not_configured', 'running', 'ok', 'error')),
  message text,
  counts jsonb not null default '{}'::jsonb,
  started_by uuid references public.members (id) on delete set null default auth.uid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index integration_runs_connection_idx on public.integration_runs (connection_id, started_at desc);
create index integration_runs_started_by_idx on public.integration_runs (started_by);
create trigger integration_runs_updated_at before update on public.integration_runs
  for each row execute function public.set_updated_at();
alter table public.integration_runs enable row level security;
create policy integration_runs_select on public.integration_runs for select to authenticated using (
  exists (select 1 from public.integration_connections c where c.id = connection_id) -- inherits the connection's select policy
);
create policy integration_runs_insert on public.integration_runs for insert to authenticated with check (
  started_by = auth.uid() and public.is_staff()
  and exists (select 1 from public.integration_connections c where c.id = connection_id)
);

-- ---------------------------------------------------------------- Fireflies calls (Meetings)
create table public.fireflies_calls (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique,
  title text not null,
  occurred_at timestamptz not null,
  minutes int not null default 0 check (minutes >= 0),
  participants text[] not null default '{}', -- email addresses
  client_id uuid references public.clients (id) on delete set null,
  match_method text not null default 'none' check (match_method in ('email', 'domain', 'title', 'manual', 'none')),
  transcript_url text,
  summary jsonb, -- {decisions: string[], concerns: {text, quote}[], actions: {text, owner}[]}
  summary_status text not null default 'none' check (summary_status in ('none', 'not_configured', 'ready', 'error')),
  summarized_at timestamptz,
  meeting_id uuid, -- the Phase 1 meeting-notes row created from this call (0109; no fk kept on purpose)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index fireflies_calls_client_idx on public.fireflies_calls (client_id);
create index fireflies_calls_occurred_idx on public.fireflies_calls (occurred_at desc);
create trigger fireflies_calls_updated_at before update on public.fireflies_calls
  for each row execute function public.set_updated_at();
alter table public.fireflies_calls enable row level security;
create policy fireflies_calls_select on public.fireflies_calls for select to authenticated
  using (public.is_staff() and public.has_perm('clients.view', 'own'));
create policy fireflies_calls_write on public.fireflies_calls for update to authenticated
  using (public.is_staff() and public.has_perm('clients.view', 'own'))
  with check (public.is_staff() and public.has_perm('clients.view', 'own'));
-- Inserts come from the import job (service role).

-- ---------------------------------------------------------------- client email inbox (Response times)
create table public.inbox_messages (
  id uuid primary key default gen_random_uuid(),
  external_id text not null unique, -- Gmail message id
  mailbox text not null,            -- e.g. clients@permanentseo.ae
  from_address text not null,
  subject text not null default '',
  received_at timestamptz not null,
  client_id uuid references public.clients (id) on delete set null,
  outcome text not null check (outcome in ('new_ticket', 'added_to_ticket', 'not_client', 'automatic', 'from_us')),
  ticket_id uuid references public.tickets (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index inbox_messages_received_idx on public.inbox_messages (received_at desc);
create index inbox_messages_client_idx on public.inbox_messages (client_id);
create index inbox_messages_ticket_idx on public.inbox_messages (ticket_id);
create trigger inbox_messages_updated_at before update on public.inbox_messages
  for each row execute function public.set_updated_at();
alter table public.inbox_messages enable row level security;
create policy inbox_messages_select on public.inbox_messages for select to authenticated
  using (public.is_staff() and public.has_perm('clients.view', 'own'));
-- Inserts come from the poll job (service role).

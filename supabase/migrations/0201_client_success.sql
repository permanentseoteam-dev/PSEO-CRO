-- 0201_client_success: client page Phase 2 tabs: Commitments, Relationship, Reports, Delivery ratings.
-- Depends on 0001_core (members, departments, helpers) and 0108_clients (clients, client_team).
--
-- Access model
--   Staff read:  clients.view 'all', or clients.view 'own'/'team' and on the client's account team (cs_on_account).
--   Staff write: clients.manage, same scoping. Report approve/send: clients.reports.approve.
--   Client logins: own client only (client_id = my_client_id()) and only what is shared:
--     commitments with client_visible, sent reports, presented QBRs, and their own delivery ratings (read + rate).
--   Relationship data (people, dates, log, briefs, social, opportunities, removals) is staff only.

-- ---------------------------------------------------------------- helpers
-- True when the signed-in staff member may act on this client for `perm`.
-- 'all' sees every client; 'own'/'team' need a row in client_team (0108_clients: client_team(client_id, member_id)).
-- plpgsql so the client_team lookup only runs for scoped users.
create or replace function public.cs_staff_can(perm text, target_client uuid)
returns boolean
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    return false;
  end if;
  if public.has_perm(perm, 'all') then
    return true;
  end if;
  if not public.has_perm(perm, 'own') then
    return false;
  end if;
  return exists (
    select 1 from public.client_team ct
    where ct.client_id = target_client
      and (ct.member_id = auth.uid() or (public.has_perm(perm, 'team') and public.in_my_team(ct.member_id)))
  );
end;
$$;
revoke execute on function public.cs_staff_can(text, uuid) from public, anon;
grant execute on function public.cs_staff_can(text, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------- per-client settings
create table if not exists public.client_success_profiles (
  client_id uuid primary key references public.clients (id) on delete cascade,
  tier text check (tier in ('A', 'B', 'C')),
  rapport smallint check (rapport between 1 and 5),
  rapport_note text,
  niche_profile text,
  report_due_day smallint not null default 5 check (report_due_day between 1 and 28),
  auto_send boolean not null default false,
  report_recipient text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists client_success_profiles_updated_at on public.client_success_profiles;
create trigger client_success_profiles_updated_at before update on public.client_success_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- commitments
create table if not exists public.commitments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  kind text not null check (kind in ('kpi', 'deliverable', 'milestone')),
  cadence text not null check (cadence in ('weekly', 'monthly', 'quarterly', 'once')),
  target text not null default '',
  latest text,
  status text not null default 'on_track' check (status in ('met', 'on_track', 'at_risk', 'missed')),
  owner_id uuid references public.members (id) on delete set null,
  client_visible boolean not null default true,
  last_checkin_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists commitments_client_idx on public.commitments (client_id);
create index if not exists commitments_owner_idx on public.commitments (owner_id);
drop trigger if exists commitments_updated_at on public.commitments;
create trigger commitments_updated_at before update on public.commitments
  for each row execute function public.set_updated_at();

create table if not exists public.commitment_checkins (
  id uuid primary key default gen_random_uuid(),
  commitment_id uuid not null references public.commitments (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  value text,
  status text not null check (status in ('met', 'on_track', 'at_risk', 'missed')),
  note text,
  checked_on date not null default current_date,
  by_id uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists commitment_checkins_commitment_idx on public.commitment_checkins (commitment_id);
create index if not exists commitment_checkins_client_idx on public.commitment_checkins (client_id, checked_on desc);
drop trigger if exists commitment_checkins_updated_at on public.commitment_checkins;
create trigger commitment_checkins_updated_at before update on public.commitment_checkins
  for each row execute function public.set_updated_at();

-- A check-in updates the commitment's latest value, status and last check-in date (only when it is the newest).
create or replace function public.cs_apply_checkin()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.commitments c
     set latest = coalesce(new.value, c.latest),
         status = new.status,
         last_checkin_on = new.checked_on
   where c.id = new.commitment_id
     and c.client_id = new.client_id
     and (c.last_checkin_on is null or c.last_checkin_on <= new.checked_on);
  return new;
end;
$$;
drop trigger if exists commitment_checkins_apply on public.commitment_checkins;
create trigger commitment_checkins_apply after insert on public.commitment_checkins
  for each row execute function public.cs_apply_checkin();

-- ---------------------------------------------------------------- relationship
create table if not exists public.relationship_people (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  contact_id uuid, -- optional link to client_contacts(id) from 0108_clients; no FK so removal stays local
  name text not null check (length(trim(name)) > 0),
  role text,
  decision_power text,
  personal_notes text,
  birthday date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists relationship_people_client_idx on public.relationship_people (client_id);
drop trigger if exists relationship_people_updated_at on public.relationship_people;
create trigger relationship_people_updated_at before update on public.relationship_people
  for each row execute function public.set_updated_at();

-- Moments and key dates. yearly = repeats every year (birthdays, anniversaries, national days).
create table if not exists public.relationship_dates (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  person_id uuid references public.relationship_people (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  on_date date not null,
  yearly boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists relationship_dates_client_idx on public.relationship_dates (client_id);
create index if not exists relationship_dates_person_idx on public.relationship_dates (person_id);
drop trigger if exists relationship_dates_updated_at on public.relationship_dates;
create trigger relationship_dates_updated_at before update on public.relationship_dates
  for each row execute function public.set_updated_at();

create table if not exists public.relationship_log (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  person_id uuid references public.relationship_people (id) on delete cascade,
  kind text not null check (kind in ('touch', 'call', 'whatsapp', 'email', 'meeting', 'note', 'wish', 'gift', 'card', 'win', 'complaint')),
  mood text check (mood in ('happy', 'neutral', 'unhappy')),
  note text not null check (length(trim(note)) > 0),
  on_date date not null default current_date,
  by_id uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists relationship_log_client_idx on public.relationship_log (client_id, on_date desc);
create index if not exists relationship_log_person_idx on public.relationship_log (person_id);
drop trigger if exists relationship_log_updated_at on public.relationship_log;
create trigger relationship_log_updated_at before update on public.relationship_log
  for each row execute function public.set_updated_at();

create table if not exists public.meeting_briefs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  meeting_id uuid, -- optional link to meetings(id) from 0109_clientops; no FK (wire-in can add one)
  title text not null,
  meeting_on date not null,
  points text not null default '', -- one talking point per line
  by_id uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists meeting_briefs_client_idx on public.meeting_briefs (client_id, meeting_on desc);
drop trigger if exists meeting_briefs_updated_at on public.meeting_briefs;
create trigger meeting_briefs_updated_at before update on public.meeting_briefs
  for each row execute function public.set_updated_at();

-- The client's own social accounts and its competitors.
create table if not exists public.social_profiles (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  is_client boolean not null default false,
  instagram_followers integer check (instagram_followers >= 0),
  ads_running integer check (ads_running >= 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists social_profiles_client_idx on public.social_profiles (client_id);
drop trigger if exists social_profiles_updated_at on public.social_profiles;
create trigger social_profiles_updated_at before update on public.social_profiles
  for each row execute function public.set_updated_at();

create table if not exists public.client_opportunities (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  title text not null check (length(trim(title)) > 0),
  value numeric(14,2) check (value >= 0),
  currency text not null default 'AED' check (currency in ('AED', 'USD', 'PKR')),
  billing text not null default 'monthly' check (billing in ('monthly', 'once')),
  stage text not null default 'idea' check (stage in ('idea', 'pitch', 'quote_sent', 'won', 'lost')),
  stage_note text,
  owner_id uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists client_opportunities_client_idx on public.client_opportunities (client_id);
drop trigger if exists client_opportunities_updated_at on public.client_opportunities;
create trigger client_opportunities_updated_at before update on public.client_opportunities
  for each row execute function public.set_updated_at();

-- Record that a contact's personal data was removed on request (the data itself is deleted).
create table if not exists public.privacy_removals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  person_name text not null,
  removed_by uuid references public.members (id) on delete set null,
  removed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists privacy_removals_client_idx on public.privacy_removals (client_id);
drop trigger if exists privacy_removals_updated_at on public.privacy_removals;
create trigger privacy_removals_updated_at before update on public.privacy_removals
  for each row execute function public.set_updated_at();

-- Deletes a person with their dates and log entries (FK cascade) and records the removal, in one transaction.
create or replace function public.cs_remove_person(target uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  p record;
begin
  select id, client_id, name into p from public.relationship_people where id = target;
  if not found then
    raise exception 'Person not found' using errcode = 'P0002';
  end if;
  delete from public.relationship_people where id = p.id;
  if not found then
    raise exception 'You don''t have access to do that' using errcode = '42501';
  end if;
  insert into public.privacy_removals (client_id, person_name, removed_by) values (p.client_id, p.name, auth.uid());
end;
$$;
revoke execute on function public.cs_remove_person(uuid) from public, anon;
grant execute on function public.cs_remove_person(uuid) to authenticated;

-- ---------------------------------------------------------------- reports
create table if not exists public.monthly_reports (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  status text not null default 'draft' check (status in ('draft', 'submitted', 'changes', 'approved', 'sent')),
  due_on date not null,
  owner_id uuid references public.members (id) on delete set null,
  auto_send boolean not null default false,
  had_changes boolean not null default false,
  summary text,
  highlights text,
  plan text,
  changes_note text,
  approved_by uuid references public.members (id) on delete set null,
  approved_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, month)
);
create index if not exists monthly_reports_client_idx on public.monthly_reports (client_id, month desc);
create index if not exists monthly_reports_owner_idx on public.monthly_reports (owner_id);
create index if not exists monthly_reports_due_idx on public.monthly_reports (due_on) where status <> 'sent';
drop trigger if exists monthly_reports_updated_at on public.monthly_reports;
create trigger monthly_reports_updated_at before update on public.monthly_reports
  for each row execute function public.set_updated_at();

create table if not exists public.qbrs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  quarter text not null check (quarter ~ '^[0-9]{4}-Q[1-4]$'),
  status text not null default 'draft' check (status in ('draft', 'ready', 'presented')),
  meeting_on date,
  deck_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, quarter)
);
create index if not exists qbrs_client_idx on public.qbrs (client_id);
drop trigger if exists qbrs_updated_at on public.qbrs;
create trigger qbrs_updated_at before update on public.qbrs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- delivery ratings
create table if not exists public.delivery_ratings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  department_id uuid not null references public.departments (id) on delete cascade,
  quality smallint not null check (quality between 1 and 5),
  on_time smallint not null check (on_time between 1 and 5),
  communication smallint not null check (communication between 1 and 5),
  rated_by uuid references public.members (id) on delete set null,
  rated_by_name text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, month, department_id)
);
create index if not exists delivery_ratings_client_idx on public.delivery_ratings (client_id, month desc);
create index if not exists delivery_ratings_department_idx on public.delivery_ratings (department_id);
drop trigger if exists delivery_ratings_updated_at on public.delivery_ratings;
create trigger delivery_ratings_updated_at before update on public.delivery_ratings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- RLS
alter table public.client_success_profiles enable row level security;
alter table public.commitments enable row level security;
alter table public.commitment_checkins enable row level security;
alter table public.relationship_people enable row level security;
alter table public.relationship_dates enable row level security;
alter table public.relationship_log enable row level security;
alter table public.meeting_briefs enable row level security;
alter table public.social_profiles enable row level security;
alter table public.client_opportunities enable row level security;
alter table public.privacy_removals enable row level security;
alter table public.monthly_reports enable row level security;
alter table public.qbrs enable row level security;
alter table public.delivery_ratings enable row level security;

-- Staff-only tables: read with clients.view, write with clients.manage (both scoped to the account team).
do $$
declare
  t text;
begin
  foreach t in array array[
    'client_success_profiles', 'commitments', 'commitment_checkins', 'relationship_people', 'relationship_dates',
    'relationship_log', 'meeting_briefs', 'social_profiles', 'client_opportunities', 'qbrs', 'delivery_ratings'
  ] loop
    execute format(
      'create policy %1$s_staff_select on public.%1$s for select to authenticated using (public.cs_staff_can(''clients.view'', client_id))', t);
    execute format(
      'create policy %1$s_staff_insert on public.%1$s for insert to authenticated with check (public.cs_staff_can(''clients.manage'', client_id))', t);
    execute format(
      'create policy %1$s_staff_update on public.%1$s for update to authenticated using (public.cs_staff_can(''clients.manage'', client_id)) with check (public.cs_staff_can(''clients.manage'', client_id))', t);
    execute format(
      'create policy %1$s_staff_delete on public.%1$s for delete to authenticated using (public.cs_staff_can(''clients.manage'', client_id))', t);
  end loop;
end;
$$;

-- Removals: a record of what happened. Staff with access can read; only the removal function inserts (as the user).
drop policy if exists privacy_removals_staff_select on public.privacy_removals;
create policy privacy_removals_staff_select on public.privacy_removals for select to authenticated
  using (public.cs_staff_can('clients.view', client_id));
drop policy if exists privacy_removals_staff_insert on public.privacy_removals;
create policy privacy_removals_staff_insert on public.privacy_removals for insert to authenticated
  with check (public.cs_staff_can('clients.manage', client_id) and removed_by = auth.uid());

-- Monthly reports: anyone who can manage the client edits drafts; approve/send needs clients.reports.approve.
drop policy if exists monthly_reports_staff_select on public.monthly_reports;
create policy monthly_reports_staff_select on public.monthly_reports for select to authenticated
  using (public.cs_staff_can('clients.view', client_id));
drop policy if exists monthly_reports_staff_insert on public.monthly_reports;
create policy monthly_reports_staff_insert on public.monthly_reports for insert to authenticated
  with check (public.cs_staff_can('clients.manage', client_id) and status in ('draft', 'submitted'));
drop policy if exists monthly_reports_staff_update on public.monthly_reports;
create policy monthly_reports_staff_update on public.monthly_reports for update to authenticated
  using (
    public.cs_staff_can('clients.reports.approve', client_id)
    or (public.cs_staff_can('clients.manage', client_id) and status in ('draft', 'submitted', 'changes'))
  )
  with check (
    public.cs_staff_can('clients.reports.approve', client_id)
    or (public.cs_staff_can('clients.manage', client_id) and status in ('draft', 'submitted', 'changes'))
  );
drop policy if exists monthly_reports_staff_delete on public.monthly_reports;
create policy monthly_reports_staff_delete on public.monthly_reports for delete to authenticated
  using (public.cs_staff_can('clients.manage', client_id) and status = 'draft');

-- Client logins: their own client only, and only shared items.
drop policy if exists commitments_client_select on public.commitments;
create policy commitments_client_select on public.commitments for select to authenticated
  using (client_id = public.my_client_id() and client_visible);
drop policy if exists monthly_reports_client_select on public.monthly_reports;
create policy monthly_reports_client_select on public.monthly_reports for select to authenticated
  using (client_id = public.my_client_id() and status = 'sent');
drop policy if exists qbrs_client_select on public.qbrs;
create policy qbrs_client_select on public.qbrs for select to authenticated
  using (client_id = public.my_client_id() and status = 'presented');
drop policy if exists delivery_ratings_client_select on public.delivery_ratings;
create policy delivery_ratings_client_select on public.delivery_ratings for select to authenticated
  using (client_id = public.my_client_id());
drop policy if exists delivery_ratings_client_insert on public.delivery_ratings;
create policy delivery_ratings_client_insert on public.delivery_ratings for insert to authenticated
  with check (client_id = public.my_client_id() and rated_by = auth.uid());
drop policy if exists delivery_ratings_client_update on public.delivery_ratings;
create policy delivery_ratings_client_update on public.delivery_ratings for update to authenticated
  using (client_id = public.my_client_id() and rated_by = auth.uid())
  with check (client_id = public.my_client_id() and rated_by = auth.uid());

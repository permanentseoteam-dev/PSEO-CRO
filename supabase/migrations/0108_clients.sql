-- 0108_clients: clients, their contacts, our team on each client, the client timeline (calls, chats,
-- meeting notes), commercial terms and escalations. Owned by the Clients module.
--
-- Health: clients.health_score / health_band / health_factors are written by the app
-- (lib/modules/clients/logic.ts healthScore(), "Recalculate" on the client page). A nightly job can
-- call the same logic later. Bands: healthy (75+), watch (50-74), at_risk (<50), new (first 30 days),
-- no_data (not active, or never scored).
--
-- Cross-module foreign keys added here (the referenced columns were created without them):
--   members.client_id -> clients (on delete cascade), tickets.client_id -> clients (on delete set null).
-- Not added on purpose: events.client_id (0104), channels.client_id (0105), invites.client_id (0102).
-- Their seeds insert the fixed client ids before this module's seed creates the clients, so an FK
-- here would make `supabase db reset` fail. Add them after seeding if wanted:
--   alter table public.events   add constraint events_client_fk   foreign key (client_id) references public.clients (id) on delete set null;
--   alter table public.channels add constraint channels_client_fk foreign key (client_id) references public.clients (id) on delete cascade;
--   alter table public.invites  add constraint invites_client_fk  foreign key (client_id) references public.clients (id) on delete cascade;

-- ---------------------------------------------------------------- clients
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  site text,
  services text[] not null default '{}'
    check (services <@ array['SEO', 'PPC', 'Social', 'Content', 'Web', 'Design']::text[]),
  country text,
  channel text not null default 'whatsapp' check (channel in ('whatsapp', 'email', 'slack', 'phone')),
  currency text not null default 'AED' check (currency in ('AED', 'USD', 'PKR')),
  status text not null default 'active'
    check (status in ('onboarding', 'active', 'paused', 'churned', 'terminated', 'internal')),
  start_date date,
  end_date date,
  end_reason text,
  owner_id uuid references public.members (id) on delete set null,   -- account executive
  manager_id uuid references public.members (id) on delete set null, -- delivery manager
  notes text,
  health_score integer check (health_score between 0 and 100),
  health_band text not null default 'no_data' check (health_band in ('healthy', 'watch', 'at_risk', 'new', 'no_data')),
  health_factors jsonb not null default '[]',
  health_at timestamptz,
  portal_logo_url text,
  portal_color text check (portal_color is null or portal_color ~ '^#[0-9a-fA-F]{6}$'),
  portal_welcome text,
  created_by uuid references public.members (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clients_ended_needs_reason check (
    status not in ('churned', 'terminated') or (end_date is not null and coalesce(end_reason, '') <> '')
  )
);
create index clients_owner_idx on public.clients (owner_id);
create index clients_manager_idx on public.clients (manager_id);
create index clients_status_idx on public.clients (status);
create trigger clients_updated_at before update on public.clients
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- client_contacts
create table public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  role text,
  email text,
  phone text,
  is_main boolean not null default false,
  gets_reports boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index client_contacts_client_idx on public.client_contacts (client_id);
create trigger client_contacts_updated_at before update on public.client_contacts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- client_team (our people on the client)
create table public.client_team (
  client_id uuid not null references public.clients (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  role text not null default 'delivery' check (role in ('delivery_lead', 'delivery', 'account_executive', 'backup')),
  created_at timestamptz not null default now(),
  primary key (client_id, member_id)
);
create index client_team_member_idx on public.client_team (member_id);

-- ---------------------------------------------------------------- client_timeline
-- Calls, chats, notes and meeting notes. Contact kinds (call, whatsapp, email, meeting) set "last contact".
create table public.client_timeline (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  kind text not null check (kind in ('call', 'whatsapp', 'email', 'meeting', 'note', 'meeting_notes', 'escalation')),
  happened_on date not null default current_date,
  with_name text,
  mood text check (mood in ('happy', 'neutral', 'unhappy')),
  body text not null check (char_length(body) between 1 and 4000),
  decisions text,
  concerns text,
  action_items text[] not null default '{}',
  created_by uuid references public.members (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index client_timeline_client_idx on public.client_timeline (client_id, happened_on desc);

-- ---------------------------------------------------------------- client_terms (one row per client)
create table public.client_terms (
  client_id uuid primary key references public.clients (id) on delete cascade,
  monthly_fee numeric(14,2) check (monthly_fee is null or monthly_fee >= 0),
  currency text not null default 'AED' check (currency in ('AED', 'USD', 'PKR')),
  term_months integer check (term_months is null or term_months > 0),
  term_start date,
  notice_days integer check (notice_days is null or notice_days >= 0),
  renewal_date date,
  hours_per_month integer check (hours_per_month is null or hours_per_month >= 0),
  in_scope text,
  out_of_scope text,
  agreement_name text,
  updated_at timestamptz not null default now()
);
create trigger client_terms_updated_at before update on public.client_terms
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- escalations
-- Severity sets the response window in working hours: critical 2, high 8, medium 24, low 72.
-- due_at is computed by the app (working hours, Asia/Dubai, Mon-Fri 09:00-18:00).
create table public.escalations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  details text,
  severity text not null check (severity in ('critical', 'high', 'medium', 'low')),
  owner_id uuid references public.members (id) on delete set null,
  ticket_id uuid references public.tickets (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'closed')),
  opened_at timestamptz not null default now(),
  due_at timestamptz not null,
  closed_at timestamptz,
  ask_rating boolean not null default true,
  client_rating integer check (client_rating between 1 and 5),
  created_by uuid references public.members (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint escalations_closed_at check ((status = 'closed') = (closed_at is not null))
);
create index escalations_client_idx on public.escalations (client_id, status);
create index escalations_owner_idx on public.escalations (owner_id);
create index escalations_ticket_idx on public.escalations (ticket_id) where ticket_id is not null;
create trigger escalations_updated_at before update on public.escalations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- cross-module FKs
alter table public.members add constraint members_client_fk
  foreign key (client_id) references public.clients (id) on delete cascade;
alter table public.tickets add constraint tickets_client_fk
  foreign key (client_id) references public.clients (id) on delete set null;

-- ---------------------------------------------------------------- helpers
-- security definer: policies on clients and its child tables call these without recursing.

-- Staff member who may see this client: clients.view 'all'; 'team' when the owner, manager or someone
-- on the client team is in my team; 'own' when I am the owner, manager or on the client team.
create or replace function public.staff_sees_client(cid uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_staff() and (
    public.has_perm('clients.view', 'all')
    or (public.has_perm('clients.view', 'own') and exists (
      select 1 from public.clients c
      where c.id = cid
        and (
          c.owner_id = auth.uid() or c.manager_id = auth.uid()
          or exists (select 1 from public.client_team t where t.client_id = c.id and t.member_id = auth.uid())
          or (public.has_perm('clients.view', 'team') and (
            public.in_my_team(c.owner_id) or public.in_my_team(c.manager_id)
            or exists (select 1 from public.client_team t where t.client_id = c.id and public.in_my_team(t.member_id))
          ))
        )
    ))
  );
$$;

-- Staff member who may edit this client (same scopes, on clients.manage).
create or replace function public.staff_manages_client(cid uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_staff() and (
    public.has_perm('clients.manage', 'all')
    or (public.has_perm('clients.manage', 'own') and exists (
      select 1 from public.clients c
      where c.id = cid
        and (
          c.owner_id = auth.uid() or c.manager_id = auth.uid()
          or (public.has_perm('clients.manage', 'team') and (public.in_my_team(c.owner_id) or public.in_my_team(c.manager_id)))
        )
    ))
  );
$$;

revoke execute on function public.staff_sees_client(uuid), public.staff_manages_client(uuid) from public, anon;
grant execute on function public.staff_sees_client(uuid), public.staff_manages_client(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------- RLS
alter table public.clients enable row level security;
alter table public.client_contacts enable row level security;
alter table public.client_team enable row level security;
alter table public.client_timeline enable row level security;
alter table public.client_terms enable row level security;
alter table public.escalations enable row level security;

-- clients: staff by scope; a client login sees only its own client.
create policy clients_select on public.clients for select to authenticated
  using (public.staff_sees_client(id) or id = public.my_client_id());
create policy clients_insert on public.clients for insert to authenticated
  with check (public.is_staff() and public.has_perm('clients.manage', 'own'));
create policy clients_update on public.clients for update to authenticated
  using (public.staff_manages_client(id)) with check (public.is_staff() and public.has_perm('clients.manage', 'own'));
create policy clients_delete on public.clients for delete to authenticated
  using (public.is_staff() and public.has_perm('clients.manage', 'all'));

-- contacts: staff who see the client, and the client's own logins; edits by client managers.
create policy client_contacts_select on public.client_contacts for select to authenticated
  using (public.staff_sees_client(client_id) or client_id = public.my_client_id());
create policy client_contacts_write on public.client_contacts for all to authenticated
  using (public.staff_manages_client(client_id)) with check (public.staff_manages_client(client_id));

-- team: same visibility (clients see who works on their account); edits by client managers.
create policy client_team_select on public.client_team for select to authenticated
  using (public.staff_sees_client(client_id) or client_id = public.my_client_id());
create policy client_team_write on public.client_team for all to authenticated
  using (public.staff_manages_client(client_id)) with check (public.staff_manages_client(client_id));

-- timeline: internal, staff only. Anyone on the account can log; the author or a manager edits.
create policy client_timeline_select on public.client_timeline for select to authenticated
  using (public.staff_sees_client(client_id));
create policy client_timeline_insert on public.client_timeline for insert to authenticated
  with check (public.staff_sees_client(client_id) and created_by = auth.uid());
create policy client_timeline_update on public.client_timeline for update to authenticated
  using (public.staff_sees_client(client_id) and (created_by = auth.uid() or public.staff_manages_client(client_id)))
  with check (public.staff_sees_client(client_id));
create policy client_timeline_delete on public.client_timeline for delete to authenticated
  using (public.staff_sees_client(client_id) and (created_by = auth.uid() or public.staff_manages_client(client_id)));

-- terms: billing data. Staff with clients.billing.view who see the client; client owners for their own.
create policy client_terms_select on public.client_terms for select to authenticated using (
  (public.has_perm('clients.billing.view', 'own') and public.staff_sees_client(client_id))
  or (client_id = public.my_client_id() and public.has_perm('clients.billing.view', 'own'))
);
create policy client_terms_write on public.client_terms for all to authenticated
  using (public.staff_manages_client(client_id) or (public.is_staff() and public.has_perm('clients.billing.edit', 'all')))
  with check (public.staff_manages_client(client_id) or (public.is_staff() and public.has_perm('clients.billing.edit', 'all')));

-- escalations: anyone on the account raises and closes; client logins can read their own.
create policy escalations_select on public.escalations for select to authenticated
  using (public.staff_sees_client(client_id) or client_id = public.my_client_id());
create policy escalations_insert on public.escalations for insert to authenticated
  with check (public.staff_sees_client(client_id) and created_by = auth.uid());
create policy escalations_update on public.escalations for update to authenticated
  using (public.staff_sees_client(client_id)) with check (public.staff_sees_client(client_id));
create policy escalations_delete on public.escalations for delete to authenticated
  using (public.staff_manages_client(client_id));

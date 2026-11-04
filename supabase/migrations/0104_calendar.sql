-- 0104_calendar: meetings (events) and who is invited (event_attendees, with RSVP).
-- Times are timestamptz; the app shows them in Asia/Dubai (UTC+4, no DST).
-- Recurring meetings are stored as one row per occurrence sharing a series_id.
-- events.client_id has no FK here because clients (0108) comes later; the clients module may add
--   alter table public.events add constraint events_client_fk foreign key (client_id) references public.clients (id) on delete set null;

-- ---------------------------------------------------------------- events
create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 200),
  kind text not null default 'internal' check (kind in ('internal', 'client_meeting')),
  client_id uuid,
  starts_at timestamptz not null,
  minutes int not null check (minutes between 5 and 600),
  meet_link text,
  location text,
  agenda text,
  guests text[] not null default '{}', -- outside emails (client contacts)
  repeat text not null default 'none' check (repeat in ('none', 'daily', 'weekly', 'biweekly', 'monthly')),
  series_id uuid,
  visibility text not null default 'team' check (visibility in ('team', 'private', 'client')),
  send_invites boolean not null default true,
  created_by uuid not null references public.members (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_client_kind check (kind = 'internal' or client_id is not null),
  constraint events_client_vis check (visibility <> 'client' or client_id is not null)
);
create index events_starts_idx on public.events (starts_at);
create index events_client_idx on public.events (client_id) where client_id is not null;
create index events_series_idx on public.events (series_id) where series_id is not null;
create index events_created_by_idx on public.events (created_by);
create trigger events_updated_at before update on public.events
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- event_attendees
create table public.event_attendees (
  event_id uuid not null references public.events (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  rsvp text not null default 'pending' check (rsvp in ('yes', 'maybe', 'no', 'pending')),
  created_at timestamptz not null default now(),
  primary key (event_id, member_id)
);
create index event_attendees_member_idx on public.event_attendees (member_id);

-- ---------------------------------------------------------------- helpers
-- security definer so events and event_attendees policies can refer to each other without recursion.

-- I organised the event.
create or replace function public.is_event_organizer(eid uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.events where id = eid and created_by = auth.uid());
$$;

-- I may read the event's details: organiser, attendee, staff on a non-private event,
-- calendar admins ('all'), or a client login on a client-visible meeting of their own client.
create or replace function public.can_see_event(eid uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.events e
    where e.id = eid
      and (
        (public.is_staff() and public.has_perm('calendar.use', 'own') and (
          e.created_by = auth.uid()
          or e.visibility <> 'private'
          or public.has_perm('calendar.use', 'all')
          or exists (select 1 from public.event_attendees a where a.event_id = e.id and a.member_id = auth.uid())
        ))
        or (e.visibility = 'client' and e.client_id = public.my_client_id())
      )
  );
$$;

-- Busy blocks for staff between two times: who, when, how long. No titles, so private meetings stay private.
create or replace function public.calendar_busy(range_from timestamptz, range_to timestamptz)
returns table (member_id uuid, starts_at timestamptz, minutes int)
language sql stable security definer
set search_path = ''
as $$
  select a.member_id, e.starts_at, e.minutes
  from public.events e
  join public.event_attendees a on a.event_id = e.id
  where public.is_staff()
    and public.has_perm('calendar.use', 'own')
    and a.rsvp <> 'no'
    and e.starts_at < range_to
    and e.starts_at + make_interval(mins => e.minutes) > range_from
  order by e.starts_at;
$$;

revoke execute on function public.is_event_organizer(uuid), public.can_see_event(uuid),
  public.calendar_busy(timestamptz, timestamptz) from public, anon;
grant execute on function public.is_event_organizer(uuid), public.can_see_event(uuid),
  public.calendar_busy(timestamptz, timestamptz) to authenticated, service_role;

-- ---------------------------------------------------------------- RLS
alter table public.events enable row level security;
alter table public.event_attendees enable row level security;

create policy events_select on public.events for select to authenticated
  using (public.can_see_event(id));
create policy events_insert on public.events for insert to authenticated with check (
  public.is_staff() and public.has_perm('calendar.use', 'own') and created_by = auth.uid()
);
create policy events_update on public.events for update to authenticated
  using (public.is_staff() and (created_by = auth.uid() or public.has_perm('calendar.use', 'all')))
  with check (public.is_staff() and (created_by = auth.uid() or public.has_perm('calendar.use', 'all')));
create policy events_delete on public.events for delete to authenticated
  using (public.is_staff() and (created_by = auth.uid() or public.has_perm('calendar.use', 'all')));

create policy event_attendees_select on public.event_attendees for select to authenticated
  using (public.can_see_event(event_id));
-- Organiser (or calendar admin) adds anyone; any staff member who can see the event may add themselves (RSVP).
create policy event_attendees_insert on public.event_attendees for insert to authenticated with check (
  public.is_staff() and public.can_see_event(event_id) and (
    public.is_event_organizer(event_id) or public.has_perm('calendar.use', 'all') or member_id = auth.uid()
  )
);
create policy event_attendees_update on public.event_attendees for update to authenticated
  using (public.is_staff() and (member_id = auth.uid() or public.is_event_organizer(event_id) or public.has_perm('calendar.use', 'all')))
  with check (public.is_staff() and public.can_see_event(event_id) and (
    member_id = auth.uid() or public.is_event_organizer(event_id) or public.has_perm('calendar.use', 'all')
  ));
create policy event_attendees_delete on public.event_attendees for delete to authenticated
  using (public.is_staff() and (public.is_event_organizer(event_id) or public.has_perm('calendar.use', 'all')));

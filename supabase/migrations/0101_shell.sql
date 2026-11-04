-- 0101_shell: notifications (bell), pins (sidebar Pinned), user_settings (theme, density, sidebar state, email, quiet hours).
-- Everything here is personal: each row belongs to one member and only that member reads or writes it.

-- ---------------------------------------------------------------- notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade, -- who receives it
  actor_id uuid references public.members (id) on delete set null,          -- who caused it (null = system)
  kind text not null default 'system'
    check (kind in ('ticket', 'mention', 'review', 'invoice', 'client', 'meeting', 'chat', 'system')),
  action text not null,   -- "moved", "mentioned you on"
  subject text,           -- shown bold: "CPD-142"
  detail text,            -- "to In review"
  href text check (href is null or href like '/%'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_member_idx on public.notifications (member_id, created_at desc);
create index notifications_unread_idx on public.notifications (member_id) where read_at is null;
create index notifications_actor_idx on public.notifications (actor_id);

alter table public.notifications enable row level security;

create policy notifications_select on public.notifications for select to authenticated
  using (member_id = auth.uid());
-- Any active member may notify someone, always as themselves. Client logins may only notify staff.
create policy notifications_insert on public.notifications for insert to authenticated with check (
  actor_id = auth.uid()
  and (
    public.is_staff()
    or (
      public.my_client_id() is not null
      and exists (select 1 from public.members m where m.id = member_id and m.kind = 'staff')
    )
  )
);
create policy notifications_update on public.notifications for update to authenticated
  using (member_id = auth.uid()) with check (member_id = auth.uid());
create policy notifications_delete on public.notifications for delete to authenticated
  using (member_id = auth.uid());

alter publication supabase_realtime add table public.notifications;

-- ---------------------------------------------------------------- pins
create table public.pins (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  href text not null check (href like '/%'),
  title text not null,
  position int not null default 0,
  created_at timestamptz not null default now(),
  unique (member_id, href)
);
create index pins_member_idx on public.pins (member_id, position);

-- Up to 12 pinned pages per person.
create or replace function public.pins_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.pins where member_id = new.member_id) >= 12 then
    raise exception 'You can pin up to 12 pages' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger pins_limit before insert on public.pins
  for each row execute function public.pins_limit();

alter table public.pins enable row level security;

create policy pins_own on public.pins for all to authenticated
  using (member_id = auth.uid()) with check (member_id = auth.uid());

-- ---------------------------------------------------------------- user_settings
create table public.user_settings (
  member_id uuid primary key references public.members (id) on delete cascade,
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  density text not null default 'comfortable' check (density in ('comfortable', 'compact')),
  sidebar_collapsed boolean not null default false,
  folded_groups text[] not null default '{}',
  email_digest text not null default 'daily' check (email_digest in ('daily', 'urgent', 'off')),
  quiet_from time,
  quiet_to time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger user_settings_updated_at before update on public.user_settings
  for each row execute function public.set_updated_at();

alter table public.user_settings enable row level security;

create policy user_settings_own on public.user_settings for all to authenticated
  using (member_id = auth.uid()) with check (member_id = auth.uid());

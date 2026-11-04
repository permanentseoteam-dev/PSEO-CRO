-- 0001_core: people, departments, roles and permissions. Every later migration builds on this.
-- Scope order: none < own < team < all (enum order, so >= comparisons work).

create type public.scope_level as enum ('none', 'own', 'team', 'all');

-- Shared trigger: keep updated_at current. Modules reuse it.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------- tables

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  head_id uuid, -- fk added below, after members exists
  created_at timestamptz not null default now()
);

create table public.members (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  name text not null,
  title text,
  department_id uuid references public.departments (id) on delete set null,
  manager_id uuid references public.members (id) on delete set null,
  status text not null default 'active' check (status in ('active', 'invited', 'suspended', 'left')),
  presence text not null default 'available' check (presence in ('available', 'meeting', 'focus', 'away', 'sick', 'offline')),
  kind text not null default 'staff' check (kind in ('staff', 'client')),
  client_id uuid, -- fk to clients(id) is added by 0108_clients.sql
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint members_kind_client check (
    (kind = 'staff' and client_id is null) or (kind = 'client' and client_id is not null)
  ),
  constraint members_not_own_manager check (manager_id is null or manager_id <> id)
);
create index members_department_idx on public.members (department_id);
create index members_manager_idx on public.members (manager_id);
create index members_client_idx on public.members (client_id) where client_id is not null;
create trigger members_updated_at before update on public.members
  for each row execute function public.set_updated_at();

alter table public.departments
  add constraint departments_head_fk foreign key (head_id) references public.members (id) on delete set null;

create table public.roles (
  key text primary key,
  name text not null,
  kind text not null check (kind in ('staff', 'client')),
  description text
);

-- Catalogue of permission keys (drives the roles matrix in admin).
create table public.permissions (
  key text primary key,
  area text not null,
  label text not null
);

create table public.role_permissions (
  role text not null references public.roles (key) on update cascade on delete cascade,
  perm_key text not null references public.permissions (key) on update cascade on delete cascade,
  scope public.scope_level not null,
  primary key (role, perm_key)
);

create table public.member_roles (
  member_id uuid not null references public.members (id) on delete cascade,
  role text not null references public.roles (key) on update cascade on delete cascade,
  primary key (member_id, role)
);
create index member_roles_role_idx on public.member_roles (role);

-- Per-person exception. Replaces whatever the roles give (can raise or lower).
create table public.member_overrides (
  member_id uuid not null references public.members (id) on delete cascade,
  perm_key text not null references public.permissions (key) on update cascade on delete cascade,
  scope public.scope_level not null,
  note text,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (member_id, perm_key)
);

-- ---------------------------------------------------------------- helpers
-- security definer so RLS policies can call them without recursing into members' own policies.

create or replace function public.is_super_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.member_roles mr
    join public.members m on m.id = mr.member_id
    where mr.member_id = auth.uid() and mr.role = 'super_admin' and m.status = 'active'
  );
$$;

-- Effective scope of the signed-in user for one permission.
create or replace function public.perm_scope(perm text)
returns public.scope_level
language sql stable security definer
set search_path = ''
as $$
  select case
    when not exists (select 1 from public.members where id = auth.uid() and status = 'active')
      then 'none'::public.scope_level
    when public.is_super_admin() then 'all'::public.scope_level
    else coalesce(
      (select o.scope from public.member_overrides o where o.member_id = auth.uid() and o.perm_key = perm),
      (select max(rp.scope)
         from public.member_roles mr
         join public.role_permissions rp on rp.role = mr.role
        where mr.member_id = auth.uid() and rp.perm_key = perm),
      'none'::public.scope_level
    )
  end;
$$;

-- has_perm('finance.invoices.view', 'all'): true when the user's scope is at least min_scope.
create or replace function public.has_perm(perm text, min_scope text default 'own')
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.perm_scope(perm) >= min_scope::public.scope_level
     and public.perm_scope(perm) <> 'none';
$$;

-- Active staff member (not a client login).
create or replace function public.is_staff()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.members where id = auth.uid() and kind = 'staff' and status = 'active');
$$;

-- The client a client login belongs to (null for staff).
create or replace function public.my_client_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select client_id from public.members where id = auth.uid() and kind = 'client' and status = 'active';
$$;

-- For 'team' scope: target is me, reports to me, or is in a department I head or belong to.
create or replace function public.in_my_team(target uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select target = auth.uid() or exists (
    select 1
    from public.members t
    join public.members me on me.id = auth.uid()
    where t.id = target
      and (
        t.manager_id = me.id
        or (t.department_id is not null and t.department_id = me.department_id)
        or exists (select 1 from public.departments d where d.id = t.department_id and d.head_id = me.id)
      )
  );
$$;

revoke execute on function public.is_super_admin(), public.perm_scope(text), public.has_perm(text, text),
  public.is_staff(), public.my_client_id(), public.in_my_team(uuid) from public, anon;
grant execute on function public.is_super_admin(), public.perm_scope(text), public.has_perm(text, text),
  public.is_staff(), public.my_client_id(), public.in_my_team(uuid) to authenticated, service_role;

-- Non-admins may update their own row, but only harmless columns (presence, name).
create or replace function public.members_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null or public.has_perm('admin.access.manage', 'all') then
    return new;
  end if;
  if new.email is distinct from old.email
    or new.title is distinct from old.title
    or new.department_id is distinct from old.department_id
    or new.manager_id is distinct from old.manager_id
    or new.status is distinct from old.status
    or new.kind is distinct from old.kind
    or new.client_id is distinct from old.client_id then
    raise exception 'Only an admin can change these fields' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger members_guard before update on public.members
  for each row execute function public.members_guard();

-- ---------------------------------------------------------------- RLS

alter table public.departments enable row level security;
alter table public.members enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.member_roles enable row level security;
alter table public.member_overrides enable row level security;

-- departments: staff read; admins write.
create policy departments_select on public.departments for select to authenticated using (public.is_staff());
create policy departments_admin on public.departments for all to authenticated
  using (public.has_perm('admin.access.manage', 'all'))
  with check (public.has_perm('admin.access.manage', 'all'));

-- members: staff see everyone; clients see staff plus people from their own client.
create policy members_select on public.members for select to authenticated using (
  public.is_staff()
  or kind = 'staff'
  or (client_id is not null and client_id = public.my_client_id())
);
create policy members_update_self on public.members for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy members_admin on public.members for all to authenticated
  using (public.has_perm('admin.access.manage', 'all'))
  with check (public.has_perm('admin.access.manage', 'all'));

-- roles, permission catalogue, role grants: any signed-in user reads; admins write.
create policy roles_select on public.roles for select to authenticated using (true);
create policy roles_admin on public.roles for all to authenticated
  using (public.has_perm('admin.access.manage', 'all'))
  with check (public.has_perm('admin.access.manage', 'all'));

create policy permissions_select on public.permissions for select to authenticated using (true);
create policy permissions_admin on public.permissions for all to authenticated
  using (public.is_super_admin()) with check (public.is_super_admin());

create policy role_permissions_select on public.role_permissions for select to authenticated using (true);
create policy role_permissions_admin on public.role_permissions for all to authenticated
  using (public.has_perm('admin.access.manage', 'all') and (role <> 'super_admin' or public.is_super_admin()))
  with check (public.has_perm('admin.access.manage', 'all') and (role <> 'super_admin' or public.is_super_admin()));

-- member_roles: you see your own; staff see all (directory); only admins assign,
-- and only a super admin can hand out super_admin.
create policy member_roles_select on public.member_roles for select to authenticated
  using (member_id = auth.uid() or public.is_staff());
create policy member_roles_admin on public.member_roles for all to authenticated
  using (public.has_perm('admin.access.manage', 'all') and (role <> 'super_admin' or public.is_super_admin()))
  with check (public.has_perm('admin.access.manage', 'all') and (role <> 'super_admin' or public.is_super_admin()));

-- member_overrides: you see your own; admins see and write all.
create policy member_overrides_select on public.member_overrides for select to authenticated
  using (member_id = auth.uid() or public.has_perm('admin.access.manage', 'all'));
create policy member_overrides_admin on public.member_overrides for all to authenticated
  using (public.has_perm('admin.access.manage', 'all'))
  with check (public.has_perm('admin.access.manage', 'all'));

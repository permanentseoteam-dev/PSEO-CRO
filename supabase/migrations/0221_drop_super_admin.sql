-- Remove the super_admin role. admin takes over what it had: every permission at 'all',
-- and only an admin can grant admin, invite an admin or change admin's role rows.
-- Data: only the super_admin row in public.roles is deleted (its member_roles / role_permissions rows cascade).

begin;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.member_roles mr
    join public.members m on m.id = mr.member_id
    where mr.member_id = auth.uid() and mr.role = 'admin' and m.status = 'active'
  );
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

create or replace function public.perm_scope(perm text)
returns public.scope_level
language sql stable security definer
set search_path = ''
as $$
  select case
    when not exists (select 1 from public.members where id = auth.uid() and status = 'active')
      then 'none'::public.scope_level
    when public.is_admin() then 'all'::public.scope_level
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

create or replace function public.job_perm_holders(perm text, min_scope text default 'own')
returns setof uuid
language sql stable security definer
set search_path = ''
as $$
  select m.id
  from public.members m
  where m.kind = 'staff' and m.status = 'active'
    and (
      exists (select 1 from public.member_roles mr where mr.member_id = m.id and mr.role = 'admin')
      or coalesce(
        (select o.scope from public.member_overrides o where o.member_id = m.id and o.perm_key = perm),
        (select max(rp.scope) from public.member_roles mr join public.role_permissions rp on rp.role = mr.role
          where mr.member_id = m.id and rp.perm_key = perm),
        'none'::public.scope_level
      ) >= greatest(min_scope::public.scope_level, 'own'::public.scope_level)
    );
$$;

drop policy permissions_admin on public.permissions;
create policy permissions_admin on public.permissions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy role_permissions_admin on public.role_permissions;
create policy role_permissions_admin on public.role_permissions for all to authenticated
  using (public.has_perm('admin.access.manage', 'all') and (role <> 'admin' or public.is_admin()))
  with check (public.has_perm('admin.access.manage', 'all') and (role <> 'admin' or public.is_admin()));

drop policy member_roles_admin on public.member_roles;
create policy member_roles_admin on public.member_roles for all to authenticated
  using (public.has_perm('admin.access.manage', 'all') and (role <> 'admin' or public.is_admin()))
  with check (public.has_perm('admin.access.manage', 'all') and (role <> 'admin' or public.is_admin()));

drop policy invites_admin on public.invites;
create policy invites_admin on public.invites for all to authenticated
  using (public.has_perm('admin.access.manage', 'all'))
  with check (public.has_perm('admin.access.manage', 'all') and (role <> 'admin' or public.is_admin()));

drop function public.is_super_admin();

-- Safety: every super_admin holder must already be an admin, or nobody would keep full access.
do $$
begin
  if exists (
    select 1 from public.member_roles s
    where s.role = 'super_admin'
      and not exists (select 1 from public.member_roles a where a.member_id = s.member_id and a.role = 'admin')
  ) then
    raise exception 'A super_admin holder is not an admin; grant admin first';
  end if;
end $$;

delete from public.roles where key = 'super_admin';

commit;

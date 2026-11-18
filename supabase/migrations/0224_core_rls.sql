-- Core RLS: stop client logins reading the org's permission structure, and stop them writing audit lines.
begin;

-- Roles and the permission catalogue: staff only. perm_scope()/has_perm()/is_admin() are SECURITY DEFINER,
-- so RLS checks for client logins keep working without these rows.
drop policy if exists roles_select on public.roles;
create policy roles_select on public.roles for select to authenticated
  using (public.is_staff());

drop policy if exists permissions_select on public.permissions;
create policy permissions_select on public.permissions for select to authenticated
  using (public.is_staff());

-- Grants: staff see all; a client login sees only the grants of roles it holds (getMe() builds its perms from them).
drop policy if exists role_permissions_select on public.role_permissions;
create policy role_permissions_select on public.role_permissions for select to authenticated
  using (public.is_staff() or role in (select mr.role from public.member_roles mr where mr.member_id = auth.uid()));

-- Audit log: app writes go through logAudit() with the service role. Keep a staff-only insert path for
-- features/platform-p2 (API key audit) until it moves to logAudit(); then drop this policy.
drop policy if exists audit_log_insert on public.audit_log;
create policy audit_log_insert on public.audit_log for insert to authenticated
  with check (actor_id = auth.uid() and public.is_staff());

commit;

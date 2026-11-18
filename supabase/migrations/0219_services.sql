-- 0219_services: the agency's list of services, managed by admins in Settings -> Admin -> Services.
--   services: id, name (2-40 chars, unique ignoring case), sort (list order), created_at.
--     Seeded with the six services that were hardcoded in the app, in the templates order.
--   Rows that use a service keep storing its name as text (templates.service, clients.services,
--     qa_checklists.services). rename_service() renames the service and those stored names in one go.
--     Deleting a service leaves those rows untouched.
--   clients_services_check (0108) pinned clients.services to the six old names; it is dropped so
--     admins can add and rename services. No data changes.
-- Access: all staff read; only admin.access.manage 'all' writes (same policies as departments).
-- Depends on 0001_core (has_perm, is_staff), 0108_clients, templates, qa_checklists.

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 40),
  sort integer,
  created_at timestamptz not null default now()
);
create unique index if not exists services_name_lower_key on public.services (lower(name));

alter table public.services enable row level security;
drop policy if exists services_select on public.services;
create policy services_select on public.services for select to authenticated using (public.is_staff());
drop policy if exists services_admin on public.services;
create policy services_admin on public.services for all to authenticated
  using (public.has_perm('admin.access.manage', 'all'))
  with check (public.has_perm('admin.access.manage', 'all'));

insert into public.services (name, sort) values
  ('SEO', 1), ('Content', 2), ('PPC', 3), ('Web', 4), ('Social', 5), ('Design', 6)
on conflict do nothing;

alter table public.clients drop constraint if exists clients_services_check;

-- Rename a service and every stored copy of its old name, in one transaction.
-- Security definer so the rename reaches every template, client and checklist, not just the ones the
-- admin's RLS shows. A duplicate name fails with 23505 from the unique index.
create or replace function public.rename_service(p_id uuid, p_name text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_old text;
  v_new text := btrim(p_name);
begin
  if not public.has_perm('admin.access.manage', 'all') then
    raise exception 'You don''t have access to do that.' using errcode = '42501';
  end if;
  select name into v_old from public.services where id = p_id for update;
  if v_old is null then
    raise exception 'That service no longer exists.' using errcode = 'P0002';
  end if;
  update public.services set name = v_new where id = p_id;
  if v_old is distinct from v_new then
    update public.templates set service = v_new where service = v_old;
    update public.clients set services = array_replace(services, v_old, v_new) where v_old = any (services);
    update public.qa_checklists set services = array_replace(services, v_old, v_new) where v_old = any (services);
  end if;
end;
$$;
revoke execute on function public.rename_service(uuid, text) from public;
grant execute on function public.rename_service(uuid, text) to authenticated, service_role;

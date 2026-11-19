-- A project can belong to several departments. projects.department_id stays as the first chosen
-- one, so existing RLS (0001_core) and queries keep working.
create table if not exists public.project_departments (
  project_id uuid not null references public.projects (id) on delete cascade,
  department_id uuid not null references public.departments (id) on delete cascade,
  primary key (project_id, department_id)
);
create index if not exists project_departments_department_idx on public.project_departments (department_id);

alter table public.project_departments enable row level security;

-- Read: anyone who can see the project (projects RLS applies inside the subquery).
drop policy if exists project_departments_select on public.project_departments;
create policy project_departments_select on public.project_departments for select to authenticated using (
  exists (select 1 from public.projects p where p.id = project_id)
);

-- Write: same rule as projects_insert/update/delete.
drop policy if exists project_departments_insert on public.project_departments;
create policy project_departments_insert on public.project_departments for insert to authenticated with check (
  public.is_staff() and exists (
    select 1 from public.projects p where p.id = project_id and (
      public.has_perm('work.projects.manage', 'all')
      or (public.has_perm('work.projects.manage', 'team') and public.in_my_team(p.lead_id))
    )
  )
);
drop policy if exists project_departments_delete on public.project_departments;
create policy project_departments_delete on public.project_departments for delete to authenticated using (
  public.is_staff() and exists (
    select 1 from public.projects p where p.id = project_id and (
      public.has_perm('work.projects.manage', 'all')
      or (public.has_perm('work.projects.manage', 'team') and public.in_my_team(p.lead_id))
    )
  )
);

insert into public.project_departments (project_id, department_id)
select id, department_id from public.projects where department_id is not null
on conflict do nothing;

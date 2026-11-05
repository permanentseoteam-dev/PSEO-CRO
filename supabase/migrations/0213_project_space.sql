-- 0213_project_space: project folders, per-project notes, workspace task settings (status labels,
-- task types, event types) with an optional per-project override, and a task type on tickets.
-- Additive only; safe to re-run.
--
-- Permissions: folders and project deletes follow work.projects.manage (as projects in 0107);
-- the workspace config is edited by admins (admin.access.manage 'all').

-- ---------------------------------------------------------------- folders

create table if not exists public.project_folders (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  position integer not null default 0,
  created_by uuid references public.members (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists project_folders_updated_at on public.project_folders;
create trigger project_folders_updated_at before update on public.project_folders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- projects: folder, order, config

alter table public.projects add column if not exists folder_id uuid references public.project_folders (id) on delete set null;
alter table public.projects add column if not exists position integer not null default 0;
alter table public.projects add column if not exists config_mode text not null default 'inherit';
alter table public.projects add column if not exists config jsonb not null default '{}';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'projects_config_mode_check') then
    alter table public.projects add constraint projects_config_mode_check check (config_mode in ('inherit', 'custom'));
  end if;
end;
$$;
create index if not exists projects_folder_idx on public.projects (folder_id);

-- ---------------------------------------------------------------- workspace config (one row)

create table if not exists public.work_config (
  id boolean primary key default true check (id),
  config jsonb not null,
  updated_at timestamptz not null default now()
);
drop trigger if exists work_config_updated_at on public.work_config;
create trigger work_config_updated_at before update on public.work_config
  for each row execute function public.set_updated_at();

insert into public.work_config (id, config) values (true, jsonb_build_object(
  'statuses', jsonb_build_object(
    'todo', jsonb_build_object('label', 'New task', 'emoji', '✉️'),
    'in_progress', jsonb_build_object('label', 'In progress', 'emoji', '🛠️'),
    'in_review', jsonb_build_object('label', 'In review', 'emoji', '👀'),
    'blocked', jsonb_build_object('label', 'Blocked', 'emoji', '⛔'),
    'done', jsonb_build_object('label', 'Completed', 'emoji', '✅')
  ),
  'taskTypes', jsonb_build_array(
    jsonb_build_object('id', 'operational', 'name', 'Operational', 'color', '#cfe3ff'),
    jsonb_build_object('id', 'strategic', 'name', 'Strategic', 'color', '#e3d7ff'),
    jsonb_build_object('id', 'technical', 'name', 'Technical', 'color', '#d4f0e7'),
    jsonb_build_object('id', 'planning', 'name', 'Planning', 'color', '#fff1c7'),
    jsonb_build_object('id', 'content', 'name', 'Content', 'color', '#ffd9e1'),
    jsonb_build_object('id', 'seo', 'name', 'SEO', 'color', '#d8f3c9'),
    jsonb_build_object('id', 'design', 'name', 'Design', 'color', '#ffe0cc'),
    jsonb_build_object('id', 'learning', 'name', 'Learning', 'color', '#d6eef7')
  ),
  'eventTypes', jsonb_build_array(
    jsonb_build_object('id', 'meeting', 'name', 'Meeting', 'color', '#cfe3ff'),
    jsonb_build_object('id', 'phone_call', 'name', 'Phone call', 'color', '#d4f0e7')
  )
))
on conflict (id) do nothing;

-- ---------------------------------------------------------------- tickets: task type

alter table public.tickets add column if not exists type_id text;

-- ---------------------------------------------------------------- notes

create table if not exists public.project_notes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  body text not null default '',
  author_id uuid references public.members (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists project_notes_project_idx on public.project_notes (project_id);
drop trigger if exists project_notes_updated_at on public.project_notes;
create trigger project_notes_updated_at before update on public.project_notes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- RLS

alter table public.project_folders enable row level security;
alter table public.work_config enable row level security;
alter table public.project_notes enable row level security;

-- Folders have no lead, so any project manager ('team' scope or more) manages them.
drop policy if exists project_folders_select on public.project_folders;
create policy project_folders_select on public.project_folders for select to authenticated using (public.is_staff());
drop policy if exists project_folders_write on public.project_folders;
create policy project_folders_write on public.project_folders for all to authenticated
  using (public.is_staff() and public.has_perm('work.projects.manage', 'team'))
  with check (public.is_staff() and public.has_perm('work.projects.manage', 'team'));

-- Projects can now be deleted by the same people who can edit them (tickets keep, project_id set null).
drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects for delete to authenticated using (
  public.is_staff() and (
    public.has_perm('work.projects.manage', 'all')
    or (public.has_perm('work.projects.manage', 'team') and public.in_my_team(lead_id))
  )
);

drop policy if exists work_config_select on public.work_config;
create policy work_config_select on public.work_config for select to authenticated using (public.is_staff());
drop policy if exists work_config_update on public.work_config;
create policy work_config_update on public.work_config for update to authenticated
  using (public.has_perm('admin.access.manage', 'all'))
  with check (public.has_perm('admin.access.manage', 'all'));

drop policy if exists project_notes_select on public.project_notes;
create policy project_notes_select on public.project_notes for select to authenticated using (public.is_staff());
drop policy if exists project_notes_insert on public.project_notes;
create policy project_notes_insert on public.project_notes for insert to authenticated
  with check (public.is_staff() and author_id = auth.uid());
drop policy if exists project_notes_update on public.project_notes;
create policy project_notes_update on public.project_notes for update to authenticated
  using (
    public.is_staff() and (
      author_id = auth.uid()
      or public.has_perm('work.projects.manage', 'all')
      or exists (select 1 from public.projects p where p.id = project_id
                 and public.has_perm('work.projects.manage', 'team') and public.in_my_team(p.lead_id))
    )
  )
  with check (public.is_staff());
drop policy if exists project_notes_delete on public.project_notes;
create policy project_notes_delete on public.project_notes for delete to authenticated using (
  public.is_staff() and (
    author_id = auth.uid()
    or public.has_perm('work.projects.manage', 'all')
    or exists (select 1 from public.projects p where p.id = project_id
               and public.has_perm('work.projects.manage', 'team') and public.in_my_team(p.lead_id))
  )
);

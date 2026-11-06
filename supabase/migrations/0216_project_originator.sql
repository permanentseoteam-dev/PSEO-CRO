-- Record the true creator of future projects. Existing projects deliberately remain unknown.
-- Add the column without a default first: a migration actor must never become historical creator.
-- Historical backfill requires independently verified provenance and a trusted migration; app edits cannot invent it.
alter table public.projects add column if not exists created_by uuid references public.members (id) on delete set null;

create or replace function public.set_project_originator()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if TG_OP = 'INSERT' then
    new.created_by := auth.uid();
  elsif new.created_by is distinct from old.created_by then
    -- Only the foreign key's ON DELETE SET NULL may clear an existing originator.
    -- SECURITY DEFINER makes this existence check independent of member RLS visibility.
    if new.created_by is not null or exists (select 1 from public.members where id = old.created_by) then
      raise exception 'The project originator cannot be changed';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists projects_originator on public.projects;
create trigger projects_originator before insert or update of created_by on public.projects
  for each row execute function public.set_project_originator();

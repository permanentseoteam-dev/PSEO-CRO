-- One-time backfill approved by the owner on 2026-11-06: projects with no recorded creator get
-- Sara Malik (admin) so new tasks default to an assignee. Only empty rows change; the originator
-- trigger from 0216 is paused for this statement alone and switched back on straight after.
alter table public.projects disable trigger projects_originator;
update public.projects
   set created_by = '00000000-0000-4000-8000-000000000001'
 where created_by is null
   and exists (select 1 from public.members where id = '00000000-0000-4000-8000-000000000001');
alter table public.projects enable trigger projects_originator;

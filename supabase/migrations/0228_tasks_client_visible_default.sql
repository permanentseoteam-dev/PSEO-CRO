-- New tasks show in the client's portal by default (only tasks whose client_id matches the client
-- can appear there, see tickets RLS in 0106). The per-task "Show in client portal" switch can still hide one.
alter table public.tickets alter column client_visible set default true;

-- User asked to show SITES-1 (Digital Sites, client test22) now.
update public.tickets set client_visible = true where key = 'SITES-1';

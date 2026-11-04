-- 0106_tickets: tickets, checklist, comments, files, history, watchers, read marks, saved views,
-- time entries and timers. Owned by the Tickets module.
--
-- Cross-module links without FKs (those tables come later):
--   tickets.project_id -> projects (0107_work adds the FK), tickets.client_id -> clients (0108_clients adds the FK).
-- Ticket keys (CPD-142) are made by a trigger from projects.key, looked up at insert time.
-- Seeds run in file order, so seeded tickets get project_id/client_id from public.tickets_link_projects(),
-- which the join step calls once after all seeds (safe to re-run).

-- ---------------------------------------------------------------- tables

create table public.ticket_key_counters (
  prefix text primary key,
  last_n integer not null default 0
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  project_id uuid,
  client_id uuid,
  parent_id uuid references public.tickets (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text,
  done_when text,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'in_review', 'blocked', 'done')),
  priority text not null default 'normal' check (priority in ('urgent', 'high', 'normal', 'low')),
  assignee_id uuid references public.members (id) on delete set null,
  co_assignee_ids uuid[] not null default '{}',
  reporter_id uuid references public.members (id) on delete set null default auth.uid(),
  reviewer_id uuid references public.members (id) on delete set null,
  review_round integer not null default 0,
  due_date date,
  start_date date,
  estimate_min integer check (estimate_min is null or estimate_min >= 0),
  tags text[] not null default '{}',
  source text,
  client_visible boolean not null default false,
  client_title text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tickets_project_idx on public.tickets (project_id);
create index tickets_client_idx on public.tickets (client_id) where client_id is not null;
create index tickets_parent_idx on public.tickets (parent_id) where parent_id is not null;
create index tickets_assignee_idx on public.tickets (assignee_id);
create index tickets_reporter_idx on public.tickets (reporter_id);
create index tickets_status_idx on public.tickets (status);
create index tickets_due_idx on public.tickets (due_date);
create index tickets_tags_idx on public.tickets using gin (tags);
create index tickets_co_idx on public.tickets using gin (co_assignee_ids);
create trigger tickets_updated_at before update on public.tickets
  for each row execute function public.set_updated_at();

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 300),
  done boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index checklist_items_ticket_idx on public.checklist_items (ticket_id, position);
create trigger checklist_items_updated_at before update on public.checklist_items
  for each row execute function public.set_updated_at();

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  author_id uuid references public.members (id) on delete set null default auth.uid(),
  body text not null check (char_length(body) between 1 and 10000),
  is_update boolean not null default false,
  to_client boolean not null default false,
  from_client boolean not null default false,
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index comments_ticket_idx on public.comments (ticket_id, created_at);
create index comments_author_idx on public.comments (author_id);
create trigger comments_updated_at before update on public.comments
  for each row execute function public.set_updated_at();

-- Files live in the private Storage bucket "ticket-files" at <ticket_id>/<uuid>-<name>.
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  path text not null unique,
  name text not null,
  size_bytes integer not null check (size_bytes >= 0),
  mime text,
  uploaded_by uuid references public.members (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index attachments_ticket_idx on public.attachments (ticket_id);

create table public.ticket_watchers (
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (ticket_id, member_id)
);
create index ticket_watchers_member_idx on public.ticket_watchers (member_id);

-- When each person last opened the ticket; drives "Seen by N" under comments.
create table public.ticket_reads (
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (ticket_id, member_id)
);

create table public.ticket_history (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  actor_id uuid references public.members (id) on delete set null default auth.uid(),
  field text not null,
  old_value text,
  new_value text,
  created_at timestamptz not null default now()
);
create index ticket_history_ticket_idx on public.ticket_history (ticket_id, created_at);

create table public.saved_filters (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade default auth.uid(),
  department_id uuid references public.departments (id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  query text not null default '',
  shared boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index saved_filters_member_idx on public.saved_filters (member_id);
create index saved_filters_department_idx on public.saved_filters (department_id) where shared;
create trigger saved_filters_updated_at before update on public.saved_filters
  for each row execute function public.set_updated_at();

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade default auth.uid(),
  ticket_id uuid references public.tickets (id) on delete set null,
  date date not null default current_date,
  minutes integer not null check (minutes > 0 and minutes <= 1440),
  billable boolean not null default true,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index time_entries_member_date_idx on public.time_entries (member_id, date);
create index time_entries_ticket_idx on public.time_entries (ticket_id);
create trigger time_entries_updated_at before update on public.time_entries
  for each row execute function public.set_updated_at();

-- One running timer per person.
create table public.timers (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null unique references public.members (id) on delete cascade default auth.uid(),
  ticket_id uuid references public.tickets (id) on delete cascade,
  note text,
  started_at timestamptz not null default now(),
  heartbeat_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index timers_ticket_idx on public.timers (ticket_id);

-- ---------------------------------------------------------------- key, client, completed_at, history

create or replace function public.tickets_before_write()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_prefix text;
  v_n integer;
  proj_key text;
  proj_client uuid;
begin
  if new.project_id is not null and (tg_op = 'INSERT' or new.project_id is distinct from old.project_id) then
    begin
      execute 'select key, client_id from public.projects where id = $1' into proj_key, proj_client using new.project_id;
    exception when undefined_table or undefined_column then
      proj_key := null; proj_client := null;
    end;
    if proj_client is not null then new.client_id := proj_client; end if;
  end if;

  if tg_op = 'INSERT' then
    if new.key is null or new.key = '' then
      v_prefix := upper(coalesce(proj_key, 'TK'));
      insert into public.ticket_key_counters as c (prefix, last_n) values (v_prefix, 1)
        on conflict (prefix) do update set last_n = c.last_n + 1
        returning c.last_n into v_n;
      new.key := v_prefix || '-' || v_n;
    elsif new.key ~ '^[A-Z]{2,8}-[0-9]+$' then
      -- Explicit key (seed, import): keep the counter ahead of it.
      v_prefix := split_part(new.key, '-', 1);
      v_n := split_part(new.key, '-', 2)::integer;
      insert into public.ticket_key_counters as c (prefix, last_n) values (v_prefix, v_n)
        on conflict (prefix) do update set last_n = greatest(c.last_n, excluded.last_n);
    end if;
  end if;

  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then
    new.completed_at := coalesce(new.completed_at, now());
  elsif new.status <> 'done' then
    new.completed_at := null;
  end if;
  return new;
end;
$$;
create trigger tickets_before_write before insert or update on public.tickets
  for each row execute function public.tickets_before_write();

create or replace function public.tickets_log_history()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.ticket_history (ticket_id, actor_id, field, new_value, created_at)
      values (new.id, coalesce(auth.uid(), new.reporter_id), 'created', new.source, new.created_at);
    return new;
  end if;
  if new.status is distinct from old.status then
    insert into public.ticket_history (ticket_id, actor_id, field, old_value, new_value) values (new.id, auth.uid(), 'status', old.status, new.status);
  end if;
  if new.priority is distinct from old.priority then
    insert into public.ticket_history (ticket_id, actor_id, field, old_value, new_value) values (new.id, auth.uid(), 'priority', old.priority, new.priority);
  end if;
  if new.assignee_id is distinct from old.assignee_id then
    insert into public.ticket_history (ticket_id, actor_id, field, old_value, new_value) values (new.id, auth.uid(), 'assignee', old.assignee_id::text, new.assignee_id::text);
  end if;
  if new.due_date is distinct from old.due_date then
    insert into public.ticket_history (ticket_id, actor_id, field, old_value, new_value) values (new.id, auth.uid(), 'due', old.due_date::text, new.due_date::text);
  end if;
  if new.title is distinct from old.title then
    insert into public.ticket_history (ticket_id, actor_id, field, old_value, new_value) values (new.id, auth.uid(), 'title', old.title, new.title);
  end if;
  if new.project_id is distinct from old.project_id then
    insert into public.ticket_history (ticket_id, actor_id, field, old_value, new_value) values (new.id, auth.uid(), 'project', old.project_id::text, new.project_id::text);
  end if;
  return new;
end;
$$;
create trigger tickets_log_history after insert or update on public.tickets
  for each row execute function public.tickets_log_history();

-- Fill project_id/client_id for tickets inserted before projects existed (seeds). Matches by key prefix.
create or replace function public.tickets_link_projects()
returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  n integer;
begin
  execute $q$
    update public.tickets t
       set project_id = coalesce(t.project_id, p.id),
           client_id = coalesce(t.client_id, p.client_id)
      from public.projects p
     where p.key = split_part(t.key, '-', 1)
       and (t.project_id is null or t.client_id is null)
  $q$;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke execute on function public.tickets_link_projects() from public, anon, authenticated;

-- ---------------------------------------------------------------- access helpers

-- Staff who can see a ticket: tickets.view all, or team scope over assignee/reporter, or own involvement.
-- Column-based so the tickets select policy also passes for INSERT ... RETURNING (a lookup would not see the new row).
create or replace function public.staff_sees_ticket(t uuid, assignee uuid, reporter uuid, co uuid[])
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_staff() and (
    public.has_perm('tickets.view', 'all')
    or (public.has_perm('tickets.view', 'team') and (public.in_my_team(assignee) or public.in_my_team(reporter)))
    or (public.has_perm('tickets.view', 'own')
        and (assignee = auth.uid() or reporter = auth.uid() or auth.uid() = any (co)
             or exists (select 1 from public.ticket_watchers w where w.ticket_id = t and w.member_id = auth.uid())))
  );
$$;

create or replace function public.can_see_ticket(t uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tickets k
    where k.id = t and public.staff_sees_ticket(k.id, k.assignee_id, k.reporter_id, k.co_assignee_ids)
  );
$$;

create or replace function public.can_edit_ticket(t uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_staff() and exists (
    select 1 from public.tickets k
    where k.id = t
      and (
        public.has_perm('tickets.manage', 'all')
        or (public.has_perm('tickets.manage', 'team')
            and (public.in_my_team(k.assignee_id) or public.in_my_team(k.reporter_id)))
        or (public.has_perm('tickets.manage', 'own')
            and (k.assignee_id = auth.uid() or k.reporter_id = auth.uid() or auth.uid() = any (k.co_assignee_ids)))
      )
  );
$$;

-- Client login: only client-visible tickets of their own client.
create or replace function public.client_sees_ticket(t uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tickets k
    where k.id = t
      and k.client_visible
      and k.client_id is not null
      and k.client_id = public.my_client_id()
      and public.has_perm('tickets.view', 'own')
  );
$$;

-- Storage path "<ticket_id>/..." -> ticket id, or null when the path is not ours.
create or replace function public.ticket_file_ticket(path text)
returns uuid
language plpgsql immutable
set search_path = ''
as $$
begin
  return split_part(path, '/', 1)::uuid;
exception when others then
  return null;
end;
$$;

revoke execute on function public.staff_sees_ticket(uuid, uuid, uuid, uuid[]), public.can_see_ticket(uuid),
  public.can_edit_ticket(uuid), public.client_sees_ticket(uuid) from public, anon;
grant execute on function public.staff_sees_ticket(uuid, uuid, uuid, uuid[]), public.can_see_ticket(uuid),
  public.can_edit_ticket(uuid), public.client_sees_ticket(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------- RLS

alter table public.ticket_key_counters enable row level security; -- no policies: only the trigger writes it
alter table public.tickets enable row level security;
alter table public.checklist_items enable row level security;
alter table public.comments enable row level security;
alter table public.attachments enable row level security;
alter table public.ticket_watchers enable row level security;
alter table public.ticket_reads enable row level security;
alter table public.ticket_history enable row level security;
alter table public.saved_filters enable row level security;
alter table public.time_entries enable row level security;
alter table public.timers enable row level security;

-- tickets
create policy tickets_select on public.tickets for select to authenticated using (
  public.staff_sees_ticket(id, assignee_id, reporter_id, co_assignee_ids)
  or (client_visible and client_id is not null and client_id = public.my_client_id() and public.has_perm('tickets.view', 'own'))
);
create policy tickets_insert on public.tickets for insert to authenticated
  with check (public.is_staff() and public.has_perm('tickets.manage', 'own') and reporter_id = auth.uid());
create policy tickets_update on public.tickets for update to authenticated
  using (public.can_edit_ticket(id))
  with check (public.is_staff() and public.has_perm('tickets.manage', 'own'));
create policy tickets_delete on public.tickets for delete to authenticated
  using (public.can_edit_ticket(id) and (public.has_perm('tickets.manage', 'team') or reporter_id = auth.uid()));

-- checklist: visible with the ticket, edited by ticket editors
create policy checklist_select on public.checklist_items for select to authenticated
  using (public.can_see_ticket(ticket_id));
create policy checklist_write on public.checklist_items for all to authenticated
  using (public.can_edit_ticket(ticket_id)) with check (public.can_edit_ticket(ticket_id));

-- comments: staff see all on visible tickets; clients see only client-facing ones.
-- Anyone who sees a ticket may comment; only the author edits; author or moderator deletes.
create policy comments_select_staff on public.comments for select to authenticated
  using (public.can_see_ticket(ticket_id));
create policy comments_select_client on public.comments for select to authenticated
  using ((to_client or from_client) and public.client_sees_ticket(ticket_id));
create policy comments_insert_staff on public.comments for insert to authenticated
  with check (author_id = auth.uid() and not from_client and public.can_see_ticket(ticket_id));
create policy comments_insert_client on public.comments for insert to authenticated
  with check (author_id = auth.uid() and from_client and not to_client and not is_update and public.client_sees_ticket(ticket_id));
create policy comments_update on public.comments for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy comments_delete on public.comments for delete to authenticated
  using (author_id = auth.uid() or (public.has_perm('tickets.manage', 'all') and public.can_see_ticket(ticket_id)));

-- attachments (staff only in Phase 1)
create policy attachments_select on public.attachments for select to authenticated
  using (public.can_see_ticket(ticket_id));
create policy attachments_insert on public.attachments for insert to authenticated
  with check (uploaded_by = auth.uid() and public.can_see_ticket(ticket_id));
create policy attachments_delete on public.attachments for delete to authenticated
  using (uploaded_by = auth.uid() or public.can_edit_ticket(ticket_id));

-- watchers: see with the ticket; you add or remove yourself
create policy watchers_select on public.ticket_watchers for select to authenticated
  using (member_id = auth.uid() or public.can_see_ticket(ticket_id));
create policy watchers_insert on public.ticket_watchers for insert to authenticated
  with check (member_id = auth.uid() and public.is_staff()
              and (public.can_see_ticket(ticket_id) or public.has_perm('tickets.view', 'own')));
create policy watchers_delete on public.ticket_watchers for delete to authenticated
  using (member_id = auth.uid() or public.can_edit_ticket(ticket_id));

-- read marks
create policy reads_select on public.ticket_reads for select to authenticated
  using (public.can_see_ticket(ticket_id));
create policy reads_write on public.ticket_reads for all to authenticated
  using (member_id = auth.uid()) with check (member_id = auth.uid() and public.can_see_ticket(ticket_id));

-- history: written by the trigger and by actions (checklist, time, review); never edited
create policy history_select on public.ticket_history for select to authenticated
  using (public.can_see_ticket(ticket_id));
create policy history_insert on public.ticket_history for insert to authenticated
  with check (actor_id = auth.uid() and public.can_see_ticket(ticket_id));

-- saved views: mine, plus views shared with my department
create policy saved_filters_select on public.saved_filters for select to authenticated using (
  member_id = auth.uid()
  or (shared and public.is_staff() and department_id = (select m.department_id from public.members m where m.id = auth.uid()))
);
create policy saved_filters_write on public.saved_filters for all to authenticated
  using (member_id = auth.uid()) with check (member_id = auth.uid() and public.is_staff());

-- time entries: your own; team/all by time.view scope
create policy time_entries_select on public.time_entries for select to authenticated using (
  member_id = auth.uid()
  or public.has_perm('time.view', 'all')
  or (public.has_perm('time.view', 'team') and public.in_my_team(member_id))
);
create policy time_entries_insert on public.time_entries for insert to authenticated
  with check (member_id = auth.uid() and public.is_staff() and (ticket_id is null or public.can_see_ticket(ticket_id)));
create policy time_entries_update on public.time_entries for update to authenticated
  using (member_id = auth.uid()) with check (member_id = auth.uid() and (ticket_id is null or public.can_see_ticket(ticket_id)));
create policy time_entries_delete on public.time_entries for delete to authenticated
  using (member_id = auth.uid());

-- timers: your own only
create policy timers_own on public.timers for all to authenticated
  using (member_id = auth.uid())
  with check (member_id = auth.uid() and public.is_staff() and (ticket_id is null or public.can_see_ticket(ticket_id)));

-- ---------------------------------------------------------------- storage: ticket-files (private, 2 MB each)

insert into storage.buckets (id, name, public, file_size_limit)
values ('ticket-files', 'ticket-files', false, 2097152)
on conflict (id) do nothing;

create policy ticket_files_select on storage.objects for select to authenticated
  using (bucket_id = 'ticket-files' and public.can_see_ticket(public.ticket_file_ticket(name)));
create policy ticket_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'ticket-files' and public.can_see_ticket(public.ticket_file_ticket(name)));
create policy ticket_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'ticket-files' and public.can_see_ticket(public.ticket_file_ticket(name))
         and (owner = auth.uid() or public.can_edit_ticket(public.ticket_file_ticket(name))));

-- ---------------------------------------------------------------- realtime (board)

alter publication supabase_realtime add table public.tickets;

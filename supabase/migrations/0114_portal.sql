-- 0114_portal: client portal. Owned by the Client portal module.
--
--   portal_users     one row per client login: which client, last time they opened the portal.
--   approvals        work we send a client to approve. The client answers Approve or Ask for changes.
--   shared_activity  the "Recent activity" feed a client sees. Lines are draft, shared or hidden;
--                    clients only ever read shared lines.
--
-- Client writes go through security definer functions (portal_decide, portal_request_work,
-- portal_file_added, portal_touch). Each one checks public.my_client_id() first, so a client login
-- can only touch its own client. Staff read and write by public.staff_sees_client().

-- ---------------------------------------------------------------- portal_users
create table public.portal_users (
  member_id uuid primary key references public.members (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  last_seen_at timestamptz,
  invited_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index portal_users_client_idx on public.portal_users (client_id);
create trigger portal_users_updated_at before update on public.portal_users
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- approvals
create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  ticket_id uuid references public.tickets (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  body text check (char_length(body) <= 4000),
  -- [{name, type}] e.g. {"name":"Meta carousel","type":"PNG · 4 slides"}; display only
  files jsonb not null default '[]' check (jsonb_typeof(files) = 'array'),
  status text not null default 'waiting' check (status in ('waiting', 'approved', 'changes')),
  sent_by uuid references public.members (id) on delete set null default auth.uid(),
  sent_at timestamptz not null default now(),
  decided_by uuid references public.members (id) on delete set null,
  decided_at timestamptz,
  change_note text check (char_length(change_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint approvals_decided check ((status = 'waiting') = (decided_at is null))
);
create index approvals_client_idx on public.approvals (client_id, status, sent_at desc);
create index approvals_ticket_idx on public.approvals (ticket_id);
create trigger approvals_updated_at before update on public.approvals
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- shared_activity
create table public.shared_activity (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  actor_id uuid references public.members (id) on delete set null,
  actor_name text not null check (char_length(actor_name) between 1 and 120),
  action text not null check (char_length(action) between 1 and 300), -- "shared the October 2026 report"
  href text,                                                         -- portal link, e.g. /portal/work
  visibility text not null default 'shared' check (visibility in ('draft', 'shared', 'hidden')),
  happened_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shared_activity_client_idx on public.shared_activity (client_id, happened_at desc);
create trigger shared_activity_updated_at before update on public.shared_activity
  for each row execute function public.set_updated_at();

-- New approval -> a shared activity line ("sent X for your approval").
create or replace function public.approvals_after_insert()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.shared_activity (client_id, actor_id, actor_name, action, href, happened_at)
  select new.client_id, new.sent_by, coalesce(m.name, 'Your team'),
         left('sent "' || new.title || '" for your approval', 300), '/portal/work', new.sent_at
  from (select 1) x left join public.members m on m.id = new.sent_by;
  return null;
end;
$$;
create trigger approvals_after_insert after insert on public.approvals
  for each row execute function public.approvals_after_insert();

-- ---------------------------------------------------------------- RLS
alter table public.portal_users enable row level security;
alter table public.approvals enable row level security;
alter table public.shared_activity enable row level security;

-- portal_users: staff who see the client, and the login itself. Staff on the account manage them.
create policy portal_users_select on public.portal_users for select to authenticated
  using (public.staff_sees_client(client_id) or member_id = auth.uid());
create policy portal_users_write on public.portal_users for all to authenticated
  using (public.is_staff() and public.staff_manages_client(client_id))
  with check (public.is_staff() and public.staff_manages_client(client_id));

-- approvals: staff on the account send and edit; client logins with portal.approve read their own.
create policy approvals_select on public.approvals for select to authenticated using (
  public.staff_sees_client(client_id)
  or (client_id = public.my_client_id() and public.has_perm('portal.approve', 'own'))
);
create policy approvals_write on public.approvals for all to authenticated
  using (public.is_staff() and public.staff_sees_client(client_id))
  with check (public.is_staff() and public.staff_sees_client(client_id));

-- shared_activity: staff on the account see and edit every line; clients see shared lines of their own client.
create policy shared_activity_select on public.shared_activity for select to authenticated using (
  public.staff_sees_client(client_id)
  or (client_id = public.my_client_id() and visibility = 'shared')
);
create policy shared_activity_write on public.shared_activity for all to authenticated
  using (public.is_staff() and public.staff_sees_client(client_id))
  with check (public.is_staff() and public.staff_sees_client(client_id));

-- ---------------------------------------------------------------- client actions

-- Approve or ask for changes. Changes open an SLA wait (kind 'changes') and, when the approval is
-- linked to a ticket, add the note as a client comment on it.
create or replace function public.portal_decide(p_approval uuid, p_decision text, p_note text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_client uuid := public.my_client_id();
  v_name text;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  a public.approvals;
begin
  if v_client is null or not public.has_perm('portal.approve', 'own') then
    raise exception 'You don''t have access to do that.' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'changes') then
    raise exception 'Unknown decision.' using errcode = '22023';
  end if;
  if p_decision = 'changes' and v_note is null then
    raise exception 'Say what we should change.' using errcode = '22023';
  end if;

  select * into a from public.approvals where id = p_approval and client_id = v_client for update;
  if not found then raise exception 'This approval was not found.' using errcode = 'P0002'; end if;
  if a.status <> 'waiting' then raise exception 'This was already answered.' using errcode = '23514'; end if;

  update public.approvals
    set status = p_decision, decided_by = auth.uid(), decided_at = now(), change_note = v_note
    where id = a.id;

  select m.name into v_name from public.members m where m.id = auth.uid();
  insert into public.shared_activity (client_id, actor_id, actor_name, action, href)
  values (v_client, auth.uid(), coalesce(v_name, 'Client'),
          left(case p_decision when 'approved' then 'approved "' else 'asked for changes to "' end || a.title || '"', 300),
          '/portal/work');

  if p_decision = 'changes' then
    insert into public.sla_waits (client_id, kind, subject, from_name, ticket_id, answerer_id, target_hours)
    values (v_client, 'changes', left('Changes asked: ' || a.title, 300), v_name, a.ticket_id,
            public.sla_answerer(v_client), coalesce(public.sla_target('changes'), 8));
    if a.ticket_id is not null then
      -- The open wait above stops the comment trigger from opening a second one.
      insert into public.comments (ticket_id, author_id, body, from_client)
      values (a.ticket_id, auth.uid(), left('Changes asked on "' || a.title || '": ' || v_note, 10000), true);
    end if;
  end if;
end;
$$;

-- Request new work: a client-visible ticket on the client's newest active project (key TK-n when
-- there is none), assigned to the delivery lead, plus an SLA wait (kind 'request'). Returns the key.
create or replace function public.portal_request_work(p_what text, p_due date default null)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_client uuid := public.my_client_id();
  v_what text := btrim(coalesce(p_what, ''));
  v_title text;
  v_name text;
  v_project uuid;
  v_answerer uuid;
  v_id uuid;
  v_key text;
begin
  if v_client is null then
    raise exception 'You don''t have access to do that.' using errcode = '42501';
  end if;
  if char_length(v_what) < 3 or char_length(v_what) > 4000 then
    raise exception 'Tell us what you need in 3 to 4000 characters.' using errcode = '22023';
  end if;
  if p_due is not null and p_due < current_date then
    raise exception 'Pick a date from today on.' using errcode = '22023';
  end if;

  v_title := left(split_part(v_what, E'\n', 1), 200);
  select m.name into v_name from public.members m where m.id = auth.uid();
  select p.id into v_project from public.projects p
    where p.client_id = v_client and p.status = 'active' order by p.created_at desc limit 1;
  v_answerer := public.sla_answerer(v_client);

  insert into public.tickets (project_id, client_id, title, description, status, priority, assignee_id,
                              reporter_id, due_date, source, client_visible, client_title)
  values (v_project, v_client, v_title, v_what, 'todo', 'normal', v_answerer,
          auth.uid(), p_due, 'portal', true, v_title)
  returning id, key into v_id, v_key;

  insert into public.sla_waits (client_id, kind, subject, from_name, ticket_id, answerer_id, target_hours)
  values (v_client, 'request', left('New request: ' || v_title, 300), v_name, v_id, v_answerer,
          coalesce(public.sla_target('request'), 4));

  insert into public.shared_activity (client_id, actor_id, actor_name, action, href)
  values (v_client, auth.uid(), coalesce(v_name, 'Client'), left('asked for "' || v_title || '"', 300), '/portal/work?tab=prog');

  return v_key;
end;
$$;

-- After a client uploads a file (client_files + file_versions written under RLS), log it in the feed.
create or replace function public.portal_file_added(p_file uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_client uuid := public.my_client_id();
  v_name text;
  v_file text;
begin
  if v_client is null then raise exception 'You don''t have access to do that.' using errcode = '42501'; end if;
  select f.name into v_file from public.client_files f where f.id = p_file and f.client_id = v_client;
  if v_file is null then raise exception 'File not found.' using errcode = 'P0002'; end if;
  select m.name into v_name from public.members m where m.id = auth.uid();
  insert into public.shared_activity (client_id, actor_id, actor_name, action, href)
  values (v_client, auth.uid(), coalesce(v_name, 'Client'), left('uploaded "' || v_file || '"', 300), '/portal/files');
end;
$$;

-- Record that a client login opened the portal (at most once every 10 minutes).
create or replace function public.portal_touch()
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_client uuid := public.my_client_id();
begin
  if v_client is null then return; end if;
  insert into public.portal_users as p (member_id, client_id, last_seen_at)
  values (auth.uid(), v_client, now())
  on conflict (member_id) do update set client_id = excluded.client_id, last_seen_at = excluded.last_seen_at
    where p.last_seen_at is null or p.last_seen_at < now() - interval '10 minutes' or p.client_id <> excluded.client_id;
end;
$$;

revoke execute on function public.portal_decide(uuid, text, text), public.portal_request_work(text, date),
  public.portal_file_added(uuid), public.portal_touch(), public.approvals_after_insert() from public, anon;
grant execute on function public.portal_decide(uuid, text, text), public.portal_request_work(text, date),
  public.portal_file_added(uuid), public.portal_touch() to authenticated, service_role;

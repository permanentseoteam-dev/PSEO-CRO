-- 0109_clientops: Response times (SLA waits + settings), Meetings (notes + action items) and Files
-- (folders, files, versions, brand kits, Storage bucket client-files). Owned by the Client ops module.
--
-- Response times
--   sla_waits: one row per client wait. Opened by triggers below when a client comments on a ticket
--   (comments.from_client) or posts in a client chat channel (a client login in a channel of kind
--   'client'). Closed by the first staff reply (a to_client comment on the same ticket, or a staff
--   message in the same channel). Other sources (portal requests, Phase 2 inbox) insert rows directly.
--   Waiting time is measured in working hours by the app (lib/modules/clientops/logic.ts), using
--   sla_settings (one row). target_hours is copied from the settings when the wait opens.
--   Alerts (answerer at target, manager at 2x) need a scheduled job: not built in Phase 1.
-- Meetings
--   meetings (client_id null = "No client" tab) and meeting_actions (outcome ticket / todo / skip).
--   Client logins read their own client's reviewed meetings and their to-dos, and tick to-dos done.
-- Files
--   client_folders (two default folders per client, made by a trigger on clients), client_files,
--   file_versions (one Storage object per version), brand_kits (one row per client).
--   Storage path: client-files/<client_id>/<uuid>-<file name>.
--   Client logins see files that are shared and sit in a folder the client can see, and may upload
--   into folders they can see (portal "From you").

-- ---------------------------------------------------------------- sla_settings (single row)
create table public.sla_settings (
  id boolean primary key default true check (id),
  reply_hours numeric(4,1) not null default 1 check (reply_hours between 0.5 and 72),
  request_hours numeric(4,1) not null default 4 check (request_hours between 0.5 and 72),
  changes_hours numeric(4,1) not null default 8 check (changes_hours between 0.5 and 72),
  timezone text not null default 'Asia/Dubai',
  day_start time not null default '09:00',
  day_end time not null default '18:00',
  workdays smallint[] not null default '{1,2,3,4,5}' check (workdays <@ array[1,2,3,4,5,6,7]::smallint[]),
  ontime_goal integer not null default 90 check (ontime_goal between 1 and 100),
  alert_answerer boolean not null default true,
  alert_manager boolean not null default true,
  post_daily boolean not null default false,
  updated_by uuid references public.members (id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint sla_settings_day check (day_end > day_start)
);
create trigger sla_settings_updated_at before update on public.sla_settings
  for each row execute function public.set_updated_at();
insert into public.sla_settings (id) values (true) on conflict do nothing;

-- ---------------------------------------------------------------- sla_waits
create table public.sla_waits (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  kind text not null check (kind in ('message', 'comment', 'request', 'changes')),
  subject text not null check (char_length(subject) between 1 and 300),
  from_name text,
  ticket_id uuid references public.tickets (id) on delete set null,
  channel_id uuid references public.channels (id) on delete set null,
  answerer_id uuid references public.members (id) on delete set null,
  target_hours numeric(4,1) not null check (target_hours between 0.5 and 72),
  started_at timestamptz not null default now(),
  answered_at timestamptz,
  answered_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint sla_waits_answer check (answered_at is null or answered_at >= started_at)
);
create index sla_waits_client_idx on public.sla_waits (client_id, started_at desc);
create index sla_waits_open_idx on public.sla_waits (started_at) where answered_at is null;
create index sla_waits_answered_idx on public.sla_waits (answered_at) where answered_at is not null;
create index sla_waits_answerer_idx on public.sla_waits (answerer_id);
create index sla_waits_ticket_idx on public.sla_waits (ticket_id) where ticket_id is not null;
create index sla_waits_channel_idx on public.sla_waits (channel_id) where channel_id is not null;

-- ---------------------------------------------------------------- meetings
create table public.meetings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  held_at timestamptz not null,
  duration_min integer check (duration_min is null or duration_min between 1 and 600),
  our_people uuid[] not null default '{}',
  guests text,
  attendee_emails text,
  summary text,
  decisions text[] not null default '{}',
  concerns jsonb not null default '[]' check (jsonb_typeof(concerns) = 'array'), -- [{topic, quote}]
  status text not null default 'to_review' check (status in ('to_review', 'reviewed', 'not_client')),
  source text not null default 'manual' check (source in ('manual', 'fireflies')),
  reviewed_by uuid references public.members (id) on delete set null,
  reviewed_at timestamptz,
  created_by uuid references public.members (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index meetings_client_idx on public.meetings (client_id, held_at desc);
create index meetings_status_idx on public.meetings (status, held_at desc);
create index meetings_people_idx on public.meetings using gin (our_people);
create trigger meetings_updated_at before update on public.meetings
  for each row execute function public.set_updated_at();

create table public.meeting_actions (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  position integer not null default 0,
  title text not null check (char_length(title) between 1 and 300),
  owner_name text,
  assignee_id uuid references public.members (id) on delete set null,
  outcome text not null default 'ticket' check (outcome in ('ticket', 'todo', 'skip')),
  ticket_id uuid references public.tickets (id) on delete set null,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index meeting_actions_meeting_idx on public.meeting_actions (meeting_id, position);
create index meeting_actions_ticket_idx on public.meeting_actions (ticket_id) where ticket_id is not null;
create trigger meeting_actions_updated_at before update on public.meeting_actions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- files
create table public.client_folders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  kind text not null default 'custom' check (kind in ('brand', 'from_client', 'custom')),
  client_visible boolean not null default true,
  position integer not null default 100,
  created_by uuid references public.members (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create unique index client_folders_name_uniq on public.client_folders (client_id, lower(name));
create index client_folders_client_idx on public.client_folders (client_id, position);

create table public.client_files (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  folder_id uuid not null references public.client_folders (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  shared boolean not null default false,
  created_by uuid references public.members (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index client_files_name_uniq on public.client_files (folder_id, lower(name));
create index client_files_client_idx on public.client_files (client_id);
create index client_files_name_idx on public.client_files (lower(name));
create trigger client_files_updated_at before update on public.client_files
  for each row execute function public.set_updated_at();

create table public.file_versions (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.client_files (id) on delete cascade,
  version integer not null check (version >= 1),
  path text not null,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  mime text,
  uploaded_by uuid references public.members (id) on delete set null default auth.uid(),
  uploader_name text, -- for uploads by client contacts without a login (seed, email); else from members
  created_at timestamptz not null default now(),
  unique (file_id, version)
);
create index file_versions_file_idx on public.file_versions (file_id, version desc);

create table public.brand_kits (
  client_id uuid primary key references public.clients (id) on delete cascade,
  colours jsonb not null default '[]' check (jsonb_typeof(colours) = 'array'), -- [{name, hex}]
  fonts text,
  tone text,
  dos text[] not null default '{}',
  donts text[] not null default '{}',
  updated_by uuid references public.members (id) on delete set null default auth.uid(),
  updated_at timestamptz not null default now()
);
create trigger brand_kits_updated_at before update on public.brand_kits
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- default folders per client
create or replace function public.clients_default_folders()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.client_folders (client_id, name, kind, client_visible, position, created_by) values
    (new.id, 'Brand assets', 'brand', true, 0, null),
    (new.id, 'From the client', 'from_client', true, 1, null)
  on conflict do nothing;
  return new;
end;
$$;
create trigger clients_default_folders after insert on public.clients
  for each row execute function public.clients_default_folders();
insert into public.client_folders (client_id, name, kind, client_visible, position, created_by)
  select c.id, f.name, f.kind, true, f.pos, null
  from public.clients c
  cross join (values ('Brand assets', 'brand', 0), ('From the client', 'from_client', 1)) as f (name, kind, pos)
on conflict do nothing;

-- ---------------------------------------------------------------- SLA waits from comments and chat
-- Who should answer: the client's delivery lead, else the account owner.
create or replace function public.sla_answerer(cid uuid)
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    (select t.member_id from public.client_team t where t.client_id = cid and t.role = 'delivery_lead' limit 1),
    (select c.owner_id from public.clients c where c.id = cid)
  );
$$;

create or replace function public.sla_target(k text)
returns numeric
language sql stable security definer
set search_path = ''
as $$
  select case k when 'request' then s.request_hours when 'changes' then s.changes_hours else s.reply_hours end
  from public.sla_settings s where s.id;
$$;

create or replace function public.sla_from_comment()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_client uuid;
  v_key text;
  v_assignee uuid;
begin
  select k.client_id, k.key, k.assignee_id into v_client, v_key, v_assignee from public.tickets k where k.id = new.ticket_id;
  if v_client is null then return new; end if;
  if new.from_client then
    if not exists (select 1 from public.sla_waits w where w.ticket_id = new.ticket_id and w.answered_at is null) then
      insert into public.sla_waits (client_id, kind, subject, from_name, ticket_id, answerer_id, target_hours, started_at)
      values (v_client, 'comment', 'Comment on ' || v_key,
              (select m.name from public.members m where m.id = new.author_id),
              new.ticket_id, coalesce(v_assignee, public.sla_answerer(v_client)),
              coalesce(public.sla_target('comment'), 1), new.created_at);
    end if;
  elsif new.to_client then
    update public.sla_waits set answered_at = new.created_at, answered_by = new.author_id
      where ticket_id = new.ticket_id and answered_at is null and started_at <= new.created_at;
  end if;
  return new;
end;
$$;
create trigger comments_sla after insert on public.comments
  for each row execute function public.sla_from_comment();

create or replace function public.sla_from_message()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_client uuid;
  v_kind text;
  v_name text;
begin
  select c.client_id into v_client from public.channels c where c.id = new.channel_id and c.kind = 'client';
  if v_client is null or new.author_id is null then return new; end if;
  select m.kind, m.name into v_kind, v_name from public.members m where m.id = new.author_id;
  if v_kind = 'client' then
    if not exists (select 1 from public.sla_waits w where w.channel_id = new.channel_id and w.answered_at is null) then
      insert into public.sla_waits (client_id, kind, subject, from_name, channel_id, answerer_id, target_hours, started_at)
      values (v_client, 'message', 'Message in client chat', v_name, new.channel_id,
              public.sla_answerer(v_client), coalesce(public.sla_target('message'), 1), new.created_at);
    end if;
  elsif v_kind = 'staff' then
    update public.sla_waits set answered_at = new.created_at, answered_by = new.author_id
      where channel_id = new.channel_id and answered_at is null and started_at <= new.created_at;
  end if;
  return new;
end;
$$;
create trigger messages_sla after insert on public.messages
  for each row execute function public.sla_from_message();

-- ---------------------------------------------------------------- helpers for policies
create or replace function public.staff_sees_meeting(mid uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.meetings m
    where m.id = mid
      and public.is_staff()
      and (
        (m.client_id is not null and public.staff_sees_client(m.client_id))
        or (m.client_id is null and (public.has_perm('clients.view', 'all') or m.created_by = auth.uid() or auth.uid() = any (m.our_people)))
      )
  );
$$;

create or replace function public.client_sees_meeting(mid uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.meetings m
    where m.id = mid and m.status = 'reviewed' and m.client_id is not null and m.client_id = public.my_client_id()
  );
$$;

create or replace function public.client_sees_file(fid uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.client_files f join public.client_folders d on d.id = f.folder_id
    where f.id = fid and f.shared and d.client_visible and f.client_id = public.my_client_id()
  );
$$;

-- Storage path "<client_id>/..." -> client id, or null.
create or replace function public.client_file_client(path text)
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

-- Client login may read a Storage object when some shared, visible file version points at it.
create or replace function public.client_sees_path(p text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.file_versions v where v.path = p and public.client_sees_file(v.file_id));
$$;

revoke execute on function public.sla_answerer(uuid), public.sla_target(text), public.staff_sees_meeting(uuid),
  public.client_sees_meeting(uuid), public.client_sees_file(uuid), public.client_sees_path(text) from public, anon;
grant execute on function public.sla_answerer(uuid), public.sla_target(text), public.staff_sees_meeting(uuid),
  public.client_sees_meeting(uuid), public.client_sees_file(uuid), public.client_sees_path(text) to authenticated, service_role;

-- ---------------------------------------------------------------- RLS
alter table public.sla_settings enable row level security;
alter table public.sla_waits enable row level security;
alter table public.meetings enable row level security;
alter table public.meeting_actions enable row level security;
alter table public.client_folders enable row level security;
alter table public.client_files enable row level security;
alter table public.file_versions enable row level security;
alter table public.brand_kits enable row level security;

-- sla_settings: staff read; client managers with 'all' scope edit.
create policy sla_settings_select on public.sla_settings for select to authenticated using (public.is_staff());
create policy sla_settings_update on public.sla_settings for update to authenticated
  using (public.is_staff() and public.has_perm('clients.manage', 'all'))
  with check (public.is_staff() and public.has_perm('clients.manage', 'all'));

-- sla_waits: staff who see the client, or the person who must answer. Internal (no client policy).
create policy sla_waits_select on public.sla_waits for select to authenticated
  using (public.staff_sees_client(client_id) or (public.is_staff() and answerer_id = auth.uid()));
create policy sla_waits_insert on public.sla_waits for insert to authenticated
  with check (public.staff_sees_client(client_id) or client_id = public.my_client_id());
create policy sla_waits_update on public.sla_waits for update to authenticated
  using (public.staff_sees_client(client_id)) with check (public.staff_sees_client(client_id));
create policy sla_waits_delete on public.sla_waits for delete to authenticated
  using (public.staff_manages_client(client_id));

-- meetings: staff on the client log and review; client logins read reviewed notes of their own client.
create policy meetings_select on public.meetings for select to authenticated
  using (public.staff_sees_meeting(id) or public.client_sees_meeting(id));
create policy meetings_insert on public.meetings for insert to authenticated with check (
  public.is_staff() and created_by = auth.uid()
  and (client_id is null or public.staff_sees_client(client_id))
);
create policy meetings_update on public.meetings for update to authenticated
  using (public.staff_sees_meeting(id))
  with check (public.is_staff() and (client_id is null or public.staff_sees_client(client_id)));
create policy meetings_delete on public.meetings for delete to authenticated
  using (public.staff_sees_meeting(id) and (created_by = auth.uid() or public.has_perm('clients.manage', 'all')));

create policy meeting_actions_select on public.meeting_actions for select to authenticated
  using (public.staff_sees_meeting(meeting_id) or (outcome = 'todo' and public.client_sees_meeting(meeting_id)));
create policy meeting_actions_write on public.meeting_actions for all to authenticated
  using (public.staff_sees_meeting(meeting_id)) with check (public.staff_sees_meeting(meeting_id));
-- Client logins tick their own to-dos (the app only changes done / done_at).
create policy meeting_actions_client_update on public.meeting_actions for update to authenticated
  using (outcome = 'todo' and public.client_sees_meeting(meeting_id))
  with check (outcome = 'todo' and public.client_sees_meeting(meeting_id));

-- folders
create policy client_folders_select on public.client_folders for select to authenticated
  using (public.staff_sees_client(client_id) or (client_visible and client_id = public.my_client_id()));
create policy client_folders_write on public.client_folders for all to authenticated
  using (public.staff_sees_client(client_id)) with check (public.staff_sees_client(client_id));

-- files
create policy client_files_select on public.client_files for select to authenticated
  using (public.staff_sees_client(client_id) or public.client_sees_file(id));
create policy client_files_insert on public.client_files for insert to authenticated with check (
  public.staff_sees_client(client_id)
  or (client_id = public.my_client_id() and shared
      and exists (select 1 from public.client_folders d where d.id = client_files.folder_id and d.client_id = client_files.client_id and d.client_visible))
);
create policy client_files_update on public.client_files for update to authenticated
  using (public.staff_sees_client(client_id)) with check (public.staff_sees_client(client_id));
create policy client_files_delete on public.client_files for delete to authenticated
  using (public.staff_sees_client(client_id));

create policy file_versions_select on public.file_versions for select to authenticated using (
  exists (select 1 from public.client_files f where f.id = file_id and public.staff_sees_client(f.client_id))
  or public.client_sees_file(file_id)
);
create policy file_versions_insert on public.file_versions for insert to authenticated with check (
  uploaded_by = auth.uid() and (
    exists (select 1 from public.client_files f where f.id = file_id and public.staff_sees_client(f.client_id))
    or public.client_sees_file(file_id)
  )
);
create policy file_versions_delete on public.file_versions for delete to authenticated
  using (exists (select 1 from public.client_files f where f.id = file_id and public.staff_sees_client(f.client_id)));

-- brand kits: staff on the client edit; client logins read their own.
create policy brand_kits_select on public.brand_kits for select to authenticated
  using (public.staff_sees_client(client_id) or client_id = public.my_client_id());
create policy brand_kits_write on public.brand_kits for all to authenticated
  using (public.staff_sees_client(client_id)) with check (public.staff_sees_client(client_id));

-- ---------------------------------------------------------------- Storage: private bucket client-files (50 MB each)
insert into storage.buckets (id, name, public, file_size_limit)
values ('client-files', 'client-files', false, 52428800)
on conflict (id) do nothing;

create policy client_files_obj_select on storage.objects for select to authenticated using (
  bucket_id = 'client-files'
  and (public.staff_sees_client(public.client_file_client(name)) or public.client_sees_path(name))
);
create policy client_files_obj_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'client-files'
  and (public.staff_sees_client(public.client_file_client(name)) or public.client_file_client(name) = public.my_client_id())
);
create policy client_files_obj_delete on storage.objects for delete to authenticated using (
  bucket_id = 'client-files' and public.staff_sees_client(public.client_file_client(name))
);

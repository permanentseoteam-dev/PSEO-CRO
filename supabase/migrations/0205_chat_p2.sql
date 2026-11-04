-- 0205_chat_p2: Phase 2 chat extras.
-- huddles + huddle_participants (WebRTC calls; signalling is Realtime broadcast on private topic huddle:<channel_id>),
-- push_subscriptions (Web Push endpoints per device), slack_workspaces + slack_channel_links + slack_import_jobs
-- (Slack import and bridge; the adapter is not configured yet, so these hold settings and queued jobs only).
-- Voice notes need no table: the audio goes to the chat-files bucket (0105_chat) and the message's files item
-- carries {path, name, mime, size, duration, peaks}.
-- Also: posting into an archived conversation is blocked, and RLS on realtime.messages admits members to huddle topics.
-- Depends on 0001_core, 0105_chat (channels, messages, is_chat_member, is_chat_member_path, can_post_chat).

-- ---------------------------------------------------------------- huddles
create table public.huddles (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels (id) on delete cascade,
  media text not null default 'audio' check (media in ('audio', 'video')),
  started_by uuid references public.members (id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint huddles_end_after_start check (ended_at is null or ended_at >= started_at)
);
create index huddles_channel_idx on public.huddles (channel_id, started_at desc);
-- One live huddle per conversation.
create unique index huddles_one_live on public.huddles (channel_id) where ended_at is null;
create trigger huddles_updated_at before update on public.huddles
  for each row execute function public.set_updated_at();

create table public.huddle_participants (
  huddle_id uuid not null references public.huddles (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (huddle_id, member_id)
);
create index huddle_participants_member_idx on public.huddle_participants (member_id);
create trigger huddle_participants_updated_at before update on public.huddle_participants
  for each row execute function public.set_updated_at();

-- Member of the huddle's conversation (security definer so participant policies don't recurse through huddles RLS).
create or replace function public.can_see_huddle(hid uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.huddles h where h.id = hid and public.is_chat_member(h.channel_id));
$$;
revoke execute on function public.can_see_huddle(uuid) from public, anon;
grant execute on function public.can_see_huddle(uuid) to authenticated, service_role;

alter table public.huddles enable row level security;
alter table public.huddle_participants enable row level security;

-- Members of the conversation. Client logins only reach their own client's channel (is_chat_member checks my_client_id()).
create policy huddles_select on public.huddles for select to authenticated
  using (public.is_chat_member(channel_id));
create policy huddles_insert on public.huddles for insert to authenticated with check (
  started_by = auth.uid() and ended_at is null and public.can_post_chat(channel_id)
  and exists (select 1 from public.channels c where c.id = channel_id and c.archived_at is null)
);
-- Any member may end a live huddle (the last person out closes it).
create policy huddles_update on public.huddles for update to authenticated
  using (public.is_chat_member(channel_id)) with check (public.is_chat_member(channel_id));

create policy huddle_participants_select on public.huddle_participants for select to authenticated
  using (public.can_see_huddle(huddle_id));
create policy huddle_participants_insert on public.huddle_participants for insert to authenticated
  with check (member_id = auth.uid() and public.can_see_huddle(huddle_id));
create policy huddle_participants_update on public.huddle_participants for update to authenticated
  using (member_id = auth.uid()) with check (member_id = auth.uid() and public.can_see_huddle(huddle_id));

-- Signalling: private Realtime topics huddle:<channel_id>, broadcast + presence, members only.
create policy chat_p2_huddle_receive on realtime.messages for select to authenticated using (
  realtime.messages.extension in ('broadcast', 'presence')
  and realtime.topic() like 'huddle:%'
  and public.is_chat_member_path(split_part(realtime.topic(), ':', 2))
);
create policy chat_p2_huddle_send on realtime.messages for insert to authenticated with check (
  realtime.messages.extension in ('broadcast', 'presence')
  and realtime.topic() like 'huddle:%'
  and public.is_chat_member_path(split_part(realtime.topic(), ':', 2))
);

-- ---------------------------------------------------------------- archived conversations are read-only
create or replace function public.messages_block_archived()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.channels c where c.id = new.channel_id and c.archived_at is not null) then
    raise exception 'This conversation is archived' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger messages_block_archived before insert on public.messages
  for each row execute function public.messages_block_archived();

-- ---------------------------------------------------------------- Web Push
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%'),
  p256dh text not null,
  auth text not null,
  user_agent text check (length(user_agent) <= 300),
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index push_subscriptions_member_idx on public.push_subscriptions (member_id);
create trigger push_subscriptions_updated_at before update on public.push_subscriptions
  for each row execute function public.set_updated_at();

alter table public.push_subscriptions enable row level security;
-- Own devices only (staff and client logins alike). The notify-push Edge Function reads with the service role.
create policy push_subscriptions_own on public.push_subscriptions for all to authenticated
  using (member_id = auth.uid()) with check (member_id = auth.uid());

-- ---------------------------------------------------------------- Slack import and bridge
create table public.slack_workspaces (
  id uuid primary key default gen_random_uuid(),
  workspace text not null unique check (length(workspace) between 3 and 120),
  status text not null default 'not_connected' check (status in ('not_connected', 'connected', 'error')),
  bridge text not null default 'paused' check (bridge in ('running', 'paused')),
  import_days int not null default 90 check (import_days in (30, 90, 365)),
  last_sync_at timestamptz,
  imported_count int not null default 0 check (imported_count >= 0),
  connected_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger slack_workspaces_updated_at before update on public.slack_workspaces
  for each row execute function public.set_updated_at();

create table public.slack_channel_links (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.slack_workspaces (id) on delete cascade,
  slack_channel text not null check (slack_channel ~ '^#?[a-z0-9][a-z0-9_-]{0,79}$'),
  channel_id uuid references public.channels (id) on delete set null,
  bridge text not null default 'paused' check (bridge in ('running', 'paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, slack_channel)
);
-- One Slack channel per portal channel, or the bridge would echo.
create unique index slack_channel_links_channel_uq on public.slack_channel_links (channel_id) where channel_id is not null;
create index slack_channel_links_workspace_idx on public.slack_channel_links (workspace_id);
create trigger slack_channel_links_updated_at before update on public.slack_channel_links
  for each row execute function public.set_updated_at();

create table public.slack_import_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.slack_workspaces (id) on delete cascade,
  days int not null check (days in (30, 90, 365)),
  status text not null default 'queued' check (status in ('queued', 'running', 'paused', 'done', 'failed', 'not_configured')),
  cursor text,
  imported_count int not null default 0 check (imported_count >= 0),
  total_estimate int check (total_estimate >= 0),
  error text,
  started_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index slack_import_jobs_workspace_idx on public.slack_import_jobs (workspace_id, created_at desc);
create trigger slack_import_jobs_updated_at before update on public.slack_import_jobs
  for each row execute function public.set_updated_at();

alter table public.slack_workspaces enable row level security;
alter table public.slack_channel_links enable row level security;
alter table public.slack_import_jobs enable row level security;

-- Staff with chat.slack.manage (all) only. Client logins never see Slack settings.
create policy slack_workspaces_staff on public.slack_workspaces for all to authenticated
  using (public.is_staff() and public.has_perm('chat.slack.manage', 'all'))
  with check (public.is_staff() and public.has_perm('chat.slack.manage', 'all'));
create policy slack_channel_links_staff on public.slack_channel_links for all to authenticated
  using (public.is_staff() and public.has_perm('chat.slack.manage', 'all'))
  with check (public.is_staff() and public.has_perm('chat.slack.manage', 'all'));
create policy slack_import_jobs_staff on public.slack_import_jobs for all to authenticated
  using (public.is_staff() and public.has_perm('chat.slack.manage', 'all'))
  with check (public.is_staff() and public.has_perm('chat.slack.manage', 'all'));

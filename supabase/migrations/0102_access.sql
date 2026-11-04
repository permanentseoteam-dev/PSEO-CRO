-- 0102_access: invites and the audit log.

-- ---------------------------------------------------------------- invites
-- The raw token only lives in the emailed link; we store its SHA-256 hex.
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email) and position('@' in email) > 1),
  name text,
  role text not null references public.roles (key) on update cascade,
  department_id uuid references public.departments (id) on delete set null,
  client_id uuid, -- clients(id); no fk on purpose: clients is a later module and its seed runs after this one
  token_hash text not null unique,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  invited_by uuid references public.members (id) on delete set null,
  sent_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  member_id uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- One open invite per email.
create unique index invites_pending_email_idx on public.invites (email) where status = 'pending';
create index invites_client_idx on public.invites (client_id) where client_id is not null;
create index invites_invited_by_idx on public.invites (invited_by);
create index invites_sent_idx on public.invites (sent_at desc);
create trigger invites_updated_at before update on public.invites
  for each row execute function public.set_updated_at();

alter table public.invites enable row level security;

-- Admins manage invites. Only a super admin can invite a super admin.
-- Accepting runs server-side with the service key after the token check (the visitor is signed out).
create policy invites_admin on public.invites for all to authenticated
  using (public.has_perm('admin.access.manage', 'all'))
  with check (public.has_perm('admin.access.manage', 'all') and (role <> 'super_admin' or public.is_super_admin()));

-- ---------------------------------------------------------------- audit log
-- Append-only: no update or delete policies.
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.members (id) on delete set null, -- null = System
  action text not null,          -- machine key, e.g. 'roles.permission', 'invite.create', 'invoice.void'
  summary text not null,         -- what admins read, e.g. 'Changed time.approve for Department head to team'
  target_type text,
  target_id text,
  client_id uuid,                -- set when the action concerns one client (no fk: clients is a later module)
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);
create index audit_log_actor_idx on public.audit_log (actor_id);
create index audit_log_target_idx on public.audit_log (target_type, target_id);

alter table public.audit_log enable row level security;

create policy audit_log_select on public.audit_log for select to authenticated
  using (public.has_perm('admin.access.manage', 'all'));

-- Any active member may log their own actions; nobody can write as someone else.
create policy audit_log_insert on public.audit_log for insert to authenticated
  with check (actor_id = auth.uid() and (public.is_staff() or public.my_client_id() is not null));

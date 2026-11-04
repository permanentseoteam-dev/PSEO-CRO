-- 0113_personal: My profile, Time and Settings.
-- Tables: member_details, career_steps, attendance, leave_balances, leave_requests, documents,
-- timesheets, notification_prefs. Storage bucket: member-docs (private, 15 MB).
-- Also adds a lock trigger on public.time_entries (0106_tickets): no changes to a submitted or approved week.
-- Permission 'hr.manage' (HR edits job fields, documents, balances) is added in supabase/seed/0113_personal.sql.
-- Read by other modules: attendance (shell clock chip, team directory) uses member_id, clock_in, clock_out.

-- ---------------------------------------------------------------- profile extras

-- Fields the person edits (bio, linkedin, emergency contact, slack id) and HR edits (the rest).
create table public.member_details (
  member_id uuid primary key references public.members (id) on delete cascade,
  bio text check (char_length(bio) <= 2000),
  linkedin text,
  emergency_name text,
  emergency_phone text,
  slack_user_id text,
  location text,
  contract text not null default 'full_time' check (contract in ('full_time', 'part_time', 'contractor')),
  probation_start date,
  probation_end date,
  probation_status text not null default 'on_probation'
    check (probation_status in ('on_probation', 'extended', 'confirmed', 'ended')),
  probation_confirmed_by uuid references public.members (id) on delete set null,
  job_summary text,
  job_duties text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger member_details_updated_at before update on public.member_details
  for each row execute function public.set_updated_at();

-- The person can only change their own personal fields; HR fields need hr.manage.
create or replace function public.member_details_guard()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.has_perm('hr.manage', 'all') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.location is not null or new.contract <> 'full_time' or new.probation_start is not null
      or new.probation_end is not null or new.probation_status <> 'on_probation'
      or new.probation_confirmed_by is not null or new.job_summary is not null or new.job_duties <> '{}' then
      raise exception 'Only HR can set job details';
    end if;
  elsif new.location is distinct from old.location
    or new.contract is distinct from old.contract
    or new.probation_start is distinct from old.probation_start
    or new.probation_end is distinct from old.probation_end
    or new.probation_status is distinct from old.probation_status
    or new.probation_confirmed_by is distinct from old.probation_confirmed_by
    or new.job_summary is distinct from old.job_summary
    or new.job_duties is distinct from old.job_duties then
    raise exception 'Only HR can change job details';
  end if;
  return new;
end;
$$;
create trigger member_details_guard before insert or update on public.member_details
  for each row execute function public.member_details_guard();

create table public.career_steps (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  title text not null,
  kind text not null check (kind in ('joined', 'promoted', 'transfer', 'title_change')),
  on_date date not null,
  created_at timestamptz not null default now()
);
create index career_steps_member_idx on public.career_steps (member_id, on_date desc);

-- ---------------------------------------------------------------- attendance

-- One row per clock-in session. A session is open while clock_out is null (one open session per person).
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade default auth.uid(),
  clock_in timestamptz not null default now(),
  clock_out timestamptz,
  break_minutes integer not null default 0 check (break_minutes >= 0),
  break_started_at timestamptz,
  wfh boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (clock_out is null or clock_out >= clock_in)
);
create index attendance_member_in_idx on public.attendance (member_id, clock_in);
create unique index attendance_one_open_idx on public.attendance (member_id) where clock_out is null;
create trigger attendance_updated_at before update on public.attendance
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- leave

-- Allowance per type. 'wfh' is per month, the rest per year.
create table public.leave_balances (
  member_id uuid not null references public.members (id) on delete cascade,
  year integer not null check (year between 2020 and 2100),
  type text not null check (type in ('annual', 'sick', 'wfh', 'unpaid')),
  allowance numeric(5,1) not null default 0 check (allowance >= 0),
  per text not null default 'year' check (per in ('year', 'month')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (member_id, year, type)
);
create trigger leave_balances_updated_at before update on public.leave_balances
  for each row execute function public.set_updated_at();

-- Leave, work-from-home and overtime requests. Days are working days (Mon-Fri), 0.5 for a half day.
create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade default auth.uid(),
  type text not null check (type in ('annual', 'sick', 'wfh', 'unpaid', 'overtime')),
  start_date date not null,
  end_date date not null,
  half_day boolean not null default false,
  days numeric(5,1) not null default 0 check (days >= 0),
  minutes integer check (minutes is null or minutes between 1 and 1440),
  reason text check (char_length(reason) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'cancelled')),
  decided_by uuid references public.members (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);
create index leave_requests_member_idx on public.leave_requests (member_id, start_date desc);
create index leave_requests_pending_idx on public.leave_requests (status) where status = 'pending';
create trigger leave_requests_updated_at before update on public.leave_requests
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- documents

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  type text not null default 'other' check (type in ('id', 'visa', 'contract', 'letter', 'education', 'other')),
  hr_only boolean not null default false,
  expires_on date,
  storage_path text,
  size_bytes integer check (size_bytes is null or size_bytes between 0 and 15728640),
  uploaded_by uuid references public.members (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index documents_member_idx on public.documents (member_id);
create index documents_expiry_idx on public.documents (expires_on) where expires_on is not null;

-- ---------------------------------------------------------------- timesheets

-- One row per person per week (week_start is a Monday). Missing row = open.
-- Flow: open -> submitted -> approved, or submitted -> returned (with a note) -> submitted.
create table public.timesheets (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade default auth.uid(),
  week_start date not null check (extract(isodow from week_start) = 1),
  status text not null default 'open' check (status in ('open', 'submitted', 'approved', 'returned')),
  submitted_at timestamptz,
  decided_by uuid references public.members (id) on delete set null,
  decided_at timestamptz,
  return_note text check (char_length(return_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, week_start)
);
create index timesheets_status_idx on public.timesheets (status, week_start);
create trigger timesheets_updated_at before update on public.timesheets
  for each row execute function public.set_updated_at();

-- The person may only move their own week to submitted (or back to open from returned).
-- Approving and returning needs time.approve over that person, and never on your own week.
create or replace function public.timesheets_guard()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if new.member_id = auth.uid() then
    if new.status not in ('open', 'submitted') then
      raise exception 'You cannot approve or return your own timesheet';
    end if;
    if tg_op = 'UPDATE' and old.status = 'approved' then
      raise exception 'This week is already approved';
    end if;
    return new;
  end if;
  if not (public.has_perm('time.approve', 'all')
          or (public.has_perm('time.approve', 'team') and public.in_my_team(new.member_id))) then
    raise exception 'You cannot approve this timesheet';
  end if;
  return new;
end;
$$;
create trigger timesheets_guard before insert or update on public.timesheets
  for each row execute function public.timesheets_guard();

-- Lock: once a week is submitted or approved, its time entries cannot change.
create or replace function public.week_locked(m uuid, d date)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.timesheets t
    where t.member_id = m and t.week_start = date_trunc('week', d)::date and t.status in ('submitted', 'approved')
  );
$$;

create or replace function public.time_entries_week_lock()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if (tg_op <> 'INSERT' and public.week_locked(old.member_id, old.date))
    or (tg_op <> 'DELETE' and public.week_locked(new.member_id, new.date)) then
    raise exception 'That week is submitted, so its time is locked';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger time_entries_week_lock before insert or update or delete on public.time_entries
  for each row execute function public.time_entries_week_lock();

-- ---------------------------------------------------------------- notification preferences

create table public.notification_prefs (
  member_id uuid not null references public.members (id) on delete cascade,
  event text not null check (event in ('assigned', 'mention', 'client_reply', 'watch_change', 'review_wait', 'invoice_overdue')),
  in_app boolean not null default true,
  email boolean not null default false,
  phone boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (member_id, event)
);
create trigger notification_prefs_updated_at before update on public.notification_prefs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- RLS

alter table public.member_details enable row level security;
alter table public.career_steps enable row level security;
alter table public.attendance enable row level security;
alter table public.leave_balances enable row level security;
alter table public.leave_requests enable row level security;
alter table public.documents enable row level security;
alter table public.timesheets enable row level security;
alter table public.notification_prefs enable row level security;

-- member_details and career: staff read (directory/profile); you edit yours (guard limits fields); HR edits all.
create policy member_details_select on public.member_details for select to authenticated using (public.is_staff());
create policy member_details_self on public.member_details for all to authenticated
  using (member_id = auth.uid() and public.is_staff())
  with check (member_id = auth.uid() and public.is_staff());
create policy member_details_hr on public.member_details for all to authenticated
  using (public.has_perm('hr.manage', 'all')) with check (public.has_perm('hr.manage', 'all'));

create policy career_steps_select on public.career_steps for select to authenticated using (public.is_staff());
create policy career_steps_hr on public.career_steps for all to authenticated
  using (public.has_perm('hr.manage', 'all')) with check (public.has_perm('hr.manage', 'all'));

-- attendance: staff read (the directory shows who is clocked in); you write your own; HR fixes any.
create policy attendance_select on public.attendance for select to authenticated using (public.is_staff());
create policy attendance_self on public.attendance for all to authenticated
  using (member_id = auth.uid() and public.is_staff())
  with check (member_id = auth.uid() and public.is_staff());
create policy attendance_hr on public.attendance for all to authenticated
  using (public.has_perm('hr.manage', 'all')) with check (public.has_perm('hr.manage', 'all'));

-- leave balances: yours, your team by time.view scope, HR; HR writes.
create policy leave_balances_select on public.leave_balances for select to authenticated using (
  (member_id = auth.uid() and public.is_staff())
  or public.has_perm('time.view', 'all')
  or (public.has_perm('time.view', 'team') and public.in_my_team(member_id))
  or public.has_perm('hr.manage', 'all')
);
create policy leave_balances_hr on public.leave_balances for all to authenticated
  using (public.has_perm('hr.manage', 'all')) with check (public.has_perm('hr.manage', 'all'));

-- leave requests: read yours or your team's; ask for yourself (pending); cancel your pending one;
-- approvers (time.approve over the person, not yourself) decide.
create policy leave_requests_select on public.leave_requests for select to authenticated using (
  (member_id = auth.uid() and public.is_staff())
  or public.has_perm('time.view', 'all')
  or (public.has_perm('time.view', 'team') and public.in_my_team(member_id))
  or public.has_perm('hr.manage', 'all')
);
create policy leave_requests_insert on public.leave_requests for insert to authenticated
  with check (member_id = auth.uid() and public.is_staff() and status = 'pending' and decided_by is null);
create policy leave_requests_cancel on public.leave_requests for update to authenticated
  using (member_id = auth.uid() and status = 'pending')
  with check (member_id = auth.uid() and status in ('pending', 'cancelled') and decided_by is null);
create policy leave_requests_decide on public.leave_requests for update to authenticated
  using (
    member_id <> auth.uid()
    and (public.has_perm('time.approve', 'all') or (public.has_perm('time.approve', 'team') and public.in_my_team(member_id)))
  )
  with check (
    member_id <> auth.uid()
    and (public.has_perm('time.approve', 'all') or (public.has_perm('time.approve', 'team') and public.in_my_team(member_id)))
  );

-- documents: you see all of yours and upload your own (not HR only); you delete your own non-HR ones; HR does all.
create policy documents_select on public.documents for select to authenticated using (
  (member_id = auth.uid() and public.is_staff()) or public.has_perm('hr.manage', 'all')
);
create policy documents_insert_self on public.documents for insert to authenticated
  with check (member_id = auth.uid() and public.is_staff() and hr_only = false);
create policy documents_delete_self on public.documents for delete to authenticated
  using (member_id = auth.uid() and hr_only = false);
create policy documents_hr on public.documents for all to authenticated
  using (public.has_perm('hr.manage', 'all')) with check (public.has_perm('hr.manage', 'all'));

-- timesheets: read yours or by time.view scope; write yours (guard limits to submit) or as approver.
create policy timesheets_select on public.timesheets for select to authenticated using (
  (member_id = auth.uid() and public.is_staff())
  or public.has_perm('time.view', 'all')
  or (public.has_perm('time.view', 'team') and public.in_my_team(member_id))
  or public.has_perm('time.approve', 'all')
  or (public.has_perm('time.approve', 'team') and public.in_my_team(member_id))
);
create policy timesheets_self on public.timesheets for all to authenticated
  using (member_id = auth.uid() and public.is_staff())
  with check (member_id = auth.uid() and public.is_staff());
create policy timesheets_approver on public.timesheets for all to authenticated
  using (
    member_id <> auth.uid()
    and (public.has_perm('time.approve', 'all') or (public.has_perm('time.approve', 'team') and public.in_my_team(member_id)))
  )
  with check (
    member_id <> auth.uid()
    and (public.has_perm('time.approve', 'all') or (public.has_perm('time.approve', 'team') and public.in_my_team(member_id)))
  );

-- notification preferences: your own only.
create policy notification_prefs_own on public.notification_prefs for all to authenticated
  using (member_id = auth.uid()) with check (member_id = auth.uid());

-- ---------------------------------------------------------------- storage: member-docs (private, 15 MB)
-- Path: <member_id>/<random>-<file name>

insert into storage.buckets (id, name, public, file_size_limit)
values ('member-docs', 'member-docs', false, 15728640)
on conflict (id) do nothing;

create policy member_docs_select on storage.objects for select to authenticated using (
  bucket_id = 'member-docs'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.has_perm('hr.manage', 'all'))
);
create policy member_docs_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'member-docs'
  and (((storage.foldername(name))[1] = auth.uid()::text and public.is_staff()) or public.has_perm('hr.manage', 'all'))
);
create policy member_docs_delete on storage.objects for delete to authenticated using (
  bucket_id = 'member-docs'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.has_perm('hr.manage', 'all'))
);

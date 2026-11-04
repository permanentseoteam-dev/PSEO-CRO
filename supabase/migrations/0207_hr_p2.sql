-- 0207_hr_p2: Phase 2 profile, HR and performance extras.
--   Reuses Phase 1 tables where the concept already exists (columns added below):
--     HR details + probation -> 0113 member_details (+ shift_start, shift_end, probation_decided_at), joined_on in 0112 member_profiles
--     title changes          -> 0113 career_steps (+ old_title, departments, congrats fields)
--     pay history            -> 0111 salaries (+ salary components, reason)
--     clock widget           -> 0113 attendance, written through hr_clock_action()
--     KPIs / review cycles   -> 0112 kpis / review_cycles (+ opened_at, closed_at)
--   New tables: hr_payslips, hr_tool_access (never passwords), hr_personal_details + hr_personal_changes (log without
--   values), hr_exits + hr_exit_tasks (Leaving tab), hr_training_paths/steps/assignments/progress.
-- Depends on 0001_core, 0111_finance_ops (salaries), 0112_team, 0113_personal. See features/hr-p2/WIRING.md.
--
-- Access model (keys seeded in seed/0207_hr_p2.sql)
--   A person always reads their own rows (pay, payslips, tools, personal, clock, training).
--   hr.records.manage (team/all): HR details, probation, title changes, tools, exits, editing others' personal details.
--   hr.pay.view (team/all) reads others' pay; hr.pay.manage (all) writes pay and payslips.
--   hr.personal.view (team/all) reads others' personal details.
--   Clock rows are 0113 attendance (its own RLS); the widget writes them through hr_clock_action().
--   perf.setup.manage: all = KPIs, cycles, paths; team = assign training to my team.
--   Client logins get nothing: every policy needs is_staff() or a staff permission.

-- ---------------------------------------------------------------- employment (0113 member_details) and title changes (0113 career_steps)
alter table public.member_details add column if not exists shift_start time not null default '09:00';
alter table public.member_details add column if not exists shift_end time not null default '18:00';
alter table public.member_details add column if not exists probation_decided_at timestamptz;

alter table public.career_steps add column if not exists old_title text;
alter table public.career_steps add column if not exists old_department_id uuid references public.departments (id) on delete set null;
alter table public.career_steps add column if not exists new_department_id uuid references public.departments (id) on delete set null;
alter table public.career_steps add column if not exists post_congrats boolean not null default false;
alter table public.career_steps add column if not exists congrats_posted_at timestamptz; -- set by the chat wire-in once the #general post is made
alter table public.career_steps add column if not exists created_by uuid references public.members (id) on delete set null;

-- ---------------------------------------------------------------- pay (0111 salaries: one row per pay change, monthly_amount = gross)
alter table public.salaries add column if not exists basic numeric(14,2) not null default 0;
alter table public.salaries add column if not exists house_rent numeric(14,2) not null default 0;
alter table public.salaries add column if not exists utilities numeric(14,2) not null default 0;
alter table public.salaries add column if not exists medical numeric(14,2) not null default 0;
alter table public.salaries add column if not exists other numeric(14,2) not null default 0;
alter table public.salaries add column if not exists reason text;

create table if not exists public.hr_payslips (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  month date not null check (extract(day from month) = 1),
  gross numeric(14,2) not null check (gross >= 0),
  deductions numeric(14,2) not null default 0 check (deductions >= 0),
  net numeric(14,2) generated always as (gross - deductions) stored,
  currency text not null default 'AED' check (currency in ('AED', 'USD', 'PKR')),
  notes text,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, month),
  constraint hr_payslips_net check (deductions <= gross)
);
drop trigger if exists hr_payslips_updated_at on public.hr_payslips;
create trigger hr_payslips_updated_at before update on public.hr_payslips
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- tools (no password column, ever)
create table if not exists public.hr_tool_access (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  tool text not null check (length(tool) between 1 and 80),
  login text,
  access_level text,
  granted_on date not null default current_date,
  granted_by uuid references public.members (id) on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hr_tool_access_member_idx on public.hr_tool_access (member_id);
drop trigger if exists hr_tool_access_updated_at on public.hr_tool_access;
create trigger hr_tool_access_updated_at before update on public.hr_tool_access
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- personal details + change log (no values)
create table if not exists public.hr_personal_details (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null unique references public.members (id) on delete cascade,
  date_of_birth date,
  id_type text not null default 'Emirates ID',
  id_number text,
  tax_number text,
  bank_name text,
  iban text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists hr_personal_details_updated_at on public.hr_personal_details;
create trigger hr_personal_details_updated_at before update on public.hr_personal_details
  for each row execute function public.set_updated_at();

create table if not exists public.hr_personal_changes (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  field text not null check (field in ('date_of_birth', 'id_type', 'id_number', 'tax_number', 'bank_name', 'iban')),
  changed_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists hr_personal_changes_member_idx on public.hr_personal_changes (member_id, created_at desc);
drop trigger if exists hr_personal_changes_updated_at on public.hr_personal_changes;
create trigger hr_personal_changes_updated_at before update on public.hr_personal_changes
  for each row execute function public.set_updated_at();

-- Logs which fields changed and who changed them. Never the old or new value.
create or replace function public.hr_personal_log()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare f text;
begin
  foreach f in array array['date_of_birth', 'id_type', 'id_number', 'tax_number', 'bank_name', 'iban'] loop
    if (tg_op = 'INSERT' and to_jsonb(new) ->> f is not null)
       or (tg_op = 'UPDATE' and (to_jsonb(new) ->> f) is distinct from (to_jsonb(old) ->> f)) then
      insert into public.hr_personal_changes (member_id, field, changed_by) values (new.member_id, f, auth.uid());
    end if;
  end loop;
  return new;
end;
$$;
drop trigger if exists hr_personal_details_log on public.hr_personal_details;
create trigger hr_personal_details_log after insert or update on public.hr_personal_details
  for each row execute function public.hr_personal_log();

-- ---------------------------------------------------------------- leaving
create table if not exists public.hr_exits (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  status text not null default 'started' check (status in ('started', 'cancelled', 'completed')),
  last_day date,
  reason text not null check (reason in ('Resigned', 'New opportunity', 'Relocation', 'End of contract', 'Let go')),
  notes text,
  started_by uuid references public.members (id) on delete set null,
  closed_by uuid references public.members (id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists hr_exits_one_open on public.hr_exits (member_id) where status = 'started';
drop trigger if exists hr_exits_updated_at on public.hr_exits;
create trigger hr_exits_updated_at before update on public.hr_exits
  for each row execute function public.set_updated_at();

create table if not exists public.hr_exit_tasks (
  id uuid primary key default gen_random_uuid(),
  exit_id uuid not null references public.hr_exits (id) on delete cascade,
  position smallint not null,
  label text not null,
  done_at timestamptz,
  done_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exit_id, position)
);
drop trigger if exists hr_exit_tasks_updated_at on public.hr_exit_tasks;
create trigger hr_exit_tasks_updated_at before update on public.hr_exit_tasks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- clock widget (0113 attendance)
-- Times come from the database clock, so nobody can type their own. Actions: 'in', 'break_start', 'break_end',
-- 'out'. Works on today's (Asia/Dubai) latest attendance session; clocking in again after clocking out reopens
-- it and counts the gap as a break.
create or replace function public.hr_clock_action(p_action text)
returns public.attendance
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'Asia/Dubai')::date;
  d public.attendance;
begin
  if not public.is_staff() then
    raise exception 'Only team members can clock in' using errcode = '42501';
  end if;
  select * into d from public.attendance
   where member_id = uid and (clock_in at time zone 'Asia/Dubai')::date = today
   order by clock_in desc limit 1
   for update;

  if p_action = 'in' then
    if d.id is null then
      insert into public.attendance (member_id, clock_in) values (uid, now()) returning * into d;
    elsif d.clock_out is not null then
      update public.attendance
         set break_minutes = break_minutes + floor(extract(epoch from now() - clock_out) / 60)::int, clock_out = null
       where id = d.id returning * into d;
    end if;
  elsif d.id is null or d.clock_out is not null then
    raise exception 'You are not clocked in' using errcode = 'P0001';
  elsif p_action = 'break_start' then
    update public.attendance set break_started_at = coalesce(break_started_at, now()) where id = d.id returning * into d;
  elsif p_action in ('break_end', 'out') then
    update public.attendance
       set break_minutes = break_minutes + coalesce(floor(extract(epoch from now() - break_started_at) / 60)::int, 0),
           break_started_at = null,
           clock_out = case when p_action = 'out' then now() else null end
     where id = d.id returning * into d;
  else
    raise exception 'Unknown clock action' using errcode = '22023';
  end if;
  return d;
end;
$$;
revoke execute on function public.hr_clock_action(text) from public, anon;
grant execute on function public.hr_clock_action(text) to authenticated;

-- ---------------------------------------------------------------- performance setup (0112 kpis / review_cycles)
-- review_cycles.quarter ('Q1 2027') is the cycle name.
alter table public.review_cycles add column if not exists opened_at timestamptz;
alter table public.review_cycles add column if not exists closed_at timestamptz;

-- ---------------------------------------------------------------- training paths
create table if not exists public.hr_training_paths (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists hr_training_paths_updated_at on public.hr_training_paths;
create trigger hr_training_paths_updated_at before update on public.hr_training_paths
  for each row execute function public.set_updated_at();

create table if not exists public.hr_training_steps (
  id uuid primary key default gen_random_uuid(),
  path_id uuid not null references public.hr_training_paths (id) on delete cascade,
  position smallint not null,
  kind text not null check (kind in ('course', 'video', 'reading', 'practice', 'certification')),
  title text not null,
  url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (path_id, position)
);
drop trigger if exists hr_training_steps_updated_at on public.hr_training_steps;
create trigger hr_training_steps_updated_at before update on public.hr_training_steps
  for each row execute function public.set_updated_at();

create table if not exists public.hr_training_assignments (
  id uuid primary key default gen_random_uuid(),
  path_id uuid not null references public.hr_training_paths (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  assigned_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (path_id, member_id)
);
create index if not exists hr_training_assignments_member_idx on public.hr_training_assignments (member_id);
drop trigger if exists hr_training_assignments_updated_at on public.hr_training_assignments;
create trigger hr_training_assignments_updated_at before update on public.hr_training_assignments
  for each row execute function public.set_updated_at();

create table if not exists public.hr_training_progress (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.hr_training_assignments (id) on delete cascade,
  step_id uuid not null references public.hr_training_steps (id) on delete cascade,
  done_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, step_id)
);
drop trigger if exists hr_training_progress_updated_at on public.hr_training_progress;
create trigger hr_training_progress_updated_at before update on public.hr_training_progress
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- RLS
alter table public.hr_payslips enable row level security;
alter table public.hr_tool_access enable row level security;
alter table public.hr_personal_details enable row level security;
alter table public.hr_personal_changes enable row level security;
alter table public.hr_exits enable row level security;
alter table public.hr_exit_tasks enable row level security;
alter table public.hr_training_paths enable row level security;
alter table public.hr_training_steps enable row level security;
alter table public.hr_training_assignments enable row level security;
alter table public.hr_training_progress enable row level security;

-- Scoped check for "this permission covers that member" (team = in_my_team, all = anyone). Staff only.
create or replace function public.hr_can(perm text, target uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_staff() and (
    public.has_perm(perm, 'all') or (public.has_perm(perm, 'team') and public.in_my_team(target))
  );
$$;
revoke execute on function public.hr_can(text, uuid) from public, anon;
grant execute on function public.hr_can(text, uuid) to authenticated, service_role;

-- Phase 1 tables reused above: their own policies stay; these add the Phase 2 HR keys alongside them.
-- member_details / career_steps: HR records managers for their scope.
drop policy if exists member_details_hr_records on public.member_details;
create policy member_details_hr_records on public.member_details for all to authenticated
  using (public.hr_can('hr.records.manage', member_id))
  with check (public.hr_can('hr.records.manage', member_id));
drop policy if exists career_steps_hr_records on public.career_steps;
create policy career_steps_hr_records on public.career_steps for insert to authenticated
  with check (public.hr_can('hr.records.manage', member_id));

-- member_details_guard (0113) lets only hr.manage change job details; HR records managers may too.
create or replace function public.member_details_guard()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.has_perm('hr.manage', 'all') or public.hr_can('hr.records.manage', new.member_id) then
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
    or new.job_duties is distinct from old.job_duties
    or new.shift_start is distinct from old.shift_start
    or new.shift_end is distinct from old.shift_end
    or new.probation_decided_at is distinct from old.probation_decided_at then
    raise exception 'Only HR can change job details';
  end if;
  return new;
end;
$$;

-- pay (salaries) and payslips: own, or pay viewers for their scope; only pay managers write
drop policy if exists salaries_hr_select on public.salaries;
create policy salaries_hr_select on public.salaries for select to authenticated using (
  (member_id = auth.uid() and public.is_staff()) or public.hr_can('hr.pay.view', member_id)
);
drop policy if exists salaries_hr_write on public.salaries;
create policy salaries_hr_write on public.salaries for all to authenticated
  using (public.has_perm('hr.pay.manage', 'all') and public.is_staff())
  with check (public.has_perm('hr.pay.manage', 'all') and public.is_staff());

drop policy if exists hr_payslips_select on public.hr_payslips;
create policy hr_payslips_select on public.hr_payslips for select to authenticated using (
  (member_id = auth.uid() and public.is_staff()) or public.hr_can('hr.pay.view', member_id)
);
drop policy if exists hr_payslips_write on public.hr_payslips;
create policy hr_payslips_write on public.hr_payslips for all to authenticated
  using (public.has_perm('hr.pay.manage', 'all') and public.is_staff())
  with check (public.has_perm('hr.pay.manage', 'all') and public.is_staff());

-- tools
drop policy if exists hr_tool_access_select on public.hr_tool_access;
create policy hr_tool_access_select on public.hr_tool_access for select to authenticated using (
  (member_id = auth.uid() and public.is_staff()) or public.hr_can('hr.records.manage', member_id)
);
drop policy if exists hr_tool_access_write on public.hr_tool_access;
create policy hr_tool_access_write on public.hr_tool_access for all to authenticated
  using (public.hr_can('hr.records.manage', member_id))
  with check (public.hr_can('hr.records.manage', member_id));

-- personal: own (read and edit), viewers read, HR edits. The change log is written by the trigger only.
drop policy if exists hr_personal_details_select on public.hr_personal_details;
create policy hr_personal_details_select on public.hr_personal_details for select to authenticated using (
  (member_id = auth.uid() and public.is_staff()) or public.hr_can('hr.personal.view', member_id)
);
drop policy if exists hr_personal_details_write on public.hr_personal_details;
create policy hr_personal_details_write on public.hr_personal_details for all to authenticated
  using ((member_id = auth.uid() and public.is_staff()) or public.has_perm('hr.records.manage', 'all'))
  with check ((member_id = auth.uid() and public.is_staff()) or public.has_perm('hr.records.manage', 'all'));

drop policy if exists hr_personal_changes_select on public.hr_personal_changes;
create policy hr_personal_changes_select on public.hr_personal_changes for select to authenticated using (
  (member_id = auth.uid() and public.is_staff()) or public.hr_can('hr.personal.view', member_id)
);

-- leaving: HR only
drop policy if exists hr_exits_all on public.hr_exits;
create policy hr_exits_all on public.hr_exits for all to authenticated
  using (public.hr_can('hr.records.manage', member_id))
  with check (public.hr_can('hr.records.manage', member_id));
drop policy if exists hr_exit_tasks_all on public.hr_exit_tasks;
create policy hr_exit_tasks_all on public.hr_exit_tasks for all to authenticated
  using (exists (select 1 from public.hr_exits e where e.id = exit_id and public.hr_can('hr.records.manage', e.member_id)))
  with check (exists (select 1 from public.hr_exits e where e.id = exit_id and public.hr_can('hr.records.manage', e.member_id)));

-- performance setup: every staff member reads; setup managers write
drop policy if exists kpis_perf_setup on public.kpis;
create policy kpis_perf_setup on public.kpis for all to authenticated
  using (public.has_perm('perf.setup.manage', 'all') and public.is_staff())
  with check (public.has_perm('perf.setup.manage', 'all') and public.is_staff());
drop policy if exists review_cycles_perf_setup on public.review_cycles;
create policy review_cycles_perf_setup on public.review_cycles for all to authenticated
  using (public.has_perm('perf.setup.manage', 'all') and public.is_staff())
  with check (public.has_perm('perf.setup.manage', 'all') and public.is_staff());

drop policy if exists hr_training_paths_select on public.hr_training_paths;
create policy hr_training_paths_select on public.hr_training_paths for select to authenticated using (public.is_staff());
drop policy if exists hr_training_paths_write on public.hr_training_paths;
create policy hr_training_paths_write on public.hr_training_paths for all to authenticated
  using (public.has_perm('perf.setup.manage', 'all') and public.is_staff())
  with check (public.has_perm('perf.setup.manage', 'all') and public.is_staff());

drop policy if exists hr_training_steps_select on public.hr_training_steps;
create policy hr_training_steps_select on public.hr_training_steps for select to authenticated using (public.is_staff());
drop policy if exists hr_training_steps_write on public.hr_training_steps;
create policy hr_training_steps_write on public.hr_training_steps for all to authenticated
  using (public.has_perm('perf.setup.manage', 'all') and public.is_staff())
  with check (public.has_perm('perf.setup.manage', 'all') and public.is_staff());

drop policy if exists hr_training_assignments_select on public.hr_training_assignments;
create policy hr_training_assignments_select on public.hr_training_assignments for select to authenticated using (
  (member_id = auth.uid() and public.is_staff()) or public.hr_can('perf.setup.manage', member_id)
);
drop policy if exists hr_training_assignments_write on public.hr_training_assignments;
create policy hr_training_assignments_write on public.hr_training_assignments for all to authenticated
  using (public.hr_can('perf.setup.manage', member_id))
  with check (public.hr_can('perf.setup.manage', member_id));

-- progress: the learner ticks their own steps; setup managers can too
drop policy if exists hr_training_progress_select on public.hr_training_progress;
create policy hr_training_progress_select on public.hr_training_progress for select to authenticated using (
  exists (select 1 from public.hr_training_assignments a where a.id = assignment_id
          and ((a.member_id = auth.uid() and public.is_staff()) or public.hr_can('perf.setup.manage', a.member_id)))
);
drop policy if exists hr_training_progress_write on public.hr_training_progress;
create policy hr_training_progress_write on public.hr_training_progress for all to authenticated
  using (exists (select 1 from public.hr_training_assignments a where a.id = assignment_id
          and ((a.member_id = auth.uid() and public.is_staff()) or public.hr_can('perf.setup.manage', a.member_id))))
  with check (exists (select 1 from public.hr_training_assignments a
          join public.hr_training_steps s on s.id = step_id and s.path_id = a.path_id
          where a.id = assignment_id
          and ((a.member_id = auth.uid() and public.is_staff()) or public.hr_can('perf.setup.manage', a.member_id))));

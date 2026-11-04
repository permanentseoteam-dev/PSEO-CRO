-- 0207_hr_p2: Phase 2 profile, HR and performance extras.
--   Profile: hr_employment (HR details, shift, probation), hr_title_changes, hr_pay_records (salary components +
--   history), hr_payslips, hr_tool_access (never passwords), hr_personal_details + hr_personal_changes (log without
--   values), hr_exits + hr_exit_tasks (Leaving tab), hr_clock_days + hr_clock_action() (clock widget).
--   Performance: hr_kpis (Setup), hr_review_cycles (open/close), hr_training_paths/steps/assignments/progress.
-- Depends only on 0001_core (members, departments, helpers). Table names carry an hr_ prefix so they never collide
-- with Phase 1 0112_team / 0113_personal (kpis, review_cycles, training, attendance). See features/hr-p2/WIRING.md.
--
-- Access model (keys seeded in seed/0207_hr_p2.sql)
--   A person always reads their own rows (pay, payslips, tools, personal, clock, training).
--   hr.records.manage (team/all): HR details, probation, title changes, tools, exits, editing others' personal details.
--   hr.pay.view (team/all) reads others' pay; hr.pay.manage (all) writes pay and payslips.
--   hr.personal.view (team/all) reads others' personal details.
--   hr.attendance.view (team/all) reads others' clock days. Clock rows are written only by hr_clock_action().
--   perf.setup.manage: all = KPIs, cycles, paths; team = assign training to my team.
--   Client logins get nothing: every policy needs is_staff() or a staff permission.

-- ---------------------------------------------------------------- employment (HR details + probation)
create table public.hr_employment (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null unique references public.members (id) on delete cascade,
  contract text not null default 'full_time' check (contract in ('full_time', 'part_time', 'contractor')),
  joined_on date,
  shift_start time not null default '09:00',
  shift_end time not null default '18:00',
  location text,
  probation_status text not null default 'on_probation' check (probation_status in ('on_probation', 'confirmed', 'ended')),
  probation_start date,
  probation_end date,
  probation_decided_by uuid references public.members (id) on delete set null,
  probation_decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_employment_shift check (shift_end > shift_start),
  constraint hr_employment_probation check (probation_end is null or probation_start is null or probation_end >= probation_start)
);
create trigger hr_employment_updated_at before update on public.hr_employment
  for each row execute function public.set_updated_at();

create table public.hr_title_changes (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  kind text not null check (kind in ('promotion', 'transfer', 'title')),
  effective_on date not null,
  old_title text,
  new_title text not null,
  old_department_id uuid references public.departments (id) on delete set null,
  new_department_id uuid references public.departments (id) on delete set null,
  post_congrats boolean not null default false,
  congrats_posted_at timestamptz, -- set by the chat wire-in once the #general post is made
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index hr_title_changes_member_idx on public.hr_title_changes (member_id, effective_on desc);
create trigger hr_title_changes_updated_at before update on public.hr_title_changes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- pay
-- One row per pay change. The current salary is the latest row with effective_from <= today; the rest is history.
create table public.hr_pay_records (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  effective_from date not null,
  basic numeric(14,2) not null default 0 check (basic >= 0),
  house_rent numeric(14,2) not null default 0 check (house_rent >= 0),
  utilities numeric(14,2) not null default 0 check (utilities >= 0),
  medical numeric(14,2) not null default 0 check (medical >= 0),
  other numeric(14,2) not null default 0 check (other >= 0),
  gross numeric(14,2) generated always as (basic + house_rent + utilities + medical + other) stored,
  currency text not null default 'AED' check (currency in ('AED', 'USD', 'PKR')),
  reason text,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, effective_from)
);
create trigger hr_pay_records_updated_at before update on public.hr_pay_records
  for each row execute function public.set_updated_at();

create table public.hr_payslips (
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
create trigger hr_payslips_updated_at before update on public.hr_payslips
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- tools (no password column, ever)
create table public.hr_tool_access (
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
create index hr_tool_access_member_idx on public.hr_tool_access (member_id);
create trigger hr_tool_access_updated_at before update on public.hr_tool_access
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- personal details + change log (no values)
create table public.hr_personal_details (
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
create trigger hr_personal_details_updated_at before update on public.hr_personal_details
  for each row execute function public.set_updated_at();

create table public.hr_personal_changes (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  field text not null check (field in ('date_of_birth', 'id_type', 'id_number', 'tax_number', 'bank_name', 'iban')),
  changed_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index hr_personal_changes_member_idx on public.hr_personal_changes (member_id, created_at desc);
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
create trigger hr_personal_details_log after insert or update on public.hr_personal_details
  for each row execute function public.hr_personal_log();

-- ---------------------------------------------------------------- leaving
create table public.hr_exits (
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
create unique index hr_exits_one_open on public.hr_exits (member_id) where status = 'started';
create trigger hr_exits_updated_at before update on public.hr_exits
  for each row execute function public.set_updated_at();

create table public.hr_exit_tasks (
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
create trigger hr_exit_tasks_updated_at before update on public.hr_exit_tasks
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- clock widget
create table public.hr_clock_days (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  work_date date not null,
  clock_in_at timestamptz not null,
  clock_out_at timestamptz,
  break_started_at timestamptz,
  break_minutes integer not null default 0 check (break_minutes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, work_date),
  constraint hr_clock_days_order check (clock_out_at is null or clock_out_at >= clock_in_at)
);
create trigger hr_clock_days_updated_at before update on public.hr_clock_days
  for each row execute function public.set_updated_at();

-- The only way to write clock rows: times come from the database clock, so nobody can type their own.
-- Actions: 'in', 'break_start', 'break_end', 'out'. Clocking in again after clocking out reopens the day and
-- counts the gap as a break.
create or replace function public.hr_clock_action(p_action text)
returns public.hr_clock_days
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  today date := (now() at time zone 'Asia/Dubai')::date;
  d public.hr_clock_days;
begin
  if not public.is_staff() then
    raise exception 'Only team members can clock in' using errcode = '42501';
  end if;
  select * into d from public.hr_clock_days where member_id = uid and work_date = today for update;

  if p_action = 'in' then
    if d.id is null then
      insert into public.hr_clock_days (member_id, work_date, clock_in_at) values (uid, today, now()) returning * into d;
    elsif d.clock_out_at is not null then
      update public.hr_clock_days
         set break_minutes = break_minutes + floor(extract(epoch from now() - clock_out_at) / 60)::int, clock_out_at = null
       where id = d.id returning * into d;
    end if;
  elsif d.id is null or d.clock_out_at is not null then
    raise exception 'You are not clocked in' using errcode = 'P0001';
  elsif p_action = 'break_start' then
    update public.hr_clock_days set break_started_at = coalesce(break_started_at, now()) where id = d.id returning * into d;
  elsif p_action in ('break_end', 'out') then
    update public.hr_clock_days
       set break_minutes = break_minutes + coalesce(floor(extract(epoch from now() - break_started_at) / 60)::int, 0),
           break_started_at = null,
           clock_out_at = case when p_action = 'out' then now() else null end
     where id = d.id returning * into d;
  else
    raise exception 'Unknown clock action' using errcode = '22023';
  end if;
  return d;
end;
$$;
revoke execute on function public.hr_clock_action(text) from public, anon;
grant execute on function public.hr_clock_action(text) to authenticated;

-- ---------------------------------------------------------------- performance setup
create table public.hr_kpis (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  source text not null default 'manual' check (source in ('portal', 'manual')),
  weight integer not null check (weight between 1 and 100),
  direction text not null default 'higher' check (direction in ('higher', 'lower')),
  department_id uuid references public.departments (id) on delete cascade, -- null = everyone
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index hr_kpis_department_idx on public.hr_kpis (department_id);
create trigger hr_kpis_updated_at before update on public.hr_kpis
  for each row execute function public.set_updated_at();

create table public.hr_review_cycles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  self_due date not null,
  manager_due date not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  opened_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hr_review_cycles_dates check (manager_due >= self_due)
);
create trigger hr_review_cycles_updated_at before update on public.hr_review_cycles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- training paths
create table public.hr_training_paths (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger hr_training_paths_updated_at before update on public.hr_training_paths
  for each row execute function public.set_updated_at();

create table public.hr_training_steps (
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
create trigger hr_training_steps_updated_at before update on public.hr_training_steps
  for each row execute function public.set_updated_at();

create table public.hr_training_assignments (
  id uuid primary key default gen_random_uuid(),
  path_id uuid not null references public.hr_training_paths (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  assigned_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (path_id, member_id)
);
create index hr_training_assignments_member_idx on public.hr_training_assignments (member_id);
create trigger hr_training_assignments_updated_at before update on public.hr_training_assignments
  for each row execute function public.set_updated_at();

create table public.hr_training_progress (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.hr_training_assignments (id) on delete cascade,
  step_id uuid not null references public.hr_training_steps (id) on delete cascade,
  done_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, step_id)
);
create trigger hr_training_progress_updated_at before update on public.hr_training_progress
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- RLS
alter table public.hr_employment enable row level security;
alter table public.hr_title_changes enable row level security;
alter table public.hr_pay_records enable row level security;
alter table public.hr_payslips enable row level security;
alter table public.hr_tool_access enable row level security;
alter table public.hr_personal_details enable row level security;
alter table public.hr_personal_changes enable row level security;
alter table public.hr_exits enable row level security;
alter table public.hr_exit_tasks enable row level security;
alter table public.hr_clock_days enable row level security;
alter table public.hr_kpis enable row level security;
alter table public.hr_review_cycles enable row level security;
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

-- employment: own row, or HR for their scope
create policy hr_employment_select on public.hr_employment for select to authenticated using (
  (member_id = auth.uid() and public.is_staff()) or public.hr_can('hr.records.manage', member_id)
);
create policy hr_employment_write on public.hr_employment for all to authenticated
  using (public.hr_can('hr.records.manage', member_id))
  with check (public.hr_can('hr.records.manage', member_id));

create policy hr_title_changes_select on public.hr_title_changes for select to authenticated using (
  (member_id = auth.uid() and public.is_staff()) or public.hr_can('hr.records.manage', member_id)
);
create policy hr_title_changes_insert on public.hr_title_changes for insert to authenticated
  with check (public.hr_can('hr.records.manage', member_id));

-- pay and payslips: own, or pay viewers for their scope; only pay managers write
create policy hr_pay_records_select on public.hr_pay_records for select to authenticated using (
  (member_id = auth.uid() and public.is_staff()) or public.hr_can('hr.pay.view', member_id)
);
create policy hr_pay_records_write on public.hr_pay_records for all to authenticated
  using (public.has_perm('hr.pay.manage', 'all') and public.is_staff())
  with check (public.has_perm('hr.pay.manage', 'all') and public.is_staff());

create policy hr_payslips_select on public.hr_payslips for select to authenticated using (
  (member_id = auth.uid() and public.is_staff()) or public.hr_can('hr.pay.view', member_id)
);
create policy hr_payslips_write on public.hr_payslips for all to authenticated
  using (public.has_perm('hr.pay.manage', 'all') and public.is_staff())
  with check (public.has_perm('hr.pay.manage', 'all') and public.is_staff());

-- tools
create policy hr_tool_access_select on public.hr_tool_access for select to authenticated using (
  (member_id = auth.uid() and public.is_staff()) or public.hr_can('hr.records.manage', member_id)
);
create policy hr_tool_access_write on public.hr_tool_access for all to authenticated
  using (public.hr_can('hr.records.manage', member_id))
  with check (public.hr_can('hr.records.manage', member_id));

-- personal: own (read and edit), viewers read, HR edits. The change log is written by the trigger only.
create policy hr_personal_details_select on public.hr_personal_details for select to authenticated using (
  (member_id = auth.uid() and public.is_staff()) or public.hr_can('hr.personal.view', member_id)
);
create policy hr_personal_details_write on public.hr_personal_details for all to authenticated
  using ((member_id = auth.uid() and public.is_staff()) or public.has_perm('hr.records.manage', 'all'))
  with check ((member_id = auth.uid() and public.is_staff()) or public.has_perm('hr.records.manage', 'all'));

create policy hr_personal_changes_select on public.hr_personal_changes for select to authenticated using (
  (member_id = auth.uid() and public.is_staff()) or public.hr_can('hr.personal.view', member_id)
);

-- leaving: HR only
create policy hr_exits_all on public.hr_exits for all to authenticated
  using (public.hr_can('hr.records.manage', member_id))
  with check (public.hr_can('hr.records.manage', member_id));
create policy hr_exit_tasks_all on public.hr_exit_tasks for all to authenticated
  using (exists (select 1 from public.hr_exits e where e.id = exit_id and public.hr_can('hr.records.manage', e.member_id)))
  with check (exists (select 1 from public.hr_exits e where e.id = exit_id and public.hr_can('hr.records.manage', e.member_id)));

-- clock: read own or by attendance scope; writes only through hr_clock_action()
create policy hr_clock_days_select on public.hr_clock_days for select to authenticated using (
  (member_id = auth.uid() and public.is_staff()) or public.hr_can('hr.attendance.view', member_id)
);

-- performance setup: every staff member reads; setup managers write
create policy hr_kpis_select on public.hr_kpis for select to authenticated using (public.is_staff());
create policy hr_kpis_write on public.hr_kpis for all to authenticated
  using (public.has_perm('perf.setup.manage', 'all') and public.is_staff())
  with check (public.has_perm('perf.setup.manage', 'all') and public.is_staff());

create policy hr_review_cycles_select on public.hr_review_cycles for select to authenticated using (public.is_staff());
create policy hr_review_cycles_write on public.hr_review_cycles for all to authenticated
  using (public.has_perm('perf.setup.manage', 'all') and public.is_staff())
  with check (public.has_perm('perf.setup.manage', 'all') and public.is_staff());

create policy hr_training_paths_select on public.hr_training_paths for select to authenticated using (public.is_staff());
create policy hr_training_paths_write on public.hr_training_paths for all to authenticated
  using (public.has_perm('perf.setup.manage', 'all') and public.is_staff())
  with check (public.has_perm('perf.setup.manage', 'all') and public.is_staff());

create policy hr_training_steps_select on public.hr_training_steps for select to authenticated using (public.is_staff());
create policy hr_training_steps_write on public.hr_training_steps for all to authenticated
  using (public.has_perm('perf.setup.manage', 'all') and public.is_staff())
  with check (public.has_perm('perf.setup.manage', 'all') and public.is_staff());

create policy hr_training_assignments_select on public.hr_training_assignments for select to authenticated using (
  (member_id = auth.uid() and public.is_staff()) or public.hr_can('perf.setup.manage', member_id)
);
create policy hr_training_assignments_write on public.hr_training_assignments for all to authenticated
  using (public.hr_can('perf.setup.manage', member_id))
  with check (public.hr_can('perf.setup.manage', member_id));

-- progress: the learner ticks their own steps; setup managers can too
create policy hr_training_progress_select on public.hr_training_progress for select to authenticated using (
  exists (select 1 from public.hr_training_assignments a where a.id = assignment_id
          and ((a.member_id = auth.uid() and public.is_staff()) or public.hr_can('perf.setup.manage', a.member_id)))
);
create policy hr_training_progress_write on public.hr_training_progress for all to authenticated
  using (exists (select 1 from public.hr_training_assignments a where a.id = assignment_id
          and ((a.member_id = auth.uid() and public.is_staff()) or public.hr_can('perf.setup.manage', a.member_id))))
  with check (exists (select 1 from public.hr_training_assignments a
          join public.hr_training_steps s on s.id = step_id and s.path_id = a.path_id
          where a.id = assignment_id
          and ((a.member_id = auth.uid() and public.is_staff()) or public.hr_can('perf.setup.manage', a.member_id))));

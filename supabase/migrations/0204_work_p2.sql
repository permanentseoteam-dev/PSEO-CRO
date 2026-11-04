-- 0204_work_p2: Phase 2 work extras.
--   Workload view: member_capacity, workload_settings, workload_alerts.
--   Recurring tab: reuses 0107 recurring_rules (adds description, priority, last_run), recurring_ticket_runs,
--     recurring_next_run(), run_recurring_rules(), pg_cron job.
--   Ticket page: ticket_blockers (dependencies), ticket_scope_flags. Co-assignees reuse 0106 tickets.co_assignee_ids;
--     the client card reuses 0106 tickets.client_visible / client_title and adds client_details, client_needs_approval,
--     client_file_ids to tickets.
--   Watchers use ticket_watchers from 0106_tickets. The Quality report extras only read 0107 tables (no new tables).
-- Depends on 0001_core (members, helpers), 0106_tickets (tickets), 0107_work (projects, templates), 0108_clients (clients).
-- Phase 1 column names used here (from lib/modules/home/queries.ts):
--   tickets(id, key, title, description, status, priority, assignee_id, reporter_id, project_id, due_date)
--   projects(id, name, client_id), clients(id, name)
--
-- Access model
--   Ticket-scoped tables: staff who can see the ticket (the subquery on public.tickets runs under the caller's
--   tickets RLS, so 0106's rules decide). Client logins only read their own client's client card when it is shown.
--   Workload: work.workload.view (own/team/all) to read alerts, work.workload.manage to edit capacity, settings, alerts.
--   Recurring rules: any staff member reads; work.recurring.manage writes (own = rules assigned to or made by me,
--   team = my team's rules, all = every rule). Runs are written only by run_recurring_rules() (security definer).

-- ---------------------------------------------------------------- workload
create table if not exists public.member_capacity (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null unique references public.members (id) on delete cascade,
  weekly_hours numeric(5,1) not null default 38 check (weekly_hours >= 0 and weekly_hours <= 120),
  workdays smallint[] not null default '{1,2,3,4,5}' check (workdays <@ '{1,2,3,4,5,6,7}'::smallint[]),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists member_capacity_updated_at on public.member_capacity;
create trigger member_capacity_updated_at before update on public.member_capacity
  for each row execute function public.set_updated_at();

-- One row (singleton = true) holds the alert thresholds for the whole workspace.
create table if not exists public.workload_settings (
  id uuid primary key default gen_random_uuid(),
  singleton boolean not null default true unique check (singleton),
  overloaded_pct integer not null default 110 check (overloaded_pct between 50 and 300),
  overdue_count integer not null default 2 check (overdue_count between 0 and 50),
  has_room_pct integer not null default 60 check (has_room_pct between 0 and 100),
  default_estimate_min integer not null default 60 check (default_estimate_min between 0 and 2400),
  updated_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists workload_settings_updated_at on public.workload_settings;
create trigger workload_settings_updated_at before update on public.workload_settings
  for each row execute function public.set_updated_at();

-- Alerts are computed on the fly; a row here means someone marked one handled (and maybe moved a ticket).
-- Undo deletes the row (and moves the ticket back to moved_from).
create table if not exists public.workload_alerts (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  kind text not null check (kind in ('overloaded', 'overdue', 'has_room', 'unestimated')),
  status text not null default 'handled' check (status in ('handled')),
  moved_ticket_id uuid references public.tickets (id) on delete set null,
  moved_from uuid references public.members (id) on delete set null,
  moved_to uuid references public.members (id) on delete set null,
  handled_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (member_id, week_start, kind)
);
create index if not exists workload_alerts_week_idx on public.workload_alerts (week_start);
drop trigger if exists workload_alerts_updated_at on public.workload_alerts;
create trigger workload_alerts_updated_at before update on public.workload_alerts
  for each row execute function public.set_updated_at();

alter table public.member_capacity enable row level security;
alter table public.workload_settings enable row level security;
alter table public.workload_alerts enable row level security;

drop policy if exists member_capacity_select on public.member_capacity;
create policy member_capacity_select on public.member_capacity for select to authenticated using (public.is_staff());
drop policy if exists member_capacity_write on public.member_capacity;
create policy member_capacity_write on public.member_capacity for all to authenticated
  using (public.has_perm('work.workload.manage', 'all') or (public.has_perm('work.workload.manage', 'team') and public.in_my_team(member_id)))
  with check (public.has_perm('work.workload.manage', 'all') or (public.has_perm('work.workload.manage', 'team') and public.in_my_team(member_id)));

drop policy if exists workload_settings_select on public.workload_settings;
create policy workload_settings_select on public.workload_settings for select to authenticated using (public.is_staff());
drop policy if exists workload_settings_write on public.workload_settings;
create policy workload_settings_write on public.workload_settings for all to authenticated
  using (public.has_perm('work.workload.manage', 'all'))
  with check (public.has_perm('work.workload.manage', 'all'));

drop policy if exists workload_alerts_select on public.workload_alerts;
create policy workload_alerts_select on public.workload_alerts for select to authenticated using (
  public.has_perm('work.workload.view', 'all')
  or (public.has_perm('work.workload.view', 'team') and public.in_my_team(member_id))
  or (public.has_perm('work.workload.view', 'own') and member_id = auth.uid() and public.is_staff())
);
drop policy if exists workload_alerts_write on public.workload_alerts;
create policy workload_alerts_write on public.workload_alerts for all to authenticated
  using (public.has_perm('work.workload.manage', 'all') or (public.has_perm('work.workload.manage', 'team') and public.in_my_team(member_id)))
  with check (public.has_perm('work.workload.manage', 'all') or (public.has_perm('work.workload.manage', 'team') and public.in_my_team(member_id)));

-- ---------------------------------------------------------------- recurring rules
-- 0107_work already owns public.recurring_rules (one `day` column: weekly ISO weekday or monthly day; `start_date`).
-- Phase 2 only adds the columns it needs.
alter table public.recurring_rules add column if not exists description text;
alter table public.recurring_rules add column if not exists priority text not null default 'normal';
alter table public.recurring_rules add column if not exists last_run date;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'recurring_rules_priority_check') then
    alter table public.recurring_rules add constraint recurring_rules_priority_check
      check (priority in ('urgent', 'high', 'normal', 'low'));
  end if;
end;
$$;

-- One row per rule per run date: keeps the job idempotent if it runs twice.
create table if not exists public.recurring_ticket_runs (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.recurring_rules (id) on delete cascade,
  run_on date not null,
  ticket_id uuid references public.tickets (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rule_id, run_on)
);
drop trigger if exists recurring_ticket_runs_updated_at on public.recurring_ticket_runs;
create trigger recurring_ticket_runs_updated_at before update on public.recurring_ticket_runs
  for each row execute function public.set_updated_at();

alter table public.recurring_ticket_runs enable row level security;

-- 0107 policies (tickets.manage) stay; this adds the Phase 2 work.recurring.manage path alongside them.
drop policy if exists recurring_rules_manage on public.recurring_rules;
create policy recurring_rules_manage on public.recurring_rules for all to authenticated
  using (
    public.has_perm('work.recurring.manage', 'all')
    or (public.has_perm('work.recurring.manage', 'team') and (public.in_my_team(assignee_id) or created_by = auth.uid()))
    or (public.has_perm('work.recurring.manage', 'own') and public.is_staff() and (assignee_id = auth.uid() or created_by = auth.uid()))
  )
  with check (
    public.has_perm('work.recurring.manage', 'all')
    or (public.has_perm('work.recurring.manage', 'team') and (assignee_id is null or public.in_my_team(assignee_id)))
    or (public.has_perm('work.recurring.manage', 'own') and public.is_staff() and (assignee_id = auth.uid() or (assignee_id is null and created_by = auth.uid())))
  );
drop policy if exists recurring_runs_select on public.recurring_ticket_runs;
create policy recurring_runs_select on public.recurring_ticket_runs for select to authenticated using (public.is_staff());

-- First date on or after `from_date` the rule fires. Mirrors nextRun() in features/work-p2/logic.ts.
create or replace function public.recurring_next_run(freq text, wday smallint, mday smallint, from_date date)
returns date
language sql immutable
set search_path = ''
as $$
  select case freq
    when 'daily' then from_date
    when 'weekdays' then case when extract(isodow from from_date) <= 5 then from_date
                              else from_date + (8 - extract(isodow from from_date))::int end
    when 'weekly' then from_date + ((coalesce(wday, 1) - extract(isodow from from_date)::int + 7) % 7)
    when 'monthly' then case
      when date_trunc('month', from_date)::date + (least(greatest(coalesce(mday, 1), 1), 28) - 1) >= from_date
        then date_trunc('month', from_date)::date + (least(greatest(coalesce(mday, 1), 1), 28) - 1)
      else (date_trunc('month', from_date) + interval '1 month')::date + (least(greatest(coalesce(mday, 1), 1), 28) - 1)
    end
  end;
$$;

-- Creates one ticket per due rule (a missed day is not back-filled), records the run, moves next_run on.
-- Title tokens: {client}, {project}, {month} ("November 2026"), {date} ("Nov 4"). Mirrors renderTitle().
-- Ticket key and defaults come from 0106_tickets (its insert trigger / defaults).
create or replace function public.run_recurring_rules(today date default current_date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  run_date date;
  new_ticket uuid;
  v_title text;
  made integer := 0;
begin
  for r in
    select rr.*, p.name as project_name, c.name as client_name
    from public.recurring_rules rr
    join public.projects p on p.id = rr.project_id
    left join public.clients c on c.id = p.client_id
    where not rr.paused and rr.next_run is not null and rr.next_run <= today
      and (rr.paused_until is null or rr.paused_until < today)
    for update of rr skip locked
  loop
    run_date := r.next_run;
    if not exists (select 1 from public.recurring_ticket_runs where rule_id = r.id and run_on = run_date) then
      v_title := replace(replace(replace(replace(r.title_pattern,
        '{client}', coalesce(r.client_name, r.project_name)),
        '{project}', r.project_name),
        '{month}', to_char(run_date, 'FMMonth YYYY')),
        '{date}', to_char(run_date, 'Mon FMDD'));
      insert into public.tickets (project_id, title, description, priority, status, assignee_id, reporter_id, due_date)
      values (r.project_id, btrim(v_title), r.description, r.priority, 'todo', r.assignee_id, r.created_by, run_date + r.due_offset_days)
      returning id into new_ticket;
      insert into public.recurring_ticket_runs (rule_id, run_on, ticket_id) values (r.id, run_date, new_ticket);
      made := made + 1;
    end if;
    update public.recurring_rules
      set last_run = run_date,
          next_run = public.recurring_next_run(r.frequency, r.day::smallint, r.day::smallint, greatest(run_date, today) + 1)
      where id = r.id;
  end loop;
  return made;
end;
$$;
revoke all on function public.run_recurring_rules(date) from public, anon, authenticated;
grant execute on function public.run_recurring_rules(date) to service_role;

-- Daily at 00:05 UTC. Skipped (with a notice) where pg_cron isn't available, e.g. a bare local Postgres.
do $cron$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('work-p2-recurring-tickets', '5 0 * * *', 'select public.run_recurring_rules()');
exception when others then
  raise notice 'pg_cron not available, recurring tickets job not scheduled: %', sqlerrm;
end;
$cron$;

-- ---------------------------------------------------------------- ticket extras
-- "ticket_id is blocked by blocked_by_id".
create table if not exists public.ticket_blockers (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  blocked_by_id uuid not null references public.tickets (id) on delete cascade,
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ticket_id, blocked_by_id),
  check (ticket_id <> blocked_by_id)
);
create index if not exists ticket_blockers_blocked_by_idx on public.ticket_blockers (blocked_by_id);
drop trigger if exists ticket_blockers_updated_at on public.ticket_blockers;
create trigger ticket_blockers_updated_at before update on public.ticket_blockers
  for each row execute function public.set_updated_at();

-- Client card fields on the ticket itself (0106 already has client_visible and client_title).
alter table public.tickets add column if not exists client_details text;
alter table public.tickets add column if not exists client_needs_approval boolean not null default false;
alter table public.tickets add column if not exists client_file_ids uuid[] not null default '{}'; -- attachments(id) from 0106
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tickets_client_details_len') then
    alter table public.tickets add constraint tickets_client_details_len check (char_length(client_details) <= 4000);
  end if;
end;
$$;

-- Scope decision against the client's terms (0108 client_terms in/out of scope). Staff only.
create table if not exists public.ticket_scope_flags (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null unique references public.tickets (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  status text not null check (status in ('in_scope', 'out_of_scope', 'unsure')),
  matched_term text,
  reason text check (char_length(reason) <= 1000),
  flagged_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ticket_scope_flags_client_idx on public.ticket_scope_flags (client_id, status);
drop trigger if exists ticket_scope_flags_updated_at on public.ticket_scope_flags;
create trigger ticket_scope_flags_updated_at before update on public.ticket_scope_flags
  for each row execute function public.set_updated_at();

alter table public.ticket_blockers enable row level security;
alter table public.ticket_scope_flags enable row level security;

-- Staff: whoever can see the ticket (tickets RLS from 0106 applies inside the subquery).
drop policy if exists ticket_blockers_staff on public.ticket_blockers;
create policy ticket_blockers_staff on public.ticket_blockers for all to authenticated
  using (public.is_staff() and exists (select 1 from public.tickets t where t.id = ticket_id))
  with check (public.is_staff()
    and exists (select 1 from public.tickets t where t.id = ticket_id)
    and exists (select 1 from public.tickets t where t.id = blocked_by_id));

drop policy if exists ticket_scope_flags_staff on public.ticket_scope_flags;
create policy ticket_scope_flags_staff on public.ticket_scope_flags for all to authenticated
  using (public.is_staff() and exists (select 1 from public.tickets t where t.id = ticket_id))
  with check (public.is_staff() and exists (select 1 from public.tickets t where t.id = ticket_id));

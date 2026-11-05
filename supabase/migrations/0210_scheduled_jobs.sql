-- 0210_scheduled_jobs: every scheduled job of the portal, run by pg_cron. All times are Asia/Dubai (UTC+4, no DST);
-- pg_cron runs in UTC, so each schedule below is the Dubai time minus 4 hours.
--
-- Two kinds of job:
--   database jobs  pure SQL, run inside Postgres through private.run_logged(), which writes a job_runs row.
--   app jobs       need app code (email, integration adapters, working-hours maths). pg_cron calls
--                  private.call_app(job), which POSTs to <app_url>/api/cron/<job> through pg_net with
--                  "Authorization: Bearer <cron_secret>". The route handler writes the job_runs row.
--
-- The lead fills in private.app_config once (see features/jobs/WIRING.md):
--   update private.app_config set value = 'https://<your-app>.vercel.app' where key = 'app_url';
--   update private.app_config set value = '<same value as the CRON_SECRET env var>' where key = 'cron_secret';
-- Until both are set, app jobs log a 'skipped' run and call nothing.
--
-- Idempotent: safe to run again. Each job is unscheduled by name before it is scheduled.
-- Depends on 0101 (notifications), 0106 (timers, time_entries), 0109 (sla_waits), 0111 + 0209 (reminders,
-- sync_payment_reminders), 0113 + 0207 (career_steps), 0201 (monthly_reports), 0204 (run_recurring_rules),
-- 0205 (huddles).

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- ---------------------------------------------------------------- private schema + app config
-- Not exposed through the API (only public is), and closed to anon and authenticated.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.app_config (
  key text primary key,
  value text not null default '',
  note text,
  updated_at timestamptz not null default now()
);
alter table private.app_config enable row level security; -- no policies: only the owner (postgres) reads it
revoke all on table private.app_config from public, anon, authenticated;

insert into private.app_config (key, note) values
  ('app_url', 'Base URL of the deployed app, no trailing slash, e.g. https://portal.example.com'),
  ('cron_secret', 'Same value as the CRON_SECRET env var of the app')
on conflict (key) do nothing;

-- ---------------------------------------------------------------- job_runs
create table if not exists public.job_runs (
  id uuid primary key default gen_random_uuid(),
  job text not null check (char_length(job) between 1 and 60),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('ok', 'skipped', 'error')),
  detail text check (char_length(detail) <= 2000),
  created_at timestamptz not null default now()
);
create index if not exists job_runs_job_idx on public.job_runs (job, started_at desc);
create index if not exists job_runs_started_idx on public.job_runs (started_at);

alter table public.job_runs enable row level security;
-- Admins read; nobody writes through the API (jobs write as postgres or the service role).
drop policy if exists job_runs_select on public.job_runs;
create policy job_runs_select on public.job_runs for select to authenticated
  using (public.is_staff() and public.has_perm('admin.access.manage', 'all'));

-- Latest run of each job (RLS of job_runs applies: security_invoker).
create or replace view public.job_last_runs with (security_invoker = true) as
  select distinct on (job) id, job, started_at, finished_at, status, detail
  from public.job_runs
  order by job, started_at desc;

-- ---------------------------------------------------------------- columns the jobs mark
-- career_steps: when a future-dated title change was applied to members (null = not by the job).
alter table public.career_steps add column if not exists applied_at timestamptz;
-- sla_waits: when an open wait passed its target and 2x its target (set once, by the SLA job).
alter table public.sla_waits add column if not exists late_at timestamptz;
alter table public.sla_waits add column if not exists late2x_at timestamptz;
-- monthly_reports: an approved auto-send report was due but no email provider is set; send it once one is.
alter table public.monthly_reports add column if not exists send_pending_at timestamptz;

-- ---------------------------------------------------------------- helpers
-- Active staff whose scope for `perm` is at least `min_scope` (super admins always). Used by app jobs to pick
-- notification recipients; mirrors perm_scope() in 0001 for an arbitrary member.
create or replace function public.job_perm_holders(perm text, min_scope text default 'own')
returns setof uuid
language sql stable security definer
set search_path = ''
as $$
  select m.id
  from public.members m
  where m.kind = 'staff' and m.status = 'active'
    and (
      exists (select 1 from public.member_roles mr where mr.member_id = m.id and mr.role = 'super_admin')
      or coalesce(
        (select o.scope from public.member_overrides o where o.member_id = m.id and o.perm_key = perm),
        (select max(rp.scope) from public.member_roles mr join public.role_permissions rp on rp.role = mr.role
          where mr.member_id = m.id and rp.perm_key = perm),
        'none'::public.scope_level
      ) >= greatest(min_scope::public.scope_level, 'own'::public.scope_level)
    );
$$;
revoke execute on function public.job_perm_holders(text, text) from public, anon, authenticated;
grant execute on function public.job_perm_holders(text, text) to service_role;

-- Runs one database job and records the outcome. A failure rolls back that job's work only.
create or replace function private.run_logged(p_job text, p_sql text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_start timestamptz := clock_timestamp();
  v_out text;
begin
  begin
    execute p_sql into v_out;
    insert into public.job_runs (job, started_at, finished_at, status, detail)
    values (p_job, v_start, clock_timestamp(), 'ok', left(v_out, 2000));
  exception when others then
    insert into public.job_runs (job, started_at, finished_at, status, detail)
    values (p_job, v_start, clock_timestamp(), 'error', left(sqlerrm, 2000));
  end;
end;
$$;

-- Triggers an app job: POST <app_url>/api/cron/<job>. The route writes the job_runs row.
-- pg_net is asynchronous: the reply lands in net._http_response (kept about 6 hours).
create or replace function private.call_app(p_job text)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select value into v_url from private.app_config where key = 'app_url';
  select value into v_secret from private.app_config where key = 'cron_secret';
  if coalesce(btrim(v_url), '') = '' or coalesce(btrim(v_secret), '') = '' then
    insert into public.job_runs (job, started_at, finished_at, status, detail)
    values (p_job, now(), now(), 'skipped', 'App URL or cron secret not set in private.app_config.');
    return;
  end if;
  perform net.http_post(
    url := rtrim(btrim(v_url), '/') || '/api/cron/' || p_job,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || btrim(v_secret)),
    timeout_milliseconds := 60000
  );
end;
$$;

-- Unschedule by name if present, then schedule.
create or replace function private.schedule_job(p_name text, p_schedule text, p_command text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from cron.job where jobname = p_name) then
    perform cron.unschedule(p_name);
  end if;
  perform cron.schedule(p_name, p_schedule, p_command);
end;
$$;

-- ---------------------------------------------------------------- database jobs
-- Today's date in Dubai.
create or replace function private.dubai_today()
returns date
language sql stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Dubai')::date;
$$;

-- 1. Recurring ticket rules (0204). Uses the Dubai date, not the UTC one.
create or replace function private.job_recurring_tickets()
returns text
language plpgsql
set search_path = ''
as $$
begin
  return format('%s tickets created', public.run_recurring_rules(private.dubai_today()));
end;
$$;

-- 2. Payment reminder rows follow open invoices (0209). Runs at 03:00 UTC, when UTC and Dubai share the date.
create or replace function private.job_reminders_sync()
returns text
language plpgsql
set search_path = ''
as $$
begin
  perform public.sync_payment_reminders();
  return format('%s reminders due today',
    (select count(*) from public.reminders r where r.status = 'pending' and r.send_on = private.dubai_today()));
end;
$$;

-- 6. Future-dated title changes take effect. A step counts as future-dated when its date was after the day it
-- was saved (saveTitleChange applies same-day and back-dated ones at once). The member gets the title of their
-- latest step that is due; a pending step overtaken by a later one is only marked, not applied.
create or replace function private.job_title_changes()
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_today date := private.dubai_today();
  v_applied integer := 0;
  r record;
begin
  for r in
    select distinct on (s.member_id) s.member_id, s.title, s.new_department_id, s.applied_at,
           s.on_date > (s.created_at at time zone 'Asia/Dubai')::date as future_dated
    from public.career_steps s
    where s.on_date <= v_today and s.kind <> 'joined'
    order by s.member_id, s.on_date desc, s.created_at desc
  loop
    if r.future_dated and r.applied_at is null then
      update public.members m
         set title = r.title, department_id = coalesce(r.new_department_id, m.department_id)
       where m.id = r.member_id and m.kind = 'staff';
      v_applied := v_applied + 1;
    end if;
  end loop;
  update public.career_steps s set applied_at = now()
   where s.applied_at is null and s.kind <> 'joined' and s.on_date <= v_today
     and s.on_date > (s.created_at at time zone 'Asia/Dubai')::date;
  return format('%s title changes applied', v_applied);
end;
$$;

-- 8. End stale huddles: nobody left in the call for 5 minutes, or live for more than 8 hours (a crashed tab
-- never sets left_at, and huddle presence lives only in Realtime).
create or replace function private.job_huddle_cleanup()
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_ids uuid[];
begin
  select coalesce(array_agg(h.id), '{}') into v_ids
  from public.huddles h
  where h.ended_at is null
    and (
      h.started_at < now() - interval '8 hours'
      or (
        h.started_at < now() - interval '5 minutes'
        and not exists (select 1 from public.huddle_participants p where p.huddle_id = h.id and p.left_at is null)
        and coalesce((select max(p.left_at) from public.huddle_participants p where p.huddle_id = h.id), h.started_at)
            < now() - interval '5 minutes'
      )
    );
  update public.huddle_participants set left_at = now() where huddle_id = any (v_ids) and left_at is null;
  update public.huddles set ended_at = now() where id = any (v_ids) and ended_at is null;
  return format('%s huddles ended', cardinality(v_ids));
end;
$$;

-- 10. Stop timers with no heartbeat for over 10 minutes (the chip beats every 4). Logs whole minutes up to the
-- last heartbeat (capped at 24h, under 1 minute logs nothing), like stopTimer(). A locked week keeps no entry.
create or replace function private.job_timer_cleanup()
returns text
language plpgsql
set search_path = ''
as $$
declare
  r record;
  v_min integer;
  v_stopped integer := 0;
  v_logged integer := 0;
  v_lost integer := 0;
begin
  for r in
    select t.id, t.member_id, t.ticket_id, t.note, t.started_at, t.heartbeat_at
    from public.timers t
    where t.heartbeat_at < now() - interval '10 minutes'
    for update skip locked
  loop
    v_min := least(1440, floor(extract(epoch from (r.heartbeat_at - r.started_at)) / 60)::integer);
    if v_min >= 1 then
      begin
        insert into public.time_entries (member_id, ticket_id, date, minutes, note)
        values (r.member_id, r.ticket_id, (r.heartbeat_at at time zone 'Asia/Dubai')::date, v_min, r.note);
        v_logged := v_logged + 1;
      exception when others then
        v_lost := v_lost + 1;
      end;
    end if;
    delete from public.timers where id = r.id;
    v_stopped := v_stopped + 1;
  end loop;
  return format('%s timers stopped, %s logged', v_stopped, v_logged)
    || case when v_lost > 0 then format(', %s not logged (week locked)', v_lost) else '' end;
end;
$$;

revoke all on all functions in schema private from public, anon, authenticated;

-- ---------------------------------------------------------------- schedules (UTC = Dubai - 4h)
-- 0204 scheduled recurring tickets at 00:05 UTC without logging; this file owns that job now.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'work-p2-recurring-tickets') then
    perform cron.unschedule('work-p2-recurring-tickets');
  end if;
end;
$$;

-- Database jobs
select private.schedule_job('portal-recurring-tickets', '0 2 * * *',   -- 06:00 Dubai daily
  $c$select private.run_logged('recurring-tickets', 'select private.job_recurring_tickets()')$c$);
select private.schedule_job('portal-reminders-sync', '0 3 * * *',      -- 07:00 Dubai daily
  $c$select private.run_logged('reminders-sync', 'select private.job_reminders_sync()')$c$);
select private.schedule_job('portal-title-changes', '5 20 * * *',      -- 00:05 Dubai daily
  $c$select private.run_logged('title-changes', 'select private.job_title_changes()')$c$);
select private.schedule_job('portal-huddle-cleanup', '*/15 * * * *',   -- every 15 min
  $c$select private.run_logged('huddle-cleanup', 'select private.job_huddle_cleanup()')$c$);
select private.schedule_job('portal-timer-cleanup', '*/10 * * * *',    -- every 10 min
  $c$select private.run_logged('timer-cleanup', 'select private.job_timer_cleanup()')$c$);
-- Keep 30 days of job_runs (not logged itself).
select private.schedule_job('portal-job-runs-purge', '15 21 * * *',    -- 01:15 Dubai daily
  $c$delete from public.job_runs where started_at < now() - interval '30 days'$c$);

-- App jobs (route handlers in app/api/cron/[job])
select private.schedule_job('portal-reminders-autosend', '0 4 * * *',  -- 08:00 Dubai daily
  $c$select private.call_app('reminders-autosend')$c$);
select private.schedule_job('portal-monthly-drafts', '0 2 1 * *',      -- 06:00 Dubai on the 1st
  $c$select private.call_app('monthly-drafts')$c$);
select private.schedule_job('portal-report-autosend', '0 5 * * *',     -- 09:00 Dubai daily
  $c$select private.call_app('report-autosend')$c$);
select private.schedule_job('portal-health-recalc', '30 21 * * *',     -- 01:30 Dubai daily, before 0211's 02:00 snapshot
  $c$select private.call_app('health-recalc')$c$);
select private.schedule_job('portal-calendar-sync', '*/15 * * * *',    -- every 15 min
  $c$select private.call_app('calendar-sync')$c$);
select private.schedule_job('portal-inbox-poll', '*/10 * * * *',       -- every 10 min
  $c$select private.call_app('inbox-poll')$c$);
select private.schedule_job('portal-fireflies-import', '0 * * * *',    -- hourly
  $c$select private.call_app('fireflies-import')$c$);
select private.schedule_job('portal-sla-alerts', '*/15 * * * *',       -- every 15 min
  $c$select private.call_app('sla-alerts')$c$);
select private.schedule_job('portal-profitability-alert', '0 5 2 * *', -- 09:00 Dubai on the 2nd
  $c$select private.call_app('profitability-alert')$c$);

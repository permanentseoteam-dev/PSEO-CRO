-- 0211_health_history: one health score snapshot per client per day (Asia/Dubai), kept for the
-- health card sparkline, the 7-day change and the portfolio "Falling" filter.
--
-- The score itself is computed in TypeScript (lib/modules/clients/logic.ts healthScore(), saved to
-- clients.health_score / health_band / health_factors by "Recalculate"). This snapshot copies those
-- stored columns; it does not recompute the score.
--
-- snapshot_client_health() also raises a churn alert of kind 'drop' when today's score is 15+ points
-- below the score 7 days ago (or the nearest earlier snapshot), unless the client already has an open
-- 'drop' alert. pg_cron runs it daily at 02:00 Dubai (22:00 UTC).

-- ---------------------------------------------------------------- table
create table if not exists public.client_health_history (
  client_id uuid not null references public.clients (id) on delete cascade,
  day date not null,
  score integer not null check (score between 0 and 100),
  band text not null check (band in ('healthy', 'watch', 'at_risk', 'new', 'no_data')),
  factors jsonb not null default '[]',
  created_at timestamptz not null default now(),
  unique (client_id, day)
);
create index if not exists client_health_history_day_idx on public.client_health_history (day);

-- Staff who may view the client (has_perm clients.view, scoped by client_team). Client logins: no access.
-- Rows are written only by snapshot_client_health() (security definer), so there are no write policies.
alter table public.client_health_history enable row level security;
drop policy if exists client_health_history_staff_select on public.client_health_history;
create policy client_health_history_staff_select on public.client_health_history for select to authenticated
  using (public.cs_staff_can('clients.view', client_id));

-- ---------------------------------------------------------------- snapshot + drop alerts
create or replace function public.snapshot_client_health()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Asia/Dubai')::date;
  n integer;
begin
  insert into public.client_health_history (client_id, day, score, band, factors)
  select c.id, today, c.health_score, c.health_band, coalesce(c.health_factors, '[]'::jsonb)
  from public.clients c
  where c.status in ('active', 'onboarding') and c.health_score is not null
  on conflict (client_id, day) do update
    set score = excluded.score, band = excluded.band, factors = excluded.factors;
  get diagnostics n = row_count;

  insert into public.churn_alerts (client_id, trigger_kind, detail, raised_on)
  select h.client_id, 'drop',
         format('Health fell %s points, from %s on %s to %s.', p.score - h.score, p.score, to_char(p.day, 'FMDD Mon YYYY'), h.score),
         today
  from public.client_health_history h
  join lateral (
    select e.score, e.day from public.client_health_history e
    where e.client_id = h.client_id and e.day <= today - 7
    order by e.day desc
    limit 1
  ) p on true
  where h.day = today
    and p.score - h.score >= 15
    and not exists (
      select 1 from public.churn_alerts a
      where a.client_id = h.client_id and a.trigger_kind = 'drop' and a.outcome = 'open'
    );

  return n;
end;
$$;
revoke all on function public.snapshot_client_health() from public, anon, authenticated;
grant execute on function public.snapshot_client_health() to service_role;

-- ---------------------------------------------------------------- score N days ago, per client (portfolio)
-- Score on (today - p_days) or the nearest earlier snapshot. Security invoker, so RLS on the history applies.
create or replace function public.client_health_prev(p_days integer default 7)
returns table (client_id uuid, day date, score integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select distinct on (h.client_id) h.client_id, h.day, h.score
  from public.client_health_history h
  where h.day <= (now() at time zone 'Asia/Dubai')::date - p_days
  order by h.client_id, h.day desc;
$$;
revoke all on function public.client_health_prev(integer) from public, anon;
grant execute on function public.client_health_prev(integer) to authenticated, service_role;

-- ---------------------------------------------------------------- schedule (02:00 Dubai = 22:00 UTC)
-- Idempotent: drop the job by name if present, then schedule. Skipped with a notice where pg_cron isn't available.
do $cron$
begin
  create extension if not exists pg_cron;
  if exists (select 1 from cron.job where jobname = 'client-health-snapshot') then
    perform cron.unschedule('client-health-snapshot');
  end if;
  perform cron.schedule('client-health-snapshot', '0 22 * * *', 'select public.snapshot_client_health()');
exception when others then
  raise notice 'pg_cron not available, client-health-snapshot not scheduled: %', sqlerrm;
end;
$cron$;

-- ---------------------------------------------------------------- backfill today
select public.snapshot_client_health();

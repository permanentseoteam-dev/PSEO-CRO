-- Seed 0211_health_history: 30 days of sample snapshots (2026-10-05 .. 2026-11-03) for the seeded clients,
-- so the health card sparkline and the "Falling" filter have data. Today's row comes from snapshot_client_health().
-- Each client wobbles around its current score; Alba Motors (61 now) and Luma Skincare (44 now) were 15+ higher a week ago,
-- so they show as falling and the next snapshot raises a 'drop' churn alert for them.
insert into public.client_health_history (client_id, day, score, band, factors)
select c.id, d.day, s.score,
       case when s.score >= 75 then 'healthy' when s.score >= 50 then 'watch' else 'at_risk' end,
       '[]'::jsonb
from public.clients c
cross join lateral (
  select (date '2026-11-04' - g)::date as day, g as ago from generate_series(1, 30) g
) d
cross join lateral (
  select greatest(0, least(100,
    c.health_score
    + case when c.id in ('c0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000003') and d.ago >= 5 then 17 else 0 end
    + ((d.ago * 7) % 5) - 2
  ))::integer as score
) s
where c.health_score is not null and c.status in ('active', 'onboarding')
on conflict (client_id, day) do nothing;

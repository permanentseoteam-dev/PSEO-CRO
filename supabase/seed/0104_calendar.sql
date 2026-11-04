-- Seed for 0104_calendar: the meetings shown in the mockup's calendar (Sara Malik's view), plus a few
-- meetings Sara is not in, so "Show colleagues" has real busy blocks. Times are Dubai local (+04).
-- Fixed ids:
--   events            e1040000-0000-4000-8000-0000000000NN   (one-off and named series rows)
--   stand-up series   e1040000-0000-4000-8000-1YYYYMMDD000    (one row per date)
--   series ids        e104ffff-0000-4000-8000-0000000000NN
-- Members 00000000-0000-4000-8000-0000000000NN (01 Sara ... 10 Yusuf). Clients c0000000-0000-4000-8000-0000000000NN.

with ev (n, title, client, starts, mins, meet, loc, agenda, guests, rpt, series, vis, owner) as (
  values
    (1,  'Cedar & Pine quarterly planning', 1, '2026-11-02 10:00+04', 60, 'meet.google.com/vdr-oplm-tby', null, 'Q1 goals, local SEO plan, content calendar.', '{dr.amal@cedarpine.ae}', 'none', null, 'team', 1),
    (2,  'Nova Fitness content approvals', 5, '2026-11-03 15:00+04', 30, 'meet.google.com/kte-zuwe-cwa', null, null, '{marketing@novafit.ae}', 'none', null, 'client', 1),
    (3,  'Alba Motors monthly review', 2, '2026-11-04 11:00+04', 45, 'meet.google.com/mnb-rsta-jhk', null, 'October results, November ad copy, remarketing launch.', '{k.nasser@albamotors.ae}', 'monthly', 1, 'client', 1),
    (4,  'Luma Skincare rankings check-in', 3, '2026-11-04 14:00+04', 60, 'meet.google.com/qpx-oplm-tby', null, 'Ranking drop on serum pages, site speed fixes, next steps.', '{nina@lumaskin.com}', 'none', null, 'team', 1),
    (5,  '1:1 with Hamza', null, '2026-11-04 16:30+04', 30, 'meet.google.com/vdr-zuwe-cwa', null, null, '{}', 'biweekly', 2, 'private', 1),
    (6,  'Harbor Legal website walkthrough', 4, '2026-11-05 10:00+04', 60, 'meet.google.com/kte-rsta-jhk', null, null, '{partners@harborlegal.com}', 'none', null, 'client', 1),
    (7,  'Finance check-in with Bilal', null, '2026-11-05 13:00+04', 30, 'meet.google.com/mnb-oplm-tby', null, null, '{}', 'none', null, 'team', 1),
    (8,  'Team lunch', null, '2026-11-06 12:00+04', 60, null, 'Al Fanar, Dubai Festival City', null, '{}', 'none', null, 'team', 1),
    (9,  'Zest Kitchen PPC review', 6, '2026-11-09 11:00+04', 45, 'meet.google.com/qpx-zuwe-cwa', null, null, '{owner@zestkitchen.pk}', 'none', null, 'team', 1),
    (10, 'Interview: content writer', null, '2026-11-10 14:30+04', 30, 'meet.google.com/vdr-rsta-jhk', null, null, '{}', 'none', null, 'private', 1),
    (11, 'Luma Skincare strategy reset', 3, '2026-11-11 10:00+04', 60, 'meet.google.com/kte-oplm-tby', null, null, '{nina@lumaskin.com}', 'none', null, 'team', 1),
    (12, 'Alba Motors creative review', 2, '2026-11-12 16:00+04', 30, 'meet.google.com/mnb-zuwe-cwa', null, null, '{}', 'none', null, 'client', 1),
    (13, 'Q1 planning workshop', null, '2026-11-16 09:00+04', 90, null, 'Board room, 14th floor', null, '{}', 'none', null, 'team', 10),
    (14, 'Cedar & Pine monthly report call', 1, '2026-11-17 11:30+04', 45, 'meet.google.com/qpx-rsta-jhk', null, null, '{}', 'none', null, 'client', 1),
    (15, 'Nova Fitness reels review', 5, '2026-11-18 15:00+04', 30, 'meet.google.com/vdr-oplm-tby', null, null, '{}', 'none', null, 'team', 9),
    (16, '1:1 with Hamza', null, '2026-11-18 16:30+04', 30, 'meet.google.com/vdr-zuwe-cwa', null, null, '{}', 'biweekly', 2, 'private', 1),
    (17, 'Harbor Legal launch prep', 4, '2026-11-19 13:00+04', 60, 'meet.google.com/kte-zuwe-cwa', null, null, '{}', 'none', null, 'team', 1),
    (18, 'Leadership sync', null, '2026-11-23 10:00+04', 60, 'meet.google.com/mnb-rsta-jhk', null, null, '{}', 'none', null, 'private', 10),
    (19, 'Alba Motors monthly review', 2, '2026-11-24 14:00+04', 45, 'meet.google.com/mnb-rsta-jhk', null, null, '{k.nasser@albamotors.ae}', 'monthly', 1, 'client', 1),
    (20, 'Zest Kitchen budget call', 6, '2026-11-25 11:00+04', 30, 'meet.google.com/qpx-oplm-tby', null, null, '{owner@zestkitchen.pk}', 'none', null, 'team', 3),
    (21, 'Month-end reports run-through', null, '2026-11-26 16:00+04', 60, 'meet.google.com/vdr-rsta-jhk', null, null, '{}', 'none', null, 'team', 1),
    (22, 'Cedar & Pine Q1 kickoff', 1, '2026-12-03 11:00+04', 45, 'meet.google.com/kte-oplm-tby', null, null, '{}', 'none', null, 'client', 2),
    -- colleagues' meetings without Sara (busy blocks for "Show colleagues")
    (31, 'Technical SEO audit review', null, '2026-11-04 10:00+04', 60, 'meet.google.com/qpx-rsta-cwa', null, null, '{}', 'none', null, 'private', 2),
    (32, 'Alba Motors bid strategy', 2, '2026-11-04 13:00+04', 90, 'meet.google.com/mnb-oplm-cwa', null, null, '{}', 'none', null, 'team', 3),
    (33, 'Content brief handover', null, '2026-11-04 09:00+04', 120, null, 'Content desk', null, '{}', 'none', null, 'team', 5),
    (34, 'Harbor Legal staging QA', 4, '2026-11-04 15:00+04', 60, 'meet.google.com/kte-rsta-tby', null, null, '{}', 'none', null, 'team', 4),
    (35, 'Nova Fitness shoot planning', 5, '2026-11-05 16:00+04', 45, 'meet.google.com/vdr-oplm-jhk', null, null, '{}', 'none', null, 'team', 9),
    (36, 'Cedar & Pine citations sync', 1, '2026-11-05 11:30+04', 30, 'meet.google.com/qpx-zuwe-jhk', null, null, '{}', 'none', null, 'team', 8)
)
insert into public.events (id, title, kind, client_id, starts_at, minutes, meet_link, location, agenda, guests, repeat, series_id, visibility, created_by)
select
  ('e1040000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
  title,
  case when client is null then 'internal' else 'client_meeting' end,
  case when client is null then null else ('c0000000-0000-4000-8000-' || lpad(client::text, 12, '0'))::uuid end,
  starts::timestamptz, mins, meet, loc, agenda, guests::text[],
  rpt,
  case when series is null then null else ('e104ffff-0000-4000-8000-' || lpad(series::text, 12, '0'))::uuid end,
  vis,
  ('00000000-0000-4000-8000-' || lpad(owner::text, 12, '0'))::uuid
from ev
on conflict (id) do nothing;

-- Stand-up, Mondays and Wednesdays, 2 Nov to 2 Dec.
insert into public.events (id, title, kind, starts_at, minutes, meet_link, agenda, repeat, series_id, visibility, created_by)
select
  ('e1040000-0000-4000-8000-1' || to_char(d, 'YYYYMMDD') || '000')::uuid,
  'Daily stand-up', 'internal', (to_char(d, 'YYYY-MM-DD') || ' 09:30+04')::timestamptz, 30,
  'meet.google.com/qpx-rsta-jhk', 'Blockers, client escalations, today''s priorities.', 'weekly',
  'e104ffff-0000-4000-8000-000000000003'::uuid, 'team', '00000000-0000-4000-8000-000000000001'::uuid
from generate_series('2026-11-02'::date, '2026-12-02'::date, interval '1 day') d
where extract(isodow from d) in (1, 3)
on conflict (id) do nothing;

-- Attendees with RSVP. Member numbers: 01 Sara, 02 Omar, 03 Ayesha, 04 Daniel, 05 Priya, 06 Bilal, 07 Lina, 08 Hamza, 09 Zara, 10 Yusuf.
with att (n, people) as (
  values
    (1,  '1:yes,8:yes,2:yes'),
    (2,  '1:yes,9:yes,5:yes'),
    (3,  '1:yes,3:yes,9:maybe'),
    (4,  '1:yes,2:yes,8:pending,4:no'),
    (5,  '1:yes,8:yes'),
    (6,  '1:yes,4:yes,7:yes'),
    (7,  '1:yes,6:yes'),
    (8,  '1:yes,8:yes,2:yes,3:yes,5:maybe,7:yes'),
    (9,  '1:yes,3:yes'),
    (10, '1:yes,5:yes'),
    (11, '1:yes,2:no,10:yes'),
    (12, '1:yes,7:yes,9:yes'),
    (13, '10:yes,1:yes,2:yes,3:yes,6:maybe'),
    (14, '1:yes,8:yes,2:yes'),
    (15, '9:yes,1:maybe'),
    (16, '1:yes,8:yes'),
    (17, '1:yes,4:yes,2:pending'),
    (18, '10:yes,1:yes,6:yes'),
    (19, '1:yes,3:yes'),
    (20, '3:yes,1:pending,6:yes'),
    (21, '1:yes,8:yes,2:yes,3:yes,9:yes'),
    (22, '2:yes,1:pending'),
    (31, '2:yes'),
    (32, '3:yes,6:yes'),
    (33, '5:yes,7:yes'),
    (34, '4:yes,7:maybe'),
    (35, '9:yes,7:yes'),
    (36, '8:yes,2:yes')
)
insert into public.event_attendees (event_id, member_id, rsvp)
select
  ('e1040000-0000-4000-8000-' || lpad(att.n::text, 12, '0'))::uuid,
  ('00000000-0000-4000-8000-' || lpad(split_part(p, ':', 1), 12, '0'))::uuid,
  split_part(p, ':', 2)
from att, regexp_split_to_table(att.people, ',') p
on conflict do nothing;

insert into public.event_attendees (event_id, member_id, rsvp)
select e.id, ('00000000-0000-4000-8000-' || lpad(p.m::text, 12, '0'))::uuid, p.r
from public.events e,
  (values (1, 'yes'), (8, 'yes'), (2, 'yes'), (3, 'maybe')) p (m, r)
where e.series_id = 'e104ffff-0000-4000-8000-000000000003'
on conflict do nothing;

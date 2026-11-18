-- 0223 HR / people privacy. Policy, trigger and function changes only; no data rows touched.
--   perf_reviews  : self can no longer write manager fields, reviewer, status jumps, or delete. Self may
--                   submit (self_review -> manager_review, own manager as reviewer) and acknowledge (shared -> acknowledged).
--   timesheets    : self delete only while open/returned; a submitted week can't be moved back or re-dated by its owner.
--   attendance    : read limited to self, team managers (time/performance team scope), HR and admin. Self writes are
--                   limited to clocking now (guard); hr_clock_action() keeps working. "Who's in" uses clocked_in_member_ids().
--   member_details, career_steps : read limited to self, HR, records managers and team managers.
--   kpi_values    : self update may change value/note only, never target.
begin;

-- ---------------------------------------------------------------- perf_reviews
drop policy if exists perf_reviews_self on public.perf_reviews;
drop policy if exists perf_reviews_self_insert on public.perf_reviews;
drop policy if exists perf_reviews_self_update on public.perf_reviews;
create policy perf_reviews_self_insert on public.perf_reviews for insert to authenticated
  with check (member_id = auth.uid() and public.is_staff());
create policy perf_reviews_self_update on public.perf_reviews for update to authenticated
  using (member_id = auth.uid() and public.is_staff() and status in ('self_review', 'shared'))
  with check (member_id = auth.uid() and public.is_staff());

create or replace function public.perf_reviews_guard()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  my_manager uuid;
begin
  -- Service role, other people's reviews (reviewer / managers) and performance managers are not limited here.
  if auth.uid() is null or new.member_id is distinct from auth.uid()
     or public.has_perm('performance.manage', 'all')
     or (public.has_perm('performance.manage', 'team') and public.in_my_team(new.member_id)) then
    return new;
  end if;
  select manager_id into my_manager from public.members where id = auth.uid();
  if tg_op = 'INSERT' then
    if new.status not in ('self_review', 'manager_review')
       or new.manager_notes is not null or new.manager_rating is not null
       or new.reviewer_id is distinct from my_manager
       or not exists (select 1 from public.review_cycles c where c.id = new.cycle_id and c.status = 'open') then
      raise exception 'You can only submit your own self-review';
    end if;
    return new;
  end if;
  if new.cycle_id is distinct from old.cycle_id or new.member_id is distinct from old.member_id
     or new.manager_notes is distinct from old.manager_notes or new.manager_rating is distinct from old.manager_rating then
    raise exception 'Only your manager can change this review';
  end if;
  if old.status = 'self_review' then
    if new.status not in ('self_review', 'manager_review')
       or (new.reviewer_id is distinct from old.reviewer_id and new.reviewer_id is distinct from my_manager) then
      raise exception 'You can only submit your own self-review';
    end if;
  elsif old.status = 'shared' then
    if new.status <> 'acknowledged' or new.reviewer_id is distinct from old.reviewer_id
       or new.went_well is distinct from old.went_well or new.to_improve is distinct from old.to_improve
       or new.self_rating is distinct from old.self_rating or new.next_goal is distinct from old.next_goal then
      raise exception 'You can only acknowledge a shared review';
    end if;
  else
    raise exception 'This review is with your manager';
  end if;
  return new;
end;
$$;
drop trigger if exists perf_reviews_guard on public.perf_reviews;
create trigger perf_reviews_guard before insert or update on public.perf_reviews
  for each row execute function public.perf_reviews_guard();

-- ---------------------------------------------------------------- timesheets
drop policy if exists timesheets_self on public.timesheets;
drop policy if exists timesheets_self_insert on public.timesheets;
drop policy if exists timesheets_self_update on public.timesheets;
drop policy if exists timesheets_self_delete on public.timesheets;
create policy timesheets_self_insert on public.timesheets for insert to authenticated
  with check (member_id = auth.uid() and public.is_staff());
create policy timesheets_self_update on public.timesheets for update to authenticated
  using (member_id = auth.uid() and public.is_staff())
  with check (member_id = auth.uid() and public.is_staff());
-- Deleting a submitted/approved week would unlock week_locked().
create policy timesheets_self_delete on public.timesheets for delete to authenticated
  using (member_id = auth.uid() and public.is_staff() and status in ('open', 'returned'));

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
    if tg_op = 'UPDATE' and (new.week_start <> old.week_start or (old.status = 'submitted' and new.status <> 'submitted')) then
      raise exception 'This week is waiting for approval';
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

-- ---------------------------------------------------------------- attendance
drop policy if exists attendance_select on public.attendance;
drop policy if exists attendance_self on public.attendance;
drop policy if exists attendance_self_insert on public.attendance;
drop policy if exists attendance_self_update on public.attendance;
create policy attendance_select on public.attendance for select to authenticated using (
  (member_id = auth.uid() and public.is_staff())
  or public.has_perm('hr.manage', 'all')
  or public.has_perm('hr.personal.view', 'all')
  or public.has_perm('time.view', 'all')
  or public.has_perm('time.approve', 'all')
  or public.has_perm('performance.team.view', 'all')
  or ((public.has_perm('hr.personal.view', 'team') or public.has_perm('time.view', 'team')
       or public.has_perm('time.approve', 'team') or public.has_perm('performance.team.view', 'team'))
      and public.in_my_team(member_id))
);
-- No self delete; self updates only touch the open session. attendance_guard limits the values.
create policy attendance_self_insert on public.attendance for insert to authenticated
  with check (member_id = auth.uid() and public.is_staff());
create policy attendance_self_update on public.attendance for update to authenticated
  using (member_id = auth.uid() and public.is_staff() and clock_out is null)
  with check (member_id = auth.uid() and public.is_staff());

-- Security invoker on purpose: inside hr_clock_action() (security definer) current_user is the owner and
-- the guard steps aside; direct writes from the app run as 'authenticated' and may only record "now".
create or replace function public.attendance_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  near constant interval := interval '2 minutes';
begin
  if current_user <> 'authenticated' or public.has_perm('hr.manage', 'all') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.clock_in not between now() - near and now() + near
       or new.clock_out is not null or new.break_minutes <> 0 or new.break_started_at is not null or new.wfh then
      raise exception 'You can only clock in now';
    end if;
    return new;
  end if;
  if new.member_id is distinct from old.member_id or new.clock_in is distinct from old.clock_in or new.wfh is distinct from old.wfh
     or (new.clock_out is not null and new.clock_out not between now() - near and now() + near)
     or (new.break_started_at is distinct from old.break_started_at and new.break_started_at is not null
         and new.break_started_at not between now() - near and now() + near)
     or (new.break_minutes is distinct from old.break_minutes
         and (old.break_started_at is null or new.break_minutes < old.break_minutes
              or new.break_minutes > old.break_minutes + ceil(extract(epoch from now() - old.break_started_at) / 60)::int + 2)) then
    raise exception 'You can only clock out or take a break now';
  end if;
  return new;
end;
$$;
drop trigger if exists attendance_guard on public.attendance;
create trigger attendance_guard before insert or update on public.attendance
  for each row execute function public.attendance_guard();

-- Directory "Clocked in" status: ids only, no times.
create or replace function public.clocked_in_member_ids()
returns table (member_id uuid)
language sql stable security definer
set search_path = ''
as $$
  select a.member_id from public.attendance a where a.clock_out is null and public.is_staff();
$$;
revoke all on function public.clocked_in_member_ids() from public, anon;
grant execute on function public.clocked_in_member_ids() to authenticated;

-- ---------------------------------------------------------------- member_details, career_steps
drop policy if exists member_details_select on public.member_details;
create policy member_details_select on public.member_details for select to authenticated using (
  (member_id = auth.uid() and public.is_staff())
  or public.has_perm('hr.manage', 'all')
  or public.has_perm('hr.personal.view', 'all')
  or public.has_perm('performance.team.view', 'all')
  or ((public.has_perm('hr.personal.view', 'team') or public.has_perm('performance.team.view', 'team'))
      and public.in_my_team(member_id))
);

drop policy if exists career_steps_select on public.career_steps;
create policy career_steps_select on public.career_steps for select to authenticated using (
  (member_id = auth.uid() and public.is_staff())
  or public.has_perm('hr.manage', 'all')
  or public.has_perm('hr.personal.view', 'all')
  or public.has_perm('performance.team.view', 'all')
  or ((public.has_perm('hr.personal.view', 'team') or public.has_perm('performance.team.view', 'team'))
      and public.in_my_team(member_id))
  or public.hr_can('hr.records.manage', member_id)
);

-- ---------------------------------------------------------------- kpi_values
-- The app lets you update your own KPI value and note (updateKpiValue); the target stays with managers.
create or replace function public.kpi_values_guard()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or old.member_id is distinct from auth.uid()
     or public.has_perm('performance.manage', 'all')
     or (public.has_perm('performance.manage', 'team') and public.in_my_team(old.member_id)) then
    return new;
  end if;
  if new.target is distinct from old.target or new.kpi_id is distinct from old.kpi_id
     or new.member_id is distinct from old.member_id or new.quarter is distinct from old.quarter
     or new.updated_by is distinct from auth.uid() then
    raise exception 'You can only update the value of your own KPI';
  end if;
  return new;
end;
$$;
drop trigger if exists kpi_values_guard on public.kpi_values;
create trigger kpi_values_guard before update on public.kpi_values
  for each row execute function public.kpi_values_guard();

commit;

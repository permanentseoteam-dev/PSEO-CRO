-- 0226 member_details self access. Policy and function changes only; no data rows touched.
--   A member could delete their own row and insert a fresh one, wiping or forging HR job fields.
--   Self: select / insert / update only (no delete). A self insert may only set personal fields
--   (bio, linkedin, emergency contact, slack id); every HR field must stay at its default.
--   HR (hr.manage) and HR records managers keep their own FOR ALL policies.
begin;

drop policy if exists member_details_self on public.member_details;
drop policy if exists member_details_self_select on public.member_details;
drop policy if exists member_details_self_insert on public.member_details;
drop policy if exists member_details_self_update on public.member_details;
-- Self read is already in member_details_select (0223).
create policy member_details_self_insert on public.member_details for insert to authenticated
  with check (member_id = auth.uid() and public.is_staff());
create policy member_details_self_update on public.member_details for update to authenticated
  using (member_id = auth.uid() and public.is_staff())
  with check (member_id = auth.uid() and public.is_staff());

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
    if new.location is not null or new.contract is distinct from 'full_time' or new.probation_start is not null
      or new.probation_end is not null or new.probation_status is distinct from 'on_probation'
      or new.probation_confirmed_by is not null or new.job_summary is not null or new.job_duties is distinct from '{}'
      or new.shift_start is distinct from '09:00'::time or new.shift_end is distinct from '18:00'::time
      or new.probation_decided_at is not null then
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

commit;

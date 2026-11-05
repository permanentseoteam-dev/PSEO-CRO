-- When a subtask is marked done, notify the parent task's assignee, co-assignees, reporter and reviewer
-- (never the person who made the change). Never blocks the ticket update.
create or replace function public.tickets_notify_subtask_done()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.tickets%rowtype;
begin
  if new.parent_id is null or new.status <> 'done' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'done' then
    return new;
  end if;

  begin
    select * into p from public.tickets where id = new.parent_id;
    if found then
      insert into public.notifications (member_id, actor_id, kind, action, subject, detail, href)
      select distinct r.m, auth.uid(), 'ticket', 'completed a subtask of', p.key,
             left(new.key || ' ' || new.title, 120), '/t/' || p.key
      from (
        select p.assignee_id as m
        union select unnest(p.co_assignee_ids)
        union select p.reporter_id
        union select p.reviewer_id
      ) r
      where r.m is not null
        and r.m is distinct from auth.uid();
    end if;
  exception when others then
    null; -- notifications must never fail the ticket update
  end;
  return new;
end;
$$;

drop trigger if exists tickets_notify_subtask_done on public.tickets;
create trigger tickets_notify_subtask_done
  after insert or update of status on public.tickets
  for each row execute function public.tickets_notify_subtask_done();

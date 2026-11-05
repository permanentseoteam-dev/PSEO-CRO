-- 0209_reminder_balance: reminders follow the Phase 2 balance.
-- balance = total - payments - paid before the portal - client credit applied
-- (same rule as balance() in lib/modules/finance/core/logic.ts and invoiceBalance() in features/finance-p2/logic.ts).
-- Replaces sync_payment_reminders() from 0111 so invoices settled by old payments or credit stop getting reminders.
-- Depends on 0111_finance_ops (reminders, sync_payment_reminders) and 0206_finance_p2 (invoice_extras, credit_movements).

create or replace function public.invoice_open_balance(p_invoice uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(
    i.total - i.amount_paid
      - coalesce((select x.paid_before_portal from public.invoice_extras x where x.invoice_id = i.id), 0)
      - coalesce((select sum(c.amount) from public.credit_movements c where c.invoice_id = i.id and c.kind = 'applied'), 0),
    0)
  from public.invoices i
  where i.id = p_invoice;
$$;
revoke execute on function public.invoice_open_balance(uuid) from public, anon, authenticated;
grant execute on function public.invoice_open_balance(uuid) to service_role;

create or replace function public.sync_payment_reminders()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stages text[];
begin
  if auth.uid() is not null and not (public.is_staff() and public.has_perm('finance.invoices.send', 'all')) then
    raise exception 'You can''t manage reminders' using errcode = '42501';
  end if;
  select reminder_stages into v_stages from public.finance_ops_settings where id;
  v_stages := coalesce(v_stages, array['before', 'late_1', 'late_7', 'late_14', 'late_30']);

  delete from public.reminders r using public.invoices i
   where r.invoice_id = i.id and r.status = 'pending'
     and (i.status not in ('issued', 'partly_paid', 'disputed') or public.invoice_open_balance(i.id) <= 0);

  update public.reminders r set send_on = i.due_on + public.reminder_offset(r.stage)
    from public.invoices i
   where r.invoice_id = i.id and r.status = 'pending' and r.send_on <> i.due_on + public.reminder_offset(r.stage);

  insert into public.reminders (invoice_id, stage, send_on, auto, paused_until, pause_note)
  select i.id, s.stage, i.due_on + public.reminder_offset(s.stage), coalesce(bp.auto_reminders, true), p.paused_until, p.pause_note
    from public.invoices i
    cross join unnest(v_stages) as s(stage)
    left join public.billing_profiles bp on bp.client_id = i.client_id
    left join lateral (
      select max(r.paused_until) as paused_until, max(r.pause_note) as pause_note
        from public.reminders r where r.invoice_id = i.id and r.paused_until >= current_date
    ) p on true
   where i.status in ('issued', 'partly_paid', 'disputed') and public.invoice_open_balance(i.id) > 0
     and i.due_on + public.reminder_offset(s.stage) >= coalesce(
       (select max(i.due_on + public.reminder_offset(x)) from unnest(v_stages) as x
         where i.due_on + public.reminder_offset(x) <= current_date), '-infinity'::date)
  on conflict (invoice_id, stage) do nothing;

  update public.reminders r set status = 'skipped', result = 'Missed'
   where r.status = 'pending' and r.send_on < current_date
     and exists (select 1 from public.reminders l
                  where l.invoice_id = r.invoice_id and l.send_on > r.send_on and l.send_on <= current_date);
end;
$$;
revoke execute on function public.sync_payment_reminders() from public, anon;
grant execute on function public.sync_payment_reminders() to authenticated, service_role;

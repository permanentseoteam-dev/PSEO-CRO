-- 0225 sub-accounts scope: client data helpers check the client itself, not just the permission.
-- client_data_can_view/manage are used only by the client-data tables (ad_budgets, ad_campaigns,
-- client_analyses, client_data_sources, client_leads, client_metric_daily, client_sub_accounts,
-- client_websites, seo_queries). Sub-account writes need manage on both clients, and rows billed
-- under the parent need clients.billing.edit at 'all'. Functions and policies only; no data rows are touched.
begin;

-- View: the same per-client rule as the clients table (staff_sees_client).
create or replace function public.client_data_can_view(cid uuid)
returns boolean language sql stable set search_path = '' as $$
  select public.staff_sees_client(cid);
$$;

-- Manage: clients.data.manage at 'all', or on a client you own/manage/are on the team of,
-- or (at 'team') one your team is on. Same shape as staff_sees_client.
create or replace function public.client_data_can_manage(cid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_staff() and (
    public.has_perm('clients.data.manage', 'all')
    or (public.has_perm('clients.data.manage', 'own') and exists (
      select 1 from public.clients c
      where c.id = cid
        and (
          c.owner_id = auth.uid() or c.manager_id = auth.uid()
          or exists (select 1 from public.client_team t where t.client_id = c.id and t.member_id = auth.uid())
          or (public.has_perm('clients.data.manage', 'team') and (
            public.in_my_team(c.owner_id) or public.in_my_team(c.manager_id)
            or exists (select 1 from public.client_team t where t.client_id = c.id and public.in_my_team(t.member_id))
          ))
        )
    ))
  );
$$;

-- Sub-accounts. Select stays on the parent (now scoped by the helper).
drop policy if exists client_sub_accounts_staff_insert on public.client_sub_accounts;
create policy client_sub_accounts_staff_insert on public.client_sub_accounts for insert to authenticated
  with check (
    public.client_data_can_manage(parent_client_id) and public.client_data_can_manage(child_client_id)
    and (billing = 'own' or public.has_perm('clients.billing.edit', 'all'))
  );
drop policy if exists client_sub_accounts_staff_update on public.client_sub_accounts;
create policy client_sub_accounts_staff_update on public.client_sub_accounts for update to authenticated
  using (
    public.client_data_can_manage(parent_client_id) and public.client_data_can_manage(child_client_id)
    and (billing = 'own' or public.has_perm('clients.billing.edit', 'all'))
  )
  with check (
    public.client_data_can_manage(parent_client_id) and public.client_data_can_manage(child_client_id)
    and (billing = 'own' or public.has_perm('clients.billing.edit', 'all'))
  );
drop policy if exists client_sub_accounts_staff_delete on public.client_sub_accounts;
create policy client_sub_accounts_staff_delete on public.client_sub_accounts for delete to authenticated
  using (
    public.client_data_can_manage(parent_client_id) and public.client_data_can_manage(child_client_id)
    and (billing = 'own' or public.has_perm('clients.billing.edit', 'all'))
  );

commit;

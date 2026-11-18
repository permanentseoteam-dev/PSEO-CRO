-- 0222 client data scoping: per-client RLS on Fireflies calls and inbox messages, sub-account billing
-- needs billing.edit, portal activity writes need clients.manage, signed agreements need billing.view.
-- Policy changes only; no data rows are touched.
begin;

-- Fireflies calls: read clients you can see; unmatched calls (no client) only with clients.manage at 'all'.
drop policy if exists fireflies_calls_select on public.fireflies_calls;
create policy fireflies_calls_select on public.fireflies_calls for select to authenticated
  using (
    (client_id is not null and public.staff_sees_client(client_id))
    or (client_id is null and public.is_staff() and public.has_perm('clients.manage', 'all'))
  );
-- Writes need clients.manage on the client (old and new). staff_manages_client(null) is true only at 'all'.
drop policy if exists fireflies_calls_write on public.fireflies_calls;
create policy fireflies_calls_write on public.fireflies_calls for update to authenticated
  using (public.staff_manages_client(client_id))
  with check (public.staff_manages_client(client_id));

-- Client inbox messages: same read rule as calls.
drop policy if exists inbox_messages_select on public.inbox_messages;
create policy inbox_messages_select on public.inbox_messages for select to authenticated
  using (
    (client_id is not null and public.staff_sees_client(client_id))
    or (client_id is null and public.is_staff() and public.has_perm('clients.manage', 'all'))
  );

-- Sub-accounts: billing under the parent needs clients.billing.edit at 'all'.
-- (Finance's own link/unlink uses the service role, which bypasses RLS.)
drop policy if exists client_sub_accounts_staff_insert on public.client_sub_accounts;
create policy client_sub_accounts_staff_insert on public.client_sub_accounts for insert to authenticated
  with check (
    public.client_data_can_manage(parent_client_id) and public.client_data_can_view(child_client_id)
    and (billing = 'own' or public.has_perm('clients.billing.edit', 'all'))
  );
drop policy if exists client_sub_accounts_staff_update on public.client_sub_accounts;
create policy client_sub_accounts_staff_update on public.client_sub_accounts for update to authenticated
  using (public.client_data_can_manage(parent_client_id))
  with check (
    public.client_data_can_manage(parent_client_id)
    and (billing = 'own' or public.has_perm('clients.billing.edit', 'all'))
  );

-- Portal activity lines: writes need clients.manage on the client (portal triggers are security definer).
drop policy if exists shared_activity_write on public.shared_activity;
create policy shared_activity_write on public.shared_activity for all to authenticated
  using (public.staff_manages_client(client_id))
  with check (public.staff_manages_client(client_id));

-- Signed agreements show fees: reading needs clients.billing.view, like client_terms.
drop policy if exists client_agreements_obj_select on storage.objects;
create policy client_agreements_obj_select on storage.objects for select to authenticated
  using (
    bucket_id = 'client-agreements' and public.ca_object_client(name) is not null
    and public.has_perm('clients.billing.view', 'own')
    and public.cs_staff_can('clients.view', public.ca_object_client(name))
  );

commit;

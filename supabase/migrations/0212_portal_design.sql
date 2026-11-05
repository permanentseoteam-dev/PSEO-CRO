-- 0212_portal_design: company defaults for the client portal look, the logo bucket, and the 2-step sign-in policy.
--   portal_design_settings: one row. Default accent, theme, density and logo for every client portal.
--     Per-client branding (0108 clients.portal_color / portal_logo_url) overrides the accent and logo.
--     The app only saves accents with 4.5:1 or better contrast on white (lib/modules/portal-design/logic.ts).
--   security_settings: one row. Staff roles that must use 2-step sign-in (TOTP, Supabase Auth MFA).
--   Bucket "portal-branding": public read (logos show on client portals), PNG/JPG/WebP up to 2 MB.
-- Access: any signed-in user reads both rows; only admin.access.manage 'all' writes them and the bucket.
-- Depends on 0001_core (has_perm, set_updated_at, members).

-- ---------------------------------------------------------------- portal_design_settings
create table if not exists public.portal_design_settings (
  id boolean primary key default true check (id), -- singleton
  accent text not null default '#0f766e' check (accent ~ '^#[0-9a-fA-F]{6}$'),
  theme text not null default 'system' check (theme in ('system', 'light', 'dark')),
  density text not null default 'comfortable' check (density in ('comfortable', 'compact')),
  logo_path text, -- object path in "portal-branding"
  updated_by uuid references public.members (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists portal_design_settings_updated_at on public.portal_design_settings;
create trigger portal_design_settings_updated_at before update on public.portal_design_settings
  for each row execute function public.set_updated_at();
insert into public.portal_design_settings (id) values (true) on conflict (id) do nothing;

alter table public.portal_design_settings enable row level security;
drop policy if exists portal_design_settings_select on public.portal_design_settings;
create policy portal_design_settings_select on public.portal_design_settings for select to authenticated using (true);
drop policy if exists portal_design_settings_insert on public.portal_design_settings;
create policy portal_design_settings_insert on public.portal_design_settings for insert to authenticated
  with check (public.has_perm('admin.access.manage', 'all'));
drop policy if exists portal_design_settings_update on public.portal_design_settings;
create policy portal_design_settings_update on public.portal_design_settings for update to authenticated
  using (public.has_perm('admin.access.manage', 'all'))
  with check (public.has_perm('admin.access.manage', 'all'));

-- ---------------------------------------------------------------- security_settings
create table if not exists public.security_settings (
  id boolean primary key default true check (id), -- singleton
  mfa_required_roles text[] not null default '{}', -- staff role keys (public.roles.key) that must use 2-step
  updated_by uuid references public.members (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists security_settings_updated_at on public.security_settings;
create trigger security_settings_updated_at before update on public.security_settings
  for each row execute function public.set_updated_at();
insert into public.security_settings (id) values (true) on conflict (id) do nothing;

alter table public.security_settings enable row level security;
drop policy if exists security_settings_select on public.security_settings;
create policy security_settings_select on public.security_settings for select to authenticated using (true);
drop policy if exists security_settings_insert on public.security_settings;
create policy security_settings_insert on public.security_settings for insert to authenticated
  with check (public.has_perm('admin.access.manage', 'all'));
drop policy if exists security_settings_update on public.security_settings;
create policy security_settings_update on public.security_settings for update to authenticated
  using (public.has_perm('admin.access.manage', 'all'))
  with check (public.has_perm('admin.access.manage', 'all'));

-- ---------------------------------------------------------------- bucket: portal-branding
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portal-branding', 'portal-branding', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- Public bucket: logos load by public URL. Signed-in users may also list/read through the API.
drop policy if exists portal_branding_obj_select on storage.objects;
create policy portal_branding_obj_select on storage.objects for select to authenticated
  using (bucket_id = 'portal-branding');
drop policy if exists portal_branding_obj_insert on storage.objects;
create policy portal_branding_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'portal-branding' and public.has_perm('admin.access.manage', 'all'));
drop policy if exists portal_branding_obj_update on storage.objects;
create policy portal_branding_obj_update on storage.objects for update to authenticated
  using (bucket_id = 'portal-branding' and public.has_perm('admin.access.manage', 'all'))
  with check (bucket_id = 'portal-branding' and public.has_perm('admin.access.manage', 'all'));
drop policy if exists portal_branding_obj_delete on storage.objects;
create policy portal_branding_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'portal-branding' and public.has_perm('admin.access.manage', 'all'));

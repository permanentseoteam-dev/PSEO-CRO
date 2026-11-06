-- 0218_agency_settings: the agency's own brand (name, subtitle, initials, logo) and the workday length.
--   agency_settings: one row. Shown in the staff sidebar, page titles, the sign-in page, invoice PDFs.
--     No existing table fits: portal_design_settings (0212) is the client portal look, and
--     private.app_config (0210) is private server config.
--     logo_url must be https:// (it loads in every browser). workday_minutes drives the clock progress bar.
--   agency_brand(): the four brand fields only, for the sign-in page before anyone is signed in.
-- Access: any signed-in user reads the row; only admin.access.manage 'all' writes it (same check as 0212).
--   anon gets agency_brand() only, never the table.
-- Depends on 0001_core (has_perm, set_updated_at, members).

create table if not exists public.agency_settings (
  id boolean primary key default true check (id), -- singleton
  name text not null default 'Permanent SEO' check (char_length(btrim(name)) between 1 and 80),
  subtitle text not null default 'Agency portal' check (char_length(subtitle) <= 80),
  initials text check (initials is null or char_length(initials) between 1 and 3),
  logo_url text check (logo_url is null or (logo_url ~ '^https://' and char_length(logo_url) <= 500)),
  workday_minutes integer not null default 480 check (workday_minutes between 60 and 960),
  updated_by uuid references public.members (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists agency_settings_updated_at on public.agency_settings;
create trigger agency_settings_updated_at before update on public.agency_settings
  for each row execute function public.set_updated_at();
insert into public.agency_settings (id, initials) values (true, 'PS') on conflict (id) do nothing;

alter table public.agency_settings enable row level security;
drop policy if exists agency_settings_select on public.agency_settings;
create policy agency_settings_select on public.agency_settings for select to authenticated using (true);
drop policy if exists agency_settings_insert on public.agency_settings;
create policy agency_settings_insert on public.agency_settings for insert to authenticated
  with check (public.has_perm('admin.access.manage', 'all'));
drop policy if exists agency_settings_update on public.agency_settings;
create policy agency_settings_update on public.agency_settings for update to authenticated
  using (public.has_perm('admin.access.manage', 'all'))
  with check (public.has_perm('admin.access.manage', 'all'));

-- Brand fields only, for the sign-in page. Security definer so anon never needs table access.
create or replace function public.agency_brand()
returns table (name text, subtitle text, initials text, logo_url text)
language sql stable security definer
set search_path = ''
as $$
  select a.name, a.subtitle, a.initials, a.logo_url from public.agency_settings a where a.id;
$$;
revoke execute on function public.agency_brand() from public;
grant execute on function public.agency_brand() to anon, authenticated, service_role;

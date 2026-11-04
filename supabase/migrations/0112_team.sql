-- 0112_team: directory profile extras, KPIs, OKRs with check-ins, review cycles and reviews.
-- Training paths are phase 2 (not created here).
-- Quarters are stored as text like 'Q4 2026'.
-- Clock-in state is read from public.attendance (0113_personal); no FK because it is created later.

-- ---------------------------------------------------------------- directory extras

create table public.member_profiles (
  member_id uuid primary key references public.members (id) on delete cascade,
  status_note text,
  skills text[] not null default '{}',
  phone text,
  joined_on date,
  shift text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger member_profiles_updated_at before update on public.member_profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- KPIs

create table public.kpis (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  unit text not null default '',
  direction text not null default 'higher' check (direction in ('higher', 'lower')),
  weight int not null default 10 check (weight between 0 and 100),
  source text not null default 'manual' check (source in ('portal', 'manual')),
  department_id uuid references public.departments (id) on delete set null, -- null = everyone
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index kpis_department_idx on public.kpis (department_id);
create trigger kpis_updated_at before update on public.kpis
  for each row execute function public.set_updated_at();

create table public.kpi_values (
  id uuid primary key default gen_random_uuid(),
  kpi_id uuid not null references public.kpis (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  quarter text not null check (quarter ~ '^Q[1-4] [0-9]{4}$'),
  value numeric(14,2) not null default 0,
  target numeric(14,2) not null check (target >= 0),
  note text,
  updated_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (kpi_id, member_id, quarter)
);
create index kpi_values_member_idx on public.kpi_values (member_id, quarter);
create trigger kpi_values_updated_at before update on public.kpi_values
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- review cycles and reviews

create table public.review_cycles (
  id uuid primary key default gen_random_uuid(),
  quarter text not null unique check (quarter ~ '^Q[1-4] [0-9]{4}$'),
  self_due date not null,
  manager_due date not null,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger review_cycles_updated_at before update on public.review_cycles
  for each row execute function public.set_updated_at();

-- Flow: self_review -> manager_review -> shared -> acknowledged.
create table public.perf_reviews (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.review_cycles (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  reviewer_id uuid references public.members (id) on delete set null,
  status text not null default 'self_review'
    check (status in ('self_review', 'manager_review', 'shared', 'acknowledged')),
  went_well text,
  to_improve text,
  self_rating int check (self_rating between 1 and 5),
  next_goal text,
  manager_notes text,
  manager_rating int check (manager_rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (cycle_id, member_id)
);
create index perf_reviews_member_idx on public.perf_reviews (member_id);
create index perf_reviews_reviewer_idx on public.perf_reviews (reviewer_id);
create trigger perf_reviews_updated_at before update on public.perf_reviews
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- OKRs

create table public.okrs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  owner_id uuid not null references public.members (id) on delete cascade,
  quarter text not null check (quarter ~ '^Q[1-4] [0-9]{4}$'),
  created_by uuid references public.members (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index okrs_quarter_idx on public.okrs (quarter);
create index okrs_owner_idx on public.okrs (owner_id);
create trigger okrs_updated_at before update on public.okrs
  for each row execute function public.set_updated_at();

-- Up to 6 key results per objective (position 1..6, unique).
create table public.key_results (
  id uuid primary key default gen_random_uuid(),
  okr_id uuid not null references public.okrs (id) on delete cascade,
  position int not null check (position between 1 and 6),
  title text not null,
  progress int not null default 0 check (progress between 0 and 100),
  confidence text not null default 'on_track' check (confidence in ('on_track', 'at_risk', 'off_track')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (okr_id, position)
);
create index key_results_okr_idx on public.key_results (okr_id);
create trigger key_results_updated_at before update on public.key_results
  for each row execute function public.set_updated_at();

create table public.kr_checkins (
  id uuid primary key default gen_random_uuid(),
  key_result_id uuid not null references public.key_results (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  progress int not null check (progress between 0 and 100),
  confidence text not null check (confidence in ('on_track', 'at_risk', 'off_track')),
  note text,
  created_at timestamptz not null default now()
);
create index kr_checkins_kr_idx on public.kr_checkins (key_result_id);
create index kr_checkins_member_idx on public.kr_checkins (member_id);

-- ---------------------------------------------------------------- RLS

alter table public.member_profiles enable row level security;
alter table public.kpis enable row level security;
alter table public.kpi_values enable row level security;
alter table public.review_cycles enable row level security;
alter table public.perf_reviews enable row level security;
alter table public.okrs enable row level security;
alter table public.key_results enable row level security;
alter table public.kr_checkins enable row level security;

-- member_profiles: staff read (directory); you edit your own; admins edit all.
create policy member_profiles_select on public.member_profiles for select to authenticated
  using (public.is_staff() and public.has_perm('hr.directory.view', 'own'));
create policy member_profiles_self on public.member_profiles for all to authenticated
  using (member_id = auth.uid() and public.is_staff())
  with check (member_id = auth.uid() and public.is_staff());
create policy member_profiles_admin on public.member_profiles for all to authenticated
  using (public.has_perm('admin.access.manage', 'all'))
  with check (public.has_perm('admin.access.manage', 'all'));

-- kpis and review_cycles: staff read; performance managers (all) write.
create policy kpis_select on public.kpis for select to authenticated using (public.is_staff());
create policy kpis_manage on public.kpis for all to authenticated
  using (public.has_perm('performance.manage', 'all'))
  with check (public.has_perm('performance.manage', 'all'));

create policy review_cycles_select on public.review_cycles for select to authenticated using (public.is_staff());
create policy review_cycles_manage on public.review_cycles for all to authenticated
  using (public.has_perm('performance.manage', 'all'))
  with check (public.has_perm('performance.manage', 'all'));

-- kpi_values: you see and update your own; team view by scope; managers write by scope.
create policy kpi_values_select on public.kpi_values for select to authenticated using (
  (member_id = auth.uid() and public.is_staff())
  or public.has_perm('performance.team.view', 'all')
  or (public.has_perm('performance.team.view', 'team') and public.in_my_team(member_id))
);
create policy kpi_values_update_self on public.kpi_values for update to authenticated
  using (member_id = auth.uid() and public.is_staff())
  with check (member_id = auth.uid() and public.is_staff());
create policy kpi_values_manage on public.kpi_values for all to authenticated
  using (
    public.has_perm('performance.manage', 'all')
    or (public.has_perm('performance.manage', 'team') and public.in_my_team(member_id))
  )
  with check (
    public.has_perm('performance.manage', 'all')
    or (public.has_perm('performance.manage', 'team') and public.in_my_team(member_id))
  );

-- perf_reviews: the person, their reviewer, and team viewers by scope read.
-- The person writes their own row (self-review); the reviewer and managers write too.
create policy perf_reviews_select on public.perf_reviews for select to authenticated using (
  (public.is_staff() and (member_id = auth.uid() or reviewer_id = auth.uid()))
  or public.has_perm('performance.team.view', 'all')
  or (public.has_perm('performance.team.view', 'team') and public.in_my_team(member_id))
);
create policy perf_reviews_self on public.perf_reviews for all to authenticated
  using (member_id = auth.uid() and public.is_staff())
  with check (member_id = auth.uid() and public.is_staff());
create policy perf_reviews_reviewer on public.perf_reviews for update to authenticated
  using (reviewer_id = auth.uid() and public.is_staff())
  with check (reviewer_id = auth.uid() and public.is_staff());
create policy perf_reviews_manage on public.perf_reviews for all to authenticated
  using (
    public.has_perm('performance.manage', 'all')
    or (public.has_perm('performance.manage', 'team') and public.in_my_team(member_id))
  )
  with check (
    public.has_perm('performance.manage', 'all')
    or (public.has_perm('performance.manage', 'team') and public.in_my_team(member_id))
  );

-- okrs: staff read all objectives (they are shared goals). Owners and managers write.
create policy okrs_select on public.okrs for select to authenticated using (public.is_staff());
create policy okrs_write on public.okrs for all to authenticated
  using (
    public.is_staff() and (
      owner_id = auth.uid()
      or public.has_perm('performance.manage', 'all')
      or (public.has_perm('performance.manage', 'team') and public.in_my_team(owner_id))
    )
  )
  with check (
    public.is_staff() and (
      owner_id = auth.uid()
      or public.has_perm('performance.manage', 'all')
      or (public.has_perm('performance.manage', 'team') and public.in_my_team(owner_id))
    )
  );

-- key_results: follow the parent objective.
create or replace function public.can_write_okr(target_okr uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.is_staff() and exists (
    select 1 from public.okrs o
    where o.id = target_okr
      and (
        o.owner_id = auth.uid()
        or public.has_perm('performance.manage', 'all')
        or (public.has_perm('performance.manage', 'team') and public.in_my_team(o.owner_id))
      )
  );
$$;
revoke execute on function public.can_write_okr(uuid) from public, anon;
grant execute on function public.can_write_okr(uuid) to authenticated, service_role;

create policy key_results_select on public.key_results for select to authenticated using (public.is_staff());
create policy key_results_write on public.key_results for all to authenticated
  using (public.can_write_okr(okr_id))
  with check (public.can_write_okr(okr_id));

-- kr_checkins: staff read; you add check-ins as yourself on key results you can write.
create policy kr_checkins_select on public.kr_checkins for select to authenticated using (public.is_staff());
create policy kr_checkins_insert on public.kr_checkins for insert to authenticated with check (
  member_id = auth.uid()
  and exists (select 1 from public.key_results kr where kr.id = key_result_id and public.can_write_okr(kr.okr_id))
);

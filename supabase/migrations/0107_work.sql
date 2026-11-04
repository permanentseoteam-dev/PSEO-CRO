-- 0107_work: projects, review rounds, QA checklists and results, ticket templates, recurring rules.
-- Owned by the Work extras module.
--
-- Links:
--   projects.client_id -> clients: no FK here (0108_clients is later); 0108 should add
--     alter table public.projects add constraint projects_client_fk foreign key (client_id) references public.clients (id) on delete set null;
--   tickets.project_id -> projects: added below (tickets comes from 0106).
--   reviews rows are written by a trigger on ticket_history (fields review_submit / review_approve / review_back,
--     which the Tickets module's review actions insert), so the review log stays in step without extra calls.

-- ---------------------------------------------------------------- tables

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^[A-Z]{2,8}$'),
  name text not null check (char_length(name) between 2 and 120),
  description text,
  department_id uuid references public.departments (id) on delete set null,
  client_id uuid,
  lead_id uuid references public.members (id) on delete set null,
  reviewer_id uuid references public.members (id) on delete set null,
  review_required boolean not null default false,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index projects_department_idx on public.projects (department_id);
create index projects_client_idx on public.projects (client_id) where client_id is not null;
create index projects_lead_idx on public.projects (lead_id);
create trigger projects_updated_at before update on public.projects
  for each row execute function public.set_updated_at();

do $$
begin
  if to_regclass('public.tickets') is not null then
    alter table public.tickets add constraint tickets_project_fk
      foreign key (project_id) references public.projects (id) on delete set null;
  end if;
end;
$$;

create table public.qa_checklists (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  services text[] not null default '{}',
  items text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger qa_checklists_updated_at before update on public.qa_checklists
  for each row execute function public.set_updated_at();

-- One row per review round of a ticket.
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  round integer not null check (round >= 1),
  owner_id uuid references public.members (id) on delete set null,
  reviewer_id uuid references public.members (id) on delete set null,
  department_id uuid references public.departments (id) on delete set null,
  project_id uuid references public.projects (id) on delete set null,
  client_id uuid,
  qa_checklist_id uuid references public.qa_checklists (id) on delete set null,
  status text not null default 'waiting' check (status in ('waiting', 'approved', 'changes')),
  reasons text[] not null default '{}',
  submit_note text,
  back_note text,
  submitted_at timestamptz not null default now(),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (ticket_id, round)
);
create index reviews_reviewer_idx on public.reviews (reviewer_id, status);
create index reviews_owner_idx on public.reviews (owner_id);
create index reviews_department_idx on public.reviews (department_id);
create index reviews_project_idx on public.reviews (project_id);
create index reviews_client_idx on public.reviews (client_id) where client_id is not null;
create index reviews_decided_idx on public.reviews (decided_at);

create table public.qa_results (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  item text not null,
  passed boolean not null,
  created_at timestamptz not null default now()
);
create index qa_results_review_idx on public.qa_results (review_id);

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  service text not null default 'SEO',
  title_pattern text not null check (char_length(title_pattern) between 2 and 200),
  department_id uuid references public.departments (id) on delete set null,
  default_assignee_id uuid references public.members (id) on delete set null, -- null = project lead
  priority text not null default 'normal' check (priority in ('urgent', 'high', 'normal', 'low')),
  due_in_days integer check (due_in_days is null or due_in_days between 0 and 365),
  estimate_min integer check (estimate_min is null or estimate_min >= 0),
  qa_checklist_id uuid references public.qa_checklists (id) on delete set null,
  description text,
  done_when text,
  checklist text[] not null default '{}',
  subtasks jsonb not null default '[]', -- [{ "title": "...", "due_offset_days": 2 }]
  tags text[] not null default '{}',
  review_required boolean not null default false,
  active boolean not null default true,
  uses integer not null default 0 check (uses >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index templates_department_idx on public.templates (department_id);
create trigger templates_updated_at before update on public.templates
  for each row execute function public.set_updated_at();

create table public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.templates (id) on delete set null,
  title_pattern text not null check (char_length(title_pattern) between 2 and 200),
  project_id uuid not null references public.projects (id) on delete cascade,
  assignee_id uuid references public.members (id) on delete set null,
  frequency text not null check (frequency in ('daily', 'weekdays', 'weekly', 'monthly')),
  day integer check (day is null or day between 1 and 28), -- weekly: 1 = Monday .. 7 = Sunday; monthly: day of month
  due_offset_days integer not null default 0 check (due_offset_days between 0 and 90),
  start_date date not null default current_date,
  next_run date,
  paused boolean not null default false,
  paused_until date,
  pause_note text,
  created_by uuid references public.members (id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index recurring_rules_project_idx on public.recurring_rules (project_id);
create index recurring_rules_template_idx on public.recurring_rules (template_id);
create index recurring_rules_next_idx on public.recurring_rules (next_run) where not paused;
create trigger recurring_rules_updated_at before update on public.recurring_rules
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- review log from ticket history

create or replace function public.reviews_from_history()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  k record;
begin
  if new.field = 'review_submit' then
    select t.id, t.assignee_id, t.reviewer_id, t.review_round, t.project_id, t.client_id, m.department_id
      into k
      from public.tickets t
      left join public.members m on m.id = t.assignee_id
     where t.id = new.ticket_id;
    if k.id is null then return new; end if;
    insert into public.reviews (ticket_id, round, owner_id, reviewer_id, department_id, project_id, client_id, submit_note, submitted_at)
    values (k.id, greatest(k.review_round, 1), k.assignee_id, k.reviewer_id, k.department_id, k.project_id, k.client_id, new.new_value, new.created_at)
    on conflict (ticket_id, round) do update
      set reviewer_id = excluded.reviewer_id, submit_note = excluded.submit_note,
          submitted_at = excluded.submitted_at, status = 'waiting', decided_at = null;
  elsif new.field = 'review_approve' then
    update public.reviews set status = 'approved', decided_at = new.created_at
     where ticket_id = new.ticket_id and status = 'waiting';
  elsif new.field = 'review_back' then
    update public.reviews
       set status = 'changes', decided_at = new.created_at,
           reasons = coalesce(string_to_array(new.old_value, ', '), '{}'), back_note = new.new_value
     where ticket_id = new.ticket_id and status = 'waiting';
  end if;
  return new;
end;
$$;

do $$
begin
  if to_regclass('public.ticket_history') is not null then
    create trigger ticket_history_reviews after insert on public.ticket_history
      for each row when (new.field in ('review_submit', 'review_approve', 'review_back'))
      execute function public.reviews_from_history();
  end if;
end;
$$;

-- ---------------------------------------------------------------- RLS

alter table public.projects enable row level security;
alter table public.qa_checklists enable row level security;
alter table public.reviews enable row level security;
alter table public.qa_results enable row level security;
alter table public.templates enable row level security;
alter table public.recurring_rules enable row level security;

-- projects: every staff member sees them; client logins see their own client's projects.
-- Managers write: 'all' scope anywhere, 'team' scope when the lead is in their team.
create policy projects_select on public.projects for select to authenticated using (
  public.is_staff() or (client_id is not null and client_id = public.my_client_id())
);
create policy projects_insert on public.projects for insert to authenticated with check (
  public.is_staff() and (
    public.has_perm('work.projects.manage', 'all')
    or (public.has_perm('work.projects.manage', 'team') and public.in_my_team(lead_id))
  )
);
create policy projects_update on public.projects for update to authenticated
  using (
    public.is_staff() and (
      public.has_perm('work.projects.manage', 'all')
      or (public.has_perm('work.projects.manage', 'team') and public.in_my_team(lead_id))
    )
  )
  with check (
    public.is_staff() and (
      public.has_perm('work.projects.manage', 'all')
      or (public.has_perm('work.projects.manage', 'team') and public.in_my_team(lead_id))
    )
  );
-- No delete policy: projects are archived, not deleted.

-- QA checklists: staff read; template managers edit.
create policy qa_checklists_select on public.qa_checklists for select to authenticated using (public.is_staff());
create policy qa_checklists_write on public.qa_checklists for all to authenticated
  using (public.is_staff() and public.has_perm('work.templates.manage', 'own'))
  with check (public.is_staff() and public.has_perm('work.templates.manage', 'own'));

-- reviews: the owner and reviewer, anyone who can see the ticket, and quality viewers by scope.
-- Written only by the ticket_history trigger (security definer); no write policies.
create policy reviews_select on public.reviews for select to authenticated using (
  public.is_staff() and (
    owner_id = auth.uid() or reviewer_id = auth.uid()
    or public.has_perm('work.quality.view', 'all')
    or (public.has_perm('work.quality.view', 'team') and public.in_my_team(owner_id))
    or public.can_see_ticket(ticket_id)
  )
);

-- QA results: visible with the review; the reviewer records them.
create policy qa_results_select on public.qa_results for select to authenticated using (
  exists (select 1 from public.reviews r where r.id = review_id)
);
create policy qa_results_insert on public.qa_results for insert to authenticated with check (
  exists (select 1 from public.reviews r where r.id = review_id and r.reviewer_id = auth.uid() and r.status = 'waiting')
);

-- templates: staff read; managers write; a used template can't be deleted (switch it off instead).
create policy templates_select on public.templates for select to authenticated using (public.is_staff());
create policy templates_insert on public.templates for insert to authenticated
  with check (public.is_staff() and public.has_perm('work.templates.manage', 'own'));
create policy templates_update on public.templates for update to authenticated
  using (public.is_staff() and public.has_perm('work.templates.manage', 'own'))
  with check (public.is_staff() and public.has_perm('work.templates.manage', 'own'));
create policy templates_delete on public.templates for delete to authenticated
  using (public.is_staff() and public.has_perm('work.templates.manage', 'own') and uses = 0);

-- recurring rules: staff read; the creator or a team-level ticket manager edits.
create policy recurring_rules_select on public.recurring_rules for select to authenticated using (public.is_staff());
create policy recurring_rules_insert on public.recurring_rules for insert to authenticated
  with check (public.is_staff() and public.has_perm('tickets.manage', 'own') and created_by = auth.uid());
create policy recurring_rules_update on public.recurring_rules for update to authenticated
  using (public.is_staff() and (created_by = auth.uid() or public.has_perm('tickets.manage', 'team')))
  with check (public.is_staff() and public.has_perm('tickets.manage', 'own'));
create policy recurring_rules_delete on public.recurring_rules for delete to authenticated
  using (public.is_staff() and (created_by = auth.uid() or public.has_perm('tickets.manage', 'team')));

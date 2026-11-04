-- Seed 0001_core: departments, roles, permission catalogue, role grants, and the sample team.
-- Fictional people from docs/ui-preview/kit.js. Fixed UUIDs so module seeds can reference them:
--   members  00000000-0000-4000-8000-0000000000NN  (NN = 01 Sara Malik ... 10 Yusuf Ali)
--   departments  d0000000-0000-4000-8000-0000000000NN
-- Sample logins use the dev password "Portal-dev-2026". Remove or reset them before real users join.

-- ---------------------------------------------------------------- roles
insert into public.roles (key, name, kind, description) values
  ('super_admin',   'Super admin',   'staff',  'Everything, including handing out super admin'),
  ('admin',         'Admin',         'staff',  'Runs the workspace: people, roles, settings'),
  ('finance_head',  'Finance head',  'staff',  'All finance and billing'),
  ('dept_head',     'Department head','staff', 'Leads a department: projects, reviews, time approvals'),
  ('member',        'Member',        'staff',  'Everyday team member'),
  ('client_owner',  'Client owner',  'client', 'Client login with billing and approvals'),
  ('client_viewer', 'Client viewer', 'client', 'Client login without billing or approvals')
on conflict (key) do nothing;

-- ---------------------------------------------------------------- permission catalogue
insert into public.permissions (key, area, label) values
  ('work.projects.manage',          'Work',     'Create and edit projects'),
  ('work.templates.manage',         'Work',     'Create and edit ticket templates'),
  ('work.quality.view',             'Work',     'See the quality report'),
  ('clients.view',                  'Clients',  'See clients'),
  ('clients.manage',                'Clients',  'Add and edit clients'),
  ('clients.billing.view',          'Clients',  'See client billing'),
  ('clients.billing.edit',          'Clients',  'Edit client billing'),
  ('finance.dashboard.view',        'Finance',  'See the finance dashboard'),
  ('finance.invoices.view',         'Finance',  'See invoices'),
  ('finance.invoices.create',       'Finance',  'Create invoices'),
  ('finance.invoices.send',         'Finance',  'Send invoices and reminders'),
  ('finance.invoices.void',         'Finance',  'Void invoices'),
  ('finance.invoices.edit_issued',  'Finance',  'Edit issued invoices'),
  ('finance.invoices.record_past',  'Finance',  'Record past invoices'),
  ('finance.drafts.create',         'Finance',  'Create monthly drafts'),
  ('finance.payments.view',         'Finance',  'See payments'),
  ('finance.payments.record',       'Finance',  'Record payments'),
  ('finance.profitability.view',    'Finance',  'See profitability'),
  ('finance.settings.manage',       'Finance',  'Manage entities, channels and FX rates'),
  ('time.approve',                  'Time',     'Approve timesheets'),
  ('time.view',                     'Time',     'See logged time'),
  ('time.clients',                  'Time',     'See time by client'),
  ('hr.directory.view',             'Team',     'See the team directory'),
  ('calendar.use',                  'Core',     'Use the calendar'),
  ('chat.use',                      'Core',     'Use chat'),
  ('leadership.pulse.view',         'Core',     'See the CEO pulse panel'),
  ('admin.access.manage',           'Admin',    'Manage people, roles and invites')
on conflict (key) do nothing;

-- ---------------------------------------------------------------- role grants
-- super_admin needs no rows: has_perm() returns 'all' for it.
insert into public.role_permissions (role, perm_key, scope)
select 'admin', key, 'all' from public.permissions
on conflict do nothing;

insert into public.role_permissions (role, perm_key, scope) values
  -- finance head
  ('finance_head', 'finance.dashboard.view', 'all'),
  ('finance_head', 'finance.invoices.view', 'all'),
  ('finance_head', 'finance.invoices.create', 'all'),
  ('finance_head', 'finance.invoices.send', 'all'),
  ('finance_head', 'finance.invoices.void', 'all'),
  ('finance_head', 'finance.invoices.edit_issued', 'all'),
  ('finance_head', 'finance.invoices.record_past', 'all'),
  ('finance_head', 'finance.drafts.create', 'all'),
  ('finance_head', 'finance.payments.view', 'all'),
  ('finance_head', 'finance.payments.record', 'all'),
  ('finance_head', 'finance.profitability.view', 'all'),
  ('finance_head', 'finance.settings.manage', 'all'),
  ('finance_head', 'clients.view', 'all'),
  ('finance_head', 'clients.billing.view', 'all'),
  ('finance_head', 'clients.billing.edit', 'all'),
  ('finance_head', 'time.view', 'all'),
  ('finance_head', 'time.clients', 'all'),
  ('finance_head', 'hr.directory.view', 'all'),
  ('finance_head', 'calendar.use', 'own'),
  ('finance_head', 'chat.use', 'own'),
  -- department head
  ('dept_head', 'work.projects.manage', 'team'),
  ('dept_head', 'work.templates.manage', 'all'),
  ('dept_head', 'work.quality.view', 'team'),
  ('dept_head', 'clients.view', 'all'),
  ('dept_head', 'clients.manage', 'team'),
  ('dept_head', 'time.approve', 'team'),
  ('dept_head', 'time.view', 'team'),
  ('dept_head', 'time.clients', 'team'),
  ('dept_head', 'hr.directory.view', 'all'),
  ('dept_head', 'calendar.use', 'own'),
  ('dept_head', 'chat.use', 'own'),
  -- member
  ('member', 'clients.view', 'own'),
  ('member', 'time.view', 'own'),
  ('member', 'hr.directory.view', 'all'),
  ('member', 'calendar.use', 'own'),
  ('member', 'chat.use', 'own'),
  -- client owner / viewer ('own' = their own client only)
  ('client_owner', 'clients.billing.view', 'own'),
  ('client_owner', 'finance.invoices.view', 'own'),
  ('client_owner', 'chat.use', 'own'),
  ('client_viewer', 'chat.use', 'own')
on conflict do nothing;

-- ---------------------------------------------------------------- departments
insert into public.departments (id, name) values
  ('d0000000-0000-4000-8000-000000000001', 'Client Success'),
  ('d0000000-0000-4000-8000-000000000002', 'SEO'),
  ('d0000000-0000-4000-8000-000000000003', 'PPC'),
  ('d0000000-0000-4000-8000-000000000004', 'Web'),
  ('d0000000-0000-4000-8000-000000000005', 'Content'),
  ('d0000000-0000-4000-8000-000000000006', 'Finance'),
  ('d0000000-0000-4000-8000-000000000007', 'Design'),
  ('d0000000-0000-4000-8000-000000000008', 'Social'),
  ('d0000000-0000-4000-8000-000000000009', 'Leadership')
on conflict (id) do nothing;

-- ---------------------------------------------------------------- sample team (auth users + members)
with people (n, email, name, title, dept, presence) as (
  values
    (1,  'sara.malik@permanentseo.test',    'Sara Malik',    'Head of Client Success', 1, 'available'),
    (2,  'omar.haddad@permanentseo.test',   'Omar Haddad',   'SEO Lead',               2, 'focus'),
    (3,  'ayesha.khan@permanentseo.test',   'Ayesha Khan',   'PPC Specialist',         3, 'available'),
    (4,  'daniel.reyes@permanentseo.test',  'Daniel Reyes',  'Web Developer',          4, 'meeting'),
    (5,  'priya.nair@permanentseo.test',    'Priya Nair',    'Content Writer',         5, 'available'),
    (6,  'bilal.ahmed@permanentseo.test',   'Bilal Ahmed',   'Finance Manager',        6, 'available'),
    (7,  'lina.saeed@permanentseo.test',    'Lina Saeed',    'Designer',               7, 'away'),
    (8,  'hamza.qureshi@permanentseo.test', 'Hamza Qureshi', 'Account Executive',      1, 'available'),
    (9,  'zara.farooq@permanentseo.test',   'Zara Farooq',   'Social Media Manager',   8, 'sick'),
    (10, 'yusuf.ali@permanentseo.test',     'Yusuf Ali',     'CEO',                    9, 'available')
),
ids as (
  select p.*,
    ('00000000-0000-4000-8000-' || lpad(p.n::text, 12, '0'))::uuid as id,
    ('d0000000-0000-4000-8000-' || lpad(p.dept::text, 12, '0'))::uuid as dept_id
  from people p
),
u as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  )
  select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
    extensions.crypt('Portal-dev-2026', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('name', name), now(), now(),
    '', '', '', '', '', '', '', ''
  from ids
  on conflict (id) do nothing
  returning id
),
i as (
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select gen_random_uuid(), ids.id, ids.id::text,
    jsonb_build_object('sub', ids.id::text, 'email', ids.email, 'email_verified', true),
    'email', now(), now(), now()
  from ids join u on u.id = ids.id
  returning user_id
)
insert into public.members (id, email, name, title, department_id, presence, kind)
select ids.id, ids.email, ids.name, ids.title, ids.dept_id, ids.presence, 'staff'
from ids
where exists (select 1 from u where u.id = ids.id) or exists (select 1 from auth.users au where au.id = ids.id)
on conflict (id) do nothing;

-- Reporting lines: everyone reports to the CEO, except Hamza who reports to Sara.
update public.members set manager_id = '00000000-0000-4000-8000-000000000010'
where id <> '00000000-0000-4000-8000-000000000010' and manager_id is null
  and id <> '00000000-0000-4000-8000-000000000008';
update public.members set manager_id = '00000000-0000-4000-8000-000000000001'
where id = '00000000-0000-4000-8000-000000000008' and manager_id is null;

-- Department heads.
update public.departments d set head_id = h.member_id
from (values
  ('d0000000-0000-4000-8000-000000000001'::uuid, '00000000-0000-4000-8000-000000000001'::uuid),
  ('d0000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002'),
  ('d0000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000003'),
  ('d0000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000004'),
  ('d0000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000005'),
  ('d0000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000006'),
  ('d0000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000007'),
  ('d0000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000009'),
  ('d0000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000010')
) as h (dept_id, member_id)
where d.id = h.dept_id and d.head_id is null;

-- Roles: Yusuf super admin; Sara admin + department head; Bilal finance head; Omar department head; rest members.
insert into public.member_roles (member_id, role) values
  ('00000000-0000-4000-8000-000000000010', 'super_admin'),
  ('00000000-0000-4000-8000-000000000001', 'admin'),
  ('00000000-0000-4000-8000-000000000001', 'dept_head'),
  ('00000000-0000-4000-8000-000000000006', 'finance_head'),
  ('00000000-0000-4000-8000-000000000002', 'dept_head'),
  ('00000000-0000-4000-8000-000000000003', 'member'),
  ('00000000-0000-4000-8000-000000000004', 'member'),
  ('00000000-0000-4000-8000-000000000005', 'member'),
  ('00000000-0000-4000-8000-000000000007', 'member'),
  ('00000000-0000-4000-8000-000000000008', 'member'),
  ('00000000-0000-4000-8000-000000000009', 'member')
on conflict do nothing;

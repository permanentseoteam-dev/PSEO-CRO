-- Seed 0114_portal: client portal sample data for Alba Motors, matching docs/ui-preview/screens/portal.js.
-- The portal login is Karim Nassar (member 00000000-0000-4000-8000-000000000101, client_owner, from 0108 seed).
-- Today is 2026-11-04, times Asia/Dubai (+04).
-- Fixed ids:
--   approvals        e1400000-0000-4000-8000-0000000000NN
--   shared_activity  e1410000-0000-4000-8000-0000000000NN (approval lines come from the approvals trigger)
--   client_folders   e1420000-0000-4000-8000-000000000001 (Alba "Reports")
--   client_files     e1430000-0000-4000-8000-0000000000NN (Alba monthly reports)

-- ---------------------------------------------------------------- permission
insert into public.permissions (key, area, label) values
  ('portal.approve', 'Portal', 'Approve work in the client portal')
on conflict do nothing;
insert into public.role_permissions (role, perm_key, scope) values
  ('client_owner', 'portal.approve', 'own')
on conflict do nothing;

-- ---------------------------------------------------------------- portal_users
insert into public.portal_users (member_id, client_id, last_seen_at, invited_by)
select '00000000-0000-4000-8000-000000000101', 'c0000000-0000-4000-8000-000000000002', '2026-11-03 18:40+04',
  '00000000-0000-4000-8000-000000000001'
where exists (select 1 from public.members where id = '00000000-0000-4000-8000-000000000101')
on conflict do nothing;

-- ---------------------------------------------------------------- approvals
insert into public.approvals (id, client_id, ticket_id, title, body, files, status, sent_by, sent_at, decided_by, decided_at, change_note) values
  ('e1400000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002',
    (select id from public.tickets where key = 'ALB-88'), 'Winter service ad set',
    'Six Google and Meta ads for the winter service offer: free 25-point check with any oil change. Budget stays at AED 450 a day. Goes live 10 Nov once you approve.',
    '[{"name":"Search ads copy","type":"DOCX"},{"name":"Meta carousel","type":"PNG · 4 slides"},{"name":"Story video","type":"MP4 · 15s"}]',
    'waiting', '00000000-0000-4000-8000-000000000003', '2026-11-03 16:20+04', null, null, null),
  ('e1400000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002',
    (select id from public.tickets where key = 'ALB-90'), 'SUV range ad creatives',
    'New creative set for the SUV range: a clearer headline, one Book a test drive button and the red SUV photo you sent. The current ads keep running until you approve.',
    '[{"name":"Feed ad desktop","type":"PNG"},{"name":"Feed ad mobile","type":"PNG"}]',
    'waiting', '00000000-0000-4000-8000-000000000007', '2026-11-03 11:00+04', null, null, null),
  ('e1400000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002',
    null, 'November social calendar',
    'Twenty posts for November: five a week across Instagram and Facebook, with the winter service offer in week two.',
    '[{"name":"November calendar","type":"PDF"}]',
    'approved', '00000000-0000-4000-8000-000000000009', '2026-10-29 15:00+04',
    '00000000-0000-4000-8000-000000000101', '2026-10-30 09:40+04', null),
  ('e1400000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000002',
    null, 'October social calendar',
    'Twenty posts for October, with the Motor Show countdown in the last week.',
    '[{"name":"October calendar","type":"PDF"}]',
    'approved', '00000000-0000-4000-8000-000000000009', '2026-09-29 15:00+04',
    '00000000-0000-4000-8000-000000000101', '2026-09-30 10:15+04', null)
on conflict do nothing;

-- ---------------------------------------------------------------- shared_activity (besides the approval lines)
insert into public.shared_activity (id, client_id, actor_id, actor_name, action, href, visibility, happened_at) values
  ('e1410000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001',
    'Sara Malik', 'shared the October 2026 report', '/portal/files', 'shared', '2026-11-02 10:05+04'),
  ('e1410000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', null,
    'Rania Youssef', 'uploaded "Q4 price list.xlsx"', '/portal/files', 'shared', '2026-11-01 09:30+04'),
  ('e1410000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003',
    'Ayesha Khan', 'paused the low-performing "Used SUVs" ad group', null, 'shared', '2026-10-31 12:10+04'),
  ('e1410000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000101',
    'Karim Nassar', 'approved "November social calendar"', '/portal/work', 'shared', '2026-10-30 09:40+04'),
  ('e1410000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001',
    'Sara Malik', 'added notes from the 28 Oct monthly review', '/portal/meetings', 'shared', '2026-10-28 17:30+04'),
  ('e1410000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003',
    'Ayesha Khan', 'launched the winter service campaign', null, 'draft', '2026-11-04 09:00+04')
on conflict do nothing;

-- ---------------------------------------------------------------- Alba "Reports" folder and monthly reports
insert into public.client_folders (id, client_id, name, kind, client_visible, position, created_by) values
  ('e1420000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'Reports', 'custom', true, 20,
    '00000000-0000-4000-8000-000000000001')
on conflict do nothing;

insert into public.client_files (id, client_id, folder_id, name, shared, created_by, created_at, updated_at) values
  ('e1430000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'e1420000-0000-4000-8000-000000000001',
    'October 2026 report.pdf', true, '00000000-0000-4000-8000-000000000001', '2026-11-02 10:05+04', '2026-11-02 10:05+04'),
  ('e1430000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 'e1420000-0000-4000-8000-000000000001',
    'September 2026 report.pdf', true, '00000000-0000-4000-8000-000000000001', '2026-10-03 10:00+04', '2026-10-03 10:00+04'),
  ('e1430000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000002', 'e1420000-0000-4000-8000-000000000001',
    'Q3 2026 review.pdf', true, '00000000-0000-4000-8000-000000000001', '2026-10-06 12:00+04', '2026-10-06 12:00+04')
on conflict do nothing;

insert into public.file_versions (file_id, version, path, size_bytes, mime, uploaded_by, created_at) values
  ('e1430000-0000-4000-8000-000000000001', 1, 'c0000000-0000-4000-8000-000000000002/seed-portal-October-2026-report.pdf',
    2516582, 'application/pdf', '00000000-0000-4000-8000-000000000001', '2026-11-02 10:05+04'),
  ('e1430000-0000-4000-8000-000000000002', 1, 'c0000000-0000-4000-8000-000000000002/seed-portal-September-2026-report.pdf',
    2202009, 'application/pdf', '00000000-0000-4000-8000-000000000001', '2026-10-03 10:00+04'),
  ('e1430000-0000-4000-8000-000000000003', 1, 'c0000000-0000-4000-8000-000000000002/seed-portal-Q3-2026-review.pdf',
    3984588, 'application/pdf', '00000000-0000-4000-8000-000000000001', '2026-10-06 12:00+04')
on conflict do nothing;

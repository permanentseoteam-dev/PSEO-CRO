-- 0102_access seed: invites and audit lines matching the Settings > Admin mockup.
-- Fixed ids: invites a0200000-0000-4000-8000-0000000000NN, audit a0210000-0000-4000-8000-0000000000NN.
-- Dev invite links (token = text after /invite/): /invite/seed-faisal (staff), /invite/seed-alba (client, Alba Motors).

insert into public.invites (id, email, name, role, department_id, client_id, token_hash, status, invited_by, sent_at, expires_at, accepted_at) values
  ('a0200000-0000-4000-8000-000000000001', 'noor@permanentseo.ae', 'Noor Hassan', 'member', 'd0000000-0000-4000-8000-000000000005', null,
   encode(sha256('seed-noor'::bytea), 'hex'), 'accepted', '00000000-0000-4000-8000-000000000010',
   '2026-11-02 08:30+04', '2026-11-16 08:30+04', '2026-11-02 11:05+04'),
  ('a0200000-0000-4000-8000-000000000002', 'faisal@permanentseo.ae', 'Faisal Rahman', 'member', 'd0000000-0000-4000-8000-000000000002', null,
   encode(sha256('seed-faisal'::bytea), 'hex'), 'pending', '00000000-0000-4000-8000-000000000001',
   '2026-10-27 10:00+04', '2026-11-10 10:00+04', null),
  ('a0200000-0000-4000-8000-000000000003', 'marketing@albamotors.ae', 'Alba Motors marketing', 'client_viewer', null, 'c0000000-0000-4000-8000-000000000002',
   encode(sha256('seed-alba'::bytea), 'hex'), 'pending', '00000000-0000-4000-8000-000000000001',
   '2026-10-30 14:20+04', '2026-11-13 14:20+04', null)
on conflict do nothing;

insert into public.audit_log (id, actor_id, action, summary, target_type, target_id, created_at) values
  ('a0210000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'roles.permission',
   'Changed time.approve for Department head to team', 'role', 'dept_head', '2026-11-04 09:14+04'),
  ('a0210000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000006', 'invoice.void',
   'Voided invoice INV-1042', 'invoice', 'INV-1042', '2026-11-04 08:02+04'),
  ('a0210000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000010', 'invite.create',
   'Invited noor@permanentseo.ae as Member', 'invite', 'a0200000-0000-4000-8000-000000000001', '2026-11-03 17:40+04'),
  ('a0210000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002', 'project.archive',
   'Archived project LUM-Q2', 'project', 'LUM-Q2', '2026-11-03 11:05+04'),
  ('a0210000-0000-4000-8000-000000000005', null, 'tickets.recurring',
   'Created 6 recurring tickets', null, null, '2026-11-01 10:00+04'),
  ('a0210000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000001', 'invite.create',
   'Invited marketing@albamotors.ae as Client viewer', 'invite', 'a0200000-0000-4000-8000-000000000003', '2026-10-30 14:20+04'),
  ('a0210000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000001', 'invite.create',
   'Invited faisal@permanentseo.ae as Member', 'invite', 'a0200000-0000-4000-8000-000000000002', '2026-10-27 10:00+04')
on conflict do nothing;

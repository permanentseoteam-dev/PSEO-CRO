-- Seed for 0101_shell: the bell, pins and settings shown in the mockup.
-- Fixed ids: notifications 01010000-0000-4000-8000-0000000000NN. Today is 2026-11-04 (Dubai, UTC+4).
-- Members: 01 Sara Malik (the mockup's "me"), 02 Omar, 03 Ayesha, 04 Daniel, 05 Priya, 06 Bilal, 08 Hamza, 10 Yusuf.

insert into public.notifications (id, member_id, actor_id, kind, action, subject, detail, href, read_at, created_at) values
  -- Sara Malik: the six unread items from the mockup's bell
  ('01010000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
   'ticket', 'moved', 'CPD-142', 'to In review', '/t/CPD-142', null, '2026-11-04 10:38:00+00'),
  ('01010000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003',
   'mention', 'mentioned you on', 'ALB-88 Q4 ad copy', null, '/t/ALB-88', null, '2026-11-04 10:20:00+00'),
  ('01010000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000006',
   'invoice', 'marked invoice', 'INV-2041', 'as paid', '/finance/invoices', null, '2026-11-04 09:44:00+00'),
  ('01010000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000008',
   'client', 'flagged', 'Luma Skincare', 'as at risk', '/clients/c0000000-0000-4000-8000-000000000003', null, '2026-11-04 08:44:00+00'),
  ('01010000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005',
   'review', 'asked for a review on', 'LUM-57 blog draft', null, '/reviews', null, '2026-11-04 07:44:00+00'),
  ('01010000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004',
   'meeting', 'booked', 'Harbor Legal launch call', 'for Thu 10:00', '/meetings', null, '2026-11-03 12:15:00+00'),
  -- Sara Malik: older, already read
  ('01010000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000009',
   'ticket', 'finished', 'NOV-19 November content calendar', null, '/t/NOV-19', '2026-11-02 09:00:00+00', '2026-11-02 06:30:00+00'),
  ('01010000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000010',
   'system', 'shared the', 'Q4 client review deck', null, '/files', '2026-11-01 08:00:00+00', '2026-10-31 13:10:00+00'),
  -- Others
  ('01010000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001',
   'ticket', 'assigned you', 'CPD-142 Fix crawl errors on service pages', null, '/t/CPD-142', null, '2026-11-03 05:30:00+00'),
  ('01010000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001',
   'review', 'returned', 'ALB-88 Q4 ad copy', 'with changes', '/t/ALB-88', null, '2026-11-04 09:05:00+00'),
  ('01010000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000008',
   'invoice', 'asked you to send', 'INV-2044 Zest Kitchen', null, '/finance/invoices', null, '2026-11-04 06:50:00+00'),
  ('01010000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000008', null,
   'client', 'Reply due today for', 'Luma Skincare', null, '/response-times', null, '2026-11-04 05:00:00+00')
on conflict (id) do nothing;

insert into public.pins (member_id, href, title, position) values
  ('00000000-0000-4000-8000-000000000001', '/tickets', 'Tickets', 0),
  ('00000000-0000-4000-8000-000000000001', '/clients', 'Clients', 1),
  ('00000000-0000-4000-8000-000000000001', '/finance/invoices', 'Invoices', 2),
  ('00000000-0000-4000-8000-000000000002', '/tickets', 'Tickets', 0),
  ('00000000-0000-4000-8000-000000000006', '/finance/invoices', 'Invoices', 0),
  ('00000000-0000-4000-8000-000000000006', '/finance/payments', 'Payments', 1)
on conflict (member_id, href) do nothing;

insert into public.user_settings (member_id, theme, density, sidebar_collapsed, folded_groups, email_digest, quiet_from, quiet_to) values
  ('00000000-0000-4000-8000-000000000001', 'system', 'comfortable', false, '{}', 'daily', '21:00', '08:00'),
  ('00000000-0000-4000-8000-000000000002', 'dark', 'comfortable', false, '{Finance}', 'urgent', null, null),
  ('00000000-0000-4000-8000-000000000006', 'light', 'compact', false, '{}', 'daily', null, null),
  ('00000000-0000-4000-8000-000000000010', 'system', 'comfortable', true, '{}', 'off', null, null)
on conflict (member_id) do nothing;

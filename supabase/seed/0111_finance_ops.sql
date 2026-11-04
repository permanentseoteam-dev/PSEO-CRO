-- Seed 0111_finance_ops: billing profiles, payments received, allocations, client credit, reminders, salaries and
-- some logged time for profitability. Matches the finance mockup (payments, billing-clients, payment-reminders).
-- Fixed ids:
--   receipts       f4000000-0000-4000-8000-00000000NNNN  NNNN = receipt number (1089 = P-1089)
--   reminders      f5000000-0000-4000-8000-0000000000NN
--   time_entries   f6000000-... (generated, see the bottom)
--   salaries       f7000000-0000-4000-8000-0000000000NN  NN = member number
-- Invoices (f3...), entities (f1...), channels (f2...) come from 0110; clients (c0...) from 0108.
-- invoices.amount_paid in 0110 already includes these payments, so the rows below are inserted directly
-- (record_payment() would count them twice).

-- ---------------------------------------------------------------- billing profiles
insert into public.billing_profiles (client_id, legal_name, contact, billing_email, cc, country, address, tax_id, entity_id, currency,
  channel_id, terms_days, agreed_fee, fee_basis, hours_budget, notes, auto_reminders) values
  ('c0000000-0000-4000-8000-000000000001', 'Cedar and Pine Dental Clinic LLC', 'Dr. Rania Aziz', 'accounts@cedarpine.ae', 'rania@cedarpine.ae',
    'United Arab Emirates', 'Villa 14, Al Wasl Road, Jumeirah 1, Dubai', 'TRN 100229384700003', 'f1000000-0000-4000-8000-000000000001', 'AED',
    'f2000000-0000-4000-8000-000000000004', 14, 9500, 'monthly', 60, 'Send PDF to both emails. PO not needed.', true),
  ('c0000000-0000-4000-8000-000000000002', 'Alba Motors Trading LLC', 'Khalid Mansour', 'ap@albamotors.ae', 'khalid@albamotors.ae',
    'United Arab Emirates', 'Showroom 3, Sheikh Zayed Road, Al Quoz, Dubai', 'TRN 100482911200003', 'f1000000-0000-4000-8000-000000000001', 'AED',
    'f2000000-0000-4000-8000-000000000004', 14, 14000, 'monthly', 70, 'Quote PO on every invoice. Pays by cheque sometimes.', true),
  ('c0000000-0000-4000-8000-000000000003', 'Luma Skincare Inc.', 'Megan Ortiz', 'finance@lumaskin.co', '',
    'United States', '88 Pine Street, Suite 400, New York, NY 10005', 'EIN 47-2210934', 'f1000000-0000-4000-8000-000000000002', 'USD',
    'f2000000-0000-4000-8000-000000000003', 14, 4200, 'monthly', 80, 'October invoice disputed. Hold reminders until resolved.', false),
  ('c0000000-0000-4000-8000-000000000004', 'Harbor Legal Partners PLLC', 'James Whitaker', 'billing@harborlegal.com', 'jw@harborlegal.com',
    'United States', '200 State Street, Boston, MA 02109', 'EIN 83-1127745', 'f1000000-0000-4000-8000-000000000002', 'USD',
    'f2000000-0000-4000-8000-000000000001', 14, 3000, 'one_time', 70, 'Website billed by milestone.', true),
  ('c0000000-0000-4000-8000-000000000005', 'Nova Fitness Studios FZ-LLC', 'Leila Haddad', 'hello@novafit.ae', '',
    'United Arab Emirates', 'Unit 6, Alserkal Avenue, Al Quoz, Dubai', 'TRN 100771203300003', 'f1000000-0000-4000-8000-000000000001', 'AED',
    'f2000000-0000-4000-8000-000000000001', 14, 6000, 'monthly', 40, 'New client since September.', true),
  ('c0000000-0000-4000-8000-000000000006', 'Zest Kitchen (Pvt) Ltd', 'Faisal Raza', 'accounts@zestkitchen.pk', 'faisal@zestkitchen.pk',
    'Pakistan', '12-C, Lane 5, DHA Phase 6, Karachi', 'NTN 4471209-3', 'f1000000-0000-4000-8000-000000000003', 'PKR',
    'f2000000-0000-4000-8000-000000000005', 7, 450000, 'monthly', 40, 'Agreed payment plan for July balance.', true)
on conflict do nothing;

-- ---------------------------------------------------------------- receipts
insert into public.receipts (id, receipt_no, client_id, received_on, currency, amount, fee, landed_amount, fx_rate_usd, channel_id, account,
  reference, note, proof_paths, no_proof_reason, created_by, created_at) values
  ('f4000000-0000-4000-8000-000000001089', 1089, 'c0000000-0000-4000-8000-000000000004', '2026-11-02', 'USD', 250, 3, 247, 1,
    'f2000000-0000-4000-8000-000000000001', 'Wise USD ••7720', 'WISE-88213', 'Paid ahead for hosting', '{seed/P-1089.pdf}', null, '00000000-0000-4000-8000-000000000006', '2026-11-02 12:00+04'),
  ('f4000000-0000-4000-8000-000000001088', 1088, 'c0000000-0000-4000-8000-000000000001', '2026-11-03', 'AED', 4000, 0, 4000, 0.2723,
    'f2000000-0000-4000-8000-000000000004', 'ENBD AED ••4410', 'FT26307ENBD119', null, '{seed/P-1088.pdf}', null, '00000000-0000-4000-8000-000000000006', '2026-11-03 14:12+04'),
  ('f4000000-0000-4000-8000-000000001087', 1087, 'c0000000-0000-4000-8000-000000000004', '2026-10-28', 'USD', 1500, 51.30, 1448.70, 1,
    'f2000000-0000-4000-8000-000000000002', 'PayPal billing@permanentseo.com', '5TY81203KP', null, '{seed/P-1087.pdf}', null, '00000000-0000-4000-8000-000000000006', '2026-10-28 15:00+04'),
  ('f4000000-0000-4000-8000-000000001086', 1086, 'c0000000-0000-4000-8000-000000000002', '2026-10-22', 'AED', 6000, 0, 6000, 0.2723,
    'f2000000-0000-4000-8000-000000000004', 'ENBD AED ••4410', 'Cheque 004418', null, '{}', 'Cheque handed to Sara at the showroom, scan to follow', '00000000-0000-4000-8000-000000000006', '2026-10-22 13:00+04'),
  ('f4000000-0000-4000-8000-000000001085', 1085, 'c0000000-0000-4000-8000-000000000001', '2026-10-14', 'AED', 9975, 0, 9975, 0.2722,
    'f2000000-0000-4000-8000-000000000004', 'ENBD AED ••4410', 'FT26287ENBD042', null, '{seed/P-1085.pdf}', null, '00000000-0000-4000-8000-000000000006', '2026-10-14 11:00+04'),
  ('f4000000-0000-4000-8000-000000001084', 1084, 'c0000000-0000-4000-8000-000000000005', '2026-09-12', 'AED', 6300, 38, 6262, 0.2723,
    'f2000000-0000-4000-8000-000000000001', 'Wise USD ••7720', 'WISE-80117', null, '{seed/P-1084.pdf}', null, '00000000-0000-4000-8000-000000000006', '2026-09-12 10:00+04'),
  ('f4000000-0000-4000-8000-000000001083', 1083, 'c0000000-0000-4000-8000-000000000003', '2026-09-20', 'USD', 4200, 121.80, 4078.20, 1,
    'f2000000-0000-4000-8000-000000000003', 'Slash card ••3391', 'SL-55120', null, '{seed/P-1083.pdf}', null, '00000000-0000-4000-8000-000000000006', '2026-09-20 16:00+04'),
  ('f4000000-0000-4000-8000-000000001082', 1082, 'c0000000-0000-4000-8000-000000000002', '2026-09-14', 'AED', 14700, 0, 14700, 0.2723,
    'f2000000-0000-4000-8000-000000000004', 'ENBD AED ••4410', 'FT26257ENBD301', null, '{seed/P-1082.pdf}', null, '00000000-0000-4000-8000-000000000006', '2026-09-14 09:40+04'),
  ('f4000000-0000-4000-8000-000000001081', 1081, 'c0000000-0000-4000-8000-000000000006', '2026-09-08', 'PKR', 450000, 4500, 445500, 0.0036,
    'f2000000-0000-4000-8000-000000000005', 'Payoneer PKR ••0915', 'PYN-2209184', null, '{}', 'Payoneer statement not exported yet', '00000000-0000-4000-8000-000000000006', '2026-09-08 12:00+04'),
  ('f4000000-0000-4000-8000-000000001080', 1080, 'c0000000-0000-4000-8000-000000000004', '2026-08-18', 'USD', 3000, 19, 2981, 1,
    'f2000000-0000-4000-8000-000000000001', 'Wise USD ••7720', 'WISE-77310', null, '{seed/P-1080.pdf}', null, '00000000-0000-4000-8000-000000000006', '2026-08-18 12:00+04'),
  ('f4000000-0000-4000-8000-000000001079', 1079, 'c0000000-0000-4000-8000-000000000006', '2026-08-05', 'PKR', 200000, 0, 200000, 0.0036,
    'f2000000-0000-4000-8000-000000000006', 'HBL cash deposit', 'HBL slip 77102', null, '{seed/P-1079.jpg}', null, '00000000-0000-4000-8000-000000000006', '2026-08-05 12:00+04')
on conflict do nothing;

insert into public.receipt_allocations (receipt_id, invoice_id, amount) values
  ('f4000000-0000-4000-8000-000000001088', 'f3000000-0000-4000-8000-000000000142', 4000),
  ('f4000000-0000-4000-8000-000000001087', 'f3000000-0000-4000-8000-000000000256', 1500),
  ('f4000000-0000-4000-8000-000000001086', 'f3000000-0000-4000-8000-000000000141', 6000),
  ('f4000000-0000-4000-8000-000000001085', 'f3000000-0000-4000-8000-000000000139', 9975),
  ('f4000000-0000-4000-8000-000000001084', 'f3000000-0000-4000-8000-000000000136', 6300),
  ('f4000000-0000-4000-8000-000000001083', 'f3000000-0000-4000-8000-000000000257', 4200),
  ('f4000000-0000-4000-8000-000000001082', 'f3000000-0000-4000-8000-000000000138', 14700),
  ('f4000000-0000-4000-8000-000000001081', 'f3000000-0000-4000-8000-000000000330', 450000),
  ('f4000000-0000-4000-8000-000000001080', 'f3000000-0000-4000-8000-000000000253', 3000),
  ('f4000000-0000-4000-8000-000000001079', 'f3000000-0000-4000-8000-000000000329', 200000)
on conflict do nothing;

insert into public.client_credit (id, client_id, currency, amount, receipt_id, note, created_by, created_at) values
  ('f4100000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000004', 'USD', 250, 'f4000000-0000-4000-8000-000000001089',
    'Left over from P-1089', '00000000-0000-4000-8000-000000000006', '2026-11-02 12:00+04'),
  ('f4100000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 'AED', 1200, null,
    'Overpayment on INV-PS-0130', '00000000-0000-4000-8000-000000000006', '2026-06-12 12:00+04')
on conflict do nothing;

-- ---------------------------------------------------------------- reminders
insert into public.reminders (id, invoice_id, stage, send_on, status, auto, paused_until, pause_note, sent_at, sent_by, result) values
  -- due today
  ('f5000000-0000-4000-8000-000000000001', 'f3000000-0000-4000-8000-000000000143', 'before', '2026-11-04', 'pending', true, null, null, null, null, null),
  ('f5000000-0000-4000-8000-000000000002', 'f3000000-0000-4000-8000-000000000256', 'late_1', '2026-11-04', 'pending', true, null, null, null, null, null),
  ('f5000000-0000-4000-8000-000000000003', 'f3000000-0000-4000-8000-000000000140', 'late_14', '2026-11-04', 'pending', false, null, null, null, null, null),
  ('f5000000-0000-4000-8000-000000000004', 'f3000000-0000-4000-8000-000000000331', 'late_30', '2026-11-04', 'pending', true, null, null, null, null, null),
  -- paused
  ('f5000000-0000-4000-8000-000000000005', 'f3000000-0000-4000-8000-000000000258', 'late_14', '2026-10-31', 'pending', false, '2026-11-20',
    'Disputed. Waiting for the ad spend breakdown from Megan.', null, null, null),
  ('f5000000-0000-4000-8000-000000000006', 'f3000000-0000-4000-8000-000000000329', 'late_30', '2026-08-07', 'pending', true, '2026-12-01',
    'Payment plan agreed: PKR 125,000 a month from November.', null, null, null),
  -- upcoming
  ('f5000000-0000-4000-8000-000000000007', 'f3000000-0000-4000-8000-000000000142', 'before', '2026-11-12', 'pending', true, null, null, null, null, null),
  ('f5000000-0000-4000-8000-000000000008', 'f3000000-0000-4000-8000-000000000141', 'late_30', '2026-11-14', 'pending', true, null, null, null, null, null),
  ('f5000000-0000-4000-8000-000000000009', 'f3000000-0000-4000-8000-000000000143', 'late_1', '2026-11-08', 'pending', true, null, null, null, null, null),
  ('f5000000-0000-4000-8000-000000000010', 'f3000000-0000-4000-8000-000000000255', 'before', '2026-11-27', 'pending', true, null, null, null, null, null),
  -- recent
  ('f5000000-0000-4000-8000-000000000011', 'f3000000-0000-4000-8000-000000000141', 'late_14', '2026-10-29', 'sent', true, null, null,
    '2026-10-29 10:00+04', null, 'Opened twice'),
  ('f5000000-0000-4000-8000-000000000012', 'f3000000-0000-4000-8000-000000000331', 'late_14', '2026-10-19', 'sent', true, null, null,
    '2026-10-19 10:00+04', null, 'Delivered'),
  ('f5000000-0000-4000-8000-000000000013', 'f3000000-0000-4000-8000-000000000140', 'late_7', '2026-10-28', 'sent', false, null, null,
    '2026-10-28 10:00+04', '00000000-0000-4000-8000-000000000006', 'Opened'),
  ('f5000000-0000-4000-8000-000000000014', 'f3000000-0000-4000-8000-000000000258', 'late_7', '2026-10-24', 'sent', false, null, null,
    '2026-10-24 09:30+04', '00000000-0000-4000-8000-000000000006', 'Reply received')
on conflict do nothing;

-- ---------------------------------------------------------------- salaries (monthly, from 1 Jan 2026)
insert into public.salaries (id, member_id, monthly_amount, currency, valid_from, created_by) values
  ('f7000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 11000, 'AED', '2026-01-01', '00000000-0000-4000-8000-000000000006'),
  ('f7000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 3400, 'USD', '2026-01-01', '00000000-0000-4000-8000-000000000006'),
  ('f7000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000003', 3000, 'USD', '2026-01-01', '00000000-0000-4000-8000-000000000006'),
  ('f7000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000004', 2900, 'USD', '2026-01-01', '00000000-0000-4000-8000-000000000006'),
  ('f7000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000005', 2100, 'USD', '2026-01-01', '00000000-0000-4000-8000-000000000006'),
  ('f7000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000006', 2600, 'USD', '2026-01-01', '00000000-0000-4000-8000-000000000006'),
  ('f7000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000007', 2200, 'USD', '2026-01-01', '00000000-0000-4000-8000-000000000006'),
  ('f7000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000008', 2200, 'USD', '2026-01-01', '00000000-0000-4000-8000-000000000006'),
  ('f7000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000009', 2000, 'USD', '2026-01-01', '00000000-0000-4000-8000-000000000006'),
  ('f7000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000010', 6000, 'USD', '2026-01-01', '00000000-0000-4000-8000-000000000006')
on conflict do nothing;

-- ---------------------------------------------------------------- logged time for profitability (Jun to Nov 2026)
-- For each delivery person on a client team: a few entries a month on one of that client's tickets.
-- Hours vary by client and month so margins differ. November is part month (up to 4 Nov).
insert into public.time_entries (id, member_id, ticket_id, date, minutes, billable, note)
select
  ('f6000000-0000-4000-8000-' || lpad((row_number() over (order by ct.client_id, ct.member_id, m.mon, w.wk))::text, 12, '0'))::uuid,
  ct.member_id, t.id,
  case when m.mon = 11 then make_date(2026, 11, least(w.wk, 4)) else make_date(2026, m.mon, w.wk * 6) end,
  (180 + (abs(hashtext(ct.client_id::text || ct.member_id::text || m.mon::text || w.wk::text)) % 240))::int,
  true, 'Client work'
from public.client_team ct
join lateral (
  select tk.id from public.tickets tk where tk.client_id = ct.client_id order by tk.created_at limit 1
) t on true
cross join generate_series(6, 11) as m(mon)
cross join generate_series(1, 4) as w(wk)
where ct.role in ('delivery_lead', 'delivery')
  and ct.client_id in (select id from public.clients where status in ('active', 'onboarding'))
  and not (m.mon = 11 and w.wk > 2)
on conflict do nothing;

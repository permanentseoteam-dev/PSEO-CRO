-- Seed 0110_finance_core: entities, payment channels, FX rates and the invoices from the finance mockup.
-- Fixed ids so other modules can refer to them:
--   entities      f1000000-0000-4000-8000-0000000000NN  01 FZ-LLC (PS), 02 LLC (PU), 03 Pvt Ltd (PK)
--   channels_pay  f2000000-0000-4000-8000-0000000000NN  01 Wise, 02 PayPal, 03 Slash, 04 Bank ENBD, 05 Payoneer, 06 Other
--   invoices      f3000000-0000-4000-8000-000000000NNN  NNN = invoice number digits (142 = INV-PS-0142);
--                 PU invoices use 2NN (256 = INV-PU-0056), PK use 3NN (331 = INV-PK-0031), drafts 9NN (918 = Draft 18).
-- Clients come from 0108_clients (c0000000-...-0000000000NN). Bilal Ahmed (finance head) is member 06.

insert into public.entities (id, code, name, short_name, country, address, tax_id, invoice_prefix, tax_label, tax_rate, currency, next_number) values
  ('f1000000-0000-4000-8000-000000000001', 'ps', 'Permanent SEO FZ-LLC', 'FZ-LLC (UAE)', 'United Arab Emirates',
    'Office 1204, Silicon Oasis HQ, Dubai', 'TRN 100384729100003', 'PS', 'VAT', 5, 'AED', 144),
  ('f1000000-0000-4000-8000-000000000002', 'pu', 'Permanent SEO LLC', 'LLC (US)', 'United States',
    '1209 Orange Street, Wilmington, DE 19801', 'EIN 88-4410273', 'PU', 'None', 0, 'USD', 59),
  ('f1000000-0000-4000-8000-000000000003', 'pk', 'Permanent SEO Pvt Ltd', 'Pvt Ltd (PK)', 'Pakistan',
    '42 Main Boulevard, Gulberg III, Lahore', 'NTN 7734120-6', 'PK', 'GST', 0, 'PKR', 32)
on conflict do nothing;

insert into public.channels_pay (id, name, type, account, details, fee_note) values
  ('f2000000-0000-4000-8000-000000000001', 'Wise', 'wise', 'Wise USD ••7720', 'Account 8310 0472 7720, routing 026073150, Wise US Inc.', '0.6% + USD 1'),
  ('f2000000-0000-4000-8000-000000000002', 'PayPal', 'paypal', 'PayPal billing@permanentseo.com', 'Pay link sent per invoice. Goods and services.', '3.4% + USD 0.30'),
  ('f2000000-0000-4000-8000-000000000003', 'Slash', 'slash', 'Slash card ••3391', 'Virtual card for card payments, USD only.', '2.9%'),
  ('f2000000-0000-4000-8000-000000000004', 'Bank ENBD', 'bank', 'ENBD AED ••4410', 'Emirates NBD, IBAN AE07 0260 0010 1544 1040 001, SWIFT EBILAEAD', 'None'),
  ('f2000000-0000-4000-8000-000000000005', 'Payoneer', 'payoneer', 'Payoneer PKR ••0915', 'Receiving account for PKR and USD clients in Pakistan.', '1%'),
  ('f2000000-0000-4000-8000-000000000006', 'Other', 'other', 'HBL cash deposit', 'Cash or cheque deposits at HBL Gulberg branch.', 'None')
on conflict do nothing;

insert into public.fx_rates (currency, rate_to_usd, valid_from, created_by) values
  ('USD', 1, '2026-01-01', '00000000-0000-4000-8000-000000000006'),
  ('AED', 0.2723, '2026-01-01', '00000000-0000-4000-8000-000000000006'),
  ('PKR', 0.0036, '2026-01-01', '00000000-0000-4000-8000-000000000006')
on conflict do nothing;

-- ---------------------------------------------------------------- invoices
-- Columns: id, number, draft_no, client, entity, currency, status, issued, due, title, po, subtotal, tax, total,
--          paid, refunded, written off, fx rate, channel, pay link, status reason, bill_to
insert into public.invoices (id, number, draft_no, client_id, entity_id, currency, status, issued_on, due_on, title, po_ref,
  subtotal, tax_total, total, amount_paid, amount_refunded, written_off_amount, fx_rate_usd, channel_id, pay_link, status_reason,
  notes, terms, bill_to, created_by, issued_by, issued_at) values
  ('f3000000-0000-4000-8000-000000000143', 'INV-PS-0143', 1, 'c0000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000001', 'AED', 'issued',
    '2026-11-03', '2026-11-07', 'November ads management', 'ALBA-PO-7781', 14000, 700, 14700, 0, 0, 0, 0.2723, 'f2000000-0000-4000-8000-000000000004', null, null,
    'Thank you for your business. Please quote the invoice number with your transfer.', 'Payment due within 14 days. Late balances get reminders at 1, 7, 14 and 30 days.',
    '{"name":"Alba Motors Trading LLC","contact":"Khalid Mansour","address":"Showroom 3, Sheikh Zayed Road, Al Quoz, Dubai","tax_id":"TRN 100482911200003","email":"ap@albamotors.ae","cc":"khalid@albamotors.ae"}',
    '00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000006', '2026-11-03 09:30+04'),
  ('f3000000-0000-4000-8000-000000000142', 'INV-PS-0142', 2, 'c0000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', 'AED', 'partly_paid',
    '2026-11-01', '2026-11-15', 'November SEO and content', 'CPD-SEO-2026-11', 9500, 475, 9975, 4000, 0, 0, 0.2723, 'f2000000-0000-4000-8000-000000000004', 'https://wise.com/pay/r/PS0142cedar', null,
    'Thank you for your business. Please quote the invoice number with your transfer.', 'Payment due within 14 days. Late balances get reminders at 1, 7, 14 and 30 days.',
    '{"name":"Cedar and Pine Dental Clinic LLC","contact":"Dr. Rania Aziz","address":"Villa 14, Al Wasl Road, Jumeirah 1, Dubai","tax_id":"TRN 100229384700003","email":"accounts@cedarpine.ae","cc":"rania@cedarpine.ae"}',
    '00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000006', '2026-11-01 10:04+04'),
  ('f3000000-0000-4000-8000-000000000141', 'INV-PS-0141', 3, 'c0000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000001', 'AED', 'partly_paid',
    '2026-10-01', '2026-10-15', 'October ads management', 'ALBA-PO-7702', 14000, 700, 14700, 6000, 0, 0, 0.2723, 'f2000000-0000-4000-8000-000000000004', null, null,
    'Thank you for your business. Please quote the invoice number with your transfer.', 'Payment due within 14 days. Late balances get reminders at 1, 7, 14 and 30 days.',
    '{"name":"Alba Motors Trading LLC","contact":"Khalid Mansour","address":"Showroom 3, Sheikh Zayed Road, Al Quoz, Dubai","tax_id":"TRN 100482911200003","email":"ap@albamotors.ae","cc":"khalid@albamotors.ae"}',
    '00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000006', '2026-10-01 09:12+04'),
  ('f3000000-0000-4000-8000-000000000140', 'INV-PS-0140', 4, 'c0000000-0000-4000-8000-000000000005', 'f1000000-0000-4000-8000-000000000001', 'AED', 'issued',
    '2026-10-07', '2026-10-21', 'October social and content', null, 6000, 300, 6300, 0, 0, 0, 0.2723, 'f2000000-0000-4000-8000-000000000001', null, null,
    'Thank you for your business.', 'Payment due within 14 days.',
    '{"name":"Nova Fitness Studios FZ-LLC","contact":"Leila Haddad","address":"Unit 6, Alserkal Avenue, Al Quoz, Dubai","tax_id":"TRN 100771203300003","email":"hello@novafit.ae","cc":""}',
    '00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000006', '2026-10-07 11:00+04'),
  ('f3000000-0000-4000-8000-000000000139', 'INV-PS-0139', 5, 'c0000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', 'AED', 'paid',
    '2026-10-01', '2026-10-15', 'October SEO and content', 'CPD-SEO-2026-10', 9500, 475, 9975, 9975, 0, 0, 0.2722, 'f2000000-0000-4000-8000-000000000004', null, null,
    'Thank you for your business. Please quote the invoice number with your transfer.', 'Payment due within 14 days.',
    '{"name":"Cedar and Pine Dental Clinic LLC","contact":"Dr. Rania Aziz","address":"Villa 14, Al Wasl Road, Jumeirah 1, Dubai","tax_id":"TRN 100229384700003","email":"accounts@cedarpine.ae","cc":"rania@cedarpine.ae"}',
    '00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000006', '2026-10-01 09:10+04'),
  ('f3000000-0000-4000-8000-000000000138', 'INV-PS-0138', 6, 'c0000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000001', 'AED', 'paid',
    '2026-09-01', '2026-09-15', 'September ads management', 'ALBA-PO-7640', 14000, 700, 14700, 14700, 0, 0, 0.2723, 'f2000000-0000-4000-8000-000000000004', null, null,
    'Thank you for your business.', 'Payment due within 14 days.',
    '{"name":"Alba Motors Trading LLC","contact":"Khalid Mansour","address":"Showroom 3, Sheikh Zayed Road, Al Quoz, Dubai","tax_id":"TRN 100482911200003","email":"ap@albamotors.ae","cc":"khalid@albamotors.ae"}',
    '00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000006', '2026-09-01 09:20+04'),
  ('f3000000-0000-4000-8000-000000000137', 'INV-PS-0137', 7, 'c0000000-0000-4000-8000-000000000002', 'f1000000-0000-4000-8000-000000000001', 'AED', 'void',
    '2026-08-20', '2026-09-03', 'Showroom launch shoot', null, 3000, 150, 3150, 0, 0, 0, 0.2723, 'f2000000-0000-4000-8000-000000000004', null, 'Raised twice, replaced by INV-PS-0138',
    null, 'Payment due within 14 days.',
    '{"name":"Alba Motors Trading LLC","contact":"Khalid Mansour","address":"Showroom 3, Sheikh Zayed Road, Al Quoz, Dubai","tax_id":"TRN 100482911200003","email":"ap@albamotors.ae","cc":"khalid@albamotors.ae"}',
    '00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000006', '2026-08-20 15:40+04'),
  ('f3000000-0000-4000-8000-000000000136', 'INV-PS-0136', 8, 'c0000000-0000-4000-8000-000000000005', 'f1000000-0000-4000-8000-000000000001', 'AED', 'partly_refunded',
    '2026-09-01', '2026-09-15', 'September social and content', null, 6000, 300, 6300, 6300, 1260, 0, 0.2723, 'f2000000-0000-4000-8000-000000000001', null, null,
    'Thank you for your business.', 'Payment due within 14 days.',
    '{"name":"Nova Fitness Studios FZ-LLC","contact":"Leila Haddad","address":"Unit 6, Alserkal Avenue, Al Quoz, Dubai","tax_id":"TRN 100771203300003","email":"hello@novafit.ae","cc":""}',
    '00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000006', '2026-09-01 10:30+04'),
  ('f3000000-0000-4000-8000-000000000258', 'INV-PU-0058', 9, 'c0000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-000000000002', 'USD', 'disputed',
    '2026-10-03', '2026-10-17', 'October growth retainer', null, 4200, 0, 4200, 0, 0, 0, 1, 'f2000000-0000-4000-8000-000000000003', null, 'Client says October ad spend was billed twice. Waiting for the breakdown.',
    'Thank you for your business.', 'Payment due within 14 days.',
    '{"name":"Luma Skincare Inc.","contact":"Megan Ortiz","address":"88 Pine Street, Suite 400, New York, NY 10005","tax_id":"EIN 47-2210934","email":"finance@lumaskin.co","cc":""}',
    '00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000006', '2026-10-03 16:00+04'),
  ('f3000000-0000-4000-8000-000000000257', 'INV-PU-0057', 10, 'c0000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-000000000002', 'USD', 'paid',
    '2026-09-03', '2026-09-17', 'September growth retainer', null, 4200, 0, 4200, 4200, 0, 0, 1, 'f2000000-0000-4000-8000-000000000003', null, null,
    'Thank you for your business.', 'Payment due within 14 days.',
    '{"name":"Luma Skincare Inc.","contact":"Megan Ortiz","address":"88 Pine Street, Suite 400, New York, NY 10005","tax_id":"EIN 47-2210934","email":"finance@lumaskin.co","cc":""}',
    '00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000006', '2026-09-03 16:00+04'),
  ('f3000000-0000-4000-8000-000000000256', 'INV-PU-0056', 11, 'c0000000-0000-4000-8000-000000000004', 'f1000000-0000-4000-8000-000000000002', 'USD', 'partly_paid',
    '2026-10-20', '2026-11-03', 'Website build, milestone 2', 'HL-WEB-02', 3000, 0, 3000, 1500, 0, 0, 1, 'f2000000-0000-4000-8000-000000000001', null, null,
    'Thank you for your business.', 'Payment due within 14 days.',
    '{"name":"Harbor Legal Partners PLLC","contact":"James Whitaker","address":"200 State Street, Boston, MA 02109","tax_id":"EIN 83-1127745","email":"billing@harborlegal.com","cc":"jw@harborlegal.com"}',
    '00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000006', '2026-10-20 12:00+04'),
  ('f3000000-0000-4000-8000-000000000255', 'INV-PU-0055', 12, 'c0000000-0000-4000-8000-000000000004', 'f1000000-0000-4000-8000-000000000002', 'USD', 'issued',
    '2026-11-02', '2026-11-30', 'Practice area pages', 'HL-WEB-03', 2400, 0, 2400, 0, 0, 0, 1, 'f2000000-0000-4000-8000-000000000001', null, null,
    'Thank you for your business.', 'Payment due within 28 days.',
    '{"name":"Harbor Legal Partners PLLC","contact":"James Whitaker","address":"200 State Street, Boston, MA 02109","tax_id":"EIN 83-1127745","email":"billing@harborlegal.com","cc":"jw@harborlegal.com"}',
    '00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000006', '2026-11-02 12:00+04'),
  ('f3000000-0000-4000-8000-000000000254', 'INV-PU-0054', 13, 'c0000000-0000-4000-8000-000000000003', 'f1000000-0000-4000-8000-000000000002', 'USD', 'written_off',
    '2026-07-03', '2026-07-17', 'Packaging design round 3', null, 1800, 0, 1800, 0, 0, 1800, 1, 'f2000000-0000-4000-8000-000000000003', null, 'Round 3 was outside the agreed scope. Written off as goodwill.',
    null, 'Payment due within 14 days.',
    '{"name":"Luma Skincare Inc.","contact":"Megan Ortiz","address":"88 Pine Street, Suite 400, New York, NY 10005","tax_id":"EIN 47-2210934","email":"finance@lumaskin.co","cc":""}',
    '00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000006', '2026-07-03 16:00+04'),
  ('f3000000-0000-4000-8000-000000000253', 'INV-PU-0053', 14, 'c0000000-0000-4000-8000-000000000004', 'f1000000-0000-4000-8000-000000000002', 'USD', 'refunded',
    '2026-08-10', '2026-08-24', 'Website build, milestone 1 (cancelled scope)', 'HL-WEB-01', 3000, 0, 3000, 3000, 3000, 0, 1, 'f2000000-0000-4000-8000-000000000001', null, null,
    null, 'Payment due within 14 days.',
    '{"name":"Harbor Legal Partners PLLC","contact":"James Whitaker","address":"200 State Street, Boston, MA 02109","tax_id":"EIN 83-1127745","email":"billing@harborlegal.com","cc":"jw@harborlegal.com"}',
    '00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000006', '2026-08-10 12:00+04'),
  ('f3000000-0000-4000-8000-000000000331', 'INV-PK-0031', 15, 'c0000000-0000-4000-8000-000000000006', 'f1000000-0000-4000-8000-000000000003', 'PKR', 'issued',
    '2026-09-28', '2026-10-05', 'October PPC management', null, 450000, 0, 450000, 0, 0, 0, 0.0036, 'f2000000-0000-4000-8000-000000000005', null, null,
    'Thank you for your business.', 'Payment due within 7 days.',
    '{"name":"Zest Kitchen (Pvt) Ltd","contact":"Faisal Raza","address":"12-C, Lane 5, DHA Phase 6, Karachi","tax_id":"NTN 4471209-3","email":"accounts@zestkitchen.pk","cc":"faisal@zestkitchen.pk"}',
    '00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000006', '2026-09-28 11:00+04'),
  ('f3000000-0000-4000-8000-000000000330', 'INV-PK-0030', 16, 'c0000000-0000-4000-8000-000000000006', 'f1000000-0000-4000-8000-000000000003', 'PKR', 'paid',
    '2026-09-01', '2026-09-08', 'September PPC management', null, 450000, 0, 450000, 450000, 0, 0, 0.0036, 'f2000000-0000-4000-8000-000000000005', null, null,
    'Thank you for your business.', 'Payment due within 7 days.',
    '{"name":"Zest Kitchen (Pvt) Ltd","contact":"Faisal Raza","address":"12-C, Lane 5, DHA Phase 6, Karachi","tax_id":"NTN 4471209-3","email":"accounts@zestkitchen.pk","cc":"faisal@zestkitchen.pk"}',
    '00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000006', '2026-09-01 11:00+04'),
  ('f3000000-0000-4000-8000-000000000329', 'INV-PK-0029', 17, 'c0000000-0000-4000-8000-000000000006', 'f1000000-0000-4000-8000-000000000003', 'PKR', 'partly_paid',
    '2026-07-01', '2026-07-08', 'July PPC management', null, 450000, 0, 450000, 200000, 0, 0, 0.0036, 'f2000000-0000-4000-8000-000000000005', null, null,
    'Thank you for your business.', 'Payment due within 7 days.',
    '{"name":"Zest Kitchen (Pvt) Ltd","contact":"Faisal Raza","address":"12-C, Lane 5, DHA Phase 6, Karachi","tax_id":"NTN 4471209-3","email":"accounts@zestkitchen.pk","cc":"faisal@zestkitchen.pk"}',
    '00000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000006', '2026-07-01 11:00+04'),
  ('f3000000-0000-4000-8000-000000000918', null, 18, 'c0000000-0000-4000-8000-000000000001', 'f1000000-0000-4000-8000-000000000001', 'AED', 'draft',
    '2026-11-04', '2026-11-18', 'Extra blog posts (4)', null, 2000, 100, 2100, 0, 0, 0, null, 'f2000000-0000-4000-8000-000000000004', null, null,
    'Thank you for your business. Please quote the invoice number with your transfer.', 'Payment due within 14 days.',
    '{"name":"Cedar and Pine Dental Clinic LLC","contact":"Dr. Rania Aziz","address":"Villa 14, Al Wasl Road, Jumeirah 1, Dubai","tax_id":"TRN 100229384700003","email":"accounts@cedarpine.ae","cc":"rania@cedarpine.ae"}',
    '00000000-0000-4000-8000-000000000006', null, null),
  ('f3000000-0000-4000-8000-000000000919', null, 19, 'c0000000-0000-4000-8000-000000000005', 'f1000000-0000-4000-8000-000000000001', 'AED', 'draft',
    '2026-11-04', '2026-11-18', 'November social and content', null, 6000, 300, 6300, 0, 0, 0, null, 'f2000000-0000-4000-8000-000000000001', null, null,
    'Thank you for your business.', 'Payment due within 14 days.',
    '{"name":"Nova Fitness Studios FZ-LLC","contact":"Leila Haddad","address":"Unit 6, Alserkal Avenue, Al Quoz, Dubai","tax_id":"TRN 100771203300003","email":"hello@novafit.ae","cc":""}',
    '00000000-0000-4000-8000-000000000006', null, null)
on conflict do nothing;

select setval('public.invoice_draft_seq', greatest((select max(draft_no) from public.invoices), 19));

-- ---------------------------------------------------------------- lines
insert into public.invoice_lines (invoice_id, position, description, detail, qty, rate, tax_pct, amount)
select v.invoice_id::uuid, v.position, v.description, v.detail, v.qty, v.rate, v.tax_pct, v.qty * v.rate
from (values
  ('f3000000-0000-4000-8000-000000000143', 0, 'Google and Meta ads management, November', 'Campaign setup, daily bid checks, weekly report', 1, 12000, 5),
  ('f3000000-0000-4000-8000-000000000143', 1, 'Creative refresh', '6 static ads and 2 short videos', 1, 2000, 5),
  ('f3000000-0000-4000-8000-000000000142', 0, 'SEO retainer, November', 'Technical fixes, 12 keywords tracked, monthly report', 1, 7500, 5),
  ('f3000000-0000-4000-8000-000000000142', 1, 'Blog posts', '4 posts of 1,200 words, briefs approved', 4, 500, 5),
  ('f3000000-0000-4000-8000-000000000141', 0, 'Google and Meta ads management, October', 'Campaign setup, daily bid checks, weekly report', 1, 12000, 5),
  ('f3000000-0000-4000-8000-000000000141', 1, 'Creative refresh', '6 static ads and 2 short videos', 1, 2000, 5),
  ('f3000000-0000-4000-8000-000000000140', 0, 'Social media management, October', '16 posts, 8 stories, community replies', 1, 4000, 5),
  ('f3000000-0000-4000-8000-000000000140', 1, 'Content writing', 'Captions and 2 blog posts', 1, 2000, 5),
  ('f3000000-0000-4000-8000-000000000139', 0, 'SEO retainer, October', 'Technical fixes, 12 keywords tracked, monthly report', 1, 7500, 5),
  ('f3000000-0000-4000-8000-000000000139', 1, 'Blog posts', '4 posts of 1,200 words', 4, 500, 5),
  ('f3000000-0000-4000-8000-000000000138', 0, 'Google and Meta ads management, September', null, 1, 12000, 5),
  ('f3000000-0000-4000-8000-000000000138', 1, 'Creative refresh', null, 1, 2000, 5),
  ('f3000000-0000-4000-8000-000000000137', 0, 'Showroom launch shoot', 'Half-day photo shoot, 30 edited images', 1, 3000, 5),
  ('f3000000-0000-4000-8000-000000000136', 0, 'Social media management, September', null, 1, 4000, 5),
  ('f3000000-0000-4000-8000-000000000136', 1, 'Content writing', null, 1, 2000, 5),
  ('f3000000-0000-4000-8000-000000000258', 0, 'Growth retainer, October', 'SEO, paid search and design support', 1, 4200, 0),
  ('f3000000-0000-4000-8000-000000000257', 0, 'Growth retainer, September', 'SEO, paid search and design support', 1, 4200, 0),
  ('f3000000-0000-4000-8000-000000000256', 0, 'Website build, milestone 2', 'Templates built and staged for review', 1, 3000, 0),
  ('f3000000-0000-4000-8000-000000000255', 0, 'Practice area pages', '8 pages, copy and build', 8, 300, 0),
  ('f3000000-0000-4000-8000-000000000254', 0, 'Packaging design, round 3', null, 1, 1800, 0),
  ('f3000000-0000-4000-8000-000000000253', 0, 'Website build, milestone 1', 'Sitemap, wireframes and design', 1, 3000, 0),
  ('f3000000-0000-4000-8000-000000000331', 0, 'PPC management, October', 'Google Ads, 3 campaigns', 1, 450000, 0),
  ('f3000000-0000-4000-8000-000000000330', 0, 'PPC management, September', 'Google Ads, 3 campaigns', 1, 450000, 0),
  ('f3000000-0000-4000-8000-000000000329', 0, 'PPC management, July', 'Google Ads, 3 campaigns', 1, 450000, 0),
  ('f3000000-0000-4000-8000-000000000918', 0, 'Extra blog posts', '4 posts of 1,200 words', 4, 500, 5),
  ('f3000000-0000-4000-8000-000000000919', 0, 'Social media management, November', '16 posts, 8 stories, community replies', 1, 4000, 5),
  ('f3000000-0000-4000-8000-000000000919', 1, 'Content writing', 'Captions and 2 blog posts', 1, 2000, 5)
) as v (invoice_id, position, description, detail, qty, rate, tax_pct)
where not exists (select 1 from public.invoice_lines l where l.invoice_id = v.invoice_id::uuid);

-- ---------------------------------------------------------------- history
insert into public.invoice_events (invoice_id, kind, actor_id, note, amount, meta, created_at)
select v.invoice_id::uuid, v.kind, v.actor_id::uuid, v.note, v.amount, v.meta::jsonb, v.created_at::timestamptz
from (values
  ('f3000000-0000-4000-8000-000000000142', 'created', null, 'Created as monthly draft from agreed fee', null, '{}', '2026-10-25 09:00+04'),
  ('f3000000-0000-4000-8000-000000000142', 'issued', '00000000-0000-4000-8000-000000000006', 'Issued. Number INV-PS-0142 assigned', null, '{}', '2026-11-01 10:04+04'),
  ('f3000000-0000-4000-8000-000000000142', 'email_requested', null, 'Emailed invoice to accounts@cedarpine.ae, cc rania@cedarpine.ae', null, '{"kind":"invoice","to":"accounts@cedarpine.ae","cc":"rania@cedarpine.ae"}', '2026-11-01 10:05+04'),
  ('f3000000-0000-4000-8000-000000000142', 'payment', '00000000-0000-4000-8000-000000000006', 'Recorded payment P-1088, AED 4,000 by Bank ENBD', 4000, '{"receipt":"P-1088"}', '2026-11-03 14:12+04'),
  ('f3000000-0000-4000-8000-000000000143', 'issued', '00000000-0000-4000-8000-000000000006', 'Issued. Number INV-PS-0143 assigned', null, '{}', '2026-11-03 09:30+04'),
  ('f3000000-0000-4000-8000-000000000141', 'issued', '00000000-0000-4000-8000-000000000006', 'Issued. Number INV-PS-0141 assigned', null, '{}', '2026-10-01 09:12+04'),
  ('f3000000-0000-4000-8000-000000000141', 'payment', '00000000-0000-4000-8000-000000000006', 'Recorded payment P-1086, AED 6,000 by Bank ENBD', 6000, '{"receipt":"P-1086"}', '2026-10-22 13:00+04'),
  ('f3000000-0000-4000-8000-000000000140', 'issued', '00000000-0000-4000-8000-000000000006', 'Issued. Number INV-PS-0140 assigned', null, '{}', '2026-10-07 11:00+04'),
  ('f3000000-0000-4000-8000-000000000140', 'reminder', '00000000-0000-4000-8000-000000000006', 'Sent 7 days late reminder', null, '{"stage":"late_7"}', '2026-10-28 10:00+04'),
  ('f3000000-0000-4000-8000-000000000137', 'issued', '00000000-0000-4000-8000-000000000006', 'Issued. Number INV-PS-0137 assigned', null, '{}', '2026-08-20 15:40+04'),
  ('f3000000-0000-4000-8000-000000000137', 'voided', '00000000-0000-4000-8000-000000000006', 'Voided: Raised twice, replaced by INV-PS-0138', null, '{}', '2026-09-01 09:25+04'),
  ('f3000000-0000-4000-8000-000000000136', 'refund', '00000000-0000-4000-8000-000000000006', 'Refunded AED 1,260: Two campaign weeks paused by client', 1260,
    '{"date":"2026-10-18","channel_id":"f2000000-0000-4000-8000-000000000001","reference":"WISE-R-1190"}', '2026-10-18 12:00+04'),
  ('f3000000-0000-4000-8000-000000000258', 'issued', '00000000-0000-4000-8000-000000000006', 'Issued. Number INV-PU-0058 assigned', null, '{}', '2026-10-03 16:00+04'),
  ('f3000000-0000-4000-8000-000000000258', 'disputed', '00000000-0000-4000-8000-000000000006', 'Disputed: Client says October ad spend was billed twice. Waiting for the breakdown.', null, '{}', '2026-10-24 11:30+04'),
  ('f3000000-0000-4000-8000-000000000256', 'issued', '00000000-0000-4000-8000-000000000006', 'Issued. Number INV-PU-0056 assigned', null, '{}', '2026-10-20 12:00+04'),
  ('f3000000-0000-4000-8000-000000000255', 'issued', '00000000-0000-4000-8000-000000000006', 'Issued. Number INV-PU-0055 assigned', null, '{}', '2026-11-02 12:00+04'),
  ('f3000000-0000-4000-8000-000000000254', 'written_off', '00000000-0000-4000-8000-000000000006', 'Wrote off USD 1,800: Round 3 was outside the agreed scope. Written off as goodwill.', 1800, '{}', '2026-09-30 10:00+04'),
  ('f3000000-0000-4000-8000-000000000253', 'refund', '00000000-0000-4000-8000-000000000006', 'Refunded USD 3,000: Milestone 1 scope cancelled', 3000,
    '{"date":"2026-09-02","channel_id":"f2000000-0000-4000-8000-000000000001","reference":"WISE-R-1102"}', '2026-09-02 12:00+04'),
  ('f3000000-0000-4000-8000-000000000331', 'issued', '00000000-0000-4000-8000-000000000006', 'Issued. Number INV-PK-0031 assigned', null, '{}', '2026-09-28 11:00+04'),
  ('f3000000-0000-4000-8000-000000000918', 'created', '00000000-0000-4000-8000-000000000006', 'Created', null, '{}', '2026-11-04 09:15+04'),
  ('f3000000-0000-4000-8000-000000000919', 'created', null, 'Created as monthly draft from agreed fee', null, '{}', '2026-11-04 09:00+04')
) as v (invoice_id, kind, actor_id, note, amount, meta, created_at)
where not exists (select 1 from public.invoice_events e where e.invoice_id = v.invoice_id::uuid);

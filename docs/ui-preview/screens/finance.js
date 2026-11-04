/* Finance screens: finance, invoices, invoice, profitability, payments, billing-clients, payment-reminders, finance-setup. Owned by the Finance agent. */
(function () {
  const { screen, esc, avatar, tone, money, PEOPLE, CLIENTS, TODAY, toast } = K;

  /* ---------------- Shared data ---------------- */
  const ENTITIES = [
    { id: 'ps', name: 'Permanent SEO FZ-LLC', short: 'FZ-LLC (UAE)', country: 'United Arab Emirates', prefix: 'PS', taxLabel: 'VAT', taxRate: 5, cur: 'AED', taxId: 'TRN 100384729100003', address: 'Office 1204, Silicon Oasis HQ, Dubai', next: 144 },
    { id: 'pu', name: 'Permanent SEO LLC', short: 'LLC (US)', country: 'United States', prefix: 'PU', taxLabel: 'None', taxRate: 0, cur: 'USD', taxId: 'EIN 88-4410273', address: '1209 Orange Street, Wilmington, DE 19801', next: 59 },
    { id: 'pk', name: 'Permanent SEO Pvt Ltd', short: 'Pvt Ltd (PK)', country: 'Pakistan', prefix: 'PK', taxLabel: 'GST', taxRate: 0, cur: 'PKR', taxId: 'NTN 7734120-6', address: '42 Main Boulevard, Gulberg III, Lahore', next: 32 },
  ];
  const ENT = id => ENTITIES.find(e => e.id === id);
  const FX = { USD: 1, AED: 0.2723, PKR: 0.0036 };
  const usd = (n, cur) => n * FX[cur];
  const conv = (nUsd, to) => nUsd / FX[to];
  const fmt = (n, cur) => money(Math.round(n * 100) / 100, cur);
  const fmt0 = (n, cur) => money(Math.round(n), cur);
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fd = d => { if (!d) return '—'; const [y, m, dd] = d.split('-'); return `${+dd} ${MON[+m - 1]} ${y}`; };
  const fds = d => { if (!d) return '—'; const [, m, dd] = d.split('-'); return `${+dd} ${MON[+m - 1]}`; };
  const addDays = (d, n) => { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); };
  const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00:00Z') - new Date(a + 'T00:00:00Z')) / 864e5);
  const client = name => CLIENTS.find(c => c.name === name) || CLIENTS[0];
  const entOfCur = cur => ({ AED: 'ps', USD: 'pu', PKR: 'pk' })[cur];

  // Invoices. paid = money received against it, refunded = money given back.
  const INVOICES = [
    { num: 'INV-PS-0143', client: 'Alba Motors', ent: 'ps', cur: 'AED', issued: '2026-11-03', due: '2026-11-07', total: 14700, paid: 0, status: 'Issued', title: 'November ads management' },
    { num: 'INV-PS-0142', client: 'Cedar & Pine Dental', ent: 'ps', cur: 'AED', issued: '2026-11-01', due: '2026-11-15', total: 9975, paid: 4000, status: 'Partly paid', title: 'November SEO and content' },
    { num: 'INV-PS-0141', client: 'Alba Motors', ent: 'ps', cur: 'AED', issued: '2026-10-01', due: '2026-10-15', total: 14700, paid: 6000, status: 'Partly paid', title: 'October ads management' },
    { num: 'INV-PS-0140', client: 'Nova Fitness', ent: 'ps', cur: 'AED', issued: '2026-10-07', due: '2026-10-21', total: 6300, paid: 0, status: 'Issued', title: 'October social and content' },
    { num: 'INV-PS-0139', client: 'Cedar & Pine Dental', ent: 'ps', cur: 'AED', issued: '2026-10-01', due: '2026-10-15', total: 9975, paid: 9975, status: 'Paid', title: 'October SEO and content' },
    { num: 'INV-PS-0138', client: 'Alba Motors', ent: 'ps', cur: 'AED', issued: '2026-09-01', due: '2026-09-15', total: 14700, paid: 14700, status: 'Paid', title: 'September ads management' },
    { num: 'INV-PS-0137', client: 'Alba Motors', ent: 'ps', cur: 'AED', issued: '2026-08-20', due: '2026-09-03', total: 3150, paid: 0, status: 'Void', title: 'Showroom launch shoot', voidReason: 'Raised twice, replaced by INV-PS-0138' },
    { num: 'INV-PS-0136', client: 'Nova Fitness', ent: 'ps', cur: 'AED', issued: '2026-09-01', due: '2026-09-15', total: 6300, paid: 6300, refunded: 1260, status: 'Partly refunded', title: 'September social and content' },
    { num: 'INV-PU-0058', client: 'Luma Skincare', ent: 'pu', cur: 'USD', issued: '2026-10-03', due: '2026-10-17', total: 4200, paid: 0, status: 'Disputed', title: 'October growth retainer' },
    { num: 'INV-PU-0057', client: 'Luma Skincare', ent: 'pu', cur: 'USD', issued: '2026-09-03', due: '2026-09-17', total: 4200, paid: 4200, status: 'Paid', title: 'September growth retainer' },
    { num: 'INV-PU-0056', client: 'Harbor Legal', ent: 'pu', cur: 'USD', issued: '2026-10-20', due: '2026-11-03', total: 3000, paid: 1500, status: 'Partly paid', title: 'Website build, milestone 2' },
    { num: 'INV-PU-0055', client: 'Harbor Legal', ent: 'pu', cur: 'USD', issued: '2026-11-02', due: '2026-11-30', total: 2400, paid: 0, status: 'Issued', title: 'Practice area pages' },
    { num: 'INV-PU-0054', client: 'Luma Skincare', ent: 'pu', cur: 'USD', issued: '2026-07-03', due: '2026-07-17', total: 1800, paid: 0, status: 'Written off', title: 'Packaging design round 3' },
    { num: 'INV-PU-0053', client: 'Harbor Legal', ent: 'pu', cur: 'USD', issued: '2026-08-10', due: '2026-08-24', total: 3000, paid: 3000, refunded: 3000, status: 'Refunded', title: 'Website build, milestone 1 (cancelled scope)' },
    { num: 'INV-PK-0031', client: 'Zest Kitchen', ent: 'pk', cur: 'PKR', issued: '2026-09-28', due: '2026-10-05', total: 450000, paid: 0, status: 'Issued', title: 'October PPC management' },
    { num: 'INV-PK-0030', client: 'Zest Kitchen', ent: 'pk', cur: 'PKR', issued: '2026-09-01', due: '2026-09-08', total: 450000, paid: 450000, status: 'Paid', title: 'September PPC management' },
    { num: 'INV-PK-0029', client: 'Zest Kitchen', ent: 'pk', cur: 'PKR', issued: '2026-07-01', due: '2026-07-08', total: 450000, paid: 200000, status: 'Partly paid', title: 'July PPC management' },
    { num: 'Draft 18', client: 'Cedar & Pine Dental', ent: 'ps', cur: 'AED', issued: '2026-11-04', due: '2026-11-18', total: 2100, paid: 0, status: 'Draft', title: 'Extra blog posts (4)' },
    { num: 'Draft 19', client: 'Nova Fitness', ent: 'ps', cur: 'AED', issued: '2026-11-04', due: '2026-11-18', total: 6300, paid: 0, status: 'Draft', title: 'November social and content' },
  ];
  const OPEN_ST = ['Issued', 'Partly paid', 'Disputed'];
  const balance = i => OPEN_ST.includes(i.status) ? i.total - i.paid : 0;
  const isOpen = i => OPEN_ST.includes(i.status) && balance(i) > 0;
  const lateDays = i => isOpen(i) ? daysBetween(i.due, TODAY) : 0;
  const isOverdue = i => isOpen(i) && i.status !== 'Disputed' && lateDays(i) > 0;
  const STATUS_TONE = { Draft: 'muted', Issued: 'blue', 'Partly paid': 'violet', Paid: 'ok', Void: 'muted', Refunded: 'warn', 'Partly refunded': 'warn', 'Written off': 'muted', Disputed: 'danger', Overdue: 'danger' };
  const invStatus = i => isOverdue(i)
    ? `${tone('Overdue', 'danger')}<div class="small muted">${lateDays(i)} days${i.status === 'Partly paid' ? ', partly paid' : ''}</div>`
    : tone(i.status, STATUS_TONE[i.status]);
  const INV = num => INVOICES.find(i => i.num === num);

  const CHANNELS = [
    { id: 'wise', name: 'Wise', account: 'Wise USD ••7720', details: 'Account 8310 0472 7720, routing 026073150, Wise US Inc.', fee: '0.6% + USD 1' },
    { id: 'paypal', name: 'PayPal', account: 'PayPal billing@permanentseo.com', details: 'Pay link sent per invoice. Goods and services.', fee: '3.4% + USD 0.30' },
    { id: 'slash', name: 'Slash', account: 'Slash card ••3391', details: 'Virtual card for card payments, USD only.', fee: '2.9%' },
    { id: 'enbd', name: 'Bank ENBD', account: 'ENBD AED ••4410', details: 'Emirates NBD, IBAN AE07 0260 0010 1544 1040 001, SWIFT EBILAEAD', fee: 'None' },
    { id: 'payoneer', name: 'Payoneer', account: 'Payoneer PKR ••0915', details: 'Receiving account for PKR and USD clients in Pakistan.', fee: '1%' },
    { id: 'other', name: 'Other', account: 'HBL cash deposit', details: 'Cash or cheque deposits at HBL Gulberg branch.', fee: 'None' },
  ];

  const PAYMENTS = [
    { id: 'P-1089', date: '2026-11-02', client: 'Harbor Legal', cur: 'USD', amount: 250, fee: 3, channel: 'Wise', account: 'Wise USD ••7720', applied: [], credit: 250, proof: true, ref: 'WISE-88213', rate: 1, note: 'Paid ahead for hosting' },
    { id: 'P-1088', date: '2026-11-03', client: 'Cedar & Pine Dental', cur: 'AED', amount: 4000, fee: 0, channel: 'Bank ENBD', account: 'ENBD AED ••4410', applied: ['INV-PS-0142'], credit: 0, proof: true, ref: 'FT26307ENBD119', rate: 0.2723 },
    { id: 'P-1087', date: '2026-10-28', client: 'Harbor Legal', cur: 'USD', amount: 1500, fee: 51.3, channel: 'PayPal', account: 'PayPal billing@permanentseo.com', applied: ['INV-PU-0056'], credit: 0, proof: true, ref: '5TY81203KP', rate: 1 },
    { id: 'P-1086', date: '2026-10-22', client: 'Alba Motors', cur: 'AED', amount: 6000, fee: 0, channel: 'Bank ENBD', account: 'ENBD AED ••4410', applied: ['INV-PS-0141'], credit: 0, proof: false, ref: 'Cheque 004418', rate: 0.2723 },
    { id: 'P-1085', date: '2026-10-14', client: 'Cedar & Pine Dental', cur: 'AED', amount: 9975, fee: 0, channel: 'Bank ENBD', account: 'ENBD AED ••4410', applied: ['INV-PS-0139'], credit: 0, proof: true, ref: 'FT26287ENBD042', rate: 0.2722 },
    { id: 'P-1084', date: '2026-09-12', client: 'Nova Fitness', cur: 'AED', amount: 6300, fee: 38, channel: 'Wise', account: 'Wise USD ••7720', applied: ['INV-PS-0136'], credit: 0, proof: true, ref: 'WISE-80117', rate: 0.2723 },
    { id: 'P-1083', date: '2026-09-20', client: 'Luma Skincare', cur: 'USD', amount: 4200, fee: 121.8, channel: 'Slash', account: 'Slash card ••3391', applied: ['INV-PU-0057'], credit: 0, proof: true, ref: 'SL-55120', rate: 1 },
    { id: 'P-1082', date: '2026-09-14', client: 'Alba Motors', cur: 'AED', amount: 14700, fee: 0, channel: 'Bank ENBD', account: 'ENBD AED ••4410', applied: ['INV-PS-0138'], credit: 0, proof: true, ref: 'FT26257ENBD301', rate: 0.2723 },
    { id: 'P-1081', date: '2026-09-08', client: 'Zest Kitchen', cur: 'PKR', amount: 450000, fee: 4500, channel: 'Payoneer', account: 'Payoneer PKR ••0915', applied: ['INV-PK-0030'], credit: 0, proof: false, ref: 'PYN-2209184', rate: 0.0036 },
    { id: 'P-1080', date: '2026-08-18', client: 'Harbor Legal', cur: 'USD', amount: 3000, fee: 19, channel: 'Wise', account: 'Wise USD ••7720', applied: ['INV-PU-0053'], credit: 0, proof: true, ref: 'WISE-77310', rate: 1 },
    { id: 'P-1079', date: '2026-08-05', client: 'Zest Kitchen', cur: 'PKR', amount: 200000, fee: 0, channel: 'Other', account: 'HBL cash deposit', applied: ['INV-PK-0029'], credit: 0, proof: true, ref: 'HBL slip 77102', rate: 0.0036 },
  ];
  const REFUNDS = [
    { date: '2026-10-18', client: 'Nova Fitness', cur: 'AED', amount: 1260, inv: 'INV-PS-0136', reason: 'Two campaign weeks paused by client' },
    { date: '2026-09-02', client: 'Harbor Legal', cur: 'USD', amount: 3000, inv: 'INV-PU-0053', reason: 'Milestone 1 scope cancelled' },
  ];
  const CREDITS = [
    { client: 'Harbor Legal', cur: 'USD', amount: 250, from: 'P-1089, 2 Nov' },
    { client: 'Alba Motors', cur: 'AED', amount: 1200, from: 'Overpayment on INV-PS-0130' },
  ];

  // Billing profiles per client
  const BILLING = {
    'Cedar & Pine Dental': { legal: 'Cedar and Pine Dental Clinic LLC', contact: 'Dr. Rania Aziz', email: 'accounts@cedarpine.ae', cc: 'rania@cedarpine.ae', country: 'United Arab Emirates', address: 'Villa 14, Al Wasl Road, Jumeirah 1, Dubai', taxId: 'TRN 100229384700003', channel: 'Bank ENBD', terms: 14, basis: 'Monthly', auto: true, notes: 'Send PDF to both emails. PO not needed.' },
    'Alba Motors': { legal: 'Alba Motors Trading LLC', contact: 'Khalid Mansour', email: 'ap@albamotors.ae', cc: 'khalid@albamotors.ae', country: 'United Arab Emirates', address: 'Showroom 3, Sheikh Zayed Road, Al Quoz, Dubai', taxId: 'TRN 100482911200003', channel: 'Bank ENBD', terms: 14, basis: 'Monthly', auto: true, notes: 'Quote PO on every invoice. Pays by cheque sometimes.', subs: ['Alba Motors Service Centre', 'Alba Rent a Car'] },
    'Luma Skincare': { legal: 'Luma Skincare Inc.', contact: 'Megan Ortiz', email: 'finance@lumaskin.co', cc: '', country: 'United States', address: '88 Pine Street, Suite 400, New York, NY 10005', taxId: 'EIN 47-2210934', channel: 'Slash', terms: 14, basis: 'Monthly', auto: false, notes: 'October invoice disputed. Hold reminders until resolved.' },
    'Harbor Legal': { legal: 'Harbor Legal Partners PLLC', contact: 'James Whitaker', email: 'billing@harborlegal.com', cc: 'jw@harborlegal.com', country: 'United States', address: '200 State Street, Boston, MA 02109', taxId: 'EIN 83-1127745', channel: 'Wise', terms: 14, basis: 'One-time', auto: true, notes: 'Website billed by milestone.' },
    'Nova Fitness': { legal: 'Nova Fitness Studios FZ-LLC', contact: 'Leila Haddad', email: 'hello@novafit.ae', cc: '', country: 'United Arab Emirates', address: 'Unit 6, Alserkal Avenue, Al Quoz, Dubai', taxId: 'TRN 100771203300003', channel: 'Wise', terms: 14, basis: 'Monthly', auto: true, notes: 'New client since September.' },
    'Zest Kitchen': { legal: 'Zest Kitchen (Pvt) Ltd', contact: 'Faisal Raza', email: 'accounts@zestkitchen.pk', cc: 'faisal@zestkitchen.pk', country: 'Pakistan', address: '12-C, Lane 5, DHA Phase 6, Karachi', taxId: 'NTN 4471209-3', channel: 'Payoneer', terms: 7, basis: 'Monthly', auto: true, notes: 'Agreed payment plan for July balance.' },
  };
  const openBal = name => INVOICES.filter(i => i.client === name && isOpen(i)).reduce((a, i) => a + balance(i), 0);

  // Reminders
  const STAGES = { before: '3 days before due', late_1: '1 day late', late_7: '7 days late', late_14: '14 days late', late_30: '30 days late' };
  const REMINDERS = [
    { id: 'r1', list: 'today', inv: 'INV-PS-0143', stage: 'before', on: TODAY, auto: true },
    { id: 'r2', list: 'today', inv: 'INV-PU-0056', stage: 'late_1', on: TODAY, auto: true },
    { id: 'r3', list: 'today', inv: 'INV-PS-0140', stage: 'late_14', on: TODAY, auto: false },
    { id: 'r4', list: 'today', inv: 'INV-PK-0031', stage: 'late_30', on: TODAY, auto: true, amNote: true },
    { id: 'r5', list: 'paused', inv: 'INV-PU-0058', stage: 'late_14', on: '2026-10-31', until: '2026-11-20', note: 'Disputed. Waiting for the ad spend breakdown from Megan.', auto: false },
    { id: 'r6', list: 'paused', inv: 'INV-PK-0029', stage: 'late_30', on: '2026-08-07', until: '2026-12-01', note: 'Payment plan agreed: PKR 125,000 a month from November.', auto: true },
    { id: 'r7', list: 'upcoming', inv: 'INV-PS-0142', stage: 'before', on: '2026-11-12', auto: true },
    { id: 'r8', list: 'upcoming', inv: 'INV-PS-0141', stage: 'late_30', on: '2026-11-14', auto: true, amNote: true },
    { id: 'r9', list: 'upcoming', inv: 'INV-PS-0143', stage: 'late_1', on: '2026-11-08', auto: true },
    { id: 'r10', list: 'upcoming', inv: 'INV-PU-0055', stage: 'before', on: '2026-11-27', auto: true },
    { id: 'r11', list: 'recent', inv: 'INV-PS-0141', stage: 'late_14', on: '2026-10-29', auto: true, by: 'Auto (daily run)', result: ['Opened twice', 'ok'] },
    { id: 'r12', list: 'recent', inv: 'INV-PK-0031', stage: 'late_14', on: '2026-10-19', auto: true, by: 'Auto (daily run)', result: ['Delivered', 'blue'] },
    { id: 'r13', list: 'recent', inv: 'INV-PS-0140', stage: 'late_7', on: '2026-10-28', auto: false, by: 'Bilal Ahmed', result: ['Opened', 'ok'] },
    { id: 'r14', list: 'recent', inv: 'INV-PU-0058', stage: 'late_7', on: '2026-10-24', auto: false, by: 'Bilal Ahmed', result: ['Reply received', 'violet'] },
  ];
  const remindersToday = () => REMINDERS.filter(r => r.list === 'today').length;

  // 12-month invoiced vs collected (USD) per entity
  const MONTHS = [];
  for (let k = 0; k < 12; k++) {
    const m = (11 + k) % 12, y = k === 0 ? 2025 : 2026;
    const key = `${y}-${String(m + 1).padStart(2, '0')}`;
    const wav = 1 + 0.09 * Math.sin(k * 1.3) + 0.03 * k;
    const part = k === 11 ? 0.62 : 1;
    const base = { ps: 8030, pu: 7400, pk: 1620 };
    const row = { key, label: MON[m], year: y, ent: {} };
    Object.keys(base).forEach((e, j) => {
      const inv = Math.round(base[e] * wav * part * (1 + 0.05 * Math.cos(k + j)));
      const col = Math.round(inv * (k === 11 ? 0.27 : 0.82 + 0.13 * Math.abs(Math.sin(k * 0.7 + j))));
      row.ent[e] = { inv, col };
    });
    MONTHS.push(row);
  }
  const PERIODS = {
    month: { label: 'This month', from: '2026-11-01', to: '2026-11-30' },
    last: { label: 'Last month', from: '2026-10-01', to: '2026-10-31' },
    quarter: { label: 'Quarter', from: '2026-10-01', to: '2026-12-31' },
    ytd: { label: 'YTD', from: '2026-01-01', to: '2026-12-31' },
    year: { label: '12 months', from: '2025-12-01', to: '2026-11-30' },
  };
  const inRange = (d, p) => d >= p.from && d <= p.to;

  /* ---------------- Scoped CSS ---------------- */
  const CSS = `<style>
  .scr-fin .fin-banner{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:14px 18px;border:1px solid var(--line);border-left:3px solid var(--warn);border-radius:var(--radius);background:var(--warn-soft)}
  .scr-fin .fin-banner strong{color:var(--ink)}
  .scr-fin .num,.scr-fin td.num,.scr-fin .value{font-variant-numeric:tabular-nums}
  .scr-fin .stats.fin-small .value{font-size:18px}
  .scr-fin .chart{width:100%;height:auto;display:block}
  .scr-fin .chart text{fill:var(--ink-3);font-size:11px}
  .scr-fin .legend{display:flex;gap:16px;flex-wrap:wrap;font-size:13px;color:var(--ink-2)}
  .scr-fin .legend i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:6px;vertical-align:-1px}
  .scr-fin .aging{display:grid;grid-template-columns:90px 1fr 120px;gap:10px;align-items:center;font-size:14px}
  .scr-fin .aging .bar{margin:0}
  .scr-fin .toolbar select,.scr-fin .toolbar input{min-width:0}
  .scr-fin .lines input{width:100%;min-width:60px;padding:6px 8px;border:1px solid var(--line);border-radius:6px;background:var(--surface);color:var(--ink);font:inherit}
  .scr-fin .lines td{vertical-align:top}
  .scr-fin .lines .l-detail{margin-top:4px;font-size:13px;color:var(--ink-2)}
  .scr-fin .totals{display:grid;grid-template-columns:1fr auto;gap:6px 18px;justify-content:end;margin-left:auto;max-width:340px;font-variant-numeric:tabular-nums}
  .scr-fin .totals .grand{font-weight:700;font-size:17px;color:var(--ink);border-top:1px solid var(--line);padding-top:8px}
  .scr-fin .totals .right{text-align:right}
  .scr-fin .doc{background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);padding:28px;display:flex;flex-direction:column;gap:18px;font-size:13px;color:var(--ink-2)}
  .scr-fin .doc h4{margin:0;font-size:20px;color:var(--ink)}
  .scr-fin .doc table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
  .scr-fin .doc th{text-align:left;font-weight:600;color:var(--ink-3);border-bottom:1px solid var(--line);padding:6px 4px}
  .scr-fin .doc td{border-bottom:1px solid var(--line-2);padding:8px 4px;vertical-align:top}
  .scr-fin .doc .r{text-align:right}
  .scr-fin .doc .paybox{border:1px dashed var(--line);border-radius:8px;padding:10px 12px;background:var(--surface-2)}
  .scr-fin .note-line{padding:10px 12px;border-radius:8px;background:var(--surface-2);border:1px solid var(--line);font-size:14px}
  .scr-fin .note-line.t-warn{background:var(--warn-soft);border-color:var(--warn)}
  .scr-fin .note-line.t-danger{background:var(--danger-soft);border-color:var(--danger)}
  .scr-fin .note-line.t-ok{background:var(--ok-soft);border-color:var(--ok)}
  .scr-fin .actions{display:flex;flex-wrap:wrap;gap:8px}
  .scr-fin tr.faded{opacity:.4}
  .scr-fin tr.faded button{pointer-events:none}
  .scr-fin .alloc td{vertical-align:middle}
  .scr-fin .alloc input[type=number]{width:120px;padding:6px 8px;border:1px solid var(--line);border-radius:6px;background:var(--surface);color:var(--ink);font:inherit;font-variant-numeric:tabular-nums}
  .scr-fin .monthnav{display:flex;align-items:center;gap:10px}
  .scr-fin .monthnav strong{min-width:120px;text-align:center;font-size:16px}
  .scr-fin .kv{display:grid;grid-template-columns:140px 1fr;gap:6px 12px;font-size:14px}
  .scr-fin .kv dt{color:var(--ink-3)} .scr-fin .kv dd{margin:0;color:var(--ink)}
  .scr-fin .hist .item{display:flex;gap:10px;align-items:flex-start}
  .scr-fin .acc{color:var(--accent);font-weight:700}
  .scr-fin .t-danger-ink{color:var(--danger)} .scr-fin .t-ok-ink{color:var(--ok)} .scr-fin .t-warn-ink{color:var(--warn)}
  @media (max-width:900px){.scr-fin .aging{grid-template-columns:70px 1fr 100px}.scr-fin .doc{padding:18px}}
  </style>`;

  /* ---------------- Shared fragments ---------------- */
  const clientOpts = (sel, all) => (all ? `<option value="">${esc(all)}</option>` : '') + CLIENTS.map(c => `<option${c.name === sel ? ' selected' : ''}>${esc(c.name)}</option>`).join('');
  const entOpts = (sel, all) => (all ? `<option value="">${esc(all)}</option>` : '') + ENTITIES.map(e => `<option value="${e.id}"${e.id === sel ? ' selected' : ''}>${esc(e.name)}</option>`).join('');
  const chanOpts = (sel, all) => (all ? `<option value="">${esc(all)}</option>` : '') + CHANNELS.map(c => `<option${c.name === sel ? ' selected' : ''}>${esc(c.name)}</option>`).join('');
  const curOpts = sel => ['AED', 'USD', 'PKR'].map(c => `<option${c === sel ? ' selected' : ''}>${c}</option>`).join('');
  const agingBuckets = list => {
    const b = [['Not due', 0], ['1–30', 0], ['31–60', 0], ['61–90', 0], ['90+', 0]];
    list.filter(isOpen).forEach(i => { const d = lateDays(i), v = usd(balance(i), i.cur); b[d <= 0 ? 0 : d <= 30 ? 1 : d <= 60 ? 2 : d <= 90 ? 3 : 4][1] += v; });
    return b;
  };
  const agingHtml = (list, cur) => {
    const b = agingBuckets(list), max = Math.max(...b.map(x => x[1]), 1);
    const tones = ['t-ok', 't-warn', 't-warn', 't-danger', 't-danger'];
    return `<div class="stack">${b.map((x, k) => `<div class="aging"><span>${x[0]}${k ? ' days' : ''}</span><div class="bar ${tones[k]}"><i style="width:${Math.max(2, Math.round(x[1] / max * 100))}%"></i></div><span class="num right">${fmt0(conv(x[1], cur), cur)}</span></div>`).join('')}</div>`;
  };

  // Record payment dialog (used by payments and invoice screens)
  function recordPaymentDialog(id, presetClient, presetAmount) {
    const c = client(presetClient);
    return `<dialog id="${id}" class="modal" data-rp>
      <form method="dialog">
        <div class="modal-head"><h3>Record payment</h3><button type="button" class="icon-btn" data-close aria-label="Close">✕</button></div>
        <div class="modal-body stack">
          <div class="form-grid">
            <div class="field"><label>Client</label><select name="client" data-rp-client>${clientOpts(c.name)}</select></div>
            <div class="field"><label>Date received</label><input type="date" name="date" value="${TODAY}"></div>
            <div class="field"><label>Currency</label><select name="cur" data-rp-cur>${curOpts(c.currency)}</select></div>
            <div class="field"><label>Amount received</label><input type="number" step="0.01" min="0" name="amount" data-rp-amount value="${presetAmount || ''}" placeholder="0.00"></div>
            <div class="field"><label>Fee taken by channel</label><input type="number" step="0.01" min="0" name="fee" data-rp-fee value="0"></div>
            <div class="field"><label>Landed amount</label><input type="number" step="0.01" name="landed" data-rp-landed readonly></div>
          </div>
          <div class="note-line t-warn" data-rp-dup hidden>A payment of this amount from this client was recorded in the last 14 days. Check it isn't a duplicate.</div>
          <div class="stack">
            <h4 style="margin:0">Apply to open invoices, oldest first</h4>
            <div class="table-wrap"><table class="tbl alloc"><thead><tr><th></th><th>Invoice</th><th>Due</th><th class="right">Balance</th><th class="right">Apply</th></tr></thead><tbody data-rp-rows></tbody></table></div>
            <div class="note-line" data-rp-left>Enter an amount to allocate it.</div>
          </div>
          <div class="form-grid">
            <div class="field"><label>Channel</label><select name="channel" data-rp-channel>${chanOpts(BILLING[c.name].channel)}</select></div>
            <div class="field"><label>Account</label><select name="account" data-rp-account>${CHANNELS.map(ch => `<option${ch.name === BILLING[c.name].channel ? ' selected' : ''}>${esc(ch.account)}</option>`).join('')}</select></div>
            <div class="field"><label>Reference</label><input name="ref" placeholder="Bank or transfer reference"></div>
            <div class="field"><label>Rate saved</label><input data-rp-rate readonly value=""></div>
            <div class="field full"><label>Note</label><textarea name="note" rows="2" placeholder="Anything finance should know"></textarea></div>
          </div>
          <div class="stack">
            <div class="row"><label class="check"><input type="radio" name="proof" value="file" checked data-rp-proof> Attach proof</label><label class="check"><input type="radio" name="proof" value="none" data-rp-proof> No proof</label></div>
            <div class="field" data-rp-file><label>Proof files</label><input type="file" multiple accept="image/*,.pdf"></div>
            <div class="field" data-rp-reason hidden><label>Why is there no proof?</label><input name="noproof" placeholder="For example: cash handed to Hamza at the meeting"></div>
          </div>
        </div>
        <div class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary" type="submit">Record payment</button></div>
      </form>
    </dialog>`;
  }
  function wireRecordPayment(root) {
    root.querySelectorAll('dialog[data-rp]').forEach(dlg => {
      const q = s => dlg.querySelector(s);
      const rows = q('[data-rp-rows]'), amt = q('[data-rp-amount]'), fee = q('[data-rp-fee]'), left = q('[data-rp-left]');
      const loadRows = () => {
        const name = q('[data-rp-client]').value, c = client(name);
        q('[data-rp-cur]').value = c.currency;
        q('[data-rp-channel]').value = BILLING[name].channel;
        const ch = CHANNELS.find(x => x.name === BILLING[name].channel); if (ch) q('[data-rp-account]').value = ch.account;
        const open = INVOICES.filter(i => i.client === name && isOpen(i)).sort((a, b) => a.due.localeCompare(b.due));
        rows.innerHTML = open.length ? open.map(i => `<tr data-bal="${balance(i)}"><td><input type="checkbox" checked aria-label="Apply to ${i.num}"></td><td>${i.num}</td><td class="num">${fds(i.due)}${isOverdue(i) ? ' <span class="small t-danger-ink">late</span>' : ''}</td><td class="num right">${fmt(balance(i), i.cur)}</td><td class="right"><input type="number" step="0.01" min="0" value="0" aria-label="Amount for ${i.num}"></td></tr>`).join('')
          : `<tr><td colspan="5" class="muted">No open invoices. The full amount becomes client credit.</td></tr>`;
        allocate();
      };
      const recalc = () => {
        const a = +amt.value || 0, f = +fee.value || 0, cur = q('[data-rp-cur]').value;
        q('[data-rp-landed]').value = a ? (a - f).toFixed(2) : '';
        q('[data-rp-rate]').value = cur === 'USD' ? '1 USD = 1 USD' : `1 ${cur} = ${FX[cur]} USD`;
        let used = 0; rows.querySelectorAll('tr[data-bal]').forEach(tr => { used += +tr.querySelector('input[type=number]').value || 0; });
        const rest = Math.round((a - used) * 100) / 100;
        left.className = 'note-line' + (rest < 0 ? ' t-danger' : rest > 0 ? ' t-ok' : '');
        left.textContent = !a ? 'Enter an amount to allocate it.' : rest < 0 ? `Allocated ${fmt(-rest, cur)} more than received. Lower an amount.` : rest > 0 ? `${fmt(rest, cur)} left over becomes client credit.` : `Fully allocated. Nothing left over.`;
        const name = q('[data-rp-client]').value;
        q('[data-rp-dup]').hidden = !PAYMENTS.some(p => p.client === name && p.amount === a && daysBetween(p.date, TODAY) <= 14);
      };
      const allocate = () => {
        let rest = +amt.value || 0;
        rows.querySelectorAll('tr[data-bal]').forEach(tr => {
          const on = tr.querySelector('input[type=checkbox]').checked, inp = tr.querySelector('input[type=number]');
          const v = on ? Math.min(rest, +tr.dataset.bal) : 0; rest -= v; inp.value = Math.round(v * 100) / 100;
        });
        recalc();
      };
      q('[data-rp-client]').addEventListener('change', loadRows);
      q('[data-rp-cur]').addEventListener('change', recalc);
      amt.addEventListener('input', allocate);
      fee.addEventListener('input', recalc);
      rows.addEventListener('change', e => { if (e.target.type === 'checkbox') allocate(); });
      rows.addEventListener('input', e => { if (e.target.type === 'number') recalc(); });
      q('[data-rp-channel]').addEventListener('change', e => { const ch = CHANNELS.find(x => x.name === e.target.value); if (ch) q('[data-rp-account]').value = ch.account; });
      dlg.querySelectorAll('[data-rp-proof]').forEach(r => r.addEventListener('change', () => {
        const none = dlg.querySelector('[data-rp-proof][value=none]').checked;
        q('[data-rp-file]').hidden = none; q('[data-rp-reason]').hidden = !none;
        q('[data-rp-reason] input').required = none;
      }));
      loadRows();
    });
  }

  function emailDialog(id, opts) {
    return `<dialog id="${id}" class="modal" data-email>
      <form method="dialog">
        <div class="modal-head"><h3>${esc(opts.title || 'Email invoice')}</h3><button type="button" class="icon-btn" data-close aria-label="Close">✕</button></div>
        <div class="modal-body stack">
          ${opts.kinds ? `<div class="seg" data-email-kind><button type="button" class="on" data-k="invoice">Invoice</button><button type="button" data-k="reminder">Reminder</button><button type="button" data-k="receipt">Receipt</button></div>` : ''}
          <div class="form-grid">
            <div class="field full"><label>To</label><input name="to" value="${esc(opts.to)}" data-email-to></div>
            <div class="field full"><label>Cc</label><input name="cc" value="${esc(opts.cc || '')}" data-email-cc></div>
            <div class="field full"><label>Subject</label><input name="subject" value="${esc(opts.subject)}" data-email-subject></div>
            <div class="field full"><label>Message</label><textarea name="body" rows="7" data-email-body>${esc(opts.body)}</textarea></div>
          </div>
          ${opts.attach === false ? '' : `<div class="row small muted" data-email-attach>Attached: <strong style="color:var(--ink)">${esc(opts.attach || 'INV-PS-0142.pdf')}</strong></div>`}
        </div>
        <div class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary" type="submit">Send email</button></div>
      </form>
    </dialog>`;
  }
  function reasonDialog(id, title, label, btn, extra) {
    return `<dialog id="${id}" class="modal"><form method="dialog">
      <div class="modal-head"><h3>${esc(title)}</h3><button type="button" class="icon-btn" data-close aria-label="Close">✕</button></div>
      <div class="modal-body stack">${extra || ''}<div class="field"><label>${esc(label)}</label><textarea rows="3" required placeholder="Required"></textarea></div></div>
      <div class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn ${/Void|Write off/.test(btn) ? 'danger' : 'primary'}" type="submit">${esc(btn)}</button></div>
    </form></dialog>`;
  }

  /* ================= 1. Finance dashboard ================= */
  function dashBody(st) {
    const p = PERIODS[st.period], cur = st.cur, entF = e => !st.entity || e === st.entity;
    const months = MONTHS.filter(m => inRange(m.key + '-15', p));
    let invoiced = 0, collected = 0;
    months.forEach(m => Object.keys(m.ent).forEach(e => { if (entF(e)) { invoiced += m.ent[e].inv; collected += m.ent[e].col; } }));
    const inv = INVOICES.filter(i => entF(i.ent));
    const outstanding = inv.filter(isOpen).reduce((a, i) => a + usd(balance(i), i.cur), 0);
    const overdue = inv.filter(isOverdue).reduce((a, i) => a + usd(balance(i), i.cur), 0);
    const pays = PAYMENTS.filter(x => entF(entOfCur(x.cur)) && inRange(x.date, p));
    const feesLost = pays.reduce((a, x) => a + usd(x.fee, x.cur), 0);
    const refunded = REFUNDS.filter(r => entF(entOfCur(r.cur)) && inRange(r.date, p)).reduce((a, r) => a + usd(r.amount, r.cur), 0);
    const woff = inv.filter(i => i.status === 'Written off' && inRange(i.issued, p)).reduce((a, i) => a + usd(i.total, i.cur), 0);
    const voided = inv.filter(i => i.status === 'Void' && inRange(i.issued, p)).reduce((a, i) => a + usd(i.total, i.cur), 0);
    const nOver = inv.filter(isOverdue).length;
    const c = n => fmt0(conv(n, cur), cur);

    // chart
    const W = 720, H = 250, L = 56, B = 30, T = 12, plotH = H - B - T, slot = (W - L - 8) / 12;
    const vals = MONTHS.map(m => { let a = 0, b = 0; Object.keys(m.ent).forEach(e => { if (entF(e)) { a += m.ent[e].inv; b += m.ent[e].col; } }); return [conv(a, cur), conv(b, cur)]; });
    const max = Math.max(...vals.flat(), 1), step = Math.pow(10, Math.floor(Math.log10(max))), top = Math.ceil(max / step) * step;
    let grid = '';
    for (let g = 0; g <= 4; g++) { const y = T + plotH - plotH * g / 4, v = top * g / 4; grid += `<line x1="${L}" x2="${W - 4}" y1="${y}" y2="${y}" stroke="var(--line)" stroke-width="1"/><text x="${L - 8}" y="${y + 4}" text-anchor="end">${v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? Math.round(v / 1e3) + 'k' : Math.round(v)}</text>`; }
    const bars = vals.map((v, k) => {
      const x = L + slot * k + slot * 0.18, bw = slot * 0.3, h1 = plotH * v[0] / top, h2 = plotH * v[1] / top, inP = inRange(MONTHS[k].key + '-15', p);
      return `<g opacity="${inP ? 1 : 0.45}"><rect x="${x}" y="${T + plotH - h1}" width="${bw}" height="${h1}" rx="2" style="fill:var(--accent)"><title>${MONTHS[k].label} ${MONTHS[k].year} invoiced ${fmt0(v[0], cur)}</title></rect><rect x="${x + bw + 2}" y="${T + plotH - h2}" width="${bw}" height="${h2}" rx="2" style="fill:var(--blue)"><title>${MONTHS[k].label} ${MONTHS[k].year} collected ${fmt0(v[1], cur)}</title></rect><text x="${x + bw + 1}" y="${H - 10}" text-anchor="middle">${MONTHS[k].label}</text></g>`;
    }).join('');

    // biggest open balances
    const big = inv.filter(isOpen).sort((a, b) => usd(balance(b), b.cur) - usd(balance(a), a.cur)).slice(0, 5);
    const byEnt = ENTITIES.filter(e => entF(e.id)).map(e => {
      let a = 0, b = 0; months.forEach(m => { a += m.ent[e.id].inv; b += m.ent[e.id].col; });
      const o = INVOICES.filter(i => i.ent === e.id && isOpen(i)).reduce((s, i) => s + usd(balance(i), i.cur), 0);
      return { e, a, b, o };
    });
    const byCh = {}; pays.forEach(x => { byCh[x.channel] = byCh[x.channel] || { n: 0, v: 0, f: 0 }; byCh[x.channel].n++; byCh[x.channel].v += usd(x.amount, x.cur); byCh[x.channel].f += usd(x.fee, x.cur); });
    const chRows = Object.entries(byCh).sort((a, b) => b[1].v - a[1].v);

    return `
      <div class="stats">
        <div class="stat"><div class="label">Invoiced</div><div class="value num">${c(invoiced)}</div><div class="sub">${p.label}</div></div>
        <div class="stat"><div class="label">Collected</div><div class="value num">${c(collected)}</div><div class="sub">${invoiced ? Math.round(collected / invoiced * 100) : 0}% of invoiced</div></div>
        <div class="stat"><div class="label">Outstanding</div><div class="value num">${c(outstanding)}</div><div class="sub">${inv.filter(isOpen).length} open invoices</div></div>
        <div class="stat"><div class="label">Overdue</div><div class="value num t-danger">${c(overdue)}</div><div class="sub">${nOver} invoices past due</div></div>
      </div>
      <div class="stats fin-small">
        <div class="stat"><div class="label">Fees lost</div><div class="value num">${c(feesLost)}</div><div class="sub">Channel fees</div></div>
        <div class="stat"><div class="label">Refunded</div><div class="value num">${c(refunded)}</div></div>
        <div class="stat"><div class="label">Written off</div><div class="value num">${c(woff)}</div></div>
        <div class="stat"><div class="label">Voided</div><div class="value num">${c(voided)}</div></div>
      </div>
      <div class="grid-2" style="grid-template-columns:minmax(0,2fr) minmax(0,1fr)">
        <div class="card">
          <div class="card-head"><h3>Invoiced vs collected, 12 months</h3><div class="legend"><span><i style="background:var(--accent)"></i>Invoiced</span><span><i style="background:var(--blue)"></i>Collected</span></div></div>
          <div class="card-body"><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Invoiced and collected per month in ${cur}">${grid}${bars}</svg>
          <div class="small muted">In ${cur}. Converted with the rate saved on each payment. Faded months are outside ${p.label.toLowerCase()}.</div></div>
        </div>
        <div class="card">
          <div class="card-head"><h3>Aging</h3><a class="btn sm ghost" href="#payments">Still owed</a></div>
          <div class="card-body">${agingHtml(inv, cur)}</div>
        </div>
      </div>
      <div class="grid-3">
        <div class="card">
          <div class="card-head"><h3>Biggest open balances</h3><a class="btn sm ghost" href="#invoices">All invoices</a></div>
          <div class="table-wrap"><table class="tbl"><thead><tr><th>Client</th><th>Invoice</th><th class="right">Balance</th></tr></thead><tbody>
            ${big.map(i => `<tr class="click" onclick="location.hash='#invoice'"><td>${esc(i.client)}<div class="small muted">${isOverdue(i) ? `<span class="t-danger-ink">${lateDays(i)} days late</span>` : i.status === 'Disputed' ? 'Disputed' : 'Due ' + fds(i.due)}</div></td><td class="num">${i.num}</td><td class="num right">${fmt0(balance(i), i.cur)}${i.cur !== cur ? `<div class="small muted">${c(usd(balance(i), i.cur))}</div>` : ''}</td></tr>`).join('') || `<tr><td colspan="3" class="muted">Nothing open.</td></tr>`}
          </tbody></table></div>
        </div>
        <div class="card">
          <div class="card-head"><h3>By entity</h3></div>
          <div class="table-wrap"><table class="tbl"><thead><tr><th>Entity</th><th class="right">Invoiced</th><th class="right">Collected</th><th class="right">Open</th></tr></thead><tbody>
            ${byEnt.map(r => `<tr><td>${esc(r.e.short)}</td><td class="num right">${c(r.a)}</td><td class="num right">${c(r.b)}</td><td class="num right">${c(r.o)}</td></tr>`).join('')}
          </tbody></table></div>
        </div>
        <div class="card">
          <div class="card-head"><h3>Collected by channel</h3></div>
          <div class="table-wrap"><table class="tbl"><thead><tr><th>Channel</th><th class="right">Payments</th><th class="right">Collected</th><th class="right">Fees</th></tr></thead><tbody>
            ${chRows.map(([n, r]) => `<tr><td>${esc(n)}</td><td class="num right">${r.n}</td><td class="num right">${c(r.v)}</td><td class="num right">${c(r.f)}</td></tr>`).join('') || `<tr><td colspan="4" class="muted">No payments in ${p.label.toLowerCase()}.</td></tr>`}
          </tbody></table></div>
        </div>
      </div>`;
  }

  screen({
    id: 'finance', title: 'Finance', group: 'Finance',
    render() {
      const n = remindersToday();
      return `<div class="page scr-fin">${CSS}
        <div class="row between"><h2 style="margin:0">Finance</h2><div class="row"><a class="btn" href="#finance-setup">Finance settings</a><a class="btn primary" href="#invoice">New invoice</a></div></div>
        <div class="toolbar row">
          <div class="seg" data-fin-period>${Object.entries(PERIODS).map(([k, v]) => `<button type="button" data-v="${k}"${k === 'month' ? ' class="on"' : ''}>${v.label}</button>`).join('')}</div>
          <select data-fin-entity aria-label="Entity">${entOpts('', 'All entities')}</select>
          <div class="seg" data-fin-cur>${['USD', 'AED', 'PKR'].map(cu => `<button type="button" data-v="${cu}"${cu === 'USD' ? ' class="on"' : ''}>${cu}</button>`).join('')}</div>
        </div>
        <div class="fin-banner"><div><strong>${n} payment reminders to send today.</strong> <span class="muted">${REMINDERS.filter(r => r.list === 'today' && r.auto).length} go out on auto at 10:00.</span></div><a class="btn sm primary" href="#payment-reminders">Review reminders</a></div>
        <div class="stack" style="gap:20px" data-fin-body>${dashBody({ period: 'month', entity: '', cur: 'USD' })}</div>
      </div>`;
    },
    mount(root) {
      const st = { period: 'month', entity: '', cur: 'USD' }, body = root.querySelector('[data-fin-body]');
      const draw = () => { body.innerHTML = dashBody(st); };
      const seg = (sel, key) => root.querySelector(sel).addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (!b) return; b.parentNode.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); st[key] = b.dataset.v; draw(); });
      seg('[data-fin-period]', 'period'); seg('[data-fin-cur]', 'cur');
      root.querySelector('[data-fin-entity]').addEventListener('change', e => { st.entity = e.target.value; draw(); });
    },
  });

  /* ================= 2. Invoices ================= */
  const stKeys = i => [i.status.toLowerCase().replace(/ /g, '-'), isOpen(i) ? 'open' : '', isOverdue(i) ? 'overdue' : ''].join(' ');
  screen({
    id: 'invoices', title: 'Invoices', group: 'Finance',
    render() {
      const rows = INVOICES.map(i => `<tr class="click" data-href="#invoice" data-st="${stKeys(i)}" data-ent="${i.ent}" data-client="${esc(i.client)}" data-text="${esc((i.num + ' ' + i.client + ' ' + i.title).toLowerCase())}">
        <td class="num"><a href="#invoice">${esc(i.num)}</a><div class="small muted hide-sm">${esc(i.title)}</div></td>
        <td>${esc(i.client)}</td><td class="hide-sm">${esc(ENT(i.ent).short)}</td>
        <td class="num">${fds(i.issued)}</td><td class="num">${fds(i.due)}</td>
        <td class="num right">${fmt(i.total, i.cur)}</td>
        <td class="num right">${balance(i) ? fmt(balance(i), i.cur) : '<span class="muted">—</span>'}</td>
        <td>${invStatus(i)}</td></tr>`).join('');
      const nextMonth = CLIENTS.filter(c => BILLING[c.name].basis === 'Monthly');
      return `<div class="page scr-fin">${CSS}
        <div class="row between"><h2 style="margin:0">Invoices</h2><div class="row"><button class="btn" data-open="invoices-past">Record past invoice <span class="p2">phase 2</span></button><a class="btn primary" href="#invoice">New invoice</a></div></div>
        <div class="tabs" data-tabs="inv"><button data-tab="all" class="on">All invoices</button><button data-tab="drafts">Monthly drafts <span class="p2">phase 2</span></button><button data-tab="upwork">Upwork earnings <span class="p2">phase 2</span></button><button data-tab="exports">Exports <span class="p2">phase 2</span></button></div>

        <section data-panel="inv:all" class="stack" style="gap:14px">
          <div class="toolbar row">
            <input type="search" placeholder="Search number, client or title" data-f="q" aria-label="Search invoices" style="flex:1;min-width:180px">
            <select data-f="st" aria-label="Status"><option value="">All statuses</option><option value="open">Open</option><option value="overdue">Overdue</option>${['Draft', 'Issued', 'Partly paid', 'Paid', 'Disputed', 'Void', 'Refunded', 'Partly refunded', 'Written off'].map(s => `<option value="${s.toLowerCase().replace(/ /g, '-')}">${s}</option>`).join('')}</select>
            <select data-f="ent" aria-label="Entity">${entOpts('', 'All entities')}</select>
            <select data-f="client" aria-label="Client">${clientOpts('', 'All clients')}</select>
          </div>
          <div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>Number</th><th>Client</th><th class="hide-sm">Entity</th><th>Issued</th><th>Due</th><th class="right">Total</th><th class="right">Balance</th><th>Status</th></tr></thead><tbody data-inv-rows>${rows}</tbody></table></div>
            <div class="empty" data-inv-empty hidden>No invoices match these filters.</div></div>
          <div class="small muted" data-inv-count>${INVOICES.length} invoices</div>
        </section>

        <section data-panel="inv:drafts" hidden class="stack" style="gap:14px">
          <div class="card"><div class="card-head"><h3>December drafts from agreed fees</h3><button class="btn primary sm" data-act="drafts">Create ${nextMonth.length} drafts</button></div>
            <div class="card-body small muted">Drafts are made on the 25th for every client billed monthly. Review them, then issue.</div>
            <div class="table-wrap"><table class="tbl"><thead><tr><th><input type="checkbox" checked aria-label="Select all"></th><th>Client</th><th>Entity</th><th>Title</th><th class="right">Agreed fee</th><th class="right">Tax</th><th class="right">Total</th></tr></thead><tbody>
              ${nextMonth.map(c => { const e = ENT(entOfCur(c.currency)), tax = c.fee * e.taxRate / 100; return `<tr><td><input type="checkbox" checked aria-label="Include ${esc(c.name)}"></td><td>${esc(c.name)}</td><td>${esc(e.short)}</td><td>December ${esc(c.services.join(' and ').toLowerCase())}</td><td class="num right">${fmt(c.fee, c.currency)}</td><td class="num right">${tax ? fmt(tax, c.currency) : '—'}</td><td class="num right">${fmt(c.fee + tax, c.currency)}</td></tr>`; }).join('')}
            </tbody></table></div></div>
        </section>

        <section data-panel="inv:upwork" hidden class="stack" style="gap:14px">
          <div class="stats"><div class="stat"><div class="label">Earned this month</div><div class="value num">USD 3,180</div></div><div class="stat"><div class="label">Upwork fees</div><div class="value num">USD 318</div><div class="sub">10% service fee</div></div><div class="stat"><div class="label">Pending release</div><div class="value num">USD 1,240</div></div><div class="stat"><div class="label">Withdrawn</div><div class="value num">USD 4,600</div><div class="sub">To Wise USD ••7720</div></div></div>
          <div class="card"><div class="card-head"><h3>Contracts</h3><button class="btn sm" data-act="upwork">Import statement</button></div>
            <div class="table-wrap"><table class="tbl"><thead><tr><th>Contract</th><th>Client</th><th>Type</th><th class="right">Hours</th><th class="right">Earned</th><th class="right">Fee</th><th>Status</th></tr></thead><tbody>
              <tr><td>Shopify SEO audit</td><td>Brightline Home (Upwork)</td><td>Fixed</td><td class="num right">—</td><td class="num right">USD 1,200</td><td class="num right">USD 120</td><td>${tone('Released', 'ok')}</td></tr>
              <tr><td>Local SEO retainer</td><td>Maple Physio (Upwork)</td><td>Hourly</td><td class="num right">32.5</td><td class="num right">USD 1,300</td><td class="num right">USD 130</td><td>${tone('In review', 'violet')}</td></tr>
              <tr><td>Blog content, 6 posts</td><td>Orbit Labs (Upwork)</td><td>Fixed</td><td class="num right">—</td><td class="num right">USD 680</td><td class="num right">USD 68</td><td>${tone('Pending release', 'warn')}</td></tr>
            </tbody></table></div></div>
        </section>

        <section data-panel="inv:exports" hidden class="stack" style="gap:14px">
          <div class="card"><div class="card-head"><h3>Export for the accountant</h3></div><div class="card-body">
            <form class="form-grid" data-export>
              <div class="field"><label>What</label><select><option>Invoices</option><option>Payments</option><option>Refunds and credits</option><option>VAT return summary</option></select></div>
              <div class="field"><label>Entity</label><select>${entOpts('', 'All entities')}</select></div>
              <div class="field"><label>From</label><input type="date" value="2026-10-01"></div>
              <div class="field"><label>To</label><input type="date" value="2026-10-31"></div>
              <div class="field"><label>Format</label><select><option>CSV</option><option>Excel (.xlsx)</option><option>PDF bundle (zip)</option></select></div>
              <div class="field"><label>Currency</label><select><option>Invoice currency</option><option>USD at saved rates</option><option>AED at saved rates</option></select></div>
              <div class="field full row"><button class="btn primary" type="submit">Download export</button></div>
            </form></div></div>
          <div class="card"><div class="card-head"><h3>Recent exports</h3></div><div class="list">
            <div class="item between row"><span>Invoices, FZ-LLC, Oct 2026, CSV</span><span class="small muted">Bilal Ahmed, 2 Nov</span></div>
            <div class="item between row"><span>VAT return summary, Q3 2026, Excel</span><span class="small muted">Bilal Ahmed, 12 Oct</span></div>
            <div class="item between row"><span>Payments, all entities, Sep 2026, CSV</span><span class="small muted">Yusuf Ali, 3 Oct</span></div>
          </div></div>
        </section>

        <dialog id="invoices-past" class="modal"><form method="dialog">
          <div class="modal-head"><h3>Record past invoice</h3><button type="button" class="icon-btn" data-close aria-label="Close">✕</button></div>
          <div class="modal-body stack">
            <div class="small muted">For invoices raised before the portal. The number is kept as written on the original.</div>
            <div class="form-grid">
              <div class="field"><label>Original number</label><input required placeholder="e.g. PS-2025-118"></div>
              <div class="field"><label>Client</label><select>${clientOpts('Cedar & Pine Dental')}</select></div>
              <div class="field"><label>Entity</label><select>${entOpts('ps')}</select></div>
              <div class="field"><label>Currency</label><select>${curOpts('AED')}</select></div>
              <div class="field"><label>Issued</label><input type="date" value="2025-12-01"></div>
              <div class="field"><label>Due</label><input type="date" value="2025-12-15"></div>
              <div class="field"><label>Total</label><input type="number" step="0.01" value="9975"></div>
              <div class="field"><label>Already paid</label><input type="number" step="0.01" value="9975"></div>
              <div class="field full"><label>Original document</label><input type="file" accept=".pdf,image/*"></div>
              <label class="check field full"><input type="checkbox" checked> Show this invoice in the client portal</label>
            </div>
          </div>
          <div class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary" type="submit">Save past invoice</button></div>
        </form></dialog>
      </div>`;
    },
    mount(root) {
      const f = k => root.querySelector(`[data-f="${k}"]`), rows = [...root.querySelectorAll('[data-inv-rows] tr')];
      const apply = () => {
        const q = f('q').value.trim().toLowerCase(), st = f('st').value, ent = f('ent').value, cl = f('client').value;
        let n = 0;
        rows.forEach(r => { const ok = (!q || r.dataset.text.includes(q)) && (!st || r.dataset.st.split(' ').includes(st)) && (!ent || r.dataset.ent === ent) && (!cl || r.dataset.client === cl); r.hidden = !ok; if (ok) n++; });
        root.querySelector('[data-inv-empty]').hidden = n > 0;
        root.querySelector('[data-inv-count]').textContent = `${n} of ${rows.length} invoices`;
      };
      ['q', 'st', 'ent', 'client'].forEach(k => f(k).addEventListener(k === 'q' ? 'input' : 'change', apply));
      rows.forEach(r => r.addEventListener('click', e => { if (!e.target.closest('a')) location.hash = r.dataset.href; }));
      root.addEventListener('click', e => {
        const a = e.target.closest('[data-act]'); if (!a) return;
        if (a.dataset.act === 'drafts') toast('5 December drafts created');
        if (a.dataset.act === 'upwork') toast('Upwork statement imported (preview only)');
      });
    },
  });

  /* ================= 3. Invoice editor ================= */
  const EDIT_INV = INV('INV-PS-0142');
  const EDIT_LINES = [
    { desc: 'SEO retainer, November', detail: 'Technical fixes, 12 keywords tracked, monthly report', qty: 1, rate: 7500, tax: 5 },
    { desc: 'Blog posts', detail: '4 posts of 1,200 words, briefs approved', qty: 4, rate: 500, tax: 5 },
  ];
  const lineRow = l => `<tr data-line>
    <td style="min-width:200px"><input class="l-desc" value="${esc(l.desc)}" aria-label="Description"><input class="l-detail" value="${esc(l.detail)}" aria-label="Detail" placeholder="Detail (optional)"></td>
    <td style="width:80px"><input class="l-qty num" type="number" step="0.5" min="0" value="${l.qty}" aria-label="Quantity"></td>
    <td style="width:120px"><input class="l-rate num" type="number" step="0.01" min="0" value="${l.rate}" aria-label="Rate"></td>
    <td style="width:80px"><input class="l-tax num" type="number" step="0.5" min="0" value="${l.tax}" aria-label="Tax percent"></td>
    <td class="num right l-amt" style="width:120px">—</td>
    <td style="width:40px"><button type="button" class="icon-btn" data-del-line aria-label="Remove line">✕</button></td></tr>`;

  screen({
    id: 'invoice', title: 'INV-PS-0142', group: null,
    render() {
      const i = EDIT_INV, e = ENT(i.ent), b = BILLING[i.client];
      const hist = [
        ['Bilal Ahmed', '3 Nov, 14:12', 'Recorded payment P-1088, AED 4,000 by Bank ENBD'],
        ['Auto', '1 Nov, 10:05', 'Emailed invoice to accounts@cedarpine.ae, cc rania@cedarpine.ae'],
        ['Bilal Ahmed', '1 Nov, 10:04', 'Issued. Number INV-PS-0142 assigned'],
        ['Auto', '25 Oct, 09:00', 'Created as monthly draft from agreed fee'],
      ];
      return `<div class="page scr-fin">${CSS}
        <div class="row between">
          <div class="stack" style="gap:4px"><a class="small" href="#invoices">← Invoices</a><h2 style="margin:0" class="num">${i.num}</h2><div class="row small">${tone('Partly paid', 'violet')}<span class="muted">${esc(i.client)} · due ${fd(i.due)}</span></div></div>
          <div class="actions">
            <button class="btn primary" data-inv-act="issue">Issue</button>
            <button class="btn" data-open="invoice-email">Email</button>
            <button class="btn" data-open="invoice-pay">Record payment</button>
            <button class="btn" data-inv-act="pdf">Download PDF</button>
            <button class="btn ghost" data-inv-act="dup">Duplicate</button>
            <button class="btn ghost" data-open="invoice-refund">Refund</button>
            <button class="btn ghost" data-open="invoice-dispute">Dispute</button>
            <button class="btn ghost" data-open="invoice-writeoff">Write off</button>
            <button class="btn danger" data-open="invoice-void">Void</button>
          </div>
        </div>
        <div class="note-line">This invoice is issued. Client and entity are locked, and saving asks for a reason. The total can't drop below the ${fmt(i.paid, i.cur)} already paid.</div>
        <div class="grid-2" style="align-items:start">
          <div class="stack" style="gap:16px">
            <div class="card"><div class="card-head"><h3>Details</h3></div><div class="card-body"><div class="form-grid">
              <div class="field"><label>Entity</label><select disabled>${entOpts(i.ent)}</select></div>
              <div class="field"><label>Client</label><select disabled>${clientOpts(i.client)}</select></div>
              <div class="field"><label>Currency</label><select data-iv="cur">${curOpts(i.cur)}</select></div>
              <div class="field"><label>PO or reference</label><input data-iv="po" value="CPD-SEO-2026-11"></div>
              <div class="field"><label>Issue date</label><input type="date" data-iv="issued" value="${i.issued}"></div>
              <div class="field"><label>Due date</label><input type="date" data-iv="due" value="${i.due}"><div class="row" style="gap:6px;margin-top:6px"><button type="button" class="btn sm ghost" data-due="7">+7</button><button type="button" class="btn sm ghost" data-due="14">+14</button><button type="button" class="btn sm ghost" data-due="30">+30</button></div></div>
              <div class="field full"><label>Title</label><input data-iv="title" value="${esc(i.title)}"></div>
            </div></div></div>
            <div class="card"><div class="card-head"><h3>Lines</h3><button type="button" class="btn sm" data-add-line>Add line</button></div>
              <div class="table-wrap"><table class="tbl lines"><thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>Tax %</th><th class="right">Amount</th><th></th></tr></thead><tbody data-lines>${EDIT_LINES.map(lineRow).join('')}</tbody></table></div>
              <div class="card-body stack">
                <div class="row" style="justify-content:flex-end"><label class="small muted" for="inv-disc">Discount</label><input id="inv-disc" type="number" step="0.01" min="0" value="0" data-iv="disc" style="width:120px;padding:6px 8px;border:1px solid var(--line);border-radius:6px;background:var(--surface);color:var(--ink);font:inherit"></div>
                <div class="totals" data-totals></div>
                <div class="note-line t-danger" data-below hidden>The total is below the amount already paid. Raise it or refund the difference.</div>
              </div></div>
            <div class="card"><div class="card-head"><h3>Payment and notes</h3></div><div class="card-body"><div class="form-grid">
              <div class="field"><label>Pay by</label><select data-iv="channel">${chanOpts(b.channel)}</select></div>
              <div class="field"><label>Pay link</label><input data-iv="link" value="https://wise.com/pay/r/PS0142cedar" placeholder="Paste a link"></div>
              <div class="field full"><label>Notes</label><textarea rows="2" data-iv="notes">Thank you for your business. Please quote the invoice number with your transfer.</textarea></div>
              <div class="field full"><label>Terms</label><textarea rows="2" data-iv="terms">Payment due within ${b.terms} days. Late balances get reminders at 1, 7, 14 and 30 days.</textarea></div>
            </div></div>
            <div class="modal-foot" style="padding:0 16px 16px;justify-content:flex-end"><button class="btn primary" data-open="invoice-edit">Save changes</button></div></div>
            <div class="card hist"><div class="card-head"><h3>History</h3></div><div class="list">${hist.map(h => `<div class="item">${h[0] === 'Auto' ? '<span class="avatar" style="--s:28px;--h:200">A</span>' : avatar(h[0])}<div><div>${esc(h[2])}</div><div class="small muted">${esc(h[0])} · ${esc(h[1])}</div></div></div>`).join('')}</div></div>
          </div>

          <div class="doc" data-doc aria-label="Invoice preview">
            <div class="row between" style="align-items:flex-start"><div><h4>Invoice</h4><div class="num" style="color:var(--ink)">${i.num}</div></div><div class="right"><strong style="color:var(--ink)">${esc(e.name)}</strong><div>${esc(e.address)}</div><div>${esc(e.taxId)}</div></div></div>
            <div class="grid-2" style="gap:12px"><div><div class="muted">Bill to</div><strong style="color:var(--ink)">${esc(b.legal)}</strong><div>${esc(b.address)}</div><div>${esc(b.taxId)}</div></div>
              <div class="kv" style="grid-template-columns:90px 1fr;font-size:13px"><dt>Issued</dt><dd data-pv="issued">${fd(i.issued)}</dd><dt>Due</dt><dd data-pv="due">${fd(i.due)}</dd><dt>Reference</dt><dd data-pv="po">CPD-SEO-2026-11</dd></div></div>
            <div><strong style="color:var(--ink)" data-pv="title">${esc(i.title)}</strong></div>
            <table><thead><tr><th>Item</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Tax</th><th class="r">Amount</th></tr></thead><tbody data-pv-lines></tbody></table>
            <div class="totals" data-pv-totals></div>
            <div class="paybox"><div><strong style="color:var(--ink)">Pay by <span data-pv="channel">${esc(b.channel)}</span></strong></div><div data-pv="chdetail"></div><div class="small" data-pv="link"></div></div>
            <div data-pv="notes"></div><div class="small muted" data-pv="terms"></div>
          </div>
        </div>

        ${emailDialog('invoice-email', { kinds: true, to: b.email, cc: b.cc, subject: `Invoice ${i.num} from Permanent SEO`, body: `Hi Rania,\n\nPlease find invoice ${i.num} for ${i.title.toLowerCase()} attached. The balance of AED 5,975 is due on ${fd(i.due)}.\n\nPay link: https://wise.com/pay/r/PS0142cedar\n\nThanks,\nBilal Ahmed\nPermanent SEO`, attach: `${i.num}.pdf` })}
        ${recordPaymentDialog('invoice-pay', i.client, 5975)}
        <dialog id="invoice-refund" class="modal"><form method="dialog">
          <div class="modal-head"><h3>Refund</h3><button type="button" class="icon-btn" data-close aria-label="Close">✕</button></div>
          <div class="modal-body stack"><div class="small muted">Up to ${fmt(i.paid, i.cur)} has been paid on this invoice.</div><div class="form-grid">
            <div class="field"><label>Amount</label><input type="number" step="0.01" max="${i.paid}" value="500" required></div>
            <div class="field"><label>Date</label><input type="date" value="${TODAY}"></div>
            <div class="field"><label>Paid back by</label><select>${chanOpts('Bank ENBD')}</select></div>
            <div class="field"><label>Reference</label><input placeholder="Transfer reference"></div>
            <div class="field full"><label>Reason</label><textarea rows="2" required placeholder="Required"></textarea></div></div></div>
          <div class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary" type="submit">Record refund</button></div>
        </form></dialog>
        ${reasonDialog('invoice-dispute', 'Mark as disputed', 'What is the client disputing?', 'Mark disputed', '<div class="small muted">Reminders pause while the invoice is disputed. Resolve it from this page.</div>')}
        ${reasonDialog('invoice-writeoff', 'Write off balance', 'Reason', 'Write off AED 5,975', '<div class="small muted">The open balance stops counting as owed and shows in Written off.</div>')}
        ${reasonDialog('invoice-void', 'Void invoice', 'Reason for voiding', 'Void invoice', '<div class="note-line t-warn">This invoice has a payment. Voiding moves AED 4,000 to client credit. The number stays used.</div>')}
        ${reasonDialog('invoice-edit', 'Save changes to an issued invoice', 'Reason for the change', 'Save changes', '<div class="small muted">The client gets the updated PDF if you email it again. The reason is kept in history.</div>')}
      </div>`;
    },
    mount(root) {
      const q = s => root.querySelector(s), tb = q('[data-lines]');
      const iv = k => q(`[data-iv="${k}"]`), pv = k => q(`[data-pv="${k}"]`);
      const paid = EDIT_INV.paid;
      const recalc = () => {
        const cur = iv('cur').value;
        const lines = [...tb.querySelectorAll('tr[data-line]')].map(tr => {
          const g = c => tr.querySelector(c);
          const l = { tr, desc: g('.l-desc').value, detail: g('.l-detail').value, qty: +g('.l-qty').value || 0, rate: +g('.l-rate').value || 0, tax: +g('.l-tax').value || 0 };
          l.amt = l.qty * l.rate; g('.l-amt').textContent = fmt(l.amt, cur); return l;
        });
        const sub = lines.reduce((a, l) => a + l.amt, 0);
        const disc = Math.min(+iv('disc').value || 0, sub);
        // discount spread across lines pro rata, before tax
        let tax = 0; lines.forEach(l => { const share = sub ? disc * l.amt / sub : 0; tax += (l.amt - share) * l.tax / 100; });
        tax = Math.round(tax * 100) / 100;
        const total = sub - disc + tax, bal = total - paid;
        const tot = `<span>Subtotal</span><span class="right">${fmt(sub, cur)}</span>${disc ? `<span>Discount</span><span class="right">− ${fmt(disc, cur)}</span>` : ''}<span>VAT</span><span class="right">${fmt(tax, cur)}</span><span class="grand">Total</span><span class="grand right">${fmt(total, cur)}</span><span>Paid</span><span class="right">− ${fmt(paid, cur)}</span><span><strong>Balance due</strong></span><span class="right"><strong>${fmt(Math.max(bal, 0), cur)}</strong></span>`;
        q('[data-totals]').innerHTML = tot; q('[data-pv-totals]').innerHTML = tot;
        q('[data-below]').hidden = total >= paid;
        q('[data-pv-lines]').innerHTML = lines.map(l => `<tr><td><strong style="color:var(--ink)">${esc(l.desc || 'Untitled line')}</strong>${l.detail ? `<div>${esc(l.detail)}</div>` : ''}</td><td class="r">${l.qty}</td><td class="r">${fmt(l.rate, cur)}</td><td class="r">${l.tax}%</td><td class="r">${fmt(l.amt, cur)}</td></tr>`).join('') || '<tr><td colspan="5">No lines yet.</td></tr>';
        pv('issued').textContent = fd(iv('issued').value); pv('due').textContent = fd(iv('due').value);
        pv('po').textContent = iv('po').value || '—'; pv('title').textContent = iv('title').value;
        const ch = CHANNELS.find(c => c.name === iv('channel').value);
        pv('channel').textContent = iv('channel').value; pv('chdetail').textContent = ch ? ch.details : '';
        pv('link').textContent = iv('link').value ? 'Pay online: ' + iv('link').value : '';
        pv('notes').textContent = iv('notes').value; pv('terms').textContent = iv('terms').value;
      };
      root.addEventListener('input', e => { if (e.target.closest('[data-lines]') || e.target.matches('[data-iv]')) recalc(); });
      root.addEventListener('change', e => { if (e.target.matches('[data-iv]')) recalc(); });
      q('[data-add-line]').addEventListener('click', () => { tb.insertAdjacentHTML('beforeend', lineRow({ desc: '', detail: '', qty: 1, rate: 0, tax: 5 })); recalc(); tb.lastElementChild.querySelector('.l-desc').focus(); });
      tb.addEventListener('click', e => { const d = e.target.closest('[data-del-line]'); if (d) { d.closest('tr').remove(); recalc(); } });
      root.querySelectorAll('[data-due]').forEach(b => b.addEventListener('click', () => { iv('due').value = addDays(iv('issued').value, +b.dataset.due); recalc(); }));
      root.addEventListener('click', e => {
        const a = e.target.closest('[data-inv-act]'); if (!a) return;
        ({ issue: () => toast('Already issued as INV-PS-0142'), pdf: () => toast('INV-PS-0142.pdf downloaded (preview only)'), dup: () => toast('Duplicated as a new draft') })[a.dataset.invAct]();
      });
      // email kind switcher
      const dlg = q('#invoice-email'), seg = dlg.querySelector('[data-email-kind]');
      const kinds = {
        invoice: ['Invoice INV-PS-0142 from Permanent SEO', dlg.querySelector('[data-email-body]').value, 'INV-PS-0142.pdf'],
        reminder: ['Reminder: INV-PS-0142 is due on 15 Nov', 'Hi Rania,\n\nA quick reminder that AED 5,975 on invoice INV-PS-0142 is due on 15 Nov 2026.\n\nPay link: https://wise.com/pay/r/PS0142cedar\n\nThanks,\nBilal Ahmed', 'INV-PS-0142.pdf'],
        receipt: ['Receipt for your payment of AED 4,000', 'Hi Rania,\n\nThanks for your payment of AED 4,000 received on 3 Nov 2026 against INV-PS-0142. The balance is now AED 5,975.\n\nBest,\nBilal Ahmed', 'Receipt-P-1088.pdf'],
      };
      seg.addEventListener('click', e => { const b = e.target.closest('button[data-k]'); if (!b) return; seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); const k = kinds[b.dataset.k]; dlg.querySelector('[data-email-subject]').value = k[0]; dlg.querySelector('[data-email-body]').value = k[1]; dlg.querySelector('[data-email-attach] strong').textContent = k[2]; });
      wireRecordPayment(root);
      recalc();
    },
  });

  /* ================= 4. Profitability ================= */
  const PMONTHS = ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'];
  const PCLIENTS = [
    { name: 'Cedar & Pine Dental', fee: 2587, hours: 46, budget: 60, logged: 1120, est: 310, svc: { SEO: .7, Content: .3 } },
    { name: 'Alba Motors', fee: 3812, hours: 71, budget: 70, logged: 1740, est: 520, svc: { PPC: .65, Social: .35 } },
    { name: 'Luma Skincare', fee: 4200, hours: 98, budget: 80, logged: 2610, est: 640, svc: { SEO: .4, PPC: .4, Design: .2 } },
    { name: 'Harbor Legal', fee: 3000, hours: 52, budget: 70, logged: 1380, est: 260, svc: { Web: .75, SEO: .25 } },
    { name: 'Nova Fitness', fee: 1634, hours: 34, budget: 40, logged: 690, est: 240, svc: { Social: .6, Content: .4 } },
    { name: 'Zest Kitchen', fee: 1620, hours: 29, budget: 40, logged: 640, est: 190, svc: { PPC: 1 } },
  ];
  const pmult = k => [0.86, 0.9, 0.93, 0.97, 1, 0.62][k];
  const pData = k => {
    const m = pmult(k), cm = k === 5 ? 0.58 : 0.92 + 0.03 * k;
    return PCLIENTS.map((c, j) => {
      const fee = k === 5 ? c.fee * (j % 2 ? 1 : 0.6) : c.fee * (0.9 + 0.02 * k);
      const cost = (c.logged + c.est) * cm * (1 + 0.03 * Math.sin(k + j));
      return { ...c, fee, cost, hours: Math.round(c.hours * (k === 5 ? 0.22 : m)), basis: k === 5 && j % 2 === 0 ? 'Agreed fee' : 'Invoiced' };
    });
  };
  const OVERHEAD = [5900, 6000, 6100, 6100, 6250, 6250];
  const SALARIES = [17800, 17800, 18400, 18400, 18900, 18900];
  let MARGIN_ALERT = 35;
  const mPct = (fee, cost) => fee ? (fee - cost) / fee * 100 : 0;
  const mTone = p => p < 0 ? 't-danger' : p < MARGIN_ALERT ? 't-warn' : 't-ok';
  const hTone = (h, b) => h / b >= 1 ? 't-danger' : h / b >= 0.8 ? 't-warn' : 't-ok';
  const DEPTS = [
    { d: 'SEO', people: 1, sal: 3400, hrs: 148, bill: 0.82 }, { d: 'PPC', people: 1, sal: 3000, hrs: 152, bill: 0.86 },
    { d: 'Content', people: 1, sal: 2100, hrs: 140, bill: 0.88 }, { d: 'Web', people: 1, sal: 2900, hrs: 150, bill: 0.74 },
    { d: 'Design', people: 1, sal: 2200, hrs: 138, bill: 0.61 }, { d: 'Social', people: 1, sal: 2000, hrs: 146, bill: 0.8 },
    { d: 'Client Success', people: 2, sal: 5200, hrs: 300, bill: 0.35 }, { d: 'Finance', people: 1, sal: 2600, hrs: 150, bill: 0 }, { d: 'Leadership', people: 1, sal: 6000, hrs: 140, bill: 0.1 },
  ];
  const usd0 = n => fmt0(n, 'USD');

  function profBody(k) {
    const rows = pData(k), fees = rows.reduce((a, r) => a + r.fee, 0), cost = rows.reduce((a, r) => a + r.cost, 0), gm = mPct(fees, cost);
    const after = fees - cost - OVERHEAD[k];
    return `<div class="stats">
        <div class="stat"><div class="label">Fees</div><div class="value num">${usd0(fees)}</div><div class="sub">${rows.filter(r => r.basis === 'Agreed fee').length ? 'Agreed fee where not invoiced yet' : 'Invoiced this month'}</div></div>
        <div class="stat"><div class="label">Client cost</div><div class="value num">${usd0(cost)}</div><div class="sub">Logged plus estimated time</div></div>
        <div class="stat"><div class="label">Gross margin</div><div class="value num ${mTone(gm)}">${Math.round(gm)}%</div><div class="sub">${usd0(fees - cost)} · alert below ${MARGIN_ALERT}%</div></div>
        <div class="stat"><div class="label">Overhead</div><div class="value num">${usd0(OVERHEAD[k])}</div><div class="sub">Non-client roles</div></div>
        <div class="stat"><div class="label">After all salaries</div><div class="value num ${after < 0 ? 't-danger' : ''}">${usd0(after)}</div><div class="sub">Salaries ${usd0(SALARIES[k])}</div></div>
      </div>`;
  }
  function profClientRows(k, qs, sort) {
    let rows = pData(k).map(r => ({ ...r, m: mPct(r.fee, r.cost) }));
    if (qs) rows = rows.filter(r => r.name.toLowerCase().includes(qs));
    const s = { margin: (a, b) => a.m - b.m, fee: (a, b) => b.fee - a.fee, cost: (a, b) => b.cost - a.cost, hours: (a, b) => b.hours / b.budget - a.hours / a.budget, name: (a, b) => a.name.localeCompare(b.name) }[sort];
    rows.sort(s);
    return rows.map(r => `<tr class="click" data-pc="${esc(r.name)}"><td>${esc(r.name)}<div class="small muted">${r.basis}</div></td><td class="num right">${usd0(r.fee)}</td><td class="num right">${usd0(r.cost * r.logged / (r.logged + r.est))}</td><td class="num right hide-sm">${usd0(r.cost * r.est / (r.logged + r.est))}</td><td class="num right">${usd0(r.fee - r.cost)}</td><td class="num right"><span class="${mTone(r.m).replace('t-', 't-') + '-ink'}">${Math.round(r.m)}%</span></td><td style="min-width:150px"><div class="row small" style="justify-content:space-between"><span class="num">${r.hours} of ${r.budget} h</span><span class="num muted">${Math.round(r.hours / r.budget * 100)}%</span></div><div class="bar ${hTone(r.hours, r.budget)}"><i style="width:${Math.min(100, Math.round(r.hours / r.budget * 100))}%"></i></div></td></tr>`).join('') || `<tr><td colspan="7" class="muted">No clients match.</td></tr>`;
  }
  function profService(k) {
    const by = {}; pData(k).forEach(r => Object.entries(r.svc).forEach(([s, w]) => { by[s] = by[s] || { fee: 0, cost: 0, n: 0 }; by[s].fee += r.fee * w; by[s].cost += r.cost * w; by[s].n++; }));
    return Object.entries(by).sort((a, b) => b[1].fee - a[1].fee).map(([s, v]) => { const m = mPct(v.fee, v.cost); return `<tr><td>${s}</td><td class="num right">${v.n}</td><td class="num right">${usd0(v.fee)}</td><td class="num right">${usd0(v.cost)}</td><td class="num right">${usd0(v.fee - v.cost)}</td><td class="num right"><span class="${mTone(m)}-ink">${Math.round(m)}%</span></td></tr>`; }).join('');
  }
  function profDept(k) {
    const f = 0.95 + 0.01 * k;
    return DEPTS.map(d => { const sal = d.sal * f, toC = sal * d.bill; return `<tr><td>${d.d}</td><td class="num right">${d.people}</td><td class="num right">${usd0(sal)}</td><td class="num right">${Math.round(d.hrs * (k === 5 ? 0.2 : 1))}</td><td class="num right">${Math.round(d.bill * 100)}%</td><td class="num right">${usd0(toC)}</td><td class="num right">${usd0(sal - toC)}</td></tr>`; }).join('');
  }
  function profTrend() {
    const pts = PMONTHS.map((m, k) => { const r = pData(k), f = r.reduce((a, x) => a + x.fee, 0), c = r.reduce((a, x) => a + x.cost, 0); return { m, f, c, after: f - c - OVERHEAD[k] }; });
    const W = 640, H = 230, L = 56, T = 14, B = 30, ph = H - T - B, max = Math.ceil(Math.max(...pts.map(p => p.f)) / 5000) * 5000, min = Math.min(0, ...pts.map(p => p.after));
    const x = k => L + (W - L - 20) * k / 5, y = v => T + ph - ph * (v - min) / (max - min);
    const line = (key, col) => `<polyline fill="none" stroke="var(${col})" stroke-width="2.5" points="${pts.map((p, k) => `${x(k)},${y(p[key])}`).join(' ')}"/>` + pts.map((p, k) => `<circle cx="${x(k)}" cy="${y(p[key])}" r="3.5" style="fill:var(${col})"><title>${usd0(p[key])}</title></circle>`).join('');
    let grid = ''; for (let g = 0; g <= 4; g++) { const v = min + (max - min) * g / 4; grid += `<line x1="${L}" x2="${W - 10}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${Math.round(v / 1000)}k</text>`; }
    const lab = pts.map((p, k) => `<text x="${x(k)}" y="${H - 8}" text-anchor="middle">${MON[+p.m.slice(5) - 1]}</text>`).join('');
    return `<div class="card"><div class="card-head"><h3>Last 6 months, USD</h3><div class="legend"><span><i style="background:var(--accent)"></i>Fees</span><span><i style="background:var(--warn)"></i>Client cost</span><span><i style="background:var(--blue)"></i>After all salaries</span></div></div>
      <div class="card-body"><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Six month profitability trend">${grid}${line('f', '--accent')}${line('c', '--warn')}${line('after', '--blue')}${lab}</svg><div class="small muted">November is part month. Fees use the agreed fee for clients not invoiced yet.</div></div></div>
      <div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>Month</th><th class="right">Fees</th><th class="right">Client cost</th><th class="right">Gross margin</th><th class="right">After all salaries</th></tr></thead><tbody>${pts.map(p => { const m = mPct(p.f, p.c); return `<tr><td>${MON[+p.m.slice(5) - 1]} 2026</td><td class="num right">${usd0(p.f)}</td><td class="num right">${usd0(p.c)}</td><td class="num right"><span class="${mTone(m)}-ink">${Math.round(m)}%</span></td><td class="num right">${usd0(p.after)}</td></tr>`; }).join('')}</tbody></table></div></div>`;
  }

  screen({
    id: 'profitability', title: 'Profitability', group: 'Finance',
    render() {
      const k = 4;
      return `<div class="page scr-fin">${CSS}
        <div class="row between"><div class="monthnav"><button class="icon-btn" data-pm="-1" aria-label="Previous month">‹</button><strong data-pm-label>October 2026</strong><button class="icon-btn" data-pm="1" aria-label="Next month">›</button></div>
          <div class="row"><button class="btn" data-open="profitability-settings">Profit settings</button></div></div>
        <div data-prof-cards>${profBody(k)}</div>
        <div class="tabs" data-tabs="prof"><button data-tab="client" class="on">Client</button><button data-tab="service">Service</button><button data-tab="dept">Department</button><button data-tab="trend">6-month trend</button></div>
        <section data-panel="prof:client" class="stack" style="gap:12px">
          <div class="toolbar row"><input type="search" placeholder="Search clients" data-pc-q aria-label="Search clients" style="flex:1;min-width:160px"><select data-pc-sort aria-label="Sort"><option value="margin">Lowest margin first</option><option value="fee">Highest fees</option><option value="cost">Highest cost</option><option value="hours">Most hours used</option><option value="name">Name</option></select></div>
          <div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>Client</th><th class="right">Fees</th><th class="right">Logged cost</th><th class="right hide-sm">Estimated cost</th><th class="right">Margin</th><th class="right">Margin %</th><th>Hours vs budget</th></tr></thead><tbody data-pc-rows>${profClientRows(k, '', 'margin')}</tbody></table></div></div>
          <div class="small muted">Hourly cost is monthly salary divided by working hours. Logged hours cost the client they were logged on; the rest of a client-facing person's time is split across their clients as estimated cost.</div>
        </section>
        <section data-panel="prof:service" hidden><div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>Service</th><th class="right">Clients</th><th class="right">Fees</th><th class="right">Cost</th><th class="right">Margin</th><th class="right">Margin %</th></tr></thead><tbody data-ps-rows>${profService(k)}</tbody></table></div></div></section>
        <section data-panel="prof:dept" hidden><div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>Department</th><th class="right">People</th><th class="right">Salaries</th><th class="right">Hours</th><th class="right">On clients</th><th class="right">Cost to clients</th><th class="right">Overhead</th></tr></thead><tbody data-pd-rows>${profDept(k)}</tbody></table></div></div></section>
        <section data-panel="prof:trend" hidden class="stack" style="gap:16px">${profTrend()}</section>

        <dialog id="profitability-client" class="modal"><div class="modal-head"><h3 data-pcd-title>Client</h3><button type="button" class="icon-btn" data-close aria-label="Close">✕</button></div><div class="modal-body" data-pcd-body></div><div class="modal-foot"><button type="button" class="btn ghost" data-close>Close</button><a class="btn primary" href="#client">Open client</a></div></dialog>
        <dialog id="profitability-settings" class="modal"><form method="dialog">
          <div class="modal-head"><h3>Profit settings</h3><button type="button" class="icon-btn" data-close aria-label="Close">✕</button></div>
          <div class="modal-body stack"><div class="form-grid">
            <div class="field"><label>Margin alert below (%)</label><input type="number" min="0" max="100" value="${MARGIN_ALERT}" data-ps-alert></div>
            <div class="field"><label>Working hours a month</label><input type="number" value="160"></div>
            <div class="field full"><label>Send the monthly alert to</label><select><option>Yusuf Ali and Bilal Ahmed</option><option>Finance team only</option></select></div></div>
            <label class="check"><input type="checkbox" checked> Alert when a client's margin drops below the threshold</label>
            <label class="check"><input type="checkbox" checked> Alert at 80% and 100% of a client's hours budget</label>
            <label class="check"><input type="checkbox"> Alert when after-salaries result is negative</label>
          </div>
          <div class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary" type="submit">Save settings</button></div>
        </form></dialog>
      </div>`;
    },
    mount(root) {
      let k = 4; const q = s => root.querySelector(s);
      const draw = () => {
        q('[data-pm-label]').textContent = `${MON[+PMONTHS[k].slice(5) - 1]} 2026`;
        q('[data-prof-cards]').innerHTML = profBody(k);
        q('[data-pc-rows]').innerHTML = profClientRows(k, q('[data-pc-q]').value.trim().toLowerCase(), q('[data-pc-sort]').value);
        q('[data-ps-rows]').innerHTML = profService(k); q('[data-pd-rows]').innerHTML = profDept(k);
        q('[data-pm="-1"]').disabled = k === 0; q('[data-pm="1"]').disabled = k === PMONTHS.length - 1;
      };
      root.querySelectorAll('[data-pm]').forEach(b => b.addEventListener('click', () => { k = Math.max(0, Math.min(PMONTHS.length - 1, k + +b.dataset.pm)); draw(); }));
      q('[data-pc-q]').addEventListener('input', draw); q('[data-pc-sort]').addEventListener('change', draw);
      q('[data-pc-rows]').addEventListener('click', e => {
        const tr = e.target.closest('tr[data-pc]'); if (!tr) return;
        const r = pData(k).find(x => x.name === tr.dataset.pc), m = mPct(r.fee, r.cost), people = PEOPLE.filter(p => ['SEO', 'PPC', 'Content', 'Social', 'Web', 'Design'].some(s => r.svc[s] && p.dept === s));
        q('[data-pcd-title]').textContent = r.name;
        q('[data-pcd-body]').innerHTML = `<dl class="kv"><dt>Fees</dt><dd class="num">${usd0(r.fee)} <span class="muted small">(${r.basis.toLowerCase()})</span></dd><dt>Logged cost</dt><dd class="num">${usd0(r.cost * r.logged / (r.logged + r.est))}</dd><dt>Estimated cost</dt><dd class="num">${usd0(r.cost * r.est / (r.logged + r.est))}</dd><dt>Margin</dt><dd class="num"><span class="${mTone(m)}-ink">${Math.round(m)}%</span> · ${usd0(r.fee - r.cost)}</dd><dt>Hours</dt><dd class="num">${r.hours} of ${r.budget} budgeted</dd><dt>Services</dt><dd>${Object.keys(r.svc).join(', ')}</dd></dl>
          <h4 style="margin:16px 0 8px">Who worked on it</h4><div class="list">${people.map((p, j) => `<div class="item row between"><span class="row">${avatar(p.name, 24)} ${esc(p.name)}</span><span class="num small muted">${Math.round(r.hours / Math.max(people.length, 1) + j * 2)} h</span></div>`).join('')}</div>`;
        q('#profitability-client').showModal();
      });
      q('#profitability-settings form').addEventListener('submit', () => { MARGIN_ALERT = +q('[data-ps-alert]').value || 35; draw(); });
    },
  });

  /* ================= 5. Payments ================= */
  screen({
    id: 'payments', title: 'Payments', group: 'Finance',
    render() {
      const recvU = PAYMENTS.reduce((a, p) => a + usd(p.amount, p.cur), 0), feeU = PAYMENTS.reduce((a, p) => a + usd(p.fee, p.cur), 0);
      const credU = CREDITS.reduce((a, c) => a + usd(c.amount, c.cur), 0), refU = REFUNDS.reduce((a, r) => a + usd(r.amount, r.cur), 0);
      const open = INVOICES.filter(isOpen), owedU = open.reduce((a, i) => a + usd(balance(i), i.cur), 0), overU = open.filter(isOverdue).reduce((a, i) => a + usd(balance(i), i.cur), 0);
      const owing = [...new Set(open.map(i => i.client))];
      const prow = p => `<tr data-client="${esc(p.client)}" data-ch="${esc(p.channel)}" data-acc="${esc(p.account)}" data-proof="${p.proof ? 'yes' : 'no'}" data-date="${p.date}">
        <td class="num">${fds(p.date)}</td><td>${esc(p.client)}<div class="small muted">${p.id} · ${esc(p.ref)}</div></td>
        <td class="num right">${fmt(p.amount, p.cur)}</td><td class="num right hide-sm">${p.fee ? fmt(p.fee, p.cur) : '—'}</td><td class="num right hide-sm">${fmt(p.amount - p.fee, p.cur)}</td>
        <td>${esc(p.channel)}<div class="small muted hide-sm">${esc(p.account)}</div></td>
        <td class="num">${p.applied.length ? p.applied.map(n => `<a href="#invoice">${n}</a>`).join(', ') : `<span class="muted">Credit ${fmt(p.credit, p.cur)}</span>`}</td>
        <td>${p.proof ? tone('Attached', 'ok') : tone('Missing', 'warn')}</td>
        <td class="num small muted hide-sm">${p.cur === 'USD' ? '—' : `1 ${p.cur} = ${p.rate}`}</td></tr>`;
      const owedRows = owing.map(n => { const l = open.filter(i => i.client === n), cur = l[0].cur, b = l.reduce((a, i) => a + balance(i), 0), od = l.filter(isOverdue), oldest = l.sort((a, z) => a.due.localeCompare(z.due))[0]; const cr = CREDITS.find(c => c.client === n); return `<tr><td>${esc(n)}</td><td class="num right">${l.length}</td><td class="num right">${fmt(b, cur)}</td><td class="num right">${od.length ? `<span class="t-danger-ink">${fmt(od.reduce((a, i) => a + balance(i), 0), cur)}</span>` : '—'}</td><td class="num">${fds(oldest.due)}${isOverdue(oldest) ? ` <span class="small t-danger-ink">${lateDays(oldest)} days late</span>` : ''}</td><td class="num right">${cr ? fmt(cr.amount, cr.cur) : '—'}</td><td class="right"><a class="btn sm ghost" href="#invoices">Invoices</a></td></tr>`; }).join('');
      return `<div class="page scr-fin">${CSS}
        <div class="row between"><h2 style="margin:0">Payments</h2><div class="row"><button class="btn" data-open="payments-credit">Apply credit <span class="p2">phase 2</span></button><button class="btn primary" data-open="payments-record">Record payment</button></div></div>
        <div class="tabs" data-tabs="pay"><button data-tab="recv" class="on">Received</button><button data-tab="owed">Still owed</button></div>
        <section data-panel="pay:recv" class="stack" style="gap:16px">
          <div class="toolbar row">
            <div class="seg" data-pay-period><button type="button" data-v="month">This month</button><button type="button" data-v="last">Last month</button><button type="button" data-v="quarter">Quarter</button><button type="button" data-v="year" class="on">12 months</button></div>
            <select data-pf="client" aria-label="Client">${clientOpts('', 'All clients')}</select>
            <select data-pf="ch" aria-label="Channel">${chanOpts('', 'All channels')}</select>
            <select data-pf="acc" aria-label="Account"><option value="">All accounts</option>${CHANNELS.map(c => `<option>${esc(c.account)}</option>`).join('')}</select>
            <select data-pf="proof" aria-label="Proof"><option value="">Any proof</option><option value="yes">Proof attached</option><option value="no">Missing proof</option></select>
          </div>
          <div class="stats">
            <div class="stat"><div class="label">Received</div><div class="value num" data-pk="recv">${usd0(recvU)}</div><div class="sub" data-pk="n">${PAYMENTS.length} payments</div></div>
            <div class="stat"><div class="label">Fees</div><div class="value num" data-pk="fee">${usd0(feeU)}</div><div class="sub">Taken by channels</div></div>
            <div class="stat"><div class="label">Credit</div><div class="value num">${usd0(credU)}</div><div class="sub">${CREDITS.length} clients hold credit</div></div>
            <div class="stat"><div class="label">Refunded</div><div class="value num">${usd0(refU)}</div><div class="sub">${REFUNDS.length} refunds</div></div>
            <div class="stat"><div class="label">Missing proof</div><div class="value num t-warn" data-pk="miss">${PAYMENTS.filter(p => !p.proof).length}</div><div class="sub">Add a file or a reason</div></div>
          </div>
          <div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Client</th><th class="right">Amount</th><th class="right hide-sm">Fee</th><th class="right hide-sm">Landed</th><th>Channel</th><th>Applied to</th><th>Proof</th><th class="hide-sm">Rate saved</th></tr></thead><tbody data-pay-rows>${PAYMENTS.slice().sort((a, b) => b.date.localeCompare(a.date)).map(prow).join('')}</tbody></table></div><div class="empty" data-pay-empty hidden>No payments match these filters.</div></div>
          <div class="card"><div class="card-head"><h3>Refunds</h3></div><div class="table-wrap"><table class="tbl"><thead><tr><th>Date</th><th>Client</th><th>Invoice</th><th class="right">Amount</th><th>Reason</th></tr></thead><tbody>${REFUNDS.map(r => `<tr><td class="num">${fds(r.date)}</td><td>${esc(r.client)}</td><td class="num"><a href="#invoice">${r.inv}</a></td><td class="num right">${fmt(r.amount, r.cur)}</td><td>${esc(r.reason)}</td></tr>`).join('')}</tbody></table></div></div>
        </section>
        <section data-panel="pay:owed" hidden class="stack" style="gap:16px">
          <div class="stats">
            <div class="stat"><div class="label">Owed</div><div class="value num">${usd0(owedU)}</div><div class="sub">${open.length} open invoices</div></div>
            <div class="stat"><div class="label">Overdue</div><div class="value num t-danger">${usd0(overU)}</div><div class="sub">${open.filter(isOverdue).length} invoices</div></div>
            <div class="stat"><div class="label">Credit</div><div class="value num">${usd0(credU)}</div><div class="sub">Can be applied to open invoices</div></div>
            <div class="stat"><div class="label">Clients owing</div><div class="value num">${owing.length}</div><div class="sub">of ${CLIENTS.length} clients</div></div>
          </div>
          <div class="grid-2" style="grid-template-columns:minmax(0,1fr) minmax(0,2fr);align-items:start">
            <div class="card"><div class="card-head"><h3>Aging, USD</h3></div><div class="card-body">${agingHtml(INVOICES, 'USD')}</div></div>
            <div class="card"><div class="card-head"><h3>By client</h3></div><div class="table-wrap"><table class="tbl"><thead><tr><th>Client</th><th class="right">Open</th><th class="right">Balance</th><th class="right">Overdue</th><th>Oldest due</th><th class="right">Credit</th><th></th></tr></thead><tbody>${owedRows}</tbody></table></div></div>
          </div>
          <div class="card"><div class="card-head"><h3>Client credit <span class="p2">phase 2</span></h3></div><div class="table-wrap"><table class="tbl"><thead><tr><th>Client</th><th class="right">Credit</th><th>From</th><th class="right">Actions</th></tr></thead><tbody>${CREDITS.map(c => `<tr><td>${esc(c.client)}</td><td class="num right">${fmt(c.amount, c.cur)}</td><td>${esc(c.from)}</td><td class="right"><div class="row" style="justify-content:flex-end"><button class="btn sm" data-open="payments-credit">Apply credit</button><button class="btn sm ghost" data-open="payments-giveback">Give back</button></div></td></tr>`).join('')}</tbody></table></div></div>
        </section>
        ${recordPaymentDialog('payments-record', 'Alba Motors', '')}
        <dialog id="payments-credit" class="modal"><form method="dialog">
          <div class="modal-head"><h3>Apply client credit</h3><button type="button" class="icon-btn" data-close aria-label="Close">✕</button></div>
          <div class="modal-body stack"><div class="form-grid">
            <div class="field"><label>Client</label><select>${CREDITS.map(c => `<option>${esc(c.client)} · ${fmt(c.amount, c.cur)}</option>`).join('')}</select></div>
            <div class="field"><label>Apply to</label><select><option>INV-PU-0056 · balance USD 1,500</option><option>INV-PU-0055 · balance USD 2,400</option></select></div>
            <div class="field"><label>Amount</label><input type="number" step="0.01" value="250"></div></div>
            <div class="note-line t-ok">INV-PU-0056 balance drops to USD 1,250. No credit left.</div></div>
          <div class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary" type="submit">Apply credit</button></div>
        </form></dialog>
        <dialog id="payments-giveback" class="modal"><form method="dialog">
          <div class="modal-head"><h3>Give credit back</h3><button type="button" class="icon-btn" data-close aria-label="Close">✕</button></div>
          <div class="modal-body stack"><div class="form-grid">
            <div class="field"><label>Client</label><select>${CREDITS.map(c => `<option>${esc(c.client)} · ${fmt(c.amount, c.cur)}</option>`).join('')}</select></div>
            <div class="field"><label>Amount</label><input type="number" step="0.01" value="250"></div>
            <div class="field"><label>Paid back by</label><select>${chanOpts('Wise')}</select></div>
            <div class="field"><label>Reference</label><input placeholder="Transfer reference"></div>
            <div class="field full"><label>Reason</label><textarea rows="2" required placeholder="Required"></textarea></div></div></div>
          <div class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary" type="submit">Record refund of credit</button></div>
        </form></dialog>
      </div>`;
    },
    mount(root) {
      let period = 'year'; const rows = [...root.querySelectorAll('[data-pay-rows] tr')], pf = k => root.querySelector(`[data-pf="${k}"]`);
      const apply = () => {
        const p = PERIODS[period]; let n = 0, recv = 0, fee = 0, miss = 0;
        rows.forEach(r => {
          const ok = inRange(r.dataset.date, p) && (!pf('client').value || r.dataset.client === pf('client').value) && (!pf('ch').value || r.dataset.ch === pf('ch').value) && (!pf('acc').value || r.dataset.acc === pf('acc').value) && (!pf('proof').value || r.dataset.proof === pf('proof').value);
          r.hidden = !ok;
          if (ok) { const pay = PAYMENTS.find(x => r.textContent.includes(x.id)); n++; recv += usd(pay.amount, pay.cur); fee += usd(pay.fee, pay.cur); if (!pay.proof) miss++; }
        });
        root.querySelector('[data-pk="recv"]').textContent = usd0(recv); root.querySelector('[data-pk="fee"]').textContent = usd0(fee);
        root.querySelector('[data-pk="n"]').textContent = `${n} payments`; root.querySelector('[data-pk="miss"]').textContent = miss;
        root.querySelector('[data-pay-empty]').hidden = n > 0;
      };
      root.querySelector('[data-pay-period]').addEventListener('click', e => { const b = e.target.closest('button[data-v]'); if (!b) return; b.parentNode.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); period = b.dataset.v; apply(); });
      ['client', 'ch', 'acc', 'proof'].forEach(k => pf(k).addEventListener('change', apply));
      wireRecordPayment(root);
    },
  });

  /* ================= 6. Billing clients ================= */
  screen({
    id: 'billing-clients', title: 'Billing clients', group: 'Finance',
    render() {
      const rows = CLIENTS.map(c => { const b = BILLING[c.name], e = ENT(entOfCur(c.currency)), ob = openBal(c.name); return `<tr data-bc="${esc(c.name)}">
        <td>${esc(c.name)}<div class="small muted">${esc(b.legal)}</div>${b.subs ? `<div class="small muted">${b.subs.length} sub-accounts billed here <span class="p2">phase 2</span></div>` : ''}</td>
        <td>${esc(e.short)}</td><td>${esc(b.channel)}<div class="small muted">${b.terms} days</div></td>
        <td class="num right">${fmt(c.fee, c.currency)}<div class="small muted">${esc(b.basis)}</div></td>
        <td class="hide-sm">${esc(b.email)}${b.auto ? '' : '<div class="small muted">Reminders off</div>'}</td>
        <td class="num right">${ob ? fmt(ob, c.currency) : '<span class="muted">—</span>'}</td>
        <td class="right"><div class="row" style="justify-content:flex-end;flex-wrap:nowrap"><a class="btn sm ghost" href="#invoices">Invoices</a><button class="btn sm ghost" data-bc-email>Email</button><button class="btn sm" data-bc-edit>Edit</button></div></td></tr>`; }).join('');
      const f = BILLING['Alba Motors'];
      return `<div class="page scr-fin">${CSS}
        <div class="row between"><h2 style="margin:0">Billing clients</h2><div class="row"><input type="search" placeholder="Search clients" data-bc-q aria-label="Search clients"></div></div>
        <div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>Client</th><th>Bills from</th><th>Pays by</th><th class="right">Agreed fee</th><th class="hide-sm">Billing email</th><th class="right">Open balance</th><th></th></tr></thead><tbody data-bc-rows>${rows}</tbody></table></div></div>
        ${emailDialog('billing-clients-email', { title: 'Email billing contact', to: f.email, cc: f.cc, subject: 'Your account with Permanent SEO', body: 'Hi Khalid,\n\n', attach: 'Statement of account.pdf' })}
        <dialog id="billing-clients-edit" class="modal"><form method="dialog">
          <div class="modal-head"><h3 data-bce-title>Edit billing: Alba Motors</h3><button type="button" class="icon-btn" data-close aria-label="Close">✕</button></div>
          <div class="modal-body stack"><div class="form-grid">
            <div class="field full"><label>Legal name</label><input data-bce="legal" value="${esc(f.legal)}"></div>
            <div class="field"><label>Billing contact</label><input data-bce="contact" value="${esc(f.contact)}"></div>
            <div class="field"><label>Country</label><select data-bce="country">${['United Arab Emirates', 'United States', 'Pakistan', 'United Kingdom', 'Saudi Arabia'].map(x => `<option${x === f.country ? ' selected' : ''}>${x}</option>`).join('')}</select></div>
            <div class="field"><label>Billing emails</label><input data-bce="email" value="${esc(f.email)}"></div>
            <div class="field"><label>Cc</label><input data-bce="cc" value="${esc(f.cc)}"></div>
            <div class="field full"><label>Address</label><textarea rows="2" data-bce="address">${esc(f.address)}</textarea></div>
            <div class="field"><label>Tax ID</label><input data-bce="taxId" value="${esc(f.taxId)}"></div>
            <div class="field"><label>Bills from</label><select data-bce="ent">${entOpts('ps')}</select></div>
            <div class="field"><label>Currency</label><select data-bce="cur">${curOpts('AED')}</select></div>
            <div class="field"><label>Pays by</label><select data-bce="channel">${chanOpts(f.channel)}</select></div>
            <div class="field"><label>Payment terms (days)</label><input type="number" min="0" data-bce="terms" value="${f.terms}"></div>
            <div class="field"><label>Agreed fee</label><input type="number" step="0.01" data-bce="fee" value="14000"></div>
            <div class="field"><label>Fee basis</label><select data-bce="basis">${['Monthly', 'Weekly', 'Hourly', 'One-time'].map(x => `<option${x === f.basis ? ' selected' : ''}>${x}</option>`).join('')}</select></div>
            <div class="field full"><label>Notes</label><textarea rows="2" data-bce="notes">${esc(f.notes)}</textarea></div>
            <label class="check field full"><input type="checkbox" data-bce="auto"${f.auto ? ' checked' : ''}> Send payment reminders automatically</label>
            <div class="field full"><label>Sub-accounts billed under this client <span class="p2">phase 2</span></label><div class="list" data-bce="subs">${(f.subs || []).map(s => `<div class="item row between"><span>${esc(s)}</span><button type="button" class="btn sm ghost">Unlink</button></div>`).join('')}</div><button type="button" class="btn sm" style="margin-top:6px;align-self:flex-start">Link a sub-account</button></div>
          </div></div>
          <div class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary" type="submit">Save billing details</button></div>
        </form></dialog>
      </div>`;
    },
    mount(root) {
      const q = s => root.querySelector(s);
      q('[data-bc-q]').addEventListener('input', e => { const v = e.target.value.trim().toLowerCase(); root.querySelectorAll('[data-bc-rows] tr').forEach(r => { r.hidden = v && !r.textContent.toLowerCase().includes(v); }); });
      q('[data-bc-rows]').addEventListener('click', e => {
        const tr = e.target.closest('tr[data-bc]'); if (!tr) return;
        const name = tr.dataset.bc, b = BILLING[name], c = client(name);
        if (e.target.closest('[data-bc-email]')) {
          const d = q('#billing-clients-email');
          d.querySelector('[data-email-to]').value = b.email; d.querySelector('[data-email-cc]').value = b.cc;
          d.querySelector('[data-email-body]').value = `Hi ${b.contact.replace(/^Dr\. /, '').split(' ')[0]},\n\nPlease find your statement of account attached. Open balance: ${fmt(openBal(name), c.currency)}.\n\nThanks,\nBilal Ahmed\nPermanent SEO`;
          d.showModal();
        }
        if (e.target.closest('[data-bc-edit]')) {
          const d = q('#billing-clients-edit'), set = (k, v) => { d.querySelector(`[data-bce="${k}"]`).value = v; };
          d.querySelector('[data-bce-title]').textContent = `Edit billing: ${name}`;
          ['legal', 'contact', 'country', 'email', 'cc', 'address', 'taxId', 'channel', 'terms', 'basis', 'notes'].forEach(k => set(k, b[k]));
          set('ent', entOfCur(c.currency)); set('cur', c.currency); set('fee', c.fee);
          d.querySelector('[data-bce="auto"]').checked = b.auto;
          d.querySelector('[data-bce="subs"]').innerHTML = (b.subs || []).map(s => `<div class="item row between"><span>${esc(s)}</span><button type="button" class="btn sm ghost">Unlink</button></div>`).join('') || '<div class="item muted">No sub-accounts linked.</div>';
          d.showModal();
        }
      });
    },
  });

  /* ================= 7. Payment reminders ================= */
  function remRow(r) {
    const i = INV(r.inv), c = client(i.client), am = c.owner;
    const actions = r.list === 'recent'
      ? `<button class="btn sm ghost" data-rm-send>Send again</button>`
      : r.list === 'paused'
        ? `<button class="btn sm" data-rm-resume>Resume</button>`
        : `<button class="btn sm primary" data-rm-send>Send</button><button class="btn sm ghost" data-rm-skip>Skip</button><button class="btn sm ghost" data-rm-pause>Pause</button>`;
    return `<tr data-rm="${r.id}">
      <td>${esc(i.client)}<div class="small muted row" style="gap:6px">${avatar(am, 18)} ${esc(am)}</div></td>
      <td class="num"><a href="#invoice">${i.num}</a></td>
      <td class="num right">${fmt(balance(i), i.cur)}</td>
      <td class="num">${fds(i.due)}${isOverdue(i) ? `<div class="small t-danger-ink">${lateDays(i)} days late</div>` : ''}</td>
      <td>${STAGES[r.stage]}${r.amNote ? '<div class="small muted">Account manager told too</div>' : ''}</td>
      <td class="num">${r.list === 'paused' ? `Until ${fds(r.until)}<div class="small muted" style="max-width:220px">${esc(r.note)}</div>` : r.list === 'recent' ? `${fds(r.on)}<div class="small muted">${esc(r.by)}</div>` : fds(r.on)}</td>
      ${r.list === 'recent' ? `<td>${tone(r.result[0], r.result[1])}</td>` : `<td><label class="check"><input type="checkbox" data-rm-auto${r.auto ? ' checked' : ''}> Auto</label></td>`}
      <td class="right"><div class="row" style="justify-content:flex-end;flex-wrap:nowrap">${actions}</div></td></tr>`;
  }
  const remTable = list => {
    const rs = REMINDERS.filter(r => r.list === list), last = list === 'paused' ? 'Paused' : list === 'recent' ? 'Sent' : 'Send on';
    return `<div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>Client</th><th>Invoice</th><th class="right">Balance</th><th>Due</th><th>Stage</th><th>${last}</th><th>${list === 'recent' ? 'Result' : 'Mode'}</th><th></th></tr></thead><tbody>${rs.map(remRow).join('')}</tbody></table></div></div>`;
  };
  screen({
    id: 'payment-reminders', title: 'Payment reminders', group: 'Finance',
    render() {
      const today = REMINDERS.filter(r => r.list === 'today');
      return `<div class="page scr-fin">${CSS}
        <div class="row between"><h2 style="margin:0">Payment reminders</h2><div class="row"><button class="btn" data-open="payment-reminders-rules">Reminder rules</button><button class="btn primary" data-open="payment-reminders-all">Send all ${today.length}</button></div></div>
        <div class="small muted">Reminders go 3 days before due, then 1, 7, 14 and 30 days late. Clients on auto get them in the 10:00 daily run.</div>
        <div class="tabs" data-tabs="rem"><button data-tab="today" class="on">Due today <span class="acc">${today.length}</span></button><button data-tab="paused">Paused</button><button data-tab="upcoming">Upcoming</button><button data-tab="recent">Recent</button></div>
        <section data-panel="rem:today">${remTable('today')}</section>
        <section data-panel="rem:paused" hidden>${remTable('paused')}</section>
        <section data-panel="rem:upcoming" hidden>${remTable('upcoming')}</section>
        <section data-panel="rem:recent" hidden>${remTable('recent')}</section>
        ${emailDialog('payment-reminders-send', { title: 'Review reminder', to: '', subject: '', body: '', attach: 'Invoice PDF' })}
        <dialog id="payment-reminders-pause" class="modal"><form method="dialog">
          <div class="modal-head"><h3 data-rp-title>Pause reminders</h3><button type="button" class="icon-btn" data-close aria-label="Close">✕</button></div>
          <div class="modal-body"><div class="form-grid"><div class="field"><label>Pause until</label><input type="date" value="2026-11-18" required></div><div class="field full"><label>Note</label><textarea rows="3" placeholder="Why, so the team knows"></textarea></div></div></div>
          <div class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary" type="submit">Pause reminders</button></div>
        </form></dialog>
        <dialog id="payment-reminders-all" class="modal"><form method="dialog">
          <div class="modal-head"><h3>Send ${today.length} reminders now</h3><button type="button" class="icon-btn" data-close aria-label="Close">✕</button></div>
          <div class="modal-body"><div class="list">${today.map(r => { const i = INV(r.inv); return `<div class="item row between"><span>${esc(i.client)} · <span class="num">${i.num}</span><div class="small muted">${STAGES[r.stage]}</div></span><span class="num">${fmt(balance(i), i.cur)}</span></div>`; }).join('')}</div></div>
          <div class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary" type="submit">Send ${today.length} reminders</button></div>
        </form></dialog>
        <dialog id="payment-reminders-rules" class="modal"><form method="dialog">
          <div class="modal-head"><h3>Reminder rules</h3><button type="button" class="icon-btn" data-close aria-label="Close">✕</button></div>
          <div class="modal-body stack">
            ${Object.entries(STAGES).map(([k, v]) => `<label class="check"><input type="checkbox" checked> ${v}</label>`).join('')}
            <label class="check"><input type="checkbox" checked> Tell the account manager at 30 days late</label>
            <div class="form-grid"><div class="field"><label>Daily run time (Dubai)</label><input type="time" value="10:00"></div><div class="field"><label>Send from</label><select><option>billing@permanentseo.com</option><option>bilal@permanentseo.com</option></select></div></div>
          </div>
          <div class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary" type="submit">Save rules</button></div>
        </form></dialog>
      </div>`;
    },
    mount(root) {
      const send = root.querySelector('#payment-reminders-send'), pause = root.querySelector('#payment-reminders-pause');
      root.addEventListener('click', e => {
        const tr = e.target.closest('tr[data-rm]'); if (!tr) return;
        const r = REMINDERS.find(x => x.id === tr.dataset.rm), i = INV(r.inv), b = BILLING[i.client];
        if (e.target.closest('[data-rm-send]')) {
          const late = isOverdue(i);
          send.querySelector('[data-email-to]').value = b.email; send.querySelector('[data-email-cc]').value = b.cc + (r.amNote ? (b.cc ? ', ' : '') + client(i.client).owner.toLowerCase().replace(' ', '.') + '@permanentseo.com' : '');
          send.querySelector('[data-email-subject]').value = late ? `Overdue: ${i.num} was due on ${fds(i.due)}` : `Reminder: ${i.num} is due on ${fds(i.due)}`;
          send.querySelector('[data-email-body]').value = `Hi ${b.contact.replace(/^Dr\. /, '').split(' ')[0]},\n\n${late ? `Invoice ${i.num} is now ${lateDays(i)} days past due.` : `A quick reminder that invoice ${i.num} is due on ${fd(i.due)}.`} The balance is ${fmt(balance(i), i.cur)}.\n\nYou can pay by ${b.channel}. Details are on the attached invoice.\n\nThanks,\nBilal Ahmed\nPermanent SEO`;
          send.querySelector('[data-email-attach] strong').textContent = `${i.num}.pdf`;
          send.showModal();
        }
        if (e.target.closest('[data-rm-skip]')) { tr.classList.add('faded'); toast(`Skipped ${STAGES[r.stage].toLowerCase()} for ${i.num}`); }
        if (e.target.closest('[data-rm-pause]')) { pause.querySelector('[data-rp-title]').textContent = `Pause reminders for ${i.num}`; pause.showModal(); }
        if (e.target.closest('[data-rm-resume]')) { tr.classList.add('faded'); toast(`Reminders resumed for ${i.num}`); }
      });
      root.addEventListener('change', e => {
        if (!e.target.matches('[data-rm-auto]')) return;
        const i = INV(REMINDERS.find(x => x.id === e.target.closest('tr').dataset.rm).inv);
        toast(`Auto reminders ${e.target.checked ? 'on' : 'off'} for ${i.client}`);
      });
    },
  });

  /* ================= 8. Finance settings ================= */
  screen({
    id: 'finance-setup', title: 'Finance settings', group: null,
    render() {
      return `<div class="page scr-fin">${CSS}
        <div class="row between"><div class="stack" style="gap:4px"><a class="small" href="#finance">← Finance</a><h2 style="margin:0">Finance settings</h2></div></div>
        <div class="card"><div class="card-head"><h3>Entities</h3><button class="btn sm" data-open="finance-setup-entity">Add entity</button></div>
          <div class="table-wrap"><table class="tbl"><thead><tr><th>Legal name</th><th>Country</th><th>Prefix</th><th>Next number</th><th>Tax</th><th>Currency</th><th class="hide-sm">Tax ID</th><th></th></tr></thead><tbody>
            ${ENTITIES.map(e => `<tr data-ent="${e.id}"><td>${esc(e.name)}<div class="small muted hide-sm">${esc(e.address)}</div></td><td>${esc(e.country)}</td><td class="num">${e.prefix}</td><td class="num">INV-${e.prefix}-${String(e.next).padStart(4, '0')}</td><td>${e.taxLabel}${e.taxRate ? ` ${e.taxRate}%` : ''}</td><td>${e.cur}</td><td class="num hide-sm">${esc(e.taxId)}</td><td class="right"><button class="btn sm ghost" data-ent-edit>Edit</button></td></tr>`).join('')}
          </tbody></table></div></div>
        <div class="grid-2" style="align-items:start">
          <div class="card"><div class="card-head"><h3>Payment channels</h3><button class="btn sm" data-open="finance-setup-channel">Add channel</button></div>
            <div class="list">${CHANNELS.map(c => `<div class="item row between" style="align-items:flex-start"><div><strong>${esc(c.name)}</strong> <span class="muted">· ${esc(c.account)}</span><div class="small muted">${esc(c.details)}</div><div class="small muted">Fee: ${esc(c.fee)}</div></div><button class="btn sm ghost" data-open="finance-setup-channel">Edit</button></div>`).join('')}</div></div>
          <div class="stack" style="gap:16px">
            <div class="card"><div class="card-head"><h3>Exchange rates</h3><span class="small muted">Base USD · updated 4 Nov, 06:00</span></div><div class="card-body stack">
              <form class="form-grid" data-fx>
                <div class="field"><label for="fx-aed">1 AED in USD</label><input id="fx-aed" type="number" step="0.0001" value="${FX.AED}" class="num"></div>
                <div class="field"><label for="fx-pkr">1 PKR in USD</label><input id="fx-pkr" type="number" step="0.00001" value="${FX.PKR}" class="num"></div>
                <label class="check field full"><input type="checkbox" checked> Update rates daily from the central bank feed</label>
                <div class="field full row"><button class="btn primary" type="submit">Save rates</button></div>
              </form>
              <div class="small muted">Payments keep the rate saved when they were recorded. New rates only affect new payments and reports.</div>
            </div></div>
            <div class="card"><div class="card-head"><h3>Email sending <span class="p2">phase 2</span></h3><button class="btn sm ghost" data-fs-test>Send test email</button></div><div class="card-body">
              <dl class="kv"><dt>Sender</dt><dd>Permanent SEO Billing &lt;billing@permanentseo.com&gt;</dd><dt>Reply to</dt><dd>bilal@permanentseo.com</dd><dt>Domain</dt><dd>${tone('Verified', 'ok')}</dd><dt>SPF</dt><dd>${tone('Passing', 'ok')}</dd><dt>DKIM</dt><dd>${tone('Passing', 'ok')}</dd><dt>DMARC</dt><dd>${tone('Not set, add a record', 'warn')}</dd><dt>Last 30 days</dt><dd class="num">142 sent · 1 bounced</dd></dl>
            </div></div>
          </div>
        </div>
        <dialog id="finance-setup-entity" class="modal"><form method="dialog">
          <div class="modal-head"><h3 data-fse-title>Add entity</h3><button type="button" class="icon-btn" data-close aria-label="Close">✕</button></div>
          <div class="modal-body"><div class="form-grid">
            <div class="field full"><label>Legal name</label><input data-fse="name" required></div>
            <div class="field"><label>Country</label><input data-fse="country"></div>
            <div class="field"><label>Invoice prefix</label><input data-fse="prefix" maxlength="4"></div>
            <div class="field"><label>Tax label</label><input data-fse="taxLabel" placeholder="VAT, GST or None"></div>
            <div class="field"><label>Tax rate %</label><input type="number" step="0.5" data-fse="taxRate"></div>
            <div class="field"><label>Default currency</label><select data-fse="cur">${curOpts('USD')}</select></div>
            <div class="field"><label>Tax ID</label><input data-fse="taxId"></div>
            <div class="field full"><label>Address on invoices</label><textarea rows="2" data-fse="address"></textarea></div>
            <div class="field full"><label>Logo for invoices</label><input type="file" accept="image/*"></div>
          </div></div>
          <div class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary" type="submit">Save entity</button></div>
        </form></dialog>
        <dialog id="finance-setup-channel" class="modal"><form method="dialog">
          <div class="modal-head"><h3>Payment channel</h3><button type="button" class="icon-btn" data-close aria-label="Close">✕</button></div>
          <div class="modal-body"><div class="form-grid">
            <div class="field"><label>Type</label><select>${CHANNELS.map(c => `<option>${esc(c.name)}</option>`).join('')}</select></div>
            <div class="field"><label>Account name</label><input value="Wise USD ••7720"></div>
            <div class="field"><label>Fee</label><input value="0.6% + USD 1"></div>
            <div class="field"><label>Used by entity</label><select>${entOpts('pu')}</select></div>
            <div class="field full"><label>Details printed on invoices</label><textarea rows="3">${esc(CHANNELS[0].details)}</textarea></div>
          </div></div>
          <div class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary" type="submit">Save channel</button></div>
        </form></dialog>
      </div>`;
    },
    mount(root) {
      const d = root.querySelector('#finance-setup-entity');
      root.addEventListener('click', e => {
        if (e.target.closest('[data-fs-test]')) toast('Test email sent to bilal@permanentseo.com');
        const b = e.target.closest('[data-ent-edit]'); if (!b) return;
        const en = ENT(b.closest('tr').dataset.ent);
        d.querySelector('[data-fse-title]').textContent = `Edit ${en.name}`;
        ['name', 'country', 'prefix', 'taxLabel', 'taxRate', 'cur', 'taxId', 'address'].forEach(k => { d.querySelector(`[data-fse="${k}"]`).value = en[k]; });
        d.showModal();
      });
      root.querySelector('[data-open="finance-setup-entity"]').addEventListener('click', () => { d.querySelector('[data-fse-title]').textContent = 'Add entity'; d.querySelectorAll('[data-fse]').forEach(x => { if (x.tagName !== 'SELECT') x.value = ''; }); });
    },
  });
})();

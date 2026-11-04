/* Clients agent: clients, client, response-times, meetings, files. */
(function () {
  const { screen, esc, avatar, tone, status, money, CLIENTS, PROJECTS, ME } = K;

  /* ---------- helpers ---------- */
  const P2 = '<span class="p2">phase 2</span>';
  const bandCol = s => s == null ? '--ink-3' : s >= 75 ? '--ok' : s >= 50 ? '--warn' : '--danger';
  const ring = (score, size = 56) => {
    const r = (size - 8) / 2, c = 2 * Math.PI * r, off = score == null ? c : c * (1 - score / 100), m = size / 2;
    return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Health ${score == null ? 'no data' : score}">
      <circle cx="${m}" cy="${m}" r="${r}" fill="none" stroke="var(--line)" stroke-width="6"/>
      <circle cx="${m}" cy="${m}" r="${r}" fill="none" stroke="var(${bandCol(score)})" stroke-width="6" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}" transform="rotate(-90 ${m} ${m})"/>
      <text x="${m}" y="${m}" text-anchor="middle" dominant-baseline="central" fill="var(--ink)" font-size="${Math.round(size / 3.6)}" font-weight="600">${score == null ? '–' : score}</text></svg>`;
  };
  const BAND_T = { Healthy: 'ok', Watch: 'warn', 'At risk': 'danger', New: 'blue', 'No data': 'muted' };
  const band = c => tone(c.band, BAND_T[c.band] || 'muted');
  const spark = (pts, w = 110, h = 30) => {
    const mn = Math.min(...pts), mx = Math.max(...pts), sx = w / (pts.length - 1);
    const d = pts.map((p, i) => `${(i * sx).toFixed(1)},${(h - 3 - ((p - mn) / ((mx - mn) || 1)) * (h - 6)).toFixed(1)}`).join(' ');
    return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true"><polyline points="${d}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  };
  const pct = n => `<span class="num" style="color:var(--${n >= 90 ? 'ok' : n >= 75 ? 'warn' : 'danger'});font-weight:600">${n}%</span>`;
  const tbl = (heads, rows, attrs = []) => `<div class="table-wrap"><table class="tbl"><thead><tr>${heads.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r, i) => `<tr ${attrs[i] || ''}>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const stat = (label, value, sub = '', t = '', key = '') => `<div class="stat"><div class="label">${label}</div><div class="value num ${t}" ${key ? `data-k="${key}"` : ''}>${value}</div>${sub ? `<div class="sub" ${key ? `data-ks="${key}"` : ''}>${sub}</div>` : ''}</div>`;
  const card = (title, body, actions = '', cls = '') => `<div class="card ${cls}"><div class="card-head"><h3>${title}</h3>${actions ? `<div class="row">${actions}</div>` : ''}</div><div class="card-body">${body}</div></div>`;
  const field = (label, input, full) => `<div class="field${full ? ' full' : ''}"><label>${label}</label>${input}</div>`;
  const sel = (opts, cur, attr = '') => `<select ${attr}>${opts.map(o => `<option${o === cur ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  const chk = (label, on) => `<label class="check"><input type="checkbox"${on ? ' checked' : ''}> ${label}</label>`;
  const modal = (id, title, body, submit = 'Save') => `<dialog id="${id}" class="modal"><form><div class="modal-head"><h3>${title}</h3><button type="button" class="icon-btn" data-close aria-label="Close">&times;</button></div><div class="modal-body">${body}</div><div class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button type="submit" class="btn primary">${submit}</button></div></form></dialog>`;
  const list = items => `<div class="list">${items.map(i => `<div class="item">${i}</div>`).join('')}</div>`;
  const bar = (v, t = '') => `<div class="bar ${t}"><i style="width:${Math.min(v, 100)}%"></i></div>`;
  const yes = b => b ? 'Yes' : 'No';
  const OWNERS = ['Sara Malik', 'Hamza Qureshi'];

  /* ---------- sample data ---------- */
  const EXTRA = {
    'Cedar & Pine Dental': { status: 'Active', contact: 3, next: 'Thu 6 Nov, 11:00', report: 'Sent', country: 'UAE', site: 'cedarpinedental.ae', manager: 'Omar Haddad', esc: 0, open: 7 },
    'Alba Motors': { status: 'Active', contact: 1, next: 'Wed 5 Nov, 14:30', report: 'In review', country: 'UAE', site: 'albamotors.ae', manager: 'Ayesha Khan', esc: 2, open: 9 },
    'Luma Skincare': { status: 'Active', contact: 12, next: 'None booked', report: 'Not sent', country: 'USA', site: 'lumaskin.co', manager: 'Omar Haddad', esc: 1, open: 14 },
    'Harbor Legal': { status: 'Active', contact: 5, next: 'Mon 10 Nov, 10:00', report: 'Sent', country: 'UK', site: 'harborlegal.co.uk', manager: 'Daniel Reyes', esc: 0, open: 5 },
    'Nova Fitness': { status: 'Onboarding', contact: 2, next: 'Fri 7 Nov, 09:30', report: 'Not due', country: 'UAE', site: 'novafit.ae', manager: 'Zara Farooq', esc: 0, open: 6 },
    'Zest Kitchen': { status: 'Active', contact: 8, next: 'Tue 11 Nov, 15:00', report: 'Not sent', country: 'Pakistan', site: 'zestkitchen.pk', manager: 'Ayesha Khan', esc: 0, open: 3 },
    'Qamar Interiors': { status: 'Paused', contact: 21, next: 'None booked', report: 'Not due', country: 'UAE', site: 'qamarinteriors.ae', manager: 'Priya Nair', esc: 0, open: 1 },
  };
  const ALL = [...CLIENTS, { id: 'c7', name: 'Qamar Interiors', services: ['SEO'], health: null, band: 'No data', owner: 'Hamza Qureshi', currency: 'AED', fee: 5000 }]
    .map(c => Object.assign({}, c, EXTRA[c.name]));
  const ownerOf = n => (ALL.find(c => c.name === n) || {}).owner || '';
  const SERVICES = ['SEO', 'PPC', 'Social', 'Content', 'Web', 'Design'];

  /* =====================================================================
     1. CLIENT PORTFOLIO
     ===================================================================== */
  function clientCard(c) {
    const days = c.contact === 1 ? '1 day ago' : `${c.contact} days ago`;
    return `<a class="card cl-card" href="#client" data-band="${esc(c.band)}" data-owner="${esc(c.owner)}" data-svc="${esc(c.services.join(','))}" data-status="${esc(c.status)}" data-name="${esc(c.name.toLowerCase())}">
      <div class="cl-top">${ring(c.health)}<div class="stack" style="gap:4px;min-width:0"><strong class="cl-name">${esc(c.name)}</strong><div class="row" style="gap:12px">${band(c)}<span class="small muted">${esc(c.status)}</span></div></div></div>
      <div class="cl-meta small">
        <div class="row" style="gap:6px">${avatar(c.owner, 22)}<span>${esc(c.owner)}</span></div>
        <div class="muted">${esc(c.services.join(' · '))}</div>
        <div class="between"><span class="muted">Last contact</span><span class="${c.contact > 10 ? 'cl-late' : ''}">${days}</span></div>
        <div class="between"><span class="muted">Next meeting</span><span>${esc(c.next)}</span></div>
        <div class="between"><span class="muted">October report</span><span>${esc(c.report)}</span></div>
      </div></a>`;
  }
  function byOwnerRows() {
    return OWNERS.map(o => {
      const cs = ALL.filter(c => c.owner === o), cnt = b => cs.filter(c => c.band === b).length;
      const fees = {}; cs.forEach(c => { fees[c.currency] = (fees[c.currency] || 0) + c.fee; });
      return [`<div class="row" style="gap:8px">${avatar(o, 24)}${esc(o)}</div>`, `<span class="num">${cs.length}</span>`, `<span class="num">${cnt('Healthy')}</span>`, `<span class="num">${cnt('Watch')}</span>`, `<span class="num">${cnt('At risk')}</span>`, `<span class="num">${cnt('New') + cnt('No data')}</span>`, `<span class="num">${cs.reduce((a, c) => a + c.esc, 0)}</span>`, `<span class="num small">${Object.entries(fees).map(([k, v]) => money(v, k)).join('<br>')}</span>`];
    });
  }
  const svcChecks = on => `<div class="row">${SERVICES.map(s => chk(s, on.includes(s))).join('')}</div>`;

  screen({
    id: 'clients', title: 'Client portfolio', group: 'Clients',
    render() {
      return `<div class="page scr-clients">
<style>
.scr-clients .cl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
.scr-clients .cl-card{display:flex;flex-direction:column;gap:12px;padding:16px;color:var(--ink);text-decoration:none;transition:border-color .15s, box-shadow .15s}
.scr-clients .cl-card:hover{border-color:var(--accent);box-shadow:var(--shadow)}
.scr-clients .cl-top{display:flex;gap:12px;align-items:center}
.scr-clients .cl-name{font-size:15px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.scr-clients .cl-meta{display:flex;flex-direction:column;gap:6px;border-top:1px solid var(--line);padding-top:10px}
.scr-clients .cl-late{color:var(--danger);font-weight:600}
.scr-clients .toolbar input[type=search]{min-width:180px}
.scr-clients .rv-row{display:grid;grid-template-columns:1.4fr 1fr 1.6fr;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--line)}
@media (max-width:600px){.scr-clients .rv-row{grid-template-columns:1fr}}
</style>
<div class="between"><h1>Client portfolio</h1><div class="row"><button class="btn" data-open="clients-dlg-review">Status review</button><button class="btn primary" data-open="clients-dlg-add">Add client</button></div></div>
<div class="stats">
  ${stat('Clients', ALL.length, '6 active, 1 paused')}
  ${stat('At risk', 1, 'Luma Skincare', 't-danger')}
  ${stat('Open escalations', 3, '1 past its window', 't-warn')}
  ${stat("Last month's reports not sent", 2, 'Due 5 Nov')}
  ${stat('Meetings this week', 4, 'Next: Alba Motors, Wed')}
</div>
<div class="toolbar row">
  <div class="seg" data-filter="band">${['All', 'At risk', 'Watch', 'Healthy', 'New', 'No data'].map((b, i) => `<button type="button" data-v="${b}" class="${i ? '' : 'on'}">${b}</button>`).join('')}</div>
  ${sel(['All owners', ...OWNERS], 'All owners', 'data-filter="owner" aria-label="Owner"')}
  ${sel(['All services', ...SERVICES], 'All services', 'data-filter="svc" aria-label="Service"')}
  ${sel(['All statuses', 'Active', 'Onboarding', 'Paused', 'Ended'], 'All statuses', 'data-filter="status" aria-label="Status"')}
  <input type="search" placeholder="Search clients" data-filter="q" aria-label="Search clients">
</div>
<div class="cl-grid">${ALL.map(clientCard).join('')}</div>
<div class="empty" hidden data-empty>No clients match these filters. <button class="btn sm ghost" type="button" data-reset>Clear filters</button></div>
<div class="grid-2">
  ${card('By owner', tbl(['Owner', 'Clients', 'Healthy', 'Watch', 'At risk', 'New or no data', 'Open escalations', 'Monthly fees'], byOwnerRows()))}
  ${card('Ended clients', list([
    `<div class="between"><div class="stack" style="gap:2px"><strong>Desert Bloom Florists</strong><span class="small muted">Ended 30 Jun 2026 · Budget cut after Q2 · was AED 7,500/month</span></div><button class="btn sm" type="button" data-toast="Win-back task created for Desert Bloom Florists">Start win-back</button></div>`,
    `<div class="between"><div class="stack" style="gap:2px"><strong>Peak Physio Clinic</strong><span class="small muted">Ended 15 Mar 2026 · Moved in-house · was USD 2,800/month</span></div><button class="btn sm" type="button" data-toast="Win-back task created for Peak Physio Clinic">Start win-back</button></div>`,
  ]))}
</div>
${modal('clients-dlg-add', 'Add client', `<div class="form-grid">
  ${field('Client name', '<input required placeholder="e.g. Marina Bay Realty">')}
  ${field('Website', '<input placeholder="marinabayrealty.ae">')}
  ${field('Services', svcChecks([]), true)}
  ${field('Country', sel(['UAE', 'Saudi Arabia', 'Pakistan', 'UK', 'USA'], 'UAE'))}
  ${field('Start date', '<input type="date" value="2026-11-10">')}
  ${field('Main channel', sel(['WhatsApp', 'Email', 'Slack', 'Phone'], 'WhatsApp'))}
  ${field('Currency', sel(['AED', 'USD', 'PKR'], 'AED'))}
  ${field('Account executive', sel(['Hamza Qureshi', 'Sara Malik'], 'Hamza Qureshi'))}
  ${field('Delivery manager', sel(['Omar Haddad', 'Ayesha Khan', 'Daniel Reyes', 'Zara Farooq', 'Priya Nair'], 'Omar Haddad'))}
  ${field('Monthly fee', '<input type="number" value="8000">')}
  ${field('Hours per month', '<input type="number" value="40">')}
  ${field('Notes', '<textarea rows="3" placeholder="What they sell, who decides, what worries them"></textarea>', true)}
  <div class="field full">${chk('Agency client (manages sub-accounts for its own customers)')}</div>
  <div class="field full"><h4>Kickoff</h4>${chk('Create onboarding tickets from the "New SEO client" template', true)}${chk('Create a private client chat channel', true)}${chk('Send portal invite to the main contact')}</div>
  ${field('Kickoff meeting', '<input type="datetime-local" value="2026-11-11T11:00">')}
  ${field('Main contact email', '<input type="email" placeholder="name@company.com">')}
</div>`, 'Add client')}
${modal('clients-dlg-review', 'Status review', `<p class="muted small">Your read on each client this week. Notes go to the client's relationship log.</p>
${ALL.filter(c => c.status !== 'Paused').map(c => `<div class="rv-row"><div class="row" style="gap:8px">${ring(c.health, 34)}<strong>${esc(c.name)}</strong></div>${sel(['On track', 'Watch', 'At risk'], c.band === 'At risk' ? 'At risk' : c.band === 'Watch' ? 'Watch' : 'On track', `aria-label="Status for ${esc(c.name)}"`)}<input placeholder="Note (optional)" aria-label="Note for ${esc(c.name)}" ${c.name === 'Luma Skincare' ? 'value="Founder unhappy with Q3 ROAS, plan rescue call"' : ''}></div>`).join('')}`, 'Save review')}
</div>`;
    },
    mount(root) {
      const sc = root.querySelector('.scr-clients'); if (!sc) return;
      const f = { band: 'All', owner: 'All owners', svc: 'All services', status: 'All statuses', q: '' };
      const apply = () => {
        let n = 0;
        sc.querySelectorAll('.cl-card').forEach(c => {
          const d = c.dataset;
          const ok = (f.band === 'All' || d.band === f.band) && (f.owner === 'All owners' || d.owner === f.owner) && (f.svc === 'All services' || d.svc.split(',').includes(f.svc)) && (f.status === 'All statuses' || d.status === f.status) && (!f.q || d.name.includes(f.q));
          c.hidden = !ok; if (ok) n++;
        });
        sc.querySelector('[data-empty]').hidden = n > 0;
      };
      sc.querySelector('[data-filter="band"]').addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        b.parentNode.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); f.band = b.dataset.v; apply();
      });
      sc.querySelectorAll('select[data-filter]').forEach(s => s.addEventListener('change', () => { f[s.dataset.filter] = s.value; apply(); }));
      sc.querySelector('[data-filter="q"]').addEventListener('input', e => { f.q = e.target.value.trim().toLowerCase(); apply(); });
      sc.querySelector('[data-reset]').addEventListener('click', () => {
        Object.assign(f, { band: 'All', owner: 'All owners', svc: 'All services', status: 'All statuses', q: '' });
        sc.querySelectorAll('select[data-filter]').forEach(s => { s.selectedIndex = 0; });
        sc.querySelector('[data-filter="q"]').value = '';
        sc.querySelectorAll('[data-filter="band"] button').forEach((x, i) => x.classList.toggle('on', i === 0)); apply();
      });
      sc.querySelectorAll('[data-toast]').forEach(b => b.addEventListener('click', () => K.toast(b.dataset.toast)));
    },
  });

  /* =====================================================================
     2. CLIENT PAGE (Alba Motors)
     ===================================================================== */
  const ALBA = ALL.find(c => c.name === 'Alba Motors');
  const TABS = [
    ['overview', 'Overview', 0], ['accounts', 'Accounts & projects', 1], ['commit', 'Commitments', 1], ['rel', 'Relationship', 1],
    ['meet', 'Meetings & notes', 0], ['reports', 'Reports', 1], ['esc', 'Escalations', 0], ['ratings', 'Delivery ratings', 1],
    ['contacts', 'Contacts & team', 0], ['files', 'Files', 0], ['perf', 'Performance', 1], ['analysis', 'Analysis', 1],
    ['ads', 'Ads', 1], ['leads', 'Leads', 1], ['web', 'Website', 1], ['seo', 'SEO', 1], ['portal', 'Client portal', 0],
  ];
  const EMAIL = {
    Friendly: `Hi Rania,\n\nHope the Motor Show prep is going well! Quick update: October leads came in at 142, up 18% on September, and cost per lead dropped to AED 269.\n\nThe October report is with Ayesha for a final check and will reach you by Wednesday. Shall we use tomorrow's 2:30 call to plan the year-end sale push?\n\nThanks,\nSara`,
    Formal: `Dear Rania,\n\nPlease find a brief performance update for October. Alba Motors received 142 qualified leads, an increase of 18% on September, at an average cost of AED 269 per lead.\n\nThe full monthly report is under final review and will be sent by Wednesday 5 November. We propose to discuss the year-end sales campaign during tomorrow's meeting at 14:30.\n\nKind regards,\nSara Malik\nHead of Client Success, Permanent SEO`,
    Brief: `Hi Rania, October: 142 leads (+18%), CPL AED 269. Report lands Wednesday. Let's plan the year-end push on tomorrow's 2:30 call. Sara`,
  };

  function overviewPanel() {
    return `<div class="grid-2">
${card('Commitments vs delivery', tbl(['Commitment', 'Target', 'Now', 'Status'], [
      ['Qualified leads per month', '130', '<span class="num">142</span>', tone('Met', 'ok')],
      ['Cost per lead', 'Under AED 300', '<span class="num">AED 269</span>', tone('On track', 'blue')],
      ['Social posts per week', '5', '<span class="num">4</span>', tone('At risk', 'warn')],
      ['Monthly report by the 5th', '5 Nov', 'In review', tone('On track', 'blue')],
    ]), '<a class="btn sm ghost" href="#client" data-goto="commit">Open commitments</a>')}
${card('Performance, last 28 days', `<div class="list">${[
      ['Leads', '142', '+18%', [88, 95, 102, 99, 110, 121, 118, 130, 142]],
      ['Ad spend', 'AED 38,200', '+4%', [35, 36, 37, 36, 37, 38, 37, 38, 38.2]],
      ['Cost per lead', 'AED 269', '-12%', [320, 310, 305, 298, 290, 284, 280, 274, 269]],
      ['Instagram followers', '24,860', '+1,240', [22.9, 23.1, 23.4, 23.6, 23.9, 24.1, 24.4, 24.6, 24.86]],
    ].map(([k, v, ch, pts]) => `<div class="item between"><div class="stack" style="gap:2px"><span class="small muted">${k}</span><strong class="num">${v}</strong></div><div class="row" style="gap:10px">${spark(pts)}<span class="num small ${ch.startsWith('-') && k !== 'Cost per lead' ? 'cv-down' : 'cv-up'}">${ch}</span></div></div>`).join('')}</div>`)}
${card('Timeline', list([
      `<div class="tl"><span class="small muted">3 Nov</span><span>WhatsApp with Rania about Motor Show budget</span></div>`,
      `<div class="tl"><span class="small muted">31 Oct</span><span>Escalation raised: lead form emails delayed (High)</span></div>`,
      `<div class="tl"><span class="small muted">28 Oct</span><span>Monthly call. Karim mentioned trimming spend in Q1</span></div>`,
      `<div class="tl"><span class="small muted">14 Oct</span><span>Q3 business review presented</span></div>`,
      `<div class="tl"><span class="small muted">2 Oct</span><span>September report sent and approved</span></div>`,
    ]))}
${card('Onboarding', `${bar(100, 't-ok')}<p class="small muted" style="margin:6px 0 10px">8 of 8 steps done · finished 21 Feb 2025</p>${list(['Signed agreement', 'Google Ads and Meta access', 'GA4 and conversion tracking', 'Brand kit received', 'Kickoff meeting', 'Portal logins sent'].map(s => `<div class="between"><span>${s}</span>${status('done')}</div>`))}`)}
${card('Terms', `<div class="stack">
  <div class="between"><span class="muted">Monthly fee</span><strong class="num">${money(14000, 'AED')}</strong></div>
  <div class="between"><span class="muted">Term</span><span>12 months, from 1 Feb 2025</span></div>
  <div class="between"><span class="muted">Notice period</span><span>30 days</span></div>
  <div class="between"><span class="muted">Renewal</span><span>1 Feb 2027 · reminder 1 Dec</span></div>
  <div class="stack" style="gap:4px"><div class="between small"><span>Hours this month</span><span class="num">50 of 60</span></div>${bar(83, 't-warn')}<span class="small muted">Past 80% of the monthly hours budget</span></div>
  <div class="small"><strong>In scope:</strong> Google Ads, Meta Ads, 5 social posts a week, monthly report, landing page edits.</div>
  <div class="small"><strong>Out of scope:</strong> new website builds, video shoots, SEO.</div>
  <a class="small" href="#files">Signed agreement (PDF, v2)</a>
</div>`)}
${card('Health', `<div class="row" style="gap:16px;align-items:center">${ring(61, 72)}<div class="stack" style="gap:4px">${band(ALBA)}<span class="small muted">Sentiment: neutral, trending down</span></div></div>
  <div class="table-wrap" style="margin-top:12px"><table class="tbl"><tbody>
  <tr><td>Overdue work</td><td class="right num">-12</td></tr><tr><td>Days since contact</td><td class="right num">0</td></tr><tr><td>Unanswered client waits</td><td class="right num">-8</td></tr><tr><td>Overdue invoices</td><td class="right num">-10</td></tr><tr><td>Open escalations</td><td class="right num">-9</td></tr></tbody></table></div>
  <div class="hc-alert"><strong>Churn alert</strong><p class="small">Karim said on 28 Oct he may "pull back to Google only" in Q1.</p><div class="row">${sel(['Outcome: open', 'Saved', 'Reduced scope', 'Lost'], 'Outcome: open', 'aria-label="Churn alert outcome"')}<button class="btn sm" type="button" data-open="client-dlg-meet">Book a save call</button></div></div>`)}
${card('Upcoming meetings', list([
      `<div class="between"><div class="stack" style="gap:2px"><strong>Monthly review</strong><span class="small muted">Wed 5 Nov, 14:30 · Google Meet</span></div><div class="avatars">${avatar('Sara Malik', 24)}${avatar('Ayesha Khan', 24)}</div></div>`,
      `<div class="between"><div class="stack" style="gap:2px"><strong>Year-end sale creative sign-off</strong><span class="small muted">Tue 11 Nov, 11:00 · Alba showroom, SZR</span></div><div class="avatars">${avatar('Zara Farooq', 24)}${avatar('Lina Saeed', 24)}</div></div>`,
    ]), '<button class="btn sm" type="button" data-open="client-dlg-meet">Schedule</button>')}
${card('Open escalations', list([
      `<div class="between"><div class="stack" style="gap:2px"><strong>Lead form emails delayed</strong><span class="small muted">High · opened 31 Oct · ticket ALB-214</span></div>${tone('Past window', 'danger')}</div>`,
      `<div class="between"><div class="stack" style="gap:2px"><strong>Wrong price on Patrol ad</strong><span class="small muted">Medium · opened 3 Nov · ticket ALB-219</span></div>${tone('Within window', 'ok')}</div>`,
    ]))}
${card('Team', list([['Ayesha Khan', 'Delivery lead · PPC'], ['Zara Farooq', 'Delivery · Social'], ['Lina Saeed', 'Delivery · Design'], ['Sara Malik', 'Account executive'], ['Hamza Qureshi', 'Backup']].map(([n, r]) => `<div class="row" style="gap:10px">${avatar(n, 28)}<div class="stack" style="gap:0"><strong>${n}</strong><span class="small muted">${r}</span></div></div>`)))}
</div>`;
  }

  function accountsPanel() {
    return `<div class="stack" style="gap:16px">
${card('Linked accounts', tbl(['Account', 'Type', 'Projects', 'Open tickets', 'Billing', ''], [
      ['<strong>Alba Motors</strong>', 'Parent', 'ALB', '<span class="num">6</span>', 'Own invoice, AED', ''],
      ['Alba Motors Sharjah', 'Sub-account', 'ALB', '<span class="num">2</span>', 'Billed to parent', '<button class="btn sm ghost" type="button" data-toast="Sub-account unlinked (preview)">Unlink</button>'],
      ['Alba Certified Pre-Owned', 'Sub-account', 'ALB', '<span class="num">1</span>', 'Billed to parent', '<button class="btn sm ghost" type="button" data-toast="Sub-account unlinked (preview)">Unlink</button>'],
      ['Alba Rentals', 'Sub-account', 'none yet', '<span class="num">0</span>', 'Own invoice, AED', '<button class="btn sm ghost" type="button" data-toast="Sub-account unlinked (preview)">Unlink</button>'],
    ]), '<button class="btn sm primary" type="button" data-open="client-dlg-sub">Link sub-account</button>')}
${card('Projects', tbl(['Key', 'Project', 'Lead', 'Open', 'Overdue', 'Done (30 days)', ''], PROJECTS.filter(p => p.client === 'Alba Motors').map(p => [`<span class="num">${p.key}</span>`, `<strong>${esc(p.name)}</strong>`, `<div class="row" style="gap:6px">${avatar(p.lead, 22)}${esc(p.lead)}</div>`, '<span class="num">9</span>', '<span class="num t-danger">2</span>', '<span class="num">31</span>', '<a class="btn sm ghost" href="#tickets">Board</a>']).concat([['<span class="num">ALS</span>', '<strong>Alba Motors Social</strong>', `<div class="row" style="gap:6px">${avatar('Zara Farooq', 22)}Zara Farooq</div>`, '<span class="num">4</span>', '<span class="num">0</span>', '<span class="num">22</span>', '<a class="btn sm ghost" href="#tickets">Board</a>']])))}
</div>`;
  }

  function commitPanel() {
    const rows = [
      ['Qualified leads per month', 'kpi', 'Monthly', '130', '142 (Oct)', tone('Met', 'ok'), '3 Nov'],
      ['Cost per lead under AED 300', 'kpi', 'Monthly', 'AED 300', 'AED 269', tone('On track', 'blue'), '3 Nov'],
      ['5 social posts a week', 'deliverable', 'Weekly', '5', '4 this week', tone('At risk', 'warn'), '2 Nov'],
      ['Monthly report by the 5th', 'deliverable', 'Monthly', '5th', 'In review', tone('On track', 'blue'), '1 Nov'],
      ['Quarterly business review', 'milestone', 'Quarterly', 'Q3 by 15 Oct', 'Presented 14 Oct', tone('Met', 'ok'), '14 Oct'],
      ['Motor Show landing page live', 'milestone', 'Once', '15 Nov', 'Design in review', tone('On track', 'blue'), '30 Oct'],
      ['Meta lead form CPL under AED 180', 'kpi', 'Monthly', 'AED 180', 'AED 212', tone('Missed', 'danger'), '3 Nov'],
    ];
    return `<div class="stack" style="gap:16px">
<div class="stats">${stat('Commitments', 7)}${stat('Met', 2, '', 't-ok')}${stat('On track', 3)}${stat('At risk', 1, '', 't-warn')}${stat('Missed', 1, '', 't-danger')}</div>
${card('Commitments', tbl(['Commitment', 'Kind', 'Cadence', 'Target', 'Latest', 'Status', 'Last check-in', ''], rows.map(r => r.concat(['<button class="btn sm" type="button" data-open="client-dlg-checkin">Log check-in</button>']))), '<button class="btn sm primary" type="button" data-open="client-dlg-commit">Add commitment</button>')}
${card('Recent check-ins', list([
      `<div class="stack" style="gap:2px"><div class="between"><strong>Qualified leads per month</strong><span class="small muted">3 Nov · Ayesha Khan</span></div><span class="small">142 leads in October. Met. Search campaigns carried 61%.</span></div>`,
      `<div class="stack" style="gap:2px"><div class="between"><strong>Meta lead form CPL</strong><span class="small muted">3 Nov · Ayesha Khan</span></div><span class="small">AED 212. Missed. Audience fatigue on the SUV set; new creatives go live 7 Nov.</span></div>`,
      `<div class="stack" style="gap:2px"><div class="between"><strong>5 social posts a week</strong><span class="small muted">2 Nov · Zara Farooq</span></div><span class="small">4 posted. One reel held for the client's price approval.</span></div>`,
    ]))}
</div>`;
  }

  function relPanel() {
    const person = (n, role, power, notes) => `<div class="card"><div class="card-body stack"><div class="row" style="gap:10px">${avatar(n, 36)}<div class="stack" style="gap:0"><strong>${n}</strong><span class="small muted">${role}</span></div></div><div class="between small"><span class="muted">Decision power</span><span>${power}</span></div><p class="small" style="margin:0">${notes}</p></div></div>`;
    return `<div class="stack" style="gap:16px">
<div class="stats">${stat('Tier', 'A', 'Top 20% by fee and potential')}${stat('Rapport', '4 / 5', 'Strong with Rania, cooling with Karim')}<div class="stat"><div class="label">Profile complete</div><div class="value num">72%</div>${bar(72)}</div></div>
<div class="tabs" data-tabs="rel"><button data-tab="people" class="on">People</button><button data-tab="records">Records</button><button data-tab="prep">Prep</button><button data-tab="privacy">Privacy</button></div>
<section data-panel="rel:people"><div class="grid-3">
  ${person('Karim Alba', 'Owner and CEO', 'Final say on budget', 'Plays padel Fridays. Two kids at GEMS Wellington. Prefers short WhatsApp voice notes. Birthday 14 Dec.')}
  ${person('Rania Youssef', 'Marketing manager', 'Day-to-day approvals', 'Ex-agency, reads every report. Wants creative previews 48h ahead. Loves Lebanese food, vegetarian.')}
  ${person('Faisal Noor', 'Finance manager', 'Approves invoices', 'Pays on the 25th. Needs PO numbers on every invoice. Email only.')}
</div></section>
<section data-panel="rel:records" hidden><div class="grid-2">
  ${card('Moments, next 90 days', list([
      '<div class="between"><span>Dubai Motor Show</span><span class="small muted">18 Nov</span></div>',
      '<div class="between"><span>UAE National Day</span><span class="small muted">2 Dec</span></div>',
      '<div class="between"><span>Karim Alba birthday</span><span class="small muted">14 Dec</span></div>',
      '<div class="between"><span>Contract renewal</span><span class="small muted">1 Feb 2027</span></div>',
    ]))}
  ${card('Key dates', list([
      '<div class="between"><span>Client since</span><span class="small muted">1 Feb 2025</span></div>',
      '<div class="between"><span>Showroom opening anniversary</span><span class="small muted">9 Mar</span></div>',
      '<div class="between"><span>Rania Youssef work anniversary</span><span class="small muted">20 Apr</span></div>',
    ]))}
</div>
${card('Relationship log', tbl(['Date', 'Kind', 'Note', 'By'], [
      ['3 Nov', 'touch', 'WhatsApp check-in on Motor Show stand budget', 'Sara Malik'],
      ['28 Oct', 'complaint', 'Karim unhappy that lead emails arrived late', 'Sara Malik'],
      ['14 Oct', 'win', 'Q3 review: leads up 34% year on year', 'Ayesha Khan'],
      ['20 Apr', 'card', 'Card for Rania\'s 3-year work anniversary', 'Hamza Qureshi'],
      ['30 Mar', 'gift', 'Eid hamper to the showroom team', 'Sara Malik'],
      ['14 Dec 2025', 'wish', 'Birthday message to Karim', 'Sara Malik'],
    ]), '<button class="btn sm" type="button" data-open="client-dlg-log">Add entry</button>')}</section>
<section data-panel="rel:prep" hidden><div class="grid-2">
  ${card('Meeting brief: Wed 5 Nov', `<ul class="small" style="margin:0;padding-left:18px;line-height:1.7"><li>Open with the October win: 142 leads, CPL down 12%.</li><li>Own the lead email delay; show the fix in ALB-214.</li><li>Karim floated cutting Meta in Q1. Bring the Meta-assisted sales numbers.</li><li>Ask for the Motor Show stand number and launch dates.</li><li>Pitch Alba Rentals search campaign (AED 4,000/month).</li></ul>`)}
  ${card('Niche profile', `<p class="small" style="margin:0">New and certified pre-owned Nissan and Kia dealer, 2 showrooms (Sheikh Zayed Road, Sharjah Industrial 4). Peak demand in Ramadan and year-end. Buyers compare price on WhatsApp, so ads lead to a WhatsApp chat first. Average car value AED 118,000.</p>`)}
  ${card('Social and competitors', tbl(['Name', 'Instagram', 'Ads running', 'Note'], [
      ['Alba Motors', '24.9k', '18', 'Reels outperform carousels 3 to 1'],
      ['Gulf Auto Hub', '61.2k', '42', 'Heavy 0% finance offers'],
      ['Marina Cars', '15.4k', '9', 'Strong Google reviews, 4.8 stars'],
    ]))}
  ${card('Opportunities', tbl(['Opportunity', 'Value', 'Stage'], [
      ['Alba Rentals search ads', 'AED 4,000/mo', tone('Pitch on 5 Nov', 'blue')],
      ['SEO for pre-owned inventory pages', 'AED 6,500/mo', tone('Idea', 'muted')],
      ['Motor Show stand video', 'AED 9,000 once', tone('Quote sent', 'violet')],
    ]))}
</div></section>
<section data-panel="rel:privacy" hidden>${card('Privacy', `<p class="small" style="margin-top:0">Personal notes about client contacts are visible to the account team only. If a contact asks, remove everything we hold about them. This deletes their personal profile, moments and log entries, and keeps a record that the removal happened.</p><div class="row">${sel(['Karim Alba', 'Rania Youssef', 'Faisal Noor'], 'Karim Alba', 'aria-label="Contact"')}<button class="btn danger" type="button" data-toast="Personal data removed (preview)">Remove on request</button></div><p class="small muted">Last removal: none.</p>`)}</section>
</div>`;
  }

  function meetPanel() {
    return `<div class="stack" style="gap:16px">
${card('Quick log', `<div class="stack"><div class="seg" data-seg="quicklog"><button type="button" class="on">Call</button><button type="button">WhatsApp</button><button type="button">Note</button></div><textarea rows="2" placeholder="What was said, in a line or two" aria-label="Quick log text"></textarea><div class="row"><button class="btn primary sm" type="button" data-toast="Logged to Alba Motors">Save to log</button></div></div>`)}
<div class="grid-2">
${card('Upcoming', list([
      '<div class="between"><div class="stack" style="gap:2px"><strong>Monthly review</strong><span class="small muted">Wed 5 Nov, 14:30 · Google Meet · Rania, Karim</span></div><a class="btn sm ghost" href="#calendar">Calendar</a></div>',
      '<div class="between"><div class="stack" style="gap:2px"><strong>Year-end sale creative sign-off</strong><span class="small muted">Tue 11 Nov, 11:00 · Showroom · Rania</span></div><a class="btn sm ghost" href="#calendar">Calendar</a></div>',
    ]), '<button class="btn sm primary" type="button" data-open="client-dlg-meet">Schedule meeting</button>')}
${card(`Fireflies calls ${P2}`, list([
      '<div class="between"><div class="stack" style="gap:2px"><strong>Alba x Permanent SEO monthly</strong><span class="small muted">28 Oct · 41 min · matched by domain</span></div><a class="btn sm ghost" href="#meetings">Read again</a></div>',
      '<div class="between"><div class="stack" style="gap:2px"><strong>Motor Show planning</strong><span class="small muted">16 Oct · 23 min · matched by title</span></div><a class="btn sm ghost" href="#meetings">Read again</a></div>',
    ]))}
</div>
${card('Meeting notes', list([
      `<div class="stack"><div class="between"><strong>Monthly call · 28 Oct</strong><span class="small muted">Sara Malik, Ayesha Khan</span></div><p class="small" style="margin:0"><strong>Decisions:</strong> move AED 5,000 from Meta to Google Search for November. Hold the SUV carousel.</p><p class="small" style="margin:0"><strong>Concerns:</strong> "We got the Patrol leads a day late, that cost us two sales."</p><div class="small"><strong>Action items:</strong> ALB-214 fix lead email routing (ticket) · Send stand dimensions (client to-do) · Price list for Q4 (client to-do)</div></div>`,
      `<div class="stack"><div class="between"><strong>Motor Show planning · 16 Oct</strong><span class="small muted">Zara Farooq, Lina Saeed</span></div><p class="small" style="margin:0"><strong>Decisions:</strong> landing page with test-drive booking, live by 15 Nov.</p><div class="small"><strong>Action items:</strong> ALB-207 landing page design (ticket) · ALB-208 booking form (ticket)</div></div>`,
    ]), '<button class="btn sm" type="button" data-open="client-dlg-notes">Log notes</button>')}
</div>`;
  }

  function reportsPanel() {
    return `<div class="stack" style="gap:16px">
<div class="row small muted">Due on the 5th of each month · auto-send when Rania's report is approved: on</div>
${card('Monthly reports', tbl(['Month', 'Status', 'Due', 'Owner', 'Auto-send', ''], [
      ['October 2026', tone('Submitted, in review', 'violet'), '5 Nov', 'Ayesha Khan', 'On', '<button class="btn sm" type="button" data-open="client-dlg-report">Preview</button>'],
      ['September 2026', tone('Sent', 'ok'), '5 Oct', 'Ayesha Khan', 'On', '<button class="btn sm ghost" type="button" data-open="client-dlg-report">Preview</button>'],
      ['August 2026', tone('Sent after changes', 'ok'), '5 Sep', 'Ayesha Khan', 'On', '<button class="btn sm ghost" type="button" data-open="client-dlg-report">Preview</button>'],
      ['July 2026', tone('Sent', 'ok'), '5 Aug', 'Ayesha Khan', 'Off', '<button class="btn sm ghost" type="button" data-open="client-dlg-report">Preview</button>'],
    ]), '<button class="btn sm" type="button" data-toast="Report settings saved (preview)">Report settings</button>')}
<div class="grid-2">
${card('October draft', `<div class="stack"><div class="field"><label>Highlights</label><textarea rows="4">142 qualified leads, up 18% on September.\nCost per lead down to AED 269.\nSearch campaigns drove 61% of leads.</textarea></div><div class="field"><label>Plan for November</label><textarea rows="3">Motor Show landing page and test-drive ads from 15 Nov.\nShift AED 5,000 from Meta to Search.</textarea></div><div class="row"><button class="btn" type="button" data-toast="Sent back with changes">Request changes</button><button class="btn primary" type="button" data-toast="Approved. Auto-send queued for 5 Nov 09:00">Approve and send</button></div></div>`)}
${card('Quarterly business reviews', tbl(['Quarter', 'Status', 'Date', 'Deck'], [
      ['Q4 2026', tone('Draft', 'muted'), '15 Jan 2027', '<a href="#files">Draft deck</a>'],
      ['Q3 2026', tone('Presented', 'ok'), '14 Oct', '<a href="#files">QBR Q3.pdf</a>'],
      ['Q2 2026', tone('Presented', 'ok'), '10 Jul', '<a href="#files">QBR Q2.pdf</a>'],
    ]), '<button class="btn sm" type="button" data-toast="Q4 QBR marked ready">Mark Q4 ready</button>')}
</div></div>`;
  }

  function escPanel() {
    return `<div class="stack" style="gap:16px">
<div class="stats">${stat('Open', 2, '', 't-warn')}${stat('Past window', 1, 'Lead form emails', 't-danger')}${stat('Closed this year', 6)}${stat('Average client rating', '4.2 / 5')}</div>
${card('Escalations', tbl(['Opened', 'Issue', 'Severity', 'Response window', 'Ticket', 'Owner', 'Status', 'Client rating'], [
      ['31 Oct', '<strong>Lead form emails delayed by a day</strong>', tone('High', 'warn'), '8 working hours · <span class="t-danger">passed</span>', '<a href="#ticket">ALB-214</a>', 'Daniel Reyes', status('in_progress'), '<span class="muted">After close</span>'],
      ['3 Nov', '<strong>Wrong price on Nissan Patrol ad</strong>', tone('Medium', 'blue'), '24 working hours · 9h left', '<a href="#ticket">ALB-219</a>', 'Ayesha Khan', status('in_review'), '<span class="muted">After close</span>'],
      ['12 Sep', 'Instagram story posted with old logo', tone('Low', 'muted'), '72 working hours · met', '<a href="#ticket">ALS-118</a>', 'Zara Farooq', status('done'), '<span class="num">5 / 5</span>'],
      ['20 Jul', 'Google Ads account suspended for 6 hours', tone('Critical', 'danger'), '2 working hours · met', '<a href="#ticket">ALB-162</a>', 'Ayesha Khan', status('done'), '<span class="num">4 / 5</span>'],
    ]), '<button class="btn sm danger" type="button" data-open="client-dlg-escalate">Raise escalation</button>')}
<p class="small muted">Severity sets the response window: Critical 2h, High 8h, Medium 24h, Low 72h. Each escalation opens an urgent ticket, and the client rates the fix from 1 to 5 when it closes.</p>
</div>`;
  }

  function ratingsPanel() {
    const r = (m, t, q, o, c, by) => [m, t, `<span class="num">${q}</span>`, `<span class="num">${o}</span>`, `<span class="num">${c}</span>`, by];
    return `<div class="stack" style="gap:16px">
<div class="stats">${stat('Quality, 3 months', '4.3')}${stat('On time, 3 months', '3.7', 'Lead email delay in October', 't-warn')}${stat('Communication, 3 months', '4.5')}</div>
${card('Monthly ratings from the client (1 to 5)', tbl(['Month', 'Team', 'Quality', 'On time', 'Communication', 'Rated by'], [
      r('October 2026', 'PPC', 4, 3, 4, 'Rania Youssef'), r('October 2026', 'Social', 4, 4, 5, 'Rania Youssef'), r('October 2026', 'Design', 5, 4, 5, 'Rania Youssef'),
      r('September 2026', 'PPC', 5, 4, 5, 'Rania Youssef'), r('September 2026', 'Social', 4, 4, 4, 'Rania Youssef'), r('August 2026', 'PPC', 4, 4, 4, 'Karim Alba'),
    ]), '<button class="btn sm" type="button" data-toast="Rating request sent to Rania">Ask for November rating</button>')}
</div>`;
  }

  function contactsPanel() {
    return `<div class="stack" style="gap:16px">
${card('Client contacts', tbl(['Name', 'Role', 'Email', 'Phone', 'Main contact', 'Gets reports'], [
      [`<div class="row" style="gap:8px">${avatar('Rania Youssef', 24)}<strong>Rania Youssef</strong></div>`, 'Marketing manager', 'rania@albamotors.ae', '+971 50 412 7781', 'Yes', 'Yes'],
      [`<div class="row" style="gap:8px">${avatar('Karim Alba', 24)}Karim Alba</div>`, 'Owner and CEO', 'karim@albamotors.ae', '+971 50 300 1122', 'No', 'Yes'],
      [`<div class="row" style="gap:8px">${avatar('Faisal Noor', 24)}Faisal Noor</div>`, 'Finance manager', 'accounts@albamotors.ae', '+971 4 338 9000', 'No', 'No'],
      [`<div class="row" style="gap:8px">${avatar('Joseph Mathew', 24)}Joseph Mathew</div>`, 'Sales manager, Sharjah', 'joseph@albamotors.ae', '+971 55 921 4410', 'No', 'No'],
    ]), '<button class="btn sm primary" type="button" data-open="client-dlg-contact">Add contact</button>')}
${card('Our team on this client', tbl(['Person', 'Role on client', 'Department', 'Hours this month'], [
      [`<div class="row" style="gap:8px">${avatar('Ayesha Khan', 24)}Ayesha Khan</div>`, 'Delivery lead', 'PPC', '<span class="num">22</span>'],
      [`<div class="row" style="gap:8px">${avatar('Zara Farooq', 24)}Zara Farooq</div>`, 'Delivery', 'Social', '<span class="num">16</span>'],
      [`<div class="row" style="gap:8px">${avatar('Lina Saeed', 24)}Lina Saeed</div>`, 'Delivery', 'Design', '<span class="num">9</span>'],
      [`<div class="row" style="gap:8px">${avatar('Sara Malik', 24)}Sara Malik</div>`, 'Account executive', 'Client Success', '<span class="num">3</span>'],
      [`<div class="row" style="gap:8px">${avatar('Hamza Qureshi', 24)}Hamza Qureshi</div>`, 'Backup', 'Client Success', '<span class="num">0</span>'],
    ]), '<button class="btn sm" type="button" data-toast="Team saved (preview)">Edit team</button>')}
</div>`;
  }

  function clientFilesPanel() {
    return `<div class="stack" style="gap:16px">
<div class="grid-3">${[['Brand assets', 14, 'Shared with client'], ['From the client', 9, 'Uploaded by Alba'], ['Campaign creatives', 37, 'Custom folder']].map(([n, c, s]) => `<a class="card" href="#files"><div class="card-body stack" style="gap:2px"><strong>${n}</strong><span class="small muted">${c} files · ${s}</span></div></a>`).join('')}</div>
${card('Recent files', tbl(['Name', 'Folder', 'Version', 'Uploaded', 'Client sees it'], [
      ['Motor Show landing page v3.fig', 'Campaign creatives', 'v3', 'Lina Saeed · 3 Nov', 'No'],
      ['Q4 price list.xlsx', 'From the client', 'v1', 'Rania Youssef · 1 Nov', 'Yes'],
      ['Alba logo pack.zip', 'Brand assets', 'v2', 'Lina Saeed · 12 Mar', 'Yes'],
      ['Signed agreement 2025.pdf', 'Brand assets', 'v2', 'Sara Malik · 1 Feb 2025', 'Yes'],
    ]), '<a class="btn sm" href="#files">Open in Files</a>')}
${card(`Google Drive ${P2}`, `<p class="small muted" style="margin-top:0">Read-only view of the shared folder "Alba Motors / Marketing".</p>${list(['Showroom photos 2026 (folder, 214 items)', 'Dealer co-op guidelines.pdf', 'Nissan brand rules 2026.pdf', 'Sales targets Q4.xlsx'].map(n => `<div class="between"><span>${n}</span><button class="btn sm ghost" type="button" data-toast="Opening in Google Drive (preview)">Open</button></div>`))}`)}
</div>`;
  }

  function perfPanel() {
    const src = (n, acct, ok, last) => [`<strong>${n}</strong>`, acct, ok ? tone('Connected', 'ok') : tone('Not connected', 'muted'), last, ok ? '<div class="row"><button class="btn sm" type="button" data-toast="Refreshing (preview)">Refresh</button><button class="btn sm ghost" type="button" data-toast="Disconnected (preview)">Disconnect</button></div>' : '<button class="btn sm primary" type="button" data-toast="Connect flow opens here (preview)">Connect</button>'];
    const m = (k, a, b, ch, good) => [k, `<span class="num">${a}</span>`, `<span class="num muted">${b}</span>`, `<span class="num ${good ? 'cv-up' : 'cv-down'}">${ch}</span>`];
    return `<div class="stack" style="gap:16px">
${card('Data sources', tbl(['Source', 'Account', 'Status', 'Last refresh', ''], [
      src('Google Search Console', 'sc-domain:albamotors.ae', 1, 'Today 06:00'), src('GA4', 'Alba Motors · 318902211', 1, 'Today 06:00'), src('Google Business Profile', '2 locations', 1, 'Yesterday 22:10'),
      src('Google Ads', '412-889-2031', 1, 'Today 06:05'), src('Meta Ads', 'act_10223399', 1, 'Today 06:05'), src('LinkedIn Ads', '—', 0, '—'),
    ]))}
${card('Last 28 days vs prior 28', tbl(['Metric', 'Last 28 days', 'Prior 28', 'Change'], [
      m('Sessions', '38,420', '34,110', '+12.6%', 1), m('Organic clicks', '6,210', '6,480', '-4.2%', 0), m('Leads', '142', '120', '+18.3%', 1),
      m('Calls from Google Business Profile', '318', '296', '+7.4%', 1), m('Ad spend', 'AED 38,200', 'AED 36,700', '+4.1%', 1), m('Cost per lead', 'AED 269', 'AED 306', '-12.1%', 1),
    ]))}
</div>`;
  }

  function analysisPanel() {
    return `<div class="grid-2">
${card('What changed in October', `<ul class="small" style="margin:0;padding-left:18px;line-height:1.7"><li>Leads up 18%, almost all from Google Search brand + model terms.</li><li>Meta lead forms got more expensive (CPL AED 212, up from 171).</li><li>Organic clicks dipped 4% after a competitor launched 0% finance pages.</li></ul>`)}
${card('Why', `<ul class="small" style="margin:0;padding-left:18px;line-height:1.7"><li>New Patrol and X-Trail ad groups matched high-intent searches.</li><li>The same 4 SUV creatives ran for 7 weeks; frequency hit 5.8.</li><li>No finance-offer page on albamotors.ae to compete in search.</li></ul>`)}
${card("What we'll do next", `<ul class="small" style="margin:0;padding-left:18px;line-height:1.7"><li>Ship 6 new SUV creatives on 7 Nov (Lina, Zara).</li><li>Move AED 5,000 to Search for November (Ayesha).</li><li>Propose a finance-offer landing page in the 5 Nov call (Sara).</li></ul>`)}
${card('Leads by channel', tbl(['Channel', 'Leads', 'Share', 'Cost per lead'], [
      ['Google Search', '<span class="num">87</span>', '<span class="num">61%</span>', '<span class="num">AED 214</span>'], ['Meta lead forms', '<span class="num">34</span>', '<span class="num">24%</span>', '<span class="num">AED 212</span>'],
      ['Website forms (organic)', '<span class="num">15</span>', '<span class="num">11%</span>', '<span class="muted">—</span>'], ['WhatsApp click-to-chat', '<span class="num">6</span>', '<span class="num">4%</span>', '<span class="num">AED 390</span>'],
    ]))}
</div>`;
  }

  function adsPanel() {
    const c = (n, p, sp, cl, l, st) => [`<strong>${n}</strong>`, p, `<span class="num">AED ${sp}</span>`, `<span class="num">${cl}</span>`, `<span class="num">${l}</span>`, `<span class="num">${l ? 'AED ' + Math.round(Number(sp.replace(',', '')) / l) : '—'}</span>`, st];
    return `<div class="stack" style="gap:16px">
<div class="stats">${stat('Spend this month', 'AED 4,920', 'of AED 40,000 budget')}${stat('Leads this month', 21)}${stat('Cost per lead', 'AED 234')}<div class="stat"><div class="label">Budget pacing</div><div class="value num">12%</div>${bar(12)}<div class="sub">4 of 30 days gone, on pace</div></div></div>
${card('Campaigns, last 28 days', tbl(['Campaign', 'Platform', 'Spend', 'Clicks', 'Leads', 'Cost per lead', 'Status'], [
      c('Search · Nissan Patrol', 'Google Ads', '9,800', '2,410', 48, tone('Running', 'ok')), c('Search · X-Trail and Kicks', 'Google Ads', '8,600', '2,960', 39, tone('Running', 'ok')),
      c('PMax · Certified pre-owned', 'Google Ads', '5,200', '3,880', 14, tone('Learning', 'blue')), c('Lead form · SUV range', 'Meta', '7,200', '5,120', 34, tone('Fatigued', 'warn')),
      c('Retargeting · site visitors', 'Meta', '4,100', '1,940', 7, tone('Running', 'ok')), c('Ramadan 2026 offers', 'Meta', '0', '0', 0, tone('Paused', 'muted')),
    ]))}
</div>`;
  }

  function leadsPanel() {
    const L = [
      ['4 Nov 09:12', 'Mohammed R.', 'Google Ads', 'Nissan Patrol 2026', 'New'],
      ['3 Nov 18:40', 'Anjali S.', 'Meta lead form', 'Kia Sportage', 'Contacted'],
      ['3 Nov 11:05', 'Tariq H.', 'Website form', 'Certified pre-owned Altima', 'Test drive booked'],
      ['2 Nov 16:22', 'Emma W.', 'WhatsApp', 'X-Trail finance offer', 'Contacted'],
      ['1 Nov 10:48', 'Saeed K.', 'Google Ads', 'Nissan Patrol 2026', 'Sold'],
      ['31 Oct 14:30', 'Leila M.', 'Meta lead form', 'Kia Seltos', 'Lost'],
      ['30 Oct 12:02', 'Rahul P.', 'Website form', 'Service booking', 'Not a sales lead'],
    ];
    return `<div class="stack" style="gap:16px">
<div class="stats">${stat('Leads, 28 days', 142)}${stat('Contacted within 1 hour', '78%')}${stat('Test drives booked', 31)}${stat('Sold', 9, 'AED 1.06m in car sales', 't-ok')}</div>
${card('Leads', tbl(['When', 'Name', 'Source', 'Interest', 'Outcome'], L.map(l => [l[0], `<strong>${l[1]}</strong>`, l[2], l[3], sel(['New', 'Contacted', 'Test drive booked', 'Sold', 'Lost', 'Not a sales lead'], l[4], `aria-label="Outcome for ${l[1]}" data-outcome`)])), '<button class="btn sm" type="button" data-toast="CSV export ready (preview)">Export CSV</button>')}
</div>`;
  }

  function webPanel() {
    return `<div class="stack" style="gap:16px">
<div class="stats">${stat('Uptime, 30 days', '99.98%', '', 't-ok')}${stat('Mobile speed score', 71, 'LCP 2.9s', 't-warn')}${stat('Forms working', '4 of 4', 'Tested today 07:00')}${stat('Last backup', 'Today 03:00')}</div>
<div class="grid-2">
${card('Site', `<div class="stack small"><div class="between"><span class="muted">Address</span><a href="#client">albamotors.ae</a></div><div class="between"><span class="muted">Platform</span><span>WordPress 6.6, hosted by client</span></div><div class="between"><span class="muted">SSL</span><span>Renews 19 Feb 2027</span></div><div class="between"><span class="muted">Domain</span><span>Renews 3 Aug 2027</span></div><div class="between"><span class="muted">Tracking</span><span>GA4, Google Ads, Meta pixel</span></div></div>`)}
${card('Change requests', tbl(['Request', 'Ticket', 'Status'], [
      ['Motor Show landing page', '<a href="#ticket">ALB-207</a>', status('in_review')], ['Test-drive booking form', '<a href="#ticket">ALB-208</a>', status('in_progress')],
      ['Fix lead email routing', '<a href="#ticket">ALB-214</a>', status('in_progress')], ['Update Q4 prices', '<a href="#ticket">ALB-220</a>', status('todo')],
    ]))}
</div></div>`;
  }

  function seoPanel() {
    return `<div class="stack" style="gap:16px">
<p class="small muted">SEO isn't in Alba's current services. This view uses Search Console data so the team can spot upsell openings.</p>
<div class="stats">${stat('Organic clicks, 28 days', '6,210', '-4.2%')}${stat('Keywords in top 10', 38)}${stat('Average position', '14.6')}</div>
${card('Top queries', tbl(['Query', 'Position', 'Clicks', 'Impressions', 'Change'], [
      ['alba motors', '1.0', '2,140', '4,020', '<span class="cv-up">0</span>'], ['nissan patrol 2026 price uae', '6.3', '412', '18,900', '<span class="cv-up">+2.1</span>'],
      ['used nissan dubai', '11.8', '188', '22,400', '<span class="cv-down">-3.4</span>'], ['kia sportage offers sharjah', '8.2', '141', '6,700', '<span class="cv-up">+0.9</span>'],
      ['car finance 0% uae', '27.5', '12', '31,000', '<span class="cv-down">-6.0</span>'],
    ].map(r => [r[0], `<span class="num">${r[1]}</span>`, `<span class="num">${r[2]}</span>`, `<span class="num">${r[3]}</span>`, r[4]])), '<button class="btn sm" type="button" data-toast="Added to opportunities">Add SEO opportunity</button>')}
</div>`;
  }

  function portalPanel() {
    return `<div class="stack" style="gap:16px">
<div class="grid-2">
${card('Logins', tbl(['Name', 'Email', 'Role', 'Last login', ''], [
      ['<strong>Rania Youssef</strong>', 'rania@albamotors.ae', sel(['Owner', 'Viewer', 'Leads only'], 'Owner', 'aria-label="Role"'), 'Today 08:41', '<button class="btn sm ghost" type="button" data-toast="Access removed (preview)">Remove</button>'],
      ['Karim Alba', 'karim@albamotors.ae', sel(['Owner', 'Viewer', 'Leads only'], 'Owner', 'aria-label="Role"'), '28 Oct', '<button class="btn sm ghost" type="button" data-toast="Access removed (preview)">Remove</button>'],
      ['Joseph Mathew', 'joseph@albamotors.ae', sel(['Owner', 'Viewer', 'Leads only'], 'Leads only', 'aria-label="Role"'), 'Yesterday', '<button class="btn sm ghost" type="button" data-toast="Access removed (preview)">Remove</button>'],
      ['Faisal Noor', 'accounts@albamotors.ae', sel(['Owner', 'Viewer', 'Leads only'], 'Viewer', 'aria-label="Role"'), 'Invite sent 2 Nov', '<button class="btn sm ghost" type="button" data-toast="Invite resent">Resend</button>'],
    ]) + '<p class="small muted">Karim Alba also logs in to Alba Rentals with the same email.</p>', '<button class="btn sm primary" type="button" data-open="client-dlg-invite">Invite</button>')}
${card('Branding', `<div class="form-grid">${field('Logo', '<input type="file" accept="image/*" aria-label="Logo">')}${field('Brand colour', '<input type="color" value="#c8102e" aria-label="Brand colour">')}${field('Portal welcome line', '<input value="Welcome back to your Alba Motors workspace">', true)}</div><div class="row"><button class="btn sm primary" type="button" data-toast="Branding saved">Save branding</button><a class="btn sm" href="#portal-home">See as client</a></div><p class="small muted">"See as client" opens a 30-minute preview as Rania.</p>`)}
</div>
${card('Vault', tbl(['Service', 'Username', 'Password', 'Last revealed'], [
      ['Google Ads', 'ads@albamotors.ae', '<span class="vault-pw" data-pw="Gk7!pR2#xLm9">••••••••••</span> <button class="btn sm ghost" type="button" data-reveal>Reveal</button>', 'Ayesha Khan · 2 Nov'],
      ['WordPress admin', 'permanentseo', '<span class="vault-pw" data-pw="wp-Alba-2026-qT4">••••••••••</span> <button class="btn sm ghost" type="button" data-reveal>Reveal</button>', 'Daniel Reyes · 30 Oct'],
      ['Meta Business', 'marketing@albamotors.ae', '<span class="vault-pw" data-pw="Mb#88sunset">••••••••••</span> <button class="btn sm ghost" type="button" data-reveal>Reveal</button>', 'Zara Farooq · 27 Oct'],
    ]) + '<p class="small muted" data-vault-note>Every reveal is logged. Passwords hide again after 30 seconds.</p>', '<button class="btn sm" type="button" data-toast="Login saved to vault (preview)">Add login</button>')}
${card('Activity lines in the portal', tbl(['Line', 'When', 'Shows as'], [
      ['October report submitted for review', '1 Nov', sel(['Draft', 'Shared', 'Hidden'], 'Draft', 'aria-label="Visibility"')],
      ['6 new SUV creatives ready for your approval', '3 Nov', sel(['Draft', 'Shared', 'Hidden'], 'Shared', 'aria-label="Visibility"')],
      ['Lead email routing fix in progress', '1 Nov', sel(['Draft', 'Shared', 'Hidden'], 'Shared', 'aria-label="Visibility"')],
      ['Internal: budget reallocation debate', '29 Oct', sel(['Draft', 'Shared', 'Hidden'], 'Hidden', 'aria-label="Visibility"')],
    ]))}
</div>`;
  }

  const PANELS = { overview: overviewPanel, accounts: accountsPanel, commit: commitPanel, rel: relPanel, meet: meetPanel, reports: reportsPanel, esc: escPanel, ratings: ratingsPanel, contacts: contactsPanel, files: clientFilesPanel, perf: perfPanel, analysis: analysisPanel, ads: adsPanel, leads: leadsPanel, web: webPanel, seo: seoPanel, portal: portalPanel };

  screen({
    id: 'client', title: 'Alba Motors', group: null,
    render() {
      const c = ALBA;
      return `<div class="page scr-client">
<style>
.scr-client .cl-head{display:flex;gap:18px;align-items:flex-start;flex-wrap:wrap}
.scr-client .cl-head h1{margin:0}
.scr-client .cl-facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:1px;background:var(--line);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden}
.scr-client .cl-facts>div{background:var(--surface);padding:10px 14px;display:flex;flex-direction:column;gap:2px}
.scr-client .tabs-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch}
.scr-client .tabs-scroll .tabs{flex-wrap:nowrap;white-space:nowrap;min-width:max-content}
.scr-client .tl{display:grid;grid-template-columns:56px 1fr;gap:10px}
.scr-client .cv-up{color:var(--ok)}.scr-client .cv-down{color:var(--danger)}
.scr-client .t-danger{color:var(--danger)}
.scr-client .hc-alert{margin-top:12px;padding:10px 12px;border-left:3px solid var(--warn);background:var(--warn-soft);border-radius:var(--radius)}
.scr-client .hc-alert p{margin:4px 0 8px}
.scr-client .notes{background:var(--surface-2);border-radius:var(--radius);padding:10px 12px}
.scr-client .vault-pw{font-family:ui-monospace,monospace}
.scr-client a.card{color:var(--ink);text-decoration:none}
.scr-client a.card:hover{border-color:var(--accent)}
.scr-client pre.draft{white-space:pre-wrap;font:inherit;background:var(--surface-2);border:1px solid var(--line);border-radius:var(--radius);padding:12px;margin:0}
</style>
<div class="card"><div class="card-body stack" style="gap:14px">
  <div class="cl-head">${ring(c.health, 76)}
    <div class="stack" style="gap:6px;flex:1;min-width:220px">
      <div class="row" style="gap:14px;align-items:center"><h1>Alba Motors</h1>${band(c)}${tone('Active', 'ok')}</div>
      <div class="row small" style="gap:16px">
        <span class="row" style="gap:6px">${avatar('Sara Malik', 22)}Executive: Sara Malik</span>
        <span class="row" style="gap:6px">${avatar('Ayesha Khan', 22)}Manager: Ayesha Khan</span>
        <a href="#client">albamotors.ae</a><span class="muted">Channel: WhatsApp</span><span class="muted">Last contact: yesterday</span><span class="muted">Services: PPC, Social</span>
      </div>
      <div class="notes small"><strong>Internal notes:</strong> Karim decides, Rania runs it. Always preview creatives 48h before launch. Never call before 10:00.</div>
    </div>
  </div>
  <div class="row">
    <button class="btn primary" type="button" data-open="client-dlg-email">Email client</button>
    <button class="btn" type="button" data-open="client-dlg-meet">Schedule meeting</button>
    <button class="btn" type="button" data-open="client-dlg-escalate">Escalate</button>
    <button class="btn" type="button" data-open="client-dlg-log">Log a call or chat</button>
    <button class="btn" type="button" data-open="client-dlg-edit">Edit</button>
    <a class="btn ghost" href="#portal-home">See as client</a>
  </div>
</div></div>
<div class="cl-facts">
  <div><span class="small muted">Monthly fee</span><strong class="num">${money(14000, 'AED')}</strong></div>
  <div><span class="small muted">Client since</span><strong>Feb 2025</strong></div>
  <div><span class="small muted">Open tickets</span><strong class="num">9</strong></div>
  <div><span class="small muted">Overdue</span><strong class="num t-danger">2</strong></div>
  <div><span class="small muted">Hours this month</span><strong class="num">50 of 60</strong></div>
  <div><span class="small muted">Balance due</span><strong class="num">${money(14000, 'AED')}</strong></div>
  <div><span class="small muted">Next meeting</span><strong>Wed 5 Nov, 14:30</strong></div>
</div>
<div class="tabs-scroll"><div class="tabs" data-tabs="cl">${TABS.map(([id, label, p2], i) => `<button type="button" data-tab="${id}" class="${i ? '' : 'on'}">${label}${p2 ? ' ' + P2 : ''}</button>`).join('')}</div></div>
${TABS.map(([id], i) => `<section data-panel="cl:${id}"${i ? ' hidden' : ''}>${PANELS[id]()}</section>`).join('\n')}

${modal('client-dlg-email', `Email client ${P2}`, `<div class="stack">
  ${field('To', '<input value="rania@albamotors.ae">')}
  ${field('Subject', '<input value="October results and tomorrow\'s call">')}
  <div class="row between"><span class="small muted">AI draft tone</span><div class="seg" data-seg="tone">${Object.keys(EMAIL).map((t, i) => `<button type="button" class="${i ? '' : 'on'}" data-v="${t}">${t}</button>`).join('')}</div></div>
  <pre class="draft" data-draft>${esc(EMAIL.Friendly)}</pre>
</div>`, 'Send email')}
${modal('client-dlg-meet', 'Schedule meeting', `<div class="form-grid">
  ${field('Title', '<input value="Alba Motors · save call">', true)}
  ${field('Date', '<input type="date" value="2026-11-06">')}${field('Start', '<input type="time" step="900" value="11:00">')}
  ${field('Length', sel(['15 min', '30 min', '45 min', '60 min'], '30 min'))}${field('Where', sel(['Google Meet', 'Alba showroom, SZR', 'Phone'], 'Google Meet'))}
  ${field('Guests', '<input value="karim@albamotors.ae, rania@albamotors.ae">', true)}
  ${field('Agenda', '<textarea rows="3">Q1 budget, Meta results, Motor Show plan</textarea>', true)}
</div>`, 'Schedule')}
${modal('client-dlg-escalate', 'Raise escalation', `<div class="form-grid">
  ${field('What went wrong', '<input placeholder="One line the whole team will understand">', true)}
  ${field('Severity', sel(['Critical · 2h window', 'High · 8h window', 'Medium · 24h window', 'Low · 72h window'], 'High · 8h window'))}
  ${field('Owner', sel(['Ayesha Khan', 'Daniel Reyes', 'Zara Farooq', 'Lina Saeed'], 'Ayesha Khan'))}
  ${field('Details', '<textarea rows="3"></textarea>', true)}
  <div class="field full">${chk('Create an urgent ticket in ALB', true)}${chk('Ask the client to rate the fix when closed', true)}</div>
</div>`, 'Raise escalation')}
${modal('client-dlg-log', 'Log a call or chat', `<div class="form-grid">
  ${field('Kind', sel(['Call', 'WhatsApp', 'Email', 'Meeting', 'Note', 'wish', 'gift', 'card', 'win', 'complaint', 'touch'], 'WhatsApp'))}
  ${field('With', sel(['Rania Youssef', 'Karim Alba', 'Faisal Noor', 'Joseph Mathew'], 'Rania Youssef'))}
  ${field('Date', '<input type="date" value="2026-11-04">')}${field('Mood', sel(['Happy', 'Neutral', 'Unhappy'], 'Neutral'))}
  ${field('Notes', '<textarea rows="3"></textarea>', true)}
</div>`, 'Save to log')}
${modal('client-dlg-edit', 'Edit client', `<div class="form-grid">
  ${field('Client name', '<input value="Alba Motors">')}${field('Website', '<input value="albamotors.ae">')}
  ${field('Services', svcChecks(['PPC', 'Social']), true)}
  ${field('Country', sel(['UAE', 'Saudi Arabia', 'Pakistan', 'UK', 'USA'], 'UAE'))}${field('Start date', '<input type="date" value="2025-02-01">')}
  ${field('Main channel', sel(['WhatsApp', 'Email', 'Slack', 'Phone'], 'WhatsApp'))}${field('Status', sel(['Active', 'Onboarding', 'Paused', 'Ended'], 'Active'))}
  ${field('Account executive', sel(['Sara Malik', 'Hamza Qureshi'], 'Sara Malik'))}${field('Delivery manager', sel(['Ayesha Khan', 'Omar Haddad', 'Zara Farooq'], 'Ayesha Khan'))}
  ${field('Notes', '<textarea rows="2">Karim decides, Rania runs it.</textarea>', true)}
  <div class="field full"><h4>End this client</h4><p class="small muted">Needs an end date and a reason.</p></div>
  ${field('End date', '<input type="date">')}${field('Reason', sel(['Choose a reason', 'Budget cut', 'Moved in-house', 'Unhappy with results', 'Business closed', 'Other'], 'Choose a reason'))}
  <div class="field full"><button class="btn danger sm" type="button" data-open="client-dlg-delete">Delete client</button></div>
</div>`, 'Save changes')}
${modal('client-dlg-delete', 'Delete Alba Motors', `<p class="small">This removes the client, its tickets, files and portal logins. Invoices stay in Finance. Type <strong>Alba Motors</strong> to confirm.</p>${field('Client name', '<input data-confirm-name placeholder="Alba Motors" aria-label="Type the client name">')}`, 'Delete for good')}
${modal('client-dlg-checkin', 'Log check-in', `<div class="form-grid">
  ${field('Commitment', sel(['Qualified leads per month', 'Cost per lead under AED 300', '5 social posts a week', 'Monthly report by the 5th', 'Motor Show landing page live', 'Meta lead form CPL under AED 180'], 'Qualified leads per month'), true)}
  ${field('Latest value', '<input value="142">')}${field('Status', sel(['Met', 'On track', 'At risk', 'Missed'], 'Met'))}
  ${field('Note', '<textarea rows="2"></textarea>', true)}
</div>`, 'Save check-in')}
${modal('client-dlg-commit', 'Add commitment', `<div class="form-grid">
  ${field('Commitment', '<input placeholder="e.g. 20 Google reviews a month">', true)}
  ${field('Kind', sel(['kpi', 'deliverable', 'milestone'], 'kpi'))}${field('Cadence', sel(['Weekly', 'Monthly', 'Quarterly', 'Once'], 'Monthly'))}
  ${field('Target', '<input>')}${field('Owner', sel(['Ayesha Khan', 'Zara Farooq', 'Lina Saeed'], 'Ayesha Khan'))}
  <div class="field full">${chk('Show to the client in the portal', true)}</div>
</div>`, 'Add commitment')}
${modal('client-dlg-sub', 'Link sub-account', `<div class="form-grid">${field('Account', sel(['Alba Rentals', 'Alba Motors Ajman (new)'], 'Alba Rentals'), true)}${field('Billing', sel(['Billed to parent', 'Own invoice'], 'Billed to parent'))}${field('Project', sel(['ALB', 'ALS', 'New project'], 'ALB'))}</div>`, 'Link')}
${modal('client-dlg-notes', 'Log meeting notes', `<div class="form-grid">
  ${field('Meeting', sel(['Monthly call · 28 Oct', 'Motor Show planning · 16 Oct', 'Other'], 'Monthly call · 28 Oct'), true)}
  ${field('Decisions', '<textarea rows="2"></textarea>', true)}${field('Concerns', '<textarea rows="2"></textarea>', true)}
  ${field('Action items (one per line)', '<textarea rows="3"></textarea>', true)}
  <div class="field full">${chk('Turn action items into tickets after saving', true)}</div>
</div>`, 'Save notes')}
${modal('client-dlg-report', 'October 2026 report preview', `<div class="stack small"><h4 style="margin:0">Alba Motors · October 2026</h4><p style="margin:0">142 qualified leads (+18%), cost per lead AED 269 (-12%), ad spend AED 38,200.</p><p style="margin:0"><strong>Highlights:</strong> Search drove 61% of leads. Patrol campaign hit a record 48 leads.</p><p style="margin:0"><strong>Next month:</strong> Motor Show landing page from 15 Nov; budget shift to Search.</p></div>`, 'Approve')}
${modal('client-dlg-contact', 'Add contact', `<div class="form-grid">${field('Name', '<input>')}${field('Role', '<input>')}${field('Email', '<input type="email">')}${field('Phone', '<input>')}<div class="field full">${chk('Main contact')}${chk('Gets monthly reports')}${chk('Invite to the client portal')}</div></div>`, 'Add contact')}
${modal('client-dlg-invite', 'Invite to the portal', `<div class="form-grid">${field('Email', '<input type="email" placeholder="name@albamotors.ae">', true)}${field('Role', sel(['Owner', 'Viewer', 'Leads only'], 'Viewer'))}${field('Businesses', sel(['Alba Motors', 'Alba Motors + Alba Rentals'], 'Alba Motors'))}</div><p class="small muted">Owners see billing and approvals. Viewers don't. Leads only sees the leads list.</p>`, 'Send invite')}
</div>`;
    },
    mount(root) {
      const sc = root.querySelector('.scr-client'); if (!sc) return;
      const toneSeg = sc.querySelector('[data-seg="tone"]'), draft = sc.querySelector('[data-draft]');
      if (toneSeg) toneSeg.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        toneSeg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); draft.textContent = EMAIL[b.dataset.v];
      });
      sc.querySelectorAll('.seg[data-seg="quicklog"]').forEach(s => s.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return; s.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      }));
      sc.querySelectorAll('[data-toast]').forEach(b => b.addEventListener('click', () => K.toast(b.dataset.toast)));
      sc.querySelectorAll('[data-reveal]').forEach(b => b.addEventListener('click', () => {
        const pw = b.previousElementSibling; if (b._t) return;
        pw.textContent = pw.dataset.pw; let left = 30; b.textContent = `Hides in ${left}s`; b.disabled = true;
        K.toast('Reveal logged: Sara Malik');
        b._t = setInterval(() => {
          left -= 1; b.textContent = `Hides in ${left}s`;
          if (left <= 0) { clearInterval(b._t); b._t = null; pw.textContent = '••••••••••'; b.textContent = 'Reveal'; b.disabled = false; }
        }, 1000);
      }));
      sc.querySelectorAll('[data-goto]').forEach(a => a.addEventListener('click', e => {
        e.preventDefault(); const t = sc.querySelector(`[data-tabs="cl"] [data-tab="${a.dataset.goto}"]`); if (t) { t.click(); t.scrollIntoView({ block: 'nearest', inline: 'center' }); }
      }));
      const del = document.getElementById('client-dlg-delete');
      if (del) {
        const inp = del.querySelector('[data-confirm-name]'), btn = del.querySelector('button[type=submit]');
        btn.disabled = true; inp.addEventListener('input', () => { btn.disabled = inp.value.trim() !== 'Alba Motors'; });
      }
    },
  });

  /* =====================================================================
     3. RESPONSE TIMES
     ===================================================================== */
  const SLA = {
    7: { ontime: '91%', typical: '1h 12m', answered: '64', slowest: '9h 40m', ontimeSub: 'Target 90%' },
    30: { ontime: '87%', typical: '1h 35m', answered: '271', slowest: '1d 6h', ontimeSub: 'Target 90%' },
    90: { ontime: '84%', typical: '1h 52m', answered: '788', slowest: '2d 3h', ontimeSub: 'Target 90%' },
  };
  screen({
    id: 'response-times', title: 'Response times', group: 'Clients',
    render() {
      const d = SLA[30];
      const w = (cl, from, kind, waited, target, who, st) => [`<strong>${esc(cl)}</strong>`, from, kind, `<span class="num">${waited}</span>`, `<span class="num">${target}</span>`, `<div class="row" style="gap:6px">${avatar(who, 22)}${who}</div>`, st];
      return `<div class="page scr-sla">
<style>
.scr-sla .inbox-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px}
.scr-sla .inbox-grid>div{background:var(--surface-2);border-radius:var(--radius);padding:10px 12px}
.scr-sla .inbox-grid strong{font-size:20px;display:block}
.scr-sla .days{display:flex;flex-wrap:wrap;gap:10px}
</style>
<div class="between"><h1>Response times</h1><div class="row"><div class="seg" data-range>${[7, 30, 90].map(n => `<button type="button" data-v="${n}" class="${n === 30 ? 'on' : ''}">${n} days</button>`).join('')}</div><button class="btn" type="button" data-open="sla-dlg-targets">Targets and hours</button></div></div>
<div class="stats">
  ${stat('On time', d.ontime, d.ontimeSub, '', 'ontime')}
  ${stat('Typical answer', d.typical, 'Working hours', '', 'typical')}
  ${stat('Waiting now', 6, '2 past target')}
  ${stat('Waiting now late', 2, '1 past 2× target', 't-danger')}
  ${stat('Answered', d.answered, 'Client waits closed', '', 'answered')}
  ${stat('Slowest answer', d.slowest, 'Luma Skincare', 't-warn', 'slowest')}
</div>
<div class="tabs" data-tabs="sla"><button data-tab="wait" class="on">Waiting now</button><button data-tab="person">By person</button><button data-tab="client">By client</button><button data-tab="answered">Answered</button></div>
<section data-panel="sla:wait">${tbl(['Client', 'From', 'Kind', 'Waiting', 'Target', 'Needs answer from', 'State'], [
        w('Luma Skincare', 'Mia Torres', 'Request: new landing page copy', '7h 20m', '4h', 'Omar Haddad', tone('Past 2× target · manager alerted', 'danger')),
        w('Alba Motors', 'Rania Youssef', 'Comment on ALB-219', '2h 05m', '1h', 'Ayesha Khan', tone('Late', 'danger')),
        w('Zest Kitchen', 'Usman Tariq', 'Message in client chat', '48m', '1h', 'Ayesha Khan', tone('Due in 12m', 'warn')),
        w('Cedar & Pine Dental', 'Dr. Hala Mansour', 'Changes on blog draft', '1h 30m', '8h', 'Priya Nair', tone('On time', 'ok')),
        w('Nova Fitness', 'Jad Karam', 'Message in client chat', '22m', '1h', 'Zara Farooq', tone('On time', 'ok')),
        w('Harbor Legal', 'Tom Ellis', 'Request: add attorney bio page', '3h 10m', '8h', 'Daniel Reyes', tone('On time', 'ok')),
      ])}</section>
<section data-panel="sla:person" hidden>${tbl(['Person', 'Answered', 'On time', 'Typical answer', 'Late now'], [
        ['Ayesha Khan', 58, 92, '48m', 1], ['Omar Haddad', 64, 81, '2h 10m', 1], ['Zara Farooq', 47, 95, '35m', 0], ['Priya Nair', 39, 89, '1h 50m', 0],
        ['Daniel Reyes', 31, 77, '3h 05m', 0], ['Sara Malik', 22, 100, '20m', 0], ['Hamza Qureshi', 10, 90, '55m', 0],
      ].map(r => [`<div class="row" style="gap:6px">${avatar(r[0], 22)}${r[0]}</div>`, `<span class="num">${r[1]}</span>`, pct(r[2]), `<span class="num">${r[3]}</span>`, `<span class="num">${r[4]}</span>`]))}</section>
<section data-panel="sla:client" hidden>${tbl(['Client', 'Waits', 'On time', 'Typical answer', 'Slowest', 'Waiting now'], [
        ['Alba Motors', 72, 88, '52m', '9h 10m', 1], ['Luma Skincare', 49, 71, '2h 40m', '1d 6h', 1], ['Cedar & Pine Dental', 51, 94, '1h 15m', '7h 30m', 1],
        ['Harbor Legal', 33, 85, '2h 05m', '11h', 1], ['Nova Fitness', 41, 98, '30m', '3h 20m', 1], ['Zest Kitchen', 25, 92, '45m', '4h', 1],
      ].map(r => [`<strong>${esc(r[0])}</strong>`, `<span class="num">${r[1]}</span>`, pct(r[2]), `<span class="num">${r[3]}</span>`, `<span class="num">${r[4]}</span>`, `<span class="num">${r[5]}</span>`]))}</section>
<section data-panel="sla:answered" hidden>${tbl(['Client', 'Kind', 'Asked', 'Answered by', 'Took', 'Target', 'Result'], [
        ['Alba Motors', 'Message', 'Today 09:02', 'Ayesha Khan', '18m', '1h', tone('On time', 'ok')],
        ['Cedar & Pine Dental', 'Request', 'Yesterday 15:40', 'Omar Haddad', '2h 30m', '4h', tone('On time', 'ok')],
        ['Luma Skincare', 'Changes', 'Yesterday 11:15', 'Priya Nair', '9h 40m', '8h', tone('Late', 'danger')],
        ['Harbor Legal', 'Comment', '2 Nov 16:05', 'Daniel Reyes', '1h 10m', '1h', tone('Late', 'danger')],
        ['Nova Fitness', 'Message', '2 Nov 10:20', 'Zara Farooq', '12m', '1h', tone('On time', 'ok')],
        ['Zest Kitchen', 'Request', '1 Nov 13:00', 'Ayesha Khan', '3h 05m', '4h', tone('On time', 'ok')],
      ].map(r => [`<strong>${esc(r[0])}</strong>`, r[1], r[2], r[3], `<span class="num">${r[4]}</span>`, `<span class="num">${r[5]}</span>`, r[6]]))}</section>
${card(`Client email inboxes ${P2}`, `<p class="small muted" style="margin-top:0">clients@permanentseo.ae is checked every 10 minutes. Emails from client contacts start a wait or join a ticket. Last check 10:40.</p>
<div class="inbox-grid">${[['New tickets', 18], ['Added to tickets', 41], ['Not from a client', 9], ['Automatic', 27], ['From us', 52]].map(([k, v]) => `<div><span class="small muted">${k}</span><strong class="num">${v}</strong></div>`).join('')}</div>`, '<button class="btn sm" type="button" data-toast="Inbox check started (preview)">Check now</button>')}
${modal('sla-dlg-targets', 'Targets and hours', `<div class="form-grid">
  ${field('Reply to a message (hours)', '<input type="number" min="0.5" max="72" step="0.5" value="1">')}
  ${field('Answer a request (hours)', '<input type="number" min="0.5" max="72" step="0.5" value="4">')}
  ${field('Act on changes (hours)', '<input type="number" min="0.5" max="72" step="0.5" value="8">')}
  ${field('Time zone', sel(['Asia/Dubai (GMT+4)', 'Asia/Karachi (GMT+5)', 'Europe/London'], 'Asia/Dubai (GMT+4)'))}
  ${field('Day starts', '<input type="time" value="09:00">')}${field('Day ends', '<input type="time" value="18:00">')}
  <div class="field full"><label>Workdays</label><div class="days">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => chk(d, i < 5)).join('')}</div></div>
  <div class="field full"><label>Alerts</label>${chk('Alert the person who should answer when the target is reached', true)}${chk('Alert their manager at 2× the target', true)}${chk('Post late waits in #client-success each morning')}</div>
</div>`, 'Save targets')}
</div>`;
    },
    mount(root) {
      const sc = root.querySelector('.scr-sla'); if (!sc) return;
      const seg = sc.querySelector('[data-range]');
      seg.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
        const d = SLA[b.dataset.v]; Object.keys(d).forEach(k => { const el = sc.querySelector(`[data-k="${k}"]`); if (el) el.textContent = d[k]; });
      });
      sc.querySelectorAll('[data-toast]').forEach(b => b.addEventListener('click', () => K.toast(b.dataset.toast)));
    },
  });

  /* =====================================================================
     4. MEETINGS
     ===================================================================== */
  const CALLS = [
    {
      t: 'Alba x Permanent SEO monthly', c: 'Alba Motors', when: 'Tue 28 Oct, 15:00 · 41 min', who: ['Sara Malik', 'Ayesha Khan'], guests: 'Karim Alba, Rania Youssef',
      sum: 'October performance review. Leads are up, but the team lost two Patrol sales because lead emails arrived a day late. Karim wants to see Meta prove itself before Q1.',
      dec: ['Move AED 5,000 from Meta to Google Search for November.', 'Hold the SUV carousel until new creatives are ready.'],
      con: [['Lead emails late', 'We got the Patrol leads a day late, that cost us two sales.'], ['Meta value', "If Meta can't beat 200 a lead, I'd rather go Google only in Q1."]],
      acts: [['Fix lead email routing to the sales inbox', 'Daniel Reyes', 0], ['Make 6 new SUV creatives', 'Lina Saeed', 0], ['Send Motor Show stand dimensions', 'Rania Youssef', 1], ['Share Q4 price list', 'Rania Youssef', 1], ['Look into a TikTok test', 'Zara Farooq', 2]],
    },
    {
      t: 'Luma Q4 planning', c: 'Luma Skincare', when: 'Mon 3 Nov, 17:00 · 52 min', who: ['Hamza Qureshi', 'Omar Haddad'], guests: 'Mia Torres',
      sum: 'Mia is unhappy with Q3 ROAS and wants a clear plan before Black Friday. Agreed to focus spend on the two best-selling serums and fix product page speed.',
      dec: ['Black Friday budget capped at USD 6,000.', 'Pause the body-care line in ads until stock is back.'],
      con: [['Returns on ads', "Honestly we're paying for traffic that doesn't buy."]],
      acts: [['Speed up product pages (LCP under 2.5s)', 'Daniel Reyes', 0], ['Black Friday ad plan', 'Ayesha Khan', 0], ['Send stock dates for body-care line', 'Mia Torres', 1]],
    },
    {
      t: 'Nova Fitness content kickoff', c: 'Nova Fitness', when: 'Thu 30 Oct, 10:00 · 34 min', who: ['Hamza Qureshi', 'Zara Farooq'], guests: 'Jad Karam',
      sum: 'Kickoff for the November content calendar. Jad wants member stories and trainer reels, three a week.',
      dec: ['Three reels a week, Monday, Wednesday, Friday.'],
      con: [['Approvals', "I travel a lot, so approvals need to work from my phone."]],
      acts: [['Build November content calendar', 'Zara Farooq', 0], ['Send list of trainers for filming', 'Jad Karam', 1]],
    },
  ];
  const ACT_OPTS = ['Ticket', "Client's to-do", 'Skip'];
  const callCard = (c, i) => {
    const n = c.acts.filter(a => a[2] === 0).length;
    return `<div class="card call" data-owner="${esc(ownerOf(c.c))}" data-call="${i}"><div class="card-head"><h3>${esc(c.t)}</h3><span class="small muted">${esc(c.c)} · ${c.when}</span></div><div class="card-body stack" style="gap:12px">
  <div class="row small" style="gap:8px"><div class="avatars">${c.who.map(p => avatar(p, 22)).join('')}</div><span class="muted">with ${esc(c.guests)}</span></div>
  <p style="margin:0">${esc(c.sum)}</p>
  <div><h4>Decisions</h4><ul class="small" style="margin:4px 0 0;padding-left:18px">${c.dec.map(d => `<li>${esc(d)}</li>`).join('')}</ul></div>
  <div><h4>Concerns</h4>${c.con.map(([k, q]) => `<div class="small" style="margin-top:4px"><strong>${esc(k)}</strong><blockquote>"${esc(q)}"</blockquote></div>`).join('')}</div>
  <div><h4>Action items</h4><div class="list">${c.acts.map(([a, who, ch]) => `<div class="item act"><div class="stack" style="gap:2px;min-width:0"><span>${esc(a)}</span><span class="small muted">${esc(who)}</span></div><div class="seg sm" data-act>${ACT_OPTS.map((o, k) => `<button type="button" class="${k === ch ? 'on' : ''}" data-v="${k}">${o}</button>`).join('')}</div></div>`).join('')}</div></div>
  <div class="row between"><button class="btn ghost sm" type="button" data-toast="Summary refreshed">Read again</button><button class="btn primary" type="button" data-save>Create ${n} ticket${n === 1 ? '' : 's'} and save</button></div>
</div></div>`;
  };

  screen({
    id: 'meetings', title: 'Meetings', group: 'Clients',
    render() {
      const recent = [
        ['Alba x Permanent SEO monthly', 'Alba Motors', '28 Oct', '5 · 2 tickets, 2 to-dos, 1 skipped'], ['Cedar & Pine content review', 'Cedar & Pine Dental', '27 Oct', '3 · 3 tickets'],
        ['Harbor Legal site walkthrough', 'Harbor Legal', '24 Oct', '6 · 4 tickets, 2 to-dos'], ['Zest Kitchen menu launch ads', 'Zest Kitchen', '22 Oct', '2 · 1 ticket, 1 to-do'],
        ['Motor Show planning', 'Alba Motors', '16 Oct', '2 · 2 tickets'], ['Luma Q3 business review', 'Luma Skincare', '9 Oct', '4 · 3 tickets, 1 skipped'],
      ];
      return `<div class="page scr-meet">
<style>
.scr-meet .act{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
.scr-meet blockquote{margin:4px 0 0;padding:4px 10px;border-left:3px solid var(--line-2);color:var(--ink-2);font-style:italic}
.scr-meet h4{margin:0;font-size:13px}
.scr-meet .nc-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:space-between}
</style>
<div class="between"><h1>Meetings</h1><div class="row"><label class="check"><input type="checkbox" data-mine> Only my clients</label><button class="btn" type="button" data-toast="Importing from Fireflies (preview)">Import from Fireflies ${P2}</button><button class="btn primary" type="button" data-open="meet-dlg-log">Log meeting notes</button></div></div>
<div class="stats">${stat('To review', CALLS.length, 'Summaries waiting')}${stat('Calls this week', 6)}${stat('Open action items', 14, '5 are client to-dos')}${stat('No client yet', 2, '', 't-warn')}${stat('Tickets from calls, this month', 23)}</div>
<div class="tabs" data-tabs="meet"><button data-tab="review" class="on">To review</button><button data-tab="recent">Recent calls</button><button data-tab="noclient">No client</button></div>
<section data-panel="meet:review"><div class="stack" style="gap:16px">${CALLS.map(callCard).join('')}</div></section>
<section data-panel="meet:recent" hidden>${tbl(['Call', 'Client', 'When', 'Action items'], recent.map(r => [`<strong>${esc(r[0])}</strong>`, esc(r[1]), r[2], r[3]]), recent.map(r => `data-owner="${esc(ownerOf(r[1]))}"`))}</section>
<section data-panel="meet:noclient" hidden><div class="card"><div class="card-body list" data-nc>
  ${[['Weekly SEO standup', 'Mon 3 Nov · 20 min', 'omar@permanentseo.ae, priya@permanentseo.ae'], ['Intro call: Marina Bay Realty', 'Fri 31 Oct · 30 min', 'leen@marinabayrealty.ae']].map(([t, w, e]) => `<div class="item nc-row"><div class="stack" style="gap:2px"><strong>${t}</strong><span class="small muted">${w} · ${e}</span></div><div class="row">${sel(['Choose client', ...ALL.map(c => c.name)], 'Choose client', 'aria-label="Client"')}<button class="btn sm" type="button" data-assign>Assign</button><button class="btn sm ghost" type="button" data-notclient>Not a client call</button></div></div>`).join('')}
</div><div class="empty" hidden data-nc-empty>Every call has a client. Nothing to sort.</div></div></section>
${modal('meet-dlg-log', 'Log meeting notes', `<div class="form-grid">
  ${field('Client', sel(ALL.map(c => c.name), 'Alba Motors'))}${field('Date', '<input type="date" value="2026-11-04">')}
  ${field('Title', '<input placeholder="e.g. Monthly review">', true)}
  ${field('Summary', '<textarea rows="2"></textarea>', true)}${field('Decisions', '<textarea rows="2"></textarea>', true)}
  ${field('Concerns and quotes', '<textarea rows="2"></textarea>', true)}${field('Action items (one per line)', '<textarea rows="3"></textarea>', true)}
</div>`, 'Save and review actions')}
</div>`;
    },
    mount(root) {
      const sc = root.querySelector('.scr-meet'); if (!sc) return;
      sc.querySelectorAll('.call').forEach(card => {
        const save = card.querySelector('[data-save]');
        const count = () => { const n = [...card.querySelectorAll('[data-act] button.on')].filter(b => b.dataset.v === '0').length; save.textContent = `Create ${n} ticket${n === 1 ? '' : 's'} and save`; return n; };
        card.querySelectorAll('[data-act]').forEach(s => s.addEventListener('click', e => {
          const b = e.target.closest('button'); if (!b) return; s.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); count();
        }));
        save.addEventListener('click', () => { const n = count(); K.toast(`${n} ticket${n === 1 ? '' : 's'} created, notes saved`); card.remove(); });
      });
      sc.querySelector('[data-mine]').addEventListener('change', e => {
        sc.querySelectorAll('[data-owner]').forEach(el => { el.hidden = e.target.checked && el.dataset.owner !== ME.name; });
      });
      const nc = sc.querySelector('[data-nc]'), ncEmpty = sc.querySelector('[data-nc-empty]');
      const drop = (row, msg) => { row.remove(); K.toast(msg); if (!nc.querySelector('.item')) { nc.hidden = true; ncEmpty.hidden = false; } };
      nc.addEventListener('click', e => {
        const row = e.target.closest('.item'); if (!row) return;
        if (e.target.closest('[data-notclient]')) drop(row, 'Marked as not a client call');
        if (e.target.closest('[data-assign]')) { const s = row.querySelector('select'); if (s.selectedIndex === 0) { K.toast('Choose a client first'); return; } drop(row, `Assigned to ${s.value}`); }
      });
      sc.querySelectorAll('[data-toast]').forEach(b => b.addEventListener('click', () => K.toast(b.dataset.toast)));
    },
  });

  /* =====================================================================
     5. FILES
     ===================================================================== */
  const f = (n, v, size, by, date, shared) => ({ n, v, size, by, date, shared });
  const FILES = {
    'Alba Motors': {
      'Brand assets': [f('Alba logo pack.zip', 2, '18.4 MB', 'Lina Saeed', '12 Mar', 1), f('Alba brand guide 2026.pdf', 1, '6.2 MB', 'Rania Youssef', '8 Jan', 1), f('Signed agreement 2025.pdf', 2, '820 KB', 'Sara Malik', '1 Feb 2025', 1), f('Showroom photos SZR.zip', 1, '142 MB', 'Lina Saeed', '20 Sep', 0)],
      'From the client': [f('Q4 price list.xlsx', 1, '96 KB', 'Rania Youssef', '1 Nov', 1), f('Motor Show stand plan.pdf', 1, '2.1 MB', 'Rania Youssef', '30 Oct', 1), f('Dealer co-op rules.pdf', 3, '1.4 MB', 'Karim Alba', '14 Aug', 1)],
      'Campaign creatives': [f('Motor Show landing page.fig', 3, '24 MB', 'Lina Saeed', '3 Nov', 0), f('SUV reels November.mp4', 2, '88 MB', 'Zara Farooq', '2 Nov', 0), f('Patrol search ads copy.docx', 4, '42 KB', 'Ayesha Khan', '29 Oct', 1)],
    },
    'Cedar & Pine Dental': {
      'Brand assets': [f('Cedar & Pine logo.svg', 1, '22 KB', 'Lina Saeed', '15 Mar 2024', 1), f('Clinic photography.zip', 2, '96 MB', 'Dr. Hala Mansour', '10 Jun', 1)],
      'From the client': [f('Treatment price list 2026.pdf', 2, '310 KB', 'Dr. Hala Mansour', '6 Oct', 1)],
      'Blog drafts': [f('Invisalign vs braces.docx', 3, '58 KB', 'Priya Nair', '3 Nov', 1), f('Teeth whitening myths.docx', 1, '44 KB', 'Priya Nair', '31 Oct', 0)],
    },
    'Luma Skincare': {
      'Brand assets': [f('Luma brand book.pdf', 1, '12 MB', 'Mia Torres', '2 Jan', 1), f('Product packshots.zip', 4, '210 MB', 'Lina Saeed', '18 Oct', 1)],
      'From the client': [f('Black Friday offers.xlsx', 1, '64 KB', 'Mia Torres', '3 Nov', 1), f('Stock forecast Q4.xlsx', 2, '120 KB', 'Mia Torres', '28 Oct', 1)],
    },
    'Harbor Legal': {
      'Brand assets': [f('Harbor logo pack.zip', 1, '4.8 MB', 'Daniel Reyes', '4 Apr', 1)],
      'From the client': [f('Attorney bios.docx', 2, '88 KB', 'Tom Ellis', '2 Nov', 1), f('Practice areas copy.docx', 1, '51 KB', 'Tom Ellis', '20 Oct', 1)],
      'Website build': [f('Sitemap v4.pdf', 4, '380 KB', 'Daniel Reyes', '1 Nov', 1), f('Homepage design.fig', 6, '31 MB', 'Lina Saeed', '30 Oct', 0)],
    },
    'Nova Fitness': { 'Brand assets': [f('Nova logo.png', 1, '340 KB', 'Jad Karam', '20 Oct', 1)], 'From the client': [f('Trainer list.xlsx', 1, '28 KB', 'Jad Karam', '31 Oct', 1)] },
    'Zest Kitchen': { 'Brand assets': [f('Zest menu photos.zip', 1, '64 MB', 'Usman Tariq', '5 Sep', 1)], 'From the client': [f('Winter menu.pdf', 1, '2.3 MB', 'Usman Tariq', '1 Nov', 1)] },
    'Qamar Interiors': { 'Brand assets': [], 'From the client': [] },
  };
  const BRAND = {
    'Alba Motors': { colours: [['Alba red', '#c8102e'], ['Charcoal', '#2b2b2b'], ['Silver', '#c0c4c8']], fonts: 'Montserrat for headings, Open Sans for body', tone: 'Confident, helpful, never pushy. Prices always include VAT.', dos: ['Show real showroom staff', 'Lead with the monthly payment', 'Arabic and English on every ad'], donts: ['No competitor names', 'No "cheapest" claims', 'No old logo (pre-2024)'] },
    'Cedar & Pine Dental': { colours: [['Pine green', '#2f5d50'], ['Cedar', '#a0522d'], ['Cream', '#f5f0e6']], fonts: 'Lora for headings, Inter for body', tone: 'Calm, reassuring, plain English. No scare tactics.', dos: ['Real patients with consent', 'Mention DHA licence'], donts: ['No before/after without consent', 'No discounts on treatments'] },
  };
  const allFiles = () => { const out = []; Object.entries(FILES).forEach(([c, fs]) => Object.entries(fs).forEach(([fo, arr]) => arr.forEach(x => out.push(Object.assign({ c, fo }, x))))); return out; };
  const fileRows = (client, folder) => {
    const arr = (FILES[client] || {})[folder] || [];
    if (!arr.length) return `<tr><td colspan="7"><div class="empty">No files in this folder yet. Drop files below to add them.</div></td></tr>`;
    return arr.map(x => `<tr data-file="${esc(x.n)}"><td><strong>${esc(x.n)}</strong></td><td><button class="btn sm ghost" type="button" data-open="files-dlg-versions" data-hist="${esc(x.n)}">v${x.v}</button></td><td class="num hide-sm">${x.size}</td><td class="hide-sm">${esc(x.by)}</td><td>${x.date}</td><td data-sees>${yes(x.shared)}</td><td><div class="row" style="gap:4px;flex-wrap:nowrap"><button class="btn sm ghost" type="button" data-fa="download">Download</button><button class="btn sm ghost" type="button" data-fa="share">${x.shared ? 'Unshare' : 'Share'}</button><button class="btn sm ghost" type="button" data-open="files-dlg-move">Move</button><button class="btn sm ghost" type="button" data-open="files-dlg-rename">Rename</button><button class="btn sm ghost" type="button" data-fa="remove">Remove</button></div></td></tr>`).join('');
  };
  const folderList = (client, cur) => Object.keys(FILES[client]).map(fo => `<button type="button" class="folder ${fo === cur ? 'on' : ''}" data-folder="${esc(fo)}"><span>${esc(fo)}</span><span class="num muted small">${FILES[client][fo].length}</span></button>`).join('') + `<div class="folder static"><span>Google Drive ${P2}</span><span class="small muted">read-only</span></div>`;
  const brandKit = client => {
    const b = BRAND[client];
    if (!b) return `<div class="empty">No brand kit for ${esc(client)} yet. <button class="btn sm" type="button" data-open="files-dlg-brand">Start brand kit</button></div>`;
    return `<div class="stack" style="gap:12px">
  <div><h4>Colours</h4><div class="row" style="gap:14px">${b.colours.map(([n, h]) => `<label class="row small" style="gap:6px"><input type="color" value="${h}" disabled aria-label="${esc(n)}">${esc(n)} <span class="muted num">${h}</span></label>`).join('')}</div></div>
  <div><h4>Fonts</h4><p class="small" style="margin:2px 0 0">${esc(b.fonts)}</p></div>
  <div><h4>Tone</h4><p class="small" style="margin:2px 0 0">${esc(b.tone)}</p></div>
  <div class="grid-2"><div><h4>Do</h4><ul class="small" style="margin:4px 0 0;padding-left:18px">${b.dos.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div><div><h4>Don't</h4><ul class="small" style="margin:4px 0 0;padding-left:18px">${b.donts.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div>
  <div><h4>Links and audience ${P2}</h4><p class="small" style="margin:2px 0 0">Brand guide in Brand assets · Audience: UAE families and young professionals, 25 to 45, Arabic and English.</p></div>
</div>`;
  };

  screen({
    id: 'files', title: 'Files', group: 'Clients',
    render() {
      const c0 = 'Alba Motors', f0 = 'Brand assets';
      return `<div class="page scr-files">
<style>
.scr-files .fl-wrap{display:grid;grid-template-columns:220px 1fr;gap:16px;align-items:start}
@media (max-width:900px){.scr-files .fl-wrap{grid-template-columns:1fr}}
.scr-files .folders{display:flex;flex-direction:column;gap:2px}
.scr-files .folder{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 10px;border:0;background:none;color:var(--ink);border-radius:var(--radius);text-align:left;cursor:pointer;font:inherit}
.scr-files .folder:hover{background:var(--surface-2)}
.scr-files .folder.on{background:var(--accent-soft);color:var(--accent-ink);font-weight:600}
.scr-files .folder.static{cursor:default;color:var(--ink-2)}
.scr-files .drop{border:2px dashed var(--line-2);border-radius:var(--radius);padding:22px;text-align:center;color:var(--ink-2);transition:border-color .15s, background .15s}
.scr-files .drop.over{border-color:var(--accent);background:var(--accent-soft)}
.scr-files .results .item{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap}
.scr-files h4{margin:0;font-size:13px}
</style>
<div class="between"><h1>Files</h1><div class="row"><button class="btn" type="button" data-open="files-dlg-folder">New folder</button><button class="btn primary" type="button" data-upload>Upload files</button></div></div>
<div class="card"><div class="card-body stack">
  <input type="search" placeholder="Search files across all clients" data-fsearch aria-label="Search files across all clients">
  <div data-fresults><p class="small muted" style="margin:0">Type 2 or more characters to search every client's files.</p></div>
</div></div>
<div class="fl-wrap">
  <div class="card"><div class="card-body stack">
    ${sel(Object.keys(FILES), c0, 'data-fclient aria-label="Client"')}
    <div class="folders" data-folders>${folderList(c0, f0)}</div>
  </div></div>
  <div class="stack" style="gap:16px">
    <div class="card"><div class="card-head"><h3 data-ftitle>${esc(c0)} · ${esc(f0)}</h3></div><div class="card-body">
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Name</th><th>Version</th><th class="hide-sm">Size</th><th class="hide-sm">Uploaded by</th><th>Date</th><th>Client sees it</th><th>Actions</th></tr></thead><tbody data-ftbody>${fileRows(c0, f0)}</tbody></table></div>
      <div class="drop" data-drop style="margin-top:12px">Drop files here to upload. Uploading a file with the same name adds a new version.</div>
    </div></div>
    <div class="card"><div class="card-head"><h3 data-btitle>Brand kit: ${esc(c0)}</h3><button class="btn sm" type="button" data-open="files-dlg-brand">Edit brand kit</button></div><div class="card-body" data-brand>${brandKit(c0)}</div></div>
  </div>
</div>
${modal('files-dlg-versions', 'Version history', `<p class="small muted" style="margin-top:0" data-hname>Motor Show landing page.fig</p>${tbl(['Version', 'Uploaded by', 'Date', 'Size', ''], [
        ['v3 (current)', 'Lina Saeed', '3 Nov 2026, 16:20', '24 MB', '<button class="btn sm ghost" type="button" data-close>Download</button>'],
        ['v2', 'Lina Saeed', '31 Oct 2026, 11:05', '22 MB', '<button class="btn sm ghost" type="button" data-close>Restore</button>'],
        ['v1', 'Lina Saeed', '27 Oct 2026, 09:40', '19 MB', '<button class="btn sm ghost" type="button" data-close>Restore</button>'],
      ])}`, 'Done')}
${modal('files-dlg-move', 'Move file', `<div class="form-grid">${field('Client', sel(Object.keys(FILES), c0))}${field('Folder', sel(['Brand assets', 'From the client', 'Campaign creatives'], 'Campaign creatives'))}</div>`, 'Move')}
${modal('files-dlg-rename', 'Rename file', field('New name', '<input value="Motor Show landing page final.fig">', true), 'Rename')}
${modal('files-dlg-folder', 'New folder', `<div class="form-grid">${field('Client', sel(Object.keys(FILES), c0))}${field('Folder name', '<input placeholder="e.g. Ramadan 2027">')}<div class="field full">${chk('Client can see this folder', true)}</div></div>`, 'Create folder')}
${modal('files-dlg-brand', 'Edit brand kit', `<div class="form-grid">${field('Colours (name and hex, one per line)', '<textarea rows="3">Alba red #c8102e\nCharcoal #2b2b2b\nSilver #c0c4c8</textarea>', true)}${field('Fonts', '<input value="Montserrat for headings, Open Sans for body">', true)}${field('Tone', '<textarea rows="2">Confident, helpful, never pushy.</textarea>', true)}${field("Do's", '<textarea rows="3"></textarea>')}${field("Don'ts", '<textarea rows="3"></textarea>')}</div>`, 'Save brand kit')}
</div>`;
    },
    mount(root) {
      const sc = root.querySelector('.scr-files'); if (!sc) return;
      const st = { c: 'Alba Motors', fo: 'Brand assets' };
      const body = sc.querySelector('[data-ftbody]'), folders = sc.querySelector('[data-folders]');
      const draw = () => {
        body.innerHTML = fileRows(st.c, st.fo); folders.innerHTML = folderList(st.c, st.fo);
        sc.querySelector('[data-ftitle]').textContent = `${st.c} · ${st.fo}`;
        sc.querySelector('[data-btitle]').textContent = `Brand kit: ${st.c}`; sc.querySelector('[data-brand]').innerHTML = brandKit(st.c);
      };
      sc.querySelector('[data-fclient]').addEventListener('change', e => { st.c = e.target.value; st.fo = 'Brand assets'; draw(); });
      folders.addEventListener('click', e => { const b = e.target.closest('[data-folder]'); if (!b) return; st.fo = b.dataset.folder; draw(); });
      body.addEventListener('click', e => {
        const tr = e.target.closest('tr'); if (!tr) return; const name = tr.dataset.file;
        const h = e.target.closest('[data-hist]'); if (h) { const p = document.querySelector('#files-dlg-versions [data-hname]'); if (p) p.textContent = h.dataset.hist; }
        const a = e.target.closest('[data-fa]'); if (!a) return;
        const item = (FILES[st.c][st.fo] || []).find(x => x.n === name);
        if (a.dataset.fa === 'download') K.toast(`Downloading ${name}`);
        if (a.dataset.fa === 'share' && item) { item.shared = !item.shared; tr.querySelector('[data-sees]').textContent = yes(item.shared); a.textContent = item.shared ? 'Unshare' : 'Share'; K.toast(item.shared ? `${st.c} can now see ${name}` : `${name} hidden from ${st.c}`); }
        if (a.dataset.fa === 'remove') { FILES[st.c][st.fo] = FILES[st.c][st.fo].filter(x => x.n !== name); draw(); K.toast(`${name} removed`); }
      });
      const q = sc.querySelector('[data-fsearch]'), res = sc.querySelector('[data-fresults]');
      q.addEventListener('input', () => {
        const v = q.value.trim().toLowerCase();
        if (v.length < 2) { res.innerHTML = '<p class="small muted" style="margin:0">Type 2 or more characters to search every client\'s files.</p>'; return; }
        const hits = allFiles().filter(x => x.n.toLowerCase().includes(v) || x.c.toLowerCase().includes(v));
        res.innerHTML = hits.length ? `<div class="list results">${hits.slice(0, 12).map(x => `<div class="item"><strong>${esc(x.n)}</strong><span class="small muted">${esc(x.c)} · ${esc(x.fo)} · v${x.v} · ${x.date}</span></div>`).join('')}</div><p class="small muted">${hits.length} file${hits.length === 1 ? '' : 's'} found</p>` : `<div class="empty">No files match "${esc(q.value)}".</div>`;
      });
      const drop = sc.querySelector('[data-drop]');
      drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
      drop.addEventListener('dragleave', () => drop.classList.remove('over'));
      drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); const n = (e.dataTransfer && e.dataTransfer.files.length) || 1; K.toast(`${n} file${n === 1 ? '' : 's'} uploaded to ${st.fo} (preview)`); });
      sc.querySelector('[data-upload]').addEventListener('click', () => K.toast(`Choose files to upload to ${st.c} · ${st.fo} (preview)`));
    },
  });
})();

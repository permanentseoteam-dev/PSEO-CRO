/* Team + Personal screens: directory, org-chart, performance, profile, time, prefs */
(function () {
  const { screen, esc, avatar, tone, money, PEOPLE, CLIENTS, ME, toast } = K;

  /* ---------- shared sample data ---------- */
  const X = {
    m1: { st: 'Available', note: 'In the office today', inn: true, skills: ['Account management', 'Client onboarding', 'Reporting'], mgr: 'm10', phone: '+971 50 214 7781', joined: '2023-03-12', shift: '09:00 to 18:00 GST' },
    m2: { st: 'Focus', note: 'Luma audit till 2pm', inn: true, skills: ['Technical SEO', 'Link building', 'Search Console'], mgr: 'm10', phone: '+971 55 310 4420', joined: '2022-09-01', shift: '09:00 to 18:00 GST' },
    m3: { st: 'Meeting', note: 'Alba Motors weekly call', inn: true, skills: ['Google Ads', 'Meta Ads', 'GA4'], mgr: 'm2', phone: '+971 52 118 9034', joined: '2024-01-15', shift: '09:00 to 18:00 GST' },
    m4: { st: 'Available', note: 'Harbor site QA', inn: true, skills: ['WordPress', 'Elementor', 'Core Web Vitals'], mgr: 'm2', phone: '+92 300 455 1290', joined: '2023-11-06', shift: '10:00 to 19:00 PKT' },
    m5: { st: 'Away', note: 'Lunch, back 2:30', inn: true, skills: ['Blog writing', 'On-page SEO', 'Arabic copy'], mgr: 'm2', phone: '+971 56 702 3318', joined: '2024-05-20', shift: '09:00 to 18:00 GST' },
    m6: { st: 'Available', note: 'Month-end close', inn: true, skills: ['Invoicing', 'Payroll', 'Xero'], mgr: 'm10', phone: '+971 50 889 1402', joined: '2022-04-03', shift: '09:00 to 18:00 GST' },
    m7: { st: 'Sick', note: 'Back Thursday', inn: false, skills: ['Figma', 'Brand design', 'Ad creatives'], mgr: null, phone: '+971 58 220 6671', joined: '2025-02-10', shift: '09:00 to 18:00 GST' },
    m8: { st: 'Meeting', note: 'Cedar & Pine onboarding', inn: true, skills: ['Proposals', 'HubSpot', 'Upsells'], mgr: 'm1', phone: '+971 54 671 0095', joined: '2025-06-01', shift: '09:00 to 18:00 GST' },
    m9: { st: 'Off', note: 'Annual leave till 9 Nov', inn: false, skills: ['Instagram', 'TikTok', 'Content calendars'], mgr: 'm1', phone: '+971 55 903 7712', joined: '2024-08-19', shift: '09:00 to 18:00 GST' },
    m10: { st: 'Available', note: 'Board prep from home', inn: false, skills: ['Strategy', 'Sales', 'Hiring'], mgr: null, phone: '+971 50 100 2020', joined: '2021-01-04', shift: 'Flexible' },
  };
  const ROOT = 'm10';
  const UNPLACED = [
    { name: 'Lina Saeed', title: 'Designer', dept: 'Design', why: 'No manager set' },
    { name: 'Noor Hassan', title: 'Junior SEO Executive', dept: 'SEO', why: 'Joined 2 Nov' },
    { name: 'Faisal Raza', title: 'Video Editor', dept: 'Design', why: 'Joined 27 Oct' },
  ];
  const STT = { Available: 'ok', Meeting: 'violet', Focus: 'blue', Away: 'warn', Sick: 'danger', Off: 'muted' };
  const DOTC = { ok: '--ok', violet: '--violet', blue: '--blue', warn: '--warn', danger: '--danger', muted: '--ink-3' };
  const email = p => p.name.split(' ')[0].toLowerCase() + '@permanentseo.ae';
  const st = s => tone(s, STT[s] || 'muted');
  const adot = (name, size, s) => `<span class="adot">${avatar(name, size)}<i style="background:var(${DOTC[STT[s] || 'muted']})" title="${esc(s)}"></i></span>`;
  const fmt = m => { m = Math.round(m || 0); if (!m) return '–'; const h = Math.floor(m / 60), r = m % 60; return (h ? h + 'h' : '') + (h && r ? ' ' : '') + (r ? r + 'm' : ''); };
  const parse = s => { s = String(s || '').trim().toLowerCase(); if (!s || s === '–') return 0; if (/^\d+(\.\d+)?$/.test(s)) return Math.round(parseFloat(s) * 60); const h = s.match(/(\d+(?:\.\d+)?)\s*h/), m = s.match(/(\d+)\s*m/); return Math.round((h ? parseFloat(h[1]) * 60 : 0) + (m ? +m[1] : 0)); };
  const band = s => (s >= 80 ? 'ok' : s >= 60 ? 'warn' : 'danger');
  const bar = (pct, t) => `<div class="bar${t ? ' t-' + t : ''}"><i style="width:${Math.max(0, Math.min(100, pct))}%"></i></div>`;
  const fld = (label, input, full) => `<div class="field${full ? ' full' : ''}"><label>${label}</label>${input}</div>`;
  const opts = (arr, sel) => arr.map(o => `<option${o === sel ? ' selected' : ''}>${esc(o)}</option>`).join('');
  const dlg = (id, title, body, submit = 'Save') => `<dialog id="${id}" class="modal"><form method="dialog"><div class="modal-head"><h3>${title}</h3><button type="button" class="icon-btn" data-close aria-label="Close">✕</button></div><div class="modal-body">${body}</div><div class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">${submit}</button></div></form></dialog>`;
  const P2 = ' <span class="p2">phase 2</span>';
  const byId = id => PEOPLE.find(p => p.id === id);
  const fdate = d => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const BASE_CSS = `.adot{position:relative;display:inline-flex;flex:none}.adot>i{position:absolute;right:0;bottom:0;width:11px;height:11px;border-radius:50%;border:2px solid var(--surface)}`;

  /* ================= DIRECTORY ================= */
  screen({
    id: 'directory', title: 'Team directory', group: 'Team',
    render() {
      const depts = [...new Set(PEOPLE.map(p => p.dept))].sort();
      const inCount = PEOPLE.filter(p => X[p.id].inn).length;
      const cards = PEOPLE.map(p => {
        const x = X[p.id];
        return `<a href="#profile" class="card dcard" data-dept="${esc(p.dept)}" data-q="${esc((p.name + ' ' + p.title + ' ' + x.skills.join(' ')).toLowerCase())}">
          ${adot(p.name, 48, x.st)}
          <div class="dinfo"><b>${esc(p.name)}</b><div class="small">${esc(p.title)}</div><div class="small muted">${esc(p.dept)}</div>
          <div class="small dst">${st(x.st)} <span class="muted">${esc(x.note)}</span></div>
          <div class="small muted">${x.inn ? 'Clocked in' : 'Not clocked in'}</div></div></a>`;
      }).join('');
      return `<div class="page scr-team"><style>${BASE_CSS}
        .scr-team .dgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px}
        .scr-team .dcard{display:flex;gap:12px;padding:16px;color:inherit;text-decoration:none;align-items:flex-start}
        .scr-team .dcard:hover{border-color:var(--line-2);box-shadow:var(--shadow)}
        .scr-team .dinfo{display:flex;flex-direction:column;gap:2px;min-width:0}
        .scr-team .dst{margin-top:6px;display:flex;flex-wrap:wrap;gap:6px}
        .scr-team .toolbar input{min-width:220px;flex:1;max-width:340px}
        .scr-team .seg{overflow-x:auto;max-width:100%}
        .scr-team .incount b{color:var(--accent)}</style>
        <div class="row between"><h2 class="incount"><b>${inCount}</b> clocked in</h2><span class="muted small">${PEOPLE.length} people</span></div>
        <div class="toolbar row">
          <div class="seg" role="group" aria-label="Department"><button class="on" data-dept="">All</button>${depts.map(d => `<button data-dept="${esc(d)}">${esc(d)}</button>`).join('')}</div>
          <input type="search" id="dir-q" placeholder="Search name, title or skill" aria-label="Search people">
        </div>
        <div class="dgrid" id="dir-grid">${cards}</div>
        <div class="empty" id="dir-empty" hidden>No one matches. Try another department or search.</div>
      </div>`;
    },
    mount(root) {
      let dept = '';
      const q = root.querySelector('#dir-q');
      const apply = () => {
        const s = q.value.trim().toLowerCase(); let n = 0;
        root.querySelectorAll('.dcard').forEach(c => { const ok = (!dept || c.dataset.dept === dept) && (!s || c.dataset.q.includes(s)); c.hidden = !ok; if (ok) n++; });
        root.querySelector('#dir-empty').hidden = n > 0;
      };
      root.querySelector('.scr-team .seg').addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        dept = b.dataset.dept; b.parentNode.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); apply();
      });
      q.addEventListener('input', apply);
    },
  });

  /* ================= ORG CHART ================= */
  const kidsOf = id => PEOPLE.filter(p => X[p.id].mgr === id && p.id !== id);
  function teamSize(id, seen = new Set()) { if (seen.has(id)) return 0; seen.add(id); return kidsOf(id).reduce((a, k) => a + (seen.has(k.id) ? 0 : 1 + teamSize(k.id, seen)), 0); }
  function orgNode(p, seen) {
    if (seen.has(p.id)) return ''; seen.add(p.id);
    const kids = kidsOf(p.id).filter(k => !seen.has(k.id));
    const size = teamSize(p.id);
    return `<li data-name="${esc((p.name + ' ' + p.title + ' ' + p.dept).toLowerCase())}">
      <div class="onode">${kids.length ? `<button class="icon-btn otog" aria-expanded="true" aria-label="Fold ${esc(p.name)}'s team">▾</button>` : '<span class="osp"></span>'}
      ${adot(p.name, 36, X[p.id].st)}<div class="ometa"><b>${esc(p.name)}</b><div class="small muted">${esc(p.title)} · ${esc(p.dept)}</div></div>
      ${size ? `<span class="small muted osize">${size} in team</span>` : ''}</div>
      ${kids.length ? `<ul>${kids.map(k => orgNode(k, seen)).join('')}</ul>` : ''}</li>`;
  }
  screen({
    id: 'org-chart', title: 'Org chart', group: 'Team',
    render() {
      const tree = orgNode(byId(ROOT), new Set());
      return `<div class="page scr-org"><style>${BASE_CSS}
        .scr-org .layout{display:grid;grid-template-columns:1fr 300px;gap:20px;align-items:start}
        @media (max-width:900px){.scr-org .layout{grid-template-columns:1fr}}
        .scr-org ul{list-style:none;margin:0;padding:0}
        .scr-org ul ul{margin-left:22px;padding-left:14px;border-left:1px solid var(--line)}
        .scr-org li{margin:6px 0}
        .scr-org li.closed>ul{display:none}
        .scr-org .onode{display:flex;align-items:center;gap:10px;padding:8px 10px;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);max-width:460px}
        .scr-org .onode.hit{border-color:var(--accent);background:var(--accent-soft)}
        .scr-org .ometa{min-width:0;flex:1}
        .scr-org .osize{white-space:nowrap}
        .scr-org .osp{width:28px;flex:none}
        .scr-org .otog{transition:transform .15s}
        .scr-org li.closed>.onode .otog{transform:rotate(-90deg)}
        .scr-org .tree-wrap{overflow-x:auto}
        .scr-org #org-q{flex:1;min-width:200px;max-width:320px}</style>
        <div class="toolbar row">
          <input type="search" id="org-q" placeholder="Find someone" aria-label="Find someone">
          <span class="small muted" id="org-hits"></span>
          <span style="flex:1"></span>
          <button class="btn sm ghost" id="org-open">Expand all</button><button class="btn sm ghost" id="org-close">Collapse all</button>
        </div>
        <div class="layout">
          <div class="card"><div class="card-body tree-wrap"><ul id="org-tree">${tree}</ul></div></div>
          <div class="card"><div class="card-head"><h3>Not placed yet</h3><span class="small muted">${UNPLACED.length}</span></div>
            <div class="list">${UNPLACED.map(u => `<div class="item row between"><div class="row">${avatar(u.name, 32)}<div><b>${esc(u.name)}</b><div class="small muted">${esc(u.title)} · ${esc(u.why)}</div></div></div><button class="btn sm" data-open="org-place">Place</button></div>`).join('')}</div></div>
        </div>
        ${dlg('org-place', 'Place in the org chart', `<div class="form-grid">
          ${fld('Person', `<select>${opts(UNPLACED.map(u => u.name))}</select>`)}
          ${fld('Reports to', `<select>${opts(PEOPLE.map(p => p.name), 'Omar Haddad')}</select>`)}
          ${fld('Title', '<input value="Designer">', true)}</div>`, 'Place person')}
      </div>`;
    },
    mount(root) {
      const tree = root.querySelector('#org-tree');
      tree.addEventListener('click', e => {
        const b = e.target.closest('.otog'); if (!b) return;
        const li = b.closest('li'); const closed = li.classList.toggle('closed'); b.setAttribute('aria-expanded', String(!closed));
      });
      const setAll = closed => tree.querySelectorAll('li').forEach(li => { if (li.querySelector(':scope>ul')) { li.classList.toggle('closed', closed); const b = li.querySelector(':scope>.onode .otog'); if (b) b.setAttribute('aria-expanded', String(!closed)); } });
      root.querySelector('#org-open').onclick = () => setAll(false);
      root.querySelector('#org-close').onclick = () => setAll(true);
      const q = root.querySelector('#org-q'), hits = root.querySelector('#org-hits');
      q.addEventListener('input', () => {
        const s = q.value.trim().toLowerCase();
        tree.querySelectorAll('.onode.hit').forEach(n => n.classList.remove('hit'));
        if (!s) { hits.textContent = ''; return; }
        const found = [...tree.querySelectorAll('li')].filter(li => li.dataset.name.includes(s));
        found.forEach(li => {
          li.querySelector(':scope>.onode').classList.add('hit');
          let p = li.parentElement.closest('li');
          while (p) { p.classList.remove('closed'); const b = p.querySelector(':scope>.onode .otog'); if (b) b.setAttribute('aria-expanded', 'true'); p = p.parentElement.closest('li'); }
        });
        hits.textContent = found.length ? `${found.length} found` : 'No one found';
        if (found[0]) found[0].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      });
    },
  });

  /* ================= PERFORMANCE ================= */
  const KPIS = [
    { k: 'On-time delivery', now: 92, tgt: 95, unit: '%', score: 86 },
    { k: 'Average client health', now: 67, tgt: 75, unit: '', score: 72 },
    { k: 'Replies within SLA', now: 88, tgt: 90, unit: '%', score: 90 },
    { k: 'Upsells closed', now: 2, tgt: 3, unit: '', score: 67 },
    { k: 'First-time-right reviews', now: 81, tgt: 85, unit: '%', score: 75 },
  ];
  const QSCORE = { 'Q4 2026': 78, 'Q3 2026': 83, 'Q2 2026': 71, 'Q1 2026': 58 };
  const TEAMPERF = [
    { n: 'Hamza Qureshi', s: 84, okr: '3 of 3 on track', tr: '2 of 3 paths', rv: ['Shared', 'blue'] },
    { n: 'Zara Farooq', s: 71, okr: '2 of 3 on track', tr: '1 of 2 paths', rv: ['Self-review due', 'warn'] },
    { n: 'Omar Haddad', s: 88, okr: '4 of 4 on track', tr: '3 of 3 paths', rv: ['Acknowledged', 'ok'] },
    { n: 'Ayesha Khan', s: 76, okr: '2 of 3 on track', tr: '2 of 2 paths', rv: ['Manager review', 'violet'] },
    { n: 'Priya Nair', s: 63, okr: '1 of 3 on track', tr: '1 of 3 paths', rv: ['Self-review due', 'warn'] },
    { n: 'Daniel Reyes', s: 54, okr: '1 of 2 on track', tr: '0 of 2 paths', rv: ['Manager review', 'violet'] },
  ];
  const CONF = { 'On track': 'ok', 'At risk': 'warn', 'Off track': 'danger' };
  const OKRS = [
    { o: 'Keep every client healthy through Q4', owner: 'Sara Malik', krs: [['Average health score from 64 to 75', 67, 'At risk'], ['No client below 50 for more than 2 weeks', 80, 'On track'], ['Monthly report sent by the 5th for all 6 clients', 100, 'On track']] },
    { o: 'Grow revenue from existing clients', owner: 'Sara Malik', krs: [['Close 3 upsells', 67, 'On track'], ['Renew Alba Motors for 12 months', 40, 'At risk'], ['Add Content to 2 SEO-only clients', 0, 'Off track']] },
    { o: 'Answer clients faster', owner: 'Hamza Qureshi', krs: [['90% of replies within 4 working hours', 88, 'On track'], ['Typical answer under 2h', 75, 'On track']] },
  ];
  const PATHS = [
    { n: 'Account manager to senior', steps: [['Course', 'Running client QBRs', 'Done'], ['Video', 'Handling an unhappy client', 'Done'], ['Reading', 'The Trusted Advisor, ch. 1–4', 'Done'], ['Practice', 'Lead the Luma health-check call', 'Next'], ['Certification', 'HubSpot Inbound', 'Not started']] },
    { n: 'SEO basics for client success', steps: [['Course', 'How Google ranks pages', 'Done'], ['Reading', 'Reading a Search Console report', 'Next'], ['Practice', 'Explain a ranking drop to a client', 'Not started']] },
  ];
  const stepTone = s => (s === 'Done' ? 'ok' : s === 'Next' ? 'blue' : 'muted');

  screen({
    id: 'performance', title: 'Performance', group: 'Team',
    render() {
      const q = 78;
      return `<div class="page scr-perf"><style>
        .scr-perf .qscore{font-size:40px;font-weight:700;line-height:1}
        .scr-perf .qscore.t-ok{color:var(--ok)}.scr-perf .qscore.t-warn{color:var(--warn)}.scr-perf .qscore.t-danger{color:var(--danger)}
        .scr-perf .sc{display:flex;align-items:center;gap:8px;min-width:140px}.scr-perf .sc .bar{flex:1}
        .scr-perf .kr{display:grid;grid-template-columns:1fr 140px 110px;gap:12px;align-items:center;padding:10px 0;border-top:1px solid var(--line)}
        @media (max-width:640px){.scr-perf .kr{grid-template-columns:1fr}}
        .scr-perf .steps{list-style:none;margin:0;padding:0}
        .scr-perf .steps li{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-top:1px solid var(--line)}</style>
        <div class="row between">
          <div class="row"><label for="perf-q" class="muted">Quarter</label><select id="perf-q">${opts(Object.keys(QSCORE), 'Q4 2026')}</select></div>
          <button class="btn primary" data-open="perf-self">Write self-review</button>
        </div>
        <div class="tabs" data-tabs="perf"><button data-tab="growth" class="on">My growth</button><button data-tab="team">Team</button><button data-tab="okrs">OKRs</button><button data-tab="training">Training${P2}</button><button data-tab="setup">Setup${P2}</button></div>

        <section data-panel="perf:growth" class="stack">
          <div class="stats">
            <div class="stat"><div class="label">Quarter score</div><div class="value qscore t-${band(q)}" id="perf-score">${q}</div><div class="sub" id="perf-band">Good is 80 or more</div></div>
            <div class="stat"><div class="label">KPIs on target</div><div class="value">1 of 5</div><div class="sub">3 within 5%</div></div>
            <div class="stat"><div class="label">Review</div><div class="value">${tone('Self-review due', 'warn')}</div><div class="sub">Due 14 Nov</div></div>
          </div>
          <div class="card"><div class="card-head"><h3>Scorecard</h3><button class="btn sm" data-open="perf-update">Update value</button></div>
          <div class="table-wrap"><table class="tbl"><thead><tr><th>KPI</th><th class="right">Now</th><th class="right">Target</th><th>Score</th><th></th></tr></thead><tbody>
          ${KPIS.map(k => `<tr><td>${esc(k.k)}</td><td class="right num">${k.now}${k.unit}</td><td class="right num">${k.tgt}${k.unit}</td><td><div class="sc">${bar(k.score, band(k.score))}<span class="num">${k.score}</span></div></td><td class="right"><button class="btn sm ghost" data-open="perf-update">Update</button></td></tr>`).join('')}
          </tbody></table></div></div>
        </section>

        <section data-panel="perf:team" hidden>
          <div class="card"><div class="card-head"><h3>My team this quarter</h3></div><div class="table-wrap"><table class="tbl"><thead><tr><th>Person</th><th>Score</th><th>OKRs</th><th>Training</th><th>Review</th></tr></thead><tbody>
          ${TEAMPERF.map(t => `<tr><td><div class="row">${avatar(t.n, 28)}${esc(t.n)}</div></td><td><div class="sc">${bar(t.s, band(t.s))}<span class="num">${t.s}</span></div></td><td>${t.okr}</td><td>${t.tr}</td><td>${tone(t.rv[0], t.rv[1])}</td></tr>`).join('')}
          </tbody></table></div></div>
        </section>

        <section data-panel="perf:okrs" class="stack" hidden>
          <div class="row between"><span class="muted">${OKRS.length} objectives in Q4 2026</span><button class="btn primary" data-open="perf-objective">New objective</button></div>
          ${OKRS.map(o => { const avg = Math.round(o.krs.reduce((a, k) => a + k[1], 0) / o.krs.length); return `<div class="card"><div class="card-head"><h3>${esc(o.o)}</h3><button class="btn sm" data-open="perf-checkin">Check in</button></div><div class="card-body">
            <div class="row between small muted"><span>${esc(o.owner)}</span><span>${avg}% overall</span></div>
            ${o.krs.map(k => `<div class="kr"><span>${esc(k[0])}</span><div class="sc">${bar(k[1], CONF[k[2]])}<span class="num small">${k[1]}%</span></div>${tone(k[2], CONF[k[2]])}</div>`).join('')}
          </div></div>`; }).join('')}
        </section>

        <section data-panel="perf:training" class="grid-2" hidden>
          ${PATHS.map(p => { const done = p.steps.filter(s => s[2] === 'Done').length; return `<div class="card"><div class="card-head"><h3>${esc(p.n)}</h3><span class="small muted">${done} of ${p.steps.length}</span></div><div class="card-body">${bar(done / p.steps.length * 100)}
            <ol class="steps">${p.steps.map(s => `<li><span><span class="muted">${s[0]}</span> · ${esc(s[1])}</span>${tone(s[2], stepTone(s[2]))}</li>`).join('')}</ol></div></div>`; }).join('')}
        </section>

        <section data-panel="perf:setup" class="stack" hidden>
          <div class="card"><div class="card-head"><h3>KPIs</h3><button class="btn sm" data-open="perf-kpi">Add KPI</button></div><div class="table-wrap"><table class="tbl"><thead><tr><th>KPI</th><th>Source</th><th class="right">Weight</th><th>Direction</th><th>Applies to</th></tr></thead><tbody>
            ${[['On-time delivery', 'Portal', 25, 'Higher is better', 'Everyone'], ['Average client health', 'Portal', 25, 'Higher is better', 'Client Success'], ['Replies within SLA', 'Portal', 20, 'Higher is better', 'Client Success'], ['Upsells closed', 'Manual', 15, 'Higher is better', 'Client Success'], ['Ad cost per lead', 'Manual', 15, 'Lower is better', 'PPC']].map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td class="right num">${r[2]}%</td><td>${r[3]}</td><td>${r[4]}</td></tr>`).join('')}
          </tbody></table></div></div>
          <div class="card"><div class="card-head"><h3>Training paths</h3><button class="btn sm" data-open="perf-path">New path</button></div><div class="table-wrap"><table class="tbl"><thead><tr><th>Path</th><th class="right">Steps</th><th class="right">Assigned</th><th class="right">Finished</th></tr></thead><tbody>
            ${[['Account manager to senior', 5, 3, 1], ['SEO basics for client success', 3, 4, 2], ['Google Ads certification', 4, 2, 2]].map(r => `<tr><td>${r[0]}</td><td class="right num">${r[1]}</td><td class="right num">${r[2]}</td><td class="right num">${r[3]}</td></tr>`).join('')}
          </tbody></table></div></div>
          <div class="card"><div class="card-head"><h3>Review cycles</h3></div><div class="table-wrap"><table class="tbl"><thead><tr><th>Cycle</th><th>Self-review due</th><th>Manager review due</th><th>Status</th><th></th></tr></thead><tbody>
            ${[['Q4 2026', '14 Nov 2026', '28 Nov 2026', true], ['Q3 2026', '15 Aug 2026', '29 Aug 2026', false]].map((r, i) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td class="cyc-st">${r[3] ? tone('Open', 'ok') : tone('Closed', 'muted')}</td><td class="right"><button class="btn sm cyc-btn" data-i="${i}">${r[3] ? 'Close cycle' : 'Reopen cycle'}</button></td></tr>`).join('')}
          </tbody></table></div></div>
        </section>

        ${dlg('perf-update', 'Update KPI value', `<div class="form-grid">${fld('KPI', `<select>${opts(KPIS.map(k => k.k), 'Upsells closed')}</select>`)}${fld('New value', '<input type="number" value="3">')}${fld('Note', '<textarea rows="2">Nova Fitness added Content</textarea>', true)}</div>`, 'Update value')}
        ${dlg('perf-self', 'Self-review for Q4 2026', `<div class="form-grid">${fld('What went well', '<textarea rows="3">Onboarded Nova Fitness in 9 days and kept Cedar & Pine above 80.</textarea>', true)}${fld('What to improve', '<textarea rows="3">Luma Skincare health dropped to 44. I should have escalated sooner.</textarea>', true)}${fld('Rating for yourself', `<select>${opts(['1 of 5', '2 of 5', '3 of 5', '4 of 5', '5 of 5'], '4 of 5')}</select>`)}${fld('Goal for next quarter', '<input value="Get Luma back above 65">')}</div>`, 'Submit self-review')}
        ${dlg('perf-checkin', 'Check in', `<div class="form-grid">${fld('Key result', `<select>${opts(OKRS.flatMap(o => o.krs.map(k => k[0])))}</select>`, true)}${fld('Progress %', '<input type="number" min="0" max="100" value="70">')}${fld('Confidence', `<select>${opts(Object.keys(CONF))}</select>`)}${fld('Note', '<textarea rows="2">Two clients still below target.</textarea>', true)}</div>`, 'Save check-in')}
        ${dlg('perf-objective', 'New objective', `<div class="form-grid">${fld('Objective', '<input placeholder="e.g. Make reporting effortless">', true)}${fld('Owner', `<select>${opts(PEOPLE.map(p => p.name), ME.name)}</select>`)}${fld('Quarter', `<select>${opts(Object.keys(QSCORE))}</select>`)}${[1, 2, 3].map(i => fld('Key result ' + i, '<input placeholder="Measurable result">', true)).join('')}</div><p class="small muted">Up to 6 key results.</p>`, 'Create objective')}
        ${dlg('perf-kpi', 'Add KPI', `<div class="form-grid">${fld('Name', '<input>', true)}${fld('Source', `<select>${opts(['Portal', 'Manual'])}</select>`)}${fld('Weight %', '<input type="number" value="10">')}${fld('Direction', `<select>${opts(['Higher is better', 'Lower is better'])}</select>`)}</div>`, 'Add KPI')}
        ${dlg('perf-path', 'New training path', `<div class="form-grid">${fld('Name', '<input>', true)}${fld('First step type', `<select>${opts(['Course', 'Video', 'Reading', 'Practice', 'Certification'])}</select>`)}${fld('First step', '<input>')}</div>`, 'Create path')}
      </div>`;
    },
    mount(root) {
      const sel = root.querySelector('#perf-q'), sc = root.querySelector('#perf-score');
      sel.addEventListener('change', () => { const v = QSCORE[sel.value]; sc.textContent = v; sc.className = 'value qscore t-' + band(v); });
      root.querySelectorAll('.cyc-btn').forEach(b => b.addEventListener('click', () => {
        const open = b.textContent.startsWith('Close'); const cell = b.closest('tr').querySelector('.cyc-st');
        cell.innerHTML = open ? tone('Closed', 'muted') : tone('Open', 'ok'); b.textContent = open ? 'Reopen cycle' : 'Close cycle';
        toast(open ? 'Review cycle closed' : 'Review cycle opened');
      }));
    },
  });

  /* ================= PROFILE ================= */
  function attendanceMonth() {
    const days = []; const late = { 7: '09:24', 21: '09:41' }; const absent = { 15: 'Sick' }; const wfh = { 23: true };
    for (let d = 1; d <= 31; d++) {
      const dow = new Date(2026, 9, d).getDay(); const work = dow >= 1 && dow <= 5;
      if (!work) { days.push({ d, off: true }); continue; }
      if (absent[d]) { days.push({ d, absent: absent[d] }); continue; }
      const inT = late[d] || `08:${String(48 + (d * 7) % 12).padStart(2, '0')}`;
      const outT = `18:${String((d * 5) % 30).padStart(2, '0')}`;
      const mins = (parseInt(outT) * 60 + +outT.slice(3)) - (parseInt(inT) * 60 + +inT.slice(3)) - 60;
      days.push({ d, inT, outT, late: !!late[d], wfh: !!wfh[d], mins });
    }
    return days;
  }
  const PAY = [['Basic', 10800], ['House rent', 4500], ['Utilities', 900], ['Medical', 900], ['Other', 900]];
  const DOCS = [
    ['Passport', 'ID', false, '2031-05-14', '12 Mar 2023'], ['Emirates ID', 'ID', false, '2026-12-20', '12 Mar 2023'],
    ['UAE residence visa', 'Visa', false, '2027-03-02', '20 Mar 2025'], ['Employment contract', 'Contract', true, '', '12 Mar 2023'],
    ['Promotion letter', 'Letter', true, '', '1 Apr 2026'], ['Degree certificate', 'Education', false, '', '12 Mar 2023'],
  ];
  const TOOLS = [['Google Workspace', 'sara@permanentseo.ae', 'Admin', '12 Mar 2023'], ['Slack', 'sara@permanentseo.ae', 'Workspace admin', '12 Mar 2023'], ['HubSpot', 'sara@permanentseo.ae', 'Sales editor', '4 Jun 2024'], ['Semrush', 'team@permanentseo.ae', 'Viewer', '10 Jan 2025'], ['Canva', 'sara@permanentseo.ae', 'Member', '2 Feb 2025'], ['Xero', 'sara@permanentseo.ae', 'Read only', '1 Apr 2026']];

  screen({
    id: 'profile', title: 'My profile', group: 'Personal',
    render() {
      const x = X[ME.id]; const gross = PAY.reduce((a, p) => a + p[1], 0);
      const att = attendanceMonth(); const worked = att.filter(a => a.inT); const lates = worked.filter(a => a.late).length;
      const hrs = worked.reduce((a, b) => a + b.mins, 0); const absent = att.filter(a => a.absent).length;
      const punct = Math.round((worked.length - lates) / worked.length * 100);
      const first = (new Date(2026, 9, 1).getDay() + 6) % 7;
      const daysLeft = d => Math.round((new Date(d) - new Date('2026-11-04')) / 864e5);
      return `<div class="page scr-prof"><style>${BASE_CSS}
        .scr-prof .hero{display:flex;gap:20px;align-items:center;flex-wrap:wrap;padding:20px}
        .scr-prof .hero h2{margin:0}
        .scr-prof .facts{display:flex;flex-wrap:wrap;gap:6px 18px;margin-top:8px}
        .scr-prof .hero .acts{margin-left:auto;display:flex;gap:8px;flex-wrap:wrap}
        .scr-prof dl{display:grid;grid-template-columns:140px 1fr;gap:8px 12px;margin:0}
        .scr-prof dt{color:var(--ink-3)}.scr-prof dd{margin:0}
        .scr-prof .tl{list-style:none;margin:0;padding:0 0 0 14px;border-left:2px solid var(--line)}
        .scr-prof .tl li{position:relative;padding:0 0 14px 10px}
        .scr-prof .tl li:before{content:"";position:absolute;left:-21px;top:5px;width:10px;height:10px;border-radius:50%;background:var(--accent)}
        .scr-prof .stars{color:var(--warn)}
        .scr-prof .dow{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:4px;color:var(--ink-3);font-size:12px;text-align:center}
        .scr-prof .cal-cell .ev.late{color:var(--warn)}.scr-prof .cal-cell .ev.abs{color:var(--danger)}
        .scr-prof .tabs{overflow-x:auto;white-space:nowrap}
        .scr-prof .tabs button{flex:none}
        .scr-prof .mask{font-family:ui-monospace,monospace}
        .scr-prof .tabs-wrap{max-width:100%;overflow-x:auto}
        @media (max-width:640px){.scr-prof dl{grid-template-columns:1fr}.scr-prof .hero .acts{margin-left:0}}</style>

        <div class="card hero">${adot(ME.name, 96, x.st)}
          <div><h2>${esc(ME.name)}</h2><div>${esc(ME.title)} · ${esc(ME.dept)}</div>
            <div class="facts small"><span>${st(x.st)}</span><span class="muted">Shift ${x.shift}</span><span class="muted">Joined ${fdate(x.joined)}</span><span class="muted">${email(ME)}</span></div></div>
          <div class="acts"><button class="btn primary" data-open="prof-edit">Edit my details</button><button class="btn" data-open="prof-hr">Edit HR details${P2}</button><button class="btn" data-open="prof-title">Title change${P2}</button></div>
        </div>

        <div class="tabs" data-tabs="prof"><button data-tab="overview" class="on">Overview</button><button data-tab="job">Job</button><button data-tab="pay">Pay${P2}</button><button data-tab="perf">Performance</button><button data-tab="docs">Documents</button><button data-tab="tools">Tools${P2}</button><button data-tab="att">Attendance</button><button data-tab="leave">Leave</button><button data-tab="personal">Personal${P2}</button><button data-tab="leaving">Leaving${P2}</button></div>

        <section data-panel="prof:overview" class="grid-2">
          <div class="stack">
            <div class="card"><div class="card-head"><h3>About</h3></div><div class="card-body stack">
              <p>I look after our clients from signing to renewal, and I run the weekly client health review.</p>
              <dl><dt>Skills</dt><dd>${x.skills.join(', ')}</dd><dt>LinkedIn</dt><dd><a href="https://www.linkedin.com/in/sara-malik-cs" target="_blank" rel="noopener">linkedin.com/in/sara-malik-cs</a></dd></dl></div></div>
            <div class="card"><div class="card-head"><h3>Career</h3></div><div class="card-body"><ol class="tl">
              <li><b>Head of Client Success</b><div class="small muted">Promoted · 1 Apr 2026</div></li>
              <li><b>Senior Account Manager</b><div class="small muted">Promoted · 1 Jul 2024</div></li>
              <li><b>Account Manager</b><div class="small muted">Joined · 12 Mar 2023</div></li></ol></div></div>
          </div>
          <div class="stack">
            <div class="card"><div class="card-head"><h3>Work</h3></div><div class="card-body"><dl><dt>Manager</dt><dd>Yusuf Ali</dd><dt>Department</dt><dd>${ME.dept}</dd><dt>Team</dt><dd>Hamza Qureshi, Zara Farooq</dd><dt>Shift</dt><dd>${x.shift}</dd><dt>Location</dt><dd>Dubai office</dd><dt>Clients</dt><dd>Alba Motors, Harbor Legal, Zest Kitchen</dd></dl></div></div>
            <div class="card"><div class="card-head"><h3>Contact</h3></div><div class="card-body"><dl><dt>Email</dt><dd>${email(ME)}</dd><dt>Phone</dt><dd>${x.phone}</dd><dt>Emergency contact</dt><dd>Adeel Malik (brother) · +971 50 663 2190</dd></dl></div></div>
            <div class="card"><div class="card-head"><h3>Onboarding</h3><span class="small muted">9 of 10 done</span></div><div class="card-body stack">${bar(90, 'ok')}<span class="small">Left to do: finish the data protection course</span></div></div>
          </div>
        </section>

        <section data-panel="prof:job" class="grid-2" hidden>
          <div class="card"><div class="card-head"><h3>Probation</h3>${tone('Confirmed', 'ok')}</div><div class="card-body stack">
            <dl><dt>Started</dt><dd>12 Mar 2023</dd><dt>Ended</dt><dd>12 Sep 2023</dd><dt>Confirmed by</dt><dd>Yusuf Ali</dd></dl>
            <div class="row"><button class="btn sm" disabled>Confirm</button><button class="btn sm" disabled>Extend +30</button><button class="btn sm" disabled>Extend +60</button><button class="btn sm" disabled>Extend +90</button><button class="btn sm danger" disabled>End</button></div>
            <span class="small muted">Probation is over, so these are off.</span></div></div>
          <div class="card"><div class="card-head"><h3>Job description</h3><select aria-label="Version"><option>Version 3 · Apr 2026</option><option>Version 2 · Jul 2024</option><option>Version 1 · Mar 2023</option></select></div><div class="card-body stack">
            <p>Own the relationship with every retained client and keep them growing.</p>
            <ul><li>Run onboarding for new clients within 10 working days</li><li>Hold monthly reviews and send reports by the 5th</li><li>Watch client health and act on anything below 60</li><li>Find and close upsells with the department leads</li><li>Manage and coach the account executives</li></ul></div></div>
        </section>

        <section data-panel="prof:pay" class="stack" hidden>
          <div class="grid-2">
            <div class="card"><div class="card-head"><h3>Salary</h3><span class="small muted">Monthly, AED</span></div><div class="table-wrap"><table class="tbl"><thead><tr><th>Component</th><th class="right">Amount</th></tr></thead><tbody>
              ${PAY.map(p => `<tr><td>${p[0]}</td><td class="right num">${money(p[1], 'AED')}</td></tr>`).join('')}<tr><td><b>Gross</b></td><td class="right num"><b>${money(gross, 'AED')}</b></td></tr></tbody></table></div></div>
            <div class="card"><div class="card-head"><h3>Split a gross</h3></div><div class="card-body stack">
              <div class="form-grid">${fld('Gross per month (AED)', `<input type="number" id="pay-gross" value="${gross}" min="0">`, true)}
              ${PAY.map((p, i) => fld(p[0] + ' %', `<input type="number" class="pay-pct" data-i="${i}" value="${[60, 25, 5, 5, 5][i]}" min="0" max="100">`)).join('')}</div>
              <div class="table-wrap"><table class="tbl"><tbody id="pay-out"></tbody></table></div><span class="small" id="pay-sum"></span></div></div>
          </div>
          <div class="grid-2">
            <div class="card"><div class="card-head"><h3>Pay history</h3></div><div class="table-wrap"><table class="tbl"><thead><tr><th>From</th><th class="right">Gross</th><th>Reason</th></tr></thead><tbody>
              <tr><td>1 Apr 2026</td><td class="right num">${money(18000, 'AED')}</td><td>Promotion</td></tr><tr><td>1 Jul 2024</td><td class="right num">${money(14500, 'AED')}</td><td>Promotion</td></tr><tr><td>12 Mar 2023</td><td class="right num">${money(11000, 'AED')}</td><td>Joined</td></tr></tbody></table></div></div>
            <div class="card"><div class="card-head"><h3>Payslips</h3></div><div class="table-wrap"><table class="tbl"><thead><tr><th>Month</th><th class="right">Net</th><th></th></tr></thead><tbody>
              ${['October 2026', 'September 2026', 'August 2026', 'July 2026'].map(m => `<tr><td>${m}</td><td class="right num">${money(18000, 'AED')}</td><td class="right"><button class="btn sm ghost pay-dl">Download PDF</button></td></tr>`).join('')}</tbody></table></div></div>
          </div>
        </section>

        <section data-panel="prof:perf" class="grid-2" hidden>
          ${[['Q3 2026 review', 'Yusuf Ali', 4, 'Strong quarter. Alba renewal talks well handled.', ['Acknowledged', 'ok'], ''], ['Q2 2026 review', 'Yusuf Ali', 4, 'Good first quarter as head of the team.', ['Acknowledged', 'ok'], ''], ['Q4 2026 review', 'Yusuf Ali', 0, 'Your self-review is due 14 Nov.', ['Self-review due', 'warn'], '<button class="btn sm primary" data-open="prof-selfrev">Write self-review</button>'], ['Q1 2026 review', 'Yusuf Ali', 3, 'Luma churn risk caught late. Plan agreed.', ['Shared', 'blue'], '<button class="btn sm prof-ack">Acknowledge</button>']].map(r => `<div class="card"><div class="card-head"><h3>${r[0]}</h3>${tone(r[4][0], r[4][1])}</div><div class="card-body stack">
            <div class="row between"><span class="small muted">Manager: ${r[1]}</span>${r[2] ? `<span class="stars" aria-label="${r[2]} of 5">${'★'.repeat(r[2])}${'☆'.repeat(5 - r[2])}</span>` : '<span class="small muted">Not rated yet</span>'}</div>
            <p>${r[3]}</p>${r[5] ? `<div class="row">${r[5]}</div>` : ''}</div></div>`).join('')}
        </section>

        <section data-panel="prof:docs" hidden><div class="card"><div class="card-head"><h3>Documents</h3><button class="btn primary sm" data-open="prof-upload">Upload</button></div>
          <div class="table-wrap"><table class="tbl"><thead><tr><th>Name</th><th>Type</th><th>HR only</th><th>Expiry</th><th class="hide-sm">Uploaded</th><th></th></tr></thead><tbody>
          ${DOCS.map(d => { const left = d[3] ? daysLeft(d[3]) : null; return `<tr><td>${d[0]}</td><td>${d[1]}</td><td>${d[2] ? 'Yes' : 'No'}</td><td>${d[3] ? (left < 60 ? tone(fdate(d[3]) + ' · ' + left + ' days', 'warn') : fdate(d[3])) : '<span class="muted">None</span>'}</td><td class="hide-sm">${d[4]}</td><td class="right"><button class="btn sm ghost">Open</button></td></tr>`; }).join('')}
          </tbody></table></div></div></section>

        <section data-panel="prof:tools" hidden><div class="card"><div class="card-head"><h3>Tool access</h3><button class="btn sm" data-open="prof-grant">Grant access</button></div>
          <div class="table-wrap"><table class="tbl"><thead><tr><th>Tool</th><th>Login</th><th>Access level</th><th>Since</th><th></th></tr></thead><tbody>
          ${TOOLS.map(t => `<tr><td>${t[0]}</td><td>${t[1]}</td><td class="tl-lvl">${t[2]}</td><td>${t[3]}</td><td class="right"><button class="btn sm danger tool-rv">Revoke</button></td></tr>`).join('')}
          </tbody></table></div><div class="card-body small muted">Passwords are never stored here.</div></div></section>

        <section data-panel="prof:att" class="stack" hidden>
          <div class="card"><div class="card-head"><h3>Today</h3><span id="clk-st">${tone('Clocked in at 08:56', 'ok')}</span></div><div class="card-body row">
            <button class="btn" id="clk-break">Start break</button><button class="btn" id="clk-out">Clock out</button><span style="flex:1"></span>
            <button class="btn ghost" data-open="prof-wfh">Request WFH</button><button class="btn ghost" data-open="prof-ot">Request overtime</button></div></div>
          <div class="stats">
            <div class="stat"><div class="label">Days worked</div><div class="value num">${worked.length}</div><div class="sub">October 2026</div></div>
            <div class="stat"><div class="label">Hours worked</div><div class="value num">${fmt(hrs)}</div><div class="sub">Breaks taken out</div></div>
            <div class="stat"><div class="label">Late arrivals</div><div class="value num t-warn">${lates}</div><div class="sub">After 09:15</div></div>
            <div class="stat"><div class="label">Punctuality</div><div class="value num">${punct}%</div><div class="sub">On time days</div></div>
            <div class="stat"><div class="label">Absent</div><div class="value num">${absent}</div><div class="sub">1 sick day</div></div>
          </div>
          <div class="card"><div class="card-head"><h3>October 2026</h3></div><div class="card-body">
            <div class="dow"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>
            <div class="cal-grid">${'<div class="cal-cell dim"></div>'.repeat(first)}${att.map(a => `<div class="cal-cell${a.off ? ' dim' : ''}"><span class="small">${a.d}</span>${a.inT ? `<div class="ev${a.late ? ' late' : ''}">In ${a.inT}${a.late ? ' · late' : ''}</div><div class="ev">Out ${a.outT}</div>${a.wfh ? '<div class="ev">WFH</div>' : ''}` : a.absent ? `<div class="ev abs">${a.absent}</div>` : ''}</div>`).join('')}</div>
          </div></div>
        </section>

        <section data-panel="prof:leave" class="stack" hidden>
          <div class="row between"><span class="muted">Annual leave needs 7 days' notice.</span><button class="btn primary" data-open="prof-leave">Request leave</button></div>
          <div class="stats">
            ${[['Annual', '14 days', '8 of 22 used'], ['Sick', '8 days', '2 of 10 used'], ['Work from home', '3 days', '1 of 4 used this month'], ['Unpaid', '0 days', 'None taken']].map(s => `<div class="stat"><div class="label">${s[0]}</div><div class="value">${s[1]}</div><div class="sub">${s[2]}</div></div>`).join('')}
          </div>
          <div class="card"><div class="card-head"><h3>Requests</h3></div><div class="table-wrap"><table class="tbl"><thead><tr><th>Type</th><th>Dates</th><th class="right">Days</th><th>Reason</th><th>Status</th></tr></thead><tbody>
            <tr><td>Annual</td><td>22–24 Dec 2026</td><td class="right num">3</td><td>Family visit</td><td>${tone('Waiting for Yusuf', 'warn')}</td></tr>
            <tr><td>Sick</td><td>15 Oct 2026</td><td class="right num">1</td><td>Flu</td><td>${tone('Approved', 'ok')}</td></tr>
            <tr><td>Annual</td><td>10–14 Aug 2026</td><td class="right num">5</td><td>Holiday</td><td>${tone('Approved', 'ok')}</td></tr>
            <tr><td>Annual</td><td>2 Jun 2026 (half day)</td><td class="right num">0.5</td><td>Appointment</td><td>${tone('Approved', 'ok')}</td></tr></tbody></table></div></div>
        </section>

        <section data-panel="prof:personal" class="grid-2" hidden>
          <div class="card"><div class="card-head"><h3>Personal details</h3><button class="btn sm ghost" id="pers-show">Show</button></div><div class="card-body"><dl>
            <dt>Date of birth</dt><dd>17 Aug 1991</dd>
            <dt>Emirates ID</dt><dd class="mask" data-full="784-1991-4471321-1" data-mask="784-****-*****21-1">784-****-*****21-1</dd>
            <dt>Tax number</dt><dd class="mask" data-full="PK 35202-8812345-6" data-mask="PK *****-*****45-6">PK *****-*****45-6</dd>
            <dt>Bank</dt><dd>Emirates NBD</dd>
            <dt>IBAN</dt><dd class="mask" data-full="AE07 0260 0010 1234 5674 521" data-mask="AE07 **** **** **** ***4 521">AE07 **** **** **** ***4 521</dd></dl></div></div>
          <div class="card"><div class="card-head"><h3>Change log</h3></div><div class="table-wrap"><table class="tbl"><thead><tr><th>Field</th><th>Changed by</th><th>When</th></tr></thead><tbody>
            <tr><td>IBAN</td><td>Bilal Ahmed</td><td>3 Apr 2026</td></tr><tr><td>Emirates ID</td><td>Sara Malik</td><td>20 Mar 2025</td></tr><tr><td>Tax number</td><td>Bilal Ahmed</td><td>15 Mar 2023</td></tr></tbody></table></div></div>
        </section>

        <section data-panel="prof:leaving" class="grid-2" hidden>
          <div class="card"><div class="card-head"><h3>Exit details</h3>${tone('No exit started', 'muted')}</div><div class="card-body stack"><div class="form-grid">
            ${fld('Last working day', '<input type="date">')}${fld('Reason', `<select>${opts(['Resigned', 'New opportunity', 'Relocation', 'End of contract', 'Let go'])}</select>`)}${fld('Notes', '<textarea rows="2"></textarea>', true)}</div>
            <div class="row"><button class="btn danger" id="exit-start">Start exit</button><button class="btn" id="exit-stay">They're staying</button></div></div></div>
          <div class="card"><div class="card-head"><h3>Offboarding checklist</h3><span class="small muted" id="exit-count">0 of 7</span></div><div class="card-body stack">
            ${['Hand over clients to a named owner', 'Reassign open tickets', 'Revoke tool access', 'Return laptop and access card', 'Final pay and gratuity worked out', 'Exit interview', 'Cancel visa'].map((c, i) => `<label class="check"><input type="checkbox" class="exit-c" id="exit-${i}"> ${c}</label>`).join('')}</div></div>
        </section>

        ${dlg('prof-edit', 'Edit my details', `<div class="form-grid">${fld('Bio', '<textarea rows="3">I look after our clients from signing to renewal, and I run the weekly client health review.</textarea>', true)}${fld('Skills', `<input value="${x.skills.join(', ')}">`, true)}${fld('Phone', `<input value="${x.phone}">`)}${fld('LinkedIn', '<input value="linkedin.com/in/sara-malik-cs">')}${fld('Emergency contact name', '<input value="Adeel Malik">')}${fld('Emergency contact phone', '<input value="+971 50 663 2190">')}</div>`)}
        ${dlg('prof-hr', 'Edit HR details', `<div class="form-grid">${fld('Title', `<input value="${ME.title}">`)}${fld('Department', `<select>${opts([...new Set(PEOPLE.map(p => p.dept))], ME.dept)}</select>`)}${fld('Manager', `<select>${opts(PEOPLE.map(p => p.name), 'Yusuf Ali')}</select>`)}${fld('Shift', `<input value="${x.shift}">`)}${fld('Joined', `<input type="date" value="${x.joined}">`)}${fld('Contract', `<select>${opts(['Full time', 'Part time', 'Contractor'])}</select>`)}</div>`)}
        ${dlg('prof-title', 'Title change', `<div class="form-grid">${fld('Type', `<select>${opts(['Promotion', 'Transfer', 'Title only'])}</select>`)}${fld('Effective from', '<input type="date" value="2026-12-01">')}${fld('New title', '<input value="Director of Client Success">')}${fld('New department', `<select>${opts([...new Set(PEOPLE.map(p => p.dept))], ME.dept)}</select>`)}<label class="check field full"><input type="checkbox" checked> Post a congratulations message in #general</label></div>`, 'Save title change')}
        ${dlg('prof-upload', 'Upload document', `<div class="form-grid">${fld('File (up to 15 MB)', '<input type="file">', true)}${fld('Type', `<select>${opts(['ID', 'Visa', 'Contract', 'Letter', 'Education', 'Other'])}</select>`)}${fld('Expiry', '<input type="date">')}<label class="check field full"><input type="checkbox"> HR only</label></div>`, 'Upload')}
        ${dlg('prof-grant', 'Grant tool access', `<div class="form-grid">${fld('Tool', '<input placeholder="e.g. Ahrefs">')}${fld('Login', `<input value="${email(ME)}">`)}${fld('Access level', '<input value="Viewer">', true)}</div>`, 'Grant access')}
        ${dlg('prof-wfh', 'Request work from home', `<div class="form-grid">${fld('Date', '<input type="date" value="2026-11-06">')}<label class="check field"><input type="checkbox"> Half day</label>${fld('Reason', '<textarea rows="2">Contractor visiting the flat</textarea>', true)}</div>`, 'Send request')}
        ${dlg('prof-ot', 'Request overtime', `<div class="form-grid">${fld('Date', '<input type="date" value="2026-11-03">')}${fld('Extra time', '<input value="2h 00m">')}${fld('Reason', '<textarea rows="2">Alba Motors launch went late</textarea>', true)}</div>`, 'Send request')}
        ${dlg('prof-leave', 'Request leave', `<div class="form-grid">${fld('Type', `<select>${opts(['Annual', 'Sick', 'Work from home', 'Unpaid'])}</select>`)}<label class="check field"><input type="checkbox"> Half day</label>${fld('From', '<input type="date" value="2026-11-16">')}${fld('To', '<input type="date" value="2026-11-17">')}${fld('Reason', '<textarea rows="2"></textarea>', true)}</div>`, 'Send request')}
        ${dlg('prof-selfrev', 'Self-review for Q4 2026', `<div class="form-grid">${fld('What went well', '<textarea rows="3"></textarea>', true)}${fld('What to improve', '<textarea rows="3"></textarea>', true)}</div>`, 'Submit self-review')}
      </div>`;
    },
    mount(root) {
      // split a gross
      const g = root.querySelector('#pay-gross'), out = root.querySelector('#pay-out'), sum = root.querySelector('#pay-sum');
      const calc = () => {
        const gross = +g.value || 0; const pcts = [...root.querySelectorAll('.pay-pct')].map(i => +i.value || 0); const tot = pcts.reduce((a, b) => a + b, 0);
        out.innerHTML = PAY.map((p, i) => `<tr><td>${p[0]}</td><td class="right num">${money(Math.round(gross * pcts[i] / 100), 'AED')}</td></tr>`).join('') + `<tr><td><b>Total</b></td><td class="right num"><b>${money(Math.round(gross * tot / 100), 'AED')}</b></td></tr>`;
        sum.innerHTML = tot === 100 ? tone('Adds up to 100%', 'ok') : tone(`Adds up to ${tot}%, needs 100%`, 'danger');
      };
      root.querySelectorAll('#pay-gross,.pay-pct').forEach(i => i.addEventListener('input', calc)); calc();
      root.querySelectorAll('.pay-dl').forEach(b => b.addEventListener('click', () => toast('Payslip downloaded (preview only)')));
      root.querySelectorAll('.tool-rv').forEach(b => b.addEventListener('click', () => { b.closest('tr').querySelector('.tl-lvl').innerHTML = tone('Revoked', 'danger'); b.disabled = true; toast('Access revoked'); }));
      root.querySelectorAll('.prof-ack').forEach(b => b.addEventListener('click', () => { const h = b.closest('.card').querySelector('.card-head'); h.lastElementChild.outerHTML = tone('Acknowledged', 'ok'); b.remove(); toast('Review acknowledged'); }));
      // personal show/hide
      const sh = root.querySelector('#pers-show');
      sh.addEventListener('click', () => { const show = sh.textContent === 'Show'; root.querySelectorAll('dd.mask').forEach(d => { d.textContent = show ? d.dataset.full : d.dataset.mask; }); sh.textContent = show ? 'Hide' : 'Show'; });
      // clock
      const cs = root.querySelector('#clk-st'), br = root.querySelector('#clk-break'), co = root.querySelector('#clk-out');
      br.addEventListener('click', () => { const on = br.textContent === 'Start break'; br.textContent = on ? 'End break' : 'Start break'; cs.innerHTML = on ? tone('On break', 'warn') : tone('Clocked in at 08:56', 'ok'); });
      co.addEventListener('click', () => {
        if (co.textContent === 'Clock in') { co.textContent = 'Clock out'; br.disabled = false; cs.innerHTML = tone('Clocked in', 'ok'); return toast('Clocked in'); }
        const now = new Date(); const early = now.getHours() < 18;
        co.textContent = 'Clock in'; br.disabled = true; cs.innerHTML = tone('Clocked out', 'muted');
        toast(early ? 'Clocked out before your shift ends at 18:00' : 'Clocked out');
      });
      // leaving
      const cnt = root.querySelector('#exit-count'); const cbs = root.querySelectorAll('.exit-c');
      cbs.forEach(c => c.addEventListener('change', () => { cnt.textContent = `${[...cbs].filter(x => x.checked).length} of ${cbs.length}`; }));
      root.querySelector('#exit-start').onclick = () => toast('Exit started. The checklist went to HR.');
      root.querySelector('#exit-stay').onclick = () => { cbs.forEach(c => { c.checked = false; }); cnt.textContent = `0 of ${cbs.length}`; toast('Marked as staying'); };
    },
  });

  /* ================= TIME ================= */
  const DAYS = ['Mon 2', 'Tue 3', 'Wed 4', 'Thu 5', 'Fri 6', 'Sat 7', 'Sun 8'];
  const TK = [
    { k: 'CPD-112', t: 'Monthly SEO report for Cedar & Pine', d: [95, 40, 30, 0, 0, 0, 0] },
    { k: 'ALB-48', t: 'Alba Motors November ad plan', d: [120, 90, 45, 0, 0, 0, 0] },
    { k: 'LUM-77', t: 'Luma Skincare health check call', d: [60, 75, 0, 0, 0, 0, 0] },
    { k: 'HBR-21', t: 'Harbor Legal launch sign-off', d: [0, 45, 30, 0, 0, 0, 0] },
    { k: 'NOV-15', t: 'Nova Fitness onboarding', d: [90, 60, 40, 0, 0, 0, 0] },
    { k: 'INT-3', t: 'Team 1:1s and hiring', d: [45, 90, 30, 0, 0, 0, 0] },
  ];
  const CLOCKED = [520, 535, 250, 0, 0, 0, 0];
  const APPR = [
    { n: 'Omar Haddad', w: '26 Oct – 1 Nov', l: 2280, b: 1980, c: 2460 },
    { n: 'Ayesha Khan', w: '26 Oct – 1 Nov', l: 1140, b: 1020, c: 2400 },
    { n: 'Priya Nair', w: '26 Oct – 1 Nov', l: 2040, b: 1800, c: 2340 },
    { n: 'Daniel Reyes', w: '26 Oct – 1 Nov', l: 720, b: 600, c: 2160 },
    { n: 'Hamza Qureshi', w: '26 Oct – 1 Nov', l: 1800, b: 1350, c: 2400 },
  ];
  const BYCLIENT = [['Cedar & Pine Dental', 1860, 240], ['Alba Motors', 2520, 420], ['Luma Skincare', 1320, 600], ['Harbor Legal', 900, 120], ['Nova Fitness', 1200, 360], ['Zest Kitchen', 660, 300]];

  screen({
    id: 'time', title: 'Time', group: 'Personal',
    render() {
      const total = TK.reduce((a, t) => a + t.d.reduce((x, y) => x + y, 0), 0);
      const first = (new Date(2026, 10, 1).getDay() + 6) % 7;
      const monthLog = { 2: 410, 3: 400, 4: 175 };
      return `<div class="page scr-time"><style>
        .scr-time .timer{display:flex;flex-wrap:wrap;gap:12px;align-items:center;padding:16px}
        .scr-time #tm-clock{font-size:28px;font-weight:700;min-width:130px}
        .scr-time #tm-clock.run{color:var(--accent)}
        .scr-time .wk{width:68px;padding:4px 6px;text-align:right;font:inherit;border:1px solid var(--line);border-radius:6px;background:var(--surface);color:var(--ink)}
        .scr-time .wk:disabled{background:transparent;border-color:transparent;color:var(--ink-2)}
        .scr-time tfoot td{font-weight:600}
        .scr-time .split{display:flex;height:8px;border-radius:4px;overflow:hidden;background:var(--surface-2);min-width:140px}
        .scr-time .split i{background:var(--accent)}
        .scr-time .dow{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:4px;color:var(--ink-3);font-size:12px;text-align:center}
        .scr-time .tkt{white-space:nowrap}.scr-time .tkt .small{display:block;white-space:normal;min-width:160px}</style>

        <div class="card timer">
          <select id="tm-ticket" aria-label="Ticket">${TK.map(t => `<option value="${t.k}">${t.k} · ${esc(t.t)}</option>`).join('')}</select>
          <span id="tm-clock" class="num" aria-live="off">00:00:00</span>
          <button class="btn primary" id="tm-btn">Start</button>
          <span style="flex:1"></span>
          <button class="btn" data-open="time-log">Log time</button>
        </div>

        <div class="tabs" data-tabs="time"><button data-tab="week" class="on">My week</button><button data-tab="month">My month</button><button data-tab="appr">Approvals</button><button data-tab="team">Team</button><button data-tab="clients">By client</button></div>

        <section data-panel="time:week" class="card">
          <div class="card-head"><h3>Week of 2 Nov 2026</h3><div class="row"><span id="wk-status">${tone('Open', 'blue')}</span><button class="btn primary sm" id="wk-submit">Submit week</button></div></div>
          <div class="table-wrap"><table class="tbl"><thead><tr><th>Ticket</th>${DAYS.map(d => `<th class="right">${d}</th>`).join('')}<th class="right">Total</th></tr></thead><tbody>
            ${TK.map((t, r) => `<tr><td class="tkt"><a href="#ticket">${t.k}</a><span class="small muted">${esc(t.t)}</span></td>${t.d.map((m, d) => `<td class="right"><input class="wk num" data-r="${r}" data-d="${d}" value="${m ? fmt(m) : ''}" aria-label="${t.k} ${DAYS[d]}"></td>`).join('')}<td class="right num rt" data-r="${r}">${fmt(t.d.reduce((a, b) => a + b, 0))}</td></tr>`).join('')}
          </tbody><tfoot><tr><td>Logged</td>${DAYS.map((_, d) => `<td class="right num lg" data-d="${d}">${fmt(TK.reduce((a, t) => a + t.d[d], 0))}</td>`).join('')}<td class="right num" id="wk-total">${fmt(total)}</td></tr>
          <tr><td>Clocked</td>${CLOCKED.map(c => `<td class="right num muted">${fmt(c)}</td>`).join('')}<td class="right num muted">${fmt(CLOCKED.reduce((a, b) => a + b, 0))}</td></tr></tfoot></table></div>
        </section>

        <section data-panel="time:month" class="stack" hidden>
          <div class="stats">
            <div class="stat"><div class="label">Logged</div><div class="value num">${fmt(985)}</div><div class="sub">November so far</div></div>
            <div class="stat"><div class="label">Clocked</div><div class="value num">${fmt(1305)}</div><div class="sub">75% of it logged</div></div>
            <div class="stat"><div class="label">Billable</div><div class="value num">${fmt(820)}</div><div class="sub">83% of logged</div></div>
            <div class="stat"><div class="label">October total</div><div class="value num">${fmt(9240)}</div><div class="sub">Approved</div></div>
          </div>
          <div class="card"><div class="card-head"><h3>November 2026</h3></div><div class="card-body">
            <div class="dow"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>
            <div class="cal-grid">${'<div class="cal-cell dim"></div>'.repeat(first)}${Array.from({ length: 30 }, (_, i) => { const d = i + 1; const dow = new Date(2026, 10, d).getDay(); return `<div class="cal-cell${dow === 0 || dow === 6 ? ' dim' : ''}${d === 4 ? ' today' : ''}"><span class="small">${d}</span>${monthLog[d] ? `<div class="ev">${fmt(monthLog[d])} logged</div>` : ''}</div>`; }).join('')}</div></div></div>
        </section>

        <section data-panel="time:appr" hidden><div class="card"><div class="card-head"><h3>Waiting for approval</h3><span class="small muted">${APPR.length} timesheets</span></div>
          <div class="table-wrap"><table class="tbl"><thead><tr><th>Person</th><th>Week</th><th class="right">Logged</th><th class="right">Billable</th><th class="right">Clocked</th><th>Status</th><th></th></tr></thead><tbody>
          ${APPR.map((a, i) => `<tr data-i="${i}"><td><div class="row">${avatar(a.n, 26)}${esc(a.n)}</div></td><td>${a.w}</td><td class="right num">${fmt(a.l)}</td><td class="right num">${fmt(a.b)}</td><td class="right num">${fmt(a.c)}</td><td class="ap-st">${a.l < a.c * 0.5 ? tone('Logged under 50% of clocked', 'danger') : tone('Submitted', 'violet')}</td>
            <td class="right"><div class="row" style="justify-content:flex-end;flex-wrap:nowrap"><button class="btn sm ghost ap-view">View</button><button class="btn sm ap-ret" data-open="time-return">Return</button><button class="btn sm primary ap-ok">Approve</button></div></td></tr>`).join('')}
          </tbody></table></div></div></section>

        <section data-panel="time:team" hidden><div class="card"><div class="card-head"><h3>Team this week</h3><button class="btn sm ghost" id="tm-export">Export timesheets</button></div>
          <div class="table-wrap"><table class="tbl"><thead><tr><th>Person</th><th class="right">Logged</th><th class="right">Clocked</th><th class="right">Billable</th><th>Week</th></tr></thead><tbody>
          ${[['Sara Malik', 985, 1305, 83, ['Open', 'blue']], ['Omar Haddad', 1240, 1380, 91, ['Open', 'blue']], ['Ayesha Khan', 610, 1290, 88, ['Open', 'blue']], ['Hamza Qureshi', 870, 1200, 74, ['Open', 'blue']], ['Priya Nair', 1010, 1150, 95, ['Open', 'blue']], ['Zara Farooq', 0, 0, 0, ['On leave', 'muted']]].map(r => `<tr><td><div class="row">${avatar(r[0], 26)}${r[0]}</div></td><td class="right num">${fmt(r[1])}</td><td class="right num">${fmt(r[2])}</td><td class="right num">${r[3] ? r[3] + '%' : '–'}</td><td>${tone(r[4][0], r[4][1])}</td></tr>`).join('')}
          </tbody></table></div></div></section>

        <section data-panel="time:clients" hidden><div class="card"><div class="card-head"><h3>October 2026 by client</h3></div>
          <div class="table-wrap"><table class="tbl"><thead><tr><th>Client</th><th class="right">Billable</th><th class="right">Not billable</th><th>Split</th><th class="right">Billable share</th></tr></thead><tbody>
          ${BYCLIENT.map(c => { const p = Math.round(c[1] / (c[1] + c[2]) * 100); return `<tr><td>${c[0]}</td><td class="right num">${fmt(c[1])}</td><td class="right num">${fmt(c[2])}</td><td><div class="split" aria-label="${p}% billable"><i style="width:${p}%"></i></div></td><td class="right num">${p}%</td></tr>`; }).join('')}
          </tbody></table></div></div></section>

        ${dlg('time-log', 'Log time', `<div class="form-grid">${fld('Ticket', `<select>${TK.map(t => `<option>${t.k} · ${esc(t.t)}</option>`).join('')}</select>`, true)}${fld('Duration', '<input value="1h 30m" placeholder="1h 30m" required>')}${fld('Date', '<input type="date" value="2026-11-04" min="2026-10-28" max="2026-11-04">')}${fld('Note (needed for past days)', '<textarea rows="2">Fixed the GSC coverage errors</textarea>', true)}${fld('Billable', `<select>${opts(['Auto', 'Yes', 'No'])}</select>`)}</div>`, 'Log time')}
        ${dlg('time-return', 'Return timesheet', `<div class="form-grid">${fld('Note for the person', '<textarea rows="3" required>Please add your Luma hours from Wednesday.</textarea>', true)}</div>`, 'Return timesheet')}
      </div>`;
    },
    mount(root) {
      // timer
      const clk = root.querySelector('#tm-clock'), btn = root.querySelector('#tm-btn'), tsel = root.querySelector('#tm-ticket');
      let start = 0, h = null;
      const pad = n => String(n).padStart(2, '0');
      const tick = () => { if (!document.contains(clk)) { clearInterval(h); return; } const s = Math.floor((Date.now() - start) / 1000); clk.textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`; };
      btn.addEventListener('click', () => {
        if (!h) { start = Date.now(); h = setInterval(tick, 1000); tick(); btn.textContent = 'Stop'; clk.classList.add('run'); tsel.disabled = true; return; }
        clearInterval(h); h = null; const s = Math.floor((Date.now() - start) / 1000);
        btn.textContent = 'Start'; clk.classList.remove('run'); tsel.disabled = false; clk.textContent = '00:00:00';
        toast(s < 60 ? 'Under 1 minute, so nothing was logged' : `Logged ${fmt(Math.round(s / 60))} to ${tsel.value}`);
      });
      // week grid
      const recalc = () => {
        const v = [...root.querySelectorAll('.wk')]; let tot = 0;
        root.querySelectorAll('.rt').forEach(c => { c.textContent = fmt(v.filter(i => i.dataset.r === c.dataset.r).reduce((a, i) => a + parse(i.value), 0)); });
        root.querySelectorAll('.lg').forEach(c => { const s = v.filter(i => i.dataset.d === c.dataset.d).reduce((a, i) => a + parse(i.value), 0); tot += s; c.textContent = fmt(s); });
        root.querySelector('#wk-total').textContent = fmt(tot);
      };
      root.querySelectorAll('.wk').forEach(i => { i.addEventListener('input', recalc); i.addEventListener('blur', () => { const m = parse(i.value); i.value = m ? fmt(m) : ''; }); });
      const sub = root.querySelector('#wk-submit');
      sub.addEventListener('click', () => { root.querySelectorAll('.wk').forEach(i => { i.disabled = true; }); root.querySelector('#wk-status').innerHTML = tone('Submitted', 'violet'); sub.disabled = true; sub.textContent = 'Week submitted'; toast('Week submitted to Yusuf Ali for approval'); });
      // approvals
      let retRow = null;
      root.querySelectorAll('.ap-ret').forEach(b => b.addEventListener('click', () => { retRow = b.closest('tr'); }));
      root.querySelector('#time-return form').addEventListener('submit', () => { if (retRow) { retRow.querySelector('.ap-st').innerHTML = tone('Returned', 'warn'); retRow.querySelectorAll('.ap-ret,.ap-ok').forEach(x => { x.disabled = true; }); } });
      root.querySelectorAll('.ap-ok').forEach(b => b.addEventListener('click', () => { const tr = b.closest('tr'); tr.querySelector('.ap-st').innerHTML = tone('Approved', 'ok'); tr.querySelectorAll('.ap-ret,.ap-ok').forEach(x => { x.disabled = true; }); toast('Timesheet approved'); }));
      root.querySelectorAll('.ap-view').forEach(b => b.addEventListener('click', () => toast('Opening timesheet (preview only)')));
      root.querySelector('#tm-export').addEventListener('click', () => toast('Timesheet CSV exported (preview only)'));
    },
  });

  /* ================= SETTINGS ================= */
  const SECS = [['design', 'Design'], ['notif', 'Notifications'], ['email', 'Email'], ['quiet', 'Quiet hours'], ['profile', 'Profile'], ['push', 'Phone alerts'], ['security', 'Sign-in & security'], ['roles', 'Roles & permissions'], ['invites', 'Invites'], ['portal', 'Client portal design'], ['api', 'API keys'], ['audit', 'Audit log'], ['nlog', 'Notifications log']];
  const ROLES = ['Admin', 'Manager', 'Member', 'Finance', 'Client'];
  const PERMS = [
    ['tickets.view', ['all', 'team', 'own', 'own', 'own']], ['tickets.edit', ['all', 'team', 'own', 'none', 'none']], ['clients.view', ['all', 'team', 'own', 'all', 'own']],
    ['finance.dashboard.view', ['all', 'none', 'none', 'all', 'none']], ['finance.invoices.view', ['all', 'team', 'none', 'all', 'own']], ['finance.invoices.send', ['all', 'none', 'none', 'all', 'none']],
    ['finance.payments.record', ['all', 'none', 'none', 'all', 'none']], ['time.view', ['all', 'team', 'own', 'all', 'none']], ['time.approve', ['all', 'team', 'none', 'none', 'none']],
    ['time.clients', ['all', 'team', 'none', 'all', 'none']], ['team.profile.edit_hr', ['all', 'none', 'none', 'none', 'none']], ['settings.manage', ['all', 'none', 'none', 'none', 'none']],
  ];
  const card = (id, title, body, extra = '') => `<section class="card psec" id="pf-${id}" data-sec="${id}"><div class="card-head"><h3>${title}</h3>${extra}</div><div class="card-body stack">${body}</div></section>`;
  const segH = (name, items, on) => `<div class="seg" data-seg="${name}" role="group">${items.map(([v, l]) => `<button data-v="${v}"${v === on ? ' class="on"' : ''}>${l}</button>`).join('')}</div>`;

  screen({
    id: 'prefs', title: 'Settings', group: 'Personal',
    render() {
      const sel = cur => `<select aria-label="Scope">${['none', 'own', 'team', 'all'].map(o => `<option${o === cur ? ' selected' : ''}>${o}</option>`).join('')}</select>`;
      return `<div class="page scr-prefs"><style>
        .scr-prefs .lay{display:grid;grid-template-columns:200px 1fr;gap:24px;align-items:start}
        .scr-prefs nav{position:sticky;top:12px;display:flex;flex-direction:column;gap:2px}
        .scr-prefs nav a{padding:7px 10px;border-radius:var(--radius);color:var(--ink-2);text-decoration:none}
        .scr-prefs nav a:hover{background:var(--surface-2)}
        .scr-prefs nav a.on{background:var(--accent-soft);color:var(--accent-ink);font-weight:600}
        .scr-prefs nav h4{margin:14px 10px 4px;font-size:13px;color:var(--ink-3);font-weight:600}
        .scr-prefs .secs{display:flex;flex-direction:column;gap:16px;min-width:0}
        .scr-prefs .psec{scroll-margin-top:16px}
        .scr-prefs .admin-h{margin:12px 0 0}
        .scr-prefs .mx td,.scr-prefs .mx th{white-space:nowrap}
        .scr-prefs .mx select{padding:3px 6px}
        .scr-prefs code{font-size:12px}
        @media (max-width:900px){.scr-prefs .lay{grid-template-columns:1fr}.scr-prefs nav{position:static;flex-direction:row;overflow-x:auto;gap:4px}.scr-prefs nav a{white-space:nowrap}.scr-prefs nav h4{display:none}}</style>
        <div class="lay">
          <nav aria-label="Settings sections">${SECS.slice(0, 7).map(([id, l]) => `<a href="#prefs" data-go="${id}">${l}</a>`).join('')}<h4>Admin</h4>${SECS.slice(7).map(([id, l]) => `<a href="#prefs" data-go="${id}">${l}${id === 'api' ? P2 : ''}</a>`).join('')}</nav>
          <div class="secs">
            ${card('design', 'Design', `<div class="field"><label>Theme</label>${segH('theme', [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']], 'system')}</div>
              <div class="field"><label>Density</label>${segH('density', [['comfortable', 'Comfortable'], ['compact', 'Compact']], 'comfortable')}</div>`)}
            ${card('notif', 'Notifications', `<div class="table-wrap"><table class="tbl"><thead><tr><th>When</th><th>In app</th><th>Email</th><th>Phone</th></tr></thead><tbody>
              ${[['I am assigned a ticket', 1, 1, 1], ['Someone mentions me', 1, 0, 1], ['A client replies', 1, 1, 1], ['A ticket I watch changes', 1, 0, 0], ['A review waits for me', 1, 1, 0], ['An invoice is overdue', 1, 1, 0]].map(r => `<tr><td>${r[0]}</td>${[1, 2, 3].map(i => `<td><input type="checkbox" aria-label="${r[0]}"${r[i] ? ' checked' : ''}></td>`).join('')}</tr>`).join('')}
              </tbody></table></div>`)}
            ${card('email', 'Email', `<div class="field"><label>Send me email</label>${segH('email', [['daily', 'Daily digest'], ['urgent', 'Urgent only'], ['off', 'Off']], 'daily')}</div><span class="small muted" id="pf-email-hint">One email at 08:00 with everything from the day before.</span>`)}
            ${card('quiet', 'Quiet hours', `<div class="row"><div class="field"><label for="pf-qfrom">From</label><input type="time" id="pf-qfrom" value="20:00"></div><div class="field"><label for="pf-qto">To</label><input type="time" id="pf-qto" value="07:00"></div><button class="btn" id="pf-q2208">Use 22:00 to 08:00</button></div><span class="small muted">No phone alerts in these hours, except urgent client escalations.</span>`)}
            ${card('profile', 'Profile', `<div class="form-grid">${fld('Slack user ID', '<input value="U04QJ7K2M1P">')}${fld('Display name', `<input value="${ME.name}">`)}</div><div class="row"><button class="btn primary pf-save">Save profile</button></div>`)}
            ${card('push', 'Phone alerts', `<div class="row between"><span id="pf-push-st">${tone('Not on for this browser', 'muted')}</span><button class="btn primary" id="pf-push">Enable push</button></div>
              <div class="list"><div class="item row between"><span>iPhone 15 · Safari</span><span class="small muted">On since 12 Sep 2026</span></div></div>`)}
            ${card('security', 'Sign-in & security', `<div class="form-grid">${fld('Current password', '<input type="password" autocomplete="current-password">')}${fld('New password', '<input type="password" autocomplete="new-password">')}</div><div class="row"><button class="btn pf-save">Change password</button></div>
              <h4 class="admin-h">Sessions</h4><div class="table-wrap"><table class="tbl"><thead><tr><th>Device</th><th>Place</th><th>Last active</th><th></th></tr></thead><tbody>
              <tr><td>Chrome on Windows</td><td>Dubai</td><td>Now (this one)</td><td></td></tr><tr><td>Safari on iPhone</td><td>Dubai</td><td>Today 08:12</td><td class="right"><button class="btn sm ghost pf-out">Sign out</button></td></tr><tr><td>Chrome on Mac</td><td>Lahore</td><td>29 Oct 2026</td><td class="right"><button class="btn sm ghost pf-out">Sign out</button></td></tr></tbody></table></div>
              <h4 class="admin-h">2-step sign-in</h4><div class="row between"><span id="pf-2fa-st">${tone('Off', 'warn')}</span><button class="btn" id="pf-2fa">Turn on 2-step</button></div>`)}
            ${card('roles', 'Roles & permissions', `<div class="table-wrap"><table class="tbl mx"><thead><tr><th>Permission</th>${ROLES.map(r => `<th>${r}</th>`).join('')}</tr></thead><tbody>
              ${PERMS.map(([k, v]) => `<tr><td><code>${k}</code></td>${v.map(s => `<td>${sel(s)}</td>`).join('')}</tr>`).join('')}</tbody></table></div><div class="row"><button class="btn primary pf-save">Save permissions</button></div>`)}
            ${card('invites', 'Invites', `<div class="table-wrap"><table class="tbl"><thead><tr><th>Email</th><th>Role</th><th>Sent</th><th>Status</th><th></th></tr></thead><tbody>
              <tr><td>noor@permanentseo.ae</td><td>Member</td><td>2 Nov 2026</td><td>${tone('Accepted', 'ok')}</td><td></td></tr>
              <tr><td>faisal@permanentseo.ae</td><td>Member</td><td>27 Oct 2026</td><td>${tone('Waiting', 'warn')}</td><td class="right"><button class="btn sm ghost pf-resend">Resend</button></td></tr>
              <tr><td>marketing@albamotors.ae</td><td>Client</td><td>30 Oct 2026</td><td>${tone('Waiting', 'warn')}</td><td class="right"><button class="btn sm ghost pf-resend">Resend</button></td></tr></tbody></table></div>`, '<button class="btn sm primary" data-open="prefs-invite">Invite</button>')}
            ${card('portal', 'Client portal design', `<div class="form-grid">${fld('Logo', '<input type="file" accept="image/*">')}${fld('Accent colour', `<select>${opts(['Workspace accent', 'Blue', 'Violet', 'Green'])}</select>`)}${fld('Welcome message', '<textarea rows="2">Hi! Here is everything we are working on for you this month.</textarea>', true)}${fld('Applies to', `<select>${opts(['Company default', ...CLIENTS.map(c => c.name)])}</select>`)}</div><div class="row"><button class="btn primary pf-save">Save portal design</button><a class="btn ghost" href="#portal-home">Open client portal</a></div>`)}
            ${card('api', 'API keys' + P2, `<div class="table-wrap"><table class="tbl"><thead><tr><th>Name</th><th>Scopes</th><th>Created</th><th>Last used</th><th></th></tr></thead><tbody>
              <tr><td>Looker Studio sync</td><td><code>time.view</code>, <code>clients.view</code></td><td>4 Sep 2026</td><td>Today 06:00</td><td class="right"><button class="btn sm danger pf-revoke">Revoke</button></td></tr>
              <tr><td>Zapier invoices</td><td><code>finance.invoices.view</code></td><td>12 Jul 2026</td><td>2 Nov 2026</td><td class="right"><button class="btn sm danger pf-revoke">Revoke</button></td></tr></tbody></table></div>`, '<button class="btn sm primary" data-open="prefs-key">Create key</button>')}
            ${card('audit', 'Audit log', `<div class="table-wrap"><table class="tbl"><thead><tr><th>When</th><th>Who</th><th>What</th></tr></thead><tbody>
              ${[['Today 09:14', 'Sara Malik', 'Changed time.approve for Manager to team'], ['Today 08:02', 'Bilal Ahmed', 'Voided invoice INV-1042'], ['3 Nov 17:40', 'Yusuf Ali', 'Invited noor@permanentseo.ae as Member'], ['3 Nov 11:05', 'Omar Haddad', 'Archived project LUM-Q2'], ['1 Nov 10:00', 'System', 'Created 6 recurring tickets']].map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</tbody></table></div>`)}
            ${card('nlog', 'Notifications log', `<div class="table-wrap"><table class="tbl"><thead><tr><th>Sent</th><th>To</th><th>Channel</th><th>Message</th><th>Result</th></tr></thead><tbody>
              ${[['Today 09:30', 'Hamza Qureshi', 'Phone', 'Luma Skincare replied on LUM-77', ['Delivered', 'ok']], ['Today 08:00', 'Sara Malik', 'Email', 'Daily digest', ['Delivered', 'ok']], ['3 Nov 22:10', 'Ayesha Khan', 'Phone', 'Held for quiet hours', ['Held', 'muted']], ['3 Nov 16:45', 'marketing@albamotors.ae', 'Email', 'Approval reminder for ALB-48', ['Bounced', 'danger']]].map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td>${tone(r[4][0], r[4][1])}</td></tr>`).join('')}</tbody></table></div>`)}
          </div>
        </div>
        ${dlg('prefs-invite', 'Invite someone', `<div class="form-grid">${fld('Email', '<input type="email" required placeholder="name@company.com">', true)}${fld('Role', `<select>${opts(ROLES, 'Member')}</select>`)}${fld('Client (for client logins)', `<select><option>None</option>${opts(CLIENTS.map(c => c.name))}</select>`)}</div>`, 'Send invite')}
        ${dlg('prefs-key', 'Create API key', `<div class="form-grid">${fld('Name', '<input placeholder="e.g. Data warehouse sync">', true)}${['time.view', 'clients.view', 'tickets.view', 'finance.invoices.view'].map(s => `<label class="check field"><input type="checkbox"> <code>${s}</code></label>`).join('')}</div><p class="small muted">You will see the key once, right after you create it.</p>`, 'Create key')}
      </div>`;
    },
    mount(root) {
      const html = document.documentElement;
      const segs = root.querySelectorAll('[data-seg]');
      const cur = { theme: html.dataset.themePref || 'system', density: html.dataset.density || 'comfortable' };
      const setOn = (s, v) => s.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
      segs.forEach(s => {
        if (cur[s.dataset.seg]) setOn(s, cur[s.dataset.seg]);
        s.addEventListener('click', e => {
          const b = e.target.closest('button'); if (!b) return; const v = b.dataset.v; setOn(s, v);
          if (s.dataset.seg === 'theme') {
            html.dataset.themePref = v;
            html.dataset.theme = v === 'system' ? (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : v;
            toast(`Theme set to ${b.textContent.toLowerCase()}`);
          } else if (s.dataset.seg === 'density') { html.dataset.density = v; toast(`Density set to ${v}`); }
          else if (s.dataset.seg === 'email') { root.querySelector('#pf-email-hint').textContent = { daily: 'One email at 08:00 with everything from the day before.', urgent: 'Email only for urgent tickets and client escalations.', off: 'No email. You still get alerts in the app.' }[v]; }
        });
      });
      // nav smooth scroll + scroll spy
      const links = root.querySelectorAll('nav a[data-go]');
      const mark = id => links.forEach(a => a.classList.toggle('on', a.dataset.go === id));
      links.forEach(a => a.addEventListener('click', e => { e.preventDefault(); const t = root.querySelector('#pf-' + a.dataset.go); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); mark(a.dataset.go); }));
      mark('design');
      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver(es => { const vis = es.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top); if (vis[0]) mark(vis[0].target.dataset.sec); }, { rootMargin: '-10% 0px -70% 0px' });
        root.querySelectorAll('.psec').forEach(s => io.observe(s));
      }
      root.querySelector('#pf-q2208').addEventListener('click', () => { root.querySelector('#pf-qfrom').value = '22:00'; root.querySelector('#pf-qto').value = '08:00'; toast('Quiet hours set to 22:00 to 08:00'); });
      root.querySelector('#pf-push').addEventListener('click', e => { root.querySelector('#pf-push-st').innerHTML = tone('On for this browser', 'ok'); e.currentTarget.disabled = true; e.currentTarget.textContent = 'Push is on'; toast('Push alerts on'); });
      root.querySelector('#pf-2fa').addEventListener('click', e => { root.querySelector('#pf-2fa-st').innerHTML = tone('On with authenticator app', 'ok'); e.currentTarget.textContent = 'Turn off 2-step'; toast('2-step sign-in is on'); });
      root.querySelectorAll('.pf-save').forEach(b => b.addEventListener('click', () => toast('Saved (preview only)')));
      root.querySelectorAll('.pf-out').forEach(b => b.addEventListener('click', () => { b.closest('tr').remove(); toast('Session signed out'); }));
      root.querySelectorAll('.pf-resend').forEach(b => b.addEventListener('click', () => toast('Invite sent again')));
      root.querySelectorAll('.pf-revoke').forEach(b => b.addEventListener('click', () => { b.closest('tr').remove(); toast('API key revoked'); }));
      root.querySelectorAll('.mx select').forEach(s => s.addEventListener('change', () => toast('Unsaved change. Press Save permissions.')));
    },
  });
})();

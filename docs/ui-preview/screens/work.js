/* Work screens: tickets, ticket, projects, reviews, templates, recurring. Owned by the Work agent. */
(function () {
  const { screen, esc, avatar, status, tone, priority, PEOPLE, CLIENTS, PROJECTS, ME, TODAY } = K;

  /* ---------- helpers ---------- */
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmtDate = d => { const [, m, day] = d.split('-'); return `${MON[+m - 1]} ${+day}`; };
  const dueLabel = (d, st) => {
    if (st !== 'done' && d < TODAY) return tone(`Overdue · ${fmtDate(d)}`, 'danger');
    if (d === TODAY) return tone('Today', 'warn');
    return `<span class="num">${fmtDate(d)}</span>`;
  };
  const avs = (names, size = 24) => `<span class="avatars">${names.map(n => avatar(n, size)).join('')}</span>`;
  const proj = key => PROJECTS.find(p => p.key === key) || { name: key, client: '', lead: '' };
  const opts = (arr, sel) => arr.map(v => { const [val, lab] = Array.isArray(v) ? v : [v, v]; return `<option value="${esc(val)}"${val === sel ? ' selected' : ''}>${esc(lab)}</option>`; }).join('');
  const team = PEOPLE.filter(p => !['Bilal Ahmed', 'Yusuf Ali'].includes(p.name)).map(p => p.name);
  const STATUSES = [['todo', 'To do'], ['in_progress', 'In progress'], ['in_review', 'In review'], ['blocked', 'Blocked'], ['done', 'Done']];
  const PRIS = [['urgent', 'Urgent'], ['high', 'High'], ['normal', 'Normal'], ['low', 'Low']];
  const DEPTS = ['SEO', 'PPC', 'Web', 'Content', 'Design', 'Social', 'Client Success'];
  const mins = m => `${Math.floor(m / 60)}h${m % 60 ? ' ' + (m % 60) + 'm' : ''}`;

  /* ---------- shared sample data ---------- */
  // key, title, status, priority, assignees, due, tags, checklist [done,total], blockedBy, estimate (min)
  const T = (key, title, st, pri, who, due, tags, ck, blk, est) => ({ key, title, status: st, priority: pri, who, due, tags, ck, blk, est, project: key.split('-')[0] });
  const TICKETS = [
    T('CPD-142', 'Rewrite service pages for implants and veneers', 'in_review', 'high', ['Priya Nair', 'Omar Haddad'], '2026-11-04', ['content', 'onpage'], [5, 6], null, 360),
    T('CPD-139', 'Fix duplicate title tags on location pages', 'done', 'normal', ['Omar Haddad'], '2026-10-30', ['technical'], [4, 4], null, 120),
    T('CPD-145', 'Publish November blog: whitening myths', 'todo', 'normal', ['Priya Nair'], '2026-11-12', ['content'], [0, 5], 'CPD-142', 240),
    T('CPD-147', 'Monthly SEO report for October', 'in_progress', 'high', ['Omar Haddad'], '2026-11-05', ['report'], [3, 7], null, 180),
    T('CPD-150', 'Build 10 local citations (Dubai Marina)', 'todo', 'low', ['Hamza Qureshi'], '2026-11-20', ['local'], [0, 10], null, 300),
    T('CPD-151', 'Schema markup for dentist profiles', 'blocked', 'normal', ['Daniel Reyes'], '2026-11-02', ['technical'], [1, 4], 'CPD-147', 150),
    T('ALB-88', 'Launch winter service campaign on Google Ads', 'in_progress', 'urgent', ['Ayesha Khan'], '2026-11-04', ['ads', 'launch'], [6, 9], null, 420),
    T('ALB-90', 'New ad creative set for SUV range', 'in_review', 'high', ['Lina Saeed'], '2026-11-06', ['design', 'ads'], [3, 3], null, 300),
    T('ALB-91', 'Negative keyword cleanup', 'todo', 'normal', ['Ayesha Khan'], '2026-11-10', ['ads'], [0, 4], null, 90),
    T('ALB-93', 'Instagram reels plan for November', 'in_progress', 'normal', ['Zara Farooq'], '2026-11-08', ['social'], [2, 5], null, 240),
    T('ALB-95', 'Weekly budget pacing check', 'done', 'low', ['Ayesha Khan'], '2026-11-03', ['ads', 'report'], [3, 3], null, 30),
    T('ALB-96', 'Landing page A/B test: test drive form', 'blocked', 'high', ['Daniel Reyes', 'Ayesha Khan'], '2026-10-31', ['web', 'cro'], [2, 6], 'HBR-60', 360),
    T('LUM-210', 'Keyword map for serum category', 'in_progress', 'high', ['Omar Haddad'], '2026-11-03', ['research'], [4, 8], null, 300),
    T('LUM-212', 'Product page copy: vitamin C line', 'todo', 'normal', ['Priya Nair'], '2026-11-14', ['content'], [0, 6], 'LUM-210', 420),
    T('LUM-215', 'Shopping feed errors (124 items)', 'in_progress', 'urgent', ['Ayesha Khan'], '2026-10-29', ['ads', 'technical'], [5, 9], null, 240),
    T('LUM-218', 'Banner set for Black Friday', 'todo', 'high', ['Lina Saeed'], '2026-11-18', ['design'], [0, 4], null, 360),
    T('LUM-219', 'Core Web Vitals fixes on collection pages', 'in_review', 'normal', ['Daniel Reyes'], '2026-11-07', ['technical', 'web'], [7, 7], null, 480),
    T('LUM-220', 'Client call notes and next steps', 'done', 'low', ['Hamza Qureshi'], '2026-11-02', ['account'], [2, 2], null, 30),
    T('HBR-58', 'Practice area page templates', 'in_progress', 'high', ['Daniel Reyes', 'Lina Saeed'], '2026-11-11', ['web'], [9, 14], null, 720),
    T('HBR-60', 'Contact form spam protection', 'in_progress', 'urgent', ['Daniel Reyes'], '2026-11-04', ['web'], [1, 3], null, 90),
    T('HBR-61', 'Migrate 40 blog posts to new site', 'todo', 'normal', ['Priya Nair', 'Daniel Reyes'], '2026-11-25', ['web', 'content'], [0, 40], null, 600),
    T('HBR-63', 'Redirect map from old URLs', 'in_review', 'high', ['Omar Haddad'], '2026-11-09', ['technical'], [3, 3], null, 180),
    T('HBR-64', 'Attorney headshots retouching', 'done', 'normal', ['Lina Saeed'], '2026-10-28', ['design'], [12, 12], null, 240),
    T('NOV-12', 'Content calendar for November', 'in_review', 'high', ['Zara Farooq'], '2026-11-05', ['social'], [4, 4], null, 180),
    T('NOV-14', 'Gym opening video edit', 'in_progress', 'normal', ['Lina Saeed', 'Zara Farooq'], '2026-11-13', ['social', 'design'], [2, 5], null, 300),
    T('NOV-15', 'Blog: 5 beginner mistakes at the gym', 'todo', 'low', ['Priya Nair'], '2026-11-21', ['content'], [0, 5], null, 180),
    T('NOV-17', 'TikTok account setup and bio', 'blocked', 'normal', ['Zara Farooq'], '2026-11-01', ['social'], [1, 3], null, 60),
    T('NOV-18', 'Onboarding questionnaire follow-up', 'todo', 'normal', ['Sara Malik'], '2026-11-06', ['account'], [0, 2], null, 45),
  ];
  const ST_LABEL = Object.fromEntries(STATUSES);
  const TAGS = [...new Set(TICKETS.flatMap(t => t.tags))].sort();

  /* ---------- scoped CSS (variables only) ---------- */
  const CSS = `<style>
  .scr-work .head-row{display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between}
  .scr-work h2{margin:0;font-size:22px;color:var(--ink)}
  .scr-work .toolbar input[type=search]{min-width:180px}
  .scr-work .saved{display:flex;flex-wrap:wrap;gap:14px;align-items:center;font-size:13px}
  .scr-work .saved a{color:var(--accent);text-decoration:none}
  .scr-work .saved a:hover{text-decoration:underline}
  .scr-work .count{color:var(--ink-3);font-variant-numeric:tabular-nums;margin-left:4px}
  .scr-work .tabs button.on .count{color:var(--accent);font-weight:600}
  .scr-work .bulk{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 12px;border:1px solid var(--accent);background:var(--accent-soft);border-radius:var(--radius)}
  .scr-work .bulk strong{color:var(--accent-ink);margin-right:6px}
  .scr-work .key{font-variant-numeric:tabular-nums;color:var(--ink-3);font-size:12px;white-space:nowrap}
  .scr-work .tag{color:var(--ink-3);font-size:12px}
  .scr-work .kcard{cursor:grab}
  .scr-work .kcard.dragging{opacity:.5}
  .scr-work .col.over{outline:2px dashed var(--accent);outline-offset:-4px}
  .scr-work .kc-top{display:flex;justify-content:space-between;gap:8px;align-items:center}
  .scr-work .kc-title{margin:6px 0;font-size:14px;color:var(--ink);line-height:1.35}
  .scr-work .kc-foot{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:12px;color:var(--ink-2)}
  .scr-work .kc-blk{font-size:12px;color:var(--danger);margin-top:6px}
  .scr-work .col-head .n{color:var(--ink-3);font-variant-numeric:tabular-nums}
  .scr-work .cal-cell .more{background:none;border:0;padding:0;color:var(--accent);font-size:12px;cursor:pointer}
  .scr-work .cal-cell .ev a{color:inherit;text-decoration:none}
  .scr-work .wl td .bar{margin-top:4px;min-width:60px}
  .scr-work .wl td{white-space:nowrap}
  .scr-work .alert-row{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--line)}
  .scr-work .alert-row:last-child{border-bottom:0}
  .scr-work .crumb{font-size:13px;color:var(--ink-3)}
  .scr-work .crumb a{color:var(--ink-2);text-decoration:none}
  .scr-work .crumb a:hover{color:var(--accent)}
  .scr-work .tk-title{cursor:text;border-radius:6px;padding:2px 4px;margin-left:-4px}
  .scr-work .tk-title:hover{background:var(--surface-2)}
  .scr-work .tk-title-input{font-size:22px;font-weight:600;width:100%}
  .scr-work .split{display:grid;grid-template-columns:2fr 1fr;gap:20px;align-items:start}
  @media (max-width:900px){.scr-work .split{grid-template-columns:1fr}}
  .scr-work .dl{display:grid;grid-template-columns:110px 1fr;gap:10px 12px;align-items:center;font-size:13px}
  .scr-work .dl dt{color:var(--ink-3)}
  .scr-work .dl dd{margin:0;min-width:0}
  .scr-work .dl select,.scr-work .dl input{width:100%}
  .scr-work .ck-row{display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid var(--line)}
  .scr-work .ck-row:last-child{border-bottom:0}
  .scr-work .ck-row label{flex:1;display:flex;gap:8px;align-items:center;cursor:pointer}
  .scr-work .ck-row.is-done label span{text-decoration:line-through;color:var(--ink-3)}
  .scr-work .thumbs{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px}
  .scr-work .thumb{border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;background:var(--surface);cursor:pointer;padding:0;text-align:left;color:var(--ink)}
  .scr-work .thumb i{display:block;height:78px}
  .scr-work .thumb span{display:block;padding:6px 8px;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .scr-work .g1{background:linear-gradient(135deg,var(--accent-soft),var(--blue-soft))}
  .scr-work .g2{background:linear-gradient(135deg,var(--violet-soft),var(--accent-soft))}
  .scr-work .g3{background:linear-gradient(135deg,var(--warn-soft),var(--danger-soft))}
  .scr-work .g4{background:linear-gradient(135deg,var(--ok-soft),var(--blue-soft))}
  .scr-work .viewer-img{height:260px;border-radius:var(--radius)}
  .scr-work .cmt{display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--line)}
  .scr-work .cmt:last-child{border-bottom:0}
  .scr-work .cmt .who{font-size:13px}
  .scr-work .cmt p{margin:4px 0 0;font-size:14px;color:var(--ink)}
  .scr-work .seen{font-size:12px;color:var(--ok)}
  .scr-work .hist{font-size:13px;color:var(--ink-2);padding:6px 0;border-bottom:1px solid var(--line)}
  .scr-work .hist:last-child{border-bottom:0}
  .scr-work details{border:1px solid var(--line);border-radius:var(--radius);padding:8px 12px;margin-top:8px}
  .scr-work details summary{cursor:pointer;font-size:14px;color:var(--ink)}
  .scr-work .reviewer{border-top:1px solid var(--line);margin-top:12px;padding-top:12px}
  .scr-work .timer{font-variant-numeric:tabular-nums;font-weight:600;color:var(--accent)}
  .scr-work .pcard h4{margin:0;font-size:15px;color:var(--ink)}
  .scr-work .pcard .meta{display:flex;flex-wrap:wrap;gap:14px;font-size:13px;color:var(--ink-2)}
  .scr-work .pcard .meta b{color:var(--ink)}
  .scr-work .pcard .meta .t-danger b{color:var(--danger)}
  .scr-work .dept-h{margin:4px 0 0;font-size:16px;color:var(--ink)}
  .scr-work .reason{display:grid;grid-template-columns:160px 1fr 40px;gap:10px;align-items:center;font-size:13px;padding:5px 0}
  @media (max-width:520px){.scr-work .reason{grid-template-columns:110px 1fr 32px}}
  .scr-work code{font-size:12px;background:var(--surface-2);padding:1px 5px;border-radius:4px;color:var(--ink-2)}
  .scr-work .help{font-size:12px;color:var(--ink-3);margin-top:4px}
  .scr-work .off{opacity:.6}
  </style>`;
  const wrap = (inner, extra = '') => `${CSS}<div class="page scr-work ${extra}">${inner}</div>`;

  /* =====================================================================
     TICKETS
     ===================================================================== */
  function ticketRow(t) {
    return `<tr class="click" data-href="#ticket" data-status="${t.status}" data-pri="${t.priority}" data-who="${esc(t.who.join('|'))}" data-proj="${t.project}" data-tags="${esc(t.tags.join('|'))}" data-due="${t.due}" data-text="${esc((t.key + ' ' + t.title).toLowerCase())}">
      <td><input type="checkbox" class="tk-chk" aria-label="Select ${t.key}"></td>
      <td class="key">${t.key}</td>
      <td><a href="#ticket">${esc(t.title)}</a><div class="tag">${t.tags.map(x => '#' + esc(x)).join(' ')}</div></td>
      <td>${status(t.status)}</td>
      <td>${priority(t.priority)}</td>
      <td class="hide-sm">${avs(t.who)}</td>
      <td>${dueLabel(t.due, t.status)}</td>
    </tr>`;
  }

  function listView() {
    const counts = Object.fromEntries(STATUSES.map(([k]) => [k, TICKETS.filter(t => t.status === k).length]));
    return `
    <div class="tabs" id="tk-st">
      <button data-st="all" class="on">All<span class="count">${TICKETS.length}</span></button>
      ${STATUSES.map(([k, l]) => `<button data-st="${k}">${l}<span class="count">${counts[k]}</span></button>`).join('')}
    </div>
    <div class="toolbar row">
      <input type="search" id="tk-q" placeholder="Search tickets" aria-label="Search tickets">
      <select id="tk-who" aria-label="Assignee"><option value="">Any assignee</option>${opts(team)}</select>
      <select id="tk-pri" aria-label="Priority"><option value="">Any priority</option>${opts(PRIS)}</select>
      <select id="tk-due" aria-label="Due"><option value="">Any due date</option><option value="overdue">Overdue</option><option value="today">Due today</option><option value="week">This week</option><option value="later">Later</option></select>
      <select id="tk-tag" aria-label="Tag"><option value="">Any tag</option>${opts(TAGS)}</select>
      <select id="tk-proj" aria-label="Project"><option value="">All projects</option>${opts(PROJECTS.map(p => [p.key, p.name]))}</select>
      <select aria-label="Group by"><option>Group: none</option><option>Group: project</option><option>Group: assignee</option><option>Group: status</option></select>
      <select aria-label="Sort"><option>Sort: due date</option><option>Sort: priority</option><option>Sort: last updated</option><option>Sort: key</option></select>
      <button class="btn sm" data-open="tickets-saveview">Save view</button>
    </div>
    <div class="saved"><span class="muted">Saved views:</span><a href="#tickets" data-sv="overdue">My overdue</a><a href="#tickets" data-sv="seo">SEO this week</a><a href="#tickets" data-sv="review">Waiting review</a><a href="#tickets" data-sv="clear">Clear filters</a></div>
    <div class="bulk" id="tk-bulk" hidden>
      <strong><span id="tk-n">0</span> selected</strong>
      <select aria-label="Set status"><option value="">Status…</option>${opts(STATUSES)}</select>
      <select aria-label="Set priority"><option value="">Priority…</option>${opts(PRIS)}</select>
      <select aria-label="Set owner"><option value="">Owner…</option>${opts(team)}</select>
      <input type="date" aria-label="Set due date" value="2026-11-11">
      <select aria-label="Move to project"><option value="">Move to project…</option>${opts(PROJECTS.map(p => [p.key, p.name]))}</select>
      <button class="btn sm primary" id="tk-apply">Apply</button>
      <button class="btn sm ghost" id="tk-clear">Clear</button>
    </div>
    <div class="table-wrap"><table class="tbl" id="tk-table">
      <thead><tr><th><input type="checkbox" id="tk-all" aria-label="Select all"></th><th>Key</th><th>Title</th><th>Status</th><th>Priority</th><th class="hide-sm">Assignee</th><th>Due</th></tr></thead>
      <tbody>${TICKETS.map(ticketRow).join('')}</tbody>
    </table></div>
    <div class="empty" id="tk-empty" hidden>No tickets match these filters. <button class="btn sm" id="tk-reset">Clear filters</button></div>`;
  }

  function kcard(t) {
    const [d, n] = t.ck;
    return `<article class="kcard" draggable="true" data-key="${t.key}">
      <div class="kc-top"><span class="key">${t.key}</span>${priority(t.priority)}</div>
      <div class="kc-title"><a href="#ticket">${esc(t.title)}</a></div>
      <div class="kc-foot">${avs(t.who, 22)}<span>${dueLabel(t.due, t.status)}</span><span class="num" title="Checklist">☑ ${d}/${n}</span></div>
      ${t.blk ? `<div class="kc-blk">Blocked by ${t.blk}</div>` : ''}
    </article>`;
  }
  function boardView() {
    return `<div class="board" id="tk-board">${STATUSES.map(([k, l]) => {
      const list = TICKETS.filter(t => t.status === k);
      return `<div class="col" data-col="${k}"><div class="col-head">${status(k)} <span class="n">${list.length}</span></div>${list.map(kcard).join('')}</div>`;
    }).join('')}</div>`;
  }

  function calView() {
    const start = new Date(Date.UTC(2026, 10, 1));
    const dow = (start.getUTCDay() + 6) % 7; // Monday = 0
    start.setUTCDate(start.getUTCDate() - dow);
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setUTCDate(start.getUTCDate() + i);
      const iso = d.toISOString().slice(0, 10);
      const evs = TICKETS.filter(t => t.due === iso);
      const cls = ['cal-cell', d.getUTCMonth() !== 10 ? 'dim' : '', iso === TODAY ? 'today' : ''].filter(Boolean).join(' ');
      const ev = (t, hide) => `<div class="ev t-${t.status === 'done' ? 'ok' : t.due < TODAY ? 'danger' : 'accent'}"${hide ? ' hidden data-extra' : ''}><a href="#ticket">${t.key} ${esc(t.title)}</a></div>`;
      cells.push(`<div class="${cls}"><div class="small">${d.getUTCDate()}</div>${evs.map((t, j) => ev(t, j >= 2)).join('')}${evs.length > 2 ? `<button class="more" data-more>+${evs.length - 2} more</button>` : ''}</div>`);
    }
    const heads = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<div class="small muted">${d}</div>`).join('');
    return `<div class="row between"><h3 style="margin:0">November 2026</h3><div class="row"><button class="btn sm ghost" aria-label="Previous month">‹</button><button class="btn sm">Today</button><button class="btn sm ghost" aria-label="Next month">›</button></div></div>
    <div class="table-wrap"><div class="cal-grid" style="min-width:640px">${heads}${cells.join('')}</div></div>`;
  }

  const WL = [
    ['Omar Haddad', [8, 9, 8.5, 7, 6, 0, 0], 30],
    ['Daniel Reyes', [9, 8, 8, 9, 8, 2, 0], 35],
    ['Ayesha Khan', [7, 8, 6, 7, 6, 0, 0], 38],
    ['Lina Saeed', [6, 7, 7, 6, 5, 0, 0], 38],
    ['Zara Farooq', [6, 5, 7, 5, 4, 2, 0], 38],
    ['Priya Nair', [3, 4, 3, 4, 3, 0, 0], 38],
    ['Hamza Qureshi', [4, 3, 5, 4, 3, 0, 0], 30],
  ];
  function workloadView() {
    const days = ['Mon 2', 'Tue 3', 'Wed 4', 'Thu 5', 'Fri 6', 'Sat 7', 'Sun 8'];
    const rows = WL.map(([n, h, cap]) => {
      const daily = cap / 5;
      const tot = h.reduce((a, b) => a + b, 0), pct = Math.round(tot / cap * 100);
      const tn = pct > 100 ? 't-warn' : pct < 60 ? 't-ok' : '';
      return `<tr><td><span class="row" style="flex-wrap:nowrap">${avatar(n, 24)} ${esc(n)}</span></td>${h.map((x, i) => {
        const c = i > 4 ? 0 : daily; const p = c ? Math.min(100, Math.round(x / c * 100)) : (x ? 100 : 0);
        const t = c && x / c > 1 ? 't-warn' : c && x / c < 0.6 ? 't-ok' : (!c && x ? 't-warn' : '');
        return `<td class="num small">${x} / ${Math.round(c * 10) / 10}h<div class="bar ${t}"><i style="width:${p}%"></i></div></td>`;
      }).join('')}<td class="num"><b>${tot} / ${cap}h</b><div class="bar ${tn}"><i style="width:${Math.min(100, pct)}%"></i></div><span class="small ${pct > 100 ? 't-warn' : 'muted'}">${pct}%</span></td></tr>`;
    }).join('');
    const alerts = [
      ['Overloaded', 'Omar Haddad', '132%', 'danger', 'Move CPD-147 to…'],
      ['Overloaded', 'Daniel Reyes', '126%', 'danger', 'Move HBR-61 to…'],
      ['Overdue work', 'Ayesha Khan', '2 overdue', 'warn', 'Move LUM-215 to…'],
      ['Has room', 'Priya Nair', '45%', 'ok', null],
      ['Unestimated', 'Zara Farooq', '3 tickets with no estimate', 'warn', null],
    ];
    return `<div class="row between"><h3 style="margin:0">Week of Nov 2 – 8</h3><div class="row"><select aria-label="Department"><option>All departments</option>${opts(DEPTS)}</select><button class="icon-btn" data-open="tickets-wl-settings" aria-label="Workload settings" title="Workload settings">⚙</button></div></div>
    <div class="table-wrap"><table class="tbl wl"><thead><tr><th>Person</th>${days.map(d => `<th>${d}</th>`).join('')}<th>Week</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="card"><div class="card-head"><h3>Capacity alerts</h3><span class="muted small">Updated 10 min ago</span></div><div class="card-body" id="tk-alerts">
      ${alerts.map(([k, n, v, t, mv]) => `<div class="alert-row"><span>${tone(k, t)} <b>${esc(n)}</b> <span class="muted">${esc(v)}</span></span><span class="row">${mv ? `<select aria-label="${esc(mv)}"><option>${esc(mv)}</option>${opts(['Priya Nair', 'Hamza Qureshi', 'Lina Saeed'])}</select>` : ''}<button class="btn sm" data-handled>Handled</button></span></div>`).join('')}
    </div></div>`;
  }

  const ticketsDialogs = () => `
  <dialog id="tickets-new" class="modal"><form method="dialog">
    <div class="modal-head"><h3>New ticket</h3><button type="button" class="icon-btn" data-close aria-label="Close">×</button></div>
    <div class="modal-body"><div class="form-grid">
      <div class="field full"><label>Start from template</label><select><option>Blank ticket</option>${opts(TEMPLATES.filter(t => !t.off).map(t => t.name))}</select></div>
      <div class="field full"><label>Title</label><input required placeholder="What needs doing?"></div>
      <div class="field"><label>Project</label><select>${opts(PROJECTS.map(p => [p.key, p.name]))}</select></div>
      <div class="field"><label>Assignee</label><select>${opts(team, ME.name)}</select></div>
      <div class="field"><label>Priority</label><select>${opts(PRIS, 'normal')}</select></div>
      <div class="field"><label>Due</label><input type="date" value="2026-11-11"></div>
      <div class="field full"><label>Description</label><textarea rows="3"></textarea></div>
      <div class="field full"><label>Done when</label><textarea rows="2" placeholder="How we know it is finished"></textarea></div>
      <div class="field"><label>Tags</label><input placeholder="content, onpage"></div>
      <div class="field"><label>Files</label><input type="file" multiple></div>
    </div></div>
    <div class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Create ticket</button></div>
  </form></dialog>
  <dialog id="tickets-saveview" class="modal"><form method="dialog">
    <div class="modal-head"><h3>Save this view</h3><button type="button" class="icon-btn" data-close aria-label="Close">×</button></div>
    <div class="modal-body"><div class="form-grid">
      <div class="field full"><label>Name</label><input required value="My urgent this week"></div>
      <div class="field full"><label class="check"><input type="checkbox"> Share with my department</label></div>
    </div></div>
    <div class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Save view</button></div>
  </form></dialog>
  <dialog id="tickets-wl-settings" class="modal"><form method="dialog">
    <div class="modal-head"><h3>Workload alert settings</h3><button type="button" class="icon-btn" data-close aria-label="Close">×</button></div>
    <div class="modal-body"><div class="form-grid">
      <div class="field"><label>Overloaded above (%)</label><input type="number" value="110"></div>
      <div class="field"><label>Overdue tickets alert at</label><input type="number" value="2"></div>
      <div class="field"><label>Has room below (%)</label><input type="number" value="60"></div>
      <div class="field"><label>Default estimate when blank (min)</label><input type="number" value="60"></div>
    </div></div>
    <div class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Save settings</button></div>
  </form></dialog>`;

  screen({
    id: 'tickets', title: 'Tickets', group: 'Work',
    render() {
      return wrap(`
      <div class="head-row">
        <div class="seg" id="tk-views"><button data-v="list" class="on">List</button><button data-v="board">Board</button><button data-v="cal">Calendar</button><button data-v="wl">Workload <span class="p2">phase 2</span></button></div>
        <div class="row"><a class="btn" href="#recurring">Recurring</a><button class="btn primary" data-open="tickets-new">New ticket</button></div>
      </div>
      <section data-view="list" class="stack">${listView()}</section>
      <section data-view="board" hidden>${boardView()}</section>
      <section data-view="cal" class="stack" hidden>${calView()}</section>
      <section data-view="wl" class="stack" hidden>${workloadView()}</section>
      ${ticketsDialogs()}`);
    },
    mount(root) {
      const $ = s => root.querySelector(s), $$ = s => [...root.querySelectorAll(s)];
      // view switch
      $('#tk-views').addEventListener('click', e => {
        const b = e.target.closest('[data-v]'); if (!b) return;
        $$('#tk-views [data-v]').forEach(x => x.classList.toggle('on', x === b));
        $$('section[data-view]').forEach(s => { s.hidden = s.dataset.view !== b.dataset.v; });
      });
      // list filters
      let st = 'all';
      const f = { q: $('#tk-q'), who: $('#tk-who'), pri: $('#tk-pri'), due: $('#tk-due'), tag: $('#tk-tag'), proj: $('#tk-proj') };
      const weekEnd = '2026-11-08';
      function apply() {
        const q = f.q.value.trim().toLowerCase(); let shown = 0;
        $$('#tk-table tbody tr').forEach(r => {
          const d = r.dataset;
          let ok = (st === 'all' || d.status === st) && (!q || d.text.includes(q)) && (!f.who.value || d.who.split('|').includes(f.who.value)) &&
            (!f.pri.value || d.pri === f.pri.value) && (!f.tag.value || d.tags.split('|').includes(f.tag.value)) && (!f.proj.value || d.proj === f.proj.value);
          const dv = f.due.value;
          if (ok && dv === 'overdue') ok = d.due < TODAY && d.status !== 'done';
          if (ok && dv === 'today') ok = d.due === TODAY;
          if (ok && dv === 'week') ok = d.due >= TODAY && d.due <= weekEnd;
          if (ok && dv === 'later') ok = d.due > weekEnd;
          r.hidden = !ok; if (ok) shown++;
        });
        $('#tk-empty').hidden = shown > 0;
      }
      $('#tk-st').addEventListener('click', e => {
        const b = e.target.closest('[data-st]'); if (!b) return;
        st = b.dataset.st; $$('#tk-st [data-st]').forEach(x => x.classList.toggle('on', x === b)); apply();
      });
      Object.values(f).forEach(el => el.addEventListener('input', apply));
      const reset = () => { Object.values(f).forEach(el => { el.value = ''; }); st = 'all'; $$('#tk-st [data-st]').forEach((x, i) => x.classList.toggle('on', i === 0)); apply(); };
      $('#tk-reset').addEventListener('click', reset);
      root.querySelector('.saved').addEventListener('click', e => {
        const a = e.target.closest('[data-sv]'); if (!a) return; e.preventDefault(); reset();
        if (a.dataset.sv === 'overdue') { f.due.value = 'overdue'; }
        if (a.dataset.sv === 'seo') { f.proj.value = 'CPD'; f.due.value = 'week'; }
        if (a.dataset.sv === 'review') { st = 'in_review'; $$('#tk-st [data-st]').forEach(x => x.classList.toggle('on', x.dataset.st === 'in_review')); }
        apply();
      });
      // row click
      $('#tk-table tbody').addEventListener('click', e => {
        if (e.target.closest('input,a')) return;
        const r = e.target.closest('tr[data-href]'); if (r) location.hash = r.dataset.href;
      });
      // bulk
      const bulk = () => { const n = $$('.tk-chk:checked').length; $('#tk-n').textContent = n; $('#tk-bulk').hidden = n === 0; };
      $('#tk-table').addEventListener('change', e => { if (e.target.classList.contains('tk-chk')) bulk(); });
      $('#tk-all').addEventListener('change', e => { $$('#tk-table tbody tr:not([hidden]) .tk-chk').forEach(c => { c.checked = e.target.checked; }); bulk(); });
      $('#tk-clear').addEventListener('click', () => { $$('.tk-chk').forEach(c => { c.checked = false; }); $('#tk-all').checked = false; bulk(); });
      $('#tk-apply').addEventListener('click', () => { K.toast(`Updated ${$$('.tk-chk:checked').length} tickets`); });
      // board drag and drop
      const board = $('#tk-board'); let drag = null;
      const recount = () => $$('#tk-board .col').forEach(c => { c.querySelector('.n').textContent = c.querySelectorAll('.kcard').length; });
      board.addEventListener('dragstart', e => { drag = e.target.closest('.kcard'); if (drag) { drag.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', drag.dataset.key); } });
      board.addEventListener('dragend', () => { if (drag) drag.classList.remove('dragging'); $$('#tk-board .col').forEach(c => c.classList.remove('over')); drag = null; });
      board.addEventListener('dragover', e => { const c = e.target.closest('.col'); if (!c || !drag) return; e.preventDefault(); $$('#tk-board .col').forEach(x => x.classList.toggle('over', x === c)); });
      board.addEventListener('drop', e => {
        const c = e.target.closest('.col'); if (!c || !drag) return; e.preventDefault();
        const from = drag.closest('.col'); if (from === c) return;
        const after = [...c.querySelectorAll('.kcard')].find(k => e.clientY < k.getBoundingClientRect().top + k.offsetHeight / 2);
        c.insertBefore(drag, after || null); recount();
        K.toast(`${drag.dataset.key} moved to ${ST_LABEL[c.dataset.col]}`);
      });
      // calendar more
      $$('[data-more]').forEach(b => b.addEventListener('click', () => {
        const cell = b.closest('.cal-cell'), ex = cell.querySelectorAll('[data-extra]'), open = b.dataset.open === '1';
        ex.forEach(x => { x.hidden = open; }); b.dataset.open = open ? '' : '1'; b.textContent = open ? `+${ex.length} more` : 'Show less';
      }));
      // workload alerts
      $('#tk-alerts').addEventListener('click', e => {
        const b = e.target.closest('[data-handled]'); if (!b) return;
        const row = b.closest('.alert-row'), done = row.classList.toggle('off');
        b.textContent = done ? 'Handled · Undo' : 'Handled';
        if (done) K.toast('Alert marked handled');
      });
    },
  });

  /* =====================================================================
     TICKET DETAIL
     ===================================================================== */
  const CHECK = [
    ['Use client tone guide (warm, no jargon)', true], ['Primary keyword in H1 and first 100 words', true], ['Add FAQ block with 4 questions', true],
    ['Internal links to booking and pricing pages', true], ['Before / after image alt text', true], ['Client sign-off on pricing claims', false],
  ];
  const FILES = [['implants-draft-v2.docx', 'g1'], ['veneers-hero.png', 'g2'], ['serp-snapshot.png', 'g3'], ['competitor-notes.pdf', 'g4']];
  const QA = ['Spelling and grammar checked', 'Keyword placement matches brief', 'Links tested', 'Meta title under 60 characters', 'Images compressed'];

  screen({
    id: 'ticket', title: 'CPD-142', group: null,
    render() {
      const t = TICKETS[0];
      const ckDone = CHECK.filter(c => c[1]).length;
      return wrap(`
      <div class="crumb"><a href="#tickets">Tickets</a> / <a href="#projects">Cedar &amp; Pine SEO</a> / <span>CPD-142</span></div>
      <div class="head-row">
        <h2 class="tk-title" id="tk-title" title="Click to edit">${esc(t.title)}</h2>
        <div class="row">
          <button class="btn sm" id="tk-watch">Watch</button>
          <button class="btn sm" id="tk-copylink">Copy link</button>
          <button class="btn sm" data-open="ticket-copy">Copy to…</button>
          <button class="btn sm" data-open="ticket-repeat">Repeat…</button>
          <button class="btn sm danger" data-open="ticket-delete">Delete</button>
        </div>
      </div>
      <div class="row small">${status(t.status)} ${priority(t.priority)} <span class="muted">Due ${dueLabel(t.due, t.status)}</span> <span class="muted">· 2 revisions</span></div>

      <div class="split">
        <div class="stack" style="gap:16px">
          <div class="card"><div class="card-head"><h3>Description</h3><button class="btn sm ghost" id="tk-desc-edit">Edit</button></div><div class="card-body">
            <div id="tk-desc-view" class="stack">
              <p style="margin:0">Rewrite the implants and veneers service pages using the new keyword map. Keep the existing URLs. Pricing must match the October price list the client sent.</p>
              <div><b>Done when</b><p class="muted" style="margin:4px 0 0">Both pages are live, pass QA, and the client has approved the pricing section.</p></div>
            </div>
            <div id="tk-desc-form" class="stack" hidden>
              <textarea rows="4">Rewrite the implants and veneers service pages using the new keyword map. Keep the existing URLs. Pricing must match the October price list the client sent.</textarea>
              <label class="small muted">Done when</label><textarea rows="2">Both pages are live, pass QA, and the client has approved the pricing section.</textarea>
              <div class="row"><button class="btn sm primary" id="tk-desc-save">Save</button><button class="btn sm ghost" id="tk-desc-cancel">Cancel</button></div>
            </div>
          </div></div>

          <div class="card"><div class="card-head"><h3>Checklist <span class="muted num" id="tk-ck-n">${ckDone}/${CHECK.length}</span></h3></div><div class="card-body">
            <div class="bar" id="tk-ck-bar"><i style="width:${Math.round(ckDone / CHECK.length * 100)}%"></i></div>
            <div id="tk-ck">${CHECK.map(([l, d]) => `<div class="ck-row${d ? ' is-done' : ''}"><label><input type="checkbox"${d ? ' checked' : ''}><span>${esc(l)}</span></label><button class="icon-btn" data-mv="-1" aria-label="Move up">↑</button><button class="icon-btn" data-mv="1" aria-label="Move down">↓</button></div>`).join('')}</div>
            <form class="row" id="tk-ck-add" style="margin-top:8px"><input placeholder="Add an item" style="flex:1" aria-label="New checklist item"><button class="btn sm">Add</button></form>
          </div></div>

          <div class="card"><div class="card-head"><h3>Subtasks <span class="muted num">2/4</span></h3><button class="btn sm ghost">Add subtask</button></div><div class="card-body"><div class="list">
            ${[['CPD-142.1', 'Implants page draft', 'done', 'Priya Nair'], ['CPD-142.2', 'Veneers page draft', 'done', 'Priya Nair'], ['CPD-142.3', 'On-page SEO pass', 'in_review', 'Omar Haddad'], ['CPD-142.4', 'Upload to CMS', 'todo', 'Daniel Reyes']]
              .map(([k, l, s, w]) => `<div class="item row between"><span><span class="key">${k}</span> ${esc(l)}</span><span class="row">${status(s)} ${avatar(w, 22)}</span></div>`).join('')}
          </div></div></div>

          <div class="card"><div class="card-head"><h3>Dependencies <span class="p2">phase 2</span></h3><button class="btn sm ghost">Add</button></div><div class="card-body stack">
            <div class="row between"><span>Blocked by <a href="#ticket">CPD-139</a> <span class="muted">Fix duplicate title tags</span></span>${status('done')}</div>
            <div class="row between"><span>Blocks <a href="#ticket">CPD-145</a> <span class="muted">Publish November blog</span></span>${status('todo')}</div>
          </div></div>

          <div class="card"><div class="card-head"><h3>Review</h3><span class="muted small">Round 3 · 2 revisions</span></div><div class="card-body stack">
            <label class="check"><input type="checkbox" checked> Needs review before done</label>
            <div class="form-grid"><div class="field"><label>Reviewer</label><select>${opts(team, 'Omar Haddad')}</select></div><div class="field"><label>QA checklist</label><select><option>SEO content QA</option><option>Web page QA</option></select></div></div>
            <div class="stack">${QA.map((q, i) => `<label class="check"><input type="checkbox"${i < 4 ? ' checked' : ''}> ${esc(q)}</label>`).join('')}</div>
            <div class="field"><label>Note for the reviewer</label><textarea rows="2">Pricing section updated to the October list. FAQ added.</textarea></div>
            <div><button class="btn primary" id="tk-submit-review">Submit for review</button></div>
            <div class="reviewer stack">
              <b>Reviewer view</b>
              <div class="row"><button class="btn primary" id="tk-approve">Approve</button><button class="btn" id="tk-sendback">Send back with changes</button></div>
              <div id="tk-sendback-form" class="stack" hidden>
                <div class="row">${['Missed the brief', 'Quality', 'Accuracy', 'Brand or tone', 'Missing parts'].map(r => `<label class="check"><input type="checkbox"> ${r}</label>`).join('')}</div>
                <div class="field"><label>What to change</label><textarea rows="3" placeholder="Be specific so it can be fixed in one go"></textarea></div>
                <div><button class="btn primary" id="tk-sendback-go">Send back</button></div>
              </div>
              <details><summary>Round 1 · sent back by Omar Haddad · Oct 29</summary><p class="small">Reasons: Missed the brief, Missing parts. "FAQ block missing and H1 does not use the main keyword."</p></details>
              <details><summary>Round 2 · sent back by Omar Haddad · Nov 2</summary><p class="small">Reasons: Accuracy. "Veneers price says AED 1,200; client list says AED 1,450."</p></details>
            </div>
          </div></div>

          <div class="card"><div class="card-head"><h3>Client <span class="p2">phase 2</span></h3></div><div class="card-body stack">
            <label class="check"><input type="checkbox" checked> Show in client portal</label>
            <div class="field"><label>Client-facing title</label><input value="New implants and veneers pages"></div>
            <div class="field"><label>Details for the client</label><textarea rows="2">We are refreshing both pages so they rank for the treatments you want more bookings for.</textarea></div>
            <div class="stack small">${FILES.map(([n], i) => `<label class="check"><input type="checkbox"${i < 2 ? ' checked' : ''}> Share ${esc(n)}</label>`).join('')}</div>
            <label class="check"><input type="checkbox" checked> Needs client approval</label>
          </div></div>

          <div class="card"><div class="card-head"><h3>Files</h3><button class="btn sm ghost">Upload</button></div><div class="card-body">
            <div class="thumbs">${FILES.map(([n, g], i) => `<button class="thumb" data-file="${i}" data-open="ticket-viewer"><i class="${g}"></i><span>${esc(n)}</span></button>`).join('')}</div>
          </div></div>

          <div class="card"><div class="card-head"><h3>Activity</h3></div><div class="card-body stack">
            <div class="tabs" data-tabs="tk-act"><button data-tab="all" class="on">All</button><button data-tab="cmt">Updates &amp; comments</button><button data-tab="hist">History</button></div>
            <form id="tk-post" class="stack">
              <textarea rows="2" placeholder="Write an update or comment" aria-label="Comment"></textarea>
              <div class="row between"><span class="row"><label class="check"><input type="checkbox" id="tk-prog"> Progress update</label><label class="check"><input type="checkbox" id="tk-client"> Reply to the client</label></span><button class="btn primary sm">Post</button></div>
            </form>
            <section data-panel="tk-act:all"><div id="tk-feed">${feed(true)}</div></section>
            <section data-panel="tk-act:cmt" hidden>${feed(false)}</section>
            <section data-panel="tk-act:hist" hidden>${hist()}</section>
          </div></div>
        </div>

        <aside class="card"><div class="card-body"><dl class="dl">
          <dt>Department</dt><dd><select>${opts(DEPTS, 'Content')}</select></dd>
          <dt>Project</dt><dd><select>${opts(PROJECTS.map(p => p.name), 'Cedar & Pine SEO')}</select></dd>
          <dt>Status</dt><dd><select id="tk-status">${opts(STATUSES, 'in_review')}</select></dd>
          <dt>Priority</dt><dd><select>${opts(PRIS, 'high')}</select></dd>
          <dt>Assignee</dt><dd><select>${opts(team, 'Priya Nair')}</select></dd>
          <dt>Co-assignees</dt><dd class="row">${avs(['Omar Haddad', 'Daniel Reyes'])}<button class="btn sm ghost">+ Add</button></dd>
          <dt>Due</dt><dd><input type="date" value="2026-11-04"></dd>
          <dt>Estimate</dt><dd><input value="6h"></dd>
          <dt>Start</dt><dd><input type="date" value="2026-10-27"></dd>
          <dt>Tags</dt><dd><input value="content, onpage"></dd>
          <dt>Reporter</dt><dd class="row">${avatar('Hamza Qureshi', 22)} Hamza Qureshi</dd>
          <dt>Source</dt><dd>Client request · Oct 26 call</dd>
          <dt>Watchers</dt><dd>${avs(['Sara Malik', 'Hamza Qureshi', 'Omar Haddad'], 22)}</dd>
          <dt>Time logged</dt><dd><b class="num" id="tk-logged">6h 40m</b> <span class="muted">of 6h</span></dd>
          <dt>Timer</dt><dd class="row"><span class="timer" id="tk-timer">00:00</span><button class="btn sm primary" id="tk-timer-btn">Start timer</button></dd>
          <dt></dt><dd><button class="btn sm" data-open="ticket-logtime">Log time</button></dd>
        </dl></div></aside>
      </div>
      ${ticketDialogs()}`);
    },
    mount(root) {
      const $ = s => root.querySelector(s), $$ = s => [...root.querySelectorAll(s)];
      // title edit
      const h = $('#tk-title');
      h.addEventListener('click', () => {
        if (h.querySelector('input')) return;
        const old = h.textContent; h.innerHTML = `<input class="tk-title-input" value="${esc(old)}" aria-label="Ticket title">`;
        const i = h.querySelector('input'); i.focus(); i.select();
        let done = false;
        const save = keep => { if (done) return; done = true; const v = keep ? i.value.trim() || old : old; h.textContent = v; if (keep && v !== old) K.toast('Title saved'); };
        i.addEventListener('keydown', e => { if (e.key === 'Enter') save(true); if (e.key === 'Escape') save(false); });
        i.addEventListener('blur', () => save(true));
      });
      // header actions
      $('#tk-watch').addEventListener('click', e => { const on = e.target.textContent === 'Watch'; e.target.textContent = on ? 'Watching' : 'Watch'; K.toast(on ? 'You will get updates on this ticket' : 'Stopped watching'); });
      $('#tk-copylink').addEventListener('click', () => K.toast('Link copied'));
      // description edit
      const dv = $('#tk-desc-view'), df = $('#tk-desc-form');
      const tog = edit => { dv.hidden = edit; df.hidden = !edit; };
      $('#tk-desc-edit').addEventListener('click', () => tog(true));
      $('#tk-desc-cancel').addEventListener('click', () => tog(false));
      $('#tk-desc-save').addEventListener('click', () => {
        const [a, b] = df.querySelectorAll('textarea');
        dv.querySelector('p').textContent = a.value; dv.querySelector('div p').textContent = b.value; tog(false); K.toast('Description saved');
      });
      // checklist
      const ck = $('#tk-ck');
      const upd = () => { const all = ck.querySelectorAll('.ck-row'), d = ck.querySelectorAll('input:checked').length; $('#tk-ck-n').textContent = `${d}/${all.length}`; $('#tk-ck-bar i').style.width = Math.round(d / (all.length || 1) * 100) + '%'; };
      ck.addEventListener('change', e => { const r = e.target.closest('.ck-row'); if (r) r.classList.toggle('is-done', e.target.checked); upd(); });
      ck.addEventListener('click', e => {
        const b = e.target.closest('[data-mv]'); if (!b) return; const r = b.closest('.ck-row');
        if (b.dataset.mv === '-1' && r.previousElementSibling) ck.insertBefore(r, r.previousElementSibling);
        if (b.dataset.mv === '1' && r.nextElementSibling) ck.insertBefore(r.nextElementSibling, r);
      });
      const addF = $('#tk-ck-add');
      root.addEventListener('submit', e => {
        if (e.target !== addF) return;
        e.preventDefault(); e.stopPropagation(); const i = addF.querySelector('input'); const v = i.value.trim(); if (!v) return;
        ck.insertAdjacentHTML('beforeend', `<div class="ck-row"><label><input type="checkbox"><span>${esc(v)}</span></label><button class="icon-btn" data-mv="-1" aria-label="Move up">↑</button><button class="icon-btn" data-mv="1" aria-label="Move down">↓</button></div>`);
        i.value = ''; upd();
      }, true);
      // review
      $('#tk-submit-review').addEventListener('click', () => K.toast('Sent to Omar Haddad for review'));
      $('#tk-approve').addEventListener('click', () => { $('#tk-status').value = 'done'; K.toast('Approved. Ticket marked done'); });
      $('#tk-sendback').addEventListener('click', () => { const f = $('#tk-sendback-form'); f.hidden = !f.hidden; });
      $('#tk-sendback-go').addEventListener('click', () => { $('#tk-sendback-form').hidden = true; $('#tk-status').value = 'in_progress'; K.toast('Sent back to Priya Nair. Round 4 started'); });
      // file viewer
      let fi = 0;
      const show = () => { const [n, g] = FILES[fi]; const d = document.getElementById('ticket-viewer'); d.querySelector('.viewer-img').className = 'viewer-img ' + g; d.querySelector('[data-name]').textContent = n; d.querySelector('[data-pos]').textContent = `${fi + 1} of ${FILES.length}`; };
      $$('[data-file]').forEach(b => b.addEventListener('click', () => { fi = +b.dataset.file; show(); }));
      const dlg = root.querySelector('#ticket-viewer');
      dlg.querySelector('[data-prev]').addEventListener('click', () => { fi = (fi + FILES.length - 1) % FILES.length; show(); });
      dlg.querySelector('[data-next]').addEventListener('click', () => { fi = (fi + 1) % FILES.length; show(); });
      // activity post
      const post = $('#tk-post');
      root.addEventListener('submit', e => {
        if (e.target !== post) return;
        e.preventDefault(); e.stopPropagation(); const ta = post.querySelector('textarea'); const v = ta.value.trim(); if (!v) return;
        const kind = $('#tk-client').checked ? ' · to client' : $('#tk-prog').checked ? ' · progress update' : '';
        $('#tk-feed').insertAdjacentHTML('afterbegin', cmt(ME.name, 'Just now' + kind, v, 'Sent'));
        ta.value = ''; K.toast('Posted');
      }, true);
      // timer
      const btn = $('#tk-timer-btn'), out = $('#tk-timer'); let iv = null, sec = 0;
      btn.addEventListener('click', () => {
        if (iv) { clearInterval(iv); iv = null; btn.textContent = 'Start timer'; K.toast(`Logged ${Math.max(1, Math.round(sec / 60))} min`); return; }
        btn.textContent = 'Stop';
        iv = setInterval(() => {
          if (!document.body.contains(out)) { clearInterval(iv); return; }
          sec++; out.textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
        }, 1000);
      });
    },
  });

  function cmt(who, when, text, seen) {
    return `<div class="cmt">${avatar(who, 28)}<div style="flex:1"><div class="who"><b>${esc(who)}</b> <span class="muted small">${esc(when)}</span></div><p>${esc(text)}</p>${seen ? `<div class="seen">✓✓ ${esc(seen)}</div>` : ''}</div></div>`;
  }
  function feed(withHist) {
    const c = [
      cmt('Omar Haddad', 'Today 10:12 · review', 'Pricing now matches. One alt text still says "image1". Fix that and I will approve.', 'Seen by 3'),
      cmt('Priya Nair', 'Yesterday 17:40 · progress update', 'Round 3 ready. Updated veneers price to AED 1,450 and added the FAQ block.', 'Seen by 4'),
      cmt('Hamza Qureshi', 'Nov 2 · to client', 'Dr. Rania confirmed the October price list is final. Attached in files.', 'Seen by client'),
    ];
    if (!withHist) return c.join('');
    return c[0] + `<div class="hist">Omar Haddad changed status to In review · Today 09:58</div>` + c[1] + c[2] + `<div class="hist">Priya Nair logged 2h 10m · Nov 2</div>`;
  }
  function hist() {
    return [
      'Omar Haddad changed status from In progress to In review · Today 09:58',
      'Priya Nair checked "Before / after image alt text" · Yesterday 17:31',
      'Omar Haddad sent back with changes (Accuracy) · Nov 2 15:04',
      'Priya Nair logged 2h 10m · Nov 2',
      'Sara Malik changed priority from Normal to High · Oct 30',
      'Omar Haddad sent back with changes (Missed the brief, Missing parts) · Oct 29',
      'Hamza Qureshi created this ticket from a client request · Oct 26',
    ].map(l => `<div class="hist">${esc(l)}</div>`).join('');
  }
  const ticketDialogs = () => `
  <dialog id="ticket-copy" class="modal"><form method="dialog">
    <div class="modal-head"><h3>Copy ticket</h3><button type="button" class="icon-btn" data-close aria-label="Close">×</button></div>
    <div class="modal-body"><div class="form-grid">
      <div class="field full"><label>Copy to project</label><select>${opts(PROJECTS.map(p => p.name))}</select></div>
      <div class="field full"><label>New title</label><input value="Copy of: Rewrite service pages for implants and veneers"></div>
      <label class="check"><input type="checkbox" checked> Checklist</label><label class="check"><input type="checkbox" checked> Subtasks</label>
      <label class="check"><input type="checkbox"> Files</label><label class="check"><input type="checkbox"> Assignees</label>
    </div></div>
    <div class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Copy ticket</button></div>
  </form></dialog>
  <dialog id="ticket-repeat" class="modal"><form method="dialog">
    <div class="modal-head"><h3>Repeat this ticket</h3><button type="button" class="icon-btn" data-close aria-label="Close">×</button></div>
    <div class="modal-body"><div class="form-grid">
      <div class="field"><label>Repeats</label><select><option>Daily</option><option>Weekdays</option><option>Weekly</option><option selected>Monthly</option></select></div>
      <div class="field"><label>On day</label><input type="number" value="1" min="1" max="28"></div>
      <div class="field"><label>Due after (days)</label><input type="number" value="5"></div>
      <div class="field"><label>Start</label><input type="date" value="2026-12-01"></div>
    </div></div>
    <div class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Save repeat</button></div>
  </form></dialog>
  <dialog id="ticket-delete" class="modal"><form method="dialog">
    <div class="modal-head"><h3>Delete CPD-142?</h3><button type="button" class="icon-btn" data-close aria-label="Close">×</button></div>
    <div class="modal-body"><p>This removes the ticket, its checklist, 4 files and 12 comments. You can't undo this.</p></div>
    <div class="modal-foot"><button type="button" class="btn ghost" data-close>Keep ticket</button><button class="btn danger">Delete ticket</button></div>
  </form></dialog>
  <dialog id="ticket-logtime" class="modal"><form method="dialog">
    <div class="modal-head"><h3>Log time</h3><button type="button" class="icon-btn" data-close aria-label="Close">×</button></div>
    <div class="modal-body"><div class="form-grid">
      <div class="field"><label>Date</label><input type="date" value="2026-11-04"></div>
      <div class="field"><label>Time spent</label><input value="1h 30m" required></div>
      <div class="field full"><label>What you did</label><textarea rows="2">Fixed alt text and final proofread</textarea></div>
      <label class="check"><input type="checkbox" checked> Billable</label>
    </div></div>
    <div class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Log time</button></div>
  </form></dialog>
  <dialog id="ticket-viewer" class="modal">
    <div class="modal-head"><h3 data-name>${esc(FILES[0][0])}</h3><button type="button" class="icon-btn" data-close aria-label="Close">×</button></div>
    <div class="modal-body"><div class="viewer-img g1"></div></div>
    <div class="modal-foot"><span class="muted small" data-pos>1 of 4</span><button type="button" class="btn" data-prev>Previous</button><button type="button" class="btn" data-next>Next</button><button type="button" class="btn primary">Download</button></div>
  </dialog>`;

  /* =====================================================================
     PROJECTS
     ===================================================================== */
  const PROJ_STATS = { CPD: [14, 2, 23], ALB: [11, 1, 31], LUM: [17, 3, 19], HBR: [12, 1, 9], NOV: [9, 1, 12] };
  const ALL_PROJ = [...PROJECTS.map(p => ({ ...p, state: 'active', s: PROJ_STATS[p.key] })),
    { key: 'ZST', name: 'Zest Kitchen Search Ads', client: 'Zest Kitchen', lead: 'Ayesha Khan', dept: 'PPC', state: 'active', s: [6, 0, 14] },
    { key: 'CNT', name: 'Content Retainer 2025', client: 'Cedar & Pine Dental', lead: 'Priya Nair', dept: 'Content', state: 'archived', s: [0, 0, 0] }];

  screen({
    id: 'projects', title: 'Projects', group: 'Work',
    render() {
      const depts = [...new Set(ALL_PROJ.map(p => p.dept))];
      const card = p => `<div class="card pcard" data-state="${p.state}" data-text="${esc((p.name + ' ' + p.key + ' ' + p.client).toLowerCase())}"><div class="card-body stack">
        <div class="row between"><h4>${esc(p.name)}</h4><span class="key">${p.key}</span></div>
        <div class="muted small">${esc(p.client)}${p.state === 'archived' ? ' · Archived' : ''}</div>
        <div class="row small">${avatar(p.lead, 22)} ${esc(p.lead)}</div>
        <div class="meta"><span><b class="num">${p.s[0]}</b> open</span><span class="${p.s[1] ? 't-danger' : ''}"><b class="num">${p.s[1]}</b> overdue</span><span><b class="num">${p.s[2]}</b> done in 30 days</span></div>
        <div class="row"><a class="btn sm" href="#tickets">Board</a><a class="btn sm" href="#tickets">Calendar</a><button class="btn sm ghost" data-open="projects-edit">Edit</button></div>
      </div></div>`;
      return wrap(`
      <div class="head-row">
        <div class="row"><input type="search" id="pj-q" placeholder="Search projects" aria-label="Search projects"><div class="seg" id="pj-seg"><button data-s="active" class="on">Active</button><button data-s="archived">Archived</button><button data-s="all">All</button></div></div>
        <button class="btn primary" data-open="projects-edit">New project</button>
      </div>
      ${depts.map(d => `<section class="stack pj-group"><h3 class="dept-h">${esc(d)}</h3><div class="grid-3">${ALL_PROJ.filter(p => p.dept === d).map(card).join('')}</div></section>`).join('')}
      <dialog id="projects-edit" class="modal"><form method="dialog">
        <div class="modal-head"><h3>Project</h3><button type="button" class="icon-btn" data-close aria-label="Close">×</button></div>
        <div class="modal-body"><div class="form-grid">
          <div class="field"><label>Name</label><input required value="Cedar & Pine SEO"></div>
          <div class="field"><label>Key</label><input required pattern="[A-Za-z]{2,8}" value="CPD" title="2 to 8 letters"><div class="help">Ticket numbers start with this, like CPD-142.</div></div>
          <div class="field"><label>Department</label><select>${opts(DEPTS, 'SEO')}</select></div>
          <div class="field"><label>Client</label><select>${opts(CLIENTS.map(c => c.name))}</select></div>
          <div class="field"><label>Lead</label><select>${opts(team, 'Omar Haddad')}</select></div>
          <div class="field"><label>Reviewer</label><select>${opts(team, 'Sara Malik')}</select></div>
          <div class="field full"><label>What it covers</label><textarea rows="2">Monthly SEO retainer: on-page, content, local listings and reporting.</textarea></div>
          <label class="check"><input type="checkbox" checked> Tickets need review before done</label>
        </div></div>
        <div class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Save project</button></div>
      </form></dialog>`);
    },
    mount(root) {
      let s = 'active'; const q = root.querySelector('#pj-q');
      const apply = () => {
        const v = q.value.trim().toLowerCase();
        root.querySelectorAll('.pcard').forEach(c => { c.hidden = !((s === 'all' || c.dataset.state === s) && (!v || c.dataset.text.includes(v))); });
        root.querySelectorAll('.pj-group').forEach(g => { g.hidden = !g.querySelector('.pcard:not([hidden])'); });
      };
      root.querySelector('#pj-seg').addEventListener('click', e => {
        const b = e.target.closest('[data-s]'); if (!b) return; s = b.dataset.s;
        root.querySelectorAll('#pj-seg [data-s]').forEach(x => x.classList.toggle('on', x === b)); apply();
      });
      q.addEventListener('input', apply); apply();
    },
  });

  /* =====================================================================
     REVIEWS + QUALITY REPORT
     ===================================================================== */
  const MY_REVIEWS = [['CPD-142', 2, 'Priya Nair', 'Cedar & Pine SEO', 31], ['HBR-63', 1, 'Omar Haddad', 'Harbor Website', 6], ['NOV-12', 1, 'Zara Farooq', 'Nova Social', 27]];
  const TEAM_REVIEWS = [['ALB-90', 1, 'Lina Saeed', 'Alba Motors Ads', 4, 'Ayesha Khan'], ['LUM-219', 2, 'Daniel Reyes', 'Luma Growth', 19, 'Omar Haddad'], ['CPD-149', 1, 'Hamza Qureshi', 'Cedar & Pine SEO', 50, 'Sara Malik'], ['HBR-62', 3, 'Daniel Reyes', 'Harbor Website', 2, 'Omar Haddad']];
  const wait = h => h > 24 ? tone(`${h}h`, 'warn') : `<span class="num">${h}h</span>`;
  const PERIODS = { d30: [42, '71%', '1.4', '19h', 6], d90: [131, '68%', '1.5', '22h', 17], y: [512, '73%', '1.3', '17h', 41] };

  screen({
    id: 'reviews', title: 'Reviews', group: 'Work',
    render() {
      const qRow = ([k, r, o, p, h, rv]) => `<tr class="click"><td><a href="#ticket">${k}</a> <span class="muted">· round ${r}</span></td><td><span class="row" style="flex-wrap:nowrap">${avatar(o, 22)} ${esc(o)}</span></td><td>${esc(p)}</td>${rv ? `<td class="hide-sm">${esc(rv)}</td>` : ''}<td>${wait(h)}</td></tr>`;
      const [n, pass, rounds, turn, late] = PERIODS.d30;
      const reasons = [['Missed the brief', 14], ['Accuracy', 11], ['Quality', 9], ['Missing parts', 7], ['Brand or tone', 4]];
      const fails = [['Links tested', 9], ['Meta title under 60 characters', 7], ['Keyword placement matches brief', 6], ['Images compressed', 4]];
      const tbl = (head, rows) => `<div class="table-wrap"><table class="tbl"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      const H = ['Reviewed', 'First-time pass', 'Avg rounds', 'Avg wait'];
      return wrap(`
      <div class="head-row">
        <h2 id="rv-title">Review queue</h2>
        <div class="row"><button class="btn" data-open="reviews-qa">QA checklists</button><button class="btn primary" id="rv-toggle">Quality report</button></div>
      </div>

      <section id="rv-queue" class="stack" style="gap:20px">
        <div class="card"><div class="card-head"><h3>Waiting for me <span class="muted num">${MY_REVIEWS.length}</span></h3></div>
          <div class="table-wrap"><table class="tbl"><thead><tr><th>Ticket</th><th>Owner</th><th>Project</th><th>Waiting</th></tr></thead><tbody>${MY_REVIEWS.map(qRow).join('')}</tbody></table></div></div>
        <div class="card"><div class="card-head"><h3>Team queue <span class="muted num">${TEAM_REVIEWS.length}</span></h3></div>
          <div class="table-wrap"><table class="tbl"><thead><tr><th>Ticket</th><th>Owner</th><th>Project</th><th class="hide-sm">Reviewer</th><th>Waiting</th></tr></thead><tbody>${TEAM_REVIEWS.map(qRow).join('')}</tbody></table></div></div>
      </section>

      <section id="rv-report" class="stack" style="gap:20px" hidden>
        <div class="row between"><div class="seg" id="rv-period"><button data-p="d30" class="on">30 days</button><button data-p="d90">90 days</button><button data-p="y">Last year</button></div><button class="btn ghost" id="rv-back">Back to queue</button></div>
        <div class="stats">
          <div class="stat"><div class="label">Tickets reviewed</div><div class="value num" data-k="0">${n}</div></div>
          <div class="stat"><div class="label">Passed first time</div><div class="value num t-ok" data-k="1">${pass}</div></div>
          <div class="stat"><div class="label">Avg review rounds</div><div class="value num" data-k="2">${rounds}</div></div>
          <div class="stat"><div class="label">Avg wait for review</div><div class="value num" data-k="3">${turn}</div><div class="sub">Target under 24h</div></div>
          <div class="stat"><div class="label">Waited over 24h</div><div class="value num t-warn" data-k="4">${late}</div></div>
        </div>
        <div class="grid-2">
          <div class="card"><div class="card-head"><h3>Why work goes back</h3></div><div class="card-body">${reasons.map(([r, v]) => `<div class="reason"><span>${r}</span><div class="bar t-warn"><i style="width:${Math.round(v / 14 * 100)}%"></i></div><span class="num right">${v}</span></div>`).join('')}</div></div>
          <div class="card"><div class="card-head"><h3>QA checks failed most <span class="p2">phase 2</span></h3></div><div class="card-body">${fails.map(([r, v]) => `<div class="reason"><span>${r}</span><div class="bar t-danger"><i style="width:${Math.round(v / 9 * 100)}%"></i></div><span class="num right">${v}</span></div>`).join('')}</div></div>
        </div>
        <div class="card"><div class="card-body stack">
          <div class="tabs" data-tabs="rv-by"><button data-tab="people" class="on">People</button><button data-tab="dept">Departments</button><button data-tab="clients">Clients</button><button data-tab="svc">Services <span class="p2">phase 2</span></button><button data-tab="most">Most revised <span class="p2">phase 2</span></button></div>
          <section data-panel="rv-by:people">${tbl(['Person', ...H], [['Priya Nair', 11, '64%', '1.6', '21h'], ['Omar Haddad', 8, '88%', '1.1', '12h'], ['Daniel Reyes', 9, '67%', '1.5', '18h'], ['Lina Saeed', 6, '83%', '1.2', '15h'], ['Zara Farooq', 5, '60%', '1.6', '26h'], ['Ayesha Khan', 3, '67%', '1.3', '9h']].map(r => [`<span class="row" style="flex-wrap:nowrap">${avatar(r[0], 22)} ${r[0]}</span>`, ...r.slice(1)]))}</section>
          <section data-panel="rv-by:dept" hidden>${tbl(['Department', ...H], [['SEO', 12, '75%', '1.3', '16h'], ['Content', 11, '64%', '1.6', '21h'], ['Web', 9, '67%', '1.5', '18h'], ['Design', 6, '83%', '1.2', '15h'], ['Social', 4, '50%', '1.8', '28h']])}</section>
          <section data-panel="rv-by:clients" hidden>${tbl(['Client', ...H], [['Cedar & Pine Dental', 13, '62%', '1.6', '22h'], ['Harbor Legal', 10, '70%', '1.4', '17h'], ['Luma Skincare', 9, '78%', '1.3', '14h'], ['Alba Motors', 6, '83%', '1.2', '11h'], ['Nova Fitness', 4, '50%', '1.8', '30h']])}</section>
          <section data-panel="rv-by:svc" hidden>${tbl(['Service', ...H], [['SEO', 15, '73%', '1.3', '16h'], ['Content', 11, '64%', '1.6', '21h'], ['Web', 8, '63%', '1.6', '19h'], ['PPC', 5, '80%', '1.2', '10h'], ['Social', 3, '67%', '1.4', '24h']])}</section>
          <section data-panel="rv-by:most" hidden>${tbl(['Ticket', 'Owner', 'Rounds', 'Main reason'], [['<a href="#ticket">HBR-62</a> Practice area copy', 'Daniel Reyes', 3, 'Missing parts'], ['<a href="#ticket">CPD-142</a> Service pages rewrite', 'Priya Nair', 3, 'Accuracy'], ['<a href="#ticket">NOV-9</a> October content calendar', 'Zara Farooq', 3, 'Brand or tone'], ['<a href="#ticket">LUM-219</a> Core Web Vitals fixes', 'Daniel Reyes', 2, 'Quality']])}</section>
        </div></div>
      </section>

      <dialog id="reviews-qa" class="modal"><div class="modal-head"><h3>QA checklists</h3><button type="button" class="icon-btn" data-close aria-label="Close">×</button></div>
        <div class="modal-body stack">
          ${[['SEO content QA', 'SEO, Content', 5, true], ['Web page QA', 'Web', 7, true], ['Ad launch QA', 'PPC', 6, true], ['Social post QA', 'Social', 4, false]].map(([nm, sv, c, on]) => `<div class="card qa-card${on ? '' : ' off'}"><div class="card-body row between"><div><b>${nm}</b><div class="muted small">${sv} · ${c} checks${on ? '' : ' · Switched off'}</div></div><div class="row"><button class="btn sm ghost">Edit</button><button class="btn sm" data-qa-toggle>${on ? 'Switch off' : 'Switch on'}</button></div></div></div>`).join('')}
        </div>
        <div class="modal-foot"><button type="button" class="btn ghost" data-close>Close</button><button type="button" class="btn primary">New checklist</button></div>
      </dialog>`);
    },
    mount(root) {
      const $ = s => root.querySelector(s);
      const show = rep => { $('#rv-queue').hidden = rep; $('#rv-report').hidden = !rep; $('#rv-title').textContent = rep ? 'Quality report' : 'Review queue'; $('#rv-toggle').textContent = rep ? 'Review queue' : 'Quality report'; };
      $('#rv-toggle').addEventListener('click', () => show($('#rv-report').hidden));
      $('#rv-back').addEventListener('click', () => show(false));
      $('#rv-period').addEventListener('click', e => {
        const b = e.target.closest('[data-p]'); if (!b) return;
        root.querySelectorAll('#rv-period [data-p]').forEach(x => x.classList.toggle('on', x === b));
        PERIODS[b.dataset.p].forEach((v, i) => { root.querySelector(`[data-k="${i}"]`).textContent = v; });
      });
      root.querySelector('#reviews-qa').addEventListener('click', e => {
        const b = e.target.closest('[data-qa-toggle]'); if (!b) return;
        const c = b.closest('.qa-card'), off = c.classList.toggle('off'); b.textContent = off ? 'Switch on' : 'Switch off';
        const m = c.querySelector('.muted'); m.textContent = m.textContent.replace(' · Switched off', '') + (off ? ' · Switched off' : '');
      });
    },
  });

  /* =====================================================================
     TEMPLATES
     ===================================================================== */
  var TEMPLATES = [
    { name: 'Monthly SEO report', svc: 'SEO', pattern: '{client} SEO report · {month}', ck: 7, sub: 0, dept: 'SEO', used: 38 },
    { name: 'Technical SEO audit', svc: 'SEO', pattern: '{client} technical audit', ck: 12, sub: 3, dept: 'SEO', used: 9 },
    { name: 'Local citations batch', svc: 'SEO', pattern: '{project} citations · {date}', ck: 10, sub: 0, dept: 'SEO', used: 14 },
    { name: 'Blog post', svc: 'Content', pattern: '{client} blog: {month}', ck: 6, sub: 2, dept: 'Content', used: 52 },
    { name: 'Service page rewrite', svc: 'Content', pattern: '{client} service page rewrite', ck: 6, sub: 4, dept: 'Content', used: 14 },
    { name: 'Campaign launch', svc: 'PPC', pattern: '{client} campaign launch · {date}', ck: 9, sub: 2, dept: 'PPC', used: 21 },
    { name: 'Weekly budget pacing', svc: 'PPC', pattern: '{project} pacing · {date}', ck: 3, sub: 0, dept: 'PPC', used: 64 },
    { name: 'Landing page build', svc: 'Web', pattern: '{client} landing page', ck: 11, sub: 3, dept: 'Web', used: 7 },
    { name: 'WordPress plugin updates', svc: 'Web', pattern: '{project} updates · {month}', ck: 5, sub: 0, dept: 'Web', used: 18, off: true },
    { name: 'Monthly content calendar', svc: 'Social', pattern: '{client} content calendar · {month}', ck: 4, sub: 1, dept: 'Social', used: 23 },
  ];

  screen({
    id: 'templates', title: 'Ticket templates', group: 'Work',
    render() {
      const svcs = ['SEO', 'Content', 'PPC', 'Web', 'Social'];
      const card = t => `<div class="card pcard${t.off ? ' off' : ''}"><div class="card-body stack">
        <div class="row between"><h4>${esc(t.name)}</h4><button class="btn sm ghost" data-open="templates-edit">Edit</button></div>
        <div><code>${esc(t.pattern)}</code></div>
        <div class="meta"><span>${t.ck} checklist items · ${t.sub} subtasks</span><span>${esc(t.dept)}</span><span>Used ${t.used} times</span></div>
        ${t.off ? '<div class="muted small">Switched off. Not offered when creating tickets.</div>' : ''}
      </div></div>`;
      return wrap(`
      <div class="head-row"><p class="muted" style="margin:0">Start new tickets with the checklist and subtasks already filled in.</p><button class="btn primary" data-open="templates-edit">New template</button></div>
      ${svcs.map(s => `<section class="stack"><h3 class="dept-h">${s}</h3><div class="grid-3">${TEMPLATES.filter(t => t.svc === s).map(card).join('')}</div></section>`).join('')}
      <dialog id="templates-edit" class="modal"><form method="dialog">
        <div class="modal-head"><h3>Template</h3><button type="button" class="icon-btn" data-close aria-label="Close">×</button></div>
        <div class="modal-body"><div class="form-grid">
          <div class="field"><label>Name</label><input required value="Monthly SEO report"></div>
          <div class="field"><label>Service</label><select>${opts(svcs, 'SEO')}</select></div>
          <div class="field full"><label>Ticket title</label><input value="{client} SEO report · {month}"><div class="help">Fills in automatically: <code>{client}</code> <code>{project}</code> <code>{month}</code> <code>{date}</code></div></div>
          <div class="field"><label>Department</label><select>${opts(DEPTS, 'SEO')}</select></div>
          <div class="field"><label>Default assignee</label><select><option>Project lead</option>${opts(team)}</select></div>
          <div class="field"><label>Priority</label><select>${opts(PRIS, 'high')}</select></div>
          <div class="field"><label>Due after (days)</label><input type="number" value="5"></div>
          <div class="field"><label>Estimate</label><input value="3h"></div>
          <div class="field"><label>QA checklist</label><select><option>SEO content QA</option><option>Web page QA</option><option>Ad launch QA</option><option>None</option></select></div>
          <div class="field full"><label>Description</label><textarea rows="2">Pull rankings, traffic and conversions for {month}. Summarise wins and next steps for {client}.</textarea></div>
          <div class="field full"><label>Done when</label><textarea rows="2">Report sent to the client and logged in the client file.</textarea></div>
          <div class="field full"><label>Checklist (one per line)</label><textarea rows="5">Export Search Console data
Export GA4 conversions
Update rank tracker
Write summary
Add next month plan
Design check
Send to client</textarea></div>
          <div class="field full"><label>Subtasks (one per line)</label><textarea rows="2"></textarea></div>
          <label class="check"><input type="checkbox" checked> Needs review before done</label>
          <label class="check"><input type="checkbox" checked> Template is on</label>
        </div></div>
        <div class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Save template</button></div>
      </form></dialog>`);
    },
  });

  /* =====================================================================
     RECURRING
     ===================================================================== */
  const RULES = [
    ['Monthly SEO report', '{client} SEO report · {month}', 'Cedar & Pine SEO', 'Omar Haddad', 'Monthly on day 1', 'Dec 1', true],
    ['Monthly SEO report', '{client} SEO report · {month}', 'Luma Growth', 'Omar Haddad', 'Monthly on day 1', 'Dec 1', true],
    ['Weekly budget pacing', '{project} pacing · {date}', 'Alba Motors Ads', 'Ayesha Khan', 'Weekly on Monday', 'Nov 9', true],
    ['Monthly content calendar', '{client} content calendar · {month}', 'Nova Social', 'Zara Farooq', 'Monthly on day 20', 'Nov 20', true],
    ['WordPress plugin updates', '{project} updates · {month}', 'Harbor Website', 'Daniel Reyes', 'Monthly on day 15', 'Paused', false],
    ['Blog post', '{client} blog: {month}', 'Cedar & Pine SEO', 'Priya Nair', 'Monthly on day 5', 'Dec 5', true],
    ['Daily inbox check', 'Client inbox triage · {date}', 'Cedar & Pine SEO', 'Hamza Qureshi', 'Weekdays', 'Nov 5', true],
  ];
  screen({
    id: 'recurring', title: 'Recurring tickets', group: null,
    render() {
      return wrap(`
      <div class="crumb"><a href="#tickets">Tickets</a> / <span>Recurring</span></div>
      <div class="head-row"><h2>Recurring tickets <span class="p2">phase 2</span></h2><button class="btn primary" data-open="recurring-new">New rule</button></div>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Template</th><th>Ticket title</th><th>Project</th><th class="hide-sm">Assignee</th><th>Repeats</th><th>Next run</th><th>State</th><th></th></tr></thead><tbody>
        ${RULES.map(([tp, ti, p, a, r, nx, on]) => `<tr data-next="${esc(nx === 'Paused' ? 'Dec 1' : nx)}"><td>${esc(tp)}</td><td><code>${esc(ti)}</code></td><td>${esc(p)}</td><td class="hide-sm"><span class="row" style="flex-wrap:nowrap">${avatar(a, 22)} ${esc(a)}</span></td><td>${esc(r)}</td><td class="num" data-nx>${on ? esc(nx) : '<span class="muted">None</span>'}</td><td data-st>${on ? tone('Active', 'ok') : tone('Paused', 'muted')}</td><td class="right"><button class="btn sm" data-pause>${on ? 'Pause' : 'Resume'}</button></td></tr>`).join('')}
      </tbody></table></div>
      <dialog id="recurring-new" class="modal"><form method="dialog">
        <div class="modal-head"><h3>New recurring rule</h3><button type="button" class="icon-btn" data-close aria-label="Close">×</button></div>
        <div class="modal-body"><div class="form-grid">
          <div class="field"><label>Template</label><select>${opts(TEMPLATES.filter(t => !t.off).map(t => t.name))}</select></div>
          <div class="field"><label>Ticket title</label><input value="{client} SEO report · {month}"></div>
          <div class="field"><label>Project</label><select>${opts(PROJECTS.map(p => p.name))}</select></div>
          <div class="field"><label>Assignee</label><select>${opts(team, 'Omar Haddad')}</select></div>
          <div class="field"><label>Repeats</label><select><option>Daily</option><option>Weekdays</option><option>Weekly</option><option selected>Monthly</option></select></div>
          <div class="field"><label>Day</label><input type="number" value="1" min="1" max="28"></div>
          <div class="field"><label>Due after (days)</label><input type="number" value="5"></div>
          <div class="field"><label>Start</label><input type="date" value="2026-12-01"></div>
        </div></div>
        <div class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Create rule</button></div>
      </form></dialog>`);
    },
    mount(root) {
      root.querySelector('tbody').addEventListener('click', e => {
        const b = e.target.closest('[data-pause]'); if (!b) return;
        const tr = b.closest('tr'), pause = b.textContent === 'Pause';
        tr.querySelector('[data-st]').innerHTML = pause ? tone('Paused', 'muted') : tone('Active', 'ok');
        tr.querySelector('[data-nx]').innerHTML = pause ? '<span class="muted">None</span>' : esc(tr.dataset.next);
        b.textContent = pause ? 'Resume' : 'Pause';
        K.toast(pause ? 'Rule paused' : 'Rule resumed');
      });
    },
  });
})();

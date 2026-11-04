/* Core screens: home, my-work, calendar. Owned by the Core agent. */
(function () {
  const { screen, esc, avatar, status, tone, priority, money, PEOPLE, CLIENTS, PROJECTS, ME } = K;
  const TODAY = K.TODAY;
  const NOW_MIN = 10 * 60 + 42; // sample "now": 10:42
  const BASE_CSS = '.scr-core-late{color:var(--danger)}.scr-core-who{display:inline-flex;gap:6px;align-items:center;white-space:nowrap}.scr-core-nowrap{white-space:nowrap}';

  /* ---------- date helpers (UTC, no timezone drift) ---------- */
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const DAYS_L = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MON_L = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const D = s => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const iso = d => d.toISOString().slice(0, 10);
  const add = (s, n) => { const d = D(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
  const dow = s => D(s).getUTCDay();
  const dnum = s => D(s).getUTCDate();
  const fmtShort = s => { const d = D(s); return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MON[d.getUTCMonth()]}`; };
  const fmtLong = s => { const d = D(s); return `${DAYS_L[d.getUTCDay()]}, ${d.getUTCDate()} ${MON_L[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
  const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const fmtT = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const range = (start, mins) => `${start}–${fmtT(toMin(start) + mins)}`;
  const weekStart = s => add(s, -((dow(s) + 6) % 7));
  const isWeekend = s => dow(s) === 0 || dow(s) === 6;
  const first = arr => arr[0];
  const projName = key => (PROJECTS.find(p => p.key === key) || {}).name || key;
  const projClient = key => (PROJECTS.find(p => p.key === key) || {}).client || '';
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  /* ---------- tickets ---------- */
  const T = (key, title, proj, st, pri, assignee, reporter, watchers, due, sub, check, com, done) =>
    ({ key, title, proj, status: st, pri, assignee, reporter, watchers, due, sub, check, com, done });
  const S = ME.name;
  const TICKETS = [
    T('CPD-142', 'Fix canonical tags on service pages', 'CPD', 'in_progress', 'high', S, 'Omar Haddad', ['Hamza Qureshi'], -2, 3, '2/5', 4),
    T('ALB-88', 'Approve November ad copy with client', 'ALB', 'todo', 'urgent', S, 'Ayesha Khan', [], -1, 0, '0/3', 6),
    T('LUM-57', 'Recover lost rankings for "vitamin c serum"', 'LUM', 'blocked', 'high', S, 'Omar Haddad', ['Yusuf Ali'], -4, 2, '1/4', 9),
    T('HBR-31', 'Send homepage wireframe for sign-off', 'HBR', 'todo', 'normal', S, 'Daniel Reyes', [], 0, 0, '', 2),
    T('ALB-91', 'Monthly report: October results', 'ALB', 'in_progress', 'high', S, S, [], 0, 1, '3/6', 1),
    T('NOV-19', 'Onboarding call notes and access checklist', 'NOV', 'in_review', 'normal', S, 'Hamza Qureshi', [], 2, 0, '5/7', 3),
    T('CPD-145', 'Quarterly strategy deck', 'CPD', 'todo', 'normal', S, 'Yusuf Ali', [], 3, 4, '', 0),
    T('LUM-60', 'Reply to client about refund policy page', 'LUM', 'todo', 'low', S, 'Hamza Qureshi', [], 4, 0, '', 1),
    T('HBR-34', 'Collect attorney bios for team page', 'HBR', 'todo', 'normal', S, 'Daniel Reyes', ['Lina Saeed'], 12, 0, '0/8', 0),
    T('ALB-95', 'Plan Q1 budget split', 'ALB', 'todo', 'normal', S, S, [], 20, 2, '', 0),
    T('NOV-22', 'Review brand voice guide', 'NOV', 'todo', 'low', S, 'Zara Farooq', [], null, 0, '', 2),
    T('CPD-150', 'Tidy shared drive folders', 'CPD', 'todo', 'low', S, S, [], null, 0, '1/3', 0),
    T('LUM-58', 'Write 4 blog posts for winter range', 'LUM', 'in_progress', 'normal', 'Priya Nair', S, [], -1, 4, '', 5),
    T('ALB-89', 'Fix conversion tracking on test-drive form', 'ALB', 'blocked', 'urgent', 'Daniel Reyes', S, ['Ayesha Khan'], 0, 1, '1/2', 7),
    T('HBR-33', 'Design practice area icons', 'HBR', 'in_review', 'normal', 'Lina Saeed', S, [], 1, 0, '', 3),
    T('NOV-20', 'Schedule November reels', 'NOV', 'todo', 'normal', 'Zara Farooq', S, [], 4, 6, '', 1),
    T('CPD-147', 'Build backlinks from dental directories', 'CPD', 'todo', 'normal', 'Omar Haddad', S, [], 15, 0, '0/10', 0),
    T('LUM-55', 'Fix site speed on product pages', 'LUM', 'in_progress', 'high', 'Daniel Reyes', 'Omar Haddad', [S], -3, 2, '3/6', 11),
    T('ALB-90', 'Launch remarketing campaign', 'ALB', 'in_review', 'high', 'Ayesha Khan', 'Ayesha Khan', [S], 1, 0, '4/4', 2),
    T('CPD-149', 'Local citations audit', 'CPD', 'todo', 'normal', 'Omar Haddad', 'Hamza Qureshi', [S], 6, 0, '', 0),
    T('HBR-36', 'Set up staging site', 'HBR', 'todo', 'normal', null, 'Daniel Reyes', [S], null, 0, '', 1),
    T('ALB-85', 'Pause low-ROAS ad groups', 'ALB', 'done', 'normal', S, 'Ayesha Khan', [], -5, 0, '', 2, -3),
    T('CPD-140', 'Send October report', 'CPD', 'done', 'high', S, S, [], -3, 0, '', 1, -2),
    T('LUM-52', 'Keyword map for new range', 'LUM', 'done', 'normal', 'Omar Haddad', S, [], -6, 0, '', 4, -4),
    T('NOV-17', 'Kick-off meeting with Nova Fitness', 'NOV', 'done', 'normal', S, 'Hamza Qureshi', [], -8, 0, '', 0, -8),
    T('HBR-30', 'Sitemap for new site', 'HBR', 'done', 'normal', 'Daniel Reyes', 'Daniel Reyes', [S], -2, 0, '', 3, -1),
  ];
  const VIEWS = {
    assigned: t => t.assignee === S,
    on: t => t.assignee === S || t.reporter === S || t.watchers.includes(S),
    watching: t => t.watchers.includes(S),
    asked: t => t.reporter === S && t.assignee !== S,
  };
  const WEEK_LEFT = (7 - dow(TODAY)) % 7; // days until Sunday
  const groupOf = t => t.due === null ? 'none' : t.due < 0 ? 'overdue' : t.due === 0 ? 'today' : t.due <= WEEK_LEFT ? 'week' : 'later';
  const GROUPS = [['overdue', 'Overdue'], ['today', 'Today'], ['week', 'This week'], ['later', 'Later'], ['none', 'No due date']];
  const dueCell = t => {
    if (t.due === null) return '<span class="muted">None</span>';
    if (t.due < 0) return `<span class="scr-core-late">${plural(-t.due, 'day')} late</span>`;
    if (t.due === 0) return '<strong>Today</strong>';
    return esc(fmtShort(add(TODAY, t.due)));
  };
  const metaLine = t => {
    const bits = [projName(t.proj)];
    if (t.sub) bits.push(plural(t.sub, 'subtask'));
    if (t.check) bits.push(`${t.check} checklist`);
    if (t.com) bits.push(plural(t.com, 'comment'));
    return bits.map(esc).join(' · ');
  };
  const who = (name, size = 22) => name ? `<span class="scr-core-who">${avatar(name, size)}<span class="hide-sm">${esc(name)}</span></span>` : '<span class="muted">Unassigned</span>';

  /* ---------- calendar data ---------- */
  const att = s => s.split(',').map(x => { const [n, r] = x.split(':'); return { name: n.trim(), rsvp: r || 'pending' }; });
  let EID = 0;
  const EVENTS = [];
  const E = (date, start, mins, title, kind, client, attendees, extra = {}) =>
    EVENTS.push(Object.assign({ id: 'e' + (++EID), date, start, mins, title, kind, client, attendees: att(attendees), meet: 'meet.google.com/' + ['qpx', 'vdr', 'kte', 'mnb'][EID % 4] + '-' + ['rsta', 'oplm', 'zuwe'][EID % 3] + '-' + ['jhk', 'tby', 'cwa'][EID % 3], location: '', repeat: 'none', series: null, guests: [], agenda: '', vis: 'team' }, extra));
  // recurring stand-up, Mon and Wed
  for (let d = '2026-11-02'; d <= '2026-12-02'; d = add(d, 1)) {
    if (dow(d) === 1 || dow(d) === 3) E(d, '09:30', 30, 'Daily stand-up', 'internal', '', 'Sara Malik:yes,Hamza Qureshi:yes,Omar Haddad:yes,Ayesha Khan:maybe', { repeat: 'weekly', series: 'su', agenda: 'Blockers, client escalations, today\'s priorities.' });
  }
  E('2026-11-02', '10:00', 60, 'Cedar & Pine quarterly planning', 'client', 'Cedar & Pine Dental', 'Sara Malik:yes,Hamza Qureshi:yes,Omar Haddad:yes', { guests: ['dr.amal@cedarpine.ae'], agenda: 'Q1 goals, local SEO plan, content calendar.' });
  E('2026-11-03', '15:00', 30, 'Nova Fitness content approvals', 'client', 'Nova Fitness', 'Sara Malik:yes,Zara Farooq:yes,Priya Nair:yes', { guests: ['marketing@novafit.ae'] });
  E('2026-11-04', '11:00', 45, 'Alba Motors monthly review', 'client', 'Alba Motors', 'Sara Malik:yes,Ayesha Khan:yes,Zara Farooq:maybe', { guests: ['k.nasser@albamotors.ae'], repeat: 'monthly', series: 'alb', agenda: 'October results, November ad copy, remarketing launch.' });
  E('2026-11-04', '14:00', 60, 'Luma Skincare rankings check-in', 'client', 'Luma Skincare', 'Sara Malik:yes,Omar Haddad:yes,Hamza Qureshi:pending,Daniel Reyes:no', { guests: ['nina@lumaskin.com'], agenda: 'Ranking drop on serum pages, site speed fixes, next steps.' });
  E('2026-11-04', '16:30', 30, '1:1 with Hamza', 'internal', '', 'Sara Malik:yes,Hamza Qureshi:yes', { repeat: 'biweekly', vis: 'private' });
  E('2026-11-05', '10:00', 60, 'Harbor Legal website walkthrough', 'client', 'Harbor Legal', 'Sara Malik:yes,Daniel Reyes:yes,Lina Saeed:yes', { guests: ['partners@harborlegal.com'] });
  E('2026-11-05', '13:00', 30, 'Finance check-in with Bilal', 'internal', '', 'Sara Malik:yes,Bilal Ahmed:yes');
  E('2026-11-06', '12:00', 60, 'Team lunch', 'internal', '', 'Sara Malik:yes,Hamza Qureshi:yes,Omar Haddad:yes,Ayesha Khan:yes,Priya Nair:maybe,Lina Saeed:yes', { meet: '', location: 'Al Fanar, Dubai Festival City' });
  E('2026-11-09', '11:00', 45, 'Zest Kitchen PPC review', 'client', 'Zest Kitchen', 'Sara Malik:yes,Ayesha Khan:yes', { guests: ['owner@zestkitchen.pk'] });
  E('2026-11-10', '14:30', 30, 'Interview: content writer', 'internal', '', 'Sara Malik:yes,Priya Nair:yes', { vis: 'private' });
  E('2026-11-11', '10:00', 60, 'Luma Skincare strategy reset', 'client', 'Luma Skincare', 'Sara Malik:yes,Omar Haddad:no,Yusuf Ali:yes', { guests: ['nina@lumaskin.com'] });
  E('2026-11-12', '16:00', 30, 'Alba Motors creative review', 'client', 'Alba Motors', 'Sara Malik:yes,Lina Saeed:yes,Zara Farooq:yes');
  E('2026-11-16', '09:00', 90, 'Q1 planning workshop', 'internal', '', 'Sara Malik:yes,Yusuf Ali:yes,Omar Haddad:yes,Ayesha Khan:yes,Bilal Ahmed:maybe', { meet: '', location: 'Board room, 14th floor' });
  E('2026-11-17', '11:30', 45, 'Cedar & Pine monthly report call', 'client', 'Cedar & Pine Dental', 'Sara Malik:yes,Hamza Qureshi:yes,Omar Haddad:yes');
  E('2026-11-18', '15:00', 30, 'Nova Fitness reels review', 'client', 'Nova Fitness', 'Sara Malik:maybe,Zara Farooq:yes');
  E('2026-11-19', '13:00', 60, 'Harbor Legal launch prep', 'client', 'Harbor Legal', 'Sara Malik:yes,Daniel Reyes:yes,Omar Haddad:pending');
  E('2026-11-23', '10:00', 60, 'Leadership sync', 'internal', '', 'Sara Malik:yes,Yusuf Ali:yes,Bilal Ahmed:yes', { vis: 'private' });
  E('2026-11-24', '14:00', 45, 'Alba Motors monthly review', 'client', 'Alba Motors', 'Sara Malik:yes,Ayesha Khan:yes', { repeat: 'monthly', series: 'alb' });
  E('2026-11-25', '11:00', 30, 'Zest Kitchen budget call', 'client', 'Zest Kitchen', 'Sara Malik:pending,Ayesha Khan:yes,Bilal Ahmed:yes');
  E('2026-11-26', '16:00', 60, 'Month-end reports run-through', 'internal', '', 'Sara Malik:yes,Hamza Qureshi:yes,Omar Haddad:yes,Ayesha Khan:yes,Zara Farooq:yes');
  E('2026-12-03', '11:00', 45, 'Cedar & Pine Q1 kickoff', 'client', 'Cedar & Pine Dental', 'Sara Malik:pending,Omar Haddad:yes');
  const HOLIDAYS = { '2026-12-01': 'Commemoration Day', '2026-12-02': 'UAE National Day', '2026-12-03': 'UAE National Day holiday' };
  const LEAVE = [{ name: 'Omar Haddad', from: '2026-11-10', to: '2026-11-12' }, { name: 'Priya Nair', from: '2026-11-18', to: '2026-11-18' }, { name: 'Lina Saeed', from: '2026-11-27', to: '2026-11-27' }];
  const leaveOn = d => LEAVE.filter(l => d >= l.from && d <= l.to);
  const BUSY_BASE = [['Omar Haddad', '10:00', 60], ['Ayesha Khan', '13:00', 90], ['Hamza Qureshi', '11:30', 30], ['Daniel Reyes', '15:00', 60], ['Priya Nair', '09:00', 120], ['Zara Farooq', '16:00', 45]];
  const busyOn = d => {
    if (isWeekend(d) || HOLIDAYS[d]) return [];
    const off = leaveOn(d).map(l => l.name);
    return BUSY_BASE.filter((b, i) => (dnum(d) + i) % 3 !== 0 && !off.includes(b[0])).map(b => ({ name: b[0], start: b[1], mins: b[2] }));
  };
  const evOn = d => EVENTS.filter(e => e.date === d).sort((a, b) => toMin(a.start) - toMin(b.start));
  const RSVP = { yes: ['Going', 'ok'], maybe: ['Maybe', 'warn'], no: ['Declined', 'danger'], pending: ['No reply', 'muted'] };
  const myRsvp = e => (e.attendees.find(a => a.name === S) || {}).rsvp || 'pending';

  /* ======================================================================
     HOME
     ====================================================================== */
  const HOME_CSS = `<style>${BASE_CSS}
  .scr-core-home .greet h2{margin:0;font-size:22px}
  .scr-core-home .today-row{display:grid;grid-template-columns:52px 1fr auto auto;gap:12px;align-items:center}
  .scr-core-home .today-row .tm{font-variant-numeric:tabular-nums;color:var(--ink-2)}
  .scr-core-home .tag{font-weight:600;font-size:13px;min-width:40px;text-align:right}
  .scr-core-home .tag.now{color:var(--danger)} .scr-core-home .tag.soon{color:var(--warn)} .scr-core-home .tag.later{color:var(--ink-3)}
  .scr-core-home .mini{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:14px}
  .scr-core-home .mini div{background:var(--surface-2);border-radius:var(--radius);padding:8px 10px}
  .scr-core-home .mini b{display:block;font-size:20px;font-variant-numeric:tabular-nums}
  .scr-core-home .mini span{font-size:12px;color:var(--ink-2)}
  .scr-core-home .load{display:grid;grid-template-columns:28px 1fr 2fr 64px;gap:10px;align-items:center;padding:6px 0}
  .scr-core-home .upd{display:grid;grid-template-columns:28px 1fr;gap:10px}
  .scr-core-home .why{color:var(--ink-3);font-size:12px}
  .scr-core-home .ann{border-left:3px solid var(--line-2);padding:4px 0 4px 12px}
  .scr-core-home .ann.pinned{border-left-color:var(--accent)}
  .scr-core-home .gs label{display:flex;gap:10px;align-items:center;padding:6px 0}
  .scr-core-home .gs label.done span{color:var(--ink-3);text-decoration:line-through}
  .scr-core-home .nudge{display:flex;gap:12px;align-items:center;justify-content:space-between;flex-wrap:wrap}
  .scr-core-home .stage{white-space:nowrap}
  .scr-core-home h2.sec{font-size:17px;margin:8px 0 0}
  @media (max-width:600px){.scr-core-home .mini{grid-template-columns:repeat(3,1fr)}.scr-core-home .today-row{grid-template-columns:44px 1fr auto}.scr-core-home .today-row .act{display:none}.scr-core-home .load{grid-template-columns:28px 1fr 1fr 56px}}
  </style>`;

  const DEPTS = {
    'Client Success': { open: 31, overdue: 4, unassigned: 3, blocked: 2, review: 5, load: [['Sara Malik', 12, 14], ['Hamza Qureshi', 16, 14], ['Zara Farooq', 3, 6]] },
    SEO: { open: 44, overdue: 6, unassigned: 5, blocked: 3, review: 7, load: [['Omar Haddad', 18, 15], ['Priya Nair', 11, 12]] },
    PPC: { open: 19, overdue: 1, unassigned: 2, blocked: 1, review: 3, load: [['Ayesha Khan', 13, 14]] },
    Web: { open: 23, overdue: 3, unassigned: 4, blocked: 2, review: 2, load: [['Daniel Reyes', 15, 12], ['Lina Saeed', 8, 12]] },
  };
  const deptPanel = name => {
    const d = DEPTS[name];
    const mini = [['Open', d.open], ['Overdue', d.overdue], ['Unassigned', d.unassigned], ['Blocked', d.blocked], ['In review', d.review]]
      .map(([l, v]) => `<div><b class="${l === 'Overdue' || l === 'Blocked' ? 'scr-core-late' : ''}">${v}</b><span>${l}</span></div>`).join('');
    const load = d.load.map(([n, open, cap]) => {
      const pct = Math.min(100, Math.round(open / cap * 100));
      return `<div class="load">${avatar(n, 28)}<span>${esc(n)}</span><div class="bar ${open > cap ? 't-danger' : pct > 85 ? 't-warn' : ''}"><i style="width:${pct}%"></i></div><span class="num right small">${open} / ${cap}</span></div>`;
    }).join('');
    return `<div class="mini">${mini}</div><div class="small muted" style="margin-bottom:4px">Open tickets per person, against weekly capacity</div>${load}`;
  };

  function homeRender() {
    const mine = TICKETS.filter(t => t.assignee === S && t.status !== 'done');
    const overdue = mine.filter(t => t.due !== null && t.due < 0);
    const dueToday = mine.filter(t => t.due === 0);
    const blocked = mine.filter(t => t.status === 'blocked');
    const review = mine.filter(t => t.status === 'in_review');
    const todayEv = evOn(TODAY);

    const todayItems = [
      ...overdue.map(t => ({ sort: -1, tm: 'Late', title: `${t.key} ${t.title}`, href: '#ticket', tag: 'now', act: '<a class="btn sm ghost" href="#ticket">Open</a>' })),
      ...todayEv.map(e => {
        const st = toMin(e.start), end = st + e.mins;
        const tag = end <= NOW_MIN ? null : st - NOW_MIN <= 30 ? (st <= NOW_MIN ? 'now' : 'soon') : 'later';
        return tag && { sort: st, tm: e.start, title: e.title, ev: e.id, tag, act: e.meet ? '<button class="btn sm" data-toast="Opening Google Meet (preview only)">Join</button>' : '' };
      }).filter(Boolean),
      ...dueToday.map((t, i) => ({ sort: 12 * 60 + i, tm: 'Due', title: `${t.key} ${t.title}`, href: '#ticket', tag: i === 0 ? 'soon' : 'later', act: '<a class="btn sm ghost" href="#ticket">Open</a>' })),
    ].sort((a, b) => a.sort - b.sort);
    const tagTxt = { now: 'Now', soon: 'Soon', later: 'Later' };
    const todayList = todayItems.map(i => `<div class="item today-row"><span class="tm small">${esc(i.tm)}</span><a href="${i.href || '#calendar'}">${esc(i.title)}</a><span class="act">${i.act}</span><span class="tag ${i.tag}">${tagTxt[i.tag]}</span></div>`).join('');

    const upNext = mine.filter(t => t.status !== 'blocked').sort((a, b) => (a.due ?? 99) - (b.due ?? 99) || ['urgent', 'high', 'normal', 'low'].indexOf(a.pri) - ['urgent', 'high', 'normal', 'low'].indexOf(b.pri)).slice(0, 6)
      .map(t => `<a class="item between" href="#ticket"><span><span class="muted num">${t.key}</span> ${esc(t.title)}</span><span class="row" style="flex-wrap:nowrap">${priority(t.pri)}<span class="small" style="min-width:76px;text-align:right">${dueCell(t)}</span></span></a>`).join('');

    const UPDATES = [
      ['Omar Haddad', 'moved', 'LUM-57', 'to Blocked: "Waiting on GSC access from client"', '12 min ago', 'assigned'],
      ['Daniel Reyes', 'commented on', 'ALB-89', '"Tag fires twice on mobile, fixing now."', '25 min ago', 'reported'],
      ['Lina Saeed', 'sent', 'HBR-33', 'for review', '1 h ago', 'reported'],
      ['Ayesha Khan', 'ticked 4 of 4 checklist items on', 'ALB-90', '', '2 h ago', 'watching'],
      ['Hamza Qureshi', 'changed the due date of', 'NOV-19', 'to Fri 6 Nov', '3 h ago', 'assigned'],
      ['Daniel Reyes', 'logged 2 h on', 'LUM-55', '', 'Yesterday', 'watching'],
    ].map(([n, verb, key, rest, when, why]) => `<div class="item upd">${avatar(n, 28)}<div><div><strong>${esc(n.split(' ')[0])}</strong> ${esc(verb)} <a href="#ticket">${key}</a> ${esc(rest)}</div><div class="why">${esc(when)} · you ${why === 'assigned' ? 'are assigned' : why === 'reported' ? 'reported it' : 'are watching'}</div></div></div>`).join('');

    const myClients = CLIENTS.filter(c => c.owner === S || c.name === 'Luma Skincare');
    const REPORT = { 'Alba Motors': ['Sent 2 Nov', 'ok'], 'Harbor Legal': ['Due 7 Nov', 'warn'], 'Zest Kitchen': ['Sent 1 Nov', 'ok'], 'Luma Skincare': ['2 days late', 'danger'] };
    const bandTone = b => b === 'Healthy' ? 'ok' : b === 'Watch' ? 'warn' : b === 'At risk' ? 'danger' : 'muted';
    const clientRows = myClients.map(c => {
      const keys = PROJECTS.filter(p => p.client === c.name).map(p => p.key);
      const open = TICKETS.filter(t => keys.includes(t.proj) && t.status !== 'done').length;
      const nm = first(EVENTS.filter(e => e.client === c.name && (e.date > TODAY || (e.date === TODAY && toMin(e.start) > NOW_MIN))).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)));
      const rep = REPORT[c.name] || ['Not sent', 'warn'];
      return `<tr class="click" data-href="#client"><td><a href="#client">${esc(c.name)}</a><div class="small muted">${esc(c.services.join(', '))}</div></td><td>${c.health === null ? '<span class="muted">New</span>' : `<span class="num">${c.health}</span> ${tone(c.band, bandTone(c.band))}`}</td><td class="num">${open || 2}</td><td>${tone(rep[0], rep[1])}</td><td>${nm ? esc(`${fmtShort(nm.date)}, ${nm.start}`) : '<span class="muted">None booked</span>'}</td></tr>`;
    }).join('');

    const nextMeet = EVENTS.filter(e => e.date > TODAY || (e.date === TODAY && toMin(e.start) + e.mins > NOW_MIN)).filter(e => e.series !== 'su')
      .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)).slice(0, 4)
      .map(e => `<div class="item between"><div><div><a href="#calendar">${esc(e.title)}</a></div><div class="small muted">${e.date === TODAY ? 'Today' : esc(fmtShort(e.date))}, ${range(e.start, e.mins)}${e.client ? ' · ' + esc(e.client) : ''}</div></div><span class="row" style="flex-wrap:nowrap"><span class="avatars">${e.attendees.slice(0, 3).map(a => avatar(a.name, 24)).join('')}</span>${e.meet ? '<button class="btn sm" data-toast="Opening Google Meet (preview only)">Join</button>' : ''}</span></div>`).join('');

    const overdueBy = {};
    TICKETS.filter(t => t.status !== 'done' && t.due !== null && t.due < 0).forEach(t => { const k = t.assignee || 'Unassigned'; overdueBy[k] = overdueBy[k] || { n: 0, old: 0 }; overdueBy[k].n++; overdueBy[k].old = Math.max(overdueBy[k].old, -t.due); });
    Object.assign(overdueBy, { 'Omar Haddad': { n: 4, old: 9 }, 'Ayesha Khan': { n: 1, old: 2 }, 'Hamza Qureshi': { n: 2, old: 5 } });
    const overdueRows = Object.entries(overdueBy).sort((a, b) => b[1].n - a[1].n).map(([n, v]) => `<tr><td>${who(n === 'Unassigned' ? null : n)}</td><td class="num">${v.n}</td><td class="num">${plural(v.old, 'day')}</td></tr>`).join('');

    return `<div class="page scr-core-home">${HOME_CSS}
    <div class="card greet"><div class="card-body stack">
      <div class="between row"><div><h2>Good morning, Sara</h2><div class="muted">${fmtLong(TODAY)}</div></div>
        <div class="row"><a class="btn primary" href="#tickets">New ticket</a><a class="btn" href="#calendar">New meeting</a><a class="btn" href="#time">Log time</a><a class="btn ghost" href="#chat">Open chat</a></div></div>
      <h3 style="margin:8px 0 0">Today</h3>
      <div class="list">${todayList}</div>
    </div></div>

    <div class="stats">
      <a class="stat" href="#my-work"><div class="label">My open tickets</div><div class="value num">${mine.length}</div><div class="sub">${mine.filter(t => t.pri === 'high' || t.pri === 'urgent').length} high or urgent</div></a>
      <a class="stat" href="#my-work"><div class="label">Overdue</div><div class="value num t-danger">${overdue.length}</div><div class="sub">Oldest ${plural(Math.max(...overdue.map(t => -t.due)), 'day')} late</div></a>
      <a class="stat" href="#my-work"><div class="label">Due today</div><div class="value num">${dueToday.length}</div><div class="sub">${dueToday.filter(t => t.status === 'in_progress').length} in progress</div></a>
      <a class="stat" href="#my-work"><div class="label">Blocked</div><div class="value num">${blocked.length}</div><div class="sub">· ${review.length} in review</div></a>
    </div>

    <div class="grid-2">
      <div class="card"><div class="card-head"><h3>Up next for me</h3><a class="btn sm ghost" href="#my-work">My work</a></div><div class="card-body list">${upNext}</div></div>
      <div class="card"><div class="card-head"><h3>Updates on my tickets</h3><button class="btn sm ghost" data-toast="All updates marked as read">Mark all read</button></div><div class="card-body list">${UPDATES}</div></div>
    </div>

    <div class="grid-2">
      <div class="card"><div class="card-head"><h3>Department</h3><select id="home-dept" aria-label="Department">${Object.keys(DEPTS).map(d => `<option${d === ME.dept ? ' selected' : ''}>${d}</option>`).join('')}</select></div><div class="card-body" id="home-dept-body">${deptPanel(ME.dept)}</div></div>
      <div class="card"><div class="card-head"><h3>Next meetings</h3><a class="btn sm ghost" href="#calendar">Calendar</a></div><div class="card-body list">${nextMeet}</div></div>
    </div>

    <div class="card"><div class="card-head"><h3>My clients</h3><a class="btn sm ghost" href="#clients">All clients</a></div>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Client</th><th>Health</th><th>Open tickets</th><th>Report sent</th><th>Next meeting</th></tr></thead><tbody>${clientRows}</tbody></table></div></div>

    <div class="card" id="home-nudge"><div class="card-body nudge"><div><strong>Get alerts on this device</strong> <span class="p2">phase 2</span><div class="muted small">Ticket mentions, due dates and meeting reminders, even when the portal is closed.</div></div>
      <div class="row"><button class="btn primary" data-toast="Notifications turned on (preview only)">Turn on notifications</button><button class="btn ghost" id="home-nudge-x">Not now</button></div></div></div>

    <h2 class="sec">Role panels <span class="p2">phase 2</span></h2>
    <div class="grid-2">
      <div class="card"><div class="card-head"><h3>CEO pulse <span class="p2">phase 2</span></h3><span class="small muted">November to date</span></div><div class="card-body stack">
        <div class="stats">
          <div class="stat"><div class="label">Revenue</div><div class="value num">${money(186400, 'AED')}</div><div class="sub">Up 8% on October</div></div>
          <div class="stat"><div class="label">Active clients</div><div class="value num">24</div><div class="sub">2 new this month</div></div>
          <div class="stat"><div class="label">At risk</div><div class="value num t-danger">3</div><div class="sub">Luma Skincare lowest at 44</div></div>
        </div>
        <div class="between small"><span>Team utilisation</span><span class="num">78%</span></div><div class="bar"><i style="width:78%"></i></div>
      </div></div>

      <div class="card"><div class="card-head"><h3>HR today <span class="p2">phase 2</span></h3><a class="btn sm ghost" href="#directory">Directory</a></div><div class="card-body list">
        <div class="item between"><span class="scr-core-who">${avatar('Lina Saeed', 24)} Lina Saeed</span><span class="muted small">Working from home</span></div>
        <div class="item between"><span class="scr-core-who">${avatar('Bilal Ahmed', 24)} Bilal Ahmed</span><span class="muted small">3 years at Permanent SEO today</span></div>
        <div class="item between" id="home-leave"><span><span class="scr-core-who">${avatar('Omar Haddad', 24)} Omar Haddad</span><div class="small muted">Annual leave, 10–12 Nov</div></span><span class="row"><button class="btn sm primary" data-leave="Approved">Approve</button><button class="btn sm ghost" data-leave="Declined">Decline</button></span></div>
        <div class="item between"><span class="scr-core-who">${avatar('Priya Nair', 24)} Priya Nair</span><span class="muted small">Sick leave request, 18 Nov</span></div>
      </div></div>

      <div class="card"><div class="card-head"><h3>Finance &amp; accounts <span class="p2">phase 2</span></h3><a class="btn sm ghost" href="#invoices">Invoices</a></div><div class="card-body">
        <div class="table-wrap"><table class="tbl"><thead><tr><th>Currency</th><th class="right">Outstanding</th><th class="right">Overdue</th></tr></thead><tbody>
          <tr><td>AED</td><td class="num right">${money(42500, 'AED')}</td><td class="num right scr-core-late">${money(14000, 'AED')}</td></tr>
          <tr><td>USD</td><td class="num right">${money(7200, 'USD')}</td><td class="num right scr-core-late">${money(4200, 'USD')}</td></tr>
          <tr><td>PKR</td><td class="num right">${money(450000, 'PKR')}</td><td class="num right">${money(0, 'PKR')}</td></tr>
        </tbody></table></div>
        <div class="row small muted" style="margin-top:10px"><span>2 invoices overdue</span><span>·</span><span>${money(31000, 'AED')} received this week</span></div>
      </div></div>

      <div class="card"><div class="card-head"><h3>My pipeline <span class="p2">phase 2</span></h3><span class="small muted">${money(61500, 'AED')} open</span></div><div class="card-body list">
        ${[['Desert Rose Interiors', 'SEO + Content retainer', 'Proposal sent', 'blue', 18000], ['Orbit Logistics', 'PPC management', 'Negotiation', 'violet', 22500], ['Falcon Realty', 'Website rebuild', 'Discovery call booked', 'muted', 21000], ['Mint Pharmacy', 'Local SEO', 'Won', 'ok', 8500]]
          .map(([n, s, st, t, v]) => `<div class="item between"><div><div>${esc(n)}</div><div class="small muted">${esc(s)}</div></div><div class="right"><div class="num">${money(v, 'AED')}</div><div class="small stage">${tone(st, t)}</div></div></div>`).join('')}
      </div></div>

      <div class="card"><div class="card-head"><h3>Overdue by person <span class="p2">phase 2</span></h3><a class="btn sm ghost" href="#tickets">Tickets</a></div>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>Person</th><th>Overdue</th><th>Oldest</th></tr></thead><tbody>${overdueRows}</tbody></table></div></div>

      <div class="card"><div class="card-head"><h3>Announcements <span class="p2">phase 2</span></h3><button class="btn sm" data-open="home-dlg-announce">Post announcement</button></div><div class="card-body stack">
        <div class="ann pinned"><div><strong>Office closed 1–3 December</strong> <span class="small muted">Pinned</span></div><div class="small">Commemoration Day and National Day. Client meetings move to 4 December.</div><div class="small muted">Yusuf Ali · 2 days ago · Expires 4 Dec</div></div>
        <div class="ann"><div><strong>New time-logging rule</strong></div><div class="small">Log time on the ticket, not in a spreadsheet. Weekly totals go to finance every Friday.</div><div class="small muted">Bilal Ahmed · Mon · Expires 30 Nov</div></div>
      </div></div>

      <div class="card"><div class="card-head"><h3>Getting started <span class="p2">phase 2</span></h3><span class="small muted" id="home-gs-count"></span></div><div class="card-body">
        <div class="bar" style="margin-bottom:8px"><i id="home-gs-bar" style="width:0%"></i></div>
        <div class="gs">${[['Add a profile photo', 1], ['Connect Google Calendar', 1], ['Set your working hours', 1], ['Join your department channel', 1], ['Turn on notifications', 0], ['Log your first hour', 0]]
          .map(([l, d]) => `<label class="${d ? 'done' : ''}"><input type="checkbox" class="home-gs-item"${d ? ' checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div>
      </div></div>
    </div>

    <dialog id="home-dlg-announce" class="modal"><form>
      <div class="modal-head"><h3>Post announcement</h3><button type="button" class="icon-btn" data-close aria-label="Close">×</button></div>
      <div class="modal-body"><div class="form-grid">
        <div class="field full"><label for="ha-title">Title</label><input id="ha-title" required value="Holiday rota for December"></div>
        <div class="field full"><label for="ha-body">Message</label><textarea id="ha-body" rows="4">Please add your December leave to the calendar by 20 November.</textarea></div>
        <div class="field"><label for="ha-aud">Audience</label><select id="ha-aud"><option>Everyone</option><option>Client Success</option><option>SEO</option><option>PPC</option><option>Web</option></select></div>
        <div class="field"><label for="ha-exp">Expires</label><input id="ha-exp" type="date" value="2026-11-30"></div>
        <label class="check field full"><input type="checkbox" checked> Pin to the top of Home</label>
      </div></div>
      <div class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Post announcement</button></div>
    </form></dialog>
    </div>`;
  }

  function homeMount(root) {
    root.addEventListener('click', e => {
      const t = e.target.closest('[data-toast]'); if (t) { e.preventDefault(); K.toast(t.dataset.toast); }
      const l = e.target.closest('[data-leave]');
      if (l) { const box = root.querySelector('#home-leave .row'); box.innerHTML = tone(l.dataset.leave, l.dataset.leave === 'Approved' ? 'ok' : 'danger'); K.toast(`Leave ${l.dataset.leave.toLowerCase()}`); }
      const tr = e.target.closest('tr.click'); if (tr && !e.target.closest('a')) location.hash = tr.dataset.href;
    });
    const x = root.querySelector('#home-nudge-x'); if (x) x.addEventListener('click', () => { root.querySelector('#home-nudge').hidden = true; });
    const dept = root.querySelector('#home-dept'); if (dept) dept.addEventListener('change', () => { root.querySelector('#home-dept-body').innerHTML = deptPanel(dept.value); });
    const gs = () => {
      const items = [...root.querySelectorAll('.home-gs-item')], n = items.filter(i => i.checked).length;
      items.forEach(i => i.closest('label').classList.toggle('done', i.checked));
      root.querySelector('#home-gs-count').textContent = `${n} of ${items.length} done`;
      root.querySelector('#home-gs-bar').style.width = Math.round(n / items.length * 100) + '%';
    };
    root.querySelectorAll('.home-gs-item').forEach(i => i.addEventListener('change', gs)); gs();
  }

  screen({ id: 'home', title: 'Home', group: 'Core', render: homeRender, mount: homeMount });

  /* ======================================================================
     MY WORK
     ====================================================================== */
  const MW = { view: 'assigned', done: false, q: '' };
  const MW_CSS = `<style>${BASE_CSS}
  .scr-core-mywork .grp .card-head{cursor:pointer;user-select:none}
  .scr-core-mywork .grp .card-head h3 .muted{font-weight:400;margin-left:6px}
  .scr-core-mywork .grp.shut .table-wrap,.scr-core-mywork .grp.shut .empty{display:none}
  .scr-core-mywork .caret{transition:transform .15s;color:var(--ink-3)}
  .scr-core-mywork .grp.shut .caret{transform:rotate(-90deg)}
  .scr-core-mywork td.ttl{min-width:240px}
  .scr-core-mywork td.ttl .small{margin-top:2px}
  .scr-core-mywork .grp.g-overdue h3{color:var(--danger)}
  .scr-core-mywork .toolbar input[type=search]{min-width:200px}
  </style>`;
  const mwRow = t => `<tr class="click" data-href="#ticket"><td class="num"><a href="#ticket">${t.key}</a></td><td class="ttl"><div>${esc(t.title)}</div><div class="small muted">${metaLine(t)}</div></td><td>${status(t.status)}</td><td>${priority(t.pri)}</td><td>${who(t.assignee)}</td><td class="scr-core-nowrap">${t.status === 'done' ? `<span class="muted">Done ${esc(fmtShort(add(TODAY, t.done)))}</span>` : dueCell(t)}</td></tr>`;
  const mwTable = rows => `<div class="table-wrap"><table class="tbl"><thead><tr><th>Key</th><th>Title</th><th>Status</th><th>Priority</th><th>Assignee</th><th>Due</th></tr></thead><tbody>${rows.map(mwRow).join('')}</tbody></table></div>`;
  function mwBody() {
    const q = MW.q.trim().toLowerCase();
    const list = TICKETS.filter(VIEWS[MW.view]).filter(t => !q || (t.key + ' ' + t.title + ' ' + projName(t.proj)).toLowerCase().includes(q));
    const open = list.filter(t => t.status !== 'done');
    let html = GROUPS.map(([g, label]) => {
      const rows = open.filter(t => groupOf(t) === g).sort((a, b) => (a.due ?? 0) - (b.due ?? 0));
      return `<div class="card grp g-${g}"><div class="card-head" data-fold><h3><span class="caret">▾</span> ${label}<span class="muted num">${rows.length}</span></h3></div>${rows.length ? mwTable(rows) : '<div class="empty">Nothing here.</div>'}</div>`;
    }).join('');
    if (MW.done) {
      const done = list.filter(t => t.status === 'done').sort((a, b) => b.done - a.done).slice(0, 40);
      html += `<div class="card grp g-done"><div class="card-head" data-fold><h3><span class="caret">▾</span> Done, last 40<span class="muted num">${done.length}</span></h3></div>${done.length ? mwTable(done) : '<div class="empty">No done tickets yet.</div>'}</div>`;
    }
    return html;
  }
  const MW_TABS = [['assigned', 'Assigned to me'], ['on', 'Everything I\'m on'], ['watching', 'Watching'], ['asked', 'I asked for']];
  function mwRender() {
    return `<div class="page scr-core-mywork">${MW_CSS}
    <div class="row between"><div class="seg" id="mw-seg" role="tablist">${MW_TABS.map(([k, l]) => `<button data-view="${k}" class="${MW.view === k ? 'on' : ''}">${l} <span class="muted num">${TICKETS.filter(VIEWS[k]).filter(t => t.status !== 'done').length}</span></button>`).join('')}</div>
      <a class="btn primary" href="#tickets">New ticket</a></div>
    <div class="toolbar row"><input type="search" id="mw-q" placeholder="Search my tickets" aria-label="Search my tickets" value="${esc(MW.q)}">
      <label class="check"><input type="checkbox" id="mw-done"${MW.done ? ' checked' : ''}> Show done tickets</label></div>
    <div class="stack" id="mw-body" style="gap:16px">${mwBody()}</div>
    </div>`;
  }
  function mwMount(root) {
    const body = root.querySelector('#mw-body'), redraw = () => { body.innerHTML = mwBody(); };
    root.querySelector('#mw-seg').addEventListener('click', e => {
      const b = e.target.closest('[data-view]'); if (!b) return;
      MW.view = b.dataset.view; root.querySelectorAll('#mw-seg button').forEach(x => x.classList.toggle('on', x === b)); redraw();
    });
    root.querySelector('#mw-done').addEventListener('change', e => { MW.done = e.target.checked; redraw(); });
    root.querySelector('#mw-q').addEventListener('input', e => { MW.q = e.target.value; redraw(); });
    body.addEventListener('click', e => {
      const f = e.target.closest('[data-fold]'); if (f) { f.parentElement.classList.toggle('shut'); return; }
      const tr = e.target.closest('tr.click'); if (tr && !e.target.closest('a')) location.hash = tr.dataset.href;
    });
  }
  screen({ id: 'my-work', title: 'My work', group: 'Core', render: mwRender, mount: mwMount });

  /* ======================================================================
     CALENDAR
     ====================================================================== */
  const CAL = { view: 'month', cursor: TODAY, showCol: false, synced: '10:42' };
  const HOUR0 = 8, HOUR1 = 19, PX = 48;
  const CAL_CSS = `<style>${BASE_CSS}
  .scr-core-cal .cal-top{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between}
  .scr-core-cal .cal-top h2{margin:0 6px;font-size:19px;min-width:190px}
  .scr-core-cal .sync{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
  .scr-core-cal .legend{display:flex;flex-wrap:wrap;gap:14px}
  .scr-core-cal .sw{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:-1px}
  .scr-core-cal .k-client{background:var(--accent-soft);border-left:3px solid var(--accent);color:var(--ink)}
  .scr-core-cal .k-internal{background:var(--blue-soft);border-left:3px solid var(--blue);color:var(--ink)}
  .scr-core-cal .k-busy{background:repeating-linear-gradient(45deg,var(--surface-2),var(--surface-2) 5px,var(--line) 5px,var(--line) 7px);color:var(--ink-2);border-left:3px solid var(--line-2)}
  .scr-core-cal .k-hol{background:var(--warn-soft);border-left:3px solid var(--warn)}
  .scr-core-cal .k-leave{background:var(--violet-soft);border-left:3px solid var(--violet)}
  .scr-core-cal .dows{display:grid;grid-template-columns:repeat(7,1fr);font-size:12px;color:var(--ink-2);padding:0 0 6px}
  .scr-core-cal .dows span{padding-left:6px}
  .scr-core-cal .cal-cell{min-height:104px;display:flex;flex-direction:column;gap:3px}
  .scr-core-cal .cal-cell .dn{font-size:12px;font-variant-numeric:tabular-nums;color:var(--ink-2);background:none;border:0;padding:0;text-align:left;cursor:pointer}
  .scr-core-cal .cal-cell.today .dn{color:var(--accent);font-weight:700}
  .scr-core-cal .ev{display:block;width:100%;text-align:left;border:0;border-radius:4px;padding:2px 6px;font:inherit;font-size:12px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .scr-core-cal .ov{font-size:11px;border-radius:4px;padding:1px 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .scr-core-cal .more{font-size:12px;color:var(--ink-2);background:none;border:0;padding:0 6px;text-align:left;cursor:pointer}
  .scr-core-cal .busyline{font-size:11px;color:var(--ink-3);padding:0 6px}
  .scr-core-cal .scrollx{overflow-x:auto}
  .scr-core-cal .tg{display:grid;grid-template-columns:52px repeat(var(--cols),minmax(92px,1fr));min-width:calc(52px + var(--cols) * 92px)}
  .scr-core-cal .tg .hd{padding:6px;font-size:12px;color:var(--ink-2);border-bottom:1px solid var(--line)}
  .scr-core-cal .tg .hd.today{color:var(--accent);font-weight:700}
  .scr-core-cal .tg .allday{padding:4px;border-bottom:1px solid var(--line);display:flex;flex-direction:column;gap:2px;min-height:26px}
  .scr-core-cal .tg .hours{position:relative}
  .scr-core-cal .tg .hours div{height:${PX}px;font-size:11px;color:var(--ink-3);text-align:right;padding-right:6px;transform:translateY(-7px)}
  .scr-core-cal .tg .col{position:relative;height:${(HOUR1 - HOUR0) * PX}px;border-left:1px solid var(--line);background:repeating-linear-gradient(var(--surface),var(--surface) ${PX - 1}px,var(--line) ${PX - 1}px,var(--line) ${PX}px)}
  .scr-core-cal .tg .col.off{background:repeating-linear-gradient(var(--surface-2),var(--surface-2) ${PX - 1}px,var(--line) ${PX - 1}px,var(--line) ${PX}px)}
  .scr-core-cal .tg .blk{position:absolute;left:3px;right:3px;border-radius:5px;padding:3px 6px;font-size:12px;overflow:hidden;text-align:left;border-top:0;border-right:0;border-bottom:0;font-family:inherit;cursor:pointer}
  .scr-core-cal .tg.cols .blk.e{right:42%}
  .scr-core-cal .tg .blk.b{left:auto;width:38%;cursor:default;font-size:11px}
  .scr-core-cal .tg .now{position:absolute;left:0;right:0;border-top:2px solid var(--danger);z-index:2}
  .scr-core-cal .dayw{display:grid;grid-template-columns:minmax(0,2fr) minmax(240px,1fr);gap:16px;align-items:start}
  .scr-core-cal .ag-day{padding:10px 0;border-bottom:1px solid var(--line)}
  .scr-core-cal .ag-day h4{margin:0 0 6px;font-size:14px}
  .scr-core-cal .ag-day.today h4{color:var(--accent)}
  .scr-core-cal .ag-row{display:grid;grid-template-columns:110px 1fr auto auto;gap:12px;align-items:center;padding:6px 8px;border-radius:6px;cursor:pointer;width:100%;background:none;border:0;font:inherit;color:inherit;text-align:left}
  .scr-core-cal .ag-row:hover{background:var(--surface-2)}
  .scr-core-cal .att{display:grid;grid-template-columns:28px 1fr auto;gap:10px;align-items:center;padding:5px 0}
  .scr-core-cal .slots{display:flex;flex-wrap:wrap;gap:8px}
  .scr-core-cal .members{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:4px 12px;max-height:150px;overflow:auto;border:1px solid var(--line);border-radius:var(--radius);padding:8px}
  .scr-core-cal .findbox{border:1px solid var(--line);border-radius:var(--radius);padding:10px;background:var(--surface-2)}
  @media (max-width:700px){.scr-core-cal .cal-cell{min-height:70px}.scr-core-cal .cal-cell .ev{font-size:10px;padding:1px 3px}.scr-core-cal .busyline,.scr-core-cal .cal-cell .ov{display:none}.scr-core-cal .dayw{grid-template-columns:1fr}.scr-core-cal .ag-row{grid-template-columns:84px 1fr}.scr-core-cal .ag-row .hide-sm{display:none}}
  </style>`;

  const calTitle = () => {
    const c = CAL.cursor, d = D(c);
    if (CAL.view === 'month') return `${MON_L[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    if (CAL.view === 'week') { const a = weekStart(c), b = add(a, 6); return `${dnum(a)} ${MON[D(a).getUTCMonth()]} – ${dnum(b)} ${MON[D(b).getUTCMonth()]} ${D(b).getUTCFullYear()}`; }
    if (CAL.view === 'day') return fmtLong(c);
    const e = add(c, 29); return `${dnum(c)} ${MON[D(c).getUTCMonth()]} – ${dnum(e)} ${MON[D(e).getUTCMonth()]} ${D(e).getUTCFullYear()}`;
  };
  const overlays = d => [
    ...(HOLIDAYS[d] ? [`<div class="ov k-hol" title="Public holiday">${esc(HOLIDAYS[d])}</div>`] : []),
    ...leaveOn(d).map(l => `<div class="ov k-leave">${esc(l.name.split(' ')[0])} on leave</div>`),
  ].join('');
  const evBtn = e => `<button class="ev k-${e.kind}" data-ev="${e.id}" title="${esc(e.title)}">${e.start} ${esc(e.title)}</button>`;

  function monthView() {
    const c = D(CAL.cursor), m = c.getUTCMonth();
    const firstDay = iso(new Date(Date.UTC(c.getUTCFullYear(), m, 1)));
    let d = weekStart(firstDay), cells = '';
    do {
      for (let i = 0; i < 7; i++, d = add(d, 1)) {
        const evs = evOn(d), dim = D(d).getUTCMonth() !== m, busy = CAL.showCol ? busyOn(d) : [];
        cells += `<div class="cal-cell${dim ? ' dim' : ''}${d === TODAY ? ' today' : ''}"><button class="dn" data-day="${d}" aria-label="Open ${fmtLong(d)}">${dnum(d)}</button>${overlays(d)}${evs.slice(0, 3).map(evBtn).join('')}${evs.length > 3 ? `<button class="more" data-day="${d}">${evs.length - 3} more</button>` : ''}${busy.length ? `<div class="busyline">${busy.length} colleagues busy</div>` : ''}</div>`;
      }
    } while (D(d).getUTCMonth() === m);
    return `<div class="dows">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(x => `<span>${x}</span>`).join('')}</div><div class="cal-grid">${cells}</div>`;
  }

  function timeGrid(days) {
    const top = m => ((m - HOUR0 * 60) / 60) * PX;
    const hd = days.map(d => `<div class="hd${d === TODAY ? ' today' : ''}">${DAYS[dow(d)]} ${dnum(d)}</div>`).join('');
    const all = days.map(d => `<div class="allday">${overlays(d)}</div>`).join('');
    const cols = days.map(d => {
      const evs = evOn(d).map(e => `<button class="blk e k-${e.kind}" data-ev="${e.id}" style="top:${top(toMin(e.start))}px;height:${Math.max(20, e.mins / 60 * PX - 2)}px" title="${esc(e.title)}"><strong>${esc(e.title)}</strong><br><span class="small">${range(e.start, e.mins)}</span></button>`).join('');
      const busy = CAL.showCol ? busyOn(d).map(b => `<div class="blk b k-busy" style="top:${top(toMin(b.start))}px;height:${b.mins / 60 * PX - 2}px;right:3px" title="${esc(b.name)} busy ${range(b.start, b.mins)}">Busy · ${esc(b.name.split(' ')[0])}</div>`).join('') : '';
      const now = d === TODAY ? `<div class="now" style="top:${top(NOW_MIN)}px" title="Now 10:42"></div>` : '';
      return `<div class="col${isWeekend(d) || HOLIDAYS[d] ? ' off' : ''}">${busy}${evs}${now}</div>`;
    }).join('');
    let hours = '';
    for (let h = HOUR0; h < HOUR1; h++) hours += `<div>${String(h).padStart(2, '0')}:00</div>`;
    return `<div class="scrollx"><div class="tg${CAL.showCol ? ' cols' : ''}" style="--cols:${days.length}"><div class="hd"></div>${hd}<div class="allday small muted">All day</div>${all}<div class="hours">${hours}</div>${cols}</div></div>`;
  }

  function weekView() { const a = weekStart(CAL.cursor); return timeGrid([0, 1, 2, 3, 4, 5, 6].map(i => add(a, i))); }

  function dayView() {
    const d = CAL.cursor, evs = evOn(d);
    let side;
    if (CAL.showCol) {
      const busy = busyOn(d), off = leaveOn(d).map(l => l.name);
      side = `<div class="card"><div class="card-head"><h3>Colleagues</h3><span class="small muted">Busy or free only</span></div><div class="card-body list">${PEOPLE.filter(p => p.name !== S).map(p => {
        const b = busy.filter(x => x.name === p.name);
        const st = HOLIDAYS[d] || isWeekend(d) ? tone('Day off', 'muted') : off.includes(p.name) ? tone('On leave', 'violet') : b.length ? tone('Busy ' + b.map(x => range(x.start, x.mins)).join(', '), 'warn') : tone('Free all day', 'ok');
        return `<div class="item between"><span class="scr-core-who">${avatar(p.name, 24)} ${esc(p.name)}</span><span class="small">${st}</span></div>`;
      }).join('')}</div></div>`;
    } else {
      side = `<div class="card"><div class="card-head"><h3>On this day</h3><span class="small muted">${plural(evs.length, 'meeting')}</span></div><div class="card-body list">${evs.length ? evs.map(e => `<button class="item ag-row" data-ev="${e.id}" style="grid-template-columns:90px 1fr"><span class="num small">${range(e.start, e.mins)}</span><span>${esc(e.title)}</span></button>`).join('') : '<div class="empty">No meetings. Good day for deep work.</div>'}</div></div>`;
    }
    return `<div class="dayw"><div>${timeGrid([d])}</div>${side}</div>`;
  }

  function agendaView() {
    let out = '';
    for (let i = 0; i < 30; i++) {
      const d = add(CAL.cursor, i), evs = evOn(d), lv = leaveOn(d);
      if (!evs.length && !HOLIDAYS[d] && !lv.length) continue;
      out += `<div class="ag-day${d === TODAY ? ' today' : ''}"><h4>${d === TODAY ? 'Today, ' : ''}${esc(fmtShort(d))}</h4>
        ${HOLIDAYS[d] ? `<div class="ov k-hol" style="font-size:13px;padding:4px 8px;margin-bottom:4px">Public holiday: ${esc(HOLIDAYS[d])}</div>` : ''}
        ${lv.map(l => `<div class="ov k-leave" style="font-size:13px;padding:4px 8px;margin-bottom:4px">${esc(l.name)} on leave</div>`).join('')}
        ${evs.map(e => `<button class="ag-row" data-ev="${e.id}"><span class="num small">${range(e.start, e.mins)}</span><span><span class="sw k-${e.kind}"></span>${esc(e.title)}${e.client ? `<span class="muted small"> · ${esc(e.client)}</span>` : ''}</span><span class="avatars hide-sm">${e.attendees.slice(0, 4).map(a => avatar(a.name, 22)).join('')}</span><span class="small hide-sm">${tone(RSVP[myRsvp(e)][0], RSVP[myRsvp(e)][1])}</span></button>`).join('')}
      </div>`;
    }
    return out || '<div class="empty">Nothing in the next 30 days.</div>';
  }

  const calView = () => ({ month: monthView, week: weekView, day: dayView, agenda: agendaView }[CAL.view])();

  const startOpts = sel => { let o = ''; for (let m = 7 * 60; m <= 20 * 60 - 15; m += 15) { const t = fmtT(m); o += `<option${t === sel ? ' selected' : ''}>${t}</option>`; } return o; };

  function calRender() {
    return `<div class="page scr-core-cal">${CAL_CSS}
    <div class="cal-top">
      <div class="row" style="align-items:center"><button class="btn" id="cal-today">Today</button><button class="icon-btn" id="cal-prev" aria-label="Previous">‹</button><button class="icon-btn" id="cal-next" aria-label="Next">›</button><h2 id="cal-title">${esc(calTitle())}</h2></div>
      <div class="row" style="align-items:center">
        <div class="seg" id="cal-seg">${['month', 'week', 'day', 'agenda'].map(v => `<button data-v="${v}" class="${CAL.view === v ? 'on' : ''}">${v[0].toUpperCase() + v.slice(1)}</button>`).join('')}</div>
        <button class="btn${CAL.showCol ? ' primary' : ''}" id="cal-col" aria-pressed="${CAL.showCol}">${CAL.showCol ? 'Hide colleagues' : 'Show colleagues'}</button>
        <button class="btn" data-open="cal-dlg-new" data-kind="client">Client meeting</button>
        <button class="btn primary" data-open="cal-dlg-new" data-kind="internal">New meeting</button>
      </div>
    </div>
    <div class="row between small">
      <div class="sync muted">Google Calendar sync · last synced <span id="cal-synced" class="num">${CAL.synced}</span> · <button class="btn sm ghost" id="cal-sync">Sync now</button> <span class="p2">phase 2</span></div>
      <div class="legend muted"><span><i class="sw k-client"></i>Client meeting</span><span><i class="sw k-internal"></i>Internal</span><span><i class="sw k-busy"></i>Colleague busy</span><span><i class="sw k-hol"></i>Holiday</span><span><i class="sw k-leave"></i>Leave</span></div>
    </div>
    <div class="card"><div class="card-body" id="cal-view">${calView()}</div></div>

    <dialog id="cal-dlg-ev" class="modal">
      <div class="modal-head"><h3 id="cal-ev-title">Meeting</h3><button type="button" class="icon-btn" data-close aria-label="Close">×</button></div>
      <div class="modal-body" id="cal-ev-body"></div>
      <div class="modal-foot" id="cal-ev-foot"></div>
    </dialog>

    <dialog id="cal-dlg-new" class="modal"><form id="cal-form">
      <div class="modal-head"><h3 id="cal-new-title">New meeting</h3><button type="button" class="icon-btn" data-close aria-label="Close">×</button></div>
      <div class="modal-body"><input type="hidden" name="kind" value="internal"><input type="hidden" name="edit" value="">
      <div class="form-grid">
        <div class="field"><label for="cf-client">Client</label><select id="cf-client" name="client"><option value="">No client (internal)</option>${CLIENTS.map(c => `<option>${esc(c.name)}</option>`).join('')}</select></div>
        <div class="field"><label for="cf-title">Title</label><input id="cf-title" name="title" required placeholder="e.g. Monthly report call"></div>
        <div class="field"><label for="cf-date">Date</label><input id="cf-date" name="date" type="date" value="${TODAY}"></div>
        <div class="field"><label for="cf-start">Start</label><select id="cf-start" name="start">${startOpts('11:00')}</select></div>
        <div class="field"><label for="cf-len">Length</label><select id="cf-len" name="len"><option value="15">15 min</option><option value="30" selected>30 min</option><option value="45">45 min</option><option value="60">1 hour</option><option value="90">1 hour 30 min</option><option value="120">2 hours</option></select></div>
        <div class="field"><label for="cf-guests">Guests</label><input id="cf-guests" name="guests" placeholder="client@company.com, another@company.com"></div>
        <div class="field full"><label>Team members</label><div class="members">${PEOPLE.map(p => `<label class="check"><input type="checkbox" name="team" value="${esc(p.name)}"${p.name === S ? ' checked disabled' : ''}> ${esc(p.name)}</label>`).join('')}</div></div>
        <div class="field full findbox"><div class="between row"><strong>Find a time</strong><button type="button" class="btn sm" id="cal-find">Find a time</button></div><div class="small muted" id="cal-find-note">Checks your calendar and the team members you pick, 09:00–18:00.</div><div class="slots" id="cal-slots"></div></div>
        <div class="field"><label for="cf-where">Where</label><select id="cf-where" name="where"><option value="meet">Create a Google Meet link</option><option value="loc">In person</option></select></div>
        <div class="field"><label for="cf-loc">Location</label><input id="cf-loc" name="loc" placeholder="Office, board room" disabled></div>
        <div class="field full"><label for="cf-agenda">Agenda</label><textarea id="cf-agenda" name="agenda" rows="3" placeholder="What you'll cover, and what you need from the client"></textarea></div>
        <div class="field"><label for="cf-repeat">Repeat</label><select id="cf-repeat" name="repeat"><option value="none">Does not repeat</option><option value="daily">Every weekday</option><option value="weekly">Weekly</option><option value="biweekly">Every 2 weeks</option><option value="monthly">Monthly</option></select></div>
        <div class="field"><label for="cf-vis">Visibility</label><select id="cf-vis" name="vis"><option value="team">Team can see details</option><option value="private">Private: others see busy only</option><option value="client">Client can see it in their portal</option></select></div>
        <label class="check field full"><input type="checkbox" name="invite" checked> Email invites to team members and guests</label>
      </div></div>
      <div class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary" id="cal-save">Create meeting</button></div>
    </form></dialog>
    </div>`;
  }

  function calMount(root) {
    const view = root.querySelector('#cal-view'), title = root.querySelector('#cal-title');
    const redraw = () => { view.innerHTML = calView(); title.textContent = calTitle(); root.querySelectorAll('#cal-seg button').forEach(b => b.classList.toggle('on', b.dataset.v === CAL.view)); };
    const step = dir => {
      if (CAL.view === 'month') { const d = D(CAL.cursor); CAL.cursor = iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + dir, 1))); }
      else CAL.cursor = add(CAL.cursor, dir * ({ week: 7, day: 1, agenda: 30 }[CAL.view]));
      redraw();
    };
    root.querySelector('#cal-today').onclick = () => { CAL.cursor = TODAY; redraw(); };
    root.querySelector('#cal-prev').onclick = () => step(-1);
    root.querySelector('#cal-next').onclick = () => step(1);
    root.querySelector('#cal-seg').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) { CAL.view = b.dataset.v; redraw(); } });
    const colBtn = root.querySelector('#cal-col');
    colBtn.onclick = () => { CAL.showCol = !CAL.showCol; colBtn.textContent = CAL.showCol ? 'Hide colleagues' : 'Show colleagues'; colBtn.classList.toggle('primary', CAL.showCol); colBtn.setAttribute('aria-pressed', CAL.showCol); redraw(); };
    root.querySelector('#cal-sync').onclick = () => { const n = new Date(); CAL.synced = fmtT(n.getHours() * 60 + n.getMinutes()); root.querySelector('#cal-synced').textContent = CAL.synced; K.toast('Synced with Google Calendar'); };

    /* event dialog */
    const dlgEv = root.querySelector('#cal-dlg-ev');
    let cur = null;
    const fillEv = e => {
      cur = e;
      root.querySelector('#cal-ev-title').textContent = e.title;
      const repeatTxt = { none: '', daily: 'Every weekday', weekly: 'Weekly', biweekly: 'Every 2 weeks', monthly: 'Monthly' }[e.repeat];
      const mine = myRsvp(e);
      root.querySelector('#cal-ev-body').innerHTML = `<div class="stack">
        <div><strong>${esc(fmtLong(e.date))}</strong>, ${range(e.start, e.mins)} <span class="muted">(${e.mins} min${repeatTxt ? ' · ' + repeatTxt : ''})</span></div>
        ${e.client ? `<div>Client: <a href="#client">${esc(e.client)}</a></div>` : ''}
        <div class="row">${e.meet ? `<button class="btn primary" data-act="join">Join Meet</button><span class="small muted">${esc(e.meet)}</span>` : `<span>Location: ${esc(e.location)}</span>`}</div>
        <div><div class="small muted" style="margin-bottom:4px">Your answer</div><div class="seg" id="cal-rsvp">${[['yes', 'Going'], ['maybe', 'Maybe'], ['no', 'No']].map(([k, l]) => `<button data-rsvp="${k}" class="${mine === k ? 'on' : ''}">${l}</button>`).join('')}</div></div>
        <div><h4 style="margin:6px 0">Attendees <span class="muted small">${e.attendees.filter(a => a.rsvp === 'yes').length} going</span></h4>
          ${e.attendees.map(a => `<div class="att">${avatar(a.name, 26)}<span>${esc(a.name)}${a.name === S ? ' <span class="muted small">(you)</span>' : ''}</span><span class="small">${tone(RSVP[a.rsvp][0], RSVP[a.rsvp][1])}</span></div>`).join('')}
          ${e.guests.map(g => `<div class="att"><span></span><span>${esc(g)} <span class="muted small">guest</span></span><span class="small">${tone('No reply', 'muted')}</span></div>`).join('')}</div>
        ${e.agenda ? `<div><h4 style="margin:6px 0">Agenda</h4><div>${esc(e.agenda)}</div></div>` : ''}
        <div class="small muted">Visibility: ${{ team: 'Team can see details', private: 'Private', client: 'Client can see it' }[e.vis]}</div>
      </div>`;
      root.querySelector('#cal-ev-foot').innerHTML = `<button class="btn" data-act="edit">Edit</button><button class="btn danger" data-act="cancel-one">${e.series ? 'Cancel this one' : 'Cancel meeting'}</button>${e.series ? '<button class="btn danger" data-act="cancel-all">Cancel all in series</button>' : ''}`;
    };
    root.addEventListener('click', e => {
      const ev = e.target.closest('[data-ev]');
      if (ev) { const x = EVENTS.find(z => z.id === ev.dataset.ev); if (x) { fillEv(x); dlgEv.showModal && dlgEv.showModal(); } return; }
      const day = e.target.closest('[data-day]');
      if (day) { CAL.cursor = day.dataset.day; CAL.view = 'day'; redraw(); return; }
    });
    dlgEv.addEventListener('click', e => {
      const r = e.target.closest('[data-rsvp]');
      if (r && cur) {
        let me = cur.attendees.find(a => a.name === S); if (!me) cur.attendees.unshift(me = { name: S, rsvp: 'pending' });
        me.rsvp = r.dataset.rsvp; fillEv(cur); redraw(); K.toast(`You replied ${RSVP[me.rsvp][0].toLowerCase()}`); return;
      }
      const a = e.target.closest('[data-act]'); if (!a || !cur) return;
      const act = a.dataset.act;
      if (act === 'join') K.toast('Opening Google Meet (preview only)');
      if (act === 'cancel-one' || act === 'cancel-all') {
        const kill = act === 'cancel-all' ? EVENTS.filter(z => z.series === cur.series) : [cur];
        kill.forEach(k => EVENTS.splice(EVENTS.indexOf(k), 1));
        dlgEv.close(); redraw(); K.toast(kill.length > 1 ? `${kill.length} meetings cancelled. Attendees emailed.` : 'Meeting cancelled. Attendees emailed.');
      }
      if (act === 'edit') { dlgEv.close(); openForm(cur.client ? 'client' : 'internal', cur); }
    });

    /* new / edit meeting form */
    const dlgNew = root.querySelector('#cal-dlg-new'), form = root.querySelector('#cal-form');
    const F = n => form.elements[n];
    const openForm = (kind, ev) => {
      form.reset();
      F('kind').value = kind; F('edit').value = ev ? ev.id : '';
      root.querySelector('#cal-new-title').textContent = ev ? 'Edit meeting' : kind === 'client' ? 'New client meeting' : 'New meeting';
      root.querySelector('#cal-save').textContent = ev ? 'Save changes' : 'Create meeting';
      F('client').required = kind === 'client';
      root.querySelector('#cal-slots').innerHTML = '';
      F('date').value = ev ? ev.date : (CAL.cursor >= TODAY ? CAL.cursor : TODAY);
      if (ev) {
        F('client').value = ev.client; F('title').value = ev.title; F('start').value = ev.start; F('len').value = String(ev.mins);
        F('agenda').value = ev.agenda; F('repeat').value = ev.repeat; F('vis').value = ev.vis; F('guests').value = ev.guests.join(', ');
        form.querySelectorAll('[name=team]').forEach(c => { c.checked = c.disabled || ev.attendees.some(a => a.name === c.value); });
        F('where').value = ev.meet ? 'meet' : 'loc'; F('loc').value = ev.location;
      }
      F('loc').disabled = F('where').value !== 'loc';
      if (kind === 'client' && !ev) F('vis').value = 'client';
      if (dlgNew.showModal && !dlgNew.open) dlgNew.showModal();
    };
    root.querySelectorAll('[data-open="cal-dlg-new"]').forEach(b => b.addEventListener('click', () => openForm(b.dataset.kind)));
    F('where').addEventListener('change', () => { F('loc').disabled = F('where').value !== 'loc'; });
    root.querySelector('#cal-find').addEventListener('click', () => {
      const date = F('date').value || TODAY, len = +F('len').value;
      const team = [S, ...[...form.querySelectorAll('[name=team]:checked')].map(c => c.value).filter(n => n !== S)];
      const off = leaveOn(date).map(l => l.name).filter(n => team.includes(n));
      const blocks = [...evOn(date).filter(e => e.attendees.some(a => team.includes(a.name))).map(e => [toMin(e.start), toMin(e.start) + e.mins]),
        ...busyOn(date).filter(b => team.includes(b.name)).map(b => [toMin(b.start), toMin(b.start) + b.mins])];
      const slots = [];
      if (!isWeekend(date) && !HOLIDAYS[date]) for (let m = 9 * 60; m + len <= 18 * 60 && slots.length < 5; m += 30) {
        if (date === TODAY && m < NOW_MIN) continue;
        if (!blocks.some(([a, b]) => m < b && m + len > a)) slots.push(fmtT(m));
      }
      const note = root.querySelector('#cal-find-note');
      note.textContent = off.length ? `${off.join(', ')} on leave that day.` : HOLIDAYS[date] || isWeekend(date) ? 'That day is a holiday or weekend. Pick another date.' : `Free for ${team.map(n => n.split(' ')[0]).join(', ')} on ${fmtShort(date)}:`;
      root.querySelector('#cal-slots').innerHTML = slots.map(s => `<button type="button" class="btn sm" data-slot="${s}">${s}–${fmtT(toMin(s) + len)}</button>`).join('') || (off.length || HOLIDAYS[date] || isWeekend(date) ? '' : '<span class="small muted">No shared free time. Try another day.</span>');
    });
    root.querySelector('#cal-slots').addEventListener('click', e => { const s = e.target.closest('[data-slot]'); if (s) { F('start').value = s.dataset.slot; K.toast(`Start set to ${s.dataset.slot}`); } });
    form.addEventListener('submit', e => {
      e.preventDefault();
      const team = [...form.querySelectorAll('[name=team]:checked')].map(c => c.value).filter(n => n !== S);
      const data = {
        date: F('date').value || TODAY, start: F('start').value, mins: +F('len').value, title: F('title').value.trim() || 'Untitled meeting',
        kind: F('client').value ? 'client' : 'internal', client: F('client').value, agenda: F('agenda').value, repeat: F('repeat').value, vis: F('vis').value,
        guests: F('guests').value.split(',').map(x => x.trim()).filter(Boolean),
        meet: F('where').value === 'meet' ? 'meet.google.com/new-' + Math.random().toString(36).slice(2, 6) : '', location: F('where').value === 'loc' ? (F('loc').value || 'Office') : '',
      };
      const editing = EVENTS.find(z => z.id === F('edit').value);
      if (editing) { Object.assign(editing, data, { meet: data.meet && editing.meet ? editing.meet : data.meet }); editing.attendees = [{ name: S, rsvp: 'yes' }, ...team.map(n => editing.attendees.find(a => a.name === n) || { name: n, rsvp: 'pending' })]; }
      else EVENTS.push(Object.assign({ id: 'e' + (++EID), series: data.repeat !== 'none' ? 'n' + EID : null, attendees: [{ name: S, rsvp: 'yes' }, ...team.map(n => ({ name: n, rsvp: 'pending' }))] }, data));
      CAL.cursor = data.date; redraw();
    });
  }

  screen({ id: 'calendar', title: 'Calendar', group: 'Core', render: calRender, mount: calMount,
    _views: v => { const keep = CAL.view; CAL.view = v; try { return calView(); } finally { CAL.view = keep; } },
    _state: CAL });
})();

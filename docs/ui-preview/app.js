/* App shell: sidebar, top bar, dialogs, shortcuts and hash router. Loaded last. */
(function () {
  'use strict';
  const K = window.K;
  const { esc, avatar, toast } = K;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* ---------- Safe storage ---------- */
  const ls = {
    get(k, d) { try { const v = localStorage.getItem('ps.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('ps.' + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
  };
  const state = {
    collapsed: ls.get('collapsed', false),
    folded: ls.get('folded', []),
    pinned: ls.get('pinned', ['tickets', 'clients', 'invoices']),
    view: ls.get('view', 'team'),
    theme: ls.get('theme', 'system'),
    status: ls.get('status', 'Available'),
    clockedIn: true,
    unread: 6,
  };

  /* ---------- Titles and help text ---------- */
  const TITLE = {
    home: 'Home', 'my-work': 'My work', calendar: 'Calendar', chat: 'Chat',
    tickets: 'Tickets', projects: 'Projects', reviews: 'Reviews', templates: 'Templates',
    clients: 'Clients', 'response-times': 'Response times', meetings: 'Meetings', files: 'Files',
    finance: 'Finance', invoices: 'Invoices', profitability: 'Profitability', payments: 'Payments', 'billing-clients': 'Billing clients', 'payment-reminders': 'Payment reminders',
    directory: 'Directory', 'org-chart': 'Org chart', performance: 'Performance',
    profile: 'My profile', time: 'Time', prefs: 'Settings',
    ticket: 'Ticket', client: 'Client', invoice: 'Invoice', recurring: 'Recurring ticket', 'finance-setup': 'Finance setup',
    'portal-home': 'Home', 'portal-work': 'Our work', 'portal-meetings': 'Meetings', 'portal-files': 'Files', 'portal-invoices': 'Invoices', 'portal-messages': 'Messages',
  };
  const DESC = {
    home: 'Your day at a glance: due work, reviews waiting on you, meetings and client health.',
    'my-work': 'Every ticket assigned to you, grouped by due date.',
    calendar: 'Due dates, meetings and leave across the team.',
    chat: 'Team and client conversations, updated live.',
    tickets: 'All tickets across projects, as a list or a board.',
    projects: 'Client projects with leads, progress and budgets.',
    reviews: 'Work waiting for approval before it goes to the client.',
    templates: 'Reusable ticket checklists for repeat work.',
    clients: 'Every client with health, services, owner and fee.',
    'response-times': 'How fast we answer client emails and messages.',
    meetings: 'Client meetings with notes and action items.',
    files: 'Shared files and deliverables by client.',
    finance: 'Revenue, outstanding balances and cash flow.',
    invoices: 'Draft, sent, paid and overdue invoices.',
    profitability: 'Fee against time cost for each client.',
    payments: 'Payments received and how they were matched.',
    'billing-clients': 'Billing details and currency for each client.',
    'payment-reminders': 'Automatic reminders for unpaid invoices.',
    directory: 'Everyone on the team and how to reach them.',
    'org-chart': 'Who reports to whom.',
    performance: 'Delivery, on-time rate and review scores by person.',
    profile: 'Your details, skills and working hours.',
    time: 'Your timesheet and logged hours.',
    prefs: 'Theme, density, notifications and account settings.',
    'portal-home': 'What is happening on your account right now.',
    'portal-work': 'Work in progress and work waiting for your approval.',
    'portal-meetings': 'Upcoming and past meetings with our team.',
    'portal-files': 'Reports and deliverables we have shared with you.',
    'portal-invoices': 'Your invoices and payment status.',
    'portal-messages': 'Message your account team.',
  };
  const title = id => (K.SCREENS[id] && K.SCREENS[id].title) || TITLE[id] || id;

  /* ---------- Icons ---------- */
  const ICON = {
    home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    'my-work': '<path d="M9 11l2 2 4-4"/><rect x="4" y="4" width="16" height="16" rx="3"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    chat: '<path d="M4 5h16v11H9l-5 4z"/>',
    tickets: '<path d="M4 7a2 2 0 0 0 2-2h12a2 2 0 0 0 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 0-2 2H6a2 2 0 0 0-2-2v-3a2 2 0 0 0 0-4z"/><path d="M14 5v14" stroke-dasharray="2 2"/>',
    projects: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    reviews: '<path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z"/><circle cx="12" cy="12" r="3"/>',
    templates: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    clients: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.3-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14.8c1.6.8 2.6 2.5 3 5.2"/>',
    'response-times': '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>',
    meetings: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>',
    files: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
    finance: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    invoices: '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h4"/>',
    profitability: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    payments: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19M6 15h4"/>',
    'billing-clients': '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    'payment-reminders': '<path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    directory: '<rect x="4" y="3" width="16" height="18" rx="2"/><circle cx="12" cy="10" r="3"/><path d="M7.5 17.5c.8-2 2.5-3 4.5-3s3.7 1 4.5 3"/>',
    'org-chart': '<rect x="9" y="3" width="6" height="5" rx="1"/><rect x="2.5" y="16" width="6" height="5" rx="1"/><rect x="15.5" y="16" width="6" height="5" rx="1"/><path d="M12 8v4M5.5 16v-4h13v4"/>',
    performance: '<path d="M12 21a9 9 0 1 1 9-9"/><path d="M12 12l5-5"/><circle cx="12" cy="12" r="1.5"/>',
    profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
    time: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    prefs: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    ticket: '<path d="M9 11l2 2 4-4"/><rect x="4" y="4" width="16" height="16" rx="3"/>',
    client: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
    invoice: '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6"/>',
    recurring: '<path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5"/>',
    'finance-setup': '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
    'portal-home': '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    'portal-work': '<path d="M9 11l2 2 4-4"/><rect x="4" y="4" width="16" height="16" rx="3"/>',
    'portal-meetings': '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>',
    'portal-files': '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
    'portal-invoices': '<path d="M6 2h12v20l-3-2-3 2-3-2-3 2z"/><path d="M9 7h6M9 11h6M9 15h4"/>',
    'portal-messages': '<path d="M4 5h16v11H9l-5 4z"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    collapse: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 10l-2 2 2 2"/>',
    expand: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M13 10l2 2-2 2"/>',
    chev: '<path d="M6 9l6 6 6-6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.3a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.3-2.5 3.8M12 17h.01"/>',
    bell: '<path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
    system: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    stop: '<rect x="7" y="7" width="10" height="10" rx="1.5"/>',
    play: '<path d="M8 5.5v13l10-6.5z"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    out: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4"/>',
    keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
    build: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/>',
  };
  const svg = (name, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${ICON[name] || ICON.templates}</svg>`;

  /* ---------- Navigation groups ---------- */
  const GROUPS = [
    { name: 'Core', label: null, ids: ['home', 'my-work', 'calendar', 'chat'] },
    { name: 'Work', label: 'Work', ids: ['tickets', 'projects', 'reviews', 'templates'] },
    { name: 'Clients', label: 'Clients', ids: ['clients', 'response-times', 'meetings', 'files'] },
    { name: 'Finance', label: 'Finance', ids: ['finance', 'invoices', 'profitability', 'payments', 'billing-clients', 'payment-reminders'] },
    { name: 'Team', label: 'Team', ids: ['directory', 'org-chart', 'performance'] },
    { name: 'Personal', label: 'Personal', ids: ['profile', 'time', 'prefs'] },
  ];
  const PORTAL = [{ name: 'Portal', label: null, ids: ['portal-home', 'portal-work', 'portal-meetings', 'portal-files', 'portal-invoices', 'portal-messages'] }];
  const COUNTS = { chat: 3, reviews: 2, 'portal-work': 2, 'portal-messages': 1 };
  const STATUSES = [['Available', 'ok'], ['Meeting', 'violet'], ['Focus', 'blue'], ['Away', 'warn'], ['Sick', 'danger']];
  const CLIENT_USER = { name: 'Karim Nassar', org: 'Alba Motors', role: 'Marketing Director' };

  const groups = () => (state.view === 'client' ? PORTAL : GROUPS);
  const allIds = () => groups().flatMap(g => g.ids);
  const isPortal = id => id.startsWith('portal-');
  const statusTone = s => (STATUSES.find(x => x[0] === s) || STATUSES[0])[1];

  /* ---------- Elements ---------- */
  const app = $('.app');
  const side = $('#sidebar');
  const bar = $('#topbar');
  let main = $('#main');
  const back = $('.backdrop');

  /* ---------- Theme ---------- */
  function applyTheme() {
    const r = document.documentElement;
    if (state.theme === 'system') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', state.theme);
    const dens = ls.get('density', null);
    if (dens) r.setAttribute('data-density', dens);
    const b = $('#theme-btn');
    if (b) {
      const label = { system: 'Theme: system', light: 'Theme: light', dark: 'Theme: dark' }[state.theme];
      b.innerHTML = svg(state.theme === 'dark' ? 'moon' : state.theme === 'light' ? 'sun' : 'system');
      b.title = label; b.setAttribute('aria-label', label + '. Click to change');
    }
  }

  /* ---------- Sidebar ---------- */
  const mark = `<svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="var(--accent)"/><text x="16" y="21" text-anchor="middle" font-family="Plus Jakarta Sans, Inter, sans-serif" font-weight="800" font-size="13" fill="#fff">PS</text></svg>`;
  const markClient = `<svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="var(--blue)"/><text x="16" y="21" text-anchor="middle" font-family="Plus Jakarta Sans, Inter, sans-serif" font-weight="800" font-size="13" fill="#fff">AM</text></svg>`;

  function navLink(id) {
    const c = COUNTS[id];
    return `<a class="nav-link" href="#${id}" data-id="${id}" title="${esc(title(id))}">${svg(id)}<span class="txt">${esc(title(id))}</span>${c ? `<span class="count" aria-label="${c} new">${c}</span>` : ''}</a>`;
  }

  function renderSidebar() {
    const client = state.view === 'client';
    const pins = state.pinned.filter(id => (client ? isPortal(id) : !isPortal(id))).slice(0, 12);
    const who = client ? CLIENT_USER.name : K.ME.name;
    side.innerHTML = `
      <div class="brand">
        ${client ? markClient : mark}
        <span class="brand-name">${client ? esc(CLIENT_USER.org) : esc(K.WORKSPACE)}<span class="brand-sub">${client ? 'Client portal' : 'Agency portal'}</span></span>
        <button class="icon-btn sm collapse-btn" data-act="collapse" aria-label="${state.collapsed ? 'Expand sidebar' : 'Collapse sidebar'}" title="${state.collapsed ? 'Expand' : 'Collapse'} ( [ )">${svg(state.collapsed ? 'expand' : 'collapse')}</button>
      </div>
      ${client ? '' : `
      <div class="clock">
        <div class="clock-top">
          <span class="clock-text">${state.clockedIn ? 'Clocked in <b>09:02</b> · 5h 41m' : 'Clocked out at <b>14:43</b> · 5h 41m'}</span>
        </div>
        <div class="bar${state.clockedIn ? '' : ' t-muted'}" title="5h 41m of 8h"><i style="width:71%"></i></div>
        <button class="btn sm" data-act="clock">${state.clockedIn ? 'Clock out' : 'Clock in'}</button>
      </div>`}
      ${pins.length ? `<nav class="nav-group" aria-label="Pinned"><span class="side-sec-title">Pinned</span><div class="pinned">${pins.map(navLink).join('')}</div></nav>` : ''}
      ${groups().map(g => {
        const folded = g.label && state.folded.includes(g.name);
        return `<nav class="nav-group${folded ? ' folded' : ''}" aria-label="${esc(g.label || 'Main')}">
          ${g.label ? `<button class="nav-label" data-fold="${g.name}" aria-expanded="${!folded}">${esc(g.label)}${svg('chev')}</button>` : ''}
          <div class="nav-links">${g.ids.map(navLink).join('')}</div>
        </nav>`;
      }).join('')}
      <div class="side-foot">
        <div class="seg" role="group" aria-label="Preview as">
          <button data-view="team" class="${client ? '' : 'on'}" aria-pressed="${!client}">Team view</button>
          <button data-view="client" class="${client ? 'on' : ''}" aria-pressed="${client}">Client view</button>
        </div>
        <button class="me-btn" data-act="me" aria-haspopup="menu" aria-expanded="false">
          ${avatar(who, 34)}
          <span class="me-meta"><b>${esc(who)}</b>${client ? `<span class="small muted">${esc(CLIENT_USER.role)}</span>` : K.tone(state.status, statusTone(state.status))}</span>
        </button>
        <div class="menu" id="me-menu" role="menu" hidden>
          ${client ? '' : STATUSES.map(([s, t]) => `<button role="menuitemradio" aria-checked="${s === state.status}" data-status="${s}" class="${s === state.status ? 'on' : ''}">${K.tone(s, t)}</button>`).join('') + '<hr>'}
          <a role="menuitem" href="#${client ? 'portal-home' : 'profile'}">${svg('profile')}${client ? 'My account' : 'My profile'}</a>
          <button role="menuitem" data-act="signout">${svg('out')}Sign out</button>
        </div>
      </div>`;
    markActive();
  }

  function markActive() {
    const id = currentId();
    $$('.nav-link', side).forEach(a => {
      const on = a.dataset.id === id;
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }

  side.addEventListener('click', e => {
    const t = e.target;
    const fold = t.closest('[data-fold]');
    if (fold) {
      const n = fold.dataset.fold;
      state.folded = state.folded.includes(n) ? state.folded.filter(x => x !== n) : state.folded.concat(n);
      ls.set('folded', state.folded); renderSidebar(); return;
    }
    const v = t.closest('[data-view]');
    if (v) { setView(v.dataset.view, true); return; }
    const st = t.closest('[data-status]');
    if (st) { state.status = st.dataset.status; ls.set('status', state.status); renderSidebar(); toast(`Status set to ${state.status}`); return; }
    const act = t.closest('[data-act]');
    if (act) {
      const a = act.dataset.act;
      if (a === 'collapse') toggleCollapse();
      else if (a === 'clock') { state.clockedIn = !state.clockedIn; renderSidebar(); toast(state.clockedIn ? 'Clocked in at 14:44' : 'Clocked out at 14:43 · 5h 41m today'); }
      else if (a === 'me') { const m = $('#me-menu'); const open = m.hidden; closeMenus(); m.hidden = !open; act.setAttribute('aria-expanded', String(open)); }
      else if (a === 'signout') { closeMenus(); toast('Signed out (preview only)'); }
      return;
    }
    if (t.closest('a')) { closeMenus(); closeDrawer(); }
  });

  function toggleCollapse() {
    state.collapsed = !state.collapsed; ls.set('collapsed', state.collapsed);
    app.classList.toggle('is-collapsed', state.collapsed); renderSidebar();
  }

  function setView(v, navigate) {
    if (v !== 'team' && v !== 'client') return;
    const changed = state.view !== v;
    state.view = v; ls.set('view', v);
    if (changed) { renderSidebar(); buildPalette(); }
    if (navigate) location.hash = v === 'client' ? '#portal-home' : '#home';
  }

  /* ---------- Top bar ---------- */
  const NOTIFS = [
    { who: 'Omar Haddad', text: 'moved <b>CPD-142</b> to In review', time: '6 min ago', href: '#ticket' },
    { who: 'Ayesha Khan', text: 'mentioned you on <b>ALB-88 Q4 ad copy</b>', time: '24 min ago', href: '#ticket' },
    { who: 'Bilal Ahmed', text: 'marked invoice <b>INV-2041</b> as paid', time: '1 h ago', href: '#invoice' },
    { who: 'Hamza Qureshi', text: 'flagged <b>Luma Skincare</b> as at risk', time: '2 h ago', href: '#client' },
    { who: 'Priya Nair', text: 'asked for a review on <b>LUM-57 blog draft</b>', time: '3 h ago', href: '#reviews' },
    { who: 'Daniel Reyes', text: 'booked <b>Harbor Legal launch call</b> for Thu 10:00', time: 'Yesterday', href: '#meetings' },
  ];

  function renderTopbar() {
    bar.innerHTML = `
      <button class="icon-btn hamburger" data-act="drawer" aria-label="Open menu" aria-controls="sidebar" aria-expanded="false">${svg('menu')}</button>
      <div class="tb-title">
        <h1 id="page-title">Home</h1>
        <button class="icon-btn sm pin-btn" data-act="pin" aria-pressed="false" aria-label="Pin this page" title="Pin to sidebar">${svg('star')}</button>
        <button class="icon-btn sm help-btn" data-act="help" aria-label="About this page" aria-expanded="false" title="About this page">${svg('help')}</button>
        <div class="menu help-pop" id="help-pop" role="tooltip" hidden></div>
      </div>
      <div class="tb-actions">
        <button class="search-btn" data-act="palette" aria-label="Search (Ctrl K)">${svg('search')}<span class="txt">Search</span><kbd>Ctrl K</kbd></button>
        <div class="timer" id="timer" title="Running timer">
          <span class="dot" aria-hidden="true"></span>
          <a class="tk" href="#ticket">CPD-142</a>
          <span class="t" id="timer-t" aria-live="off">00:23:10</span>
          <button class="icon-btn sm" data-act="timer" aria-label="Stop timer">${svg('stop')}</button>
        </div>
        <button class="icon-btn" data-act="bell" aria-label="Notifications, ${state.unread} unread" aria-expanded="false">${svg('bell')}</button>
        <span class="bell-count" id="bell-count" aria-hidden="true">${state.unread || ''}</span>
        <div class="menu bell-panel" id="bell-panel" hidden>
          <div class="bp-head"><h3>Notifications</h3><button class="btn ghost sm" data-act="readall">Mark all read</button></div>
          <div class="bp-list">${NOTIFS.map(n => `<a class="notif${state.unread ? ' unread' : ''}" href="${n.href}">${avatar(n.who, 30)}<span class="n-body"><b>${esc(n.who)}</b> ${n.text}<br><span class="n-time">${n.time}</span></span></a>`).join('')}</div>
        </div>
        <button class="icon-btn" id="theme-btn" data-act="theme"></button>
        <button class="btn primary new-ticket" data-act="new" title="New ticket (C)">${svg('plus')}<span class="txt">New ticket</span></button>
      </div>`;
    applyTheme();
  }

  // Timer
  let secs = 23 * 60 + 10, running = true;
  const fmt = s => [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(n => String(n).padStart(2, '0')).join(':');
  setInterval(() => { if (!running) return; secs++; const t = $('#timer-t'); if (t) t.textContent = fmt(secs); }, 1000);
  function toggleTimer(btn) {
    running = !running;
    $('#timer').classList.toggle('stopped', !running);
    btn.innerHTML = svg(running ? 'stop' : 'play');
    btn.setAttribute('aria-label', running ? 'Stop timer' : 'Resume timer');
    toast(running ? 'Timer resumed on CPD-142' : `Timer stopped · ${fmt(secs)} logged to CPD-142`);
  }

  bar.addEventListener('click', e => {
    const act = e.target.closest('[data-act]');
    if (!act) { if (e.target.closest('a')) closeMenus(); return; }
    const a = act.dataset.act;
    if (a === 'drawer') openDrawer();
    else if (a === 'pin') togglePin();
    else if (a === 'help') { const p = $('#help-pop'); const open = p.hidden; closeMenus(); p.hidden = !open; act.setAttribute('aria-expanded', String(open)); }
    else if (a === 'palette') openPalette();
    else if (a === 'timer') toggleTimer(act);
    else if (a === 'bell') { const p = $('#bell-panel'); const open = p.hidden; closeMenus(); p.hidden = !open; act.setAttribute('aria-expanded', String(open)); }
    else if (a === 'readall') { state.unread = 0; $('#bell-count').textContent = ''; $$('.notif', bar).forEach(n => n.classList.remove('unread')); toast('All notifications marked read'); }
    else if (a === 'theme') { state.theme = { system: 'light', light: 'dark', dark: 'system' }[state.theme] || 'system'; ls.set('theme', state.theme); applyTheme(); toast(`Theme: ${state.theme}`); }
    else if (a === 'new') openNewTicket();
  });

  function togglePin() {
    const id = currentId();
    if (state.pinned.includes(id)) state.pinned = state.pinned.filter(x => x !== id);
    else {
      if (state.pinned.length >= 12) { toast('You can pin up to 12 pages'); return; }
      state.pinned = state.pinned.concat(id);
    }
    ls.set('pinned', state.pinned); renderSidebar(); updatePinBtn();
    toast(state.pinned.includes(id) ? `Pinned ${title(id)}` : `Unpinned ${title(id)}`);
  }
  function updatePinBtn() {
    const b = $('.pin-btn', bar); if (!b) return;
    const on = state.pinned.includes(currentId());
    b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', on ? 'Unpin this page' : 'Pin this page');
  }

  /* ---------- Menus and drawer ---------- */
  function closeMenus() {
    $$('.menu').forEach(m => { m.hidden = true; });
    $$('[aria-expanded="true"]').forEach(b => { if (!b.classList.contains('nav-label') && b.dataset.act !== 'drawer') b.setAttribute('aria-expanded', 'false'); });
  }
  function openDrawer() { side.classList.add('open'); back.classList.add('open'); $('[data-act="drawer"]').setAttribute('aria-expanded', 'true'); const f = $('.nav-link.on', side) || $('.nav-link', side); if (f) f.focus(); }
  function closeDrawer() { side.classList.remove('open'); back.classList.remove('open'); const h = $('[data-act="drawer"]'); if (h) h.setAttribute('aria-expanded', 'false'); }
  back.addEventListener('click', closeDrawer);
  document.addEventListener('click', e => { if (!e.target.closest('.menu, [data-act="me"], [data-act="bell"], [data-act="help"]')) closeMenus(); });

  /* ---------- Dialogs ---------- */
  const TICKETS = [
    ['CPD-142', 'Fix crawl errors on service pages', 'Cedar & Pine SEO'],
    ['ALB-88', 'Q4 ad copy for Search campaigns', 'Alba Motors Ads'],
    ['LUM-57', 'Blog draft: vitamin C serum guide', 'Luma Growth'],
    ['HBR-31', 'Contact form spam filter', 'Harbor Website'],
    ['NOV-19', 'November content calendar', 'Nova Social'],
  ];
  const holder = document.createElement('div');
  holder.id = 'shell-dialogs';
  document.body.appendChild(holder);
  holder.innerHTML = `
    <dialog class="modal palette" id="dlg-palette" aria-label="Search">
      <div class="pal-input">${svg('search')}<input id="pal-q" type="text" placeholder="Search pages, tickets and clients" autocomplete="off" aria-controls="pal-list" aria-label="Search"><kbd>Esc</kbd></div>
      <div class="pal-list" id="pal-list" role="listbox"></div>
    </dialog>

    <dialog class="modal" id="dlg-new-ticket" aria-labelledby="nt-title">
      <form method="dialog" id="nt-form">
        <div class="modal-head"><h2 id="nt-title">New ticket</h2><button type="button" class="icon-btn" data-close aria-label="Close">${svg('x')}</button></div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="field full"><label for="nt-tpl">Template</label>
              <select id="nt-tpl"><option>No template</option><option>Monthly SEO report</option><option>Blog post (1,500 words)</option><option>Landing page build</option><option>Google Ads campaign launch</option><option>Technical SEO audit</option></select></div>
            <div class="field full"><label for="nt-titl">Title</label><input id="nt-titl" required placeholder="Fix crawl errors on service pages"></div>
            <div class="field"><label for="nt-proj">Project</label><select id="nt-proj">${K.PROJECTS.map(p => `<option value="${p.key}">${esc(p.key)} · ${esc(p.name)}</option>`).join('')}</select></div>
            <div class="field"><label for="nt-asg">Assignee</label><select id="nt-asg">${K.PEOPLE.map(p => `<option${p.name === 'Omar Haddad' ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
            <div class="field"><label for="nt-pri">Priority</label><select id="nt-pri"><option>Urgent</option><option>High</option><option selected>Normal</option><option>Low</option></select></div>
            <div class="field"><label for="nt-due">Due</label><input id="nt-due" type="date" value="2026-11-11"></div>
            <div class="field full"><label for="nt-desc">Description</label><textarea id="nt-desc" placeholder="What needs doing? Type @ to mention someone. Paste images straight in."></textarea></div>
            <div class="field full"><label for="nt-files">Files</label><input id="nt-files" type="file" multiple></div>
            <div class="field full"><label for="nt-done">Done when</label><input id="nt-done" placeholder="All 404s on /services return 200 and Search Console shows 0 errors"></div>
            <div class="field full"><label for="nt-tags">Tags</label><input id="nt-tags" placeholder="technical, on-page"></div>
          </div>
        </div>
        <div class="modal-foot">
          <button type="button" class="btn ghost" data-close>Cancel</button>
          <button type="button" class="btn" data-act="nt-open">Create and open</button>
          <button type="submit" class="btn primary">Create ticket</button>
        </div>
      </form>
    </dialog>

    <dialog class="modal" id="dlg-shortcuts" aria-labelledby="sc-title">
      <div class="modal-head"><h2 id="sc-title">Keyboard shortcuts</h2><button type="button" class="icon-btn" data-close aria-label="Close">${svg('x')}</button></div>
      <div class="modal-body"><div class="keys">
        ${[['Search pages, tickets and clients', '<kbd>Ctrl K</kbd> or <kbd>/</kbd>'], ['New ticket', '<kbd>C</kbd>'], ['Collapse or expand the sidebar', '<kbd>[</kbd>'], ['Show shortcuts', '<kbd>?</kbd>'], ['Close a menu or dialog', '<kbd>Esc</kbd>'], ['Move through search results', '<kbd>↑</kbd> <kbd>↓</kbd> then <kbd>Enter</kbd>']]
          .map(([a, k]) => `<div class="k-row"><span>${a}</span><span>${k}</span></div>`).join('')}
      </div></div>
      <div class="modal-foot"><button type="button" class="btn" data-close>Close</button></div>
    </dialog>`;
  K.wireModals(holder); // handles [data-close] and the form submit toast

  const ntForm = $('#nt-form');
  ntForm.addEventListener('submit', () => { setTimeout(() => { ntForm.reset(); toast('Ticket CPD-143 created'); }, 0); });
  $('[data-act="nt-open"]', holder).addEventListener('click', () => {
    $('#dlg-new-ticket').close(); ntForm.reset(); toast('Ticket CPD-143 created'); location.hash = '#ticket';
  });
  function openNewTicket() {
    closeMenus(); closeDrawer();
    if (state.view === 'client') { toast('Clients send requests from Messages'); location.hash = '#portal-messages'; return; }
    const d = $('#dlg-new-ticket'); if (!d.open) d.showModal(); setTimeout(() => $('#nt-titl').focus(), 30);
  }
  function openShortcuts() { closeMenus(); const d = $('#dlg-shortcuts'); if (!d.open) d.showModal(); }

  // Command palette
  let palItems = [], palSel = 0;
  function buildPalette() {
    const client = state.view === 'client';
    const pages = allIds().map(id => ({ sec: 'Pages', label: title(id), href: '#' + id, icon: id, meta: '' }));
    const extra = client ? [] : [
      ...TICKETS.map(([k, t, p]) => ({ sec: 'Tickets', label: `${k} ${t}`, href: '#ticket', icon: 'ticket', meta: p })),
      ...K.CLIENTS.map(c => ({ sec: 'Clients', label: c.name, href: '#client', icon: 'client', meta: c.services.join(', ') })),
    ];
    palItems = pages.concat(extra);
    renderPalette();
  }
  function renderPalette() {
    const q = ($('#pal-q').value || '').trim().toLowerCase();
    const list = palItems.filter(i => !q || (i.label + ' ' + i.meta).toLowerCase().includes(q));
    palSel = Math.min(palSel, Math.max(list.length - 1, 0));
    const box = $('#pal-list');
    if (!list.length) { box.innerHTML = `<div class="pal-empty">Nothing matches "${esc(q)}"</div>`; return; }
    let sec = '', html = '';
    list.forEach((i, n) => {
      if (i.sec !== sec) { sec = i.sec; html += `<div class="pal-sec">${sec}</div>`; }
      html += `<a class="pal-item${n === palSel ? ' on' : ''}" role="option" aria-selected="${n === palSel}" href="${i.href}" data-n="${n}">${svg(i.icon)}<span>${esc(i.label)}</span><span class="meta">${esc(i.meta)}</span></a>`;
    });
    box.innerHTML = html;
    const on = $('.pal-item.on', box); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest' });
  }
  function openPalette() {
    closeMenus(); closeDrawer();
    const d = $('#dlg-palette'); $('#pal-q').value = ''; palSel = 0; renderPalette();
    if (!d.open) d.showModal(); $('#pal-q').focus();
  }
  $('#pal-q').addEventListener('input', () => { palSel = 0; renderPalette(); });
  $('#pal-q').addEventListener('keydown', e => {
    const items = $$('.pal-item', holder);
    if (e.key === 'ArrowDown') { e.preventDefault(); palSel = Math.min(palSel + 1, items.length - 1); renderPalette(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); palSel = Math.max(palSel - 1, 0); renderPalette(); }
    else if (e.key === 'Enter') { e.preventDefault(); const it = items[palSel]; if (it) { $('#dlg-palette').close(); location.hash = it.getAttribute('href'); } }
  });
  $('#pal-list').addEventListener('click', e => { if (e.target.closest('.pal-item')) $('#dlg-palette').close(); });
  $('#dlg-palette').addEventListener('click', e => { if (e.target.id === 'dlg-palette') e.target.close(); });

  /* ---------- Keyboard ---------- */
  document.addEventListener('keydown', e => {
    const typing = e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]');
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); return; }
    if (e.key === 'Escape') { closeMenus(); closeDrawer(); return; }
    if (typing || mod || e.altKey) return;
    if ($('dialog[open]')) return;
    if (e.key === '/') { e.preventDefault(); openPalette(); }
    else if (e.key === 'c' || e.key === 'C') { e.preventDefault(); openNewTicket(); }
    else if (e.key === '[') { e.preventDefault(); if (window.innerWidth > 900) toggleCollapse(); }
    else if (e.key === '?') { e.preventDefault(); openShortcuts(); }
  });

  /* ---------- Router ---------- */
  function currentId() {
    const h = (location.hash || '').replace(/^#\/?/, '').split(/[?/]/)[0];
    return /^[a-z0-9-]+$/i.test(h) ? h : (state.view === 'client' ? 'portal-home' : 'home');
  }

  const placeholder = id => `<div class="page"><div class="card"><div class="empty">${svg('build')}<h3>This screen is still being built</h3><p>${esc(title(id))} will appear here once its screen file is ready.</p><a class="btn" href="#${state.view === 'client' ? 'portal-home' : 'home'}">Go to home</a></div></div></div>`;
  const errorCard = (id, err) => `<div class="page"><div class="card error-card"><div class="card-head"><h3>${esc(title(id))} couldn't load</h3></div><div class="card-body stack"><p class="muted">Something went wrong while drawing this screen.</p><pre>${esc(err && err.message ? err.message : String(err))}</pre><div class="row"><button class="btn primary" data-retry>Retry</button><a class="btn ghost" href="#home">Go to home</a></div></div></div></div>`;

  function route() {
    const id = currentId();
    if (isPortal(id) && state.view !== 'client') setView('client', false);
    else if (!isPortal(id) && state.view === 'client') setView('team', false);

    // wireModals binds a click listener on the root each time, so use a fresh <main> per render to avoid stacking handlers.
    const fresh = main.cloneNode(false); main.replaceWith(fresh); main = fresh;
    const def = K.SCREENS[id];
    let ok = false;
    if (!def) main.innerHTML = placeholder(id);
    else {
      try { main.innerHTML = def.render(); ok = true; }
      catch (err) { console.error(err); main.innerHTML = errorCard(id, err); }
    }
    const retry = $('[data-retry]', main); if (retry) retry.addEventListener('click', route);
    if (ok) {
      try { K.wireTabs(main); } catch (err) { console.error(err); }
      try { K.wireModals(main); } catch (err) { console.error(err); }
      try { if (typeof def.mount === 'function') def.mount(main); } catch (err) { console.error(err); }
    }

    const t = title(id);
    const h = $('#page-title'); if (h) h.textContent = t;
    const hp = $('#help-pop'); if (hp) hp.textContent = DESC[id] || `Details for this ${t.toLowerCase()}.`;
    document.title = `${t} · ${K.WORKSPACE}`;
    markActive(); updatePinBtn(); closeMenus(); closeDrawer();
    window.scrollTo(0, 0);
  }

  /* ---------- Boot ---------- */
  if (state.collapsed) app.classList.add('is-collapsed');
  applyTheme();
  renderTopbar();
  if (!location.hash) location.replace('#' + (state.view === 'client' ? 'portal-home' : 'home'));
  const first = currentId();
  state.view = isPortal(first) ? 'client' : 'team';
  renderSidebar();
  buildPalette();
  window.addEventListener('hashchange', route);
  route();
})();

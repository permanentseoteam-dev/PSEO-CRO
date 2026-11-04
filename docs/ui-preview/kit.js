/* Shared kit for the UI preview. Loaded first. Owned by the lead; builders read, never edit. */
(function () {
  const SCREENS = {};
  /** Register a screen.
   * id: hash route (letters, digits, hyphens). title: page title shown in top bar.
   * group: 'Core'|'Work'|'Clients'|'Finance'|'Team'|'Personal'|'Portal'|null (null = not in sidebar, e.g. detail pages)
   * render(): returns an HTML string for the main area.
   * mount(root): optional, wires clicks/tabs after render (root = the main element).
   */
  function screen(def) { SCREENS[def.id] = def; }

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const initials = n => n.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
  const HUES = [168, 200, 260, 20, 330, 45, 140, 290];
  const hue = n => HUES[[...n].reduce((a, c) => a + c.charCodeAt(0), 0) % HUES.length];
  /** avatar(name, size=28) -> round initials avatar */
  const avatar = (name, size = 28) => `<span class="avatar" style="--s:${size}px;--h:${hue(name)}" title="${esc(name)}">${esc(initials(name))}</span>`;
  /** Status as dot + text (never a pill). tone: muted|blue|violet|danger|ok|warn|accent */
  const STATUS = {
    todo: ['To do', 'muted'], in_progress: ['In progress', 'blue'], in_review: ['In review', 'violet'], blocked: ['Blocked', 'danger'], done: ['Done', 'ok'],
  };
  const status = (key, label, tone) => { const s = STATUS[key] || [label || key, tone || 'muted']; return `<span class="status t-${tone || s[1]}"><i></i>${esc(label || s[0])}</span>`; };
  const tone = (text, t) => `<span class="status t-${t}"><i></i>${esc(text)}</span>`;
  const PRI = { urgent: ['Urgent', 'danger'], high: ['High', 'warn'], normal: ['Normal', 'muted'], low: ['Low', 'muted'] };
  const priority = p => `<span class="pri t-${PRI[p][1]}">${PRI[p][0]}</span>`;
  const money = (n, cur = 'USD') => `${cur} ${Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  /** Wire simple tab sets: <div class="tabs" data-tabs="x"><button data-tab="a" class="on">..</button></div> + <section data-panel="x:a">..</section> */
  function wireTabs(root) {
    root.querySelectorAll('[data-tabs]').forEach(bar => {
      const set = bar.dataset.tabs;
      bar.addEventListener('click', e => {
        const b = e.target.closest('[data-tab]'); if (!b) return;
        bar.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('on', x === b));
        root.querySelectorAll(`[data-panel^="${set}:"]`).forEach(p => { p.hidden = p.dataset.panel !== `${set}:${b.dataset.tab}`; });
      });
    });
  }
  /** Wire modals: any [data-open="id"] opens <dialog id="id" class="modal">; [data-close] closes. */
  function wireModals(root) {
    root.addEventListener('click', e => {
      const o = e.target.closest('[data-open]');
      if (o) { const d = document.getElementById(o.dataset.open); if (d && d.showModal) d.showModal(); }
      const c = e.target.closest('[data-close]');
      if (c) { const d = c.closest('dialog'); if (d) d.close(); }
    });
    root.querySelectorAll('form').forEach(f => f.addEventListener('submit', e => { e.preventDefault(); const d = f.closest('dialog'); if (d) d.close(); toast('Saved (preview only)'); }));
  }
  function toast(msg) {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2200);
  }

  /* ---- Shared sample data (fictional). Use these names everywhere for consistency. ---- */
  const ME = { id: 'm1', name: 'Sara Malik', title: 'Head of Client Success', dept: 'Client Success' };
  const PEOPLE = [
    ME,
    { id: 'm2', name: 'Omar Haddad', title: 'SEO Lead', dept: 'SEO' },
    { id: 'm3', name: 'Ayesha Khan', title: 'PPC Specialist', dept: 'PPC' },
    { id: 'm4', name: 'Daniel Reyes', title: 'Web Developer', dept: 'Web' },
    { id: 'm5', name: 'Priya Nair', title: 'Content Writer', dept: 'Content' },
    { id: 'm6', name: 'Bilal Ahmed', title: 'Finance Manager', dept: 'Finance' },
    { id: 'm7', name: 'Lina Saeed', title: 'Designer', dept: 'Design' },
    { id: 'm8', name: 'Hamza Qureshi', title: 'Account Executive', dept: 'Client Success' },
    { id: 'm9', name: 'Zara Farooq', title: 'Social Media Manager', dept: 'Social' },
    { id: 'm10', name: 'Yusuf Ali', title: 'CEO', dept: 'Leadership' },
  ];
  const CLIENTS = [
    { id: 'c1', name: 'Cedar & Pine Dental', services: ['SEO', 'Content'], health: 82, band: 'Healthy', owner: 'Hamza Qureshi', currency: 'AED', fee: 9500 },
    { id: 'c2', name: 'Alba Motors', services: ['PPC', 'Social'], health: 61, band: 'Watch', owner: 'Sara Malik', currency: 'AED', fee: 14000 },
    { id: 'c3', name: 'Luma Skincare', services: ['SEO', 'PPC', 'Design'], health: 44, band: 'At risk', owner: 'Hamza Qureshi', currency: 'USD', fee: 4200 },
    { id: 'c4', name: 'Harbor Legal', services: ['Web', 'SEO'], health: 77, band: 'Healthy', owner: 'Sara Malik', currency: 'USD', fee: 3000 },
    { id: 'c5', name: 'Nova Fitness', services: ['Social', 'Content'], health: null, band: 'New', owner: 'Hamza Qureshi', currency: 'AED', fee: 6000 },
    { id: 'c6', name: 'Zest Kitchen', services: ['PPC'], health: 69, band: 'Watch', owner: 'Sara Malik', currency: 'PKR', fee: 450000 },
  ];
  const PROJECTS = [
    { key: 'CPD', name: 'Cedar & Pine SEO', client: 'Cedar & Pine Dental', lead: 'Omar Haddad', dept: 'SEO' },
    { key: 'ALB', name: 'Alba Motors Ads', client: 'Alba Motors', lead: 'Ayesha Khan', dept: 'PPC' },
    { key: 'LUM', name: 'Luma Growth', client: 'Luma Skincare', lead: 'Omar Haddad', dept: 'SEO' },
    { key: 'HBR', name: 'Harbor Website', client: 'Harbor Legal', lead: 'Daniel Reyes', dept: 'Web' },
    { key: 'NOV', name: 'Nova Social', client: 'Nova Fitness', lead: 'Zara Farooq', dept: 'Social' },
  ];
  const TODAY = '2026-11-04';

  window.K = { screen, SCREENS, esc, avatar, status, tone, priority, money, wireTabs, wireModals, toast, ME, PEOPLE, CLIENTS, PROJECTS, TODAY, WORKSPACE: 'Permanent SEO' };
})();

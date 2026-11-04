/* Client portal screens (Alba Motors view). Owner: Portal agent. */
(function () {
  const { screen, esc, avatar, tone, money, toast } = K;

  const CLIENT = 'Alba Motors';
  const USER = { name: 'Rami Khoury', role: 'Owner' };
  const TEAM = [
    { name: 'Sara Malik', role: 'Executive' },
    { name: 'Ayesha Khan', role: 'PPC Specialist' },
  ];
  const CUR = 'AED';

  const CSS = `<style>
  .scr-portal .greet h1{margin:0;font-size:24px;color:var(--ink)}
  .scr-portal .greet p{margin:4px 0 0;color:var(--ink-2)}
  .scr-portal .await{display:flex;align-items:center;gap:8px;padding:12px 16px;border:1px solid var(--line);border-radius:var(--radius);background:var(--accent-soft);color:var(--ink);text-decoration:none}
  .scr-portal .await b{color:var(--accent)}
  .scr-portal .await:hover{border-color:var(--accent)}
  .scr-portal .spark{display:block;width:100%;height:30px;margin-top:8px}
  .scr-portal .chg-up{color:var(--ok)}
  .scr-portal .chg-down{color:var(--danger)}
  .scr-portal .commit{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--line)}
  .scr-portal .commit:last-child{border-bottom:0}
  .scr-portal .when{font-size:20px;font-weight:600;color:var(--ink)}
  .scr-portal .approval{border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);padding:16px;display:flex;flex-direction:column;gap:12px}
  .scr-portal .approval.done{border-color:var(--ok);background:var(--ok-soft)}
  .scr-portal .approval.changes{border-color:var(--warn);background:var(--warn-soft)}
  .scr-portal .approval h3{margin:0;font-size:16px;color:var(--ink)}
  .scr-portal .approval p{margin:0;color:var(--ink-2)}
  .scr-portal .tiles{display:flex;flex-wrap:wrap;gap:8px}
  .scr-portal .ftile{width:132px;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface-2);overflow:hidden}
  .scr-portal .ftile .ph{height:72px;display:flex;align-items:center;justify-content:center;background:var(--accent-soft);color:var(--accent);font-weight:600}
  .scr-portal .ftile .nm{padding:6px 8px;font-size:12px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .scr-portal .ftile .ty{padding:0 8px 6px;font-size:12px;color:var(--ink-3)}
  .scr-portal .folder{cursor:pointer;text-align:left;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);padding:14px 16px;color:var(--ink);font:inherit}
  .scr-portal .folder:hover{border-color:var(--line-2)}
  .scr-portal .folder.on{border-color:var(--accent);background:var(--accent-soft)}
  .scr-portal .folder b{display:block;font-size:15px}
  .scr-portal .drop{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:28px 16px;border:2px dashed var(--line-2);border-radius:var(--radius);background:var(--surface-2);color:var(--ink-2);cursor:pointer;text-align:center}
  .scr-portal .drop.over{border-color:var(--accent);background:var(--accent-soft);color:var(--ink)}
  .scr-portal .drop input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}
  .scr-portal .swatches{display:flex;flex-wrap:wrap;gap:10px}
  .scr-portal .sw{display:flex;flex-direction:column;gap:4px;font-size:12px;color:var(--ink-2)}
  .scr-portal .sw i{display:block;width:56px;height:40px;border-radius:var(--radius);border:1px solid var(--line)}
  .scr-portal .dd{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .scr-portal .dd ul{margin:4px 0 0;padding-left:18px;color:var(--ink-2)}
  .scr-portal .chat{display:flex;flex-direction:column;height:min(640px,72vh)}
  .scr-portal .msgs{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;background:var(--surface-2)}
  .scr-portal .bub{max-width:min(78%,520px);padding:10px 12px;border-radius:var(--radius);background:var(--surface);border:1px solid var(--line);color:var(--ink)}
  .scr-portal .bub .meta{font-size:12px;color:var(--ink-3);margin-top:4px}
  .scr-portal .bwrap{display:flex;gap:8px;align-items:flex-end}
  .scr-portal .bwrap.mine{flex-direction:row-reverse}
  .scr-portal .bwrap.mine .bub{background:var(--accent-soft);border-color:var(--accent-soft)}
  .scr-portal .bwrap.mine .meta{text-align:right}
  .scr-portal .day{align-self:center;font-size:12px;color:var(--ink-3)}
  .scr-portal .typing{font-size:13px;color:var(--ink-3);font-style:italic;padding:0 4px}
  .scr-portal .composer{display:flex;gap:8px;padding:12px;border-top:1px solid var(--line);background:var(--surface)}
  .scr-portal .composer textarea{flex:1;resize:none;min-height:44px;max-height:120px}
  .scr-portal .inv-lines{width:100%;border-collapse:collapse}
  .scr-portal .inv-lines td{padding:8px 0;border-bottom:1px solid var(--line);color:var(--ink)}
  .scr-portal .inv-lines tr.tot td{border-bottom:0;font-weight:600}
  .scr-portal .howpay{border:1px solid var(--line);border-radius:var(--radius);background:var(--surface-2);padding:14px;display:flex;flex-direction:column;gap:8px}
  .scr-portal .howpay h4{margin:0;font-size:14px;color:var(--ink)}
  .scr-portal .kv{display:grid;grid-template-columns:120px 1fr;gap:4px 12px;font-size:13px}
  .scr-portal .kv span:nth-child(odd){color:var(--ink-3)}
  .scr-portal .notes{color:var(--ink-2);margin:0}
  .scr-portal .dec{margin:4px 0 0;padding-left:18px;color:var(--ink-2)}
  @media (max-width:600px){.scr-portal .dd{grid-template-columns:1fr}.scr-portal .kv{grid-template-columns:1fr}.scr-portal .ftile{width:calc(50% - 4px)}}
  </style>`;

  const page = (body) => `<div class="page scr-portal">${CSS}${body}</div>`;
  const header = (title, sub, actions = '') => `<div class="row between"><div><h1 style="margin:0;font-size:22px">${esc(title)}</h1>${sub ? `<p class="muted" style="margin:4px 0 0">${esc(sub)}</p>` : ''}</div>${actions ? `<div class="row">${actions}</div>` : ''}</div>`;

  /** Inline sparkline. points: numbers; toneVar: CSS variable name. */
  function spark(points, toneVar = '--accent') {
    const min = Math.min(...points), max = Math.max(...points), r = max - min || 1;
    const step = 100 / (points.length - 1);
    const pts = points.map((p, i) => `${(i * step).toFixed(1)},${(28 - ((p - min) / r) * 26).toFixed(1)}`).join(' ');
    return `<svg class="spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="var(${toneVar})" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>`;
  }

  /* ---------------- portal-home ---------------- */
  screen({
    id: 'portal-home', title: 'Home', group: 'Portal',
    render() {
      const stats = [
        { label: 'Leads', value: '184', chg: '+12%', good: true, pts: [5, 6, 5, 7, 8, 7, 9, 10, 9, 11, 12, 13] },
        { label: 'Cost per lead', value: money(76, CUR), chg: '-8%', good: true, pts: [88, 86, 87, 84, 83, 82, 80, 81, 79, 78, 77, 76] },
        { label: 'Spend', value: money(13980, CUR), chg: '+3%', good: true, pts: [420, 460, 480, 470, 500, 510, 490, 520, 515, 530, 540, 545] },
        { label: 'Clicks', value: '9,420', chg: '+6%', good: true, pts: [280, 300, 310, 290, 330, 340, 320, 350, 360, 345, 370, 380] },
      ];
      const commits = [
        ['Launch winter service campaign by 10 Nov', tone('On track', 'ok')],
        ['Monthly report by 5th', tone('Done', 'ok')],
        ['Reply within 2 working hours', tone('On track (97%)', 'ok')],
        ['Landing page refresh by 20 Nov', tone('At risk', 'danger')],
      ];
      const activity = [
        ['Ayesha Khan', 'sent "Winter service ad set" for your approval', '3 Nov, 16:20'],
        ['Sara Malik', 'shared the October 2026 report', '2 Nov, 10:05'],
        ['Rami Khoury', 'uploaded "Service menu Nov.pdf"', '1 Nov, 14:42'],
        ['Ayesha Khan', 'paused the low-performing "Used SUVs" ad group', '31 Oct, 12:10'],
        ['Sara Malik', 'added notes from the 30 Oct check-in', '30 Oct, 17:30'],
      ];
      return page(`
        <div class="greet"><h1>Good morning, Rami</h1><p>Here is how ${esc(CLIENT)} is doing this month.</p></div>
        <a class="await" href="#portal-work">Waiting for your approval <b>(2)</b><span class="muted" style="margin-left:auto">Review now</span></a>
        <div class="stats grid-4">
          ${stats.map(s => `<div class="stat"><div class="label">${esc(s.label)} · last 28 days</div><div class="value num">${s.value}</div><div class="sub"><span class="${s.good ? 'chg-up' : 'chg-down'}">${s.chg}</span> vs prior 28 days</div>${spark(s.pts)}</div>`).join('')}
        </div>
        <div class="grid-2">
          <div class="card"><div class="card-head"><h3>Our commitments to you</h3></div><div class="card-body">
            ${commits.map(c => `<div class="commit"><span>${esc(c[0])}</span>${c[1]}</div>`).join('')}
          </div></div>
          <div class="stack" style="gap:20px">
            <div class="card"><div class="card-head"><h3>Next meeting</h3></div><div class="card-body stack">
              <div class="when">Thu 6 Nov, 11:00</div>
              <div class="muted">Monthly review with Sara and Ayesha · Google Meet</div>
              <div class="row"><button class="btn primary" data-act="join">Join</button><a class="btn ghost" href="#portal-meetings">All meetings</a></div>
            </div></div>
            <div class="card"><div class="card-head"><h3>Latest report</h3></div><div class="card-body row between">
              <div><b>October 2026</b><div class="muted small">Leads up 12%, cost per lead down 8%</div></div>
              <button class="btn" data-act="report">View report</button>
            </div></div>
          </div>
        </div>
        <div class="grid-2">
          <div class="card"><div class="card-head"><h3>Recent activity</h3></div><div class="card-body"><div class="list">
            ${activity.map(a => `<div class="item row" style="flex-wrap:nowrap">${avatar(a[0], 28)}<div style="flex:1"><b>${esc(a[0])}</b> ${esc(a[1])}<div class="muted small">${esc(a[2])}</div></div></div>`).join('')}
          </div></div></div>
          <div class="card"><div class="card-head"><h3>Your team</h3></div><div class="card-body"><div class="list">
            ${TEAM.map(t => `<div class="item row between"><div class="row">${avatar(t.name, 36)}<div><b>${esc(t.name)}</b><div class="muted small">${esc(t.role)}</div></div></div><a class="btn sm" href="#portal-messages">Message</a></div>`).join('')}
          </div></div></div>
        </div>`);
    },
    mount(root) {
      root.querySelector('[data-act="join"]')?.addEventListener('click', () => toast('Opening Google Meet (preview)'));
      root.querySelector('[data-act="report"]')?.addEventListener('click', () => toast('Opening October 2026 report (preview)'));
    },
  });

  /* ---------------- portal-work ---------------- */
  const APPROVALS = [
    { id: 'ap1', title: 'Winter service ad set', who: 'Ayesha Khan', sent: 'Sent 3 Nov',
      text: 'Six Google and Meta ads for the winter service offer: free 25-point check with any oil change. Budget stays at AED 450 a day. Goes live 10 Nov once you approve.',
      files: [['Search ads copy', 'DOCX'], ['Meta carousel', 'PNG · 4 slides'], ['Story video', 'MP4 · 15s']] },
    { id: 'ap2', title: 'New landing page hero', who: 'Sara Malik', sent: 'Sent 3 Nov',
      text: 'New top section for the service booking page: a clearer headline, one Book a service button and the showroom photo you sent. The rest of the page stays the same.',
      files: [['Hero desktop', 'PNG'], ['Hero mobile', 'PNG']] },
  ];
  const INPROG = [
    ['Winter service campaign launch', ['In progress', 'blue'], '10 Nov', 'Ayesha Khan'],
    ['Landing page refresh', ['With you', 'warn'], '20 Nov', 'Sara Malik'],
    ['November social calendar', ['Ready soon', 'violet'], '7 Nov', 'Ayesha Khan'],
    ['Call tracking on showroom numbers', ['Planned', 'muted'], '18 Nov', 'Ayesha Khan'],
    ['Black Friday offer ads', ['Planned', 'muted'], '24 Nov', 'Ayesha Khan'],
  ];
  const DONE = [
    ['October 2026 report', '2 Nov'],
    ['Used SUVs ad group clean-up', '31 Oct'],
    ['Google Business profile photos', '27 Oct'],
    ['Test drive form tracking fix', '22 Oct'],
    ['September 2026 report', '3 Oct'],
  ];
  screen({
    id: 'portal-work', title: 'Work & approvals', group: 'Portal',
    render() {
      return page(`
        ${header('Work & approvals', 'Approve what we send and see what we are working on.', '<button class="btn primary" data-open="portal-work-request">Request new work</button>')}
        <div class="tabs" data-tabs="pw">
          <button data-tab="wait" class="on">Waiting for you (<span data-wait-count>2</span>)</button>
          <button data-tab="prog">In progress</button>
          <button data-tab="done">Done</button>
        </div>
        <section data-panel="pw:wait" class="stack" style="gap:16px">
          ${APPROVALS.map(a => `<div class="approval" data-approval="${a.id}">
            <div class="row between"><h3>${esc(a.title)}</h3><span data-state>${tone('Waiting for you', 'warn')}</span></div>
            <p>${esc(a.text)}</p>
            <div class="tiles">${a.files.map(f => `<div class="ftile"><div class="ph">${esc(f[1].split(' ')[0])}</div><div class="nm" title="${esc(f[0])}">${esc(f[0])}</div><div class="ty">${esc(f[1])}</div></div>`).join('')}</div>
            <div class="row between"><span class="muted small">${esc(a.sent)} by ${esc(a.who)}</span>
              <div class="row" data-actions><button class="btn primary" data-approve="${a.id}">Approve</button><button class="btn" data-changes="${a.id}">Ask for changes</button></div>
            </div>
          </div>`).join('')}
        </section>
        <section data-panel="pw:prog" hidden>
          <div class="card"><div class="table-wrap"><table class="tbl">
            <thead><tr><th>Request</th><th>Status</th><th>Due</th><th>Who</th></tr></thead>
            <tbody>${INPROG.map(r => `<tr><td>${esc(r[0])}</td><td>${tone(r[1][0], r[1][1])}</td><td class="num">${esc(r[2])}</td><td><span class="row" style="flex-wrap:nowrap">${avatar(r[3], 24)}<span class="hide-sm">${esc(r[3])}</span></span></td></tr>`).join('')}</tbody>
          </table></div></div>
        </section>
        <section data-panel="pw:done" hidden>
          <div class="card"><div class="table-wrap"><table class="tbl">
            <thead><tr><th>Request</th><th>Finished</th><th class="right"></th></tr></thead>
            <tbody>${DONE.map(r => `<tr><td>${esc(r[0])}</td><td class="num">${esc(r[1])}</td><td class="right"><button class="btn sm" data-view="${esc(r[0])}">View</button></td></tr>`).join('')}</tbody>
          </table></div></div>
        </section>

        <dialog id="portal-work-request" class="modal"><form>
          <div class="modal-head"><h3>Request new work</h3><button type="button" class="icon-btn" data-close aria-label="Close">×</button></div>
          <div class="modal-body"><div class="form-grid">
            <div class="field full"><label for="pwr-what">What you need</label><textarea id="pwr-what" rows="4" required placeholder="For example: ads for our Ramadan service offer"></textarea></div>
            <div class="field"><label for="pwr-when">By when</label><input id="pwr-when" type="date" value="2026-11-18"></div>
            <div class="field"><label for="pwr-files">Files</label><input id="pwr-files" type="file" multiple></div>
          </div><p class="muted small" style="margin:12px 0 0">Sending this starts our reply clock.</p></div>
          <div class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Send request</button></div>
        </form></dialog>

        <dialog id="portal-work-changes" class="modal"><form data-changes-form>
          <div class="modal-head"><h3>Ask for changes</h3><button type="button" class="icon-btn" data-close aria-label="Close">×</button></div>
          <div class="modal-body"><div class="form-grid">
            <div class="field full"><label for="pwc-why">What should we change?</label><textarea id="pwc-why" rows="4" required placeholder="For example: use the red car photo instead"></textarea></div>
          </div></div>
          <div class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Send changes</button></div>
        </form></dialog>`);
    },
    mount(root) {
      let target = null;
      const countEl = root.querySelector('[data-wait-count]');
      const settle = (id, label, t, cls) => {
        const card = root.querySelector(`[data-approval="${id}"]`); if (!card) return;
        card.classList.add(cls);
        card.querySelector('[data-state]').innerHTML = tone(label, t);
        card.querySelector('[data-actions]').innerHTML = `<span class="muted small">${label} just now by ${esc(USER.name)}</span>`;
        if (countEl) countEl.textContent = root.querySelectorAll('.approval:not(.done):not(.changes)').length;
      };
      root.addEventListener('click', e => {
        const a = e.target.closest('[data-approve]');
        if (a) { const t = APPROVALS.find(x => x.id === a.dataset.approve); settle(a.dataset.approve, 'Approved', 'ok', 'done'); toast(`Approved: ${t.title}`); }
        const c = e.target.closest('[data-changes]');
        if (c) { target = c.dataset.changes; const d = root.querySelector('#portal-work-changes'); d?.showModal?.(); }
        const v = e.target.closest('[data-view]');
        if (v) toast(`Opening ${v.dataset.view} (preview)`);
      });
      const f = root.querySelector('[data-changes-form]');
      f?.addEventListener('submit', () => { if (target) { settle(target, 'Changes asked', 'warn', 'changes'); toast('Change request sent'); } target = null; f.reset(); });
    },
  });

  /* ---------------- portal-meetings ---------------- */
  const PAST = [
    { title: 'October check-in', date: 'Thu 30 Oct, 11:00', who: ['Sara Malik', 'Ayesha Khan', 'Rami Khoury'],
      notes: 'Leads rose 12% in October. Cost per lead fell to AED 76 after we paused the Used SUVs ad group. Rami asked to push the winter service offer before the cold-weather rush.',
      decisions: ['Launch winter service campaign by 10 Nov', 'Keep daily budget at AED 450', 'Refresh the booking page hero'],
      todos: [['Send new showroom photos', true], ['Confirm winter offer terms with service team', false], ['Approve winter ad set', false]] },
    { title: 'September review', date: 'Wed 1 Oct, 14:00', who: ['Sara Malik', 'Ayesha Khan', 'Rami Khoury'],
      notes: 'Test drive form tracking was missing some mobile bookings. We agreed to fix tracking first and then judge results on clean numbers.',
      decisions: ['Fix test drive form tracking', 'Add call tracking to showroom numbers in November'],
      todos: [['Share Google Business access with Ayesha', true], ['Send service menu for November', true]] },
  ];
  screen({
    id: 'portal-meetings', title: 'Meetings', group: 'Portal',
    render() {
      const up = [
        ['Monthly review', 'Thu 6 Nov, 11:00 · 45 min', 'Sara Malik, Ayesha Khan'],
        ['Winter campaign launch call', 'Mon 10 Nov, 10:00 · 20 min', 'Ayesha Khan'],
      ];
      return page(`
        ${header('Meetings', 'Upcoming calls and what we agreed in past ones.', '<button class="btn primary" data-open="portal-meetings-book">Book a meeting</button>')}
        <div class="card"><div class="card-head"><h3>Upcoming</h3></div><div class="card-body"><div class="list">
          ${up.map(u => `<div class="item row between"><div><b>${esc(u[0])}</b><div class="muted small">${esc(u[1])} · with ${esc(u[2])}</div></div><button class="btn primary sm" data-join>Join</button></div>`).join('')}
        </div></div></div>
        <h2 style="margin:0;font-size:18px">Past meetings</h2>
        <div class="grid-2">
          ${PAST.map((m, mi) => `<div class="card"><div class="card-head"><h3>${esc(m.title)}</h3><span class="muted small">${esc(m.date)}</span></div><div class="card-body stack" style="gap:12px">
            <div class="avatars">${m.who.map(w => avatar(w, 26)).join('')}</div>
            <p class="notes">${esc(m.notes)}</p>
            <div><b>Decisions</b><ul class="dec">${m.decisions.map(d => `<li>${esc(d)}</li>`).join('')}</ul></div>
            <div class="stack"><b>Your to-dos</b>${m.todos.map((t, ti) => `<label class="check"><input type="checkbox" data-todo="${esc(t[0])}" ${t[1] ? 'checked' : ''} id="pm-todo-${mi}-${ti}"> ${esc(t[0])}</label>`).join('')}</div>
          </div></div>`).join('')}
        </div>

        <dialog id="portal-meetings-book" class="modal"><form>
          <div class="modal-head"><h3>Book a meeting</h3><button type="button" class="icon-btn" data-close aria-label="Close">×</button></div>
          <div class="modal-body"><div class="form-grid">
            <div class="field full"><label for="pmb-topic">Topic</label><input id="pmb-topic" required placeholder="For example: Black Friday plans"></div>
            <div class="field"><label for="pmb-day">Preferred day</label><input id="pmb-day" type="date" value="2026-11-12"></div>
            <div class="field"><label for="pmb-time">Time</label><select id="pmb-time"><option>10:00</option><option selected>11:00</option><option>14:00</option><option>16:00</option></select></div>
            <div class="field full"><label>Attendees</label>
              ${TEAM.map(t => `<label class="check"><input type="checkbox" checked> ${esc(t.name)}</label>`).join('')}
              <label class="check"><input type="checkbox"> Nadia Haddad (Alba Motors marketing)</label>
            </div>
            <div class="field full"><label for="pmb-note">Note</label><textarea id="pmb-note" rows="3" placeholder="Anything we should prepare"></textarea></div>
          </div></div>
          <div class="modal-foot"><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn primary">Send booking request</button></div>
        </form></dialog>`);
    },
    mount(root) {
      root.addEventListener('click', e => { if (e.target.closest('[data-join]')) toast('Opening Google Meet (preview)'); });
      root.querySelectorAll('[data-todo]').forEach(cb => cb.addEventListener('change', () => toast(cb.checked ? `Marked done: ${cb.dataset.todo}` : `Marked not done: ${cb.dataset.todo}`)));
    },
  });

  /* ---------------- portal-files ---------------- */
  const FOLDERS = [['brand', 'Brand assets'], ['you', 'From you'], ['reports', 'Reports']];
  const FILES = [
    ['Alba logo primary.svg', 'brand', 'Sara Malik', '12 Aug', '48 KB'],
    ['Alba logo white.svg', 'brand', 'Sara Malik', '12 Aug', '46 KB'],
    ['Brand guidelines 2026.pdf', 'brand', 'Sara Malik', '12 Aug', '6.2 MB'],
    ['Showroom photo set.zip', 'brand', 'Ayesha Khan', '20 Sep', '84 MB'],
    ['Service icons.zip', 'brand', 'Ayesha Khan', '2 Oct', '1.1 MB'],
    ['Service menu Nov.pdf', 'you', 'Rami Khoury', '1 Nov', '420 KB'],
    ['New showroom photos.zip', 'you', 'Rami Khoury', '29 Oct', '58 MB'],
    ['Winter offer terms.docx', 'you', 'Nadia Haddad', '28 Oct', '36 KB'],
    ['Price list Q4.xlsx', 'you', 'Rami Khoury', '14 Oct', '92 KB'],
    ['October 2026 report.pdf', 'reports', 'Sara Malik', '2 Nov', '2.4 MB'],
    ['September 2026 report.pdf', 'reports', 'Sara Malik', '3 Oct', '2.1 MB'],
    ['Q3 2026 review.pdf', 'reports', 'Sara Malik', '6 Oct', '3.8 MB'],
    ['August 2026 report.pdf', 'reports', 'Sara Malik', '3 Sep', '2.0 MB'],
  ];
  const fname = k => FOLDERS.find(f => f[0] === k)[1];
  const fileRow = f => `<tr data-folder="${f[1]}"><td>${esc(f[0])}</td><td>${esc(fname(f[1]))}</td><td><span class="row" style="flex-wrap:nowrap">${avatar(f[2], 22)}<span class="hide-sm">${esc(f[2])}</span></span></td><td class="num">${esc(f[3])}</td><td class="num">${esc(f[4])}</td><td class="right"><button class="btn sm" data-dl="${esc(f[0])}">Download</button></td></tr>`;
  screen({
    id: 'portal-files', title: 'Files', group: 'Portal',
    render() {
      const counts = { brand: 14, you: 6, reports: 10 };
      const brand = [['#B3121B', 'Alba red'], ['#1C1F24', 'Graphite'], ['#F4F1EC', 'Ivory'], ['#8A9099', 'Steel'], ['#D9A441', 'Gold accent']];
      return page(`
        ${header('Files', 'Everything we share, in one place.')}
        <div class="grid-3" data-folders>
          ${FOLDERS.map(f => `<button class="folder" data-f="${f[0]}"><b>${esc(f[1])}</b><span class="muted small"><span data-count="${f[0]}">${counts[f[0]]}</span> files</span></button>`).join('')}
        </div>
        <div class="card"><div class="card-head"><h3 data-ftitle>All files</h3><button class="btn ghost sm" data-f="all">Show all</button></div>
          <div class="table-wrap"><table class="tbl">
            <thead><tr><th>Name</th><th>Folder</th><th>Added by</th><th>Date</th><th>Size</th><th class="right">Download</th></tr></thead>
            <tbody data-files>${FILES.map(fileRow).join('')}</tbody>
          </table></div>
        </div>
        <label class="drop" data-drop>
          <input type="file" multiple data-upload>
          <b>Drop files here or click to choose</b>
          <span class="small">Files you upload go to From you</span>
        </label>
        <div class="card"><div class="card-head"><h3>Brand kit</h3><span class="muted small">Read only</span></div><div class="card-body stack" style="gap:16px">
          <div><b>Colours</b><div class="swatches" style="margin-top:8px">${brand.map(b => `<div class="sw"><i style="background:${b[0]}"></i><span>${esc(b[1])}</span><span class="num">${b[0]}</span></div>`).join('')}</div></div>
          <div class="grid-2">
            <div><b>Fonts</b><div class="muted">Headings: Montserrat Bold. Body: Inter Regular.</div></div>
            <div><b>Tone</b><div class="muted">Confident, friendly, clear. Talk like a trusted service adviser.</div></div>
          </div>
          <div class="dd">
            <div><b>Do</b><ul><li>Show real cars from the showroom</li><li>Lead with the offer and the price</li><li>Use the red logo on light backgrounds</li></ul></div>
            <div><b>Don't</b><ul><li>Use stock photos of other brands</li><li>Stretch or recolour the logo</li><li>Promise delivery dates in ads</li></ul></div>
          </div>
        </div></div>`);
    },
    mount(root) {
      const body = root.querySelector('[data-files]');
      const title = root.querySelector('[data-ftitle]');
      const filter = key => {
        root.querySelectorAll('.folder').forEach(b => b.classList.toggle('on', b.dataset.f === key));
        body.querySelectorAll('tr').forEach(tr => { tr.hidden = key !== 'all' && tr.dataset.folder !== key; });
        title.textContent = key === 'all' ? 'All files' : fname(key);
      };
      root.addEventListener('click', e => {
        const f = e.target.closest('[data-f]'); if (f) filter(f.dataset.f);
        const d = e.target.closest('[data-dl]'); if (d) toast(`Downloading ${d.dataset.dl} (preview)`);
      });
      const drop = root.querySelector('[data-drop]');
      const input = root.querySelector('[data-upload]');
      const size = b => b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`;
      const add = list => {
        const files = [...(list || [])]; if (!files.length) return;
        files.forEach(f => body.insertAdjacentHTML('afterbegin', fileRow([f.name, 'you', USER.name, '4 Nov', size(f.size)])));
        const c = root.querySelector('[data-count="you"]'); c.textContent = Number(c.textContent) + files.length;
        filter('you');
        toast(`${files.length} file${files.length > 1 ? 's' : ''} added to From you`);
      };
      ['dragenter', 'dragover'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('over'); }));
      ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('over'); }));
      drop.addEventListener('drop', e => add(e.dataTransfer && e.dataTransfer.files));
      input.addEventListener('change', () => { add(input.files); input.value = ''; });
    },
  });

  /* ---------------- portal-invoices ---------------- */
  const INVOICES = [
    { no: 'PS-2026-118', issued: '1 Nov', due: '15 Nov', total: 14000, bal: 14000, st: ['Open', 'blue'] },
    { no: 'PS-2026-104', issued: '1 Oct', due: '15 Oct', total: 14000, bal: 4200, st: ['Overdue', 'danger'] },
    { no: 'PS-2026-091', issued: '1 Sep', due: '15 Sep', total: 14000, bal: 0, st: ['Paid', 'ok'] },
    { no: 'PS-2026-077', issued: '1 Aug', due: '15 Aug', total: 14000, bal: 0, st: ['Paid', 'ok'] },
    { no: 'PS-2026-063', issued: '1 Jul', due: '15 Jul', total: 14000, bal: 0, st: ['Paid', 'ok'] },
    { no: 'PS-2026-058', issued: '20 Jun', due: '4 Jul', total: 3500, bal: 0, st: ['Paid', 'ok'] },
  ];
  screen({
    id: 'portal-invoices', title: 'Invoices', group: 'Portal',
    render() {
      const receipts = [
        ['Receipt for PS-2026-104 (part)', '18 Oct', 9800],
        ['Receipt for PS-2026-091', '12 Sep', 14000],
        ['Receipt for PS-2026-077', '14 Aug', 14000],
        ['Receipt for PS-2026-063', '10 Jul', 14000],
      ];
      return page(`
        ${header('Invoices', 'Visible to owners only.')}
        <div class="stats grid-3">
          <div class="stat"><div class="label">Open balance</div><div class="value num">${money(18200, CUR)}</div><div class="sub">2 invoices</div></div>
          <div class="stat"><div class="label">Overdue</div><div class="value num t-danger">${money(4200, CUR)}</div><div class="sub">PS-2026-104, due 15 Oct</div></div>
          <div class="stat"><div class="label">Paid this year</div><div class="value num">${money(140000, CUR)}</div><div class="sub">Since 1 Jan 2026</div></div>
        </div>
        <div class="card"><div class="card-head"><h3>All invoices</h3></div><div class="table-wrap"><table class="tbl">
          <thead><tr><th>Number</th><th>Issued</th><th>Due</th><th class="right">Total</th><th class="right">Balance</th><th>Status</th><th class="right"></th></tr></thead>
          <tbody>${INVOICES.map(i => `<tr><td class="num">${esc(i.no)}</td><td class="num">${esc(i.issued)}</td><td class="num">${esc(i.due)}</td><td class="num right">${money(i.total, CUR)}</td><td class="num right">${money(i.bal, CUR)}</td><td>${tone(i.st[0], i.st[1])}</td>
            <td class="right"><div class="row" style="justify-content:flex-end;flex-wrap:nowrap"><button class="btn sm" data-open="portal-invoices-view" data-inv="${esc(i.no)}" data-issued="${esc(i.issued)}" data-due="${esc(i.due)}" data-total="${i.total}" data-bal="${i.bal}">View</button><button class="btn ghost sm" data-pdf="${esc(i.no)}">Download PDF</button></div></td></tr>`).join('')}</tbody>
        </table></div></div>
        <div class="card"><div class="card-head"><h3>Receipts</h3></div><div class="card-body"><div class="list">
          ${receipts.map(r => `<div class="item row between"><div><b>${esc(r[0])}</b><div class="muted small">Paid ${esc(r[1])} · ${money(r[2], CUR)}</div></div><button class="btn sm" data-pdf="${esc(r[0])}">Download</button></div>`).join('')}
        </div></div></div>

        <dialog id="portal-invoices-view" class="modal">
          <div class="modal-head"><h3>Invoice <span data-v="no">PS-2026-118</span></h3><button type="button" class="icon-btn" data-close aria-label="Close">×</button></div>
          <div class="modal-body stack" style="gap:16px">
            <div class="row between small"><span><b>Permanent SEO</b> to <b>${esc(CLIENT)}</b></span><span class="muted">Issued <span data-v="issued">1 Nov</span> · Due <span data-v="due">15 Nov</span></span></div>
            <table class="inv-lines"><tbody>
              <tr><td>PPC management, monthly retainer</td><td class="num right" data-v="l1">${money(9500, CUR)}</td></tr>
              <tr><td>Social media management, monthly</td><td class="num right" data-v="l2">${money(4500, CUR)}</td></tr>
              <tr><td class="muted">Subtotal</td><td class="num right" data-v="sub">${money(14000, CUR)}</td></tr>
              <tr><td class="muted">VAT included (5%)</td><td class="num right" data-v="vat">${money(667, CUR)}</td></tr>
              <tr class="tot"><td>Balance due</td><td class="num right" data-v="bal">${money(14000, CUR)}</td></tr>
            </tbody></table>
            <div class="howpay">
              <h4>How to pay</h4>
              <div class="kv"><span>Bank</span><span>Emirates NBD</span><span>Account name</span><span>Permanent SEO FZ-LLC</span><span>IBAN</span><span class="num">AE07 0260 0010 1523 4567 801</span><span>Reference</span><span data-v="ref">PS-2026-118</span><span>Wise</span><span>pay@permanentseo.ae (AED, USD)</span></div>
              <div><a href="#portal-invoices" class="btn primary" data-pay>Pay <span data-v="pay">${money(14000, CUR)}</span></a></div>
            </div>
          </div>
          <div class="modal-foot"><button type="button" class="btn ghost" data-close>Close</button><button class="btn" data-pdf-modal>Download PDF</button></div>
        </dialog>`);
    },
    mount(root) {
      const dlg = root.querySelector('#portal-invoices-view');
      const set = (k, v) => dlg.querySelectorAll(`[data-v="${k}"]`).forEach(n => { n.textContent = v; });
      let current = 'PS-2026-118';
      root.addEventListener('click', e => {
        const v = e.target.closest('[data-inv]');
        if (v) {
          const total = Number(v.dataset.total), bal = Number(v.dataset.bal);
          current = v.dataset.inv;
          const l1 = total >= 14000 ? 9500 : total, l2 = total - l1;
          set('no', current); set('ref', current); set('issued', v.dataset.issued); set('due', v.dataset.due);
          set('l1', money(l1, CUR)); set('l2', money(l2, CUR)); set('sub', money(total, CUR));
          set('vat', money(Math.round(total * 5 / 105), CUR)); set('bal', money(bal, CUR)); set('pay', money(bal, CUR));
          const pay = dlg.querySelector('[data-pay]'); if (pay) pay.hidden = bal === 0;
        }
        const p = e.target.closest('[data-pdf]'); if (p) toast(`Downloading ${p.dataset.pdf} PDF (preview)`);
        if (e.target.closest('[data-pdf-modal]')) toast(`Downloading ${current} PDF (preview)`);
        const pay = e.target.closest('[data-pay]'); if (pay) { e.preventDefault(); toast('Opening secure payment page (preview)'); }
      });
    },
  });

  /* ---------------- portal-messages ---------------- */
  const SEED = [
    { day: 'Mon 3 Nov' },
    { from: 'Ayesha Khan', t: '16:20', text: 'Hi Rami, the winter service ad set is ready for you in Work & approvals. Six ads, same daily budget.' },
    { from: 'Rami Khoury', t: '16:48', text: 'Thanks. Can we show the free 25-point check more clearly on the carousel?' },
    { from: 'Ayesha Khan', t: '17:05', text: 'Yes, we can move it to the first slide. Approve the rest and ask for changes on that one, and I will update it tomorrow morning.' },
    { day: 'Today' },
    { from: 'Sara Malik', t: '09:12', text: 'Good morning! Quick reminder: our monthly review is Thursday at 11:00. I will send the agenda today.' },
    { from: 'Rami Khoury', t: '09:30', text: 'Great. Nadia from marketing will join too.' },
    { from: 'Sara Malik', t: '09:41', text: 'Perfect, I have added her. One question: are the new showroom photos the final set?' },
    { from: 'Rami Khoury', t: '09:55', text: 'Yes, those are final. Use the red SUV for the landing page.' },
    { from: 'Sara Malik', t: '10:02', text: 'Noted. The new hero with the red SUV is waiting for your approval now.' },
  ];
  const REPLIES = [
    'Thanks Rami, got it. I will update you by end of day.',
    'Good question. Let me check with Ayesha and come back to you within the hour.',
    'Done. You will see it in Work & approvals shortly.',
    'Noted. I have added this to Thursday\'s agenda.',
  ];
  const bubble = (m) => {
    const mine = m.from === USER.name;
    return `<div class="bwrap${mine ? ' mine' : ''}">${mine ? '' : avatar(m.from, 28)}<div class="bub">${mine ? '' : `<b class="small">${esc(m.from)}</b><br>`}${esc(m.text)}<div class="meta">${esc(m.t)}${mine ? ' · Sent ✓' : ''}</div></div></div>`;
  };
  screen({
    id: 'portal-messages', title: 'Messages', group: 'Portal',
    render() {
      return page(`
        <div class="card chat">
          <div class="card-head"><div class="row" style="flex-wrap:nowrap"><div class="avatars">${TEAM.map(t => avatar(t.name, 30)).join('')}</div><div><h3 style="margin:0">Permanent SEO team</h3><div class="muted small">Typical reply time: 2 working hours</div></div></div></div>
          <div class="msgs" data-msgs>${SEED.map(m => m.day ? `<div class="day">${esc(m.day)}</div>` : bubble(m)).join('')}</div>
          <form class="composer" data-composer>
            <label for="pmsg-text" class="sr-only" style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)">Message</label>
            <textarea id="pmsg-text" rows="1" placeholder="Write a message to your team"></textarea>
            <button class="btn primary" type="submit">Send</button>
          </form>
        </div>`);
    },
    mount(root) {
      const list = root.querySelector('[data-msgs]');
      const form = root.querySelector('[data-composer]');
      const ta = form.querySelector('textarea');
      let n = 0;
      const toBottom = () => { list.scrollTop = list.scrollHeight; };
      toBottom();
      const now = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
      const send = () => {
        const text = ta.value.trim(); if (!text) return;
        list.insertAdjacentHTML('beforeend', bubble({ from: USER.name, t: now(), text }));
        ta.value = ''; toBottom();
        const reply = REPLIES[n++ % REPLIES.length];
        setTimeout(() => {
          if (!root.isConnected || !list.isConnected) return;
          list.insertAdjacentHTML('beforeend', '<div class="typing" data-typing>Sara is typing…</div>'); toBottom();
          setTimeout(() => {
            if (!root.isConnected || !list.isConnected) return;
            list.querySelector('[data-typing]')?.remove();
            list.insertAdjacentHTML('beforeend', bubble({ from: 'Sara Malik', t: now(), text: reply })); toBottom();
          }, 1800);
        }, 1200);
      };
      // Capture phase so the shell's generic form toast doesn't fire.
      form.addEventListener('submit', e => { e.preventDefault(); e.stopImmediatePropagation(); send(); }, true);
      ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
    },
  });
})();

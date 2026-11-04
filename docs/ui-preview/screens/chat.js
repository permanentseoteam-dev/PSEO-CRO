/* Chat screen: 3-pane team + client chat with simulated live messages. Owner: Chat agent. */
(function () {
  const { screen, esc, avatar, tone, status, PEOPLE, PROJECTS, ME, TODAY } = K;

  /* ---------- Icons ---------- */
  const P = {
    hash: 'M4 9h16M4 15h16M10 3 8 21M16 3l-2 18',
    lock: 'M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4',
    bellOff: 'M13.7 21a2 2 0 0 1-3.4 0M18.6 13A17 17 0 0 1 18 8M6.3 6.3A6 6 0 0 0 6 8c0 7-3 9-3 9h14M18 8a6 6 0 0 0-9.3-5M2 2l20 20',
    pin: 'M12 17v5M9 3h6l-1 6 4 4H6l4-4z',
    file: 'M14 3H6v18h12V7zM14 3v4h4',
    search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-5-5',
    gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
    thread: 'M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z',
    more: 'M5 12h.01M12 12h.01M19 12h.01',
    back: 'M15 18l-6-6 6-6',
    close: 'M18 6 6 18M6 6l12 12',
    clip: 'M21 11l-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7',
    mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM19 11a7 7 0 0 1-14 0M12 18v3',
    clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
    check: 'M5 12l5 5 9-10',
    check2: 'M2 12l5 5 9-10M12 16l1 1 9-10',
    image: 'M4 4h16v16H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01',
    phone: 'M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z',
    cal: 'M4 5h16v16H4zM4 10h16M8 3v4M16 3v4',
    plus: 'M12 5v14M5 12h14',
    play: 'M7 4l13 8-13 8z',
    pause: 'M7 4h3v16H7zM14 4h3v16h-3z',
    edit: 'M4 20h4L19 9l-4-4L4 16z',
    fwd: 'M15 5l6 6-6 6M21 11H9a6 6 0 0 0-6 6v2',
    users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  };
  const ic = (n, s = 16) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${n === 'more' ? 3 : 2}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${P[n]}"/></svg>`;

  /* ---------- People ---------- */
  const SARA = ME.name, OMAR = 'Omar Haddad', AYESHA = 'Ayesha Khan', DANIEL = 'Daniel Reyes', PRIYA = 'Priya Nair', BILAL = 'Bilal Ahmed',
    LINA = 'Lina Saeed', HAMZA = 'Hamza Qureshi', ZARA = 'Zara Farooq', YUSUF = 'Yusuf Ali';
  const RANIA = 'Rania Aziz', JENNA = 'Jenna Cole', FARIS = 'Dr. Faris Nabil';
  const CONTACTS = { [RANIA]: 'Alba Motors', [JENNA]: 'Luma Skincare', [FARIS]: 'Cedar & Pine Dental' };
  const PRESENCE = { [OMAR]: 'on', [AYESHA]: 'away', [DANIEL]: 'off', [PRIYA]: 'on', [LINA]: 'off', [ZARA]: 'on', [HAMZA]: 'on', [BILAL]: 'away', [YUSUF]: 'off', [SARA]: 'on' };
  const PRES_LABEL = { on: 'Online', away: 'Away', off: 'Offline' };
  const ALL = PEOPLE.map(p => p.name);
  const NAMES = [...ALL, ...Object.keys(CONTACTS)];
  const MENTION_RE = new RegExp('@(' + NAMES.map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'g');
  const titleOf = n => (PEOPLE.find(p => p.name === n) || {}).title || (CONTACTS[n] ? CONTACTS[n] + ' (client)' : '');

  /* ---------- Channels ---------- */
  const CHANNELS = [
    { id: 'general', name: 'general', kind: 'channel', topic: 'Agency-wide updates and questions', members: ALL, unread: 0 },
    { id: 'seo-team', name: 'seo-team', kind: 'channel', topic: 'SEO delivery, audits and rankings', members: [OMAR, PRIYA, SARA, YUSUF, LINA, DANIEL], unread: 3, mention: true },
    { id: 'ppc-team', name: 'ppc-team', kind: 'channel', topic: 'Paid search and paid social', members: [AYESHA, SARA, HAMZA, BILAL, ZARA], unread: 2 },
    { id: 'announcements', name: 'announcements', kind: 'channel', topic: 'Company news. Only admins can post.', members: ALL, unread: 1, notify: 'mentions', adminsOnly: true },
    { id: 'alba-motors', name: 'alba-motors', kind: 'client', client: 'Alba Motors', topic: 'Shared with Alba Motors. November showroom offer.', members: [RANIA, SARA, AYESHA, ZARA, HAMZA, BILAL, 'Karim Aziz'], unread: 4, mention: true },
    { id: 'luma-skincare', name: 'luma-skincare', kind: 'client', client: 'Luma Skincare', topic: 'Shared with Luma Skincare. Launch on 20 Nov.', members: [JENNA, SARA, OMAR, HAMZA, LINA], unread: 1, mention: true },
    { id: 'cedar-pine', name: 'cedar-pine', kind: 'client', client: 'Cedar & Pine Dental', topic: 'Shared with Cedar & Pine Dental. Monthly SEO.', members: [FARIS, SARA, OMAR, PRIYA, HAMZA], unread: 2, notify: 'mute', private: true },
    { id: 'dm-omar', name: OMAR, kind: 'dm', members: [SARA, OMAR], unread: 1 },
    { id: 'dm-ayesha', name: AYESHA, kind: 'dm', members: [SARA, AYESHA], unread: 0 },
    { id: 'dm-daniel', name: DANIEL, kind: 'dm', members: [SARA, DANIEL], unread: 0 },
    { id: 'grp-plz', name: 'Priya, Lina, Zara', kind: 'group', members: [SARA, PRIYA, LINA, ZARA], unread: 0 },
  ];
  CHANNELS.forEach(c => { c.notify = c.notify || 'all'; c.mention = !!c.mention; c.newFrom = null; });
  const CH = id => CHANNELS.find(c => c.id === id);
  const other = c => c.members.find(n => n !== SARA);
  const chLabel = c => (c.kind === 'channel' || c.kind === 'client') ? '#' + c.name : c.name;
  const isDirect = c => c.kind === 'dm' || c.kind === 'group';

  /* ---------- Messages ---------- */
  let seq = 0;
  const mk = (by, at, text, x = {}) => ({ id: 'cm' + (++seq), by, at, text, rx: {}, replies: [], ...x });
  const Y = '2026-11-03 ', T = TODAY + ' ';
  const MSGS = {
    'alba-motors': [
      mk(RANIA, Y + '16:05', 'Hi team, the November showroom offer goes live on the 10th. Can we get the ads ready by Friday?'),
      mk(AYESHA, Y + '16:20', "Yes. I'll build the Search and Performance Max campaigns tomorrow and share the copy for sign-off.", { rx: { '👍': [RANIA, SARA] } }),
      mk(AYESHA, Y + '16:22', 'Budget split will be 60% Search and 40% PMax, unless you want to push the SUV range harder.'),
      mk(ZARA, Y + '17:10', 'First drafts of the social creatives for the offer.', { att: { type: 'image', name: 'alba-nov-offer-feed.png', meta: '1080 × 1080 · 640 KB' }, rx: { '🔥': [RANIA] } }),
      mk(AYESHA, T + '09:14', 'Draft ad copy is ready for review.', {
        att: { type: 'file', name: 'Alba-Nov-Offer-Ad-Copy.pdf', meta: 'PDF · 312 KB' }, pinned: true,
        replies: [
          mk(RANIA, T + '09:22', "Headline 3 says 'zero down'. Legal wants '0% down payment'."),
          mk(AYESHA, T + '09:26', 'Fixed. Updated PDF in 5 minutes.', { rx: { '👍': [RANIA] } }),
          mk(SARA, T + '09:31', 'Thanks both. Ayesha, please re-share here once fixed.'),
        ],
      }),
      mk(RANIA, T + '09:40', '@Sara Malik can we also add the Hatta test-drive event to the same campaign?'),
      mk(HAMZA, T + '09:52', 'Forwarding for context.', { fwd: { by: BILAL, ch: '#ppc-team', text: 'Alba Motors November media budget approved: AED 38,000.' } }),
      mk(ZARA, T + '10:31', 'Updated the story frames with the new price.', { edited: true, rx: { '🔥': [AYESHA] } }),
      mk(RANIA, T + '10:38', '', { att: { type: 'voice', name: 'Voice note', meta: '0:42' } }),
    ],
    general: [
      mk(YUSUF, Y + '15:00', 'Reminder: quarterly reviews start next week. Your slots are in Meetings.', { rx: { '✅': [OMAR, AYESHA, PRIYA, HAMZA] } }),
      mk(BILAL, T + '08:45', 'October invoices go out today. Flag any extra hours before 2pm.'),
      mk(LINA, T + '08:47', 'Brand kit for Nova Fitness is uploaded to Files.'),
      mk(DANIEL, T + '09:05', 'Staging restarts at 6pm for about 10 minutes.'),
    ],
    'seo-team': [
      mk(OMAR, Y + '11:20', "Luma lost 4 positions on 'vitamin c serum uae'. Checking last week's canonical change."),
      mk(PRIYA, Y + '11:45', 'Two blog posts for Cedar & Pine are ready for edit.'),
      mk(OMAR, T + '10:02', 'Found it. The canonical on the product listing points to page 2. Daniel is fixing it.'),
      mk(OMAR, T + '10:03', '@Sara Malik can you tell Jenna before the Thursday call?'),
      mk(PRIYA, T + '10:20', 'Keyword map for Harbor Legal.', { att: { type: 'file', name: 'harbor-keyword-map.xlsx', meta: 'Excel · 88 KB' } }),
    ],
    'ppc-team': [
      mk(AYESHA, Y + '14:00', 'Zest Kitchen CPA is down to PKR 610 this week.', { rx: { '🎉': [HAMZA, SARA] } }),
      mk(BILAL, T + '09:30', 'Alba Motors November media budget approved: AED 38,000.', { pinned: true }),
      mk(HAMZA, T + '10:15', "Can someone pull last month's Alba search terms for the QBR deck?"),
    ],
    announcements: [
      mk(YUSUF, T + '08:30', 'We hit 98% on-time delivery in October. Thank you, everyone.', { pinned: true, rx: { '🎉': [OMAR, AYESHA, PRIYA, LINA, ZARA, HAMZA] } }),
    ],
    'luma-skincare': [
      mk(JENNA, Y + '17:40', 'Our product launch moved to the 20th. Does that change the content calendar?'),
      mk(HAMZA, Y + '17:55', "Slightly. I'll send a revised calendar tomorrow."),
      mk(JENNA, T + '10:12', '@Sara Malik we are also seeing a drop in organic traffic on the serum page. Anything we should know?'),
    ],
    'cedar-pine': [
      mk(FARIS, Y + '12:00', 'The new implant service page looks great.'),
      mk(PRIYA, T + '09:10', 'Thanks, Dr. Faris. Two more posts go live this week.'),
      mk(OMAR, T + '09:12', 'October rankings report is in Files.', { att: { type: 'file', name: 'CPD-Oct-Rankings.pdf', meta: 'PDF · 1.2 MB' } }),
    ],
    'dm-omar': [
      mk(SARA, Y + '18:02', 'Can you join the Luma call on Thursday?', { seen: true }),
      mk(OMAR, T + '10:44', "Yes, 3pm works. I'll bring the canonical fix timeline."),
    ],
    'dm-ayesha': [
      mk(SARA, T + '08:50', 'Great work on the Zest numbers.', { seen: true }),
      mk(AYESHA, T + '08:58', 'Thanks! Using the same structure for Alba.'),
    ],
    'dm-daniel': [
      mk(DANIEL, T + '09:20', 'Canonical fix is on staging.'),
      mk(SARA, T + '09:25', 'Thanks. Ship it once Omar confirms.', { seen: true }),
      mk(SARA, T + '09:26', "Also, Harbor's contact form is sending duplicate emails."),
    ],
    'grp-plz': [
      mk(LINA, T + '10:00', "Moodboard for Nova's January campaign.", { att: { type: 'image', name: 'nova-jan-moodboard.png', meta: '1600 × 1200 · 1.1 MB' } }),
      mk(ZARA, T + '10:05', 'Love the second row.', { rx: { '❤️': [PRIYA] } }),
      mk(PRIYA, T + '10:08', "I'll write captions to match."),
    ],
  };
  const DRAFTS = { 'luma-skincare': 'Hi Jenna, quick update on the serum page: ' };
  const BROWSE = [
    { name: 'random', topic: 'Off-topic chat and team lunches', members: 9 },
    { name: 'design-crit', topic: 'Weekly design feedback, Tuesdays', members: 5 },
    { name: 'wins', topic: 'Client wins and kind words', members: 10 },
    { name: 'web-dev', topic: 'Builds, deploys and staging', members: 4 },
  ];
  const LIVE = [
    { ch: 'seo-team', by: PRIYA, text: 'Cedar & Pine posts are scheduled for Thursday and Saturday.' },
    { ch: 'general', by: BILAL, text: 'Reminder: expense claims close on Friday.' },
    { ch: 'luma-skincare', by: JENNA, text: "@Sara Malik can we move Thursday's call to 4pm?" },
    { ch: 'dm-ayesha', by: AYESHA, text: 'Alba PMax is built in draft. Want a quick look before I submit?' },
    { ch: 'ppc-team', by: HAMZA, text: 'Found the search terms export. Sharing in 5.' },
    { ch: 'grp-plz', by: ZARA, text: 'Captions look great. Scheduling now.' },
    { ch: 'cedar-pine', by: FARIS, text: 'Could we feature our new hygienist on Instagram?' },
    { ch: 'dm-omar', by: OMAR, text: 'Canonical fix is live. Rankings should recover in a week or two.' },
    { ch: 'alba-motors', by: RANIA, text: 'Showroom photos for the offer are in the shared drive.' },
  ];
  const REPLIES = ["Got it, I'm on it.", "Thanks, I'll check and update here.", "Makes sense. I'll add it to the tracker.", 'Done. Shout if you need anything else.', 'Sounds good. Looping in the team now.'];
  const TICKET_SEQ = { CPD: 64, ALB: 87, LUM: 142, HBR: 31, NOV: 22 };

  /* ---------- State ---------- */
  let cur = 'alba-motors';
  let pane = null; // {mode:'thread', mid} | {mode:'pins'} | {mode:'files'}
  let live = 'live'; // live | offline | reconnecting
  let clock = 11 * 60 + 2, liveIdx = 0, replyIdx = 0;
  const typing = {};
  const queue = [];
  const pad = n => String(n).padStart(2, '0');
  const stamp = () => { clock += 1; return `${TODAY} ${pad(Math.floor(clock / 60) % 24)}:${pad(clock % 60)}`; };
  const time = at => at.slice(11, 16);
  const DAY = { [TODAY]: 'Today, Wednesday 4 November', '2026-11-03': 'Yesterday, Tuesday 3 November' };
  const mins = at => +at.slice(11, 13) * 60 + +at.slice(14, 16);

  function enter(id) {
    const c = CH(id);
    c.newFrom = c.unread > 0 ? Math.max(0, MSGS[id].length - c.unread) : null;
    c.unread = 0; c.mention = false;
  }
  enter(cur);

  const fmt = t => esc(t).replace(MENTION_RE, (m, n) => `<b class="at${n === SARA ? ' me' : ''}">@${esc(n)}</b>`).replace(/\n/g, '<br>');
  const mentionsMe = m => m.by !== SARA && (m.text || '').includes('@' + SARA);

  /* ---------- HTML pieces ---------- */
  function chIcon(c) {
    if (c.kind === 'dm') { const o = other(c); return `<span class="ch-ic">${avatar(o, 22)}<i class="pres ${PRESENCE[o] || 'off'}" title="${PRES_LABEL[PRESENCE[o] || 'off']}"></i></span>`; }
    if (c.kind === 'group') return `<span class="ch-ic" title="${c.members.length} people">${ic('users', 15)}</span>`;
    return `<span class="ch-ic">${ic(c.private ? 'lock' : 'hash', 15)}</span>`;
  }
  function itemHTML(c) {
    const muted = c.notify === 'mute';
    const unr = !muted && c.unread > 0 && c.id !== cur ? `<b class="unr" aria-label="${c.unread} unread${c.mention ? ', mentions you' : ''}">${c.mention ? '@ ' : ''}${c.unread}</b>` : '';
    const draft = DRAFTS[c.id] && c.id !== cur ? `<span class="ch-draft" title="Draft">${ic('edit', 13)}</span>` : '';
    return `<button type="button" class="ch-item${c.id === cur ? ' on' : ''}${muted ? ' muted' : ''}${unr ? ' unread' : ''}" data-ch="${c.id}" aria-current="${c.id === cur}">
      ${chIcon(c)}<span class="ch-name">${esc(c.kind === 'channel' || c.kind === 'client' ? c.name : c.name)}</span>${draft}${muted ? `<span class="ch-mute" title="Muted">${ic('bellOff', 13)}</span>` : ''}${unr}</button>`;
  }
  function listHTML(q = '') {
    q = q.trim().toLowerCase();
    const sec = (title, kinds, newBtn) => {
      const items = CHANNELS.filter(c => kinds.includes(c.kind) && (!q || c.name.toLowerCase().includes(q)));
      if (!items.length) return '';
      return `<div class="ch-sec"><h4>${title}</h4>${newBtn}</div>${items.map(itemHTML).join('')}`;
    };
    const out = sec('Channels', ['channel'], `<button type="button" class="icon-btn sm" data-open="chat-new-channel" aria-label="New channel">${ic('plus', 14)}</button>`)
      + sec('Clients', ['client'], `<button type="button" class="icon-btn sm" data-open="chat-new-channel" data-kind="client" aria-label="New client channel">${ic('plus', 14)}</button>`)
      + sec('Direct messages', ['dm', 'group'], `<button type="button" class="icon-btn sm" data-open="chat-new-msg" aria-label="New message">${ic('plus', 14)}</button>`);
    return out || `<div class="empty small">No conversation matches "${esc(q)}".</div>`;
  }
  function headHTML() {
    const c = CH(cur);
    const pins = MSGS[cur].filter(m => m.pinned && !m.deleted).length;
    const files = MSGS[cur].filter(m => m.att && m.att.type !== 'voice' && !m.deleted).length;
    let sub;
    if (c.kind === 'dm') { const o = other(c), p = PRESENCE[o] || 'off'; sub = `${tone(PRES_LABEL[p], p === 'on' ? 'ok' : p === 'away' ? 'warn' : 'muted')} <span class="muted small">${esc(titleOf(o))}</span>`; }
    else sub = `<span class="muted small">${esc(c.topic || 'Group message')}</span>`;
    return `<button type="button" class="icon-btn ch-back" data-act="back" aria-label="Back to conversations">${ic('back')}</button>
      <div class="ch-title"><h2>${c.kind === 'dm' ? avatar(other(c), 24) + ' ' : ''}${esc(chLabel(c))}${c.private ? ` <span class="muted" title="Private">${ic('lock', 14)}</span>` : ''}</h2><p>${sub}</p></div>
      <div class="ch-tools">
        <span class="avatars hide-xs" title="${c.members.length} members">${c.members.slice(0, 4).map(n => avatar(n, 24)).join('')}</span><span class="small muted num hide-xs">${c.members.length} members</span>
        <button type="button" class="btn sm ghost hide-xs" data-act="huddle">${ic('phone', 14)} Huddle <span class="p2">phase 2</span></button>
        <button type="button" class="icon-btn" data-open="chat-meeting" aria-label="Schedule meeting" title="Schedule meeting">${ic('cal')}</button>
        <button type="button" class="icon-btn${pane && pane.mode === 'pins' ? ' on' : ''}" data-act="pins" aria-label="Pinned messages" title="Pinned (${pins})">${ic('pin')}<span class="small num">${pins || ''}</span></button>
        <button type="button" class="icon-btn${pane && pane.mode === 'files' ? ' on' : ''}" data-act="files" aria-label="Files" title="Files (${files})">${ic('file')}<span class="small num">${files || ''}</span></button>
        <button type="button" class="icon-btn" data-open="chat-search" aria-label="Search messages" title="Search messages">${ic('search')}</button>
        <div class="seg" role="group" aria-label="Notifications">${['all', 'mentions', 'mute'].map(k => `<button type="button" data-notify="${k}" class="${c.notify === k ? 'on' : ''}">${{ all: 'All', mentions: 'Mentions', mute: 'Mute' }[k]}</button>`).join('')}</div>
        <button type="button" class="icon-btn" data-open="chat-settings" aria-label="Conversation settings" title="Settings">${ic('gear')}</button>
      </div>`;
  }
  function attHTML(a) {
    if (a.type === 'image') return `<div class="att-img"><div class="att-ph">${ic('image', 34)}</div><div class="att-cap small"><b>${esc(a.name)}</b><span class="muted">${esc(a.meta)}</span></div></div>`;
    if (a.type === 'voice') {
      const bars = [6, 12, 18, 10, 22, 14, 8, 16, 20, 12, 6, 14, 18, 10, 8, 16, 12, 20, 9, 6, 14, 10, 18, 8];
      return `<div class="att-voice"><button type="button" class="icon-btn" data-act="play" aria-label="Play voice note">${ic('play', 14)}</button><span class="wave">${bars.map(h => `<i style="height:${h}px"></i>`).join('')}</span><span class="small muted num">${esc(a.meta)}</span><span class="p2">phase 2</span></div>`;
    }
    return `<div class="att-file">${ic('file', 22)}<div class="att-fn"><b>${esc(a.name)}</b><div class="small muted">${esc(a.meta)}</div></div><button type="button" class="btn sm ghost" data-act="dl">Download</button></div>`;
  }
  function rxHTML(m) {
    const keys = Object.keys(m.rx).filter(k => m.rx[k].length);
    if (!keys.length) return '';
    return `<div class="rxs">${keys.map(k => `<button type="button" class="rx${m.rx[k].includes(SARA) ? ' on' : ''}" data-act="rx" data-e="${k}" title="${esc(m.rx[k].join(', '))}">${k} <span class="num">${m.rx[k].length}</span></button>`).join('')}</div>`;
  }
  function msgHTML(m, o = {}) {
    if (m.sys) return `<div class="msg-sys small muted" data-mid="${m.id}">${fmt(m.text)} <span class="num">${time(m.at)}</span></div>`;
    const c = CH(cur);
    const isMe = m.by === SARA;
    const client = CONTACTS[m.by] ? ` <span class="small muted">${esc(CONTACTS[m.by])}</span>` : '';
    let body;
    if (m.deleted) body = `<p class="msg-text muted"><i>This message was deleted.</i></p>`;
    else if (m.editing) body = `<div class="msg-edit"><textarea rows="2" data-r="edit" aria-label="Edit message">${esc(m.text)}</textarea><div class="row"><button type="button" class="btn sm primary" data-act="edit-save">Save</button><button type="button" class="btn sm ghost" data-act="edit-cancel">Cancel</button></div></div>`;
    else body = (m.text ? `<div class="msg-text">${fmt(m.text)}${m.edited ? ' <span class="small muted">(edited)</span>' : ''}</div>` : '')
      + (m.fwd ? `<blockquote class="fwd"><div class="small muted">${ic('fwd', 12)} Forwarded from ${esc(m.fwd.ch)} · ${esc(m.fwd.by)}</div><div>${fmt(m.fwd.text)}</div></blockquote>` : '')
      + (m.att ? attHTML(m.att) : '')
      + (m.ticket ? `<div class="msg-tk small">${status('todo')} <a href="#ticket">${esc(m.ticket)}</a> created from this message</div>` : '')
      + rxHTML(m);
    let thread = '';
    if (!o.inPane && m.replies.length && !m.deleted) {
      const last = m.replies[m.replies.length - 1];
      const who = [...new Set(m.replies.map(r => r.by))].slice(0, 3);
      thread = `<button type="button" class="thr" data-act="thread">${who.map(n => avatar(n, 18)).join('')}<span>${m.replies.length} ${m.replies.length === 1 ? 'reply' : 'replies'}</span><span class="muted small">Last reply ${time(last.at)}</span></button>`;
    }
    let st = '';
    if (isMe && m.pending) st = `<div class="msg-st">${ic('clock', 12)} ${m.queued ? 'Waiting for connection' : 'Sending…'}</div>`;
    else if (isMe && isDirect(c) && o.lastMine && !m.deleted) st = m.seen ? `<div class="msg-st seen">${ic('check2', 13)} Seen</div>` : `<div class="msg-st">${ic('check', 13)} Sent</div>`;
    const pin = m.pinned && !m.deleted ? `<div class="msg-pin small muted">${ic('pin', 12)} Pinned</div>` : '';
    const head = o.grouped ? '' : `<div class="msg-h"><b>${esc(m.by)}</b>${client}<span class="muted small num">${time(m.at)}</span></div>`;
    const acts = m.deleted || m.pending || m.editing ? '' : `<div class="msg-acts" role="toolbar" aria-label="Message actions">
      ${['👍', '✅', '👀'].map(e => `<button type="button" data-act="rx" data-e="${e}" aria-label="React ${e}">${e}</button>`).join('')}
      ${o.inPane ? '' : `<button type="button" data-act="thread" aria-label="Reply in thread" title="Reply in thread">${ic('thread', 15)}</button><button type="button" data-act="more" aria-label="More actions" aria-haspopup="menu" title="More">${ic('more', 15)}</button>`}</div>`;
    return `<div class="msg${o.grouped ? ' grp' : ''}${m.pending ? ' pending' : ''}${mentionsMe(m) ? ' mentioned' : ''}" data-mid="${m.id}">
      <div class="msg-av">${o.grouped ? `<span class="msg-t num">${time(m.at)}</span>` : avatar(m.by, 34)}</div>
      <div class="msg-b">${pin}${head}${body}${thread}${st}</div>${acts}</div>`;
  }
  function listMsgs(arr, o = {}) {
    let out = '', prev = null, day = '';
    const c = CH(cur);
    const lastMineIdx = arr.map(m => m.by === SARA && !m.sys).lastIndexOf(true);
    arr.forEach((m, i) => {
      const d = m.at.slice(0, 10);
      let broke = false;
      if (!o.inPane && d !== day) { out += `<div class="ch-day">${esc(DAY[d] || d)}</div>`; day = d; broke = true; }
      if (!o.inPane && c.newFrom != null && i === c.newFrom) { out += `<div class="ch-new" role="separator">New messages</div>`; broke = true; }
      const grouped = !broke && prev && !prev.sys && !m.sys && !prev.deleted && prev.by === m.by && mins(m.at) - mins(prev.at) <= 5 && prev.at.slice(0, 10) === d && !m.pinned;
      out += msgHTML(m, { grouped, inPane: o.inPane, lastMine: i === lastMineIdx });
      prev = m;
    });
    return out;
  }
  function msgsHTML() {
    const arr = MSGS[cur];
    const c = CH(cur);
    const intro = `<div class="ch-intro">${c.kind === 'dm' ? avatar(other(c), 44) : `<span class="ch-intro-ic">${ic(c.private ? 'lock' : 'hash', 22)}</span>`}<div><h3>${esc(chLabel(c))}</h3><p class="muted small">${c.kind === 'dm' ? 'Your direct messages with ' + esc(other(c)) + '.' : c.kind === 'group' ? 'Group message with ' + esc(c.members.filter(n => n !== SARA).join(', ')) + '.' : 'This is the start of ' + esc(chLabel(c)) + '. ' + esc(c.topic || '')}</p></div></div>`;
    return intro + listMsgs(arr);
  }
  function paneHTML() {
    if (!pane) return '';
    const c = CH(cur);
    const head = (t) => `<div class="pane-head"><button type="button" class="icon-btn ch-pback" data-act="close-pane" aria-label="Back">${ic('back')}</button><h3>${t}</h3><span class="small muted">${esc(chLabel(c))}</span><button type="button" class="icon-btn" data-act="close-pane" aria-label="Close panel">${ic('close')}</button></div>`;
    if (pane.mode === 'thread') {
      const m = MSGS[cur].find(x => x.id === pane.mid);
      if (!m) return '';
      return head('Thread') + `<div class="pane-body" data-r="pbody">${msgHTML(m, { inPane: true })}
        <div class="pane-count small muted">${m.replies.length} ${m.replies.length === 1 ? 'reply' : 'replies'}</div>${m.replies.map(r => msgHTML(r, { inPane: true })).join('') || '<p class="empty small">No replies yet. Start the thread.</p>'}</div>
        <div class="ch-comp pane-comp"><textarea data-r="tcomp" rows="1" placeholder="Reply in thread" aria-label="Reply in thread"></textarea><div class="ch-comp-bar"><label class="check small"><input type="checkbox" data-r="tbcast"> Also send to ${esc(chLabel(c))}</label><button type="button" class="btn primary sm" data-act="tsend">Reply</button></div></div>`;
    }
    if (pane.mode === 'pins') {
      const pins = MSGS[cur].filter(m => m.pinned && !m.deleted);
      return head('Pinned') + `<div class="pane-body">${pins.length ? pins.map(m => `<div class="pane-item">${avatar(m.by, 28)}<div><div class="small"><b>${esc(m.by)}</b> <span class="muted num">${esc(m.at.slice(5, 10))} ${time(m.at)}</span></div><div class="pane-txt">${fmt(m.text || (m.att ? m.att.name : ''))}</div><div class="row"><button type="button" class="btn sm ghost" data-act="goto" data-ch="${cur}" data-mid="${m.id}">Jump to message</button><button type="button" class="btn sm ghost" data-act="unpin" data-mid="${m.id}">Unpin</button></div></div></div>`).join('') : '<p class="empty small">Nothing pinned yet. Use More on a message to pin it.</p>'}</div>`;
    }
    const files = MSGS[cur].filter(m => m.att && m.att.type !== 'voice' && !m.deleted);
    return head('Files') + `<div class="pane-body">${files.length ? files.map(m => `<div class="pane-item"><span class="pane-fic">${ic(m.att.type === 'image' ? 'image' : 'file', 20)}</span><div><b class="small">${esc(m.att.name)}</b><div class="small muted">${esc(m.att.meta)} · ${esc(m.by)} · ${time(m.at)}</div><div class="row"><button type="button" class="btn sm ghost" data-act="goto" data-ch="${cur}" data-mid="${m.id}">Show in chat</button><button type="button" class="btn sm ghost" data-act="dl">Download</button></div></div></div>`).join('') : '<p class="empty small">No files shared here yet.</p>'}</div>`;
  }
  function typingHTML() {
    const who = typing[cur];
    return who ? `<span class="dots" aria-hidden="true"><i></i><i></i><i></i></span><span>${esc(who.split(' ')[0])} is typing…</span>` : '';
  }
  function liveHTML() {
    const map = { live: ['Live', 'ok'], offline: ['Offline', 'danger'], reconnecting: ['Reconnecting…', 'warn'] };
    return tone(map[live][0], map[live][1]);
  }
  function offHTML() {
    if (live === 'live') return '';
    return live === 'offline'
      ? `<span>You're offline. New messages wait and send when you reconnect.</span><button type="button" class="btn sm" data-act="reconnect">Reconnect now</button>`
      : `<span>Reconnecting…</span>`;
  }
  const placeholder = c => c.adminsOnly ? `Message ${chLabel(c)} (admins only)` : `Message ${chLabel(c)}`;

  /* ---------- Dialogs ---------- */
  const dlg = (id, title, body, submit, wide) => `<dialog id="${id}" class="modal${wide ? ' wide' : ''}"><form method="dialog" data-f="${id}">
    <div class="modal-head"><h3>${title}</h3><button type="button" class="icon-btn" data-close aria-label="Close">${ic('close')}</button></div>
    <div class="modal-body">${body}</div>
    <div class="modal-foot"><button type="button" class="btn ghost" data-close>${submit ? 'Cancel' : 'Close'}</button>${submit ? `<button type="submit" class="btn primary">${submit}</button>` : ''}</div></form></dialog>`;
  const peoplePick = (name, list, checked = []) => `<div class="pick">${list.map(n => `<label>${`<input type="checkbox" name="${name}" value="${esc(n)}"${checked.includes(n) ? ' checked' : ''}>`}${avatar(n, 26)}<span><b>${esc(n)}</b><span class="small muted"> ${esc(titleOf(n))}</span></span></label>`).join('')}</div>`;
  const opt = (v, l, sel) => `<option value="${esc(v)}"${sel ? ' selected' : ''}>${esc(l)}</option>`;

  function dialogsHTML() {
    const team = ALL.filter(n => n !== SARA);
    return [
      dlg('chat-new-msg', 'New message', `<p class="small muted">Pick 1 person for a direct message, or up to 8 for a group.</p>
        <div class="field"><label for="chat-nm-q">Find people</label><input id="chat-nm-q" data-r="nm-q" placeholder="Type a name"></div>
        ${peoplePick('to', team)}<p class="small" data-r="nm-count"><b class="num">0</b> of 8 selected</p>
        <div class="field"><label for="chat-nm-text">First message</label><textarea id="chat-nm-text" name="text" rows="2" placeholder="Say hello"></textarea></div>`, 'Start conversation'),
      dlg('chat-new-channel', 'New channel', `<div class="field"><label>Type</label><div class="seg" data-r="nc-kind"><button type="button" data-kind="public" class="on">Public</button><button type="button" data-kind="private">Private</button><button type="button" data-kind="client">Client</button></div></div>
        <div class="form-grid">
          <div class="field"><label for="chat-nc-name">Name</label><input id="chat-nc-name" name="name" required placeholder="e.g. harbor-legal" pattern="[a-zA-Z0-9 \\-]+"></div>
          <div class="field" data-r="nc-client" hidden><label for="chat-nc-client">Client</label><select id="chat-nc-client" name="client">${K.CLIENTS.map(c => opt(c.name, c.name)).join('')}</select></div>
          <div class="field full"><label for="chat-nc-topic">Topic</label><input id="chat-nc-topic" name="topic" placeholder="What is this channel for?"></div>
          <div class="field full"><label class="check"><input type="checkbox" name="adminsOnly"> Only admins can post</label></div>
        </div>
        <div class="field"><label>Members</label>${peoplePick('members', team, [OMAR, HAMZA])}</div>`, 'Create channel'),
      dlg('chat-browse', 'Browse channels', `<div class="field"><label for="chat-br-q">Search channels</label><input id="chat-br-q" data-r="br-q" placeholder="Channel name"></div><div class="list" data-r="br-list"></div>`),
      dlg('chat-search', 'Search messages', `<div class="row"><input data-r="sr-q" class="grow" placeholder="Search messages and files" aria-label="Search messages"><div class="seg" data-r="sr-scope"><button type="button" data-scope="all" class="on">All</button><button type="button" data-scope="here">This conversation</button></div></div><div class="sr-list" data-r="sr-list"></div>`, null, true),
      dlg('chat-ticket', 'Create ticket from message', `<blockquote class="fwd" data-r="tk-quote"></blockquote><div class="form-grid">
          <div class="field full"><label for="chat-tk-title">Title</label><input id="chat-tk-title" name="title" required></div>
          <div class="field"><label for="chat-tk-proj">Project</label><select id="chat-tk-proj" name="project">${PROJECTS.map(p => opt(p.key, `${p.key} · ${p.name}`)).join('')}</select></div>
          <div class="field"><label for="chat-tk-who">Assignee</label><select id="chat-tk-who" name="assignee">${ALL.map(n => opt(n, n)).join('')}</select></div>
          <div class="field"><label for="chat-tk-pri">Priority</label><select id="chat-tk-pri" name="priority">${opt('urgent', 'Urgent')}${opt('high', 'High')}${opt('normal', 'Normal', true)}${opt('low', 'Low')}</select></div>
          <div class="field"><label for="chat-tk-due">Due date</label><input id="chat-tk-due" name="due" type="date" value="2026-11-07"></div>
          <div class="field full"><label for="chat-tk-desc">Description</label><textarea id="chat-tk-desc" name="desc" rows="3"></textarea></div></div>`, 'Create ticket'),
      dlg('chat-forward', 'Forward message', `<blockquote class="fwd" data-r="fw-quote"></blockquote><p class="small" data-r="fw-count"><b class="num">0</b> of 10 selected</p><div class="pick" data-r="fw-list"></div>
        <div class="field"><label for="chat-fw-note">Add a note</label><textarea id="chat-fw-note" name="note" rows="2" placeholder="Optional"></textarea></div>`, 'Forward'),
      dlg('chat-meeting', 'Schedule meeting', `<div class="form-grid">
          <div class="field full"><label for="chat-mt-title">Title</label><input id="chat-mt-title" name="title" required></div>
          <div class="field"><label for="chat-mt-date">Date</label><input id="chat-mt-date" name="date" type="date" value="2026-11-05"></div>
          <div class="field"><label for="chat-mt-time">Time</label><input id="chat-mt-time" name="time" type="time" value="15:00"></div>
          <div class="field"><label for="chat-mt-dur">Duration</label><select id="chat-mt-dur" name="dur">${opt('15', '15 minutes')}${opt('30', '30 minutes', true)}${opt('45', '45 minutes')}${opt('60', '1 hour')}</select></div>
          <div class="field"><label class="check"><input type="checkbox" name="meet" checked> Add Google Meet link</label></div></div>
        <div class="field"><label>Attendees</label><div data-r="mt-people"></div></div>`, 'Schedule'),
      dlg('chat-settings', 'Conversation settings', `<div class="form-grid">
          <div class="field full"><label for="chat-st-topic">Topic</label><input id="chat-st-topic" name="topic"></div>
          <div class="field"><label for="chat-st-notify">Notifications</label><select id="chat-st-notify" name="notify">${opt('all', 'All messages')}${opt('mentions', 'Mentions only')}${opt('mute', 'Mute')}</select></div>
          <div class="field"><label class="check"><input type="checkbox" name="adminsOnly"> Only admins can post</label></div></div>
        <div class="st-danger row between"><div><b>Archive this conversation</b> <span class="p2">phase 2</span><div class="small muted">Hides it for everyone. History stays searchable.</div></div><button type="button" class="btn sm danger" data-act="archive">Archive</button></div>
        <div class="st-danger row between"><div><b>Leave conversation</b><div class="small muted">You stop getting messages from it.</div></div><button type="button" class="btn sm ghost" data-act="leave">Leave</button></div>`, 'Save changes'),
      dlg('chat-import', 'Slack import and bridge', `<p class="small muted">Copy history from Slack and keep chosen channels in sync both ways. <span class="p2">phase 2</span></p>
        <div class="form-grid"><div class="field"><label for="chat-im-ws">Slack workspace</label><input id="chat-im-ws" value="brandsurge.slack.com"></div>
          <div class="field"><label for="chat-im-days">History to import</label><select id="chat-im-days">${opt('30', 'Last 30 days')}${opt('90', 'Last 90 days', true)}${opt('365', 'Last 12 months')}</select></div></div>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>Slack channel</th><th>Portal channel</th><th>Bridge</th></tr></thead><tbody>
          ${[['#general', 'general', 'Running'], ['#seo', 'seo-team', 'Running'], ['#paid-media', 'ppc-team', 'Paused'], ['#client-alba', 'alba-motors', 'Running']].map(([s, p, b]) => `<tr><td>${s}</td><td><select aria-label="Portal channel for ${s}">${CHANNELS.filter(c => !isDirect(c)).map(c => opt(c.id, '#' + c.name, c.id === p)).join('')}</select></td><td>${tone(b, b === 'Running' ? 'ok' : 'warn')}</td></tr>`).join('')}
        </tbody></table></div>
        <div class="row between"><span class="small">${tone('Bridge running', 'ok')} <span class="muted">Last sync 2 minutes ago · 1,284 messages imported</span></span><div class="seg" data-r="im-bridge"><button type="button" class="on" data-b="run">Running</button><button type="button" data-b="pause">Paused</button></div></div>`, 'Start import', true),
    ].join('');
  }

  /* ---------- CSS ---------- */
  const CSS = `<style>
.scr-chat{gap:0}
.scr-chat [hidden]{display:none !important}
.scr-chat .ch-app{--side:260px;--pane:340px;position:relative;display:grid;grid-template-columns:var(--side) minmax(0,1fr);height:calc(100vh - 150px);height:calc(100dvh - 150px);min-height:520px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);overflow:hidden}
.scr-chat .ch-app.pane-open{grid-template-columns:var(--side) minmax(0,1fr) var(--pane)}
.scr-chat .ic{flex:none;vertical-align:-2px}
.scr-chat .ch-side{display:flex;flex-direction:column;min-height:0;border-right:1px solid var(--line);background:var(--surface-2)}
.scr-chat .ch-side-top{padding:12px 12px 4px}
.scr-chat .ch-side-top input{width:100%}
.scr-chat .ch-list{flex:1;min-height:0;overflow:auto;padding:0 8px 8px}
.scr-chat .ch-sec{display:flex;align-items:center;justify-content:space-between;padding:12px 6px 4px 8px}
.scr-chat .ch-sec h4{margin:0;font-size:13px;font-weight:600;color:var(--ink-2)}
.scr-chat .icon-btn.sm{width:24px;height:24px;min-width:24px;padding:0}
.scr-chat .ch-item{display:flex;align-items:center;gap:8px;width:100%;min-height:34px;padding:5px 8px;border:0;background:none;border-radius:6px;color:var(--ink-2);font:inherit;font-size:14px;text-align:left;cursor:pointer}
.scr-chat .ch-item:hover{background:var(--surface)}
.scr-chat .ch-item.on{background:var(--accent-soft);color:var(--ink)}
.scr-chat .ch-item.unread .ch-name{font-weight:700;color:var(--ink)}
.scr-chat .ch-item.muted .ch-name{color:var(--ink-3)}
.scr-chat .ch-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.scr-chat .ch-ic{position:relative;width:22px;display:inline-flex;justify-content:center;color:var(--ink-3);flex:none}
.scr-chat .ch-mute,.scr-chat .ch-draft{color:var(--ink-3);display:inline-flex}
.scr-chat .unr{color:var(--accent);font-weight:700;font-size:13px;font-variant-numeric:tabular-nums;white-space:nowrap}
.scr-chat .pres{position:absolute;right:-3px;bottom:-2px;width:10px;height:10px;border-radius:50%;border:2px solid var(--surface-2);background:var(--ink-3)}
.scr-chat .pres.on{background:var(--ok)}.scr-chat .pres.away{background:var(--warn)}.scr-chat .pres.off{background:var(--surface-2);box-shadow:inset 0 0 0 2px var(--ink-3)}
.scr-chat .ch-side-foot{border-top:1px solid var(--line);padding:10px 12px;display:flex;flex-direction:column;gap:6px}
.scr-chat .ch-side-foot .row{gap:6px}
.scr-chat .ch-live{display:flex;align-items:center;justify-content:space-between;width:100%;background:none;border:0;padding:6px 0 2px;font:inherit;font-size:13px;cursor:pointer;color:var(--ink-2);text-align:left}
.scr-chat .ch-live:hover .muted{color:var(--ink-2)}
.scr-chat .ch-main{display:flex;flex-direction:column;min-width:0;min-height:0}
.scr-chat .ch-head{display:flex;align-items:center;gap:10px 12px;flex-wrap:wrap;padding:10px 16px;border-bottom:1px solid var(--line)}
.scr-chat .ch-title{flex:1;min-width:180px}
.scr-chat .ch-title h2{margin:0;font-size:17px;display:flex;align-items:center;gap:6px}
.scr-chat .ch-title p{margin:2px 0 0;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.scr-chat .ch-tools{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.scr-chat .ch-tools .icon-btn{display:inline-flex;align-items:center;gap:3px;width:auto;min-width:32px;padding:0 6px}
.scr-chat .ch-tools .icon-btn.on{color:var(--accent);background:var(--accent-soft)}
.scr-chat .ch-back,.scr-chat .ch-pback{display:none}
.scr-chat .ch-off{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 16px;background:var(--danger-soft);color:var(--ink);font-size:13px}
.scr-chat .ch-off.rec{background:var(--warn-soft)}
.scr-chat .ch-off:empty{display:none}
.scr-chat .ch-msgs{flex:1;min-height:0;overflow:auto;padding:4px 0 8px;overscroll-behavior:contain}
.scr-chat .ch-intro{display:flex;gap:12px;align-items:center;padding:20px 16px 8px}
.scr-chat .ch-intro h3{margin:0 0 2px}
.scr-chat .ch-intro p{margin:0}
.scr-chat .ch-intro-ic{width:44px;height:44px;display:grid;place-items:center;border-radius:var(--radius);background:var(--accent-soft);color:var(--accent)}
.scr-chat .ch-day{margin:16px 16px 4px;padding-top:8px;border-top:1px solid var(--line);font-size:12px;font-weight:600;color:var(--ink-3)}
.scr-chat .ch-new{margin:6px 16px;border-top:1px solid var(--accent);text-align:right;font-size:12px;font-weight:700;color:var(--accent);padding-top:2px}
.scr-chat .msg{position:relative;display:grid;grid-template-columns:36px minmax(0,1fr);gap:10px;padding:6px 16px}
.scr-chat .msg.grp{padding-top:1px;padding-bottom:3px}
.scr-chat .msg:hover,.scr-chat .msg.sel{background:var(--surface-2)}
.scr-chat .msg.mentioned{background:var(--warn-soft);box-shadow:inset 3px 0 0 var(--warn)}
.scr-chat .msg.flash{animation:chflash 1.8s ease-out}
@keyframes chflash{from{background:var(--accent-soft)}to{background:transparent}}
.scr-chat .msg-t{display:block;visibility:hidden;font-size:11px;color:var(--ink-3);text-align:right;padding-top:3px}
.scr-chat .msg:hover .msg-t,.scr-chat .msg.sel .msg-t{visibility:visible}
.scr-chat .msg-b{min-width:0}
.scr-chat .msg-h{display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
.scr-chat .msg-h b{color:var(--ink)}
.scr-chat .msg-text{color:var(--ink);line-height:1.5;overflow-wrap:anywhere}
.scr-chat .msg.pending .msg-text{color:var(--ink-3)}
.scr-chat .msg-pin{display:flex;gap:4px;align-items:center;color:var(--warn);margin-bottom:2px}
.scr-chat .at{color:var(--accent);font-weight:600}
.scr-chat .at.me{background:var(--accent-soft);padding:0 3px;border-radius:4px}
.scr-chat .msg-st{display:flex;align-items:center;gap:4px;font-size:12px;color:var(--ink-3);margin-top:2px}
.scr-chat .msg-st.seen{color:var(--accent)}
.scr-chat .msg-tk{display:flex;gap:6px;align-items:center;margin-top:6px}
.scr-chat .msg-sys{padding:6px 16px 6px 62px}
.scr-chat .msg-edit textarea{width:100%;margin:4px 0 6px}
.scr-chat .msg-acts{position:absolute;top:-14px;right:16px;display:none;gap:2px;background:var(--surface);border:1px solid var(--line);border-radius:8px;box-shadow:var(--shadow);padding:2px;z-index:3}
.scr-chat .msg:hover .msg-acts,.scr-chat .msg.sel .msg-acts,.scr-chat .msg.menu-open .msg-acts,.scr-chat .msg:focus-within .msg-acts{display:flex}
.scr-chat .msg-acts>button{display:inline-flex;align-items:center;border:0;background:none;min-width:30px;height:28px;justify-content:center;border-radius:6px;cursor:pointer;color:var(--ink-2);font-size:14px}
.scr-chat .msg-acts>button:hover{background:var(--surface-2)}
.scr-chat .msg-menu{position:absolute;top:calc(100% + 4px);right:0;min-width:190px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);padding:4px;z-index:6}
.scr-chat .msg-menu button{display:flex;gap:8px;align-items:center;width:100%;border:0;background:none;padding:8px 10px;font:inherit;font-size:14px;color:var(--ink);text-align:left;border-radius:6px;cursor:pointer}
.scr-chat .msg-menu button:hover{background:var(--surface-2)}
.scr-chat .msg-menu .del{color:var(--danger)}
.scr-chat .rxs{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.scr-chat .rx{display:inline-flex;align-items:center;gap:4px;border:1px solid var(--line);background:var(--surface);border-radius:6px;padding:2px 7px;font:inherit;font-size:13px;cursor:pointer;color:var(--ink-2)}
.scr-chat .rx.on{border-color:var(--accent);background:var(--accent-soft);color:var(--ink)}
.scr-chat .thr{display:flex;align-items:center;gap:6px;margin-top:6px;border:0;background:none;padding:2px 0;font:inherit;font-size:13px;color:var(--accent);font-weight:600;cursor:pointer}
.scr-chat .thr .avatar{margin-right:-2px}
.scr-chat .fwd{margin:6px 0 0;padding:4px 0 4px 12px;border-left:3px solid var(--line-2);color:var(--ink-2)}
.scr-chat .att-img{margin-top:8px;max-width:300px;border:1px solid var(--line);border-radius:var(--radius);overflow:hidden;background:var(--surface)}
.scr-chat .att-ph{aspect-ratio:4/3;display:grid;place-items:center;background:linear-gradient(135deg,var(--accent-soft),var(--violet-soft));color:var(--accent)}
.scr-chat .att-cap{display:flex;justify-content:space-between;gap:8px;padding:6px 10px}
.scr-chat .att-file{margin-top:8px;display:flex;align-items:center;gap:10px;max-width:380px;padding:10px;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface);color:var(--accent)}
.scr-chat .att-fn{flex:1;min-width:0;color:var(--ink)}
.scr-chat .att-fn b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.scr-chat .att-voice{margin-top:8px;display:flex;align-items:center;gap:10px;max-width:380px;padding:6px 10px;border:1px solid var(--line);border-radius:var(--radius);background:var(--surface)}
.scr-chat .wave{display:flex;align-items:center;gap:2px;height:24px;flex:1;min-width:0;overflow:hidden}
.scr-chat .wave i{width:3px;flex:none;background:var(--ink-3);border-radius:2px}
.scr-chat .att-voice.playing .wave i{background:var(--accent)}
.scr-chat .ch-typing{min-height:22px;padding:0 16px;font-size:12px;color:var(--ink-3);display:flex;align-items:center;gap:6px}
.scr-chat .dots{display:inline-flex;gap:3px}
.scr-chat .dots i{width:5px;height:5px;border-radius:50%;background:var(--ink-3);animation:chdot 1s infinite ease-in-out}
.scr-chat .dots i:nth-child(2){animation-delay:.15s}.scr-chat .dots i:nth-child(3){animation-delay:.3s}
@keyframes chdot{0%,60%,100%{opacity:.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}
@media (prefers-reduced-motion:reduce){.scr-chat .dots i,.scr-chat .msg.flash{animation:none}}
.scr-chat .ch-comp{position:relative;margin:0 16px 14px;border:1px solid var(--line-2);border-radius:var(--radius);background:var(--surface)}
.scr-chat .ch-comp:focus-within{border-color:var(--accent)}
.scr-chat .ch-comp textarea{display:block;width:100%;min-height:44px;max-height:180px;border:0;box-shadow:none;outline:none;background:none;resize:none;padding:10px 12px;font:inherit;color:var(--ink)}
.scr-chat .ch-comp-bar{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:2px 8px 8px}
.scr-chat .ch-comp-bar .row{gap:2px;align-items:center}
.scr-chat .ch-comp-bar .check{margin:0}
.scr-chat .mention-pop{position:absolute;left:8px;bottom:calc(100% + 6px);width:min(300px,calc(100% - 16px));background:var(--surface);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);padding:4px;z-index:6}
.scr-chat .mention-pop button{display:flex;gap:8px;align-items:center;width:100%;padding:6px 8px;border:0;background:none;border-radius:6px;font:inherit;font-size:14px;cursor:pointer;text-align:left;color:var(--ink)}
.scr-chat .mention-pop button.on,.scr-chat .mention-pop button:hover{background:var(--accent-soft)}
.scr-chat .ch-pane{display:none;flex-direction:column;min-height:0;min-width:0;border-left:1px solid var(--line);background:var(--surface)}
.scr-chat .pane-open .ch-pane{display:flex}
.scr-chat .pane-head{display:flex;align-items:center;gap:8px;padding:12px 12px 12px 16px;border-bottom:1px solid var(--line)}
.scr-chat .pane-head h3{margin:0;font-size:15px}
.scr-chat .pane-head .small{flex:1}
.scr-chat .pane-body{flex:1;min-height:0;overflow:auto;padding:8px 0}
.scr-chat .pane-body .msg{padding-left:12px;padding-right:12px}
.scr-chat .pane-body .msg-acts{right:8px}
.scr-chat .pane-count{margin:4px 16px;padding-top:6px;border-top:1px solid var(--line)}
.scr-chat .pane-item{display:grid;grid-template-columns:28px minmax(0,1fr);gap:10px;padding:10px 16px;border-bottom:1px solid var(--line)}
.scr-chat .pane-item .row{margin-top:6px;gap:6px}
.scr-chat .pane-txt{margin-top:2px;overflow-wrap:anywhere}
.scr-chat .pane-fic{color:var(--accent);padding-top:2px}
.scr-chat .pane-comp{margin:8px 12px 12px}
.scr-chat .empty{padding:16px}
.scr-chat .pick{max-height:240px;overflow:auto;border:1px solid var(--line);border-radius:var(--radius)}
.scr-chat .pick label{display:flex;align-items:center;gap:10px;padding:8px 10px;border-bottom:1px solid var(--line);cursor:pointer}
.scr-chat .pick label:last-child{border-bottom:0}
.scr-chat .pick label.dis{opacity:.5;cursor:not-allowed}
.scr-chat dialog .fwd:empty{display:none}
.scr-chat dialog .field{margin-bottom:12px}
.scr-chat dialog.wide{width:min(720px,calc(100vw - 24px))}
.scr-chat .grow{flex:1;min-width:180px}
.scr-chat .sr-list{margin-top:12px;max-height:50vh;overflow:auto}
.scr-chat .sr-item{display:grid;grid-template-columns:28px minmax(0,1fr);gap:10px;width:100%;padding:10px 4px;border:0;border-bottom:1px solid var(--line);background:none;font:inherit;color:var(--ink);text-align:left;cursor:pointer}
.scr-chat .sr-item:hover{background:var(--surface-2)}
.scr-chat .sr-item mark{background:var(--warn-soft);color:var(--ink)}
.scr-chat .st-danger{padding:12px 0;border-top:1px solid var(--line);gap:12px}
@media (max-width:1100px){.scr-chat .ch-app{--side:220px;--pane:300px}}
@media (max-width:1000px){.scr-chat .ch-app.pane-open{grid-template-columns:var(--side) minmax(0,1fr)}.scr-chat .ch-pane{position:absolute;top:0;right:0;bottom:0;width:min(360px,100%);z-index:8;box-shadow:var(--shadow)}}
@media (max-width:760px){
.scr-chat .ch-app,.scr-chat .ch-app.pane-open{grid-template-columns:minmax(0,1fr);height:calc(100vh - 120px);height:calc(100dvh - 120px);min-height:460px}
.scr-chat .ch-main{display:none}
.scr-chat .show-main .ch-side{display:none}
.scr-chat .show-main .ch-main{display:flex}
.scr-chat .ch-back,.scr-chat .ch-pback{display:inline-flex}
.scr-chat .pane-head .icon-btn:last-child{display:none}
.scr-chat .ch-pane{width:100%;border-left:0}
.scr-chat .hide-xs{display:none}
.scr-chat .ch-head{padding:8px 10px}
.scr-chat .ch-title{min-width:0;flex-basis:calc(100% - 48px)}
.scr-chat .msg{padding:6px 10px}
.scr-chat .msg-acts{right:8px}
.scr-chat .ch-comp{margin:0 8px 8px}
.scr-chat .ch-item{min-height:44px}
}
</style>`;

  /* ---------- Render ---------- */
  function render() {
    const c = CH(cur);
    return `<div class="page scr-chat">${CSS}
<div class="ch-app${pane ? ' pane-open' : ''}" data-r="app">
  <aside class="ch-side" aria-label="Conversations">
    <div class="ch-side-top"><input type="search" data-r="jump" placeholder="Jump to a conversation" aria-label="Jump to a conversation"></div>
    <nav class="ch-list" data-r="list">${listHTML()}</nav>
    <div class="ch-side-foot">
      <div class="row"><button type="button" class="btn sm primary" data-open="chat-new-msg">${ic('edit', 14)} New message</button><button type="button" class="btn sm ghost" data-open="chat-browse">Browse channels</button></div>
      <button type="button" class="btn sm ghost" data-open="chat-import">Slack import <span class="p2">phase 2</span></button>
      <button type="button" class="ch-live" data-act="live" title="Simulate a dropped connection"><span data-r="live">${liveHTML()}</span><span class="small muted">Test reconnect</span></button>
    </div>
  </aside>
  <section class="ch-main" aria-label="Messages">
    <header class="ch-head" data-r="head">${headHTML()}</header>
    <div class="ch-off" data-r="off" role="status">${offHTML()}</div>
    <div class="ch-msgs" data-r="msgs" aria-live="polite">${msgsHTML()}</div>
    <div class="ch-typing" data-r="typing" aria-live="polite">${typingHTML()}</div>
    <div class="ch-comp">
      <div class="mention-pop" data-r="mpop" role="listbox" aria-label="Mention someone" hidden></div>
      <textarea data-r="comp" rows="1" placeholder="${esc(placeholder(c))}" aria-label="Write a message">${esc(DRAFTS[cur] || '')}</textarea>
      <div class="ch-comp-bar">
        <div class="row">
          <button type="button" class="icon-btn" data-act="attach" aria-label="Attach a file" title="Attach a file">${ic('clip')}</button><input type="file" data-r="file" hidden>
          <button type="button" class="icon-btn" data-act="at" aria-label="Mention someone" title="Mention someone"><b>@</b></button>
          <button type="button" class="icon-btn" data-act="voice" aria-label="Record a voice note" title="Voice notes ship in phase 2">${ic('mic')}</button><span class="p2">phase 2</span>
        </div>
        <button type="button" class="btn primary sm" data-act="send">Send</button>
      </div>
    </div>
  </section>
  <aside class="ch-pane" data-r="pane" aria-label="Details">${paneHTML()}</aside>
</div>
${dialogsHTML()}
</div>`;
  }

  /* ---------- Mount ---------- */
  function mount(root) {
    const wrap = root.querySelector('.scr-chat');
    if (!wrap) return;
    const $ = s => wrap.querySelector(`[data-r="${s}"]`);
    const app = $('app'), comp = $('comp'), msgsEl = $('msgs'), mpop = $('mpop');
    const timers = new Set();
    let alive = true;
    const check = () => { if (alive && document.contains(wrap)) return true; stop(); return false; };
    const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); if (check()) fn(); }, ms); timers.add(t); return t; };
    const tick = setInterval(() => { if (check()) liveTick(); }, 20000);
    const onHash = () => { if (location.hash.replace('#', '').split('?')[0] !== 'chat' || !document.contains(wrap)) stop(); };
    function stop() { if (!alive) return; alive = false; timers.forEach(clearTimeout); timers.clear(); clearInterval(tick); window.removeEventListener('hashchange', onHash); Object.keys(typing).forEach(k => delete typing[k]); live = 'live'; queue.length = 0; Object.values(MSGS).forEach(a => a.forEach(m => { if (m.pending) { m.pending = false; m.queued = false; } })); }
    window.addEventListener('hashchange', onHash);
    const mobile = () => window.matchMedia('(max-width:760px)').matches;

    /* sub-renders */
    const renderList = () => { $('list').innerHTML = listHTML($('jump').value); };
    const renderHead = () => { $('head').innerHTML = headHTML(); };
    const renderTyping = () => { $('typing').innerHTML = typingHTML(); };
    const renderLive = () => { $('live').innerHTML = liveHTML(); const o = $('off'); o.innerHTML = offHTML(); o.classList.toggle('rec', live === 'reconnecting'); };
    function renderMsgs(mode) {
      const nearBottom = msgsEl.scrollHeight - msgsEl.scrollTop - msgsEl.clientHeight < 120;
      const top = msgsEl.scrollTop;
      msgsEl.innerHTML = msgsHTML();
      if (mode === 'new') {
        const n = msgsEl.querySelector('.ch-new');
        msgsEl.scrollTop = n ? n.offsetTop - 60 : msgsEl.scrollHeight;
      } else if (mode === 'bottom' || nearBottom) msgsEl.scrollTop = msgsEl.scrollHeight;
      else msgsEl.scrollTop = top;
    }
    function renderPane(focus) {
      $('pane').innerHTML = paneHTML();
      app.classList.toggle('pane-open', !!pane);
      const pb = $('pbody'); if (pb) pb.scrollTop = pb.scrollHeight;
      if (focus && $('tcomp') && !mobile()) $('tcomp').focus();
    }
    const autosize = t => { t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 180) + 'px'; };

    function findMsg(mid) {
      for (const m of MSGS[cur]) { if (m.id === mid) return m; const r = m.replies.find(x => x.id === mid); if (r) return r; }
      return null;
    }
    function openCh(id, keepPane) {
      const c = CH(id); if (!c) return;
      if (id !== cur) {
        DRAFTS[cur] = comp.value.trim() ? comp.value : '';
        if (!DRAFTS[cur]) delete DRAFTS[cur];
        CH(cur).newFrom = null;
        cur = id; enter(id);
        if (!keepPane) pane = null;
        comp.value = DRAFTS[id] || ''; autosize(comp);
        comp.placeholder = placeholder(c);
        hidePop();
        renderList(); renderHead(); renderMsgs('new'); renderPane(); renderTyping();
      }
      app.classList.add('show-main');
      if (!mobile()) comp.focus();
    }

    /* sending */
    function responder(c) {
      if (c.kind === 'dm') return other(c);
      if (c.kind === 'group') { const o = c.members.filter(n => n !== SARA); return o[replyIdx % o.length]; }
      if (c.kind === 'client') return c.members.find(n => CONTACTS[n]) || c.members[1];
      return { 'seo-team': OMAR, 'ppc-team': AYESHA, general: YUSUF, announcements: YUSUF }[c.id] || c.members.find(n => n !== SARA);
    }
    function replyText(c, m) {
      const t = (m.text || '').toLowerCase();
      if (m.att) return 'Got the file, thanks. Reviewing it now.';
      if (t.includes('?')) return "Good question. Let me check and I'll reply here within 10 minutes.";
      if (c.kind === 'client') return ['Thanks, Sara. That works for us.', "Perfect, I'll share this with our marketing manager.", 'Noted. Speak on Thursday.'][replyIdx++ % 3];
      return REPLIES[replyIdx++ % REPLIES.length];
    }
    function post(chId, m) {
      MSGS[chId].push(m);
      if (chId === cur) renderMsgs('bottom');
    }
    function send(text, att) {
      const v = (text || '').trim();
      if (!v && !att) return;
      const c = CH(cur);
      const m = mk(SARA, stamp(), v, { pending: true, queued: live !== 'live', att });
      comp.value = ''; autosize(comp); delete DRAFTS[cur]; hidePop();
      c.newFrom = null;
      post(cur, m);
      if (live !== 'live') { queue.push({ ch: cur, m }); return; }
      deliver(cur, m);
    }
    function deliver(chId, m) {
      later(() => {
        m.pending = false; m.queued = false;
        if (chId === cur) renderMsgs();
        const c = CH(chId);
        if (c.notify === 'mute') return;
        const who = responder(c);
        if (!who || who === SARA) return;
        later(() => {
          if (isDirect(c)) m.seen = true;
          typing[chId] = who;
          if (chId === cur) { renderMsgs(); renderTyping(); }
          later(() => {
            delete typing[chId];
            const r = mk(who, stamp(), replyText(c, m));
            MSGS[chId].push(r);
            if (chId === cur) { renderMsgs(); renderTyping(); }
            else { c.unread++; renderList(); }
          }, 1800);
        }, 3000);
      }, 400);
    }
    function incoming(entry) {
      const c = CH(entry.ch); if (!c) return false;
      const m = mk(entry.by, stamp(), entry.text);
      MSGS[c.id].push(m);
      if (c.id === cur) renderMsgs();
      else { c.unread++; if (entry.text.includes('@' + SARA)) c.mention = true; renderList(); }
      return true;
    }
    function liveTick() {
      if (live !== 'live') return;
      for (let i = 0; i < LIVE.length; i++) {
        const e = LIVE[(liveIdx + i) % LIVE.length];
        if (e.ch !== cur && CH(e.ch)) { liveIdx = (liveIdx + i + 1) % LIVE.length; incoming(e); return; }
      }
    }
    function simulateDrop() {
      if (live !== 'live') return;
      live = 'offline'; renderLive();
      later(() => reconnect(), 3500);
    }
    function reconnect() {
      if (live === 'live' || live === 'reconnecting') return;
      live = 'reconnecting'; renderLive();
      later(() => {
        live = 'live'; renderLive();
        queue.splice(0).forEach(q => { q.m.queued = false; deliver(q.ch, q.m); });
        const c = CH(cur);
        const who = responder(c);
        incoming({ ch: cur, by: who && who !== SARA ? who : OMAR, text: 'Posted while you were offline: the plan is signed off and logged in the tracker.' });
        liveTick();
        if (CH(cur)) renderMsgs();
        K.toast('Back online. 2 new messages caught up');
      }, 1500);
    }

    /* @ mentions */
    let popIdx = 0, popList = [];
    function hidePop() { mpop.hidden = true; popList = []; }
    function updatePop() {
      const before = comp.value.slice(0, comp.selectionStart);
      const m = before.match(/(^|\s)@([A-Za-z.]*)$/);
      if (!m) return hidePop();
      const q = m[2].toLowerCase();
      const c = CH(cur);
      const pool = [...new Set([...c.members, ...ALL])].filter(n => n !== SARA);
      popList = pool.filter(n => n.toLowerCase().split(' ').some(p => p.startsWith(q)) || n.toLowerCase().startsWith(q)).slice(0, 6);
      if (!popList.length) return hidePop();
      popIdx = Math.min(popIdx, popList.length - 1);
      mpop.innerHTML = popList.map((n, i) => `<button type="button" role="option" class="${i === popIdx ? 'on' : ''}" aria-selected="${i === popIdx}" data-act="pick" data-name="${esc(n)}">${avatar(n, 22)}<span><b>${esc(n)}</b> <span class="small muted">${esc(titleOf(n))}</span></span></button>`).join('');
      mpop.hidden = false;
    }
    function pick(name) {
      const pos = comp.selectionStart;
      const before = comp.value.slice(0, pos).replace(/@([A-Za-z.]*)$/, '@' + name + ' ');
      comp.value = before + comp.value.slice(pos);
      comp.selectionStart = comp.selectionEnd = before.length;
      hidePop(); comp.focus(); autosize(comp);
    }

    comp.addEventListener('input', () => { popIdx = 0; autosize(comp); updatePop(); });
    comp.addEventListener('click', updatePop);
    comp.addEventListener('blur', () => later(hidePop, 150));
    comp.addEventListener('keydown', e => {
      if (!mpop.hidden && popList.length) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); popIdx = (popIdx + (e.key === 'ArrowDown' ? 1 : -1) + popList.length) % popList.length; updatePop(); return; }
        if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(popList[popIdx]); return; }
        if (e.key === 'Escape') { e.preventDefault(); hidePop(); return; }
      }
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(comp.value); }
    });
    $('jump').addEventListener('input', renderList);
    $('jump').addEventListener('keydown', e => { if (e.key === 'Enter') { const b = $('list').querySelector('[data-ch]'); if (b) { openCh(b.dataset.ch); e.target.value = ''; renderList(); } } });
    $('file').addEventListener('change', e => {
      const f = e.target.files && e.target.files[0]; if (!f) return;
      const kb = f.size / 1024;
      const isImg = /^image\//.test(f.type);
      send(comp.value, { type: isImg ? 'image' : 'file', name: f.name, meta: `${isImg ? 'Image' : (f.name.split('.').pop() || 'File').toUpperCase()} · ${kb > 1024 ? (kb / 1024).toFixed(1) + ' MB' : Math.max(1, Math.round(kb)) + ' KB'}` });
      e.target.value = '';
    });
    wrap.addEventListener('keydown', e => {
      if (e.target.matches('[data-r="tcomp"]') && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); threadSend(); }
      if (e.target.matches('[data-r="edit"]')) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit(e.target); }
        if (e.key === 'Escape') { const m = findMsg(e.target.closest('[data-mid]').dataset.mid); if (m) { m.editing = false; renderMsgs(); } }
      }
      if (e.key === 'Escape' && wrap.querySelector('.msg-menu')) closeMenu();
    });

    function threadSend() {
      const t = $('tcomp'); if (!t || !pane || pane.mode !== 'thread') return;
      const v = t.value.trim(); if (!v) return;
      const parent = MSGS[cur].find(x => x.id === pane.mid); if (!parent) return;
      const r = mk(SARA, stamp(), v);
      parent.replies.push(r);
      if ($('tbcast') && $('tbcast').checked) MSGS[cur].push(mk(SARA, r.at, v, { fwd: { by: SARA, ch: 'thread reply', text: (parent.text || '').slice(0, 80) } }));
      renderPane(true); renderMsgs();
      const c = CH(cur), chId = cur, who = parent.by !== SARA ? parent.by : responder(c);
      if (c.notify !== 'mute' && who && who !== SARA) later(() => { parent.replies.push(mk(who, stamp(), replyText(c, r))); if (chId === cur && pane && pane.mid === parent.id) renderPane(); if (chId === cur) renderMsgs(); }, 2600);
    }
    function saveEdit(ta) {
      const m = findMsg(ta.closest('[data-mid]').dataset.mid); if (!m) return;
      const v = ta.value.trim();
      if (v && v !== m.text) { m.text = v; m.edited = true; }
      m.editing = false; renderMsgs(); if (pane && pane.mode === 'thread') renderPane();
    }

    /* more menu */
    function closeMenu() { wrap.querySelectorAll('.msg-menu').forEach(x => { x.closest('.msg') && x.closest('.msg').classList.remove('menu-open'); x.remove(); }); }
    function openMenu(btn, m) {
      closeMenu();
      const msgEl = btn.closest('.msg');
      const menu = document.createElement('div');
      menu.className = 'msg-menu'; menu.setAttribute('role', 'menu');
      const item = (act, icon, label, cls = '') => `<button type="button" role="menuitem" class="${cls}" data-act="${act}">${ic(icon, 14)} ${label}</button>`;
      menu.innerHTML = (m.by === SARA && m.text ? item('edit', 'edit', 'Edit message') : '')
        + item('pin', 'pin', m.pinned ? 'Unpin' : 'Pin to conversation')
        + item('ticket', 'plus', 'Create ticket')
        + item('forward', 'fwd', 'Forward')
        + item('link', 'clip', 'Copy link')
        + item('delete', 'close', 'Delete message', 'del');
      btn.closest('.msg-acts').appendChild(menu);
      msgEl.classList.add('menu-open');
      const first = menu.querySelector('button'); if (first) first.focus();
    }
    const openDlg = id => { const d = document.getElementById(id); if (d && d.showModal && !d.open) d.showModal(); };

    /* dialog prefill */
    let fwdMsg = null, tkMsg = null, ncKind = 'public';
    function prefill(id, btn) {
      const c = CH(cur);
      if (id === 'chat-meeting') {
        const f = wrap.querySelector('[data-f="chat-meeting"]');
        f.elements.title.value = (c.client ? c.client : isDirect(c) ? 'Catch-up with ' + c.name : '#' + c.name) + (c.client ? ' sync' : '');
        $('mt-people').innerHTML = peoplePick('att', c.members.filter(n => n !== SARA), c.members.filter(n => n !== SARA).slice(0, 4));
      }
      if (id === 'chat-settings') {
        const f = wrap.querySelector('[data-f="chat-settings"]');
        f.topic.value = c.topic || ''; f.notify.value = c.notify; f.adminsOnly.checked = !!c.adminsOnly;
        f.topic.disabled = c.kind === 'dm'; f.adminsOnly.disabled = isDirect(c);
      }
      if (id === 'chat-browse') { $('br-q').value = ''; renderBrowse(); }
      if (id === 'chat-search') { renderSearch(); later(() => $('sr-q').focus(), 30); }
      if (id === 'chat-new-channel') {
        ncKind = btn && btn.dataset.kind === 'client' ? 'client' : 'public';
        $('nc-kind').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.kind === ncKind));
        $('nc-client').hidden = ncKind !== 'client';
      }
      if (id === 'chat-new-msg') { wrap.querySelectorAll('[data-f="chat-new-msg"] input[name="to"]').forEach(i => { i.checked = false; }); nmCount(); }
    }
    function nmCount() {
      const f = wrap.querySelector('[data-f="chat-new-msg"]');
      const n = f.querySelectorAll('input[name="to"]:checked').length;
      $('nm-count').innerHTML = `<b class="num">${n}</b> of 8 selected${n === 1 ? ' · direct message' : n > 1 ? ' · group message' : ''}`;
      f.querySelectorAll('input[name="to"]').forEach(i => { i.disabled = !i.checked && n >= 8; i.closest('label').classList.toggle('dis', i.disabled); });
    }
    function fwCount() {
      const list = $('fw-list');
      const n = list.querySelectorAll('input:checked').length;
      $('fw-count').innerHTML = `<b class="num">${n}</b> of 10 selected`;
      list.querySelectorAll('input').forEach(i => { i.disabled = !i.checked && n >= 10; i.closest('label').classList.toggle('dis', i.disabled); });
    }
    function renderBrowse() {
      const q = $('br-q').value.trim().toLowerCase();
      const joined = CHANNELS.filter(c => !isDirect(c)).map(c => ({ name: c.name, topic: c.topic, members: c.members.length, joined: true, id: c.id }));
      const rows = [...BROWSE.map(b => ({ ...b, joined: false })), ...joined].filter(r => !q || r.name.includes(q) || (r.topic || '').toLowerCase().includes(q));
      $('br-list').innerHTML = rows.map(r => `<div class="item row between"><div><b>#${esc(r.name)}</b><div class="small muted">${esc(r.topic || '')} · <span class="num">${r.members}</span> members</div></div>${r.joined ? `<button type="button" class="btn sm ghost" data-act="goto" data-ch="${r.id}">Open</button>` : `<button type="button" class="btn sm primary" data-act="join" data-name="${esc(r.name)}">Join</button>`}</div>`).join('') || '<p class="empty small">No channel matches that search.</p>';
    }
    let srScope = 'all';
    function renderSearch() {
      const q = $('sr-q').value.trim().toLowerCase();
      const out = [];
      const ids = srScope === 'here' ? [cur] : CHANNELS.map(c => c.id);
      ids.forEach(id => (MSGS[id] || []).forEach(m => {
        if (m.deleted || m.sys) return;
        const hay = `${m.text} ${m.att ? m.att.name : ''} ${m.fwd ? m.fwd.text : ''}`;
        if (!q || hay.toLowerCase().includes(q)) out.push({ id, m, hay });
      }));
      const hl = s => { const e = esc(s); if (!q) return e; const re = new RegExp('(' + esc(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'); return e.replace(re, '<mark>$1</mark>'); };
      const list = out.slice(-30).reverse();
      $('sr-list').innerHTML = (q ? `<p class="small muted"><span class="num">${out.length}</span> ${out.length === 1 ? 'result' : 'results'}</p>` : '<p class="small muted">Recent messages</p>')
        + (list.map(r => `<button type="button" class="sr-item" data-act="goto" data-ch="${r.id}" data-mid="${r.m.id}">${avatar(r.m.by, 28)}<span><span class="small"><b>${esc(r.m.by)}</b> <span class="muted">in ${esc(chLabel(CH(r.id)))} · ${esc(r.m.at.slice(8, 10))} Nov ${time(r.m.at)}</span></span><span style="display:block">${hl(r.hay.trim())}</span></span></button>`).join('') || '<p class="empty small">No messages match. Try a client or file name.</p>');
    }
    $('sr-q').addEventListener('input', renderSearch);
    $('br-q').addEventListener('input', renderBrowse);
    $('nm-q').addEventListener('input', e => { const q = e.target.value.toLowerCase(); wrap.querySelectorAll('[data-f="chat-new-msg"] .pick label').forEach(l => { l.hidden = !l.textContent.toLowerCase().includes(q); }); });
    wrap.addEventListener('change', e => {
      if (e.target.name === 'to') nmCount();
      if (e.target.closest('[data-r="fw-list"]')) fwCount();
    });

    function gotoMsg(chId, mid) {
      wrap.querySelectorAll('dialog[open]').forEach(d => d.close());
      openCh(chId, false);
      if (!mid) return;
      const el = msgsEl.querySelector(`[data-mid="${mid}"]`);
      if (el) { el.scrollIntoView({ block: 'center' }); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
    }
    function addChannel(c, seed) {
      CHANNELS.push({ unread: 0, mention: false, notify: 'all', newFrom: null, members: [SARA], ...c });
      MSGS[c.id] = seed || [];
      renderList();
      openCh(c.id);
    }

    /* form submits (capture so we run before the shared handler and can replace its toast) */
    const onSubmit = (id, fn) => {
      const f = wrap.querySelector(`[data-f="${id}"]`);
      f.addEventListener('submit', e => {
        e.preventDefault(); e.stopImmediatePropagation();
        const msg = fn(f);
        if (msg === false) return;
        f.closest('dialog').close();
        if (msg) K.toast(msg);
      }, true);
    };
    onSubmit('chat-new-msg', f => {
      const to = [...f.querySelectorAll('input[name="to"]:checked')].map(i => i.value);
      if (!to.length) { K.toast('Pick at least 1 person'); return false; }
      const text = f.text.value.trim(); f.text.value = '';
      let c = to.length === 1 ? CHANNELS.find(x => x.kind === 'dm' && other(x) === to[0]) : null;
      if (!c) {
        const id = (to.length === 1 ? 'dm-' : 'grp-') + to.map(n => n.split(' ')[0].toLowerCase()).join('-');
        c = CH(id);
        if (!c) addChannel({ id, name: to.length === 1 ? to[0] : to.map(n => n.split(' ')[0]).join(', '), kind: to.length === 1 ? 'dm' : 'group', members: [SARA, ...to] });
        c = CH(id);
      }
      openCh(c.id);
      if (text) send(text);
      return to.length === 1 ? `Direct message with ${to[0]} opened` : `Group with ${to.length} people created`;
    });
    $('nc-kind').addEventListener('click', e => {
      const b = e.target.closest('[data-kind]'); if (!b) return;
      ncKind = b.dataset.kind;
      $('nc-kind').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      $('nc-client').hidden = ncKind !== 'client';
    });
    onSubmit('chat-new-channel', f => {
      const name = f.elements.name.value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      if (!name) { K.toast('Add a channel name'); return false; }
      if (CHANNELS.some(c => c.name === name)) { K.toast(`#${name} already exists`); return false; }
      const members = [SARA, ...[...f.querySelectorAll('input[name="members"]:checked')].map(i => i.value)];
      const id = 'ch-' + name;
      addChannel({ id, name, kind: ncKind === 'client' ? 'client' : 'channel', private: ncKind !== 'public', client: ncKind === 'client' ? f.client.value : undefined, topic: f.topic.value.trim(), adminsOnly: f.adminsOnly.checked, members },
        [mk(SARA, stamp(), `${SARA} created #${name} and added ${members.length - 1} ${members.length === 2 ? 'person' : 'people'}.`, { sys: true })]);
      f.reset();
      return `#${name} created`;
    });
    onSubmit('chat-ticket', f => {
      if (!tkMsg) return '';
      const key = f.project.value;
      TICKET_SEQ[key] = (TICKET_SEQ[key] || 0) + 1;
      tkMsg.ticket = `${key}-${TICKET_SEQ[key]}`;
      renderMsgs();
      return `Ticket ${tkMsg.ticket} created and assigned to ${f.assignee.value}`;
    });
    onSubmit('chat-forward', f => {
      const ids = [...$('fw-list').querySelectorAll('input:checked')].map(i => i.value);
      if (!ids.length) { K.toast('Pick at least 1 conversation'); return false; }
      const note = f.note.value.trim();
      ids.forEach(id => MSGS[id].push(mk(SARA, stamp(), note, { fwd: { by: fwdMsg.by, ch: chLabel(CH(cur)), text: fwdMsg.text || (fwdMsg.att ? fwdMsg.att.name : '') } })));
      f.note.value = '';
      if (ids.includes(cur)) renderMsgs('bottom');
      return `Forwarded to ${ids.length} ${ids.length === 1 ? 'conversation' : 'conversations'}`;
    });
    onSubmit('chat-meeting', f => {
      const d = new Date(f.date.value + 'T00:00:00');
      const day = isNaN(d) ? f.date.value : d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
      const n = f.querySelectorAll('input[name="att"]:checked').length;
      post(cur, mk(SARA, stamp(), `${SARA} scheduled "${f.elements.title.value.trim()}" for ${day} at ${f.time.value} (${f.dur.value} min) with ${n} ${n === 1 ? 'person' : 'people'}${f.meet.checked ? '. Google Meet link added.' : '.'}`, { sys: true }));
      return 'Meeting scheduled and invites sent';
    });
    onSubmit('chat-settings', f => {
      const c = CH(cur);
      if (c.kind !== 'dm') c.topic = f.topic.value.trim();
      c.notify = f.notify.value; c.adminsOnly = f.adminsOnly.checked;
      comp.placeholder = placeholder(c);
      renderHead(); renderList();
      return 'Settings saved';
    });
    onSubmit('chat-import', () => 'Import queued. Phase 2 preview only.');

    /* clicks */
    wrap.addEventListener('click', e => {
      const t = e.target;
      if (!t.closest('.msg-menu') && !t.closest('[data-act="more"]')) closeMenu();
      const op = t.closest('[data-open]');
      if (op && op.dataset.open.startsWith('chat-')) { prefill(op.dataset.open, op); return; }
      const a = t.closest('[data-act]');
      const chBtn = t.closest('[data-ch]');
      if (!a && chBtn) { openCh(chBtn.dataset.ch); return; }
      const nb = t.closest('[data-notify]');
      if (nb) {
        const c = CH(cur); c.notify = nb.dataset.notify;
        renderHead(); renderList();
        K.toast({ all: 'You get every message here', mentions: 'You only get @mentions here', mute: `${chLabel(c)} muted` }[c.notify]);
        return;
      }
      if (!a) {
        const msg = t.closest('.ch-msgs .msg');
        if (msg && mobile() && !t.closest('a,button,textarea')) { const on = msg.classList.contains('sel'); wrap.querySelectorAll('.msg.sel').forEach(x => x.classList.remove('sel')); msg.classList.toggle('sel', !on); }
        return;
      }
      const act = a.dataset.act;
      const mEl = a.closest('[data-mid]');
      const m = mEl ? findMsg(mEl.dataset.mid) : null;
      switch (act) {
        case 'back': app.classList.remove('show-main'); pane = null; renderPane(); renderList(); break;
        case 'send': send(comp.value); comp.focus(); break;
        case 'attach': $('file').click(); break;
        case 'at': { const p = comp.selectionStart || comp.value.length; const pre = comp.value.slice(0, p); const add = (pre && !/\s$/.test(pre) ? ' ' : '') + '@'; comp.value = pre + add + comp.value.slice(p); comp.focus(); comp.selectionStart = comp.selectionEnd = p + add.length; updatePop(); break; }
        case 'voice': K.toast('Voice notes ship in phase 2'); break;
        case 'huddle': K.toast('Huddles ship in phase 2. Use Schedule meeting for now.'); break;
        case 'pick': pick(a.dataset.name); break;
        case 'live': simulateDrop(); break;
        case 'reconnect': reconnect(); break;
        case 'pins': case 'files': pane = pane && pane.mode === act ? null : { mode: act }; renderPane(); renderHead(); break;
        case 'close-pane': pane = null; renderPane(); renderHead(); break;
        case 'thread': if (m) { pane = { mode: 'thread', mid: m.id }; renderPane(true); renderHead(); } break;
        case 'tsend': threadSend(); break;
        case 'rx': if (m) {
          const k = a.dataset.e; const arr = m.rx[k] = m.rx[k] || [];
          const i = arr.indexOf(SARA); if (i >= 0) arr.splice(i, 1); else arr.push(SARA);
          renderMsgs(); if (pane && pane.mode === 'thread') renderPane();
        } break;
        case 'more': if (m) { if (mEl.classList.contains('menu-open')) closeMenu(); else openMenu(a, m); } break;
        case 'edit': if (m) { closeMenu(); m.editing = true; renderMsgs(); const ta = msgsEl.querySelector('[data-r="edit"]'); if (ta) { ta.focus(); ta.selectionStart = ta.value.length; } } break;
        case 'edit-save': saveEdit(mEl.querySelector('[data-r="edit"]')); break;
        case 'edit-cancel': if (m) { m.editing = false; renderMsgs(); } break;
        case 'pin': case 'unpin': if (m) { closeMenu(); m.pinned = act === 'unpin' ? false : !m.pinned; renderMsgs(); renderHead(); if (pane && pane.mode === 'pins') renderPane(); K.toast(m.pinned ? 'Pinned to conversation' : 'Unpinned'); }
          else if (act === 'unpin') { const pm = findMsg(a.dataset.mid); if (pm) { pm.pinned = false; renderMsgs(); renderHead(); renderPane(); K.toast('Unpinned'); } }
          break;
        case 'ticket': if (m) {
          closeMenu(); tkMsg = m;
          const c = CH(cur); const f = wrap.querySelector('[data-f="chat-ticket"]');
          const proj = PROJECTS.find(p => p.client === c.client) || PROJECTS.find(p => (m.text || '').includes(p.client.split(' ')[0])) || PROJECTS[0];
          const src = m.text || (m.att ? m.att.name : 'Message');
          f.elements.title.value = src.replace(MENTION_RE, '').trim().slice(0, 70);
          f.project.value = proj.key; f.assignee.value = proj.lead; f.priority.value = 'normal';
          f.desc.value = `From ${chLabel(c)}, ${m.by} at ${time(m.at)}:\n"${src}"`;
          $('tk-quote').innerHTML = `<div class="small muted">${esc(m.by)} · ${time(m.at)}</div><div>${fmt(src)}</div>`;
          openDlg('chat-ticket');
        } break;
        case 'forward': if (m) {
          closeMenu(); fwdMsg = m;
          $('fw-quote').innerHTML = `<div class="small muted">${esc(m.by)} · ${esc(chLabel(CH(cur)))}</div><div>${fmt(m.text || (m.att ? m.att.name : ''))}</div>`;
          $('fw-list').innerHTML = CHANNELS.filter(c => c.id !== cur).map(c => `<label><input type="checkbox" value="${c.id}">${c.kind === 'dm' ? avatar(other(c), 24) : `<span class="ch-ic">${ic(c.private ? 'lock' : 'hash', 15)}</span>`}<span><b>${esc(chLabel(c))}</b></span></label>`).join('');
          fwCount(); openDlg('chat-forward');
        } break;
        case 'link': if (m) {
          closeMenu();
          const url = `${location.origin}${location.pathname}#chat?c=${cur}&m=${m.id}`;
          try { navigator.clipboard && navigator.clipboard.writeText(url).catch(() => {}); } catch (_) { /* clipboard blocked */ }
          K.toast('Link copied');
        } break;
        case 'delete': if (m) { closeMenu(); m.deleted = true; m.pinned = false; renderMsgs(); renderHead(); if (pane) renderPane(); K.toast('Message deleted'); } break;
        case 'play': { const v = a.closest('.att-voice'); const on = v.classList.toggle('playing'); a.innerHTML = ic(on ? 'pause' : 'play', 14); if (on) later(() => { v.classList.remove('playing'); a.innerHTML = ic('play', 14); }, 2500); break; }
        case 'dl': K.toast('Download starts in the live portal'); break;
        case 'goto': gotoMsg(a.dataset.ch, a.dataset.mid); break;
        case 'join': {
          const b = BROWSE.find(x => x.name === a.dataset.name); if (!b) break;
          BROWSE.splice(BROWSE.indexOf(b), 1);
          wrap.querySelectorAll('dialog[open]').forEach(d => d.close());
          addChannel({ id: 'ch-' + b.name, name: b.name, kind: 'channel', topic: b.topic, members: [SARA, ...ALL.filter(n => n !== SARA).slice(0, b.members - 1)] },
            [mk(LINA, T + '09:40', b.name === 'design-crit' ? 'Tuesday crit: Alba offer creatives and the Nova moodboard.' : b.name === 'wins' ? 'Cedar & Pine booked 31 new patients from organic search in October.' : b.name === 'web-dev' ? 'Harbor staging is green. Deploy window is 6pm.' : 'Lunch on Thursday is shawarma. Reply if you want in.'),
              mk(SARA, stamp(), `${SARA} joined #${b.name}.`, { sys: true })]);
          K.toast(`Joined #${b.name}`);
          break;
        }
        case 'archive': K.toast('Archiving ships in phase 2'); break;
        case 'leave': {
          const c = CH(cur);
          if (c.id === 'general') { K.toast('Everyone stays in #general'); break; }
          a.closest('dialog').close();
          CHANNELS.splice(CHANNELS.indexOf(c), 1);
          const next = 'general';
          cur = next; enter(next); pane = null;
          comp.value = DRAFTS[next] || ''; comp.placeholder = placeholder(CH(next));
          renderList(); renderHead(); renderMsgs('new'); renderPane(); renderTyping();
          K.toast(`You left ${chLabel(c)}`);
          break;
        }
      }
    });
    $('sr-scope').addEventListener('click', e => { const b = e.target.closest('[data-scope]'); if (!b) return; srScope = b.dataset.scope; $('sr-scope').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); renderSearch(); });
    $('im-bridge').addEventListener('click', e => { const b = e.target.closest('[data-b]'); if (!b) return; $('im-bridge').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); K.toast(b.dataset.b === 'run' ? 'Bridge resumed' : 'Bridge paused. Messages stop syncing.'); });

    /* initial state */
    if (!mobile()) app.classList.add('show-main');
    autosize(comp);
    const n = msgsEl.querySelector('.ch-new');
    msgsEl.scrollTop = n ? n.offsetTop - 60 : msgsEl.scrollHeight;
    // A reply could have been mid-typing when the screen was left; nothing is pending now.
    Object.keys(typing).forEach(k => delete typing[k]); renderTyping();
  }

  screen({ id: 'chat', title: 'Chat', group: 'Core', render, mount });
})();

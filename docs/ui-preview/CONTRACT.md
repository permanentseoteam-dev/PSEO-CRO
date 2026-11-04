# UI preview: build contract (read fully before writing)

This is a clickable **UI mockup** of an agency portal for the workspace "Permanent SEO". It is published as a private Claude artifact. It's static HTML, CSS and JS with fictional sample data. There is no backend and no network.

Folder: `C:/Users/ok/AppData/Local/Temp/claude/df98c28fab9881ef/8d1c3879-5b00-4fa9-84c7-b0fb75c41e30/scratchpad/ui-preview/`

## Files and owners (never write a file you don't own)
| File | Owner |
|---|---|
| `kit.js` | lead (read-only for everyone; read it first, it defines `window.K`) |
| `index.html`, `app.css`, `app.js` | Shell agent |
| `screens/core.js` | Core agent: home, my-work, calendar |
| `screens/chat.js` | Chat agent: chat |
| `screens/work.js` | Work agent: tickets, ticket, projects, reviews, templates, recurring |
| `screens/clients.js` | Clients agent: clients, client, response-times, meetings, files |
| `screens/finance.js` | Finance agent: finance, invoices, invoice, profitability, payments, billing-clients, payment-reminders, finance-setup |
| `screens/team.js` | Team + Personal agent: directory, org-chart, performance, profile, time, prefs |
| `screens/portal.js` | Portal agent: portal-home, portal-work, portal-meetings, portal-files, portal-invoices, portal-messages |

Load order in `index.html`: `kit.js`, then the `screens/*.js` files, then `app.js`.

## Registering a screen
```js
(function(){ const {screen, esc, avatar, status, tone, priority, money, PEOPLE, CLIENTS, PROJECTS, ME} = K;
  screen({ id:'tickets', title:'Tickets', group:'Work', render(){ return `<div class="page">...</div>`; }, mount(root){ /* optional extra wiring */ } });
})();
```
- `group` is one of `'Core'`, `'Work'`, `'Clients'`, `'Finance'`, `'Team'`, `'Personal'`, `'Portal'`, or `null`. Use `null` for detail pages reached by links: `ticket`, `client`, `invoice`, `recurring`, `finance-setup`.
- Links between screens are plain anchors: `<a href="#ticket">`. Route ids must be letters, digits and hyphens only. **Never use `#settings`** (reserved), so Settings is `prefs`.
- After `render()`, the shell calls `K.wireTabs(main)`, `K.wireModals(main)`, then your `mount(main)`.
  - Tabs: `<div class="tabs" data-tabs="x"><button data-tab="a" class="on">A</button>…</div>` plus `<section data-panel="x:a">…</section><section data-panel="x:b" hidden>…</section>`.
  - Modals: `<button data-open="dlg-id">` opens `<dialog id="dlg-id" class="modal">`. `[data-close]` closes it. A form submit is intercepted and shows a toast.
  - Make dialog ids unique: prefix them with your screen id.
- Any other interaction (drag on board, segmented filters, sending a chat message, timer) goes in `mount`. Never use `alert`, `confirm` or `prompt`.

## Shared CSS classes (the Shell agent implements these in app.css; everyone uses them)
- **Layout:** `.page` (column, gap 20px), `.row` (flex wrap gap 8–12), `.between` (space-between), `.grid-2`, `.grid-3`, `.grid-4` (responsive; one column under 900px), `.stack` (column gap 8), `.muted`, `.small`, `.num` (tabular numbers), `.right`.
- **Cards:** `.card`, `.card-head` (title + actions on one row; title is an `h3`), `.card-body`.
- **Stats:** `.stats` (grid) > `.stat` > `.label`, `.value`, `.sub`. Tone on value: `.value.t-danger`.
- **Tables:** `.table-wrap` > `table.tbl` (sentence-case headers, never uppercase), `tr.click`, `.hide-sm`.
- **Tabs:** `.tabs` (underline style). Segmented control: `.seg` > `button.on`.
- **Buttons:** `.btn`, `.btn.primary`, `.btn.ghost`, `.btn.sm`, `.btn.danger`, `.icon-btn`.
- **Forms:** `.form-grid` (2 columns) > `.field` > `label` + `input`/`select`/`textarea`; `.field.full`; `.check` (checkbox + label).
- **Status:**
  - `K.status('in_review')`, `K.tone('At risk','danger')` give a coloured dot plus text.
  - Tones: `t-muted`, `t-blue`, `t-violet`, `t-danger`, `t-ok`, `t-warn`, `t-accent`.
  - `K.priority('high')`.
- **Avatars and lists:** `K.avatar(name, size)`, `.avatars` (overlapping stack), `.list` > `.item`.
- **Filters and empty states:** `.toolbar` (filter row), `.empty` (empty state).
- **Progress bar:** `.bar` > `<i style="width:62%">`, toned with `.bar.t-warn`.
- **Board:** `.board` > `.col` > `.col-head` + `.kcard`.
- **Calendar:** `.cal-grid` > `.cal-cell` (`.dim`, `.today`) > `.ev`.
- **Modals and toast:** `dialog.modal` > `.modal-head` / `.modal-body` / `.modal-foot`; `K.toast(msg)`.
- **Phase 2 marker:** `<span class="p2">phase 2</span>`, muted italic text placed after a tab or section name that ships in Phase 2. **Not a pill.**
- **Screen-specific CSS:** put it in a `<style>` inside your render string, scoped under a root class like `.scr-chat`. Use only the CSS variables: `--bg`, `--surface`, `--surface-2`, `--ink`, `--ink-2`, `--ink-3`, `--line`, `--line-2`, `--accent`, `--accent-ink`, `--accent-soft`, `--danger`, `--warn`, `--ok`, `--blue`, `--violet`, plus a `-soft` variant of each, `--radius`, `--shadow`. Never hard-code colours, because the page has light and dark themes.

## Design rules (strict, from the user's global rules)
- **No pills or badges anywhere.**
  - No rounded label chips and no round count badges.
  - Show unread counts as a plain bold number in accent colour.
  - Show status as a dot plus text.
- No eyebrow or kicker labels above headings. No small uppercase letter-spaced labels. No "—— LABEL ——" dividers.
- No secondary text link under a main button. No small print or asterisk footnotes under buttons.
- Copy is short, plain and active. Buttons say exactly what they do.
- Everything visible renders in a realistic working state with sample data. No lorem ipsum and no empty shells.
- Mobile: must work at 390px wide. Tables scroll inside `.table-wrap`; grids stack.

## What to build
- The spec is in the plan: `C:/Users/ok/.claude/plans/https-permanent-seo-portal-brandsurge-ae-stateful-karp.md`. Read the "Per-tab spec" for your tabs **and** the "Phase 2" section for your tabs.
- Build every tab, sub-tab, stat card, table column, filter, button and form described there.
- Phase 2 items are built and visible too, marked with `.p2`.
- Use `K.PEOPLE`, `K.CLIENTS`, `K.PROJECTS` and `K.ME` for names, and invent consistent fictional extra data. Today is 2026-11-04. Currencies are AED, USD and PKR.
- Size target: up to about 80 KB per screen file.
- Check before finishing: `node --check <yourfile>`. Also run a quick smoke test that loads `kit.js` and your file in node with `globalThis.window = globalThis`, then calls every `render()` to make sure none throws.

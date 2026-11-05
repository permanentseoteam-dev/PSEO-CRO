# Bordio look across the whole app

## Context
You want the portal to look and feel like Bordio (bordio.com and the app screenshots you sent), using **Bordio's exact colours** (decided):
- dark navy sidebar `#111d40`
- sky-blue primary `#0d8df4`
- soft grey-blue page, white cards, rounded corners, airy spacing

Today the app is teal (`#0d9488`) with a white sidebar. The theme is already driven by CSS variables (`app/globals.css`), so most of the reskin is token and rule edits, not page rewrites.

Also pending from before: subtasks under main tasks. The data is done; the table and board UI isn't. Everything is uncommitted and not yet previewed, because the last Vercel deploy said "Not authorized".

## Steps (3 builders in parallel, each owning separate files)

### Builder A (opus): theme in `app/globals.css` only
1. **Light tokens:**
   - `--accent #0d8df4`, `--accent-ink #0a6fc2` (links and text on white), `--accent-soft #e7f3fe`, `--accent-contrast #fff`
   - `--bg #f4f6fa`, `--surface #fff`, `--surface-2 #f7f9fc`
   - `--line #e6e9f0`, `--line-2 #eef1f6`
   - `--ink #1d2433`, `--ink-2 #5b6478`, `--ink-3 #8a93a6`
   - `--blue` aligned to `#0d8df4`
2. **Dark tokens:** both identical dark blocks, the prefers-color-scheme one and `[data-theme=dark]`, get a navy-based dark: `--bg #0b1430`, `--surface #111d40`, `--line #22305a`, `--accent #3aa2ff`, `--accent-contrast #fff`.
3. **New sidebar vars:** `--side-bg #111d40`, `--side-ink #e6ebf5`, `--side-ink-2 #8f9bbd`, `--side-hover rgba(255,255,255,.06)`, `--side-active #2b3b6b`, `--side-line rgba(255,255,255,.08)`.
   - Rewrite the `.sidebar` rules (globals.css about 171-250: nav-link, nav-label, clock, menu, side-foot) to use them.
   - The active item becomes a filled lighter-navy rounded row, like Bordio's "test" project, instead of a teal bar.
4. **Shapes:** `--radius-ctl 10px`, `--radius-card 12px`, softer `--shadow` (`0 1px 2px rgba(17,29,64,.06), 0 4px 16px rgba(17,29,64,.05)`), slightly airier `--ctl-h 38px`.
5. **Components:**
   - `.btn.primary`: hover uses `color-mix(var(--accent) 90%, #000)`.
   - Tabs: the active tab is blue text with a 3px rounded blue underline.
   - Tables: muted header, roomier rows, light-blue hover.
   - Topbar: solid white with a light bottom shadow (no blur), like Bordio.
6. **Headings:** use Inter 600 (Bordio's plain headings) by pointing `--font-head` at `--font-inter`. Jakarta stays loaded but unused, or gets removed from `app/layout.tsx` by Builder B.

### Builder B (sonnet): brand defaults outside globals.css
- `lib/modules/portal-design/logic.ts`: `DEFAULT_DESIGN.accent` becomes the Bordio blue, added to `ACCENT_CHOICES`, and its test is updated.
- New `supabase/migrations/0215_bordio_accent.sql`:
  - sets the DB default to the new blue
  - updates the settings row only if it still holds the old default teal
  - leaves per-client `clients.portal_color` untouched
  - applied the same way as 0213/0214, as a single-file folder
- `public/manifest.json` `theme_color`, and `app/layout.tsx` `themeColor` + Jakarta font, set to the new colours.
- Favicon: point `icons.icon` at `/icon-192.png` (the logo) instead of the teal `icon.svg`.
- `features/platform-p2/components/push-prompt.module.css`: replace the hardcoded `#0b8df4` with `var(--accent)`.
- The few TSX raw hex values (`settings/_components/portal-design.tsx`, `config-editor.tsx`, `brand-kit-dialog.tsx`, `client-actions.tsx`): switch to vars only where they are the old teal.

### Builder C (opus): finish subtasks UI
- `app/(app)/projects/[key]/tasks/_components/tasks-view.tsx` + `tasks.module.css`, per the agent's saved plan:
  - Open/Completed list main tasks only.
  - Each main row has a fold chevron and a muted done/total count, with subtasks indented below it. A done subtask is struck through.
  - Kanban shows main tasks with the done/total count.
- Data in `lib/modules/work/space.ts` is already done (`parentId`, subtasks by parent id).

## Known trade-off
White text on `#0d8df4` has a contrast of about 3.3:1, below the 4.5:1 accessibility guideline for normal text. Buttons keep the exact Bordio blue, as you chose. Links and blue text on white use the darker `--accent-ink #0a6fc2`. The portal-design contrast check (`lib/modules/portal-design/logic.ts`) may reject `#0d8df4`. If it does, Builder B keeps the check and uses the nearest passing blue for the client-portal default only, and reports it.

## Verification (surgical, as you asked)
1. `npx tsc --noEmit -p .`, `npx eslint` on the changed files, `npx vitest run lib/modules/work lib/modules/portal-design lib/modules/chat`.
2. `npx next build` (haiku agent).
3. `npx vercel deploy --yes` as a preview, never `--prod`. If "Not authorized" again, ask you to run `vercel login`, then retry.
4. One sonnet QA agent on the preview takes light and dark screenshots of:
   - Home, Tickets, Projects → a project's Tasks / Notes / Settings
   - Chat (red mention highlight)
   - Settings
   - the client portal

   It also checks the splash, the notifications pop-up and the subtasks rows. It changes nothing.
5. You get the preview link with what each page shows. Nothing goes live until you say "push".

## Time
About 25–30 minutes: builders ~10, checks and build ~6, deploy ~3, QA ~6. This is an estimate based on today's runs.

# UI plan: make every tab look like the Task tab

Written 2026-11-20 for the next working session. Start here.

## Where things stand

- Branch `build/full`, last pushed commit `2379c8f` (Bordio-style UI). Latest preview: https://pseo-cro-portal-c22ougso5-pseo-dev.vercel.app
- Live site (https://pseo-cro-portal.vercel.app) is on `78e4ecc` (before the Bordio-style UI). Deploy to production only after the user says "push".
- Database migrations applied to the live database: `0227_project_departments`, `0228_tasks_client_visible_default`, `0229_project_colors`.
- Test task PSEO-3 (created by mistake in QA) was deleted on 2026-11-20.

### Already done on the Task tab (the look to copy)

- Cards tinted with their project's colour: `projectTint(color)` in `lib/modules/work/project-colors.ts` (8 pastel colours, `color-mix` with `--surface`, so dark mode works).
- Card layout: assignee avatar left of a 2-line title; meta row with "N days left / Due today / N days overdue" (overdue in danger colour), checklist done/total, comment count, "Blocked" note; motion classes `.card-lift`, `.card-press`, `.card-settle` in `app/globals.css`.
- Toolbar (`app/(app)/tickets/_components/toolbar.tsx`): "+ Add new", "Table view / Kanban board / Workload" switch, Group and Filter buttons that open the filter panel, stacked team avatars that filter by person, Recurring link.
- Quick add at the bottom of each board column (Enter creates, Esc cancels).
- Phone: column tabs with counts above the board; app-wide bottom tab bar and a round "+" button.
- Top-right account menu (name, email, status, "Login As ›" client list, My account, Sign out) replaced the sidebar view switch.

### QA fixes (done, commit after `2379c8f`)

1. Projects: project name and an "Open" button link to `/projects/KEY/tasks`; "Add new" in a project's Tasks and Notes asks for a title first (no more instant junk); project settings remount with the saved lead (likely cause of "No lead" after client-side navigation; not yet confirmed in a browser).
2. Wording "ticket" → "task" on the Recurring page and in Scheduled jobs (the "N tickets created" detail is rewritten for display only; DB text unchanged).
3. Departments board counts a task for each department of its active project plus its assignee's department (once each). Risk: unbounded query, undercounts above ~1000 open tasks.
4. Board shows "No tasks match these filters" + Clear filters when nothing matches.
5. Task pop-up hides "Reply to the client" when the task has no client. Not done on the project page task view (`app/(app)/projects/[key]/tasks/page.tsx` `<Activity>`): no client field is loaded there; pass `hasClient` once it is.

Not a bug: the browser-notifications prompt already remembers "Not now" for 14 days (localStorage). QA only saw it again because its test browser started fresh each time.

## Next: make the other tabs match the Task tab

Rules for all of it (user's standing rules):
- Keep features and behaviour the same; no pills/badges/chips, no uppercase eyebrow labels, no section labels with lines either side, no secondary text link under a main button, no small print under buttons, tight spacing.
- Use the same pieces as the Task tab: the toolbar pattern, tinted cards, avatars, days-left text, motion classes, quick add, phone tabs.
- Skills: `karpathy-guidelines`, `impeccable`, `antislop-ui`, `emil-design-eng`, `mobile-native`, `break-ui`. Use `awesome-design-md` (linear.app) for spacing and type only.
- One Opus agent per area, each owning separate files; at most 2 use the browser at once.
- Check: screenshots at 1920 and 390 for every screen, then `tsc`, lint, all tests, preview link. Production only on "push".

### 1. Departments and Services colours (do first, small)

- Migration `0230_department_service_colors.sql`: add `color text` (same `^#[0-9a-fA-F]{6}$` check) to `departments` and `services`, backfill from the same 8-colour palette in creation order.
- Add/Edit dialogs: the 8-swatch colour picker used in the project form (`app/(app)/projects/_components/projects-view.tsx`).
- Board cards tinted with `projectTint(color)`; List view shows a small colour dot before the name.
- Project form department checklist shows each department's colour dot.

### 2. Projects tab (`/projects`) to match the Task tab

- Toolbar like the Task tab: "+ Add new" (opens New project), view switch "Cards / Table", Filter button (search, Active/Archived/All, department, client, lead), stacked lead avatars that filter by lead.
- Project cards tinted with the project colour, like task cards:
  - Title first (2 lines), client below, lead avatar on the left.
  - Progress line: done vs total tasks with a thin progress bar in the existing accent colour.
  - Meta row: open, overdue (danger colour), and "next due in N days".
  - Footer: Open, Board, List, Edit. Whole card opens the project space (`.card-lift` + `.card-press`, since it becomes clickable).
- Group by department stays, but a project in several departments shows under each, or switch grouping off by default (decide with the user).
- Table view: one row per project with colour dot, key, client, lead, departments, open, overdue, done in 30 days.
- Phone: one column of cards, toolbar collapses into "+ Add new" and Filter.
- Project space (`/projects/KEY/...`): header with the project colour and name, the same toolbar on its Tasks page, Kanban cards already tinted.

### 3. Departments and Services tabs

- Same toolbar pattern: "+ Add department" / "+ Add service", view switch "Cards / Table", search.
- Cards tinted with their colour (after step 1). Department card: head avatar, member avatars stack, staff / projects / open / overdue. Service card: clients and templates counts.
- Whole card opens Edit (clickable → motion classes).

### 4. General Settings and My account

- Section cards with a coloured left accent (use the existing accent colour, not new colours), same card radius and spacing as the Task tab.
- Keep the collapsible section menu; on phones the menu stays a scrolling row.
- Rules & policies list: each rule as a soft card like task cards, pinned ones first.

### 5. Client portal dashboard

- Already has tinted task cards. Match the Task tab more closely: a small toolbar (search, filter by status), the same days-left and avatar style, and phone column tabs (Current / To-do / Processing) instead of stacked columns.

## Decisions (user, 2026-11-20)

- Projects page: a project in several departments shows under **each** of its departments (for now).
- Departments/Services: clicking the **whole card opens Edit**.
- Project cards "next due" = the **next open task's due date**. Also **add an end date to projects**: migration adding `projects.end_date date`, an "End date" field in New/Edit project and project settings, shown on the project card ("Ends in N days" / "Ended N days ago", overdue in danger colour) and in the Table view.

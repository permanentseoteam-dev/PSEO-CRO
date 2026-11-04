# Wiring: work-p2 (Tickets and Reviews Phase 2 extras)

Workload view, Recurring tab, ticket page extras (dependencies, co-assignees + watcher picker, client card, scope flag), and Quality report extras (Services tab, Most revised tab, "QA checks failed most" panel). Everything lives in `features/work-p2/`. No Phase 1 folders were touched.

## Files
| File | What |
|---|---|
| `index.ts` | Public entry points (all async server components). Import from `@/features/work-p2`. |
| `components/workload-view.tsx` + `workload-client.tsx` | Workload grid, capacity alerts (Move to / Handled / Undo), settings dialog, per-person capacity dialog. |
| `components/recurring-page.tsx` + `recurring-client.tsx` | Recurring rules table, New/Edit rule dialog, Pause/Resume, Delete, "Run due rules now" (admin). |
| `components/ticket-extras.tsx` + `ticket-extras-client.tsx` | `TicketDependencies`, `TicketPeopleFields`, `TicketClientCard`, `TicketScopeCard`. |
| `components/quality-extras.tsx` | `QualityServicesTab`, `QualityMostRevisedTab`, `FailedChecksPanel`, `QUALITY_EXTRA_TABS`. |
| `actions.ts` | Server actions (zod, `can()`, RLS write, revalidate). |
| `queries.ts` | Server reads (RLS client). Phase 1 column names are listed at the top. |
| `logic.ts` | Pure rules, tested in `__tests__/logic.test.ts`. |
| `supabase/migrations/0204_work_p2.sql` | Tables, RLS, `recurring_next_run()`, `run_recurring_rules()`, pg_cron job. |
| `supabase/seed/0204_work_p2.sql` | Permission keys and grants, settings, capacities, 7 recurring rules, CPD-142 extras. |

## 1. Tickets → Workload view (`app/(app)/tickets/page.tsx`, tickets module)
The view switch (List / Board / Calendar) gets a fourth item, `Workload`, as `?view=workload`. Remove the `PhaseTwo` marker.

```tsx
import { WorkloadView } from "@/features/work-p2";
// const sp = await searchParams;
{sp.view === "workload" && <WorkloadView week={sp.week} dept={sp.dept} basePath="/tickets?view=workload" />}
```
- `week`: any date in the week (`YYYY-MM-DD`). The default is this week. The component builds its own prev, next and "This week" links from `basePath`.
- `dept`: department id. The department select pushes `?dept=`.
- Show the `Workload` view item only when `can(me, "work.workload.view")`. The component also guards itself.
- Add a `Recurring` button next to `New ticket` that links to `/tickets/recurring`.

## 2. Tickets → Recurring (`app/(app)/tickets/recurring/page.tsx`, NEW route file, tickets module)
```tsx
import { RecurringPage } from "@/features/work-p2";
export const metadata = { title: "Recurring tickets" };
export default function Page() { return <RecurringPage />; }
```
- `RecurringPage` renders the whole page body, including `.page` and the "Tickets / Recurring" crumb.
- There is no new sidebar entry. The page is reached from the Tickets header.
- **Ticket header "Repeat…" action (Phase 1):** it should create a row in `recurring_ticket_rules` with `saveRule({ titlePattern, projectId, assigneeId, priority, frequency, weekday, monthDay, dueOffsetDays, startsOn, templateId? })` from `@/features/work-p2/actions`. If `0107_work` also created a `recurring_rules` table, it can go unused. This feature owns the rules table and the job.

## 3. Ticket page (`app/(app)/t/[key]/page.tsx`, tickets module)
Every component takes the ticket's uuid (`ticket.id`).
```tsx
import { TicketDependencies, TicketPeopleFields, TicketClientCard, TicketScopeCard } from "@/features/work-p2";
```
| Where | What |
|---|---|
| Main column, after "Subtasks", before "Review" | `<TicketDependencies ticketId={t.id} />` (card "Dependencies") |
| Main column, after "Review", before "Files" | `<TicketClientCard ticketId={t.id} />` (card "Client"). It renders nothing when the project has no client. |
| Side panel `<dl className="dl">`, replacing the Phase 1 "Co-assignees" and "Watchers" rows | `<TicketPeopleFields ticketId={t.id} />` (returns `<dt>/<dd>` pairs) |
| Side panel, below the details card | `<TicketScopeCard ticketId={t.id} />` (card "Scope"). It renders nothing when the project has no client. |

- Remove the `PhaseTwo` markers on "Dependencies" and "Client".
- Actions revalidate `/t/[key]` (page), `/my`, and `/portal/work`.
- The Phase 1 header "Watch" button keeps writing to `ticket_watchers`. The picker edits the same table.
- Optional for the board and list: a ticket with open blockers can show "Blocked". Count rows in `ticket_blockers` where `ticket_id = t.id` and the blocker's status isn't `done`. `openCount()` is in `logic.ts`.
- Optional for My work's "Everything I'm on" tab: also include tickets where I'm in `ticket_co_assignees`.

## 4. Reviews → Quality report (`app/(app)/reviews/...`, work module)
The report keeps its own range filter (`d30` | `d90` | `y`) and its tab bar.
```tsx
import { QualityServicesTab, QualityMostRevisedTab, FailedChecksPanel, QUALITY_EXTRA_TABS } from "@/features/work-p2";
// tabs: [...peopleDeptClientsItems, ...QUALITY_EXTRA_TABS] (values "svc", "most")
{tab === "svc" && <QualityServicesTab range={range} />}
{tab === "most" && <QualityMostRevisedTab range={range} />}
// in the grid-2 next to "Why work goes back":
<FailedChecksPanel range={range} />
```
- "Service" means the department of the ticket's project.
- Remove the `PhaseTwo` markers on these tabs and on the panel.

## 5. Client portal (portal module, optional)
- A client login can read `ticket_client_cards` for its own client where `show_in_portal`.
- On `/portal/work`, use `client_title` (falling back to the ticket title) and `client_details`. List only the files whose `attachments.id` is in `shared_file_ids`.
- `needs_approval = true` means the ticket should appear under "Approvals". The portal module owns the `approvals` rows. When the card is saved with `needs_approval`, create a waiting approval there. That step was not done here, because the `0114` columns are unknown.
- `saveClientCard` also sets `tickets.client_visible` so the Phase 1 portal list stays in step.

## 6. Nav
No new nav entries.
- Workload is a Tickets view.
- Recurring is `/tickets/recurring`, reached from the Tickets header.
- The rest sits inside existing pages.

## 7. Permissions (seeded in 0204)
| Key | admin | dept_head | member |
|---|---|---|---|
| `work.workload.view` | all | team | own (own row only) |
| `work.workload.manage` (capacity, handle alerts; settings need `all`) | all | team | none |
| `work.recurring.manage` (own = rules assigned to me) | all | team | own |

super_admin gets every key automatically. The other tickets extras follow ticket visibility: any staff member who can see the ticket under the 0106 tickets RLS. The scope decision buttons need `clients.view`.

## 8. Tables (0204) and Phase 1 assumptions
| Table | Notes |
|---|---|
| `member_capacity` | `weekly_hours`, `workdays smallint[]` (ISO 1–7). Defaults are 38 h, Mon–Fri. |
| `workload_settings` | Single row: `overloaded_pct` 110, `overdue_count` 2, `has_room_pct` 60, `default_estimate_min` 60. |
| `workload_alerts` | Handled alerts per member, week and kind, plus the ticket move (`moved_from`/`moved_to`) for Undo. |
| `recurring_ticket_rules`, `recurring_ticket_runs` | Rules, plus one run row per rule per date, which keeps the job idempotent. |
| `ticket_blockers` | "ticket_id is blocked by blocked_by_id". Loops are refused in the action. |
| `ticket_co_assignees` | ticket ↔ member. |
| `ticket_client_cards` | One per ticket. `client_id` is copied from the ticket's project. |
| `ticket_scope_flags` | One per ticket: `in_scope`, `out_of_scope` or `unsure`, plus the matched term and a note. |

**Cron:** the migration runs `create extension if not exists pg_cron` and `cron.schedule('work-p2-recurring-tickets', '5 0 * * *', 'select public.run_recurring_rules()')`. Where pg_cron isn't available, it skips with a notice. To check that it's scheduled: `select * from cron.job where jobname = 'work-p2-recurring-tickets';`.

**Assumed Phase 1 columns.** Check these when 0106 and 0107 land. Each one appears only in `queries.ts`, `actions.ts`, or `run_recurring_rules()` in 0204.
- `tickets`:
  - Columns: `id, key, title, description, status, priority (urgent/high/normal/low), assignee_id, reporter_id, project_id, due_date, client_visible`.
  - Optional columns: `start_date` and `estimate_min`. When missing, they read as null, so no start date and the default estimate apply.
  - `key` is set by a 0106 trigger or default when `run_recurring_rules()` inserts.
- `ticket_watchers(ticket_id, member_id)`: its RLS must let staff insert and delete other people's rows, or the watcher picker can only change the user's own row.
- `attachments(id, ticket_id, name)`.
- `projects(id, key, name, client_id, department_id)`.
- `templates(id, title or name, title_pattern?, active)`.
- `reviews(id, ticket_id, round, status waiting/approved/changes, reasons text[], created_at, submitted_at?, decided_at?)`.
- `qa_results(review_id, label or item, passed)`.
- `client_terms(client_id, in_scope, out_of_scope)`: text or text[], one item per line.
- `clients(id, name)`.

## 9. Integrations
None. Everything here runs on Supabase data, so no "Connect" state is needed.

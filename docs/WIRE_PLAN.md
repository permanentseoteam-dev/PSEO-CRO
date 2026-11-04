# Wire plan: mount Phase 2 features into Phase 1

Phase 2 lives in `features/*` and migrations/seeds `0201`–`0208`. The schema is already reconciled with the applied Phase 1 schema (see "Schema decisions" below), so wiring is UI work only. Six areas, A–F. Each file belongs to exactly one area, so the six can run in parallel. Remove each `PhaseTwo` marker as its feature is mounted.

Apply order before wiring is tested against the live DB: migrations `0201` → `0208`, then seeds `0201` → `0208`.

## Schema decisions (done at merge)

| Phase 2 concept | Now uses | Added by 02xx |
|---|---|---|
| `recurring_ticket_rules` | 0107 `recurring_rules` (`day` = weekday or day of month, `start_date`) | `description`, `priority`, `last_run` (0204). `recurring_ticket_runs` kept, FK to `recurring_rules`. |
| `ticket_co_assignees` | 0106 `tickets.co_assignee_ids` | none |
| `ticket_client_cards` | 0106 `tickets.client_visible`, `client_title` | `tickets.client_details`, `client_needs_approval`, `client_file_ids` (0204) |
| `ticket_blockers` | kept (Phase 1 has no `ticket_dependencies`) | |
| `client_agreements` | 0108 `client_terms` (`term_start`, `renewal_date`) | `auto_renews`, `agreement_path` (0203) |
| `client_activity_lines` | 0114 `shared_activity` (`action`, `happened_at`, `actor_name`) | none |
| `hr_employment` | 0113 `member_details` + 0112 `member_profiles.joined_on` | `shift_start`, `shift_end`, `probation_decided_at`; `member_details_guard()` also admits `hr.records.manage` (0207) |
| `hr_title_changes` | 0113 `career_steps` (`promoted`/`transfer`/`title_change`, `on_date`, `title`) | `old_title`, `old_department_id`, `new_department_id`, `post_congrats`, `congrats_posted_at`, `created_by` |
| `hr_pay_records` | 0111 `salaries` (`valid_from`, `monthly_amount` = gross) | `basic`, `house_rent`, `utilities`, `medical`, `other`, `reason` |
| `hr_clock_days` | 0113 `attendance` via `hr_clock_action()` | none; `hr.attendance.view` key dropped |
| `hr_kpis`, `hr_review_cycles` | 0112 `kpis`, `review_cycles` (`quarter` is the cycle name, e.g. `Q1 2027`) | `review_cycles.opened_at`, `closed_at` |
| `hr_training_*`, `hr_payslips`, `hr_tool_access`, `hr_personal_*`, `hr_exits*` | kept (no Phase 1 equivalent) | |

Other fixes: finance-p2 reads `entities.currency` and `receipts.channel_id → channels_pay(name)`; past invoices get their own insert policy (`invoices_insert_past`, needs `finance.invoices.record_past`); platform-p2 reads `leave_requests(type, start_date, end_date)` and sets `decided_by/decided_at`. Seeds point at Phase 1 ids: ended clients are 0108's `c…08`/`c…09`, recurring rules are 0107's `e0730000-…`, finance-p2 rows moved off the `f2000000` prefix (Phase 1 `channels_pay`) to `f9000000`. Every 02xx migration re-runs cleanly (`if not exists`, `drop … if exists` before triggers and policies).

Product rule: a client with invoices is archived (status `churned`/`terminated`), never hard-deleted. `ClientDeleteButton` already refuses when invoices exist, and 0110 `invoices.client_id` is `on delete restrict`.

---

## A. Client page and portfolio

Files to edit:
- `app/(app)/clients/[id]/page.tsx`: replace the phase-2 tabs and `EmptyState` with `AccountsTab`, `PerformanceTab`, `AnalysisTab`, `AdsTab`, `LeadsTab`, `WebsiteTab`, `SeoTab` (`@/features/client-data`, hide Ads via `visibleDataTabs()`), and `CommitmentsTab`, `RelationshipTab`, `ReportsTab`, `RatingsTab` (`@/features/client-success/tabs`). Each takes `{ clientId }`.
- `app/(app)/clients/[id]/_components/panels.tsx`: Overview gets `ClientTermsCard` and `ClientHealthCard` (`@/features/client-admin/sections`); Meetings tab "Fireflies calls" gets `FirefliesCallsCard clientId` (`@/features/platform-p2/components/server`); Client portal tab gets `ClientVaultCard` and `ClientActivityLinesCard`. `ClientTermsCard` replaces the Phase 1 "Terms" card and `TermsButton` in `Overview` (both edit `client_terms`), so keep only one.
- `app/(app)/clients/[id]/_components/client-actions.tsx`: header `ClientEmailButton`.
- `app/(app)/clients/_components/client-form.tsx`: edit dialog slots `ClientDeleteButton` (client-admin) and `SubAccountsSection clientId` (`@/features/finance-p2/sections`).
- `app/(app)/clients/page.tsx` and `app/(app)/clients/_components/portfolio-grid.tsx`: `EndedClientsCard` next to "By owner"; optional "Last month's reports not sent" stat (client-success queries).
- `app/(app)/clients/actions.ts`: only if the client form needs to revalidate after Phase 2 actions.
- `lib/modules/clients/queries.ts`, `lib/modules/clients/logic.ts`, `lib/modules/clients/types.ts`: no schema change needed; edit only to pass `client_terms` / health history into the cards (`ClientHealthCard` `prevHealthScore`).

## B. Tickets, reviews and work

Files to edit:
- `app/(app)/tickets/page.tsx` and `app/(app)/tickets/_components/filters.tsx`: `?view=workload` renders `WorkloadView` (`@/features/work-p2/components/workload-view`); header button "Recurring" links to `/tickets/recurring`.
- `app/(app)/tickets/recurring/page.tsx` (new): renders `RecurringPage` (`@/features/work-p2/components/recurring-page`).
- `app/(app)/t/[key]/page.tsx`: `TicketDependencies` after Subtasks, `TicketClientCard` after Review (`@/features/work-p2/components/ticket-extras`).
- `app/(app)/t/[key]/_components/side-panel.tsx`: `TicketPeopleFields` replaces the Co-assignees and Watchers rows (writes `tickets.co_assignee_ids` and `ticket_watchers`); `TicketScopeCard` below.
- `app/(app)/t/[key]/_components/header.tsx`: add a "Repeat…" action (Phase 1 has none) that calls `saveRule()` from `@/features/work-p2/actions` (writes 0107 `recurring_rules`).
- `app/(app)/reviews/page.tsx`: tabs "Services" and "Most revised" render `QualityServicesTab` / `QualityMostRevisedTab`; "QA checks failed most" card renders `FailedChecksPanel` (`@/features/work-p2/components/quality-extras`).
- `app/(app)/projects/_components/projects-view.tsx`, `app/(app)/templates/_components/templates-view.tsx`: optional "Repeat" entry points using `saveRule()`; no mount required.
- `lib/modules/tickets/queries.ts`, `lib/modules/tickets/types.ts`: add `client_details`, `client_needs_approval`, `client_file_ids` to the ticket detail select if the Phase 1 page shows them.
- `lib/modules/work/queries.ts`: none required; quality extras read 0107 tables themselves.

## C. Chat

Files to edit:
- `components/chat/chat-app.tsx`: conversation header `ChatHeaderExtras channelId` (huddle and schedule meeting, `@/features/chat-p2/components/server`); sidebar "Slack import" uses `SlackImportButton`; hide channels with `archived_at` and disable the composer in archived ones.
- `components/chat/composer.tsx`: `VoiceRecorder` next to attach (`@/features/chat-p2/components/voice-recorder`).
- `components/chat/message.tsx`: `VoiceNote file` for `audio/*` files (`@/features/chat-p2/components/voice-note`).
- `components/chat/dialogs.tsx`: settings dialog uses `ChannelSettingsExtras` for "Only admins can post" and Archive.
- `components/chat/pane.tsx`, `components/chat/context.ts`: only if archived state needs passing down.
- `app/(app)/chat/page.tsx`, `app/(app)/chat/actions.ts`: pass `channelId` and archived flag; no new route.
- `lib/modules/chat/queries.ts`, `lib/modules/chat/types.ts`, `lib/modules/chat/logic.ts`: include `archived_at` in the channel list; post the #general congratulations for `career_steps` rows with `post_congrats and congrats_posted_at is null`, then set `congrats_posted_at`.
- Push (also C): copy `features/chat-p2/sw/push-sw.js` to `public/push-sw.js`; move `features/chat-p2/edge/notify-push` to `supabase/functions/notify-push`.

## D. Finance

Files to edit:
- `app/(app)/finance/invoices/page.tsx`: header `RecordPastInvoiceSection`; tabs `?tab=drafts|upwork|exports` render `MonthlyDraftsSection`, `UpworkSection`, `ExportsSection` (`@/features/finance-p2/sections`).
- `app/(app)/finance/invoices/[id]/page.tsx`: side column `InvoicePortalSection invoiceId`.
- `app/(app)/finance/invoices/_components/invoice-list.tsx`, `invoice-actions.tsx`: show the "past" marker and balance from the Phase 2 maths below.
- `app/(app)/finance/payments/page.tsx`: header `ApplyCreditSection`; Still owed tab `ClientCreditSection`.
- `app/(app)/finance/clients/page.tsx`, `app/(app)/finance/clients/_components/billing-table.tsx`: sub-account counts from `getSubAccountCounts()` (`@/features/finance-p2/queries`).
- `app/(app)/finance/settings/page.tsx`, `app/(app)/finance/settings/_components/settings-view.tsx`: `EmailSendingSection`.
- `app/(app)/finance/reminders/actions.ts`, `app/(app)/finance/invoices/actions.ts`: send through `getEmailSender()` (`@/features/finance-p2/email`) and insert `email_log`.
- `lib/modules/finance/core/logic.ts`, `lib/modules/finance/core/queries.ts`, `lib/modules/finance/core/dashboard.ts`: invoice balance = `total − amount_paid − invoice_extras.paid_before_portal − invoice_credit_applied.amount`; monthly drafts should run Phase 1 totals (`subtotal`, `tax_total`, line `amount`) when opened in the editor.
- `lib/modules/finance/ops/logic.ts`, `lib/modules/finance/ops/queries.ts`: credit left = `client_credit − credit_movements`; "Refunded" can include `credit_movements.kind = 'given_back'`.

## E. Team, personal and time

Files to edit:
- `app/(app)/me/page.tsx`: `HrFormButtons` in the header; `PayTab`, `ToolsTab`, `PersonalTab`, `LeavingTab` replace the `pay|tools|personal|leaving` placeholders; `ProbationCard` on Job. Keep the Phase 1 `ClockCard` (it already writes `attendance`); do not also mount `ClockWidget`. Optionally port `isEarlyClockOut()` from `@/features/hr-p2/logic` into it.
- `app/(app)/me/_components/clock-card.tsx`: only for the optional early clock-out warning.
- `app/(app)/me/payslips/[id]/route.ts` (new): `payslipPdfResponse(id)` from `@/features/hr-p2/payslip-pdf`.
- `app/(app)/people/[id]/page.tsx`: same HR mounts for someone else's profile (show rules in `features/hr-p2/WIRING.md` §1).
- `app/(app)/performance/page.tsx`: `TrainingTab` and `SetupTab` (Setup writes 0112 `kpis` / `review_cycles`, so the Phase 1 scorecard picks them up).
- `app/(app)/settings/page.tsx`, `app/(app)/settings/_components/settings-view.tsx`: `ApiKeysSection` (`id="api"`), `NotificationsLogSection` (`id="nlog"`), Phone alerts with `PushToggle` (`@/features/chat-p2/components/push-toggle`) next to quiet hours.
- `app/(app)/settings/api/page.tsx` (new): `ApiDocs` (admin only).
- `app/(app)/time/page.tsx`: none required.
- `lib/modules/team/queries.ts`, `lib/modules/team/types.ts`: none required; `kpis`/`review_cycles`/`career_steps` keep their Phase 1 columns.
- `lib/modules/personal/queries.ts`, `lib/modules/personal/types.ts`: optional `shift_start`/`shift_end` on the Job tab (now on `member_details`).

## F. Home, shell, admin and portal

Files to edit:
- `app/(app)/home/page.tsx`: `HomeRolePanels me={me}` under the Phase 1 panels (`@/features/platform-p2/components/home-panels`).
- `lib/modules/home/queries.ts`: none required.
- `app/api/v1/[resource]/route.ts` (new): wraps `features/platform-p2/api/handler.ts`.
- `proxy.ts`: let `/api/v1/` through without a sign-in cookie (the handler checks the API key).
- `app/(portal)/portal/home/page.tsx`: shared activity already comes from 0114 `shared_activity` (client-admin lines now write there); "Results this month" optional.
- `app/(portal)/portal/invoices/page.tsx`, `app/(portal)/portal/invoices/_components/invoice-table.tsx`: `getPortalInvoiceExtras()` for past/original-document rows (hidden invoices are already filtered by RLS).
- `app/(portal)/portal/work/page.tsx`: show `tickets.client_details` and `client_needs_approval` on client-visible tickets.
- `lib/modules/portal/queries.ts`, `lib/modules/portal/types.ts`: select those ticket columns.
- `lib/nav.ts`: no new entries (optional portal "Leads" entry only if a leads page is added).
- `components/shell/*`, `lib/modules/shell/*`, `app/(app)/admin/**`: no mounts required.

## Not in A–F (left for a later pass)

Optional platform-p2 mounts in pages outside the six areas: `app/(app)/calendar/_components/calendar.tsx` (`CalendarSyncBar`), `app/(app)/meetings/page.tsx` (`FirefliesCallsCard`, `FirefliesCallsCard noClient`), `app/(app)/response-times/page.tsx` (`InboxCountsCard`). `app/(app)/files`, `app/(app)/my`, `lib/modules/calendar`, `lib/modules/clientops`, `lib/modules/access` need no change.

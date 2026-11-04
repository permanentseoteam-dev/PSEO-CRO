# Phase 2 wiring checklist

The Phase 2 features live in `features/*` and migrations `0201`–`0208`. None of them is mounted yet. Work through the steps below in order. Each feature's own `features/<name>/WIRING.md` holds the exact props and column lists. They are copied in full in the appendix.

## 0. Before wiring: settle Phase 1 overlaps

- [ ] Phase 1 migrations `0101`–`0114` must be applied before any `02xx` file. Order: 0201 → 0208. 0203 uses `cs_staff_can` from 0201. 0206 uses `client_sub_accounts` from 0202. 0205 needs Phase 1 `0105_chat`.
- [ ] Check the assumed Phase 1 column names against the real ones. Each feature WIRING.md lists them: client-admin §10, client-data §5, client-success §7, finance-p2 "Phase 1 columns", hr-p2 §7, platform-p2 "Assumptions", work-p2 §8. The ones that matter most:
  - `client_team(client_id, member_id)`, `clients.name/services/health_score/ended_on`
  - `tickets(assignee_id, due_date, start_date, estimate_min, client_id, project_id, tags, status)`
  - `invoices(issued_on, due_on, total, amount_paid)`, `receipts.received_on`, `client_credit`, `billing_profiles`, `entities.tax_rate`
  - `leave_requests(member_id, kind, starts_on, ends_on, status)` (set via `LEAVE_TABLE` in `features/platform-p2/types.ts`)
- [ ] Pick one owner for any duplicate concept:
  - work-p2 `recurring_ticket_rules` vs a Phase 1 `recurring_rules`
  - work-p2 `ticket_blockers` vs a Phase 1 `ticket_dependencies`
  - hr-p2 `hr_kpis`, `hr_review_cycles`, `hr_training_*`, `hr_clock_days` vs Phase 1 0112/0113
  - client-admin `client_activity_lines` vs Phase 1 0114 `shared_activity`
- [ ] Decide on client delete: currently blocked by any invoice ("End the client instead"). Check that Phase 1 FKs to `clients` cascade or set null.
- [ ] Apply migrations 0201–0208, then seeds 0201–0208.

## 1. Client page `app/(app)/clients/[id]/page.tsx`

- [ ] URL tabs in mockup order: `accounts|perf|analysis|ads|leads|web|seo` from `@/features/client-data`, and `commit|rel|reports|ratings` from `@/features/client-success/tabs`. Each takes `{ clientId }`. Remove the `PhaseTwo` markers.
- [ ] Hide Ads using `visibleDataTabs()` (client-data).
- [ ] Overview: `ClientTermsCard` and `ClientHealthCard` (client-admin). Optional: commitments vs delivery card (client-success) and the 28-day snapshot (client-data).
- [ ] Header: `ClientEmailButton` (client-admin).
- [ ] Edit dialog: `ClientDeleteButton` slot (client-admin), `SubAccountsSection clientId` slot (finance-p2).
- [ ] Client portal tab: `ClientVaultCard` and `ClientActivityLinesCard` (client-admin).
- [ ] Meetings tab: `<FirefliesCallsCard clientId={id} />` (platform-p2).

## 2. Client Portfolio `app/(app)/clients/page.tsx`

- [ ] `EndedClientsCard` next to "By owner" (client-admin).
- [ ] Optional stat: last month's reports not sent (client-success).

## 3. Tickets and reviews

- [ ] `app/(app)/tickets/page.tsx`: add `?view=workload` with `<WorkloadView week dept basePath />` and a "Recurring" header button (work-p2).
- [ ] New route `app/(app)/tickets/recurring/page.tsx` renders `<RecurringPage />`. The Phase 1 "Repeat…" action calls `saveRule()`.
- [ ] `app/(app)/t/[key]/page.tsx`: `<TicketDependencies>` after Subtasks, `<TicketClientCard>` after Review, `<TicketPeopleFields>` and `<TicketScopeCard>` in the side panel.
- [ ] Reviews: append `QUALITY_EXTRA_TABS`, render `QualityServicesTab` / `QualityMostRevisedTab`, put `<FailedChecksPanel>` beside "Why work goes back".

## 4. Chat

- [ ] Conversation header: `<ChatHeaderExtras channelId>`.
- [ ] Composer: `<VoiceRecorder>` next to attach. Message renderer: `<VoiceNote file>` for `audio/*`.
- [ ] Settings dialog: `ChannelSettingsExtras` replaces "Only admins can post" and the Archive row.
- [ ] Sidebar: `<SlackImportButton>`. Hide archived channels and disable the composer in archived ones (the database already rejects new messages).
- [ ] Push: copy `features/chat-p2/sw/push-sw.js` to `public/`, move `features/chat-p2/edge/notify-push` to `supabase/functions/notify-push`, add a Database Webhook on `notifications` inserts. Secrets: VAPID keys, `NOTIFY_PUSH_SECRET`, optional `PORTAL_TIME_ZONE`.
- [ ] hr-p2 title changes set a "post congratulations" flag. Chat makes the #general post.

## 5. Finance

- [ ] Invoices page: `<RecordPastInvoiceSection/>` in the header, tabs `?tab=drafts|upwork|exports`.
- [ ] Invoice page: `<InvoicePortalSection invoiceId/>` in the side column.
- [ ] Payments page: `<ApplyCreditSection/>` in the header, `<ClientCreditSection/>` in Still owed.
- [ ] Billing clients: `getSubAccountCounts()` line.
- [ ] Finance settings: `<EmailSendingSection/>`. Phase 1 email goes through `getEmailSender()` and writes `email_log`.
- [ ] Change Phase 1 maths: balance = total − payments − `paid_before_portal` − credit applied; credit left = `client_credit` − `credit_movements`.

## 6. People, HR and performance

- [ ] `/me` and `/people/[id]`: `HrFormButtons` in the header; `PayTab` after Job, `ToolsTab` after Documents, `PersonalTab` after Leave, `LeavingTab` last; `ProbationCard` on Job, `ClockWidget` on Attendance. Show rules: hr-p2 §1.
- [ ] New route `app/(app)/me/payslips/[id]/route.ts` calling `payslipPdfResponse(id)`.
- [ ] `/performance`: `<TrainingTab />` and `<SetupTab />`.

## 7. Home, settings, calendar, meetings, response times

- [ ] Home: `<HomeRolePanels me={me} />` under the Phase 1 panels.
- [ ] Settings: `<ApiKeysSection />` (`id="api"`), `<NotificationsLogSection />` (`id="nlog"`), Phone alerts section `id="push"` with chat-p2 `<PushToggle>`.
- [ ] New route `/settings/api` renders `ApiDocs` (admin only).
- [ ] New route `/api/v1/[resource]` using `features/platform-p2/api/handler.ts`. Let this path through `proxy.ts` without a sign-in cookie.
- [ ] Calendar: `<CalendarSyncBar />`.
- [ ] Meetings: `<FirefliesCallsCard />` in Recent calls, `<FirefliesCallsCard noClient />` in No client.
- [ ] Response times: `<InboxCountsCard />`.

## 8. Client portal (optional)

- [ ] Home: `getSharedActivityLines(clientId)` (client-admin), merged with 0114 `shared_activity` if both exist.
- [ ] Invoices: `getPortalInvoiceExtras()` (finance-p2).
- [ ] Optional: Leads page (client-data), "Rate last month" card via `saveRating` (client-success), ticket client cards (work-p2).

## 9. Not built yet (adapters return "not configured")

Email sending (client-success, client-admin, finance-p2), Google Calendar, Fireflies, Gmail inbox, AI summary/email draft, GSC/GA4/GBP/Google Ads/Meta, Slack, Web Push sender, TURN server. There are no cron jobs yet for report auto-send, monthly drafts on the 25th, future-dated title changes, the inbox poll, calendar sync or stale huddle cleanup. Recurring tickets do have a pg_cron job in 0204.

No new sidebar nav entries are needed for any feature.

---

# Appendix: feature WIRING.md files


---

<!-- features/client-success/WIRING.md -->

## Wiring: client-success (client page Phase 2 tabs)

Commitments, Relationship, Reports and Delivery ratings tabs for the client page (`/clients/[id]`, owned by the Phase 1 `clients` module). Everything lives in `features/client-success/`. Nothing in Phase 1 folders was touched.

### Files
| File | What |
|---|---|
| `tabs/index.ts` | `CommitmentsTab`, `RelationshipTab`, `ReportsTab`, `RatingsTab`: async server components, each `({ clientId })`. Each does its own `requireMe()` + `can()` guard and its own reads. |
| `components/*-view.tsx` | Client components (dialogs, sub-tabs). Only used by the tabs above. |
| `actions.ts` | `"use server"` actions. Each one revalidates `/clients/${clientId}`. `saveRating` also revalidates `/portal`. |
| `queries.ts` | Server reads (`server-only`, RLS client). |
| `logic.ts` | Pure rules (tested in `__tests__/logic.test.ts`). |
| `email.ts` | `Mailer` adapter. `getMailer()` returns the not-configured mailer for now. |
| `supabase/migrations/0201_client_success.sql` | Tables, RLS and helper functions. |
| `supabase/seed/0201_client_success.sql` | Permission key, Alba Motors sample data. |

### 1. Client page tabs (`app/(app)/clients/[id]/page.tsx`, clients module)
The client page tab bar already lists these tabs, marked phase 2 (mockup `ui-preview/screens/clients.js`, tab ids `commit`, `rel`, `reports`, `ratings`). Remove the `PhaseTwo` marker and render the right component for the tab:

```tsx
import { CommitmentsTab, RelationshipTab, ReportsTab, RatingsTab } from "@/features/client-success/tabs";

// const { id } = await params; const { tab = "overview" } = await searchParams;
{tab === "commit" && <CommitmentsTab clientId={id} />}
{tab === "rel" && <RelationshipTab clientId={id} />}
{tab === "reports" && <ReportsTab clientId={id} />}
{tab === "ratings" && <RatingsTab clientId={id} />}
```

Tab labels and order (from the mockup): `Commitments` after `Accounts & projects`, `Relationship` next, `Reports` after `Meetings & notes`, and `Delivery ratings` after `Escalations`. Tabs are URL-driven (`?tab=commit`), so use `Tabs` items with an `href`.

### 2. Overview tab: "Commitments vs delivery" card (clients module, optional)
On the Overview tab, `getCommitments(clientId)` from `@/features/client-success/queries` returns `{ commitments }`. Show the first four as Commitment, Target, Now (`latest`), and Status (`COMMITMENT_STATUS[status]` from `logic.ts`, as a `StatusDot`). Add a "Open commitments" button linking to `?tab=commit`.

### 3. Client Portfolio stat "Last month's reports not sent" (clients module, optional)
Count `monthly_reports` where `month = <first day of last month>` and `status <> 'sent'`. RLS already limits the rows to clients the user can see.

### 4. Client portal (portal module, optional)
RLS already lets a client login read:
- `commitments` where `client_visible`
- `monthly_reports` where `status = 'sent'`
- `qbrs` where `status = 'presented'`
- their own `delivery_ratings`

A client login can rate their teams with `saveRating({ clientId, month, department_id, quality, on_time, communication })`. The action sets `rated_by` to the client login. A good place for this is a "Rate last month" card on `/portal`. No portal UI is built here.

### 5. Nav
No new nav entries. Everything sits inside `/clients/[id]`.

### 6. Permissions
- Read: `clients.view`. Write: `clients.manage`.
- New key `clients.reports.approve` (approve, request changes, send) is seeded in `0201`: admin `all`, dept_head `team`. super_admin gets it automatically.
- Scoping in SQL: `public.cs_staff_can(perm, client_id)`.
  - `all` scope sees every client.
  - `own` and `team` scopes need a row in `client_team` for that client. On `team` scope, a teammate's row is enough.
- **Assumption to check when wiring:** `0108_clients` creates `client_team(client_id uuid, member_id uuid)`. `cs_staff_can` is plpgsql, so a column mismatch won't break the migration. It would error only at query time for `own`/`team` users. If the names differ, fix `cs_staff_can` in 0201. It is the only place they appear.
- Relationship tables have no client policies. Personal notes stay with the account team.

### 7. Phase 1 tables referenced
| Table | How |
|---|---|
| `clients(id, name)` | FK `client_id` on every table, `on delete cascade`; `getClientName` reads `name`. |
| `client_team(client_id, member_id)` | In `cs_staff_can` only (see the assumption above). |
| `members`, `departments` (0001) | FKs for owners and authors; `delivery_ratings.department_id` is the "team". |
| `client_contacts(id)` | `relationship_people.contact_id` is an optional uuid with no FK. Removal on request stays local. |
| `meetings(id)` (0109) | `meeting_briefs.meeting_id` is an optional uuid with no FK. A later step can add the FK and a "Brief" link from the meeting. |

### 8. Integrations
- Email is not connected. `email.ts` defines `Mailer { configured; send({to, subject, text}) }`, and `getMailer()` returns `notConfiguredMailer`.
- The UI shows "Email not connected" with a "Connect email" explainer. Approved reports get "Mark as sent" instead of "Send now", and "Ask for rating" is hidden.
- When a provider is chosen (Resend, Brevo, Mailjet or SMTP), implement `Mailer` and return it from `getMailer()`. Nothing else changes.
- Auto-send: `monthly_reports.auto_send` and `due_on` are stored. A daily job should send reports with `status = 'approved' and auto_send and due_on <= today` through `getMailer()`, then set `status = 'sent', sent_at = now()`. **Not built:** it needs the email provider and a cron route (Vercel cron or Supabase scheduled function).


---

<!-- features/client-data/WIRING.md -->

## Wiring: client-data (Phase 2 client page tabs)

Self-contained. Nothing here edits Phase 1 files. The wire-in step connects these pieces.

### 1. Database
- Migration `supabase/migrations/0202_client_data.sql`. It runs after `0108_clients` and needs `public.clients`.
- Seed `supabase/seed/0202_client_data.sql`. It adds two permission keys and sample data for Alba Motors (c02) and Cedar & Pine Dental (c01). It needs the `0108_clients` seed rows. Rows for a missing client are skipped.
- Tables:
  - `client_sub_accounts`
  - `client_data_sources`
  - `client_metric_daily`
  - `client_analyses`
  - `ad_budgets`
  - `ad_campaigns`
  - `client_leads`
  - `client_websites`
  - `seo_queries`
- Helpers:
  - `public.client_data_can_view(client_id)` and `public.client_data_can_manage(client_id)`.
  - Both are `security invoker`, so client visibility follows `0108_clients`' own RLS on `clients`.
- New permission keys:
  - `clients.data.manage` grants: admin all, dept_head team, member own.
  - `clients.leads.view` grants: client_owner and client_viewer own. Add it to the Phase 2 "leads only" portal role when the portal module creates it.

### 2. Client page tabs: `app/(app)/clients/[id]/page.tsx` (module 0108 Clients)
Each tab is an async server component that takes `{ clientId }`. Each does its own `getMe()` / `can()` guard, which shows `<NoAccess />` when it fails, and its own data reads.

```tsx
import { AccountsTab, PerformanceTab, AnalysisTab, AdsTab, LeadsTab, WebsiteTab, SeoTab, visibleDataTabs } from "@/features/client-data";
```

| Tab value (matches ui-preview `clients.js`) | Label | Component | Position in the 17-tab strip |
|---|---|---|---|
| `accounts` | Accounts & projects | `<AccountsTab clientId={id} />` | 2nd, after Overview |
| `perf` | Performance | `<PerformanceTab clientId={id} />` | 11th, after Files |
| `analysis` | Analysis | `<AnalysisTab clientId={id} />` | after Performance |
| `ads` | Ads | `<AdsTab clientId={id} />` | after Analysis, **only when** `visibleDataTabs(...)` includes it |
| `leads` | Leads | `<LeadsTab clientId={id} />` | after Ads |
| `web` | Website | `<WebsiteTab clientId={id} />` | after Leads |
| `seo` | SEO | `<SeoTab clientId={id} />` | after Website, before Client portal |

- Tabs are URL-driven (`?tab=perf`). Build the `Tabs` items with `href: /clients/${id}?tab=<value>` and switch on the value in `page.tsx`.
- Ads visibility uses `visibleDataTabs({ services: client.services, hasCampaigns })`. Ads shows when the services include "PPC". For `hasCampaigns`, a cheap check is `select id from ad_campaigns where client_id = … limit 1`; passing `false` is fine.
- The Connect action sends the user back to `/clients/${id}?tab=perf` (see `actions.ts → connectSource`).
- The actions call `revalidatePath(`/clients/${clientId}`)`. If the route differs, update `done()` in `actions.ts`.

### 3. Overview tab (optional, Phase 2 "Performance last 28 days with sparklines")
The client-success / Overview owner can reuse `snapshot28(days, asOf)` from `features/client-data/logic.ts` with `listMetricDays(clientId, asOf)` from `features/client-data/queries.ts`. Sparklines can be built from the same daily rows.

### 4. Client portal (module 0114), optional
Client logins can read `client_leads` for their own client when they have `clients.leads.view`. A portal "Leads" page could render `LeadsTable` from `features/client-data/components/leads-table.tsx` with `canManage={false}`. In that case `getMe()` is a client, so read leads with `listLeads(me.clientId)`. No new nav entry is added here. If wanted, add `{ href: "/portal/leads", label: "Leads", perm: "clients.leads.view" }` to `PORTAL_NAV` in `lib/nav.ts`.

### 5. Assumed Phase 1 columns (reads fail soft and return [] if different)
- `clients(id, name, services)`. `services` is a text array.
- `projects(id, key, name, client_id)`, used in Accounts & projects and to find website tickets.
- `tickets(key, title, status, tags, project_id, created_at)`. Website change requests are open tickets tagged `website` in the client's projects.
- `listSubAccounts` embeds `clients` through the FK name `client_sub_accounts_child_client_id_fkey`, which is the Postgres default name.

### 6. Integrations (no real API calls)
- `features/client-data/adapters.ts` defines a `DataSourceAdapter` interface with these methods:
  - `connect`
  - `fetchDaily`
  - `fetchCampaigns` (ads only)
  - `fetchQueries` (GSC only)
  - `disconnect`
- There is one entry per source: gsc, ga4, gbp, google_ads, meta_ads. Each is currently the not-configured implementation:
  - Connect and Refresh show a toast saying the source isn't set up yet.
  - Disconnect clears the row.
- When API access arrives:
  - Replace the entry in `ADAPTERS` with a real server-only implementation.
  - Store tokens in Supabase Vault, keyed by `client_data_sources.id`, never in these tables.
  - Add an OAuth callback route under `app/(auth)/auth/...` that sets `status = 'connected'`, `external_id` and `account_label`.
  - A nightly cron can call the same refresh path.

### 7. Sub-account billing (finance agent)
`client_sub_accounts.billing` is `'parent' | 'own'`. The finance module's "Sub-account linked billing" can read it to bill a sub-account under its parent.


---

<!-- features/client-admin/WIRING.md -->

## Wiring: client-admin (client page admin extras, Phase 2)

This feature adds the Terms card, the Health card (sentiment and churn alerts), the Vault, portal activity lines, win-back for ended clients, the AI email draft, and delete client. Everything lives in `features/client-admin/`. Nothing in the Phase 1 folders was touched.

### Files
| File | What |
|---|---|
| `sections.tsx` | Server entry points. Each one runs its own `requireMe()` and `can()` check, does its own reads, and renders `null` when the user has no access. |
| `components/*.tsx` | Client components: cards, dialogs, reveal timer. |
| `actions.ts` | `"use server"` actions. All return `{ ok, error }`. |
| `queries.ts` | Server reads (`server-only`, RLS client). Also exports `getSharedActivityLines` for the portal. |
| `logic.ts` | Pure rules. Tested in `__tests__/logic.test.ts`. |
| `ai.ts` | `EmailDrafter` adapter. `getEmailDrafter()` returns the not-configured drafter. |
| `supabase/migrations/0203_client_admin.sql` | Tables, RLS, vault functions, `client-agreements` bucket. |
| `supabase/seed/0203_client_admin.sql` | Permission keys and sample data (Alba Motors and others, plus 2 ended clients). |

### 1. Client page Overview tab (`app/(app)/clients/[id]/page.tsx`, clients module)
In the Overview `grid-2`, replace or add the Terms and Health cards (mockup order: Timeline, Onboarding, **Terms**, **Health**, Upcoming meetings…):
```tsx
import { ClientTermsCard, ClientHealthCard } from "@/features/client-admin/sections";
<ClientTermsCard clientId={id} />
<ClientHealthCard clientId={id} />
```
- `ClientHealthCard` shows `clients.health_score`, the sentiment line ("Sentiment: neutral, trending down") and churn alerts with an outcome select. Keep Phase 1's health ring and score breakdown. Either place them above this card or drop the Phase 1 health card and keep this one.
- The churn trigger "drop" only fires when a previous score is known. `sections.tsx` passes `prevHealthScore: null`. If Phase 1 stores health history, pass last month's score there.

### 2. Client page header actions (clients module)
Beside "Edit client" / "Log a call":
```tsx
import { ClientEmailButton } from "@/features/client-admin/sections";
<ClientEmailButton clientId={id} to={mainContact?.email} contactName={mainContact?.name} />
```
`mainContact` is the `client_contacts` row with the main-contact flag (Phase 1). Both props are optional.

### 3. Edit client dialog: delete (clients module)
The mockup puts "Delete client" at the bottom of the Edit client dialog. `ClientDeleteButton` is a server component, so render it on the page and pass it into the client dialog as a prop or slot:
```tsx
import { ClientDeleteButton } from "@/features/client-admin/sections";
<EditClientDialog deleteSlot={<ClientDeleteButton clientId={id} />} … />
```
It renders only for `clients.delete` with scope `all`. After deleting, it navigates to `/clients`.

### 4. Client page "Client portal" tab (clients module, tab `portal`)
Below the Logins and Branding cards:
```tsx
import { ClientVaultCard, ClientActivityLinesCard } from "@/features/client-admin/sections";
<ClientVaultCard clientId={id} />
<ClientActivityLinesCard clientId={id} />
```

### 5. Client Portfolio (`app/(app)/clients/page.tsx`)
Put this next to the "By owner" card, as the second column of the bottom `grid-2`:
```tsx
import { EndedClientsCard } from "@/features/client-admin/sections";
<EndedClientsCard />
```

### 6. Client portal Home (`app/(portal)/portal/page.tsx`, portal module)
For a "What's happening" list, `getSharedActivityLines(me.clientId)` from `@/features/client-admin/queries` returns the shared lines. RLS already limits a client login to `visibility = 'shared'` rows for their own client. If the portal module's `shared_activity` (0114) feeds the same list, merge both and sort by date.

### 7. Nav
No new nav entries. Everything sits inside `/clients` and `/clients/[id]`.

### 8. Permissions (seeded in 0203)
- Read: `clients.view`. Write (terms, sentiment, churn alerts, activity lines, win-back): `clients.manage`. All scoped with `public.cs_staff_can(perm, client_id)` from `0201_client_success`.
- New keys:
  - `clients.vault.view`: list logins and reveal them. Granted to admin `all`, dept_head `team`, member `own` (on the account team).
  - `clients.vault.manage`: add, edit and delete logins. Granted to admin `all`, dept_head `team`.
  - `clients.delete`: delete a client. Granted to admin `all`.
- super_admin gets all of these automatically.

### 9. How the pieces work
- **Vault:** passwords are stored only in Supabase Vault (`vault.secrets`). The table keeps the `secret_id` and nothing else about the password.
  - `client_vault_save()` adds or updates a login and writes the secret.
  - `client_vault_reveal()` checks the permission, writes a `client_vault_reveals` row, then returns the password.
  - The UI hides the password again after 30 seconds.
  - Deleting a vault item, or the whole client, also deletes the secret, through a trigger.
- **Signed agreement:** goes to the private bucket `client-agreements`, at `<client_id>/<timestamp>-<file>` (PDF or image, 15 MB max).
  - The browser uploads the file, then `setAgreementFile` saves its path.
  - The card links to a signed URL that lasts 10 minutes.
- **Hours bar:** compares hours used against `hours_per_month`. 80% shows warn and 100% shows danger.
- **Renewal:** uses `renewal_on` when set, otherwise `start_date + term_months`. The renewal reminder is 2 months before the renewal date.
- **Delete client:**
  1. `checkDeleteClient` counts the client's tickets, files, portal logins and invoices, using the service client after the `clients.delete` `all` check.
  2. If any invoices exist, the delete is blocked with "End the client instead".
  3. The typed name must match exactly. Case counts; outer and doubled spaces are ignored.
  4. The client row is deleted, and child rows go with it through cascades.
  5. Files in the agreement bucket are removed, and a row is written to `client_deletions`.
- **AI email draft:** the user picks a tone (Friendly, Formal or Brief) and gives a subject and the points to cover.
  - `buildEmailPrompt` turns these into the prompt, then `getEmailDrafter().draft()` runs it.
  - When the drafter is not configured, the dialog shows "AI drafting isn't connected yet" and the person writes the email by hand. "Copy email" copies it.
  - Sending needs an email provider. There is no send action yet.

### 10. Phase 1 tables and columns this assumes (check when wiring)
| Used in | Table.column | If different |
|---|---|---|
| Everywhere | `clients(id, name, status, health_score)`; ended = `status in ('churned','terminated')` | Edit `queries.ts` `getClientBasics` / `listEndedClients` |
| Win-back line | `clients.ended_on`, `clients.end_reason` (read with `select *`; `end_date` also accepted). Missing columns just show "Ended". | Edit `listEndedClients` |
| RLS scoping | `client_team(client_id, member_id)` via `cs_staff_can` (0201) | Fix `cs_staff_can` in 0201 |
| Hours bar | `time_entries(minutes, date, ticket_id → tickets.client_id)`. Errors show "Budget N" without a bar. | Edit `getHoursThisMonth` |
| Delete history | `tickets.client_id`, `client_files.client_id`, `members.client_id`, `invoices.client_id`. Any error stops the delete with "Couldn't check this client's history". | Edit `history()` in `actions.ts` |
| Delete cascade | FKs to `clients` that point to `clients` need `on delete cascade` (or `set null`), or the delete fails with an FK error. That error is shown to the user. | 0108 and the other modules decide |
| Seed | `clients(id, name, status)` is enough to add the two ended sample clients. If 0108 needs more columns, the insert is skipped with a notice. | — |


---

<!-- features/work-p2/WIRING.md -->

## Wiring: work-p2 (Tickets and Reviews Phase 2 extras)

Workload view, Recurring tab, ticket page extras (dependencies, co-assignees + watcher picker, client card, scope flag), and Quality report extras (Services tab, Most revised tab, "QA checks failed most" panel). Everything lives in `features/work-p2/`. No Phase 1 folders were touched.

### Files
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

### 1. Tickets → Workload view (`app/(app)/tickets/page.tsx`, tickets module)
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

### 2. Tickets → Recurring (`app/(app)/tickets/recurring/page.tsx`, NEW route file, tickets module)
```tsx
import { RecurringPage } from "@/features/work-p2";
export const metadata = { title: "Recurring tickets" };
export default function Page() { return <RecurringPage />; }
```
- `RecurringPage` renders the whole page body, including `.page` and the "Tickets / Recurring" crumb.
- There is no new sidebar entry. The page is reached from the Tickets header.
- **Ticket header "Repeat…" action (Phase 1):** it should create a row in `recurring_ticket_rules` with `saveRule({ titlePattern, projectId, assigneeId, priority, frequency, weekday, monthDay, dueOffsetDays, startsOn, templateId? })` from `@/features/work-p2/actions`. If `0107_work` also created a `recurring_rules` table, it can go unused. This feature owns the rules table and the job.

### 3. Ticket page (`app/(app)/t/[key]/page.tsx`, tickets module)
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

### 4. Reviews → Quality report (`app/(app)/reviews/...`, work module)
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

### 5. Client portal (portal module, optional)
- A client login can read `ticket_client_cards` for its own client where `show_in_portal`.
- On `/portal/work`, use `client_title` (falling back to the ticket title) and `client_details`. List only the files whose `attachments.id` is in `shared_file_ids`.
- `needs_approval = true` means the ticket should appear under "Approvals". The portal module owns the `approvals` rows. When the card is saved with `needs_approval`, create a waiting approval there. That step was not done here, because the `0114` columns are unknown.
- `saveClientCard` also sets `tickets.client_visible` so the Phase 1 portal list stays in step.

### 6. Nav
No new nav entries.
- Workload is a Tickets view.
- Recurring is `/tickets/recurring`, reached from the Tickets header.
- The rest sits inside existing pages.

### 7. Permissions (seeded in 0204)
| Key | admin | dept_head | member |
|---|---|---|---|
| `work.workload.view` | all | team | own (own row only) |
| `work.workload.manage` (capacity, handle alerts; settings need `all`) | all | team | none |
| `work.recurring.manage` (own = rules assigned to me) | all | team | own |

super_admin gets every key automatically. The other tickets extras follow ticket visibility: any staff member who can see the ticket under the 0106 tickets RLS. The scope decision buttons need `clients.view`.

### 8. Tables (0204) and Phase 1 assumptions
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

### 9. Integrations
None. Everything here runs on Supabase data, so no "Connect" state is needed.


---

<!-- features/chat-p2/WIRING.md -->

## chat-p2 wiring

Phase 2 chat extras: voice notes, huddles, schedule meeting from a channel, channel settings (admins-only, archive), Slack import and bridge, Web Push. Everything lives in `features/chat-p2/`. Nothing here is mounted yet. These steps connect it to the Phase 1 chat module (`app/(app)/chat`, `components/chat`, `0105_chat`).

### Database
- Migration `supabase/migrations/0205_chat_p2.sql` runs after `0105_chat`. It needs these from 0105:
  - tables `channels` and `messages`
  - functions `is_chat_member`, `is_chat_member_path` and `can_post_chat`
  - Storage bucket `chat-files`
- New tables:
  - `huddles`
  - `huddle_participants`
  - `push_subscriptions`
  - `slack_workspaces`
  - `slack_channel_links`
  - `slack_import_jobs`
- Also adds:
  - the helper `can_see_huddle(uuid)`
  - the trigger `messages_block_archived`, which blocks new messages in archived conversations
  - two RLS policies on `realtime.messages` that admit conversation members to private topics `huddle:<channel_id>`
- None of these tables join the realtime publication. Huddle signalling uses Broadcast and Presence only.
- Seed `supabase/seed/0205_chat_p2.sql` adds:
  - the permission `chat.slack.manage`, granted to `admin` at scope `all`
  - one finished huddle in `seo-team`
  - the Slack workspace `brandsurge.slack.com` (not connected) with 4 channel links

### Conversation header (`app/(app)/chat`, Phase 1 conversation header)
- `import { ChatHeaderExtras } from "@/features/chat-p2/components/server";`
- Render `<ChatHeaderExtras channelId={id} />` in the header actions, in place of the mockup's "Huddle (phase 2)" button and the calendar icon. It is a server component. It shows:
  - **Huddle**: "Huddle" opens a choice of audio or video. When a huddle is live it shows "Join huddle N" instead. The call panel is fixed at the bottom right and fits a 390px screen.
  - **Schedule meeting**: a calendar icon that opens a dialog. It inserts into `events` and `event_attendees` (0104) and posts a note in the conversation. It shows only for staff with `calendar.use`.
- If the header is a client component, render `ChatHeaderExtras` in the server page and pass it in as a `ReactNode` prop or slot.

### Composer (Phase 1 composer, mockup mic button)
- `import { VoiceRecorder } from "@/features/chat-p2/components/voice-recorder";` and render `<VoiceRecorder channelId={id} disabled={!canPost} />` next to the attach button.
- It records up to 5 minutes, uploads to `chat-files/<channel_id>/<uuid>-voice-note.<ext>`, then calls `sendVoiceNote`, which inserts a `messages` row with `files[0] = {path, name, mime, size, duration, peaks}` and `client_key` = the uuid. The realtime echo then shows it like any other message.

### Message attachments (Phase 1 message renderer)
- `import { VoiceNote } from "@/features/chat-p2/components/voice-note";`
- For a `files` item where `mime` starts with `audio/`, render `<VoiceNote file={f} />` instead of the plain file row. Items without `duration` or `peaks` (ordinary uploaded audio) still play.

### Conversation settings dialog (Phase 1, mockup "chat-settings")
- `import { ChannelSettingsExtras } from "@/features/chat-p2/components/server";` (server). Or, from a client dialog, use `ChannelSettingsP2` from `components/channel-settings.tsx` with `channel` and `isAdmin` from `getChannelExtras(channelId)` in `features/chat-p2/queries.ts`.
- It replaces the dialog's "Only admins can post" checkbox and the "Archive this conversation" row. Both save at once and only admins see them.
- The Phase 1 sidebar should hide channels with `archived_at` set. History stays in search.
- The composer should be disabled when `archived_at` is set, because the database now rejects those inserts.

### Chat sidebar (mockup "Slack import" button)
- `import { SlackImportButton } from "@/features/chat-p2/components/server";` and render `<SlackImportButton />` in the sidebar footer or toolbar. It renders nothing unless the user has `chat.slack.manage` at scope `all`.
- The adapter is `features/chat-p2/adapters.ts` (`SlackAdapter`, `notConfiguredSlack`):
  - "Connect Slack" returns a "not set up" message.
  - "Start import" records a `slack_import_jobs` row with status `not_configured`.
  - To go live, implement `SlackAdapter` and return it from `getSlackAdapter()`.

### Web Push
1. Copy `features/chat-p2/sw/push-sw.js` to `public/push-sw.js`. Keep the same name, because `PUSH_SW_URL` is `/push-sw.js`.
2. Settings: render `<PushToggle />` from `features/chat-p2/components/push-toggle.tsx` in Settings → Notifications, next to the Phase 1 quiet-hours fields (`user_settings.quiet_from` and `quiet_to`). Optionally also use it for the Home "push-notification nudge".
3. Edge Function: move `features/chat-p2/edge/notify-push/index.ts` to `supabase/functions/notify-push/index.ts`. Then add a Database Webhook (Supabase dashboard → Database → Webhooks) on INSERT into `public.notifications` → `notify-push`, with header `x-webhook-secret: <NOTIFY_PUSH_SECRET>`.
4. Settings it needs before anything is sent. Until then the toggle shows "Browser notifications aren't set up yet" and the function answers `push not configured`:
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` for the app
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `NOTIFY_PUSH_SECRET` as function secrets
   - optionally `PORTAL_TIME_ZONE` (default `Asia/Dubai`)
   - a real `PushSender`

### Client portal
- `/portal/messages` can reuse `ChatHeaderExtras` for huddles, which works for client logins in their own client channel. It can also reuse `VoiceRecorder` and `VoiceNote`. Schedule meeting, settings and Slack hide themselves for client logins.

### Nav
- No new routes or nav entries. Everything mounts inside `/chat`, `/portal/messages` and `/settings`.


---

<!-- features/finance-p2/WIRING.md -->

## Wiring: finance-p2 (Finance extras, Phase 2)

Monthly drafts, Record past invoice, original document upload, invoice visibility in the client portal, apply client credit and give it back, Upwork earnings, Exports (CSV), sub-account linked billing, the Email sending card and the email provider adapter. Everything lives in `features/finance-p2/`. No Phase 1 folders were touched.

### Files
| File | What |
|---|---|
| `sections.tsx` | Server entry points. Each runs its own `requireMe()` + `can()` check and reads, and renders `null` without access. |
| `components/*.tsx` | Client components: drafts table, past-invoice dialog, portal card, credit card and dialogs, Upwork panel, exports form, sub-accounts field, email card. |
| `actions.ts` | `"use server"` actions, all return `{ ok, error }`. |
| `queries.ts` | Server reads (`server-only`, RLS client). Also exports `getPortalInvoiceExtras`, `getSubAccountCounts`, `loadInvoices`. |
| `logic.ts` | Pure rules (drafts, balances, credit, aging, CSV, sub-link rules, email status). Tested in `__tests__/logic.test.ts`. |
| `email.ts` | `EmailSender` adapter: `send(to, subject, html, attachments)`; `getEmailSender("resend" \| "brevo" \| "smtp" \| "none")` returns the not-configured sender. |
| `supabase/migrations/0206_finance_p2.sql` | Tables, RLS, view `invoice_credit_applied`, restrictive portal policy on `invoices`, bucket `invoice-originals`. |
| `supabase/seed/0206_finance_p2.sql` | Email settings + log, Upwork rows, export log, one past invoice, Alba Motors sub-accounts. |

### 1. Invoices page (`app/(app)/finance/invoices/page.tsx`, finance-core)
Header, beside "New invoice":
```tsx
import { RecordPastInvoiceSection } from "@/features/finance-p2/sections";
<RecordPastInvoiceSection />
```
Tabs (mockup: All invoices, Monthly drafts, Upwork earnings, Exports). URL-driven, `?tab=drafts|upwork|exports`:
```tsx
import { MonthlyDraftsSection, UpworkSection, ExportsSection } from "@/features/finance-p2/sections";
<Tabs value={tab} items={[
  { value: "all", label: "All invoices", href: "/finance/invoices" },
  { value: "drafts", label: "Monthly drafts", href: "/finance/invoices?tab=drafts" },
  { value: "upwork", label: "Upwork earnings", href: "/finance/invoices?tab=upwork" },
  { value: "exports", label: "Exports", href: "/finance/invoices?tab=exports" },
]} />
{tab === "drafts" && <MonthlyDraftsSection />}
{tab === "upwork" && <UpworkSection />}
{tab === "exports" && <ExportsSection />}
```
Drop the `<PhaseTwo />` markers once these are mounted.

### 2. Invoice page (`app/(app)/finance/invoices/[id]/page.tsx`, finance-core)
In the side column:
```tsx
import { InvoicePortalSection } from "@/features/finance-p2/sections";
<InvoicePortalSection invoiceId={id} />
```
Shows the "Show in client portal" toggle, the "recorded after the fact" note for past invoices and the original document upload/link.

### 3. Payments page (`app/(app)/finance/payments/page.tsx`, finance-ops)
Header, beside "Record payment": `<ApplyCreditSection />`.
Still owed tab, below "By client": `<ClientCreditSection />` (replaces any Phase 1 placeholder "Client credit" card; it lists credit per client with Apply credit / Give back and a "Credit used" log).

### 4. Billing clients (`app/(app)/finance/clients/page.tsx`, finance-ops)
- Client cell: `const subCounts = await getSubAccountCounts()` (from `queries.ts`), then `{subCounts[c.id] ? <div className="small muted">{subCounts[c.id]} sub-accounts billed here</div> : null}`.
- Edit billing dialog, last field: `<SubAccountsSection clientId={id} />`. It is a server component: render it in the page and pass it into the client dialog as a slot prop (e.g. `subAccountsSlot`).

### 5. Finance settings (`app/(app)/finance/settings/page.tsx`, finance-ops)
In the right column after FX rates: `<EmailSendingSection />`.
Phase 1 email sending (invoice/reminder/receipt modals, the daily reminder job) should call `getEmailSender(settings.provider).send(...)` from `email.ts` and insert an `email_log` row (`kind`, `to_email`, `subject`, `provider`, `status`, `error`, `invoice_id`, `created_by`) so the card's 30-day counts are real.

### 6. Client portal invoices (`app/(portal)/portal/invoices/page.tsx`, portal)
RLS already hides invoices marked hidden (restrictive policy `invoices_portal_visibility`). To also drop drafts/voids and add original-document links:
```tsx
import { getPortalInvoiceExtras } from "@/features/finance-p2/queries";
const { visibleIds, docs } = await getPortalInvoiceExtras(invoices.map((i) => ({ id: i.id, status: i.status })));
const shown = invoices.filter((i) => visibleIds.includes(i.id));
// per row: docs.get(i.id) -> signed URL for "Original document"
```

### 7. Finance maths in Phase 1 (finance-core / finance-ops)
These must be folded in, or balances will disagree:
- **Invoice balance** = `total - paid (receipt allocations) - invoice_extras.paid_before_portal - invoice_credit_applied.amount`. `logic.ts → invoiceBalance` shows the formula.
- **Credit left** per client and currency = `sum(client_credit.amount) - sum(credit_movements.amount)` (both kinds). `logic.ts → creditBalances`.
- Dashboard "Refunded" can include `credit_movements` where `kind = 'given_back'`.

### Phase 1 columns this feature assumes
Change the column names in `queries.ts` / `actions.ts` / the seed if 0108/0110/0111 differ:
- `clients(id, name, status)`
- `entities(id, name, tax_rate, default_currency, invoice_prefix)`
- `billing_profiles(client_id, entity_id, currency, agreed_fee, fee_basis 'monthly'|'weekly'|'hourly'|'one_time', terms_days)`
- `invoices(id, number, client_id, entity_id, currency, status, title, issued_on, due_on, total, amount_paid)`; status values `draft, issued, partly_paid, paid, void, refunded, partly_refunded, written_off, disputed`. Drafts are inserted with `number = null`.
- `invoice_lines(invoice_id, position, description, qty, rate, tax_pct)`
- `client_credit(client_id, amount, currency)` (credit in)
- `receipts(received_on, client_id, amount, fee, landed_amount, currency, channel, reference)`
- `client_sub_accounts` from 0202_client_data (`billing = 'parent'` means billed under the parent).

### Permissions
No new keys. Uses 0001_core keys: `finance.invoices.view/create/send/void/record_past`, `finance.drafts.create`, `finance.payments.view/record`, `finance.settings.manage`, `clients.billing.view/edit`. Upwork: view with `finance.payments.view`, write with `finance.payments.record`.

### Nav
No new nav entries: everything mounts inside existing Finance pages.


---

<!-- features/hr-p2/WIRING.md -->

## Wiring: hr-p2 (profile, HR and performance extras)

This folder holds the Pay, Tools, Personal and Leaving profile tabs, the HR forms (HR details, probation, title change), the clock widget with its early clock-out warning, and the Performance Training and Setup tabs. Everything lives in `features/hr-p2/`. No Phase 1 folders were touched.

### Files
| File | What |
|---|---|
| `index.ts` | Public entry points. All are async server components. Import them from `@/features/hr-p2`. |
| `components/pay-tab.tsx`, `pay-client.tsx` | The Pay tab: Salary card, "Split a gross" helper, Pay history, Payslips. HR can also use "Change pay" and "Add payslip". |
| `components/tools-tab.tsx`, `tools-client.tsx` | The Tools tab: Tool access table, with Grant access and Revoke. There is no password field anywhere. |
| `components/personal-tab.tsx`, `personal-client.tsx` | The Personal tab: masked ID, tax number and IBAN. **Show** reveals them for 30 s. Edit is allowed. The Change log records fields only, never values. |
| `components/leaving-tab.tsx`, `leaving-client.tsx` | The Leaving tab: exit details (last day, reason, notes), a 7-item offboarding checklist, and "They're staying" (cancel). |
| `components/hr-forms.tsx`, `hr-forms-client.tsx` | `HrFormButtons` adds the "Edit HR details" and "Title change" dialogs. `ProbationCard` offers Confirm, Extend +30/60/90 and End. |
| `components/clock-widget.tsx`, `clock-client.tsx` | `ClockWidget` is the "Today" card: Clock in, Start/End break, Clock out. It warns when someone clocks out before their shift ends. |
| `components/training-tab.tsx`, `training-client.tsx` | The Performance → Training tab: assigned paths, each step with Done, Next or Not started, plus a tick box. |
| `components/setup-tab.tsx`, `setup-client.tsx` | The Performance → Setup tab: KPIs (source, weight, direction, applies to, a weight check), Training paths (new and assign), and Review cycles (new, close and reopen). |
| `payslip-pdf.tsx` | `payslipPdfResponse(id)`, the body of the payslip PDF route handler. |
| `actions.ts` | Server actions: zod, then `can()`, then the RLS write, then revalidate. |
| `queries.ts` | Server reads, using the RLS client. |
| `logic.ts` | Pure rules, tested in `__tests__/logic.test.ts`. |
| `types.ts`, `hr.module.css` | Row types, plus the `dl`, step-list and clock styles. All colours come from variables. |
| `supabase/migrations/0207_hr_p2.sql` | 16 tables, RLS, `hr_can()`, `hr_clock_action()`, and the personal change-log trigger. |
| `supabase/seed/0207_hr_p2.sql` | Six permission keys with their grants, plus Sara Malik's mockup data, KPIs, cycles, paths and today's clock rows. |

Each tab component takes `memberId`, the person whose profile is open, and does its own access check. Without access it renders `<NoAccess />`, or nothing for header buttons and cards. The pages only need to mount them.

### 1. My profile (`app/(app)/me/page.tsx`, personal module) and someone else's profile (`app/(app)/people/[id]/page.tsx`, team module, if it exists)
Use `const id = me.id` on `/me`, or `(await params).id` on `/people/[id]`.

```tsx
import { PayTab, ToolsTab, PersonalTab, LeavingTab, HrFormButtons, ProbationCard, ClockWidget } from "@/features/hr-p2";
import { can } from "@/lib/auth/can";
```

| Where | Mount | Notes |
|---|---|---|
| Profile header `.acts`, after "Edit my details" | `<HrFormButtons memberId={id} />` | Adds two buttons. Renders nothing unless the viewer has `hr.records.manage` = all. Remove the `PhaseTwo` markers. |
| Tabs: add `Pay` after `Job` | `{tab === "pay" && <PayTab memberId={id} payslipBase="/me/payslips" />}` | Show the tab when `id === me.id \|\| can(me, "hr.pay.view", "team")`. |
| Tabs: add `Tools` after `Documents` | `<ToolsTab memberId={id} />` | Show when `id === me.id \|\| can(me, "hr.records.manage", "team")`. |
| Tabs: add `Personal` after `Leave` | `<PersonalTab memberId={id} />` | Show when `id === me.id \|\| can(me, "hr.personal.view", "team")`. |
| Tabs: add `Leaving` last | `<LeavingTab memberId={id} />` | HR only: show when `id !== me.id && can(me, "hr.records.manage", "team")`. |
| Job tab, replacing the Phase 1 probation card (if any) | `<ProbationCard memberId={id} />` | Renders nothing when the viewer can't read `hr_employment`. |
| Attendance tab, top, replacing the Phase 1 "Today" card | `<ClockWidget />` (own profile only, `id === me.id`) | It always acts for the signed-in person. |

Tabs are URL-driven (`?tab=pay`), the same as the other profile tabs. The tab strip already scrolls sideways at 390px.

### 2. Payslip PDF route (NEW file, personal module)
`app/(app)/me/payslips/[id]/route.ts`:
```ts
import { payslipPdfResponse } from "@/features/hr-p2/payslip-pdf";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  return payslipPdfResponse((await params).id);
}
```
The same route serves HR viewing someone else's payslips, because RLS plus `hr.pay.view` decide access. If you mount it elsewhere, pass that path as `payslipBase`.

### 3. Performance (`app/(app)/performance/page.tsx`, team module)
```tsx
import { TrainingTab, SetupTab } from "@/features/hr-p2";
{tab === "training" && <TrainingTab />}
{tab === "setup" && <SetupTab />}
```
- Show the `Setup` tab only when `can(me, "perf.setup.manage", "team")`. Team scope can only assign training. All scope can also edit KPIs, paths and cycles.
- `TrainingTab` takes an optional `memberId`, so a manager can see one person's paths (`/people/[id]?tab=perf`).
- Remove the `PhaseTwo` markers on Training and Setup.
- The "Training" column in the Team table can use `listMemberPaths(id)` with `pathProgress()` from `logic.ts` to show "2 of 3 paths".
- `/me/performance` (separate page, PLAN Phase 2) can render the same My growth content plus `<TrainingTab />`.

### 4. Optional extra mounts
- **Home or Time:** `<ClockWidget />` can also sit on Home ("HR today") or above Time → My week.
- **Directory "clocked in" count:** `select count(*) from hr_clock_days where work_date = <today Dubai> and clock_out_at is null`. RLS shows other people's rows only with `hr.attendance.view`. For a company-wide count, use `createAdminClient` after a `can()` check.
- **Attendance month view (0113_personal):** if Phase 1's `attendance` table is separate, read `hr_clock_days` for the month instead, or have 0113 point at it. `workedMinutes()`, `localHm()` and `isEarlyClockOut()` live in `logic.ts`.

### 5. Chat: title-change congratulations (chat module)
`saveTitleChange` stores `post_congrats = true` and leaves `congrats_posted_at` null. The chat wire-in should post "Congratulations to {name}, now {new_title}!" in #general for those rows, then set `congrats_posted_at = now()`. It can do this in the same action, after the insert, through its own `postSystemMessage()`, or as a small job.

### 6. Nav and permissions
- There are no new sidebar entries. Everything sits inside the existing `/me`, `/people` and `/performance` routes.
- New permission keys, added by `seed/0207_hr_p2.sql`:

| Key | Grants |
|---|---|
| `hr.records.manage` | admin all |
| `hr.pay.view` | admin all, finance_head all |
| `hr.pay.manage` | admin all, finance_head all |
| `hr.personal.view` | admin all, finance_head all |
| `hr.attendance.view` | admin all, dept_head team |
| `perf.setup.manage` | admin all, dept_head team |

- A person always sees their own pay, payslips, tools, personal details, clock days and training. No grant is needed.
- Client logins get nothing from these tables. Every policy requires `is_staff()`.

### 7. Phase 1 overlap (read before applying migrations)
Every table uses the `hr_` prefix, so nothing collides with 0112_team or 0113_personal. Where Phase 1 built something similar, keep one source of truth:
- **KPIs and review cycles:** if `0112_team` already has `kpis` and `review_cycles`, the Setup tab still writes to `hr_kpis` and `hr_review_cycles`. Point the scorecard and self-review at these, or drop the 0112 versions. The lead decides.
- **Training:** if `0112_team` has a `training` table, `hr_training_*` replaces it.
- **Attendance:** see section 4.


---

<!-- features/platform-p2/WIRING.md -->

## platform-p2 wiring

Phase 2 platform extras: Home role panels, Settings admin extras (API keys, API docs, notifications log), and the Google Calendar, Fireflies, AI summary and Gmail inbox adapters. Everything lives in `features/platform-p2/`, and nothing is mounted yet. Every integration adapter is the "not configured" one, so the buttons work but only log a run and show a "not set up yet" message.

### Database
- Migration `supabase/migrations/0208_platform_p2.sql` needs these to exist first:
  - `0001_core`
  - `0101_shell` for `notifications`
  - `0106_tickets` for `tickets`
  - `0108_clients` for `clients`
- New tables:
  - `announcements`
  - `onboarding_steps`
  - `pipeline_deals`
  - `api_keys`
  - `notification_deliveries`
  - `integration_connections`
  - `integration_runs`
  - `fireflies_calls`
  - `inbox_messages`
- New helper: `announcement_my_department()`, which is security definer.
- No realtime.
- `notification_deliveries`, `fireflies_calls` and `inbox_messages` have no insert policy, because the service role (Edge Functions and jobs) writes them.
- `fireflies_calls.meeting_id` has no FK, so it can point at the Phase 1 meeting-notes row (0109).
- Seed `supabase/seed/0208_platform_p2.sql`:
  - New permission `home.announcements.post`. `admin` gets `all`; `dept_head` and `finance_head` get `own`, which lets them post to their own department.
  - Sample rows for every table. Ids are `e8000000-…`.
  - The API keys are fake hashes, so no seeded key works.
- API keys and the workspace integrations use the existing `admin.access.manage` at scope `all`.

### Home (`app/(app)/home/page.tsx`)
- `import { HomeRolePanels } from "@/features/platform-p2/components/server";`
- Render `<HomeRolePanels me={me} />` below the Phase 1 "My clients" table. It is a server component that renders:
  - the push nudge
  - a `grid-2` of these panels:

| Panel | Who sees it | Data |
|---|---|---|
| CEO pulse | `leadership.pulse.view` | `invoices` (`issued_on`, `total`, `currency`, `status`), `clients` (`status`, `created_at`, `health_score`, `health_band`), `time_entries`, `members` |
| HR today | `hr.directory.view` team+. Approve and Decline need `time.approve` team+. | `leave_requests`. See "Assumptions". |
| Finance & accounts | `finance.invoices.view` team+ | `invoices` (`total`, `amount_paid`, `due_on`, `status`), `receipts` (`received_on`, `amount`, `currency`) |
| My pipeline | anyone who owns deals in `pipeline_deals` | `pipeline_deals` |
| Overdue by person | `work.projects.manage` team+ | `tickets` |
| Announcements | all staff. Post, pin and delete need `home.announcements.post`. | `announcements` |
| Getting started | all staff. Hidden once all 6 steps are ticked. | `onboarding_steps` |

- Remove the mockup's static "Role panels (phase 2)" block and the nudge card from the Phase 1 Home if they were copied.
- Push nudge (`PushNudge`, also exported on its own):
  - It shows only while browser permission is still "default", and hides for 14 days after "Not now".
  - Its button goes to `/settings#push`. That is where chat-p2's `<PushToggle />` does the real subscribe, so give the Settings "Phone alerts" section `id="push"`.

### Settings (`app/(app)/settings/page.tsx`, admin area)
- `import { ApiKeysSection, NotificationsLogSection } from "@/features/platform-p2/components/server";`
- `<ApiKeysSection />` is the card with `id="api"`. It renders nothing unless the user has `admin.access.manage` at `all`.
  - "Create key" shows the full key once, with a copy button.
  - Only the SHA-256 hash and the `pk_xxxxxx` prefix are stored.
  - Create and revoke write `audit_log` (0102), on a best-effort basis.
- `<NotificationsLogSection />` is the card with `id="nlog"`. Admins see every delivery; other people see their own (RLS).
- Add both to the scroll-spy section list: "API keys" → `api` and "Notifications log" → `nlog`.

### API docs page (new route)
- Create `app/(app)/settings/api/page.tsx` with this content:
  ```tsx
  import { ApiDocs } from "@/features/platform-p2/components/server";
  import { requireMe, can } from "@/lib/auth/can";
  import { NoAccess } from "@/components/ui";
  export const metadata = { title: "API docs" };
  export default async function Page() {
    const me = await requireMe();
    if (!can(me, "admin.access.manage", "all")) return <NoAccess />;
    return <ApiDocs />;
  }
  ```
- `ApiKeysCard` links to it with `docsHref="/settings/api"`, which is the default.

### API endpoints (new route)
- Create `app/api/v1/[resource]/route.ts` with this content:
  ```ts
  import { handleApiGet } from "@/features/platform-p2/api/handler";
  export async function GET(req: Request, { params }: { params: Promise<{ resource: string }> }) {
    return handleApiGet(req, (await params).resource);
  }
  ```
- `lib/supabase/proxy.ts` must let `/api/v1/*` through without a session cookie. The handler checks the Bearer key itself.
- Resources:

| Resource | Scope |
|---|---|
| `tickets` | `tickets.view` |
| `clients` | `clients.view` |
| `time-entries` | `time.view` |
| `invoices` | `finance.invoices.view` |

- The handler uses the admin client only after the key and scope check, and returns fixed column lists only.

### Calendar (`app/(app)/calendar`)
- `import { CalendarSyncBar } from "@/features/platform-p2/components/server";`
- Render `<CalendarSyncBar />` in the row under the toolbar, left of the legend, in place of the mockup's "Google Calendar sync · last synced … · Sync now".
- It shows "Connect Google Calendar" until a connection row is `connected`. After that it shows "Last synced …" and "Sync now".
- Adapter: `getGoogleCalendarAdapter()` in `adapters.ts`, with `connectUrl`, `pullChanges`, `pushEvent` and `freeBusy`.

### Meetings (`app/(app)/meetings`) and client page Meetings tab
- `import { FirefliesCallsCard } from "@/features/platform-p2/components/server";`
- Meetings page:
  - Replace the "Import from Fireflies" header button with `<FirefliesCallsCard />` in the "Recent calls" tab, since the card has the Import button.
  - In the "No client" tab, use `<FirefliesCallsCard noClient />`, which adds a client picker on each call.
- Client page Meetings & notes tab: `<FirefliesCallsCard clientId={id} />`.
- The card has "Read now" or "Read again" for the AI summary, which runs through `getSummaryAdapter()`.
- Matching on import uses `matchCall()` from `logic.ts`: email first, then domain, then title. Our own and free-mail domains are ignored.
- Adapters: `getFirefliesAdapter()` and `getSummaryAdapter()`.

### Response times (`app/(app)/response-times`)
- `import { InboxCountsCard } from "@/features/platform-p2/components/server";`
- Render `<InboxCountsCard />` below the tabs, where the mockup's "Client email inboxes" card is. `days` defaults to 7.
- It shows the counts for New tickets, Added to tickets, Not from a client, Automatic and From us, plus a "Check now" button.
- Adapter: `getGmailInboxAdapter()`, with a 10-minute poll once it is configured.

### Going live with an integration
1. Implement the interface in `adapters.ts` and return it from its `get…Adapter()`. Keep tokens in Supabase Vault or env, never in these tables.
2. Set `integration_connections.status` to `connected`, and set `last_sync_at` after each run.
3. Fireflies and Gmail jobs (Edge Function + `pg_cron`) upsert `fireflies_calls` and `inbox_messages` with the service role.

### Assumptions to check at wire-in
- `LEAVE_TABLE = "leave_requests"` lives in `types.ts`. The expected columns are `id`, `member_id`, `kind`, `starts_on`, `ends_on` and `status`, with status values `pending`, `approved` and `declined`. Change the constant, or the selects in `queries.getHrToday`, if 0113 differs.
- Invoice statuses counted as open are `issued`, `partly_paid` and `disputed`. Revenue excludes `draft` and `void`.
- Clients health uses `health_band = 'at_risk'`.
- A missing Phase 1 table or column gives an empty panel, not a crash.

### Nav
- One new route, `/settings/api`, reached from the API keys card. Don't add a nav entry.
- The API route is `/api/v1/[resource]`.

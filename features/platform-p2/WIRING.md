# platform-p2 wiring

Phase 2 platform extras: Home role panels, Settings admin extras (API keys, API docs, notifications log), and the Google Calendar, Fireflies, AI summary and Gmail inbox adapters. Everything lives in `features/platform-p2/`, and nothing is mounted yet. Every integration adapter is the "not configured" one, so the buttons work but only log a run and show a "not set up yet" message.

## Database
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

## Home (`app/(app)/home/page.tsx`)
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

## Settings (`app/(app)/settings/page.tsx`, admin area)
- `import { ApiKeysSection, NotificationsLogSection } from "@/features/platform-p2/components/server";`
- `<ApiKeysSection />` is the card with `id="api"`. It renders nothing unless the user has `admin.access.manage` at `all`.
  - "Create key" shows the full key once, with a copy button.
  - Only the SHA-256 hash and the `pk_xxxxxx` prefix are stored.
  - Create and revoke write `audit_log` (0102), on a best-effort basis.
- `<NotificationsLogSection />` is the card with `id="nlog"`. Admins see every delivery; other people see their own (RLS).
- Add both to the scroll-spy section list: "API keys" → `api` and "Notifications log" → `nlog`.

## API docs page (new route)
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

## API endpoints (new route)
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

## Calendar (`app/(app)/calendar`)
- `import { CalendarSyncBar } from "@/features/platform-p2/components/server";`
- Render `<CalendarSyncBar />` in the row under the toolbar, left of the legend, in place of the mockup's "Google Calendar sync · last synced … · Sync now".
- It shows "Connect Google Calendar" until a connection row is `connected`. After that it shows "Last synced …" and "Sync now".
- Adapter: `getGoogleCalendarAdapter()` in `adapters.ts`, with `connectUrl`, `pullChanges`, `pushEvent` and `freeBusy`.

## Meetings (`app/(app)/meetings`) and client page Meetings tab
- `import { FirefliesCallsCard } from "@/features/platform-p2/components/server";`
- Meetings page:
  - Replace the "Import from Fireflies" header button with `<FirefliesCallsCard />` in the "Recent calls" tab, since the card has the Import button.
  - In the "No client" tab, use `<FirefliesCallsCard noClient />`, which adds a client picker on each call.
- Client page Meetings & notes tab: `<FirefliesCallsCard clientId={id} />`.
- The card has "Read now" or "Read again" for the AI summary, which runs through `getSummaryAdapter()`.
- Matching on import uses `matchCall()` from `logic.ts`: email first, then domain, then title. Our own and free-mail domains are ignored.
- Adapters: `getFirefliesAdapter()` and `getSummaryAdapter()`.

## Response times (`app/(app)/response-times`)
- `import { InboxCountsCard } from "@/features/platform-p2/components/server";`
- Render `<InboxCountsCard />` below the tabs, where the mockup's "Client email inboxes" card is. `days` defaults to 7.
- It shows the counts for New tickets, Added to tickets, Not from a client, Automatic and From us, plus a "Check now" button.
- Adapter: `getGmailInboxAdapter()`, with a 10-minute poll once it is configured.

## Going live with an integration
1. Implement the interface in `adapters.ts` and return it from its `get…Adapter()`. Keep tokens in Supabase Vault or env, never in these tables.
2. Set `integration_connections.status` to `connected`, and set `last_sync_at` after each run.
3. Fireflies and Gmail jobs (Edge Function + `pg_cron`) upsert `fireflies_calls` and `inbox_messages` with the service role.

## Assumptions to check at wire-in
- `LEAVE_TABLE = "leave_requests"` lives in `types.ts`. The expected columns are `id`, `member_id`, `kind`, `starts_on`, `ends_on` and `status`, with status values `pending`, `approved` and `declined`. Change the constant, or the selects in `queries.getHrToday`, if 0113 differs.
- Invoice statuses counted as open are `issued`, `partly_paid` and `disputed`. Revenue excludes `draft` and `void`.
- Clients health uses `health_band = 'at_risk'`.
- A missing Phase 1 table or column gives an empty panel, not a crash.

## Nav
- One new route, `/settings/api`, reached from the API keys card. Don't add a nav entry.
- The API route is `/api/v1/[resource]`.

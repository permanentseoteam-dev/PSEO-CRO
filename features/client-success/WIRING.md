# Wiring: client-success (client page Phase 2 tabs)

Commitments, Relationship, Reports and Delivery ratings tabs for the client page (`/clients/[id]`, owned by the Phase 1 `clients` module). Everything lives in `features/client-success/`. Nothing in Phase 1 folders was touched.

## Files
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

## 1. Client page tabs (`app/(app)/clients/[id]/page.tsx`, clients module)
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

## 2. Overview tab: "Commitments vs delivery" card (clients module, optional)
On the Overview tab, `getCommitments(clientId)` from `@/features/client-success/queries` returns `{ commitments }`. Show the first four as Commitment, Target, Now (`latest`), and Status (`COMMITMENT_STATUS[status]` from `logic.ts`, as a `StatusDot`). Add a "Open commitments" button linking to `?tab=commit`.

## 3. Client Portfolio stat "Last month's reports not sent" (clients module, optional)
Count `monthly_reports` where `month = <first day of last month>` and `status <> 'sent'`. RLS already limits the rows to clients the user can see.

## 4. Client portal (portal module, optional)
RLS already lets a client login read:
- `commitments` where `client_visible`
- `monthly_reports` where `status = 'sent'`
- `qbrs` where `status = 'presented'`
- their own `delivery_ratings`

A client login can rate their teams with `saveRating({ clientId, month, department_id, quality, on_time, communication })`. The action sets `rated_by` to the client login. A good place for this is a "Rate last month" card on `/portal`. No portal UI is built here.

## 5. Nav
No new nav entries. Everything sits inside `/clients/[id]`.

## 6. Permissions
- Read: `clients.view`. Write: `clients.manage`.
- New key `clients.reports.approve` (approve, request changes, send) is seeded in `0201`: admin `all`, dept_head `team`. super_admin gets it automatically.
- Scoping in SQL: `public.cs_staff_can(perm, client_id)`.
  - `all` scope sees every client.
  - `own` and `team` scopes need a row in `client_team` for that client. On `team` scope, a teammate's row is enough.
- **Assumption to check when wiring:** `0108_clients` creates `client_team(client_id uuid, member_id uuid)`. `cs_staff_can` is plpgsql, so a column mismatch won't break the migration. It would error only at query time for `own`/`team` users. If the names differ, fix `cs_staff_can` in 0201. It is the only place they appear.
- Relationship tables have no client policies. Personal notes stay with the account team.

## 7. Phase 1 tables referenced
| Table | How |
|---|---|
| `clients(id, name)` | FK `client_id` on every table, `on delete cascade`; `getClientName` reads `name`. |
| `client_team(client_id, member_id)` | In `cs_staff_can` only (see the assumption above). |
| `members`, `departments` (0001) | FKs for owners and authors; `delivery_ratings.department_id` is the "team". |
| `client_contacts(id)` | `relationship_people.contact_id` is an optional uuid with no FK. Removal on request stays local. |
| `meetings(id)` (0109) | `meeting_briefs.meeting_id` is an optional uuid with no FK. A later step can add the FK and a "Brief" link from the meeting. |

## 8. Integrations
- Email is not connected. `email.ts` defines `Mailer { configured; send({to, subject, text}) }`, and `getMailer()` returns `notConfiguredMailer`.
- The UI shows "Email not connected" with a "Connect email" explainer. Approved reports get "Mark as sent" instead of "Send now", and "Ask for rating" is hidden.
- When a provider is chosen (Resend, Brevo, Mailjet or SMTP), implement `Mailer` and return it from `getMailer()`. Nothing else changes.
- Auto-send: `monthly_reports.auto_send` and `due_on` are stored. A daily job should send reports with `status = 'approved' and auto_send and due_on <= today` through `getMailer()`, then set `status = 'sent', sent_at = now()`. **Not built:** it needs the email provider and a cron route (Vercel cron or Supabase scheduled function).

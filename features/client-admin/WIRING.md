# Wiring: client-admin (client page admin extras, Phase 2)

This feature adds the Terms card, the Health card (sentiment and churn alerts), the Vault, portal activity lines, win-back for ended clients, the AI email draft, and delete client. Everything lives in `features/client-admin/`. Nothing in the Phase 1 folders was touched.

## Files
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

## 1. Client page Overview tab (`app/(app)/clients/[id]/page.tsx`, clients module)
In the Overview `grid-2`, replace or add the Terms and Health cards (mockup order: Timeline, Onboarding, **Terms**, **Health**, Upcoming meetings…):
```tsx
import { ClientTermsCard, ClientHealthCard } from "@/features/client-admin/sections";
<ClientTermsCard clientId={id} />
<ClientHealthCard clientId={id} />
```
- `ClientHealthCard` shows `clients.health_score`, the sentiment line ("Sentiment: neutral, trending down") and churn alerts with an outcome select. Keep Phase 1's health ring and score breakdown. Either place them above this card or drop the Phase 1 health card and keep this one.
- Health history (0211 `client_health_history`): the card shows a 30-day sparkline and the 7-day change. `sections.tsx` passes the score 7 days ago (or the nearest earlier snapshot) as `prevHealthScore`, so the "drop" trigger (15+ points) fires. `snapshot_client_health()` (pg_cron, 02:00 Dubai) also raises a `drop` alert itself unless one is already open.

## 2. Client page header actions (clients module)
Beside "Edit client" / "Log a call":
```tsx
import { ClientEmailButton } from "@/features/client-admin/sections";
<ClientEmailButton clientId={id} to={mainContact?.email} contactName={mainContact?.name} />
```
`mainContact` is the `client_contacts` row with the main-contact flag (Phase 1). Both props are optional.

## 3. Edit client dialog: delete (clients module)
The mockup puts "Delete client" at the bottom of the Edit client dialog. `ClientDeleteButton` is a server component, so render it on the page and pass it into the client dialog as a prop or slot:
```tsx
import { ClientDeleteButton } from "@/features/client-admin/sections";
<EditClientDialog deleteSlot={<ClientDeleteButton clientId={id} />} … />
```
It renders only for `clients.delete` with scope `all`. After deleting, it navigates to `/clients`.

## 4. Client page "Client portal" tab (clients module, tab `portal`)
Below the Logins and Branding cards:
```tsx
import { ClientVaultCard, ClientActivityLinesCard } from "@/features/client-admin/sections";
<ClientVaultCard clientId={id} />
<ClientActivityLinesCard clientId={id} />
```

## 5. Client Portfolio (`app/(app)/clients/page.tsx`)
Put this next to the "By owner" card, as the second column of the bottom `grid-2`:
```tsx
import { EndedClientsCard } from "@/features/client-admin/sections";
<EndedClientsCard />
```

## 6. Client portal Home (`app/(portal)/portal/page.tsx`, portal module)
For a "What's happening" list, `getSharedActivityLines(me.clientId)` from `@/features/client-admin/queries` returns the shared lines. RLS already limits a client login to `visibility = 'shared'` rows for their own client. If the portal module's `shared_activity` (0114) feeds the same list, merge both and sort by date.

## 7. Nav
No new nav entries. Everything sits inside `/clients` and `/clients/[id]`.

## 8. Permissions (seeded in 0203)
- Read: `clients.view`. Write (terms, sentiment, churn alerts, activity lines, win-back): `clients.manage`. All scoped with `public.cs_staff_can(perm, client_id)` from `0201_client_success`.
- New keys:
  - `clients.vault.view`: list logins and reveal them. Granted to admin `all`, dept_head `team`, member `own` (on the account team).
  - `clients.vault.manage`: add, edit and delete logins. Granted to admin `all`, dept_head `team`.
  - `clients.delete`: delete a client. Granted to admin `all`.
- super_admin gets all of these automatically.

## 9. How the pieces work
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

## 10. Phase 1 tables and columns this assumes (check when wiring)
| Used in | Table.column | If different |
|---|---|---|
| Everywhere | `clients(id, name, status, health_score)`; ended = `status in ('churned','terminated')` | Edit `queries.ts` `getClientBasics` / `listEndedClients` |
| Win-back line | `clients.ended_on`, `clients.end_reason` (read with `select *`; `end_date` also accepted). Missing columns just show "Ended". | Edit `listEndedClients` |
| RLS scoping | `client_team(client_id, member_id)` via `cs_staff_can` (0201) | Fix `cs_staff_can` in 0201 |
| Hours bar | `time_entries(minutes, date, ticket_id → tickets.client_id)`. Errors show "Budget N" without a bar. | Edit `getHoursThisMonth` |
| Delete history | `tickets.client_id`, `client_files.client_id`, `members.client_id`, `invoices.client_id`. Any error stops the delete with "Couldn't check this client's history". | Edit `history()` in `actions.ts` |
| Delete cascade | FKs to `clients` that point to `clients` need `on delete cascade` (or `set null`), or the delete fails with an FK error. That error is shown to the user. | 0108 and the other modules decide |
| Seed | `clients(id, name, status)` is enough to add the two ended sample clients. If 0108 needs more columns, the insert is skipped with a notice. | — |

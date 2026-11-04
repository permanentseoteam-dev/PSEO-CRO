# Wiring: finance-p2 (Finance extras, Phase 2)

Monthly drafts, Record past invoice, original document upload, invoice visibility in the client portal, apply client credit and give it back, Upwork earnings, Exports (CSV), sub-account linked billing, the Email sending card and the email provider adapter. Everything lives in `features/finance-p2/`. No Phase 1 folders were touched.

## Files
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

## 1. Invoices page (`app/(app)/finance/invoices/page.tsx`, finance-core)
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

## 2. Invoice page (`app/(app)/finance/invoices/[id]/page.tsx`, finance-core)
In the side column:
```tsx
import { InvoicePortalSection } from "@/features/finance-p2/sections";
<InvoicePortalSection invoiceId={id} />
```
Shows the "Show in client portal" toggle, the "recorded after the fact" note for past invoices and the original document upload/link.

## 3. Payments page (`app/(app)/finance/payments/page.tsx`, finance-ops)
Header, beside "Record payment": `<ApplyCreditSection />`.
Still owed tab, below "By client": `<ClientCreditSection />` (replaces any Phase 1 placeholder "Client credit" card; it lists credit per client with Apply credit / Give back and a "Credit used" log).

## 4. Billing clients (`app/(app)/finance/clients/page.tsx`, finance-ops)
- Client cell: `const subCounts = await getSubAccountCounts()` (from `queries.ts`), then `{subCounts[c.id] ? <div className="small muted">{subCounts[c.id]} sub-accounts billed here</div> : null}`.
- Edit billing dialog, last field: `<SubAccountsSection clientId={id} />`. It is a server component: render it in the page and pass it into the client dialog as a slot prop (e.g. `subAccountsSlot`).

## 5. Finance settings (`app/(app)/finance/settings/page.tsx`, finance-ops)
In the right column after FX rates: `<EmailSendingSection />`.
Phase 1 email sending (invoice/reminder/receipt modals, the daily reminder job) should call `getEmailSender(settings.provider).send(...)` from `email.ts` and insert an `email_log` row (`kind`, `to_email`, `subject`, `provider`, `status`, `error`, `invoice_id`, `created_by`) so the card's 30-day counts are real.

## 6. Client portal invoices (`app/(portal)/portal/invoices/page.tsx`, portal)
RLS already hides invoices marked hidden (restrictive policy `invoices_portal_visibility`). To also drop drafts/voids and add original-document links:
```tsx
import { getPortalInvoiceExtras } from "@/features/finance-p2/queries";
const { visibleIds, docs } = await getPortalInvoiceExtras(invoices.map((i) => ({ id: i.id, status: i.status })));
const shown = invoices.filter((i) => visibleIds.includes(i.id));
// per row: docs.get(i.id) -> signed URL for "Original document"
```

## 7. Finance maths in Phase 1 (finance-core / finance-ops)
These must be folded in, or balances will disagree:
- **Invoice balance** = `total - paid (receipt allocations) - invoice_extras.paid_before_portal - invoice_credit_applied.amount`. `logic.ts → invoiceBalance` shows the formula.
- **Credit left** per client and currency = `sum(client_credit.amount) - sum(credit_movements.amount)` (both kinds). `logic.ts → creditBalances`.
- Dashboard "Refunded" can include `credit_movements` where `kind = 'given_back'`.

## Phase 1 columns this feature assumes
Change the column names in `queries.ts` / `actions.ts` / the seed if 0108/0110/0111 differ:
- `clients(id, name, status)`
- `entities(id, name, tax_rate, default_currency, invoice_prefix)`
- `billing_profiles(client_id, entity_id, currency, agreed_fee, fee_basis 'monthly'|'weekly'|'hourly'|'one_time', terms_days)`
- `invoices(id, number, client_id, entity_id, currency, status, title, issued_on, due_on, total, amount_paid)`; status values `draft, issued, partly_paid, paid, void, refunded, partly_refunded, written_off, disputed`. Drafts are inserted with `number = null`.
- `invoice_lines(invoice_id, position, description, qty, rate, tax_pct)`
- `client_credit(client_id, amount, currency)` (credit in)
- `receipts(received_on, client_id, amount, fee, landed_amount, currency, channel, reference)`
- `client_sub_accounts` from 0202_client_data (`billing = 'parent'` means billed under the parent).

## Permissions
No new keys. Uses 0001_core keys: `finance.invoices.view/create/send/void/record_past`, `finance.drafts.create`, `finance.payments.view/record`, `finance.settings.manage`, `clients.billing.view/edit`. Upwork: view with `finance.payments.view`, write with `finance.payments.record`.

## Nav
No new nav entries: everything mounts inside existing Finance pages.

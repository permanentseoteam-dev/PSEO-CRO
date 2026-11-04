# Wiring: client-data (Phase 2 client page tabs)

Self-contained. Nothing here edits Phase 1 files. The wire-in step connects these pieces.

## 1. Database
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

## 2. Client page tabs: `app/(app)/clients/[id]/page.tsx` (module 0108 Clients)
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

## 3. Overview tab (optional, Phase 2 "Performance last 28 days with sparklines")
The client-success / Overview owner can reuse `snapshot28(days, asOf)` from `features/client-data/logic.ts` with `listMetricDays(clientId, asOf)` from `features/client-data/queries.ts`. Sparklines can be built from the same daily rows.

## 4. Client portal (module 0114), optional
Client logins can read `client_leads` for their own client when they have `clients.leads.view`. A portal "Leads" page could render `LeadsTable` from `features/client-data/components/leads-table.tsx` with `canManage={false}`. In that case `getMe()` is a client, so read leads with `listLeads(me.clientId)`. No new nav entry is added here. If wanted, add `{ href: "/portal/leads", label: "Leads", perm: "clients.leads.view" }` to `PORTAL_NAV` in `lib/nav.ts`.

## 5. Assumed Phase 1 columns (reads fail soft and return [] if different)
- `clients(id, name, services)`. `services` is a text array.
- `projects(id, key, name, client_id)`, used in Accounts & projects and to find website tickets.
- `tickets(key, title, status, tags, project_id, created_at)`. Website change requests are open tickets tagged `website` in the client's projects.
- `listSubAccounts` embeds `clients` through the FK name `client_sub_accounts_child_client_id_fkey`, which is the Postgres default name.

## 6. Integrations (no real API calls)
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

## 7. Sub-account billing (finance agent)
`client_sub_accounts.billing` is `'parent' | 'own'`. The finance module's "Sub-account linked billing" can read it to bill a sub-account under its parent.

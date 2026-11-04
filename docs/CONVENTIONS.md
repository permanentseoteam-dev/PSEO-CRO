# Conventions for module builders

Read this, [MODULES.md](MODULES.md) (who owns what) and the per-tab spec in [PLAN.md](PLAN.md) before writing code. The UI reference is [ui-preview/](ui-preview/): open `index.html`; your screen is in `ui-preview/screens/<area>.js`. Match its layout, content and behaviour.

## Stack (already installed, do not add dependencies)
- Next.js 16 (App Router, `proxy.ts` instead of middleware), React 19, TypeScript strict, Tailwind 4, ESLint.
- `@supabase/supabase-js`, `@supabase/ssr`, `lucide-react`, `zod`, `date-fns`, `clsx`, `tailwind-merge`, `@react-pdf/renderer`, `server-only`.
- Dev: `vitest`, `@vitest/coverage-v8`, `supabase` CLI.
- **Do not** run `npm install`, edit `package.json`, run `next dev` or `next build` (agents share `.next`). Use `npm run typecheck`, `npm run lint` and `npm test`.
- Next 16 differs from older versions. Before using an API you are unsure of, read `node_modules/next/dist/docs/`.

## Folder pattern per module
```
app/(app)/<route>/page.tsx          server component: getMe(), can() guard, fetch via queries.ts, render
app/(app)/<route>/actions.ts        "use server" actions: zod parse -> can() check -> Supabase write -> revalidatePath
app/(app)/<route>/_components/*.tsx client components for this route only ("use client" at the top)
lib/modules/<module>/types.ts       row and view types
lib/modules/<module>/queries.ts     server reads (import "server-only"; use createClient from lib/supabase/server)
lib/modules/<module>/logic.ts       pure functions (maths, grouping, status rules). No I/O.
lib/modules/<module>/__tests__/*.test.ts   vitest tests for logic.ts
supabase/migrations/01NN_<module>.sql
supabase/seed/01NN_<module>.sql
```
- `<module>` is the lowercase slug: `shell`, `access`, `home`, `calendar`, `chat`, `tickets`, `work`, `clients`, `clientops`, `finance-core`, `finance-ops`, `team`, `personal`, `portal`.
- Client portal pages live in `app/(portal)/portal/<route>/page.tsx` (URL `/portal/...`). Route groups share one URL space, so `(portal)` cannot reuse `/files` etc.
- Auth pages live in `app/(auth)/...` (`/login`, `/invite/[token]`, `/reset/...`, `/auth/callback`). These are the only public paths (see `lib/supabase/proxy.ts`).
- Detail routes from MODULES.md: `t/[key]`, `clients/[id]`, `finance/invoices/[id]`.

### Page template
```tsx
// app/(app)/finance/invoices/page.tsx
import { requireMe, can } from "@/lib/auth/can";
import { NoAccess } from "@/components/ui";
import { listInvoices } from "@/lib/modules/finance-core/queries";

export const metadata = { title: "Invoices" };

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireMe();
  if (!can(me, "finance.invoices.view")) return <NoAccess />;
  const filters = await searchParams;          // filters live in the query string
  const rows = await listInvoices(filters);
  return <div className="page">…</div>;
}
```
- `params` and `searchParams` are Promises in Next 16: always `await` them.
- Keep pages as server components. Push interactivity into small client components under `_components/`.

### Server action template
```ts
"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getMe, can } from "@/lib/auth/can";
import { createClient } from "@/lib/supabase/server";

const Input = z.object({ id: z.string().uuid(), status: z.enum(["todo", "in_progress", "in_review", "blocked", "done"]) });

export async function setStatus(raw: unknown) {
  const input = Input.safeParse(raw);
  if (!input.success) return { ok: false as const, error: "Check the form and try again." };
  const me = await getMe();
  if (!me || !can(me, "work.projects.manage", "team")) return { ok: false as const, error: "You don't have access to do that." };
  const supabase = await createClient();
  const { error } = await supabase.from("tickets").update({ status: input.data.status }).eq("id", input.data.id);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/tickets");
  return { ok: true as const };
}
```
- Return `{ ok, error }`; never throw to the client. The client shows `error` with `useToast()`.
- RLS is the real guard; `can()` gives a clean message and hides UI. Do both.

## Supabase clients
| Import | Where | Runs as |
|---|---|---|
| `createClient` from `@/lib/supabase/server` | server components, actions, route handlers | the signed-in user (RLS) |
| `createClient` from `@/lib/supabase/client` | client components (realtime, uploads) | the signed-in user (RLS) |
| `createAdminClient` from `@/lib/supabase/admin` | server only, after a `can()` check (invites, cron, cross-client maths) | service role, **bypasses RLS** |

Env vars (in `.env.local`, see `.env.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`. Never read, print or commit `.env.local`.

## Permissions
- Server: `const me = await getMe()` (or `requireMe()`, which redirects to `/login`) from `@/lib/auth/can`. `me` has `id, name, kind ('staff'|'client'), clientId, departmentId, roles, perms`.
- Client components: pass `me.perms` down as a prop and use `can` from `@/lib/auth/perms` (no server import).
- `can(me, "finance.invoices.view")` means scope at least `own`; `can(me, key, "team")`, `can(me, key, "all")` for wider scope. Scopes: `none < own < team < all`.
- Permission keys are in `public.permissions` (seeded in `supabase/seed/0001_core.sql`). A module that needs a new key adds it to its own seed with `insert into public.permissions … on conflict do nothing` and grants it in `role_permissions`. super_admin gets every key automatically.
- Guarded page shows `<NoAccess />` ("You don't have access to this page").

## Database
### Migration numbering
- `0001_core.sql` (Step A). Each module owns exactly one file, numbered as in MODULES.md: `0101_shell`, `0102_access`, `0104_calendar`, `0105_chat`, `0106_tickets`, `0107_work`, `0108_clients`, `0109_clientops`, `0110_finance_core`, `0111_finance_ops`, `0112_team`, `0113_personal`, `0114_portal`. Home (0103) has no migration.
- Foreign keys point only to `0001_core` tables or to modules with a **lower** number. If you need a link to a higher-numbered module, store the uuid without a FK and let that module add the constraint in its own migration (as `0108_clients` must do for `members.client_id`: `alter table public.members add constraint members_client_fk foreign key (client_id) references public.clients (id) on delete cascade;`).
- Never edit another module's migration. Need a change in someone else's table? Ask the lead.

### Table rules
- Schema `public`, snake_case plural names, `id uuid primary key default gen_random_uuid()`, `created_at timestamptz not null default now()`, and `updated_at` with the shared trigger: `create trigger <t>_updated_at before update on public.<t> for each row execute function public.set_updated_at();`
- People columns reference `public.members (id)`. Client-owned rows carry `client_id uuid` (FK to `clients` for modules numbered above 0108).
- Status columns are `text` with a `check (...)` list, matching the spec's words (`todo`, `in_progress`, …).
- Money: `numeric(14,2)` plus a `currency text` (`AED`, `USD`, `PKR`). Never floats.
- Index every FK column you filter on.

### RLS (required on every table)
`alter table public.<t> enable row level security;` then policies. Helpers from 0001_core (all `security definer`, safe inside policies):

| Helper | Meaning |
|---|---|
| `public.has_perm('key', 'own'\|'team'\|'all')` | signed-in user's scope for `key` is at least that |
| `public.perm_scope('key')` | the scope itself (`scope_level` enum) |
| `public.is_staff()` | active staff member |
| `public.my_client_id()` | the client a client login belongs to, else null |
| `public.in_my_team(member_id)` | me, my reports, or my department |
| `public.is_super_admin()` | super admin |

Pattern:
```sql
-- staff: by permission and scope
create policy invoices_staff_select on public.invoices for select to authenticated using (
  public.has_perm('finance.invoices.view', 'all')
  or (public.has_perm('finance.invoices.view', 'team') and public.in_my_team(owner_id))
  or (public.has_perm('finance.invoices.view', 'own') and owner_id = auth.uid() and public.is_staff())
);
-- clients: only their own client's rows, and only what is shared
create policy invoices_client_select on public.invoices for select to authenticated using (
  client_id = public.my_client_id() and public.has_perm('finance.invoices.view', 'own')
);
```
- Clients never see another client's rows: every client policy checks `client_id = public.my_client_id()`.
- Write policies need `with check`, not just `using`.
- No policy for `anon`. Nothing is public.

### Realtime
- Only tables that need live updates join the publication, in their own migration: `alter publication supabase_realtime add table public.<t>;`
- Allowed: chat (`messages`, `message_reactions`, `channel_members`), shell (`notifications`), tickets (`tickets` for the board). Ask the lead before adding others.
- Realtime respects RLS, so the select policy is what limits who receives a row.

### Seed data
- Each module writes `supabase/seed/01NN_<module>.sql` with realistic sample data that matches the mockup screens (same clients, tickets, amounts, dates). Today is **2026-11-04**. Currencies AED, USD, PKR.
- Use the fictional names from `docs/ui-preview/kit.js` only. Fixed ids from `0001_core` seed:
  - Members `00000000-0000-4000-8000-0000000000NN`: 01 Sara Malik (admin, Client Success head), 02 Omar Haddad (SEO Lead), 03 Ayesha Khan (PPC), 04 Daniel Reyes (Web), 05 Priya Nair (Content), 06 Bilal Ahmed (finance head), 07 Lina Saeed (Design), 08 Hamza Qureshi (Account Executive, reports to Sara), 09 Zara Farooq (Social), 10 Yusuf Ali (CEO, super admin).
  - Departments `d0000000-0000-4000-8000-0000000000NN`: 01 Client Success, 02 SEO, 03 PPC, 04 Web, 05 Content, 06 Finance, 07 Design, 08 Social, 09 Leadership.
  - Clients (created by `0108_clients` seed) use `c0000000-0000-4000-8000-0000000000NN`: 01 Cedar & Pine Dental, 02 Alba Motors, 03 Luma Skincare, 04 Harbor Legal, 05 Nova Fitness, 06 Zest Kitchen. The clients seed also creates the client login Karim Nassar (Alba Motors, `client_owner`) with member id `00000000-0000-4000-8000-000000000101`.
  - Use your own fixed prefix for your rows if other modules need to reference them; document it at the top of your seed.
- Seeds run in file-name order after all migrations (`supabase/config.toml` → `[db.seed] sql_paths = ["./seed/*.sql"]`). Use `on conflict do nothing` so a re-run is safe.
- Sample logins use password `Portal-dev-2026` (dev/preview only).

## UI kit (`@/components/ui`, read-only for modules)
`import { Button, Card, CardHead, CardBody, StatCard, Stats, Table, Th, Td, Tabs, Seg, Dialog, Field, FormGrid, Input, Select, Textarea, Checkbox, StatusDot, TicketStatusDot, Priority, Avatar, Avatars, EmptyState, NoAccess, PhaseTwo, useToast } from "@/components/ui";`

| Component | Use |
|---|---|
| `Button` `variant="primary"\|"ghost"\|"danger"\|"primary-danger"` `size="sm"`; `ButtonLink` (same, as a Link); `IconButton label="…"` | actions |
| `Card` > `CardHead title actions` + `CardBody` (or a `Table` directly) | panels |
| `Stats` > `StatCard label value sub tone` | stat rows |
| `Table` (wraps in `.table-wrap`, scrolls on phones) with `<thead><tr><Th>`, `Td right num hideSm` | tables; sentence-case headers |
| `Tabs` / `Seg` `items=[{value,label,href?,count?}] value` + `onChange` (client) or `href` per item (URL-driven, works from server) | underline tabs / segmented filters |
| `Dialog open onClose title footer wide` | modals (native `<dialog>`; client component) |
| `FormGrid` > `Field label htmlFor hint full` > `Input`/`Select`/`Textarea`; `Checkbox label` | forms |
| `StatusDot tone` + text; `TicketStatusDot status`; `Priority level` | status = dot + text |
| `Avatar name size`, `Avatars` | people |
| `EmptyState icon title action`, `NoAccess` | empty and guarded states |
| `PhaseTwo` | muted italic "phase 2" after a tab or section name |
| `useToast()` | `toast("Saved")` from client components |

Tones: `muted`, `blue`, `violet`, `danger`, `ok`, `warn`, `accent`.

Shared CSS classes from the mockup are global (see `app/globals.css`): `.page`, `.row`, `.between`, `.grid-2/3/4`, `.stack`, `.muted`, `.small`, `.num`, `.right`, `.toolbar`, `.list > .item`, `.bar > i`, `.board > .col > .col-head + .kcard`, `.cal-grid > .cal-cell > .ev`, `.count`, `.hide-sm`. Use them as in the mockup. Tailwind utilities can use the tokens: `bg-surface`, `bg-surface-2`, `text-ink-2`, `text-ink-3`, `border-line`, `text-accent-ink`, `bg-accent-soft`, `text-danger`, `font-display`, etc.

- Colours: only the CSS variables / token utilities. Never hard-code hex values; light and dark themes depend on it. Don't use Tailwind `dark:`; the variables already switch.
- Icons: `lucide-react` only.
- Screen-specific CSS: Tailwind utilities first. If you need a stylesheet, a CSS module next to the component (`*.module.css`) using the variables.

## Design rules (strict)
- No pills or badges: no rounded label chips, no round count badges. Counts are plain bold numbers (`.count`).
- Status is a coloured dot plus text (`StatusDot`).
- No eyebrow or kicker labels above headings, no small uppercase letter-spaced labels, no "—— LABEL ——" dividers.
- No secondary text link under a main button. No small print or asterisk footnotes under buttons.
- Sentence-case table headers. Short, plain, active copy; buttons say what they do.
- Works at 390px: tables scroll in `Table`, grids stack, hide secondary columns with `hideSm`.
- Light and dark themes via the variables. Theme/density cookies (`theme` = `light`|`dark`, unset = system; `density` = `compact`) are read by the root layout; the Settings module writes them.

## Testing (essentials only)
- `npm run typecheck`, `npm run lint`, `npm test` must pass for your files before you finish.
- Unit-test the pure logic in `lib/modules/<module>/logic.ts` (finance maths, grouping, SLA clocks, health score…).
- Every page must render without crashing with an empty database and with the seed.

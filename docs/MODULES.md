# Build modules (fast parallel plan)

This file splits the build into modules so 14 agents can build at the same time. It goes with the main plan in [PLAN.md](PLAN.md). The UI reference is the clickable preview in [ui-preview/](ui-preview/) (open `ui-preview/index.html`) and https://claude.ai/artifact/GuykPVxJqA1vMnCzX3napd.

**Status:** planned only. Coding starts when the user says "yes".

## Rules for every module
- Each module owns its own folders and **one** migration file. Never edit another module's files.
- Shared code from Step A (`components/ui/*`, `lib/supabase/*`, `lib/auth/can.ts`, design tokens) is read-only for modules. Request changes from the lead.
- Follow the global rules: Opus for builders, `/karpathy-guidelines`, and the design rules (no pills, badges, eyebrows or uppercase labels).
- Testing is essentials only: typecheck, build, RLS, live chat, finance maths, and no crashed pages.

## Step A: foundation (lead, ~20 min, done first)
| Area | Owned paths |
|---|---|
| Next.js scaffold, Tailwind tokens, PWA manifest | `package.json`, `app/layout.tsx`, `app/globals.css`, `tailwind.config.*`, `public/manifest.json` |
| Shared UI kit | `components/ui/*` (button, table, dialog, tabs, seg, status dot, avatar, stat card, empty state) |
| Supabase clients and auth helpers | `lib/supabase/*`, `middleware.ts` |
| Permissions | `lib/auth/can.ts`, `supabase/migrations/0001_core.sql` (members, departments, roles, role_permissions, member_overrides, `has_perm()`) |
| Conventions | `docs/CONVENTIONS.md` (naming, folders, migration numbering, server actions pattern) |

## Step B: 14 modules in parallel (~30–40 min)
| # | Module | Tabs | Routes (`app/(app)/…`) | Migration |
|---|---|---|---|---|
| 1 | Shell | sidebar, top bar, search palette, bell, timer chip, view switch | `components/shell/*`, `app/(app)/layout.tsx` | `0101_shell.sql` (notifications, pins, user_settings) |
| 2 | Auth & access | login, invites, roles/permissions admin | `app/(auth)/*`, `app/(app)/admin/*` | `0102_access.sql` (invites, audit_log) |
| 3 | Home & My work | Home, My work | `home`, `my` | none (reads tickets) |
| 4 | Calendar | Calendar | `calendar` | `0104_calendar.sql` (events, attendees) |
| 5 | Chat | Chat (Supabase Realtime) | `chat` | `0105_chat.sql` (channels, members, messages, reactions, files) |
| 6 | Tickets | Tickets (list/board/calendar), ticket page | `tickets`, `t/[key]` | `0106_tickets.sql` (tickets, checklist, comments, attachments, history, watchers, time_entries) |
| 7 | Work extras | Projects, Reviews, Templates | `projects`, `reviews`, `templates` | `0107_work.sql` (projects, reviews, qa_checklists, templates, recurring_rules) |
| 8 | Clients | Client Portfolio, client page | `clients`, `clients/[id]` | `0108_clients.sql` (clients, contacts, client_team, timeline, terms, escalations) |
| 9 | Client ops | Response times, Meetings, Files | `response-times`, `meetings`, `files` | `0109_clientops.sql` (sla_waits, sla_settings, meetings, client_files, folders, brand_kit) |
| 10 | Finance A | Dashboard, Invoices, invoice PDF | `finance`, `finance/invoices/*` | `0110_finance_core.sql` (entities, channels_pay, fx_rates, invoices, invoice_lines, invoice_events) |
| 11 | Finance B | Payments, Billing clients, Payment reminder, Profitability, finance settings | `finance/payments`, `finance/clients`, `finance/reminders`, `finance/profitability`, `finance/settings` | `0111_finance_ops.sql` (receipts, allocations, client_credit, billing_profiles, reminders, salaries) |
| 12 | Team | Directory, Org chart, Performance | `people`, `people/org`, `performance` | `0112_team.sql` (kpis, okrs, key_results, review_cycles, perf_reviews, training) |
| 13 | Personal | My profile, Time, Settings | `me`, `time`, `settings` | `0113_personal.sql` (timesheets, timers, attendance, leave, documents) |
| 14 | Client portal | client Home, Work & approvals, Meetings, Files, Invoices, Messages | `app/(portal)/*` | `0114_portal.sql` (portal_users, approvals, shared_activity) |

**Order:** cross-module foreign keys point only to tables created in `0001_core.sql` or to modules with a lower number. Migrations apply in numeric order.

## Step C: join and check (~15–20 min)
1. Apply all migrations to Supabase project `vclnyjivuhqdjpndofvi`.
2. Run `npm run typecheck`, `npm run build`, RLS tests (a client can't read another client's data; non-finance roles can't read finance tables), a two-session live chat test, finance maths unit tests, and a check that every route loads without crashing.
3. Create a branch, push it to github.com/permanentseoteam-dev/PSEO-CRO, and send the user a Vercel **preview** link. Production waits for "push".

## Phase 2 (same module split, ~45–60 min)
Each module adds its Phase 2 items from [PLAN.md](PLAN.md) → "Phase 2" in the same folders. Integrations (Google, Meta, Fireflies, Slack, AI, email) are added once the user gives access.

## Time summary (estimate)
| Part | Time |
|---|---|
| Phase 1 (A + B + C) | ~1–1.5 h |
| Phase 2 | ~45–60 min, plus integrations |
| **Total** | **~2–2.5 h** |

## Before starting (user)
- Rotate the Supabase secret key and update `.env.local`.
- Run `vercel login` and `npx supabase login`.
- Optional: `winget install --id GitHub.cli` then `gh auth login`.
- Email service decided later (Resend, Brevo, Mailjet or Google Workspace SMTP).

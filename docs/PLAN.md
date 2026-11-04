# Plan: Own agency portal modelled on the BrandSurge team portal

## Context
The user wants their own team and client portal that works like https://permanent-seo.portal.brandsurge.ae/, but with only these 23 tabs:

- **Core:** Home, My work, Calendar, Chat
- **Work:** Tickets, Projects, Reviews, Templates
- **Clients:** Client Portfolio, Response times, Meetings, Files
- **Finance:** Dashboard, Invoices, Profitability, Payments, Billing clients, Payment reminder
- **Team:** Directory, Org chart, Performance
- **Personal:** My profile, Time, Settings

Decisions:
- An **installable website (PWA)**, not native apps.
- **Supabase** backend.
- **Team and clients** both log in.
- **Payment gateway decided later.** Payments are manual first, as BrandSurge does: a pasted pay link and a recorded receipt.
- Chat must be **live with no refresh**.
- The project folder `E:\BrandSurge CRO` is empty.

We write our own code, layout and branding in the same style. We copy no BrandSurge JavaScript, CSS, logo or text. Icons come from Lucide (ISC licence).

**Source of this spec:** read-only analysis of the portal's public front-end modules through WebFetch, plus the shell and design mapping. A live REA browser pass, with the user logged in through Chrome with debugging enabled, will confirm screens and fill the gaps listed at the end.

## Stack
- **Front end:** Next.js (App Router) + TypeScript + Tailwind + shadcn/ui primitives + Lucide icons.
  - Hosted on Vercel. Every change gets a preview deploy; production goes live only after the user says "push".
- **Backend:** Supabase.
  - **Postgres** with **RLS** on every table.
  - **Auth:** email and password plus an emailed 6-digit code; clients join by invite.
  - **Storage:** Files, chat attachments, payment proofs, invoice PDFs.
  - **Realtime:** chat, notifications, ticket board.
  - **Edge Functions + `pg_cron`:** reminders, SLA clock, timer heartbeat cleanup, monthly profitability alert.
- **Email:** Resend.
- **PDF:** invoice PDFs rendered on the server (`@react-pdf/renderer`).
- **PWA:** manifest (standalone, shortcuts for My work, Chat and Tickets), service worker, Web Push.

## Permissions model (same idea as theirs)
- `roles` and `role_permissions(perm_key, scope)`, where scope is `none`, `own`, `team` or `all`, plus `member_overrides`.
- `can(perm, scope)` helper on both client and server. RLS policies call a SQL `has_perm()` function.
- **Roles:**
  - `super_admin`, `admin`, `finance_head`, `dept_head`, `member`.
  - Client roles: `client_owner` (everything incl. billing and approvals), `client_viewer` (no billing or approvals).
- **Key permissions:**
  - Work: `work.projects.manage`, `work.templates.manage`, `work.quality.view`.
  - Clients: `clients.view`, `clients.manage`, `clients.billing.view`, `clients.billing.edit`.
  - Finance: `finance.dashboard.view`, `finance.invoices.view`, `.create`, `.send`, `.void`, `.edit_issued`, `finance.payments.view`, `.record`, `finance.profitability.view`, `finance.settings.manage`.
  - Time: `time.approve`, `time.view`, `time.clients`.
  - Other: `hr.directory.view`, `calendar.use`, `chat.use`, `admin.access.manage`.
- Sidebar items and pages are hidden or guarded by `can()`. A guarded page shows "You don't have access to this page".

## App shell and design
- **Sidebar:** 248px, sticky.
  - Logo, collapse button (`[` key; 68px icon-only mode saved in localStorage), clock-in widget, and Pinned pages (up to 12).
  - Groups: Core (no label), Work, Clients, Finance, Team, Personal. Each group label folds its group.
  - Active link: soft-teal background, teal text, 3px left bar.
  - Footer: avatar, name and status (Available, Meeting, Focus, Away, Sick), opening a menu with My profile and Sign out.
- **Top bar:** page title, pin, help "?", search (Ctrl/Cmd+K or `/` opens a command palette), running-timer chip, notification bell, and the "+ New ticket" button (`C`).
- **Shortcuts:** `?` opens the shortcut sheet; `Esc` closes.
- **Mobile (900px and below):** the sidebar becomes a 250px slide-in drawer with a hamburger; grids go to one column; tables hide secondary columns; the board scrolls sideways.
- **Design tokens** (our own values in a similar style):
  - Colour:
    - Teal brand ~`#0d9488` and accent ~`#0f766e`.
    - Background `#f6f8f8`, surface white, ink `#0f1a1f`, lines `#e3e8e9`.
    - Danger, warn, ok, blue and violet, each with a soft tint.
    - Dark mode (system, light or dark) and density (comfortable or compact).
  - Type: Inter 14px for body; Plus Jakarta Sans 600–800 for headings.
  - Shape: radius 12–14px for cards and 8px for controls; control height 36px.
  - Tables: sentence-case headers (no uppercase, per the user's design rules), sticky headers, row hover.
  - Status colours (text and soft tint, not rounded pill badges, per the user's design rules): todo grey, in progress blue, in review violet, blocked red, done green.
- **Auth screens:** work-email step, then password or emailed code; forgot password; `/invite/:token`; a split "no access" screen; a "couldn't load" screen with retry.

## Data model (main Supabase tables)
- **Organisation:** `members`, `departments`, `roles`, `role_permissions`, `member_overrides`, `presence`.
- **Work:**
  - `projects` (key, department, client, lead, review_required, reviewer, status)
  - `tickets` (key, title, description, done_when, status, priority, assignee, co-assignees, reporter, due, start, estimate_min, tags, parent, source, client_visible)
  - `ticket_watchers`, `checklist_items`, `ticket_dependencies`, `comments` (is_update, to_client, from_client), `attachments`, `ticket_history`
  - `reviews` (rounds, reviewer, status `waiting`/`approved`/`changes`, reasons), `qa_checklists`, `qa_results`
  - `templates` (title pattern, priority, due_in_days, checklist, subtasks, uses, active), `recurring_rules`, `saved_filters`
- **Calendar:** `events` (kind `busy`/`client_meeting`, client, attendees + RSVP, meet_link, repeat, visibility).
- **Chat:** `channels` (public, private, client, dm, group), `channel_members` (role, notify pref, last_read_id), `messages` (parent_id, mentions, edited, deleted, pinned, ticket_key), `message_reactions`, `message_files`.
- **Clients:**
  - `clients` (status `active`/`paused`/`churned`/`terminated`/`internal`, owner, manager, services, health_score, health_band), `client_contacts`, `client_team`
  - `client_timeline`, `client_terms`, `escalations`
  - `client_files` (folder, version, shared, from_client), `client_folders`, `brand_kit`
  - `meetings`/`calls` (summary, decisions, concerns, action_items with status `suggested`/`ticket`/`noted`/`skipped`), `sla_waits` (kind, asked_at, answered_at, due_at, status), `sla_settings`, `portal_users`
- **Finance:**
  - `entities` (legal block, invoice_prefix, tax_label, default currency), `channels_pay` (type Wise/PayPal/Slash/bank/Payoneer/other, details), `fx_rates`
  - `billing_profiles` (per client: legal name, emails, address, entity, currency, channel, terms_days, agreed_fee + basis, auto_reminders)
  - `invoices` (number, status, issued, due, discount, totals, pay_link), `invoice_lines` (qty, rate, tax%), `invoice_events`
  - `receipts` (amount, fee, currency, channel, account, landed_amount, reference, proof), `receipt_allocations`, `client_credit`
  - `reminders` (stage `before`/`late_1`/`late_7`/`late_14`/`late_30`, action, paused_until)
- **Team and personal:**
  - `time_entries` (ticket, minutes, date, billable, note), `timers`, `timesheets` (week, status `open`/`submitted`/`approved`/`returned`)
  - `salaries` (needed for profitability cost)
  - `kpis`, `kpi_values`, `okrs`, `key_results`, `review_cycles`, `perf_reviews`, `training_paths`
  - `notifications`, `push_subscriptions`, `user_settings` (theme, density, email digest, quiet hours)

## Per-tab spec

### Core
- **Home:**
  - Four stat cards: My open tickets, Overdue, Due today, Blocked (+ in review).
  - "Up next for me" and "Updates on my tickets" (why: assigned, reported or watching).
  - Today list (meetings and due items, tagged Now, Soon or Later).
  - Role panels: Department (open, overdue, unassigned, blocked, per-person load), My clients table (Client, Health, Open tickets, Report, Next meeting), Finance snapshot, Next meetings.
- **My work:**
  - Tabs: Assigned to me (default), Everything I'm on, Watching, I asked for.
  - Groups: Overdue, Today, This week, Later, No due date.
  - Columns: Key, Title (meta counts), Status, Priority, Assignee, Due.
  - A "Show done" toggle shows the last 40 done tickets.
- **Calendar:**
  - Views: Month, Week, Day, Agenda (next 30 days).
  - Toolbar: Today, prev/next, "Show colleagues" (busy/free only), Client meeting, New meeting.
  - Event drawer: Join, RSVP, Edit, Cancel (this one or all).
  - Form fields: client, title, date, start (15-minute steps), length, team members, guests, "Find a time", Meet link or location, agenda, repeat, visibility, email invites.
  - Phase 2: Google Calendar two-way sync.
- **Chat:** see "Live chat" below.

### Work
- **Tickets:**
  - **Views:** List, Board (drag between columns to change status), Calendar (drag to change the due date), all driven by query-string filters.
  - **Status tabs with counts:** Active, To do, In progress, In review, Blocked, Done.
  - **Filters:**
    - search, assignee (Me, My team, Unassigned, or a person), priority, due (overdue, today, this week, none), tag, project
    - group by status, assignee, project, priority or due
    - sort; saved views
  - **Bulk bar:** status, priority, owner, due, move project.
  - **New ticket:** template, title, project, assignee, priority, due, description (@mentions, pasted images), files, "done when", tags.
  - **Ticket page (`/t/KEY-N`):**
    - Click-to-edit title.
    - Description and Done when.
    - Checklist (reorder; finishing with open items asks for confirmation).
    - Subtasks, blockers.
    - Review card:
      - Submit with note, reviewer and QA checklist.
      - The reviewer approves (all checks pass) or sends back with reasons and "what to change".
      - Earlier rounds and revision count.
    - Files: 2MB each (we may raise this), dangerous types blocked, image viewer.
    - Activity:
      - Tabs: All, Updates & comments, History.
      - "Progress update" and "Reply to client" options, read ticks.
      - Only the author edits; moderators delete.
    - Side panel: project, status, priority, assignee + co-assignees, due, estimate, start, tags, reporter, watchers, time.
    - Header actions: Watch, Copy link, Copy to…, Repeat… (recurring rule), Delete.
- **Projects:**
  - Search, Active/Archived/All, cards grouped by department.
  - Each card: name, key, client, lead, open, overdue and done (30 days), with Board and Calendar buttons.
  - Editor fields: name, key (2–8 letters), department, client, lead, description, review required, reviewer.
- **Reviews:**
  - "Waiting for your review" and "Waiting in your department". Columns: Ticket (round N), Owner, Project, Waiting (amber after 24h).
  - QA checklists editor.
  - Quality report:
    - Range filter.
    - Stat cards: Reviewed, First time right, Sent back, Client changes, Review time.
    - Panels: "Why work goes back" and failed checks.
    - Tabs: People, Departments, Clients.
- **Templates:**
  - Cards grouped by service, showing "Used N times".
  - Fields: name, service, title pattern (`{client}` `{project}` `{month}` `{date}`), department, priority, due_in_days, done_when, checklist (one per line), subtasks (`title | +Nd`), description, tags.
  - A used template is switched off, not deleted.

### Clients
- **Client Portfolio:**
  - **Stat cards:** Clients, At risk, Open escalations, Last month's reports not sent, Meetings this week.
  - **Filters:** health (All, At risk, Watch, Healthy, New, No data), owner, service, status, search.
  - **Card grid:** health ring 0–100, status, owner, services, days since contact, next meeting.
  - **Add or edit client:** name, site, services, country, start date, channel, executive, manager, notes. Ending a client needs an end date and reason.
  - **Client page tabs (our trimmed set):**
    - Overview: facts strip, timeline, health, terms, team.
    - Contacts & team.
    - Meetings & notes.
    - Files.
    - Escalations.
    - Client portal: logins, roles, branding, "See as client".
  - **Health score:** computed nightly from overdue work, days since contact, unanswered SLA waits, overdue invoices and escalations. Bands: 75 and above Healthy, 50–74 Watch, below 50 At risk, New for the first 30 days.
- **Response times (SLA):**
  - Waits start when a client posts a comment, message or request and end at the first reply to the client.
  - Targets in working hours (reply, request, changes; 0.5–72h), with work hours, timezone and workdays in settings.
  - Range buttons: 7, 30 or 90 days.
  - Stat cards: On time %, Typical answer, Waiting now late.
  - Tabs: Waiting now, By person, By client, Answered.
  - Alerts: the answerer at the target; the manager at 2× the target.
- **Meetings:**
  - Our version: meeting notes logged against a client with decisions, concerns and action items. Each action becomes a Ticket, a Client to-do, or is skipped.
  - Tabs: To review, Recent calls (Call, Client, When, Action items), No client. "Only my clients" toggle.
  - Phase 2: Fireflies import and AI summary.
- **Files:**
  - Search across all clients (2+ characters).
  - Per-client folders: "Brand assets" and "From the client" by default, plus custom folders.
  - Versioning on re-upload with history.
  - Share or unshare with the client, move, rename, remove.
  - Brand kit: colours, fonts, tone, do's and don'ts.

### Finance
- **Dashboard:**
  - Filters: period presets, entity, currency.
  - KPIs: Invoiced, Collected, Outstanding, Overdue (plus Fees lost, Refunded, Written off, Voided).
  - Charts and tables: 12-month invoiced vs collected chart, aging buckets (not due, 1–30, 31–60, 61–90, 90+), biggest open balances, by entity, collected by channel.
  - A "N reminders to send today" banner.
  - Conversion to a base currency through `fx_rates`; payments keep the rate saved when recorded.
- **Invoices:**
  - **List:** Number, Client, Entity, Issued, Due, Total, Balance, Status. Filters: search, status (incl. open and overdue), entity, client.
  - **Statuses:** Draft, Issued, Partly paid, Paid, Void, Refunded, Partly refunded, Written off, Disputed. Overdue is derived.
  - **Editor fields:**
    - entity, client, currency, issue and due date (+7/14/30)
    - PO/reference, title
    - lines: description, detail, qty, rate, tax%
    - discount (spread before tax), channel, pay link, notes, terms
  - **Calculation:** line = qty × rate; total = subtotal − discount + tax.
  - **Numbering:** per-entity prefix, assigned on issue. Editing an issued invoice needs a reason; client and entity are locked; the total can't drop below the amount paid.
  - **Actions:** issue, duplicate, email (invoice, reminder or receipt modal with to, cc, subject, body and the PDF attached), record payment, refund, dispute or resolve, write off, void, download PDF.
- **Profitability:**
  - Month navigation.
  - Cards: Fees, Client cost, Gross margin, Overhead, After all salaries.
  - Tabs: Client, Service, Department, 6-month trend.
  - **Cost:**
    - Hourly cost = monthly salary ÷ working hours.
    - Logged hours on a client's tickets cost that client.
    - The rest of a client-facing person's time is split across their clients (estimated cost).
    - Non-client roles count as overhead.
  - **Fees:** invoiced amounts for the month, or the agreed fee if nothing was invoiced.
  - **Margin colour** uses an alert % threshold. Hours budget per client, with warnings at 80% and 100%.
- **Payments:**
  - **Received tab:**
    - Period presets.
    - Filters: client, channel, account, proof.
    - Cards: Received, Fees, Credit, Refunded, Missing proof.
  - **Still owed tab:**
    - Cards: Owed, Overdue, Credit, Clients owing.
    - Aging bars.
  - **Record payment:**
    - Client, date, currency, amount, fee.
    - Allocation to open invoices, oldest first; any remainder becomes client credit.
    - Channel, account, landed amount, reference, note.
    - Proof files, or "no proof" with a reason.
    - A duplicate warning; voiding needs a reason.
- **Billing clients:**
  - Columns: Client, Bills from, Pays by, Agreed fee, Billing email, Open balance.
  - Edit fields: legal name, contact, billing emails and cc, country, address, tax ID, entity, currency, channel, terms days, fee + basis (monthly, weekly, hourly, one-time), notes, auto-reminders.
  - Sub-accounts can be billed under a main account.
- **Payment reminder:**
  - Stages: 3 days before due, then 1, 7, 14 and 30 days late. Account managers are also told at 30 days.
  - Lists: Due today, Paused, Upcoming, Recent.
  - Row actions: Send (review email), Skip, Pause until + note, Auto on/off.
  - Bulk send.
  - The daily `pg_cron` job sends reminders for clients on auto.
- **Finance settings** (supports all of the above): entities, payment channels, FX rates, email sender.

### Team
- **Directory:** department filter and search on name, title or skills. Cards show avatar, status dot, name, title, department and status. A "clocked in" count is shown.
- **Org chart:**
  - A collapsible tree built from `manager_id`, otherwise the department head.
  - Each node shows avatar, name, title · department and a team-size count.
  - Search highlights and expands matching branches. A "Not placed yet" list holds people with no position.
- **Performance:**
  - Quarter selector.
  - Tabs: My growth (KPI scorecard: KPI, Now, Target, Score), Team, OKRs (objectives with up to 6 key results, check-ins and confidence), Training, Setup.
  - Score bands: 80 and above good, 60–79 warn, below 60 low.
  - Review cycle: self-review, then manager review, then shared, then acknowledged.

### Personal
- **My profile:**
  - Header: avatar, name, title, status.
  - Tabs (trimmed):
    - Overview: about, skills, LinkedIn, work and contact details.
    - Job.
    - Performance.
    - Documents.
    - Attendance (clock in/out month view).
    - Leave (balances and requests).
  - The person edits their own bio, skills, phone and emergency contact. HR edits job fields.
  - Phase 2: Pay and the Personal tab.
- **Time:**
  - Tabs: My week (Mon–Sun grid per ticket, plus Logged and Clocked rows), My month, Approvals, Team, By client.
  - **Timer:** top-bar chip with a 4-minute heartbeat; under 1 minute logs nothing; one timer at a time.
  - **Manual entry:** "1h 30m", date up to 7 days back, note (required for past days), billable (auto, yes or no).
  - **Week flow:** Submit locks the week; the manager approves or returns it with a note. A flag shows when logged time is under 50% of clocked time.
- **Settings:**
  - A section list with scroll-spy:
    - Design: theme, density.
    - Notifications and Email (daily, urgent or off).
    - Quiet hours.
    - Profile.
    - Phone alerts (push).
    - Sign-in & security.
  - Admin: roles and permissions matrix, invites, audit log, client-portal branding.

### Client-facing portal (clients log in)
- Same shell, with a client sidebar: Home, Work and approvals, Meetings, Files, Invoices, Messages (their client chat channel).
- They see only shared items:
  - tickets marked client-visible, using the client-facing title
  - shared files
  - shared meeting notes
  - their invoices (owner role only)
- **Approvals:** waiting, approved or changes. Reminders go to the client at 2 and 4 working days; the team is nudged at 6.
- Client replies feed the SLA clock.

## Live chat (no refresh), built on Supabase Realtime
- **Sending:**
  - An optimistic insert into `messages`: the message shows at once, marked pending.
  - The realtime echo replaces the pending copy; on failure, a "Retry" option appears.
- **Receiving:** one realtime channel per user subscribes to `postgres_changes` on `messages` for channels they belong to. RLS ensures clients see only their client channel.
- **Typing and presence:** Broadcast (expires after 6s) for typing; Presence for online dots.
- **Reads and badges:**
  - `last_read_id` per member drives Seen ticks, the "New" divider and unread and @mention badges in the sidebar, all updated live.
- **Reliability:**
  - Reconnect with backoff.
  - On reconnect, fetch messages after the last id.
  - When the socket is down, poll every 12s (the same safety net BrandSurge uses).
- **Features:**
  - **Conversation types:** channels (public, private, client), DMs, groups of up to 8.
  - **Messages:**
    - threads, reactions, edit or delete own, pin
    - forward
    - "Create ticket from message"
  - **Composer:** @mention autocomplete; markdown basics.
  - **Files:** up to 10 at a time by drag/paste; image and audio inline.
  - **Search:** across messages.
  - **Per-channel notify:** all, mentions or mute.
  - **Drafts:** saved per channel.
- **Away from the tab:** Web Push from a database trigger to an Edge Function, respecting quiet hours.
- **Phase 2:** voice notes, huddles (WebRTC), Slack bridge.

## Phase 2: full parity inside the 23 tabs (decision: capture every tab, sub-tab and detail; core first, extras next)
Phase 1 ships everything in the per-tab spec above. Phase 2 adds every remaining sub-tab and detail the original has **inside the same 23 tabs**:

- **Home:** all role panels:
  - CEO pulse (`leadership.pulse.view`)
  - HR today
  - Finance & accounts
  - My pipeline
  - Overdue by person
  - Announcements (post, pin, expire)
  - Getting started checklist
  - push-notification nudge
- **Calendar:** Google Calendar two-way sync (OAuth, "Sync now" with last-sync time), holiday and leave overlays, colleague busy/free from Google.
- **Chat:**
  - Voice notes up to 5 min.
  - Huddles: WebRTC audio/video, with signalling over Supabase Realtime and a STUN/TURN server.
  - Slack import (90 days, pause/resume) and Slack bridge.
  - Schedule meeting from a channel.
  - Channel settings: admins-only posting, archive.
- **Tickets:**
  - **Workload view:**
    - planned vs capacity per person per week, Mon–Sun grid
    - capacity alerts (Overloaded / Has room, "Move to…", Handled/Undo)
    - settings: overloaded %, overdue count, has-room %, unestimated minutes
  - **Recurring tab:** list and manage all repeat rules, with daily, weekdays, weekly, monthly, due offset, pause.
  - **Ticket page:**
    - co-assignees and watcher picker
    - dependencies (blockers)
    - client card: client-visible title, plain-words details, ticked files, "Needs client approval"
    - scope flag (out of scope against the client's terms)
- **Reviews:** Quality report adds the Services and Most-revised tabs and the "QA checks failed most" panel.
- **Client page:** all 17 tabs.
  1. **Overview:** facts strip, Commitments vs delivery, Performance last 28 days with sparklines, Timeline, Onboarding, Terms, Health, Upcoming meetings, Open escalations, Team.
  2. **Accounts/Projects:** for agency clients, with linked sub-accounts.
  3. **Commitments:**
     - Kinds: kpi, deliverable, milestone.
     - Cadence: weekly, monthly, quarterly, once.
     - Status: met, on track, at risk, missed.
     - Check-ins.
  4. **Relationship:**
     - Summary: tier A/B/C, rapport, profile completion %.
     - People: decision power and personal profile.
     - Records: Moments (next 90 days), key dates, relationship log (wish, gift, card, win, complaint, touch).
     - Prep: meeting briefs, niche profile, social and competitors, opportunities.
     - Privacy: "remove on request".
  5. **Meetings & notes:** schedule, log notes with action items, Fireflies calls, quick "log a call/WhatsApp/note".
  6. **Reports:**
     - Monthly reports: draft, submitted, approved/changes, sent, with due day, auto-send, highlights, plan, preview.
     - QBRs: draft, ready, presented.
  7. **Escalations:** severity sets the response window, an auto ticket, and a 1–5 client rating.
  8. **Delivery ratings:** monthly 1–5 for quality, on time and communication per team.
  9. **Contacts & team:** main contact, gets reports, team roles (delivery lead, delivery, backup).
  10. **Files:** as Files tab, plus a linked Google Drive browser.
  11. **Performance:**
      - Data sources: GSC, GA4, Google Business Profile, Google Ads, Meta. Each can be connected, refreshed or disconnected.
      - 28-day vs prior-28 snapshot.
  12. **Analysis.**
  13. **Ads:** when the client has PPC services.
  14. **Leads:** website and ads leads with outcomes.
  15. **Website.**
  16. **SEO.**
  17. **Client portal:**
      - Logins: owner, viewer, leads-only roles, invites, multi-business links.
      - Branding: logo and colour.
      - Vault: saved logins with logged reveals that auto-hide after 30s.
      - Activity lines: draft, shared or hidden.
      - "See as client" (30-minute preview).
  - **Also on the client page:** terms card (fee, term, notice, hours/month with an 80%/100% bar, in/out of scope, signed agreement, renewal), health card (sentiment, churn alerts and outcomes), AI email draft (friendly, formal, brief), delete with name confirmation, win-back for ended clients, Status review, "By owner" table on the portfolio.
- **Response times:** client email inboxes (shared Gmail polled every 10 min, with counts: New tickets, Added to tickets, Not from a client, Automatic, From us).
- **Meetings:** Fireflies import, matched to clients by email, domain or title. AI summary: decisions, concerns with quotes, action items. "Read now / Read again". No-client assignment.
- **Files:** Google Drive read-only browse, brand kit links and audience.
- **Finance:**
  - Monthly drafts (`finance.drafts.create`).
  - Record past invoice (`record_past`), original-document upload, invoice visibility in the client portal.
  - Apply client credit; "give it back" (refund credit).
  - Upwork earnings.
  - Exports.
  - Finance settings: email sending status.
  - Sub-account linked billing.
- **Team:**
  - Directory: clocked-in count.
  - Org chart: cycle-safe tree.
  - Performance:
    - training paths: course, video, reading, practice and certification steps
    - Setup tab: KPIs with portal or manual source, weight, direction
    - review cycles: open/close with self and manager due dates
    - a separate `/me/performance` page
- **My profile:** all 10 tabs.
  - Overview, Job (probation: confirm, extend +30/60/90, end; job description versions).
  - Pay: salary components, history, payslips, the "split a gross" helper.
  - Performance reviews: share and acknowledge.
  - Documents: HR-only flag, expiry, 15MB.
  - Tools: grant/revoke access, never passwords.
  - Attendance: clock in/out/break; WFH and overtime requests; month calendar; punctuality stats.
  - Leave: balances, annual planner with 7-day notice, half days, HR record and revoke.
  - Personal: DOB, ID, tax, bank/IBAN, with change log.
  - Leaving: exit reasons, offboarding checklist, "They're staying".
  - HR forms: HR details, title change (promotion, transfer, title) with a congratulations post.
  - Clock widget warns when clocking out early.
- **Time:** By client tab with billable split; the 50%-of-clocked flag; timesheet export.
- **Settings:**
  - Design: client-portal design and company default (admin).
  - Notifications log, audit log.
  - API keys (scoped, shown once) and API docs page.
  - Slack user ID.
  - Sign-in & security: password, sessions, 2-step.

**Phase 2 needs from the user:** API access or accounts for Google (Calendar, Drive, GSC, GA4, GBP, Ads), Meta, Fireflies, Slack, Gmail domain-wide delegation, and an AI provider key for summaries and email drafts. Without these, those features stay as UI and data models with a "Connect" button.

## Still outside the 23 tabs (not planned unless asked)
Other sidebar sections of the original:
- Mail.
- Clients extras: Account pulse, Ad changes and alerts, Opportunities, Growth pipeline, Seasonal planner, Playbooks, scorecards, ICP, Client approvals page, Monthly/Weekly/Quarterly report hubs, Health, Churn, Growth and NPS pages, Renewals, Success overview, Google properties and Meta accounts pages.
- BD/CRM.
- Talent Surge.
- People extras: 1:1s, Recruitment, Contracts, Onboarding, Team survey, HR workspace, Payroll, Employee of the Month.
- Company: Knowledge Base, Tools, Surge AI, roadmap.
- Accounting and Bank.
- White-label multi-company billing.

## Known limits
- Server-only formulas can't be read from outside. We define our own: health-score weights, the quarter KPI score formula, attendance stats, SLA default hours (09:00–18:00 Mon–Fri Dubai assumed).
- The client portal's own pages (as clients see them) were not visible in the public code. They're designed from the team-side configuration.

## Step 0: clickable UI preview (before any real code)
- A private Claude artifact built as a static mockup of all 23 tabs plus the client portal, with fictional sample data.
- Built from the scratchpad `ui-preview/` folder (`kit.js` + `CONTRACT.md` already written).
- Eight Opus builders, one file each: shell (`index.html`, `app.css`, `app.js`), `screens/core.js`, `chat.js`, `work.js`, `clients.js`, `finance.js`, `team.js`, `portal.js`. Each already has a build outline from its first run.
- Then publish with `publish_files` and give the user the link.
- No files in `E:\BrandSurge CRO`. Real coding (Wave 0 onward) starts only when the user says "yes".

## Build plan (subagents, each owns separate folders; builders `model: "opus"`, checks `model: "sonnet"`/`"haiku"`)
| Wave | Agent work | Est. |
|---|---|---|
| 0 | **Foundation, done by me plus one Opus agent:** Next.js scaffold, Tailwind tokens, shell (sidebar, top bar, command palette, mobile drawer), auth screens, Supabase schema + RLS + `can()`, seed data, PWA manifest | ~25 min |
| 1 (parallel) | Six Opus builders, one per group, each owning `app/(app)/<group>/**` and its own SQL migration file: Core (Home, My work, Calendar), **Chat** (realtime), Work (Tickets + ticket page, Projects, Reviews, Templates), Clients (Portfolio + client page, SLA, Meetings, Files), Finance (all 6 + settings + PDF + reminder cron), Team + Personal (Directory, Org, Performance, Profile, Time, Settings) | ~15–20 min |
| 1 (parallel) | Read-only Sonnet checks: lint and typecheck, RLS policy audit, design-rule audit (no pills, eyebrows or small-print lines) | alongside |
| 2 | Client-facing portal views + approvals (Opus); then Haiku agents run Playwright screenshots of every tab on desktop and mobile | ~15 min |
| 3 | Vercel **preview** deploy; the link goes to the user; production waits for "push" | ~3 min |
| 4 (Phase 2, parallel) | Opus builders, one per area: client page (all 17 tabs), chat extras (voice, huddles, Slack), Tickets extras (Workload, Recurring, client card), Finance extras, Profile/HR tabs, Settings/admin + Performance setup, integrations (Google, Fireflies, Gmail, Meta) | ~40–60 min |
| 5 | Screenshot sweep, checks and a second preview deploy | ~10 min |

Phase 1 is roughly 1–1.5 hours of agent time; Phase 2 adds about 1 hour plus the time to set up integration accounts (a guess). Coding starts only after the user says "yes".

## Verification
- `pnpm typecheck && pnpm lint && pnpm build` are clean.
- **Chat realtime test:** two browser sessions (a team user and a client user). Messages, typing, read ticks and unread badges update with no refresh. Kill the network for 30s and confirm catch-up on reconnect.
- **RLS tests (SQL):** a client user can't read another client's tickets, files, invoices or channels; a member without finance permissions gets nothing from the finance tables.
- **Finance maths unit tests:** invoice totals with discount and tax; payment allocation oldest-first with credit; aging buckets; reminder stage dates; profitability cost split.
- Playwright screenshot sweep of all 23 tabs plus the client portal at 1440px and 390px.
- Vercel preview link handed over; nothing goes to production before "push".

## Open gaps (to fill from the REA live pass)
- Exact Home role panels as the user sees them.
- Ticket co-assignee and dependency UI.
- Settings → Notifications contents.
- Client portal's own pages, as clients see them.
- The SLA default working hours.
- How the health score is weighted.

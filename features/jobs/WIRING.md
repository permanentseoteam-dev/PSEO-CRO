# Scheduled jobs: wiring

All scheduled work runs from **pg_cron** in Supabase. Vercel Cron isn't used (Hobby is daily-only). All times are Asia/Dubai, which is UTC+4 all year; pg_cron runs in UTC, so each cron expression is the Dubai time minus 4 hours.

## Files

| File | What it does |
| --- | --- |
| `supabase/migrations/0210_scheduled_jobs.sql` | Extensions `pg_cron` and `pg_net`, the `private.app_config` table, `job_runs` and the `job_last_runs` view, the database jobs, `job_perm_holders()`, and every `cron.schedule`. Idempotent. |
| `app/api/cron/[job]/route.ts` | `POST /api/cron/<job>` for the app jobs. |
| `app/api/cron/health-recalc/route.ts` | `POST /api/cron/health-recalc`, same runner. |
| `features/jobs/run.ts` | Shared route body: Bearer check, run, write `job_runs`. |
| `features/jobs/handlers.ts` | The app jobs. |
| `features/jobs/logic.ts` | Pure rules (Dubai dates, due-day matching, SLA marks, job list). Tested in `__tests__/logic.test.ts`. |
| `features/jobs/components/scheduled-jobs.tsx` | `ScheduledJobsSection`, the read-only admin card. |

## Steps for the lead

1. **Make `/api/cron` public in the proxy (required).** `lib/supabase/proxy.ts` sends every signed-out request to `/login`, and that includes the pg_net calls. Add `"/api/cron"` to `PUBLIC_PATHS`, next to `"/api/v1"`. The route checks its own secret.
2. **Set the env var** `CRON_SECRET` on Vercel (Production and Preview) and in `.env.local`. Use a long random value, for example `openssl rand -hex 32`. Without it, every call gets 401.
3. **Apply `0210_scheduled_jobs.sql`.** It needs 0101, 0106, 0109, 0111, 0113, 0201, 0204, 0205, 0207 and 0209. It also unschedules 0204's `work-p2-recurring-tickets` job (00:05 UTC) because `portal-recurring-tickets` replaces it.
4. **Fill in the app config** in the SQL editor. This can't be done through the API, because the `private` schema is closed to anon and authenticated:
   ```sql
   update private.app_config set value = 'https://<production-domain>', updated_at = now() where key = 'app_url';
   update private.app_config set value = '<same value as CRON_SECRET>', updated_at = now() where key = 'cron_secret';
   ```
   Until both rows are set, each app job writes a `skipped` run with the detail "App URL or cron secret not set". Point `app_url` at production only, not at a preview URL.
5. **Admin card (done).** `app/(app)/settings/page.tsx` mounts it through `adminSections` as `{ id: "jobs", label: "Scheduled jobs", node: <ScheduledJobsSection /> }`; Settings supplies the card and title. It is a server component, and it also returns `null` for anyone without `admin.access.manage` at `all` scope.

## Jobs

| Job (`job_runs.job`) | cron name | Dubai time | UTC cron | How |
| --- | --- | --- | --- | --- |
| `recurring-tickets` | `portal-recurring-tickets` | daily 06:00 | `0 2 * * *` | SQL: `run_recurring_rules(<Dubai today>)` |
| `reminders-sync` | `portal-reminders-sync` | daily 07:00 | `0 3 * * *` | SQL: `sync_payment_reminders()` |
| `reminders-autosend` | `portal-reminders-autosend` | daily 08:00 | `0 4 * * *` | App: no email provider, so it logs `skipped` with the due count and leaves reminders pending |
| `monthly-drafts` | `portal-monthly-drafts` | 1st, 06:00 | `0 2 1 * *` | App: `buildMonthlyDrafts()` for the current month, for active or onboarding clients with an entity. Idempotent through `monthly_drafts (client_id, month)` |
| `report-autosend` | `portal-report-autosend` | daily 09:00 | `0 5 * * *` | App: approved auto-send reports with `due_on <= today`. With no mailer it sets `monthly_reports.send_pending_at` and logs `skipped`. Once `getMailer()` is configured, it sends to `client_success_profiles.report_recipient` and sets `status = 'sent'` |
| `title-changes` | `portal-title-changes` | daily 00:05 | `5 20 * * *` | SQL: applies due future-dated `career_steps` to `members.title/department_id` and sets `career_steps.applied_at` |
| `health-recalc` | `portal-health-recalc` | daily 01:30 | `30 21 * * *` | App: `computeHealth()` (lib/modules/clients/queries) for every active or onboarding client, saving `health_score/band/factors/at`. Runs before 0211's `client-health-snapshot` (02:00 Dubai) |
| `calendar-sync` | `portal-calendar-sync` | every 15 min | `*/15 * * * *` | App: `skipped` while the Google Calendar adapter is not configured |
| `inbox-poll` | `portal-inbox-poll` | every 10 min | `*/10 * * * *` | App: `skipped` while the Gmail adapter is not configured |
| `fireflies-import` | `portal-fireflies-import` | hourly | `0 * * * *` | App: `skipped` while the Fireflies adapter is not configured |
| `huddle-cleanup` | `portal-huddle-cleanup` | every 15 min | `*/15 * * * *` | SQL: ends live huddles that have had nobody in them for 5 min, or that have run for more than 8 h |
| `sla-alerts` | `portal-sla-alerts` | every 15 min | `*/15 * * * *` | App: working-hours wait via `workingMinutes()`. It sets `sla_waits.late_at` at the target and `late2x_at` at 2× the target. It notifies the answerer at the target and their manager at 2× (falling back to the client's manager), following `sla_settings.alert_*` |
| `timer-cleanup` | `portal-timer-cleanup` | every 10 min | `*/10 * * * *` | SQL: stops timers whose last heartbeat is more than 10 min old and logs whole minutes up to that heartbeat |
| `profitability-alert` | `portal-profitability-alert` | 2nd, 09:00 | `0 5 2 * *` | App: `getProfitability()` for last month. It sends an in-app notification to everyone with `finance.profitability.view` at `all` scope, once per day |
| (purge) | `portal-job-runs-purge` | daily 01:15 | `15 21 * * *` | SQL: deletes `job_runs` older than 30 days. It doesn't log itself |

The app jobs that run on a set day (`monthly-drafts`, `profitability-alert`) check the Dubai date themselves. If they are called on another day, they log `skipped`.

## Checking

```sql
select jobname, schedule, active from cron.job where jobname like 'portal-%' order by jobname;
select * from cron.job_run_details order by start_time desc limit 20;   -- pg_cron side
select * from net._http_response order by created desc limit 20;        -- pg_net replies to app jobs (kept ~6 h)
select * from public.job_last_runs;                                      -- what each job did
```

To trigger an app job by hand:

```
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/sla-alerts
```

The route returns `{ job, status, detail }`. The status code is 500 when the job errors.

## Later, when providers are connected

- **Reminder auto-send:** once `getEmailSender()` returns a configured sender, `reminders-autosend` logs an error that says it isn't wired yet. Build the reminder email (template and PDF, the same as the Phase 1 reminder modal) in `remindersAutosend()` in `handlers.ts`. Then set `reminders.status = 'sent'`, `sent_at`, `result`, and write `email_log`.
- **Google Calendar, Gmail and Fireflies:** once an adapter reports `configured`, its job logs an error until the sync, poll or import body is written in `handlers.ts`. For Gmail and Fireflies, that body upserts `inbox_messages` and `fireflies_calls`.

# Wiring: hr-p2 (profile, HR and performance extras)

This folder holds the Pay, Tools, Personal and Leaving profile tabs, the HR forms (HR details, probation, title change), the clock widget with its early clock-out warning, and the Performance Training and Setup tabs. Everything lives in `features/hr-p2/`. No Phase 1 folders were touched.

## Files
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

## 1. My profile (`app/(app)/me/page.tsx`, personal module) and someone else's profile (`app/(app)/people/[id]/page.tsx`, team module, if it exists)
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

## 2. Payslip PDF route (NEW file, personal module)
`app/(app)/me/payslips/[id]/route.ts`:
```ts
import { payslipPdfResponse } from "@/features/hr-p2/payslip-pdf";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  return payslipPdfResponse((await params).id);
}
```
The same route serves HR viewing someone else's payslips, because RLS plus `hr.pay.view` decide access. If you mount it elsewhere, pass that path as `payslipBase`.

## 3. Performance (`app/(app)/performance/page.tsx`, team module)
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

## 4. Optional extra mounts
- **Home or Time:** `<ClockWidget />` can also sit on Home ("HR today") or above Time → My week.
- **Directory "clocked in" count:** `select count(*) from hr_clock_days where work_date = <today Dubai> and clock_out_at is null`. RLS shows other people's rows only with `hr.attendance.view`. For a company-wide count, use `createAdminClient` after a `can()` check.
- **Attendance month view (0113_personal):** if Phase 1's `attendance` table is separate, read `hr_clock_days` for the month instead, or have 0113 point at it. `workedMinutes()`, `localHm()` and `isEarlyClockOut()` live in `logic.ts`.

## 5. Chat: title-change congratulations (chat module)
`saveTitleChange` stores `post_congrats = true` and leaves `congrats_posted_at` null. The chat wire-in should post "Congratulations to {name}, now {new_title}!" in #general for those rows, then set `congrats_posted_at = now()`. It can do this in the same action, after the insert, through its own `postSystemMessage()`, or as a small job.

## 6. Nav and permissions
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

## 7. Phase 1 overlap (read before applying migrations)
Every table uses the `hr_` prefix, so nothing collides with 0112_team or 0113_personal. Where Phase 1 built something similar, keep one source of truth:
- **KPIs and review cycles:** if `0112_team` already has `kpis` and `review_cycles`, the Setup tab still writes to `hr_kpis` and `hr_review_cycles`. Point the scorecard and self-review at these, or drop the 0112 versions. The lead decides.
- **Training:** if `0112_team` has a `training` table, `hr_training_*` replaces it.
- **Attendance:** see section 4.

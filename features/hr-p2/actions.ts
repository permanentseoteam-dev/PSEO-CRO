"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getMe, can, type Me } from "@/lib/auth/can";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EXIT_CHECKLIST, EXIT_REASONS, extendProbation, localDate, parseSteps, PROBATION_EXTENSIONS, SECRET_FIELDS } from "./logic";
import { CONTRACTS, CURRENCIES, KPI_DIRECTIONS, KPI_SOURCES, TITLE_CHANGE_KINDS, type ClockDay, type PersonalView, type Result } from "./types";

// Every action: zod parse -> can() check -> Supabase write as the user (RLS is the real guard) -> revalidate.
// Writes that RLS silently filters (team scope, someone outside my team) come back with no rows: we report that.

const FORM_ERROR = "Check the form and try again.";
const NO_ACCESS = "You don't have access to do that.";
const fail = (error: string) => ({ ok: false as const, error });

const id = z.uuid();
const text = (max = 200) => z.string().trim().min(1).max(max);
const optText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));
const date = z.iso.date();
const optDate = z
  .union([z.iso.date(), z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null));
const time = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/);
const money = z.coerce.number().min(0).max(100_000_000);

const today = () => localDate(new Date());

function refresh() {
  revalidatePath("/me", "layout");
  revalidatePath("/people", "layout");
  revalidatePath("/performance", "layout");
}

async function staff(): Promise<Me | null> {
  const me = await getMe();
  return me && me.kind === "staff" ? me : null;
}

// ---------------------------------------------------------------- pay

const PayInput = z.object({
  memberId: id,
  effectiveFrom: date,
  basic: money,
  house_rent: money,
  utilities: money,
  medical: money,
  other: money,
  currency: z.enum(CURRENCIES),
  reason: optText(200),
});

/** Add a pay change (or replace the one on the same date). History is every row. */
export async function savePayRecord(raw: unknown): Promise<Result> {
  const p = PayInput.safeParse(raw);
  if (!p.success) return fail(FORM_ERROR);
  const me = await staff();
  if (!me || !can(me, "hr.pay.manage", "all")) return fail(NO_ACCESS);
  const d = p.data;
  const supabase = await createClient();
  const { error } = await supabase.from("hr_pay_records").upsert(
    {
      member_id: d.memberId,
      effective_from: d.effectiveFrom,
      basic: d.basic,
      house_rent: d.house_rent,
      utilities: d.utilities,
      medical: d.medical,
      other: d.other,
      currency: d.currency,
      reason: d.reason,
      created_by: me.id,
    },
    { onConflict: "member_id,effective_from" },
  );
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

const PayslipInput = z
  .object({
    memberId: id,
    month: z.string().regex(/^\d{4}-\d{2}$/),
    gross: money,
    deductions: money,
    currency: z.enum(CURRENCIES),
    notes: optText(300),
  })
  .refine((v) => v.deductions <= v.gross);

export async function savePayslip(raw: unknown): Promise<Result> {
  const p = PayslipInput.safeParse(raw);
  if (!p.success) return fail(FORM_ERROR);
  const me = await staff();
  if (!me || !can(me, "hr.pay.manage", "all")) return fail(NO_ACCESS);
  const d = p.data;
  const supabase = await createClient();
  const { error } = await supabase.from("hr_payslips").upsert(
    { member_id: d.memberId, month: `${d.month}-01`, gross: d.gross, deductions: d.deductions, currency: d.currency, notes: d.notes, created_by: me.id },
    { onConflict: "member_id,month" },
  );
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------- tools (never passwords)

const GrantInput = z.object({ memberId: id, tool: text(80), login: optText(200), accessLevel: optText(80) });

export async function grantTool(raw: unknown): Promise<Result> {
  const p = GrantInput.safeParse(raw);
  if (!p.success) return fail(FORM_ERROR);
  const me = await staff();
  if (!me || !can(me, "hr.records.manage", "team")) return fail(NO_ACCESS);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("hr_tool_access")
    .insert({ member_id: p.data.memberId, tool: p.data.tool, login: p.data.login, access_level: p.data.accessLevel, granted_on: today(), granted_by: me.id })
    .select("id");
  if (error) return fail(error.message.includes("row-level security") ? NO_ACCESS : error.message);
  if (!data?.length) return fail(NO_ACCESS);
  refresh();
  return { ok: true };
}

export async function revokeTool(raw: unknown): Promise<Result> {
  const p = z.object({ id }).safeParse(raw);
  if (!p.success) return fail(FORM_ERROR);
  const me = await staff();
  if (!me || !can(me, "hr.records.manage", "team")) return fail(NO_ACCESS);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("hr_tool_access")
    .update({ revoked_at: new Date().toISOString(), revoked_by: me.id })
    .eq("id", p.data.id)
    .is("revoked_at", null)
    .select("id");
  if (error) return fail(error.message);
  if (!data?.length) return fail(NO_ACCESS);
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------- personal

const PersonalInput = z.object({
  memberId: id,
  dateOfBirth: optDate,
  idType: z.string().trim().min(1).max(40).default("Emirates ID"),
  idNumber: optText(40),
  taxNumber: optText(40),
  bankName: optText(80),
  iban: optText(40),
});

/** Save personal details. Blank ID, tax number and IBAN keep the saved value (the form never holds them). */
export async function savePersonal(raw: unknown): Promise<Result> {
  const p = PersonalInput.safeParse(raw);
  if (!p.success) return fail(FORM_ERROR);
  const me = await staff();
  const d = p.data;
  if (!me || (d.memberId !== me.id && !can(me, "hr.records.manage", "all"))) return fail(NO_ACCESS);
  const row: Record<string, unknown> = { member_id: d.memberId, date_of_birth: d.dateOfBirth, id_type: d.idType, bank_name: d.bankName };
  if (d.idNumber) row.id_number = d.idNumber;
  if (d.taxNumber) row.tax_number = d.taxNumber;
  if (d.iban) row.iban = d.iban.toUpperCase();
  const supabase = await createClient();
  const { error } = await supabase.from("hr_personal_details").upsert(row, { onConflict: "member_id" });
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

/** Full ID, tax number and IBAN for the Show button. RLS decides who gets them. */
export async function revealPersonal(raw: unknown): Promise<Result<Pick<PersonalView, (typeof SECRET_FIELDS)[number]>>> {
  const p = z.object({ memberId: id }).safeParse(raw);
  if (!p.success) return fail(FORM_ERROR);
  const me = await staff();
  if (!me || (p.data.memberId !== me.id && !can(me, "hr.personal.view", "team"))) return fail(NO_ACCESS);
  const supabase = await createClient();
  const { data } = await supabase.from("hr_personal_details").select("id_number, tax_number, iban").eq("member_id", p.data.memberId).maybeSingle();
  if (!data) return fail(NO_ACCESS);
  return { ok: true, data: data as Pick<PersonalView, (typeof SECRET_FIELDS)[number]> };
}

// ---------------------------------------------------------------- leaving

const ExitInput = z.object({ memberId: id, lastDay: optDate, reason: z.enum(EXIT_REASONS), notes: optText(1000) });

/** Start an exit with the standard offboarding checklist. */
export async function startExit(raw: unknown): Promise<Result> {
  const p = ExitInput.safeParse(raw);
  if (!p.success) return fail(FORM_ERROR);
  const me = await staff();
  if (!me || !can(me, "hr.records.manage", "team")) return fail(NO_ACCESS);
  if (p.data.memberId === me.id) return fail("You can't start your own exit.");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("hr_exits")
    .insert({ member_id: p.data.memberId, last_day: p.data.lastDay, reason: p.data.reason, notes: p.data.notes, started_by: me.id })
    .select("id")
    .single();
  if (error) return fail(error.code === "23505" ? "An exit is already open for this person." : error.message);
  const { error: e2 } = await supabase.from("hr_exit_tasks").insert(EXIT_CHECKLIST.map((label, i) => ({ exit_id: data.id, position: i + 1, label })));
  if (e2) return fail(e2.message);
  refresh();
  return { ok: true };
}

export async function setExitTask(raw: unknown): Promise<Result> {
  const p = z.object({ taskId: id, done: z.boolean() }).safeParse(raw);
  if (!p.success) return fail(FORM_ERROR);
  const me = await staff();
  if (!me || !can(me, "hr.records.manage", "team")) return fail(NO_ACCESS);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("hr_exit_tasks")
    .update(p.data.done ? { done_at: new Date().toISOString(), done_by: me.id } : { done_at: null, done_by: null })
    .eq("id", p.data.taskId)
    .select("id");
  if (error) return fail(error.message);
  if (!data?.length) return fail(NO_ACCESS);
  refresh();
  return { ok: true };
}

/** "They're staying": cancel the open exit. The checklist stays on record. */
export async function cancelExit(raw: unknown): Promise<Result> {
  const p = z.object({ exitId: id }).safeParse(raw);
  if (!p.success) return fail(FORM_ERROR);
  const me = await staff();
  if (!me || !can(me, "hr.records.manage", "team")) return fail(NO_ACCESS);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("hr_exits")
    .update({ status: "cancelled", closed_by: me.id, closed_at: new Date().toISOString() })
    .eq("id", p.data.exitId)
    .eq("status", "started")
    .select("id");
  if (error) return fail(error.message);
  if (!data?.length) return fail(NO_ACCESS);
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------- HR details, probation, title change

const HrInput = z
  .object({
    memberId: id,
    title: text(120),
    departmentId: id.nullable(),
    managerId: id.nullable(),
    contract: z.enum(CONTRACTS),
    joinedOn: optDate,
    shiftStart: time,
    shiftEnd: time,
    location: optText(120),
  })
  .refine((v) => v.shiftEnd > v.shiftStart)
  .refine((v) => v.managerId !== v.memberId);

/** Title, department and manager live on members (admin-only columns), the rest on hr_employment. */
export async function saveHrDetails(raw: unknown): Promise<Result> {
  const p = HrInput.safeParse(raw);
  if (!p.success) return fail(FORM_ERROR);
  const me = await staff();
  if (!me || !can(me, "hr.records.manage", "all")) return fail(NO_ACCESS);
  const d = p.data;
  const supabase = await createClient();
  const { error } = await supabase.from("hr_employment").upsert(
    { member_id: d.memberId, contract: d.contract, joined_on: d.joinedOn, shift_start: d.shiftStart, shift_end: d.shiftEnd, location: d.location },
    { onConflict: "member_id" },
  );
  if (error) return fail(error.message);
  // members_guard() only lets admins change these columns; can() above already checked HR has "all".
  const { error: e2 } = await createAdminClient()
    .from("members")
    .update({ title: d.title, department_id: d.departmentId, manager_id: d.managerId })
    .eq("id", d.memberId)
    .eq("kind", "staff");
  if (e2) return fail(e2.message);
  refresh();
  return { ok: true };
}

const ProbationInput = z.object({
  memberId: id,
  action: z.enum(["confirm", "extend", "end"]),
  days: z.union(PROBATION_EXTENSIONS.map((n) => z.literal(n)) as [z.ZodLiteral<30>, z.ZodLiteral<60>, z.ZodLiteral<90>]).optional(),
});

export async function probationAction(raw: unknown): Promise<Result> {
  const p = ProbationInput.safeParse(raw);
  if (!p.success || (p.data.action === "extend" && !p.data.days)) return fail(FORM_ERROR);
  const me = await staff();
  if (!me || !can(me, "hr.records.manage", "team")) return fail(NO_ACCESS);
  if (p.data.memberId === me.id) return fail("Someone else has to decide your probation.");
  const supabase = await createClient();
  const { data: cur } = await supabase.from("hr_employment").select("probation_status, probation_end").eq("member_id", p.data.memberId).maybeSingle();
  if (!cur) return fail(NO_ACCESS);
  if (cur.probation_status !== "on_probation") return fail("Probation is already over.");
  const now = new Date().toISOString();
  const patch =
    p.data.action === "extend"
      ? { probation_end: extendProbation(cur.probation_end as string | null, p.data.days!, today()) }
      : { probation_status: p.data.action === "confirm" ? "confirmed" : "ended", probation_end: today(), probation_decided_by: me.id, probation_decided_at: now };
  const { data, error } = await supabase.from("hr_employment").update(patch).eq("member_id", p.data.memberId).select("id");
  if (error) return fail(error.message);
  if (!data?.length) return fail(NO_ACCESS);
  refresh();
  return { ok: true };
}

const TitleInput = z.object({
  memberId: id,
  kind: z.enum(TITLE_CHANGE_KINDS),
  effectiveOn: date,
  newTitle: text(120),
  newDepartmentId: id.nullable(),
  postCongrats: z.boolean(),
});

/**
 * Promotion, transfer or title change. Recorded now; the member's title and department change now when the
 * date is today or earlier. The #general congratulations post is made by the chat wire-in (see WIRING.md).
 */
export async function saveTitleChange(raw: unknown): Promise<Result<{ applied: boolean }>> {
  const p = TitleInput.safeParse(raw);
  if (!p.success) return fail(FORM_ERROR);
  const me = await staff();
  if (!me || !can(me, "hr.records.manage", "all")) return fail(NO_ACCESS);
  const d = p.data;
  const admin = createAdminClient();
  const { data: m } = await admin.from("members").select("title, department_id, kind").eq("id", d.memberId).maybeSingle();
  if (!m || m.kind !== "staff") return fail(FORM_ERROR);
  const supabase = await createClient();
  const { error } = await supabase.from("hr_title_changes").insert({
    member_id: d.memberId,
    kind: d.kind,
    effective_on: d.effectiveOn,
    old_title: m.title,
    new_title: d.newTitle,
    old_department_id: m.department_id,
    new_department_id: d.newDepartmentId ?? m.department_id,
    post_congrats: d.postCongrats,
    created_by: me.id,
  });
  if (error) return fail(error.message);
  const applied = d.effectiveOn <= today();
  if (applied) {
    const { error: e2 } = await admin
      .from("members")
      .update({ title: d.newTitle, department_id: d.newDepartmentId ?? m.department_id })
      .eq("id", d.memberId);
    if (e2) return fail(e2.message);
  }
  refresh();
  return { ok: true, data: { applied } };
}

// ---------------------------------------------------------------- clock

/** Clock in, break, clock out. Times come from the database clock (hr_clock_action). */
export async function clock(raw: unknown): Promise<Result<ClockDay>> {
  const p = z.object({ action: z.enum(["in", "break_start", "break_end", "out"]) }).safeParse(raw);
  if (!p.success) return fail(FORM_ERROR);
  const me = await staff();
  if (!me) return fail(NO_ACCESS);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("hr_clock_action", { p_action: p.data.action });
  if (error) return fail(error.message);
  refresh();
  return { ok: true, data: data as ClockDay };
}

// ---------------------------------------------------------------- performance setup

const KpiInput = z.object({
  id: id.optional(),
  name: text(120),
  source: z.enum(KPI_SOURCES),
  weight: z.coerce.number().int().min(1).max(100),
  direction: z.enum(KPI_DIRECTIONS),
  departmentId: id.nullable(),
});

export async function saveKpi(raw: unknown): Promise<Result> {
  const p = KpiInput.safeParse(raw);
  if (!p.success) return fail(FORM_ERROR);
  const me = await staff();
  if (!me || !can(me, "perf.setup.manage", "all")) return fail(NO_ACCESS);
  const d = p.data;
  const row = { name: d.name, source: d.source, weight: d.weight, direction: d.direction, department_id: d.departmentId };
  const supabase = await createClient();
  const { error } = d.id ? await supabase.from("hr_kpis").update(row).eq("id", d.id) : await supabase.from("hr_kpis").insert(row);
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

/** KPIs with scores against them are switched off, not deleted. */
export async function setKpiActive(raw: unknown): Promise<Result> {
  const p = z.object({ id, active: z.boolean() }).safeParse(raw);
  if (!p.success) return fail(FORM_ERROR);
  const me = await staff();
  if (!me || !can(me, "perf.setup.manage", "all")) return fail(NO_ACCESS);
  const supabase = await createClient();
  const { error } = await supabase.from("hr_kpis").update({ active: p.data.active }).eq("id", p.data.id);
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

const CycleInput = z
  .object({ name: text(40), selfDue: date, managerDue: date })
  .refine((v) => v.managerDue >= v.selfDue, { message: "The manager review is due after the self-review." });

export async function createCycle(raw: unknown): Promise<Result> {
  const p = CycleInput.safeParse(raw);
  if (!p.success) return fail(p.error.issues[0]?.message ?? FORM_ERROR);
  const me = await staff();
  if (!me || !can(me, "perf.setup.manage", "all")) return fail(NO_ACCESS);
  const supabase = await createClient();
  const { error } = await supabase
    .from("hr_review_cycles")
    .insert({ name: p.data.name, self_due: p.data.selfDue, manager_due: p.data.managerDue, status: "open", opened_at: new Date().toISOString() });
  if (error) return fail(error.code === "23505" ? "A cycle with that name already exists." : error.message);
  refresh();
  return { ok: true };
}

export async function setCycleStatus(raw: unknown): Promise<Result> {
  const p = z.object({ id, status: z.enum(["open", "closed"]) }).safeParse(raw);
  if (!p.success) return fail(FORM_ERROR);
  const me = await staff();
  if (!me || !can(me, "perf.setup.manage", "all")) return fail(NO_ACCESS);
  const now = new Date().toISOString();
  const supabase = await createClient();
  const { error } = await supabase
    .from("hr_review_cycles")
    .update(p.data.status === "open" ? { status: "open", opened_at: now, closed_at: null } : { status: "closed", closed_at: now })
    .eq("id", p.data.id);
  if (error) return fail(error.message);
  refresh();
  return { ok: true };
}

const PathInput = z.object({ name: text(120), steps: z.string().max(5000) });

/** New training path from a name and "Type: title" lines. */
export async function createPath(raw: unknown): Promise<Result> {
  const p = PathInput.safeParse(raw);
  if (!p.success) return fail(FORM_ERROR);
  const { steps, errors } = parseSteps(p.data.steps);
  if (errors.length) return fail(`Line ${errors.join(", ")}: start with Course, Video, Reading, Practice or Certification, then a colon.`);
  if (!steps.length) return fail("Add at least one step.");
  const me = await staff();
  if (!me || !can(me, "perf.setup.manage", "all")) return fail(NO_ACCESS);
  const supabase = await createClient();
  const { data, error } = await supabase.from("hr_training_paths").insert({ name: p.data.name, created_by: me.id }).select("id").single();
  if (error) return fail(error.message);
  const { error: e2 } = await supabase.from("hr_training_steps").insert(steps.map((s, i) => ({ path_id: data.id, position: i + 1, kind: s.kind, title: s.title })));
  if (e2) return fail(e2.message);
  refresh();
  return { ok: true };
}

export async function assignPath(raw: unknown): Promise<Result> {
  const p = z.object({ pathId: id, memberId: id }).safeParse(raw);
  if (!p.success) return fail(FORM_ERROR);
  const me = await staff();
  if (!me || !can(me, "perf.setup.manage", "team")) return fail(NO_ACCESS);
  const supabase = await createClient();
  const { error } = await supabase.from("hr_training_assignments").insert({ path_id: p.data.pathId, member_id: p.data.memberId, assigned_by: me.id });
  if (error) {
    if (error.code === "23505") return fail("That person already has this path.");
    return fail(error.message.includes("row-level security") ? NO_ACCESS : error.message);
  }
  refresh();
  return { ok: true };
}

/** Tick or untick a step on an assigned path. The learner can do it; RLS checks the assignment. */
export async function setStepDone(raw: unknown): Promise<Result> {
  const p = z.object({ assignmentId: id, stepId: id, done: z.boolean() }).safeParse(raw);
  if (!p.success) return fail(FORM_ERROR);
  const me = await staff();
  if (!me) return fail(NO_ACCESS);
  const supabase = await createClient();
  const { error } = p.data.done
    ? await supabase.from("hr_training_progress").upsert({ assignment_id: p.data.assignmentId, step_id: p.data.stepId }, { onConflict: "assignment_id,step_id", ignoreDuplicates: true })
    : await supabase.from("hr_training_progress").delete().eq("assignment_id", p.data.assignmentId).eq("step_id", p.data.stepId);
  if (error) return fail(error.message.includes("row-level security") ? NO_ACCESS : error.message);
  refresh();
  return { ok: true };
}

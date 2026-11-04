import "server-only";
import { createClient } from "@/lib/supabase/server";
import { clockDay, localDate, maskSecret, SECRET_FIELDS, type AttendanceRow } from "./logic";
import type {
  ClockDay,
  Employment,
  Exit,
  Kpi,
  MyPath,
  Option,
  PayRecord,
  Payslip,
  PersonalChange,
  PersonalView,
  ReviewCycle,
  ToolAccess,
  TrainingPath,
  TrainingStep,
} from "./types";

// Reads run as the signed-in user, so RLS decides what comes back. Errors read as empty.
const list = <T,>(r: { data: unknown }) => (r.data ?? []) as T[];
const num = (v: unknown) => Number(v ?? 0);

/** id -> name for members (staff only), used to show "changed by" and pickers. */
export async function listStaff(): Promise<Option[]> {
  const supabase = await createClient();
  const r = await supabase.from("members").select("id, name").eq("kind", "staff").eq("status", "active").order("name");
  return list<Option>(r);
}

export async function listDepartments(): Promise<Option[]> {
  const supabase = await createClient();
  return list<Option>(await supabase.from("departments").select("id, name").order("name"));
}

export async function getMemberBasics(memberId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("members").select("id, name, title, department_id, manager_id").eq("id", memberId).maybeSingle();
  return (data ?? null) as { id: string; name: string; title: string | null; department_id: string | null; manager_id: string | null } | null;
}

// ---------------------------------------------------------------- HR details

export async function getEmployment(memberId: string): Promise<Employment | null> {
  const supabase = await createClient();
  // 0113 member_details (contract, location, shift, probation) + 0112 member_profiles.joined_on.
  const [{ data }, { data: prof }] = await Promise.all([
    supabase.from("member_details").select("*").eq("member_id", memberId).maybeSingle(),
    supabase.from("member_profiles").select("joined_on").eq("member_id", memberId).maybeSingle(),
  ]);
  if (!data) return null;
  return {
    ...data,
    joined_on: prof?.joined_on ?? null,
    probation_decided_by: data.probation_confirmed_by ?? null,
  } as Employment;
}

// ---------------------------------------------------------------- pay

export async function getPay(memberId: string, today: string) {
  const supabase = await createClient();
  const [records, slips] = await Promise.all([
    supabase.from("salaries").select("*").eq("member_id", memberId).order("valid_from", { ascending: false }),
    supabase.from("hr_payslips").select("*").eq("member_id", memberId).order("month", { ascending: false }).limit(24),
  ]);
  // 0111 salaries: valid_from / monthly_amount are the effective date and gross.
  const history = list<PayRecord & { valid_from: string; monthly_amount: number }>(records).map((r) => ({
    ...r,
    effective_from: r.valid_from,
    basic: num(r.basic),
    house_rent: num(r.house_rent),
    utilities: num(r.utilities),
    medical: num(r.medical),
    other: num(r.other),
    gross: num(r.monthly_amount),
  }));
  const payslips = list<Payslip>(slips).map((p) => ({ ...p, gross: num(p.gross), deductions: num(p.deductions), net: num(p.net) }));
  const current = history.find((r) => r.effective_from <= today) ?? null;
  return { current, history, payslips };
}

export async function getPayslip(id: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("hr_payslips").select("*, members!hr_payslips_member_id_fkey(name, title)").eq("id", id).maybeSingle();
  if (!data) return null;
  const m = (Array.isArray(data.members) ? data.members[0] : data.members) as { name: string; title: string | null } | null;
  return { ...(data as Payslip), gross: num(data.gross), deductions: num(data.deductions), net: num(data.net), memberName: m?.name ?? "", memberTitle: m?.title ?? "" };
}

// ---------------------------------------------------------------- tools

export async function listTools(memberId: string): Promise<ToolAccess[]> {
  const supabase = await createClient();
  const r = await supabase
    .from("hr_tool_access")
    .select("id, member_id, tool, login, access_level, granted_on, revoked_at")
    .eq("member_id", memberId)
    .order("revoked_at", { ascending: true, nullsFirst: true })
    .order("granted_on");
  return list<ToolAccess>(r);
}

// ---------------------------------------------------------------- personal

/** Personal details with ID, tax number and IBAN masked. Use revealPersonal() (action) for full values. */
export async function getPersonal(memberId: string): Promise<{ details: PersonalView | null; changes: PersonalChange[] }> {
  const supabase = await createClient();
  const [d, c] = await Promise.all([
    supabase.from("hr_personal_details").select("date_of_birth, id_type, id_number, tax_number, bank_name, iban").eq("member_id", memberId).maybeSingle(),
    supabase.from("hr_personal_changes").select("id, field, changed_by, created_at").eq("member_id", memberId).order("created_at", { ascending: false }).limit(50),
  ]);
  let details = (d.data ?? null) as PersonalView | null;
  if (details) {
    details = { ...details };
    for (const f of SECRET_FIELDS) details[f] = maskSecret(details[f]);
  }
  return { details, changes: list<PersonalChange>(c) };
}

// ---------------------------------------------------------------- leaving

export async function getLatestExit(memberId: string): Promise<Exit | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("hr_exits")
    .select("id, member_id, status, last_day, reason, notes, created_at, tasks:hr_exit_tasks(id, position, label, done_at)")
    .eq("member_id", memberId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const exit = data as unknown as Exit;
  return { ...exit, tasks: [...(exit.tasks ?? [])].sort((a, b) => a.position - b.position) };
}

// ---------------------------------------------------------------- clock

export async function getClockToday(memberId: string): Promise<ClockDay | null> {
  const supabase = await createClient();
  // 0113 attendance: today's latest session (Asia/Dubai day).
  const { data } = await supabase
    .from("attendance")
    .select("*")
    .eq("member_id", memberId)
    .gte("clock_in", `${localDate(new Date())}T00:00:00+04:00`)
    .order("clock_in", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? clockDay(data as AttendanceRow) : null;
}

// ---------------------------------------------------------------- performance setup

export async function listKpis(): Promise<Kpi[]> {
  const supabase = await createClient();
  return list<Kpi>(await supabase.from("kpis").select("id, name, source, weight, direction, department_id, active").order("weight", { ascending: false }).order("name"));
}

export async function listCycles(): Promise<ReviewCycle[]> {
  const supabase = await createClient();
  return list<ReviewCycle>(await supabase.from("review_cycles").select("id, name:quarter, self_due, manager_due, status").order("self_due", { ascending: false }));
}

/** All paths with steps, and how many people are assigned / finished (as far as RLS lets me see). */
export async function listPaths(): Promise<TrainingPath[]> {
  const supabase = await createClient();
  const [p, s, a, g] = await Promise.all([
    supabase.from("hr_training_paths").select("id, name").order("name"),
    supabase.from("hr_training_steps").select("id, path_id, position, kind, title, url").order("position"),
    supabase.from("hr_training_assignments").select("id, path_id"),
    supabase.from("hr_training_progress").select("assignment_id"),
  ]);
  const steps = list<TrainingStep>(s);
  const doneBy = new Map<string, number>();
  for (const r of list<{ assignment_id: string }>(g)) doneBy.set(r.assignment_id, (doneBy.get(r.assignment_id) ?? 0) + 1);
  const assignments = list<{ id: string; path_id: string }>(a);
  return list<{ id: string; name: string }>(p).map((path) => {
    const ps = steps.filter((x) => x.path_id === path.id);
    const as = assignments.filter((x) => x.path_id === path.id);
    return {
      ...path,
      steps: ps,
      assigned: as.length,
      finished: ps.length ? as.filter((x) => (doneBy.get(x.id) ?? 0) >= ps.length).length : 0,
    };
  });
}

/** Paths assigned to one person, with the steps they've ticked. */
export async function listMemberPaths(memberId: string): Promise<MyPath[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("hr_training_assignments")
    .select("id, path_id, hr_training_paths(name, hr_training_steps(id, path_id, position, kind, title, url)), hr_training_progress(step_id)")
    .eq("member_id", memberId)
    .order("created_at");
  type Row = {
    id: string;
    path_id: string;
    hr_training_paths: { name: string; hr_training_steps: TrainingStep[] } | { name: string; hr_training_steps: TrainingStep[] }[] | null;
    hr_training_progress: { step_id: string }[];
  };
  return ((data ?? []) as unknown as Row[]).map((r) => {
    const path = Array.isArray(r.hr_training_paths) ? r.hr_training_paths[0] : r.hr_training_paths;
    return {
      assignmentId: r.id,
      pathId: r.path_id,
      name: path?.name ?? "",
      steps: [...(path?.hr_training_steps ?? [])].sort((a, b) => a.position - b.position),
      doneStepIds: (r.hr_training_progress ?? []).map((x) => x.step_id),
    };
  });
}

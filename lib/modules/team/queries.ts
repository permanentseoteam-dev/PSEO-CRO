import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Cycle, Department, KpiDef, KpiRow, Objective, Person, Presence, ReviewStatus } from "./types";

// Reads public.attendance (0113_personal): member_id, clock_in, clock_out. An open session
// (clock_out is null) means clocked in. A missing table reads as nobody clocked in.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const rows = (res: { data: unknown; error: unknown }): Row[] => (res.error || !res.data ? [] : (res.data as Row[]));

/** Active staff with department, profile extras and clock-in state, plus departments. */
export async function listPeople(): Promise<{ people: Person[]; departments: Department[] }> {
  const supabase = await createClient();
  const [m, d, prof, att] = await Promise.all([
    supabase
      .from("members")
      .select("id, name, email, title, department_id, manager_id, presence")
      .eq("kind", "staff")
      .eq("status", "active")
      .order("name"),
    supabase.from("departments").select("id, name, head_id").order("name"),
    supabase.from("member_profiles").select("member_id, status_note, skills, phone, joined_on, shift"),
    supabase.from("attendance").select("member_id").is("clock_out", null),
  ]);
  const departments: Department[] = rows(d).map((r) => ({ id: r.id, name: r.name, headId: r.head_id }));
  const deptName = new Map(departments.map((x) => [x.id, x.name]));
  const profiles = new Map(rows(prof).map((r) => [r.member_id as string, r]));
  const clocked = new Set(rows(att).map((r) => r.member_id as string));

  const people: Person[] = rows(m).map((r) => {
    const p = profiles.get(r.id);
    return {
      id: r.id,
      name: r.name,
      email: r.email,
      title: r.title,
      departmentId: r.department_id,
      department: r.department_id ? (deptName.get(r.department_id) ?? null) : null,
      managerId: r.manager_id,
      presence: r.presence as Presence,
      statusNote: p?.status_note ?? null,
      skills: p?.skills ?? [],
      phone: p?.phone ?? null,
      joinedOn: p?.joined_on ?? null,
      shift: p?.shift ?? null,
      clockedIn: clocked.has(r.id),
    };
  });
  return { people, departments };
}

export type PerformanceData = {
  myKpis: KpiRow[];
  /** kpi rows for every person I can see this quarter, by member id */
  kpisByMember: Map<string, KpiRow[]>;
  cycle: Cycle | null;
  cycles: Cycle[];
  reviews: Map<string, ReviewStatus>;
  objectives: Objective[];
  kpiDefs: KpiDef[];
};

/** Everything the Performance page needs for one quarter. RLS limits what each person sees. */
export async function getPerformance(meId: string, quarter: string): Promise<PerformanceData> {
  const supabase = await createClient();
  const [vals, cyc, okrs, defs] = await Promise.all([
    supabase
      .from("kpi_values")
      .select("id, kpi_id, member_id, value, target, kpis!inner(name, unit, direction, weight, active)")
      .eq("quarter", quarter),
    supabase.from("review_cycles").select("id, quarter, self_due, manager_due, status").order("self_due", { ascending: false }),
    supabase
      .from("okrs")
      .select("id, title, owner_id, quarter, owner:members!okrs_owner_id_fkey(name), key_results(id, okr_id, position, title, progress, confidence)")
      .eq("quarter", quarter)
      .order("created_at"),
    supabase.from("kpis").select("id, name, unit, direction, weight, source, active, department:departments(name)").order("weight", { ascending: false }),
  ]);

  const kpisByMember = new Map<string, KpiRow[]>();
  for (const r of rows(vals)) {
    if (r.kpis?.active === false) continue;
    const row: KpiRow = {
      id: r.id,
      kpiId: r.kpi_id,
      name: r.kpis.name,
      unit: r.kpis.unit,
      direction: r.kpis.direction,
      weight: r.kpis.weight,
      value: Number(r.value),
      target: Number(r.target),
    };
    kpisByMember.set(r.member_id, [...(kpisByMember.get(r.member_id) ?? []), row]);
  }
  for (const list of kpisByMember.values()) list.sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name));

  const cycles: Cycle[] = rows(cyc).map((r) => ({
    id: r.id,
    quarter: r.quarter,
    selfDue: r.self_due,
    managerDue: r.manager_due,
    status: r.status,
  }));
  const cycle = cycles.find((c) => c.quarter === quarter) ?? null;

  const reviews = new Map<string, ReviewStatus>();
  if (cycle) {
    const res = await supabase.from("perf_reviews").select("member_id, status").eq("cycle_id", cycle.id);
    for (const r of rows(res)) reviews.set(r.member_id, r.status);
  }

  const objectives: Objective[] = rows(okrs).map((r) => ({
    id: r.id,
    title: r.title,
    ownerId: r.owner_id,
    owner: r.owner?.name ?? "",
    quarter: r.quarter,
    keyResults: ((r.key_results ?? []) as Row[])
      .map((k) => ({ id: k.id, okrId: k.okr_id, position: k.position, title: k.title, progress: k.progress, confidence: k.confidence }))
      .sort((a, b) => a.position - b.position),
  }));

  const kpiDefs: KpiDef[] = rows(defs)
    .filter((r) => r.active)
    .map((r) => ({ id: r.id, name: r.name, unit: r.unit, direction: r.direction, weight: r.weight, source: r.source, department: r.department?.name ?? null }));

  return { myKpis: kpisByMember.get(meId) ?? [], kpisByMember, cycle, cycles, reviews, objectives, kpiDefs };
}

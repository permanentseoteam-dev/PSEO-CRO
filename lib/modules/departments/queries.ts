import "server-only";
import { createClient } from "@/lib/supabase/server";
import { departmentStats, type DepartmentStats } from "./logic";

/** Board view counts for every department. Open/overdue: not-done tasks in its projects or assigned to its active staff. */
export async function listDepartmentStats(deptIds: string[], today: string): Promise<Record<string, DepartmentStats>> {
  const db = await createClient();
  const [members, projects] = await Promise.all([
    db.from("members").select("id, department_id").eq("kind", "staff").eq("status", "active").not("department_id", "is", null),
    db.from("projects").select("id, department_id").eq("status", "active"),
  ]);
  const staff = members.data ?? [];
  // All join rows: departmentStats ignores those of archived projects.
  const [links, tickets] = await Promise.all([
    db.from("project_departments").select("project_id, department_id"),
    db.from("tickets").select("assignee_id, project_id, due_date").neq("status", "done"),
  ]);
  return departmentStats(
    deptIds,
    staff.map((m) => ({ id: m.id as string, departmentId: m.department_id as string | null })),
    (projects.data ?? []).map((p) => ({ id: p.id as string, departmentId: p.department_id as string | null })),
    (links.data ?? []).map((r) => ({ projectId: r.project_id as string, departmentId: r.department_id as string })),
    (tickets.data ?? []).map((t) => ({ assigneeId: t.assignee_id as string | null, projectId: t.project_id as string | null, due: t.due_date as string | null })),
    today,
  );
}

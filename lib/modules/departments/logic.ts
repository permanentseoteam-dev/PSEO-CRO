import { z } from "zod";

export type Department = { id: string; name: string; headId: string | null };
export type DepartmentUsage = { members: number; projects: number; kpis: number; announcements: number; deliveryRatings: number };

export const DepartmentName = z
  .string()
  .trim()
  .min(2, "Department names need at least 2 characters.")
  .max(60, "Department names can be at most 60 characters.");

export const DepartmentInput = z.object({
  name: DepartmentName,
  headId: z.string().uuid().nullable(),
});

/** True when another department (not `exceptId`) already has this name, ignoring case and outer spaces. */
export function isDuplicateName(name: string, existing: { id: string; name: string }[], exceptId?: string): boolean {
  const n = name.trim().toLowerCase();
  return existing.some((d) => d.id !== exceptId && d.name.trim().toLowerCase() === n);
}

export const duplicateError = (name: string) => `A department called "${name.trim()}" already exists.`;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Confirm text for deleting a department: what gets unassigned and what gets deleted with it. */
export function deleteWarning(name: string, u: DepartmentUsage): string {
  const parts = [`Delete "${name}"?`];
  if (u.members || u.projects) {
    const used = [u.members ? plural(u.members, "member", "members") : "", u.projects ? plural(u.projects, "project", "projects") : ""].filter(Boolean).join(" and ");
    parts.push(`${used} will have no department.`);
  } else {
    parts.push("No members or projects use it.");
  }
  if (u.announcements || u.deliveryRatings) {
    const lost = [u.announcements ? plural(u.announcements, "announcement", "announcements") : "", u.deliveryRatings ? plural(u.deliveryRatings, "delivery rating", "delivery ratings") : ""]
      .filter(Boolean)
      .join(" and ");
    parts.push(`${lost} for this department will be deleted.`);
  }
  // A KPI with no department applies to everyone, so its KPIs are switched off instead.
  if (u.kpis) parts.push(`${plural(u.kpis, "KPI", "KPIs")} for this department will be switched off.`);
  parts.push("This can't be undone.");
  return parts.join(" ");
}

export type DepartmentStats = { staff: number; projects: number; open: number; overdue: number };

/**
 * Per department id: active staff, active projects (join rows plus projects.department_id) and
 * open/overdue tasks assigned to its staff. `members` and `tickets` are pre-filtered (active staff, not done).
 */
export function departmentStats(
  deptIds: string[],
  members: { id: string; departmentId: string | null }[],
  projects: { id: string; departmentId: string | null }[],
  projectDepts: { projectId: string; departmentId: string }[],
  tickets: { assigneeId: string | null; due: string | null }[],
  today: string,
): Record<string, DepartmentStats> {
  const out: Record<string, DepartmentStats> = Object.fromEntries(deptIds.map((id) => [id, { staff: 0, projects: 0, open: 0, overdue: 0 }]));
  const deptOf = new Map<string, string>();
  for (const m of members) {
    if (!m.departmentId || !out[m.departmentId]) continue;
    deptOf.set(m.id, m.departmentId);
    out[m.departmentId].staff++;
  }
  const active = new Map(projects.map((p) => [p.id, new Set(p.departmentId ? [p.departmentId] : [])]));
  for (const r of projectDepts) active.get(r.projectId)?.add(r.departmentId);
  for (const set of active.values()) for (const d of set) if (out[d]) out[d].projects++;
  for (const t of tickets) {
    const d = t.assigneeId ? deptOf.get(t.assigneeId) : undefined;
    if (!d) continue;
    out[d].open++;
    if (t.due && t.due < today) out[d].overdue++;
  }
  return out;
}

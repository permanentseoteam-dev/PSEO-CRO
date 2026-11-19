"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getMe, can } from "@/lib/auth/can";
import { createClient } from "@/lib/supabase/server";
import { normalizeKey } from "@/lib/modules/work/logic";
import { suggestKey } from "@/lib/modules/work/space-logic";
import type { Result } from "@/lib/modules/work/types";

const uuid = z.string().uuid();
const Input = z.object({
  id: uuid.nullable(),
  name: z.string().trim().min(2).max(120),
  // Optional: new projects get one from the name; edits keep the current key.
  key: z.string().trim().max(8).optional(),
  departmentIds: z.array(uuid).max(50),
  clientId: uuid.nullable(),
  leadId: uuid.nullable(),
  reviewerId: uuid.nullable(),
  description: z.string().max(2000),
  reviewRequired: z.boolean(),
  status: z.enum(["active", "archived"]),
});

/** Creates or updates a project. RLS checks the manager's scope (all, or lead in their team). */
export async function saveProject(raw: unknown): Promise<Result> {
  const p = Input.safeParse(raw);
  if (!p.success) return { ok: false, error: "Check the form and try again." };
  const key = p.data.key ? normalizeKey(p.data.key) : null;
  if (p.data.key && !key) return { ok: false, error: "The key must be 2 to 8 letters." };
  const me = await getMe();
  if (!me || me.kind !== "staff" || !can(me, "work.projects.manage", "team")) return { ok: false, error: "You don't have access to do that." };

  const d = p.data;
  const db = await createClient();
  let newKey = key;
  if (!newKey && !d.id) {
    const { data: keys } = await db.from("projects").select("key");
    newKey = suggestKey(d.name, (keys ?? []).map((k) => k.key as string));
  }
  const row = {
    ...(newKey ? { key: newKey } : {}),
    name: d.name,
    department_id: d.departmentIds[0] ?? null,
    client_id: d.clientId,
    lead_id: d.leadId,
    reviewer_id: d.reviewerId,
    description: d.description.trim() || null,
    review_required: d.reviewRequired,
    status: d.status,
  };
  const res = d.id ? await db.from("projects").update(row).eq("id", d.id).select("id") : await db.from("projects").insert(row).select("id");
  if (res.error) {
    if (res.error.code === "23505") return { ok: false, error: `The key ${newKey} is already used by another project.` };
    if (res.error.code === "42501") return { ok: false, error: "You can only manage projects led by your team." };
    return { ok: false, error: res.error.message };
  }
  if (!res.data?.length) return { ok: false, error: "You can only manage projects led by your team." };
  const depErr = await setProjectDepartments(res.data[0].id as string, d.departmentIds);
  if (depErr) return { ok: false, error: depErr };
  revalidatePath("/projects");
  return { ok: true };
}

/** Replaces a project's department rows. Returns an error message, or null. */
export async function setProjectDepartments(projectId: string, departmentIds: string[]): Promise<string | null> {
  if (!uuid.safeParse(projectId).success || !z.array(uuid).safeParse(departmentIds).success) return "Check the form and try again.";
  const me = await getMe();
  if (!me || me.kind !== "staff" || !can(me, "work.projects.manage", "team")) return "You don't have access to do that.";
  const db = await createClient();
  const del = await db.from("project_departments").delete().eq("project_id", projectId);
  if (del.error) return del.error.message;
  const unique = [...new Set(departmentIds)];
  if (!unique.length) return null;
  const ins = await db.from("project_departments").insert(unique.map((department_id) => ({ project_id: projectId, department_id })));
  return ins.error ? ins.error.message : null;
}

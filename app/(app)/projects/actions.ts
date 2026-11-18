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
  departmentId: uuid.nullable(),
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
    department_id: d.departmentId,
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
  revalidatePath("/projects");
  return { ok: true };
}

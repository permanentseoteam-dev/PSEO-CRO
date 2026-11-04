"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getMe, can } from "@/lib/auth/can";
import { createClient } from "@/lib/supabase/server";
import { parseDuration, parseTags } from "@/lib/modules/tickets/logic";
import { parseLines, parseSubtasks } from "@/lib/modules/work/logic";
import type { Result } from "@/lib/modules/work/types";

const NO = { ok: false as const, error: "You don't have access to do that." };
const uuid = z.string().uuid();

async function manager() {
  const me = await getMe();
  return me && me.kind === "staff" && can(me, "work.templates.manage") ? me : null;
}

const Input = z.object({
  id: uuid.nullable(),
  name: z.string().trim().min(2).max(80),
  service: z.string().trim().min(1).max(40),
  titlePattern: z.string().trim().min(2).max(200),
  departmentId: uuid.nullable(),
  defaultAssigneeId: uuid.nullable(),
  priority: z.enum(["urgent", "high", "normal", "low"]),
  dueInDays: z.number().int().min(0).max(365).nullable(),
  estimate: z.string().max(20),
  qaChecklistId: uuid.nullable(),
  description: z.string().max(10000),
  doneWhen: z.string().max(2000),
  checklist: z.string().max(10000),
  subtasks: z.string().max(5000),
  tags: z.string().max(400),
  reviewRequired: z.boolean(),
  active: z.boolean(),
});

/** Creates or edits a ticket template. */
export async function saveTemplate(raw: unknown): Promise<Result> {
  const p = Input.safeParse(raw);
  if (!p.success) return { ok: false, error: "Check the form and try again." };
  if (!(await manager())) return NO;
  const d = p.data;
  const estimate = d.estimate.trim() ? parseDuration(d.estimate) : null;
  if (d.estimate.trim() && estimate == null) return { ok: false, error: "Write the estimate like 3h or 1h 30m." };

  const row = {
    name: d.name,
    service: d.service,
    title_pattern: d.titlePattern,
    department_id: d.departmentId,
    default_assignee_id: d.defaultAssigneeId,
    priority: d.priority,
    due_in_days: d.dueInDays,
    estimate_min: estimate,
    qa_checklist_id: d.qaChecklistId,
    description: d.description.trim() || null,
    done_when: d.doneWhen.trim() || null,
    checklist: parseLines(d.checklist).map((l) => l.slice(0, 300)).slice(0, 100),
    subtasks: parseSubtasks(d.subtasks).map((s) => ({ ...s, title: s.title.slice(0, 200) })).slice(0, 30),
    tags: parseTags(d.tags),
    review_required: d.reviewRequired,
    active: d.active,
  };
  const db = await createClient();
  const { error } = d.id ? await db.from("templates").update(row).eq("id", d.id) : await db.from("templates").insert(row);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/templates");
  return { ok: true };
}

/** Deletes a template that was never used. A used one must be switched off instead. */
export async function deleteTemplate(raw: unknown): Promise<Result> {
  const id = uuid.safeParse(raw);
  if (!id.success) return { ok: false, error: "Check the form and try again." };
  if (!(await manager())) return NO;
  const db = await createClient();
  const { data, error } = await db.from("templates").delete().eq("id", id.data).eq("uses", 0).select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "This template has been used. Switch it off instead." };
  revalidatePath("/templates");
  return { ok: true };
}

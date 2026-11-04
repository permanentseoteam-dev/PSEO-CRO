"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getMe, can } from "@/lib/auth/can";
import { createClient } from "@/lib/supabase/server";
import { parseLines } from "@/lib/modules/work/logic";
import type { Result } from "@/lib/modules/work/types";

const NO = { ok: false as const, error: "You don't have access to do that." };

async function manager() {
  const me = await getMe();
  return me && me.kind === "staff" && can(me, "work.templates.manage") ? me : null;
}

const Checklist = z.object({
  id: z.string().uuid().nullable(),
  name: z.string().trim().min(2).max(80),
  services: z.string().max(200),
  items: z.string().max(5000),
});

/** Creates or edits a QA checklist. Services are comma-separated, checks one per line. */
export async function saveQaChecklist(raw: unknown): Promise<Result> {
  const p = Checklist.safeParse(raw);
  if (!p.success) return { ok: false, error: "Give the checklist a name." };
  if (!(await manager())) return NO;
  const items = parseLines(p.data.items).map((l) => l.slice(0, 200)).slice(0, 50);
  if (!items.length) return { ok: false, error: "Add at least one check." };
  const row = {
    name: p.data.name,
    services: p.data.services.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10),
    items,
  };
  const db = await createClient();
  const { error } = p.data.id ? await db.from("qa_checklists").update(row).eq("id", p.data.id) : await db.from("qa_checklists").insert(row);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/reviews");
  return { ok: true };
}

export async function setQaChecklistActive(raw: unknown): Promise<Result> {
  const p = z.object({ id: z.string().uuid(), active: z.boolean() }).safeParse(raw);
  if (!p.success) return { ok: false, error: "Check the form and try again." };
  if (!(await manager())) return NO;
  const db = await createClient();
  const { error } = await db.from("qa_checklists").update({ active: p.data.active }).eq("id", p.data.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/reviews");
  return { ok: true };
}

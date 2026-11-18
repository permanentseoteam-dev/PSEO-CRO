"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { can, getMe } from "@/lib/auth/can";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Result } from "@/lib/modules/personal/types";
import { DepartmentInput, duplicateError, isDuplicateName, type DepartmentUsage } from "./logic";

const NO = { ok: false as const, error: "You don't have access to do that." };
const BAD = { ok: false as const, error: "Check the form and try again." };
const Id = z.string().uuid();

async function adminDb() {
  const me = await getMe();
  return can(me, "admin.access.manage", "all") ? createClient() : null;
}

/** Validates name + head, and rejects a name another department already uses (any case). */
async function checked(db: Awaited<ReturnType<typeof createClient>>, raw: unknown, exceptId?: string) {
  const p = DepartmentInput.safeParse(raw);
  if (!p.success) return { error: p.error.issues[0]?.message ?? BAD.error } as const;
  const { data, error } = await db.from("departments").select("id, name");
  if (error) return { error: error.message } as const;
  if (isDuplicateName(p.data.name, data ?? [], exceptId)) return { error: duplicateError(p.data.name) } as const;
  return { row: { name: p.data.name, head_id: p.data.headId } } as const;
}

const done = (error: { message: string; code?: string } | null, name: string): Result => {
  if (error) return { ok: false, error: error.code === "23505" ? duplicateError(name) : error.message };
  revalidatePath("/", "layout");
  return { ok: true };
};

/** Admins only (admin.access.manage 'all'). */
export async function addDepartment(raw: unknown): Promise<Result> {
  const db = await adminDb();
  if (!db) return NO;
  const c = await checked(db, raw);
  if ("error" in c) return { ok: false, error: c.error! };
  const { error } = await db.from("departments").insert(c.row);
  return done(error, c.row.name);
}

export async function updateDepartment(id: unknown, raw: unknown): Promise<Result> {
  const i = Id.safeParse(id);
  if (!i.success) return BAD;
  const db = await adminDb();
  if (!db) return NO;
  const c = await checked(db, raw, i.data);
  if ("error" in c) return { ok: false, error: c.error! };
  const { error } = await db.from("departments").update(c.row).eq("id", i.data);
  return done(error, c.row.name);
}

/** How many rows point at the department, so the UI can say what a delete would touch. */
export async function departmentUsage(id: unknown): Promise<{ ok: true; usage: DepartmentUsage } | { ok: false; error: string }> {
  const i = Id.safeParse(id);
  if (!i.success) return BAD;
  if (!(await adminDb())) return NO;
  // Service role after the admin check: the delete's cascade ignores RLS, so the counts must too.
  const db = createAdminClient();
  const count = (table: string) => db.from(table).select("id", { count: "exact", head: true }).eq("department_id", i.data);
  const [m, p, k, a, d] = await Promise.all([count("members"), count("projects"), count("kpis"), count("announcements"), count("delivery_ratings")]);
  const err = m.error ?? p.error ?? k.error ?? a.error ?? d.error;
  if (err) return { ok: false, error: err.message };
  return { ok: true, usage: { members: m.count ?? 0, projects: p.count ?? 0, kpis: k.count ?? 0, announcements: a.count ?? 0, deliveryRatings: d.count ?? 0 } };
}

export async function deleteDepartment(id: unknown): Promise<Result> {
  const i = Id.safeParse(id);
  if (!i.success) return BAD;
  const db = await adminDb();
  if (!db) return NO;
  // Switch the department's KPIs off first: once department_id is null a KPI would apply to everyone.
  const k = await createAdminClient().from("kpis").update({ active: false }).eq("department_id", i.data);
  if (k.error) return { ok: false, error: k.error.message };
  const { error } = await db.from("departments").delete().eq("id", i.data);
  return done(error, "");
}

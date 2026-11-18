"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { can, getMe } from "@/lib/auth/can";
import { createClient } from "@/lib/supabase/server";
import type { Result } from "@/lib/modules/personal/types";
import { duplicateError, isDuplicateName, ServiceName, type ServiceUsage } from "./logic";

const NO = { ok: false as const, error: "You don't have access to do that." };
const BAD = { ok: false as const, error: "Check the form and try again." };
const Id = z.string().uuid();

async function adminDb() {
  const me = await getMe();
  return can(me, "admin.access.manage", "all") ? createClient() : null;
}

/** Validates the name and rejects one another service already uses (any case). */
async function checked(db: Awaited<ReturnType<typeof createClient>>, raw: unknown, exceptId?: string) {
  const p = ServiceName.safeParse(raw);
  if (!p.success) return { error: p.error.issues[0]?.message ?? BAD.error } as const;
  const { data, error } = await db.from("services").select("id, name, sort");
  if (error) return { error: error.message } as const;
  if (isDuplicateName(p.data, data ?? [], exceptId)) return { error: duplicateError(p.data) } as const;
  const nextSort = Math.max(0, ...(data ?? []).map((s) => (s.sort as number | null) ?? 0)) + 1;
  return { name: p.data, nextSort } as const;
}

const done = (error: { message: string; code?: string } | null, name: string): Result => {
  if (error) return { ok: false, error: error.code === "23505" ? duplicateError(name) : error.message };
  revalidatePath("/", "layout");
  return { ok: true };
};

/** Admins only (admin.access.manage 'all'). New services go to the end of the list. */
export async function addService(raw: unknown): Promise<Result> {
  const db = await adminDb();
  if (!db) return NO;
  const c = await checked(db, raw);
  if ("error" in c) return { ok: false, error: c.error! };
  const { error } = await db.from("services").insert({ name: c.name, sort: c.nextSort });
  return done(error, c.name);
}

/** Renames the service and every template, client and QA checklist that stores the old name (rename_service, 0219). */
export async function renameService(id: unknown, raw: unknown): Promise<Result> {
  const i = Id.safeParse(id);
  if (!i.success) return BAD;
  const db = await adminDb();
  if (!db) return NO;
  const c = await checked(db, raw, i.data);
  if ("error" in c) return { ok: false, error: c.error! };
  const { error } = await db.rpc("rename_service", { p_id: i.data, p_name: c.name });
  return done(error, c.name);
}

/** How many templates and clients store the service's name, for the delete confirm. */
export async function serviceUsage(id: unknown): Promise<{ ok: true; usage: ServiceUsage } | { ok: false; error: string }> {
  const i = Id.safeParse(id);
  if (!i.success) return BAD;
  const db = await adminDb();
  if (!db) return NO;
  const { data: s, error } = await db.from("services").select("name").eq("id", i.data).maybeSingle();
  if (error || !s) return { ok: false, error: error?.message ?? "That service no longer exists." };
  const [t, c] = await Promise.all([
    db.from("templates").select("id", { count: "exact", head: true }).eq("service", s.name),
    db.from("clients").select("id", { count: "exact", head: true }).contains("services", [s.name]),
  ]);
  const err = t.error ?? c.error;
  if (err) return { ok: false, error: err.message };
  return { ok: true, usage: { templates: t.count ?? 0, clients: c.count ?? 0 } };
}

/** Removes the service from the list only; rows that use it keep their text value. */
export async function deleteService(id: unknown): Promise<Result> {
  const i = Id.safeParse(id);
  if (!i.success) return BAD;
  const db = await adminDb();
  if (!db) return NO;
  const { error } = await db.from("services").delete().eq("id", i.data);
  return done(error, "");
}

"use server";
import { revalidatePath } from "next/cache";
import { can, getMe } from "@/lib/auth/can";
import { createClient } from "@/lib/supabase/server";
import type { Result } from "@/lib/modules/personal/types";
import { AgencyInput, toRow } from "./logic";

/** Agency name, subtitle, initials, logo URL and workday length. Admins only (admin.access.manage 'all'). */
export async function saveAgencySettings(raw: unknown): Promise<Result> {
  const p = AgencyInput.safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check the form and try again." };
  const me = await getMe();
  if (!can(me, "admin.access.manage", "all")) return { ok: false, error: "You don't have access to do that." };
  const db = await createClient();
  const { error } = await db.from("agency_settings").upsert({ id: true, ...toRow(p.data), updated_by: me!.id }, { onConflict: "id" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

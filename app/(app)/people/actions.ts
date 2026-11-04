"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getMe, can } from "@/lib/auth/can";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

const PlaceInput = z
  .object({
    memberId: z.string().uuid(),
    managerId: z.string().uuid(),
    title: z.string().trim().min(1).max(120),
  })
  .refine((v) => v.memberId !== v.managerId);

/** Put someone in the org chart: set who they report to and their title. Admins only (members_guard). */
export async function placePerson(raw: unknown): Promise<Result> {
  const input = PlaceInput.safeParse(raw);
  if (!input.success) return { ok: false, error: "Check the form and try again." };
  const me = await getMe();
  if (!me || me.kind !== "staff" || !can(me, "admin.access.manage", "all")) return { ok: false, error: "You don't have access to do that." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("members")
    .update({ manager_id: input.data.managerId, title: input.data.title })
    .eq("id", input.data.memberId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/people", "layout");
  return { ok: true };
}

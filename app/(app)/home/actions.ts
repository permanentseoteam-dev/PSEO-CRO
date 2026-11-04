"use server";
import { revalidatePath } from "next/cache";
import { getMe } from "@/lib/auth/can";
import { createClient } from "@/lib/supabase/server";

/** Mark my ticket updates as read (the Updates panel on Home). */
export async function markUpdatesRead() {
  const me = await getMe();
  if (!me) return { ok: false as const, error: "You don't have access to do that." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("member_id", me.id)
    .in("kind", ["ticket", "review", "mention"])
    .is("read_at", null);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/home");
  return { ok: true as const };
}

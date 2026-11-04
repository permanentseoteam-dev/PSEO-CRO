"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getMe, can } from "@/lib/auth/can";
import { createClient } from "@/lib/supabase/server";

const hours = z.coerce.number().min(0.5).max(72).multipleOf(0.5);
const time = z.string().regex(/^\d{2}:\d{2}$/);

const Input = z
  .object({
    replyHours: hours,
    requestHours: hours,
    changesHours: hours,
    timezone: z.enum(["Asia/Dubai", "Asia/Karachi", "Europe/London"]),
    dayStart: time,
    dayEnd: time,
    workdays: z.array(z.coerce.number().int().min(1).max(7)).min(1).max(7),
    alertAnswerer: z.boolean(),
    alertManager: z.boolean(),
    postDaily: z.boolean(),
  })
  .refine((v) => v.dayEnd > v.dayStart, { message: "The day must end after it starts." });

export async function saveTargets(raw: unknown) {
  const input = Input.safeParse(raw);
  if (!input.success) return { ok: false as const, error: input.error.issues[0]?.message ?? "Check the form and try again." };
  const me = await getMe();
  if (!me || me.kind !== "staff" || !can(me, "clients.manage", "all")) return { ok: false as const, error: "You don't have access to do that." };
  const v = input.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("sla_settings")
    .update({
      reply_hours: v.replyHours,
      request_hours: v.requestHours,
      changes_hours: v.changesHours,
      timezone: v.timezone,
      day_start: v.dayStart,
      day_end: v.dayEnd,
      workdays: [...new Set(v.workdays)].sort(),
      alert_answerer: v.alertAnswerer,
      alert_manager: v.alertManager,
      post_daily: v.postDaily,
      updated_by: me.id,
    })
    .eq("id", true);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/response-times");
  return { ok: true as const };
}

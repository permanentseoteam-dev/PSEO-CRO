"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getMe, can } from "@/lib/auth/can";
import { createClient } from "@/lib/supabase/server";

const Input = z.object({
  marginAlertPct: z.coerce.number().min(0).max(100),
  workingHours: z.coerce.number().int().min(1).max(400),
  alertMargin: z.boolean(),
  alertBudget: z.boolean(),
  alertNegative: z.boolean(),
  alertTo: z.enum(["leaders", "finance"]),
});

export async function saveProfitSettings(raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const p = Input.safeParse(raw);
  if (!p.success) return { ok: false, error: "Check the form and try again." };
  const me = await getMe();
  if (!me || me.kind !== "staff" || !can(me, "finance.settings.manage", "all")) return { ok: false, error: "You don't have access to do that." };
  const v = p.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("finance_ops_settings")
    .update({
      margin_alert_pct: v.marginAlertPct,
      working_hours: v.workingHours,
      alert_margin: v.alertMargin,
      alert_budget: v.alertBudget,
      alert_negative: v.alertNegative,
      alert_to: v.alertTo,
    })
    .eq("id", true);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/finance/profitability");
  return { ok: true };
}

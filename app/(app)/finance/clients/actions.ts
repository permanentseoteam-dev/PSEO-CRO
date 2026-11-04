"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getMe, can } from "@/lib/auth/can";
import { createClient } from "@/lib/supabase/server";

const opt = (max: number) => z.string().trim().max(max).default("");

const Input = z.object({
  clientId: z.string().uuid(),
  legalName: opt(200),
  contact: opt(120),
  billingEmail: opt(300),
  cc: opt(300),
  country: opt(80),
  address: opt(500),
  taxId: opt(60),
  entityId: z.string().uuid().nullable(),
  currency: z.enum(["AED", "USD", "PKR"]),
  channelId: z.string().uuid().nullable(),
  termsDays: z.coerce.number().int().min(0).max(180),
  agreedFee: z.coerce.number().finite().min(0).max(1e11),
  feeBasis: z.enum(["monthly", "weekly", "hourly", "one_time"]),
  hoursBudget: z.coerce.number().min(0).max(10000).nullable(),
  notes: opt(2000),
  autoReminders: z.boolean(),
});

const emails = (v: string) => v.split(/[,;\s]+/).filter(Boolean).every((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));

export async function saveBillingProfile(raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const p = Input.safeParse(raw);
  if (!p.success) return { ok: false, error: "Check the form and try again." };
  const v = p.data;
  if (!emails(v.billingEmail) || !emails(v.cc)) return { ok: false, error: "Check the email addresses." };
  const me = await getMe();
  if (!me || me.kind !== "staff" || !can(me, "clients.billing.edit", "all")) return { ok: false, error: "You don't have access to do that." };
  const supabase = await createClient();
  const { error } = await supabase.from("billing_profiles").upsert(
    {
      client_id: v.clientId,
      legal_name: v.legalName || null,
      contact: v.contact || null,
      billing_email: v.billingEmail || null,
      cc: v.cc || null,
      country: v.country || null,
      address: v.address || null,
      tax_id: v.taxId || null,
      entity_id: v.entityId,
      currency: v.currency,
      channel_id: v.channelId,
      terms_days: v.termsDays,
      agreed_fee: v.agreedFee,
      fee_basis: v.feeBasis,
      hours_budget: v.hoursBudget,
      notes: v.notes || null,
      auto_reminders: v.autoReminders,
    },
    { onConflict: "client_id" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/finance/clients");
  revalidatePath("/finance/reminders");
  revalidatePath("/finance/profitability");
  return { ok: true };
}

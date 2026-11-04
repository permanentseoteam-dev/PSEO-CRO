"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getMe, can } from "@/lib/auth/can";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };
const NO_ACCESS: Result = { ok: false, error: "You don't have access to do that." };

async function manager() {
  const me = await getMe();
  return !!me && me.kind === "staff" && can(me, "finance.settings.manage", "all");
}

function refresh() {
  revalidatePath("/finance/settings");
  revalidatePath("/finance", "layout");
}

const firstIssue = (e: z.ZodError) => e.issues[0]?.message ?? "Check the form and try again.";
const opt = (max: number) => z.string().trim().max(max).default("");

const Entity = z.object({
  id: z.string().uuid().nullable(),
  code: z.string().trim().regex(/^[a-z]{2,8}$/, "Code is 2 to 8 lowercase letters."),
  name: z.string().trim().min(1, "Enter the legal name.").max(120),
  shortName: z.string().trim().min(1, "Enter a short name.").max(40),
  country: opt(80),
  prefix: z.string().trim().regex(/^[A-Z0-9]{1,6}$/, "Prefix is 1 to 6 capital letters or digits."),
  taxLabel: z.string().trim().min(1).max(20),
  taxRate: z.coerce.number().min(0).max(100),
  currency: z.enum(["AED", "USD", "PKR"]),
  taxId: opt(60),
  address: opt(500),
  active: z.boolean(),
});

export async function saveEntity(raw: unknown): Promise<Result> {
  const p = Entity.safeParse(raw);
  if (!p.success) return { ok: false, error: firstIssue(p.error) };
  if (!(await manager())) return NO_ACCESS;
  const v = p.data;
  const row = {
    code: v.code,
    name: v.name,
    short_name: v.shortName,
    country: v.country || null,
    invoice_prefix: v.prefix,
    tax_label: v.taxLabel,
    tax_rate: v.taxRate,
    currency: v.currency,
    tax_id: v.taxId || null,
    address: v.address || null,
    active: v.active,
  };
  const supabase = await createClient();
  const { error } = v.id ? await supabase.from("entities").update(row).eq("id", v.id) : await supabase.from("entities").insert(row);
  if (error) return { ok: false, error: error.code === "23505" ? "That code or prefix is already used." : error.message };
  refresh();
  return { ok: true };
}

const Channel = z.object({
  id: z.string().uuid().nullable(),
  name: z.string().trim().min(1, "Enter a name.").max(60),
  type: z.enum(["wise", "paypal", "slash", "bank", "payoneer", "other"]),
  account: opt(120),
  feeNote: opt(60),
  details: opt(500),
  active: z.boolean(),
});

export async function saveChannel(raw: unknown): Promise<Result> {
  const p = Channel.safeParse(raw);
  if (!p.success) return { ok: false, error: firstIssue(p.error) };
  if (!(await manager())) return NO_ACCESS;
  const v = p.data;
  const row = { name: v.name, type: v.type, account: v.account || null, fee_note: v.feeNote || null, details: v.details || null, active: v.active };
  const supabase = await createClient();
  const { error } = v.id ? await supabase.from("channels_pay").update(row).eq("id", v.id) : await supabase.from("channels_pay").insert(row);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

const Rates = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rates: z.array(z.object({ currency: z.enum(["AED", "PKR"]), rate: z.coerce.number().gt(0, "Rates must be above 0.").max(1000) })).min(1),
});

/** Save today's rates. Payments keep the rate saved when they were recorded, so this only affects new ones. */
export async function saveRates(raw: unknown): Promise<Result> {
  const p = Rates.safeParse(raw);
  if (!p.success) return { ok: false, error: firstIssue(p.error) };
  if (!(await manager())) return NO_ACCESS;
  const supabase = await createClient();
  const { error } = await supabase
    .from("fx_rates")
    .upsert(
      p.data.rates.map((r) => ({ currency: r.currency, rate_to_usd: r.rate, valid_from: p.data.date })),
      { onConflict: "currency,valid_from" },
    );
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

const Salary = z.object({
  memberId: z.string().uuid(),
  amount: z.coerce.number().min(0).max(1e9),
  currency: z.enum(["AED", "USD", "PKR"]),
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function saveSalary(raw: unknown): Promise<Result> {
  const p = Salary.safeParse(raw);
  if (!p.success) return { ok: false, error: firstIssue(p.error) };
  if (!(await manager())) return NO_ACCESS;
  const v = p.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("salaries")
    .upsert({ member_id: v.memberId, monthly_amount: v.amount, currency: v.currency, valid_from: v.validFrom }, { onConflict: "member_id,valid_from" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/finance/settings");
  revalidatePath("/finance/profitability");
  return { ok: true };
}

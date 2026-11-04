"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getMe, can } from "@/lib/auth/can";
import { createClient } from "@/lib/supabase/server";
import { STAGES, STAGE_LABEL, type Stage } from "@/lib/modules/finance/ops/logic";

type Result = { ok: true } | { ok: false; error: string };
const NO_ACCESS: Result = { ok: false, error: "You don't have access to do that." };
const BAD_INPUT: Result = { ok: false, error: "Check the form and try again." };

async function sender() {
  const me = await getMe();
  return me && me.kind === "staff" && can(me, "finance.invoices.send", "all") ? me : null;
}

function refresh() {
  revalidatePath("/finance/reminders");
  revalidatePath("/finance");
}

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * Email sending isn't connected yet, so "send" records that the reminder went out (sent by hand from the
 * reviewed text). Earlier stages of the same invoice that were never sent are marked missed.
 */
export async function markSent(raw: unknown): Promise<Result> {
  const p = z.object({ ids: z.array(z.string().uuid()).min(1).max(200) }).safeParse(raw);
  if (!p.success) return BAD_INPUT;
  const me = await sender();
  if (!me) return NO_ACCESS;
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("reminders")
    .select("id, invoice_id, stage, send_on")
    .in("id", p.data.ids)
    .eq("status", "pending");
  if (error) return { ok: false, error: error.message };
  for (const r of rows ?? []) {
    const { error: e1 } = await supabase
      .from("reminders")
      .update({ status: "sent", sent_at: new Date().toISOString(), sent_by: me.id, result: "Marked as sent" })
      .eq("id", r.id);
    if (e1) return { ok: false, error: e1.message };
    await supabase
      .from("reminders")
      .update({ status: "skipped", result: "Missed" })
      .eq("invoice_id", r.invoice_id)
      .eq("status", "pending")
      .lt("send_on", r.send_on);
    await supabase.from("invoice_events").insert({
      invoice_id: r.invoice_id,
      kind: "reminder",
      actor_id: me.id,
      note: `Sent ${STAGE_LABEL[r.stage as Stage].toLowerCase()} reminder`,
      meta: { stage: r.stage },
    });
  }
  refresh();
  return { ok: true };
}

export async function skipReminder(raw: unknown): Promise<Result> {
  const p = z.object({ id: z.string().uuid() }).safeParse(raw);
  if (!p.success) return BAD_INPUT;
  const me = await sender();
  if (!me) return NO_ACCESS;
  const supabase = await createClient();
  const { error } = await supabase
    .from("reminders")
    .update({ status: "skipped", result: `Skipped by ${me.name}`, sent_by: me.id })
    .eq("id", p.data.id)
    .eq("status", "pending");
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function pauseReminders(raw: unknown): Promise<Result> {
  const p = z.object({ invoiceId: z.string().uuid(), until: iso, note: z.string().trim().max(500).default("") }).safeParse(raw);
  if (!p.success) return { ok: false, error: "Pick a date to pause until." };
  if (!(await sender())) return NO_ACCESS;
  const supabase = await createClient();
  const { error } = await supabase
    .from("reminders")
    .update({ paused_until: p.data.until, pause_note: p.data.note || null })
    .eq("invoice_id", p.data.invoiceId)
    .eq("status", "pending");
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function resumeReminders(raw: unknown): Promise<Result> {
  const p = z.object({ invoiceId: z.string().uuid() }).safeParse(raw);
  if (!p.success) return BAD_INPUT;
  if (!(await sender())) return NO_ACCESS;
  const supabase = await createClient();
  const { error } = await supabase
    .from("reminders")
    .update({ paused_until: null, pause_note: null })
    .eq("invoice_id", p.data.invoiceId)
    .eq("status", "pending");
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

export async function setAuto(raw: unknown): Promise<Result> {
  const p = z.object({ invoiceId: z.string().uuid(), auto: z.boolean() }).safeParse(raw);
  if (!p.success) return BAD_INPUT;
  if (!(await sender())) return NO_ACCESS;
  const supabase = await createClient();
  const { error } = await supabase.from("reminders").update({ auto: p.data.auto }).eq("invoice_id", p.data.invoiceId).eq("status", "pending");
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

const Rules = z.object({
  stages: z.array(z.enum(STAGES as [Stage, ...Stage[]])).max(5),
  tellAm: z.boolean(),
  runTime: z.string().regex(/^\d{2}:\d{2}$/),
  from: z.string().trim().email().max(200),
});

export async function saveReminderRules(raw: unknown): Promise<Result> {
  const p = Rules.safeParse(raw);
  if (!p.success) return BAD_INPUT;
  if (!(await sender())) return NO_ACCESS;
  const supabase = await createClient();
  const { error } = await supabase
    .from("finance_ops_settings")
    .update({ reminder_stages: p.data.stages, tell_am_at_30: p.data.tellAm, reminder_run_time: p.data.runTime, reminder_from: p.data.from })
    .eq("id", true);
  if (error) return { ok: false, error: error.message };
  refresh();
  return { ok: true };
}

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getMe, can } from "@/lib/auth/can";
import { createClient } from "@/lib/supabase/server";
import { getBillingDefaults, settledByInvoice } from "@/lib/modules/finance/core/queries";
import { sendLoggedEmail } from "@/features/finance-p2/send";
import { addDays, balance, computeTotals, daysBetween, money, round2, statusFromAmounts, type InvoiceStatus } from "@/lib/modules/finance/core/logic";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const BAD_INPUT = { ok: false as const, error: "Check the form and try again." };
const NO_ACCESS = { ok: false as const, error: "You don't have access to do that." };

const id = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const text = (max: number) => z.string().trim().max(max);
const reason = z.string().trim().min(3, "Add a reason").max(1000);

async function staffWith(perm: string) {
  const me = await getMe();
  if (!me || me.kind !== "staff" || !can(me, perm, "all")) return null;
  return me;
}

function refresh(invoiceId?: string) {
  revalidatePath("/finance");
  revalidatePath("/finance/invoices");
  if (invoiceId) revalidatePath(`/finance/invoices/${invoiceId}`);
}

async function loadInvoice(invoiceId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("invoices")
    .select("id, number, draft_no, status, client_id, entity_id, currency, issued_on, due_on, title, po_ref, discount, total, amount_paid, amount_refunded, channel_id, pay_link, notes, terms, bill_to")
    .eq("id", invoiceId)
    .maybeSingle();
  if (!data) return { supabase, inv: null };
  return {
    supabase,
    inv: {
      ...data,
      status: data.status as InvoiceStatus,
      total: Number(data.total),
      paid: Number(data.amount_paid),
      refunded: Number(data.amount_refunded),
      due: data.due_on as string,
    },
  };
}

// Drafts take the client's current billing details; issued invoices keep the snapshot they were issued with.
async function billTo(clientId: string) {
  const { billTo: b } = await getBillingDefaults(clientId);
  if (b.name) return b;
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("name").eq("id", clientId).maybeSingle();
  return { ...b, name: data?.name ?? "" };
}

// ---------------------------------------------------------------- save (create or edit)
const Line = z.object({
  description: text(300),
  detail: text(500).default(""),
  qty: z.coerce.number().min(0).max(1e6),
  rate: z.coerce.number().min(0).max(1e10),
  tax_pct: z.coerce.number().min(0).max(100),
});

const SaveInput = z.object({
  id: id.optional(),
  client_id: id,
  entity_id: id,
  currency: z.enum(["AED", "USD", "PKR"]),
  issued_on: date,
  due_on: date,
  po_ref: text(100).default(""),
  title: text(200).default(""),
  discount: z.coerce.number().min(0).max(1e10).default(0),
  channel_id: id.nullable().optional(),
  pay_link: text(500).default(""),
  notes: text(2000).default(""),
  terms: text(2000).default(""),
  lines: z.array(Line).max(100),
  reason: z.string().trim().max(1000).optional(),
});

export async function saveInvoice(raw: unknown): Promise<Result<{ id: string }>> {
  const parsed = SaveInput.safeParse(raw);
  if (!parsed.success) return BAD_INPUT;
  const input = parsed.data;
  if (input.due_on < input.issued_on) return { ok: false, error: "The due date can't be before the issue date." };
  const me = await staffWith("finance.invoices.create");
  if (!me) return NO_ACCESS;

  const lines = input.lines.filter((l) => l.description || l.rate || l.detail);
  const t = computeTotals(lines.map((l) => ({ qty: l.qty, rate: l.rate, taxPct: l.tax_pct })), input.discount);
  const fields = {
    issued_on: input.issued_on,
    due_on: input.due_on,
    po_ref: input.po_ref || null,
    title: input.title,
    discount: t.discount,
    subtotal: t.subtotal,
    tax_total: t.tax,
    total: t.total,
    channel_id: input.channel_id || null,
    pay_link: input.pay_link || null,
    notes: input.notes || null,
    terms: input.terms || null,
  };
  const lineRows = (invoiceId: string) =>
    lines.map((l, i) => ({
      invoice_id: invoiceId,
      position: i,
      description: l.description,
      detail: l.detail || null,
      qty: l.qty,
      rate: l.rate,
      tax_pct: l.tax_pct,
      amount: t.lines[i],
    }));

  const supabase = await createClient();

  if (!input.id) {
    const { data, error } = await supabase
      .from("invoices")
      .insert({ ...fields, client_id: input.client_id, entity_id: input.entity_id, currency: input.currency, status: "draft", bill_to: await billTo(input.client_id) })
      .select("id")
      .single();
    if (error || !data) return { ok: false, error: error?.message ?? "Couldn't create the invoice." };
    if (lines.length) {
      const { error: le } = await supabase.from("invoice_lines").insert(lineRows(data.id));
      if (le) return { ok: false, error: le.message };
    }
    await supabase.from("invoice_events").insert({ invoice_id: data.id, kind: "created", actor_id: me.id, note: "Created" });
    refresh(data.id);
    return { ok: true, id: data.id };
  }

  const { inv } = await loadInvoice(input.id);
  if (!inv) return { ok: false, error: "Invoice not found." };
  const issued = inv.status !== "draft";
  if (issued) {
    if (!can(me, "finance.invoices.edit_issued", "all")) return { ok: false, error: "You can't edit issued invoices." };
    if (["void", "written_off", "refunded"].includes(inv.status)) return { ok: false, error: "This invoice is closed and can't be edited." };
    if (!input.reason || input.reason.length < 3) return { ok: false, error: "Add a reason for the change." };
    if (t.total < round2(inv.paid - inv.refunded)) {
      return { ok: false, error: `The total can't drop below the ${money(inv.paid - inv.refunded, inv.currency)} already paid.` };
    }
  }

  const update = issued
    ? { ...fields, status: inv.status === "disputed" ? inv.status : statusFromAmounts(t.total, inv.paid, inv.refunded) }
    : { ...fields, client_id: input.client_id, entity_id: input.entity_id, currency: input.currency, bill_to: await billTo(input.client_id) };
  const { error } = await supabase.from("invoices").update(update).eq("id", input.id);
  if (error) return { ok: false, error: error.message };

  const { error: de } = await supabase.from("invoice_lines").delete().eq("invoice_id", input.id);
  if (de) return { ok: false, error: de.message };
  if (lines.length) {
    const { error: le } = await supabase.from("invoice_lines").insert(lineRows(input.id));
    if (le) return { ok: false, error: le.message };
  }
  if (issued) {
    await supabase.from("invoice_events").insert({
      invoice_id: input.id,
      kind: "edited",
      actor_id: me.id,
      note: `Edited: ${input.reason}`,
      meta: { total_before: inv.total, total_after: t.total },
    });
  }
  refresh(input.id);
  return { ok: true, id: input.id };
}

// ---------------------------------------------------------------- issue
export async function issueInvoice(raw: unknown): Promise<Result<{ number: string }>> {
  const p = id.safeParse(raw);
  if (!p.success) return BAD_INPUT;
  if (!(await staffWith("finance.invoices.create"))) return NO_ACCESS;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("issue_invoice", { inv: p.data });
  if (error) return { ok: false, error: error.message };
  refresh(p.data);
  return { ok: true, number: String(data) };
}

// ---------------------------------------------------------------- duplicate
export async function duplicateInvoice(raw: unknown): Promise<Result<{ id: string }>> {
  const p = id.safeParse(raw);
  if (!p.success) return BAD_INPUT;
  const me = await staffWith("finance.invoices.create");
  if (!me) return NO_ACCESS;
  const { supabase, inv } = await loadInvoice(p.data);
  if (!inv) return { ok: false, error: "Invoice not found." };
  const { data: lines } = await supabase
    .from("invoice_lines")
    .select("position, description, detail, qty, rate, tax_pct, amount")
    .eq("invoice_id", p.data)
    .order("position");

  const today = new Date().toISOString().slice(0, 10);
  const termDays = Math.max(daysBetween(inv.issued_on as string, inv.due_on as string), 0);
  const t = computeTotals((lines ?? []).map((l) => ({ qty: Number(l.qty), rate: Number(l.rate), taxPct: Number(l.tax_pct) })), Number(inv.discount));
  const { data, error } = await supabase
    .from("invoices")
    .insert({
      client_id: inv.client_id,
      entity_id: inv.entity_id,
      currency: inv.currency,
      status: "draft",
      issued_on: today,
      due_on: addDays(today, termDays),
      title: inv.title,
      po_ref: inv.po_ref,
      discount: t.discount,
      subtotal: t.subtotal,
      tax_total: t.tax,
      total: t.total,
      channel_id: inv.channel_id,
      pay_link: null,
      notes: inv.notes,
      terms: inv.terms,
      bill_to: await billTo(inv.client_id as string),
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Couldn't duplicate the invoice." };
  if (lines?.length) {
    const { error: le } = await supabase.from("invoice_lines").insert(lines.map((l) => ({ ...l, invoice_id: data.id })));
    if (le) return { ok: false, error: le.message };
  }
  const from = inv.number ?? `Draft ${inv.draft_no}`;
  await supabase.from("invoice_events").insert({ invoice_id: data.id, kind: "duplicated", actor_id: me.id, note: `Duplicated from ${from}` });
  refresh(data.id);
  return { ok: true, id: data.id };
}

// ---------------------------------------------------------------- void, write off, dispute, resolve
const ReasonInput = z.object({ id, reason });

export async function voidInvoice(raw: unknown): Promise<Result> {
  const p = ReasonInput.safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? BAD_INPUT.error };
  const me = await staffWith("finance.invoices.void");
  if (!me) return NO_ACCESS;
  const { supabase, inv } = await loadInvoice(p.data.id);
  if (!inv) return { ok: false, error: "Invoice not found." };
  if (inv.status === "draft" || inv.status === "void") return { ok: false, error: "Only issued invoices can be voided." };
  const { error } = await supabase.from("invoices").update({ status: "void", status_reason: p.data.reason }).eq("id", inv.id);
  if (error) return { ok: false, error: error.message };
  const kept = round2(inv.paid - inv.refunded);
  await supabase.from("invoice_events").insert({
    invoice_id: inv.id,
    kind: "voided",
    actor_id: me.id,
    note: `Voided: ${p.data.reason}${kept > 0 ? `. ${money(kept, inv.currency)} paid moves to client credit` : ""}`,
    amount: kept > 0 ? kept : null,
  });
  refresh(inv.id);
  return { ok: true };
}

export async function writeOffInvoice(raw: unknown): Promise<Result> {
  const p = ReasonInput.safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? BAD_INPUT.error };
  const me = await staffWith("finance.invoices.void");
  if (!me) return NO_ACCESS;
  const { supabase, inv } = await loadInvoice(p.data.id);
  if (!inv) return { ok: false, error: "Invoice not found." };
  const settled = (await settledByInvoice([inv.id])).get(inv.id) ?? 0;
  const bal = balance({ ...inv, settled });
  if (bal <= 0) return { ok: false, error: "There is no open balance to write off." };
  const { error } = await supabase
    .from("invoices")
    .update({ status: "written_off", written_off_amount: bal, status_reason: p.data.reason })
    .eq("id", inv.id);
  if (error) return { ok: false, error: error.message };
  await supabase.from("invoice_events").insert({
    invoice_id: inv.id,
    kind: "written_off",
    actor_id: me.id,
    note: `Wrote off ${money(bal, inv.currency)}: ${p.data.reason}`,
    amount: bal,
  });
  refresh(inv.id);
  return { ok: true };
}

export async function disputeInvoice(raw: unknown): Promise<Result> {
  const p = ReasonInput.safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? BAD_INPUT.error };
  const me = await staffWith("finance.invoices.create");
  if (!me) return NO_ACCESS;
  const { supabase, inv } = await loadInvoice(p.data.id);
  if (!inv) return { ok: false, error: "Invoice not found." };
  if (!["issued", "partly_paid"].includes(inv.status)) return { ok: false, error: "Only open invoices can be disputed." };
  const { error } = await supabase.from("invoices").update({ status: "disputed", status_reason: p.data.reason }).eq("id", inv.id);
  if (error) return { ok: false, error: error.message };
  await supabase.from("invoice_events").insert({ invoice_id: inv.id, kind: "disputed", actor_id: me.id, note: `Disputed: ${p.data.reason}` });
  refresh(inv.id);
  return { ok: true };
}

export async function resolveDispute(raw: unknown): Promise<Result> {
  const p = z.object({ id, note: z.string().trim().max(1000).default("") }).safeParse(raw);
  if (!p.success) return BAD_INPUT;
  const me = await staffWith("finance.invoices.create");
  if (!me) return NO_ACCESS;
  const { supabase, inv } = await loadInvoice(p.data.id);
  if (!inv) return { ok: false, error: "Invoice not found." };
  if (inv.status !== "disputed") return { ok: false, error: "This invoice isn't disputed." };
  const { error } = await supabase
    .from("invoices")
    .update({ status: statusFromAmounts(inv.total, inv.paid, inv.refunded), status_reason: null })
    .eq("id", inv.id);
  if (error) return { ok: false, error: error.message };
  await supabase.from("invoice_events").insert({
    invoice_id: inv.id,
    kind: "resolved",
    actor_id: me.id,
    note: p.data.note ? `Dispute resolved: ${p.data.note}` : "Dispute resolved",
  });
  refresh(inv.id);
  return { ok: true };
}

// ---------------------------------------------------------------- refund
const RefundInput = z.object({
  id,
  amount: z.coerce.number().positive("Enter an amount"),
  date,
  channel_id: id.nullable().optional(),
  reference: text(200).default(""),
  reason,
});

export async function refundInvoice(raw: unknown): Promise<Result> {
  const p = RefundInput.safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? BAD_INPUT.error };
  const me = await getMe();
  if (!me || me.kind !== "staff" || !(can(me, "finance.payments.record", "all") || can(me, "finance.invoices.create", "all"))) return NO_ACCESS;
  const { supabase, inv } = await loadInvoice(p.data.id);
  if (!inv) return { ok: false, error: "Invoice not found." };
  const refundable = round2(inv.paid - inv.refunded);
  const amount = round2(p.data.amount);
  if (amount > refundable) return { ok: false, error: `You can refund up to ${money(refundable, inv.currency)}.` };
  const refunded = round2(inv.refunded + amount);
  const status = ["void", "written_off"].includes(inv.status) ? inv.status : statusFromAmounts(inv.total, inv.paid, refunded);
  const { error } = await supabase.from("invoices").update({ amount_refunded: refunded, status }).eq("id", inv.id);
  if (error) return { ok: false, error: error.message };
  await supabase.from("invoice_events").insert({
    invoice_id: inv.id,
    kind: "refund",
    actor_id: me.id,
    amount,
    note: `Refunded ${money(amount, inv.currency)}: ${p.data.reason}`,
    meta: { date: p.data.date, channel_id: p.data.channel_id ?? null, reference: p.data.reference || null },
  });
  refresh(inv.id);
  return { ok: true };
}

// ---------------------------------------------------------------- email (sends once a provider is set in Finance settings; until then records intent)
const EmailInput = z.object({
  id,
  kind: z.enum(["invoice", "reminder", "receipt"]),
  to: z.string().trim().min(3, "Add a recipient").max(500),
  cc: text(500).default(""),
  subject: z.string().trim().min(1, "Add a subject").max(300),
  body: z.string().trim().min(1, "Add a message").max(10000),
});

export async function requestEmail(raw: unknown): Promise<Result> {
  const p = EmailInput.safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? BAD_INPUT.error };
  const me = await staffWith("finance.invoices.send");
  if (!me) return NO_ACCESS;
  const { supabase, inv } = await loadInvoice(p.data.id);
  if (!inv) return { ok: false, error: "Invoice not found." };
  if (inv.status === "draft") return { ok: false, error: "Issue the invoice before emailing it." };
  const sent = await sendLoggedEmail({ kind: p.data.kind, to: p.data.to, cc: p.data.cc, subject: p.data.subject, text: p.data.body, invoiceId: inv.id, createdBy: me.id });
  const what = `${p.data.kind === "invoice" ? "Invoice" : p.data.kind === "reminder" ? "Reminder" : "Receipt"} email to ${p.data.to}${p.data.cc ? `, cc ${p.data.cc}` : ""}`;
  const { error } = await supabase.from("invoice_events").insert({
    invoice_id: inv.id,
    kind: "email_requested",
    actor_id: me.id,
    note: sent.ok
      ? `${what} sent`
      : "notConfigured" in sent
        ? `${what} saved. Not sent: email sending is off until a provider is set up`
        : `${what} failed: ${sent.error}`,
    meta: { ...p.data, sent: sent.ok },
  });
  if (error) return { ok: false, error: error.message };
  refresh(inv.id);
  if (!sent.ok && !("notConfigured" in sent)) return { ok: false, error: sent.error };
  return { ok: true };
}

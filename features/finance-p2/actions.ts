"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getMe, can } from "@/lib/auth/can";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmailSender } from "./email";
import {
  agingExport,
  checkApplyCredit,
  checkGiveBack,
  checkPastInvoice,
  checkSubLink,
  invoiceBalance,
  invoicesExport,
  paymentsExport,
  pastInvoiceStatus,
  toCsv,
  upworkFee,
} from "./logic";
import { getCredit, getDraftPreview, getEmailStatus, getSubLinks, listEntities, loadInvoices, loadReceipts, todayIso } from "./queries";
import { CURRENCIES, EMAIL_PROVIDERS, EXPORT_KINDS, UPWORK_STATUSES, type Result } from "./types";

// Every action: zod parse -> can() check -> Supabase write (RLS is the real guard) -> revalidate.
// Phase 1 columns written: invoices(number, client_id, entity_id, currency, status, title, issued_on, due_on, total),
// invoice_lines(invoice_id, position, description, qty, rate, tax_pct). See WIRING.md.

const FORM_ERROR = "Check the form and try again.";
const NO_ACCESS = "You don't have access to do that.";

const id = z.uuid();
const money = z.coerce.number().min(0).max(1e11);
const cur = z.enum(CURRENCIES);
const optText = (max = 500) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

async function staff(perm: string) {
  const me = await getMe();
  return me && me.kind === "staff" && can(me, perm) ? me : null;
}

function refresh(...paths: string[]) {
  for (const p of paths) revalidatePath(p);
}

// ---------------------------------------------------------------- monthly drafts

const DraftsInput = z.object({ month: z.iso.date(), clientIds: z.array(id).min(1).max(500) });

/** Creates draft invoices from agreed fees for the chosen clients. Plans are rebuilt on the server. */
export async function createMonthlyDrafts(raw: unknown): Promise<Result<{ created: number }>> {
  const input = DraftsInput.safeParse(raw);
  if (!input.success) return { ok: false, error: "Pick at least one client." };
  const me = await staff("finance.drafts.create");
  if (!me) return { ok: false, error: NO_ACCESS };

  const { plans } = await getDraftPreview(input.data.month);
  const chosen = plans.filter((p) => input.data.clientIds.includes(p.clientId));
  if (!chosen.length) return { ok: false, error: "Those drafts were already made." };

  const supabase = await createClient();
  let created = 0;
  for (const p of chosen) {
    // Claim the month first so a second click can't make a duplicate.
    const claim = await supabase
      .from("monthly_drafts")
      .insert({ month: input.data.month, client_id: p.clientId, amount: p.total, currency: p.currency, sub_client_ids: p.subClientIds, created_by: me.id })
      .select("id")
      .single();
    if (claim.error) continue;
    const inv = await supabase
      .from("invoices")
      .insert({ client_id: p.clientId, entity_id: p.entityId, currency: p.currency, status: "draft", title: p.title, issued_on: p.issuedOn, due_on: p.dueOn, total: p.total })
      .select("id")
      .single();
    if (inv.error || !inv.data) {
      await supabase.from("monthly_drafts").delete().eq("id", claim.data.id);
      return { ok: false, error: created ? `${created} drafts made, then: ${inv.error?.message}` : inv.error?.message ?? FORM_ERROR };
    }
    await supabase.from("invoice_lines").insert(
      p.lines.map((l, i) => ({ invoice_id: inv.data.id, position: i, description: l.description, qty: l.qty, rate: l.rate, tax_pct: l.taxPct })),
    );
    await supabase.from("monthly_drafts").update({ invoice_id: inv.data.id }).eq("id", claim.data.id);
    created++;
  }
  refresh("/finance/invoices", "/finance");
  return { ok: true, created };
}

// ---------------------------------------------------------------- past invoices, original document, portal visibility

const PastInput = z.object({
  number: z.string().trim().min(1).max(40),
  clientId: id,
  entityId: id,
  currency: cur,
  issuedOn: z.iso.date(),
  dueOn: z.iso.date(),
  total: money,
  paid: money,
  title: optText(200),
  portalVisible: z.boolean(),
});

export async function recordPastInvoice(raw: unknown): Promise<Result<{ invoiceId: string }>> {
  const input = PastInput.safeParse(raw);
  if (!input.success) return { ok: false, error: FORM_ERROR };
  const me = await staff("finance.invoices.record_past");
  if (!me) return { ok: false, error: NO_ACCESS };
  const d = input.data;
  const bad = checkPastInvoice({ total: d.total, paid: d.paid, issuedOn: d.issuedOn, dueOn: d.dueOn, today: todayIso() });
  if (bad) return { ok: false, error: bad };

  const supabase = await createClient();
  const dup = await supabase.from("invoices").select("id").eq("number", d.number).eq("entity_id", d.entityId).maybeSingle();
  if (dup.data) return { ok: false, error: `Invoice ${d.number} is already recorded.` };

  const inv = await supabase
    .from("invoices")
    .insert({
      number: d.number,
      client_id: d.clientId,
      entity_id: d.entityId,
      currency: d.currency,
      status: pastInvoiceStatus(d.total, d.paid),
      title: d.title ?? "Past invoice",
      issued_on: d.issuedOn,
      due_on: d.dueOn,
      total: d.total,
    })
    .select("id")
    .single();
  if (inv.error || !inv.data) return { ok: false, error: inv.error?.message ?? FORM_ERROR };

  const ex = await supabase.from("invoice_extras").insert({
    invoice_id: inv.data.id,
    client_id: d.clientId,
    is_past: true,
    paid_before_portal: d.paid,
    portal_visible: d.portalVisible,
    recorded_by: me.id,
  });
  if (ex.error) return { ok: false, error: ex.error.message };
  refresh("/finance/invoices", "/finance", "/portal/invoices");
  return { ok: true, invoiceId: inv.data.id };
}

async function invoiceClient(invoiceId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("invoices").select("client_id").eq("id", invoiceId).maybeSingle();
  return data ? String((data as { client_id: string }).client_id) : null;
}

async function editorOfInvoices() {
  return (await staff("finance.invoices.create")) ?? (await staff("finance.invoices.record_past"));
}

const VisibleInput = z.object({ invoiceId: id, visible: z.boolean() });

export async function setPortalVisible(raw: unknown): Promise<Result> {
  const input = VisibleInput.safeParse(raw);
  if (!input.success) return { ok: false, error: FORM_ERROR };
  if (!(await editorOfInvoices())) return { ok: false, error: NO_ACCESS };
  const clientId = await invoiceClient(input.data.invoiceId);
  if (!clientId) return { ok: false, error: "Invoice not found." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("invoice_extras")
    .upsert({ invoice_id: input.data.invoiceId, client_id: clientId, portal_visible: input.data.visible }, { onConflict: "invoice_id" });
  if (error) return { ok: false, error: error.message };
  refresh(`/finance/invoices/${input.data.invoiceId}`, "/portal/invoices");
  return { ok: true };
}

const DocInput = z.object({ invoiceId: id, path: z.string().min(3).max(500).nullable(), name: optText(200) });

/** Saves (or clears, with path null) the original document after the browser uploaded it. */
export async function setOriginalDocument(raw: unknown): Promise<Result> {
  const input = DocInput.safeParse(raw);
  if (!input.success) return { ok: false, error: FORM_ERROR };
  if (!(await editorOfInvoices())) return { ok: false, error: NO_ACCESS };
  const { invoiceId, path, name } = input.data;
  const clientId = await invoiceClient(invoiceId);
  if (!clientId) return { ok: false, error: "Invoice not found." };
  if (path && !path.startsWith(`${clientId}/${invoiceId}/`)) return { ok: false, error: FORM_ERROR };
  const supabase = await createClient();
  const prev = await supabase.from("invoice_extras").select("original_doc_path").eq("invoice_id", invoiceId).maybeSingle();
  const { error } = await supabase
    .from("invoice_extras")
    .upsert({ invoice_id: invoiceId, client_id: clientId, original_doc_path: path, original_doc_name: path ? name : null }, { onConflict: "invoice_id" });
  if (error) return { ok: false, error: error.message };
  const old = (prev.data as { original_doc_path: string | null } | null)?.original_doc_path;
  if (old && old !== path) await supabase.storage.from("invoice-originals").remove([old]);
  refresh(`/finance/invoices/${invoiceId}`, "/portal/invoices");
  return { ok: true };
}

// ---------------------------------------------------------------- client credit

const ApplyInput = z.object({ clientId: id, currency: cur, invoiceId: id, amount: z.coerce.number().positive().max(1e11) });

export async function applyCredit(raw: unknown): Promise<Result> {
  const input = ApplyInput.safeParse(raw);
  if (!input.success) return { ok: false, error: FORM_ERROR };
  const me = await staff("finance.payments.record");
  if (!me) return { ok: false, error: NO_ACCESS };
  const d = input.data;
  const [{ balances }, [inv]] = await Promise.all([getCredit(), loadInvoices({ ids: [d.invoiceId] })]);
  if (!inv) return { ok: false, error: "Invoice not found." };
  const available = balances.find((b) => b.clientId === d.clientId && b.currency === d.currency)?.amount ?? 0;
  const bad = checkApplyCredit({
    amount: d.amount,
    available,
    invoiceBalance: invoiceBalance(inv),
    sameClient: inv.clientId === d.clientId,
    sameCurrency: inv.currency === d.currency,
  });
  if (bad) return { ok: false, error: bad };
  const supabase = await createClient();
  const { error } = await supabase
    .from("credit_movements")
    .insert({ client_id: d.clientId, kind: "applied", amount: d.amount, currency: d.currency, invoice_id: d.invoiceId, created_by: me.id });
  if (error) return { ok: false, error: error.message };
  refresh("/finance/payments", "/finance/invoices", `/finance/invoices/${d.invoiceId}`, "/finance", "/portal/invoices");
  return { ok: true };
}

const GiveBackInput = z.object({
  clientId: id,
  currency: cur,
  amount: z.coerce.number().positive().max(1e11),
  channel: optText(80),
  reference: optText(120),
  reason: z.string().trim().max(1000),
});

export async function giveCreditBack(raw: unknown): Promise<Result> {
  const input = GiveBackInput.safeParse(raw);
  if (!input.success) return { ok: false, error: FORM_ERROR };
  const me = await staff("finance.payments.record");
  if (!me) return { ok: false, error: NO_ACCESS };
  const d = input.data;
  const { balances } = await getCredit();
  const available = balances.find((b) => b.clientId === d.clientId && b.currency === d.currency)?.amount ?? 0;
  const bad = checkGiveBack({ amount: d.amount, available, reason: d.reason });
  if (bad) return { ok: false, error: bad };
  const supabase = await createClient();
  const { error } = await supabase.from("credit_movements").insert({
    client_id: d.clientId,
    kind: "given_back",
    amount: d.amount,
    currency: d.currency,
    channel: d.channel,
    reference: d.reference,
    reason: d.reason,
    created_by: me.id,
  });
  if (error) return { ok: false, error: error.message };
  refresh("/finance/payments", "/finance");
  return { ok: true };
}

// ---------------------------------------------------------------- Upwork

const EarningInput = z.object({
  id: id.optional(),
  contract: z.string().trim().min(1).max(200),
  upwork_client: z.string().trim().min(1).max(200),
  kind: z.enum(["fixed", "hourly"]),
  hours: z.union([z.coerce.number().min(0).max(10000), z.literal(""), z.null()]).optional().transform((v) => (v === "" || v == null ? null : v)),
  earned: money,
  fee: z.union([money, z.literal(""), z.null()]).optional().transform((v) => (v === "" || v == null ? null : v)),
  currency: cur,
  status: z.enum(UPWORK_STATUSES),
  earned_on: z.iso.date(),
  note: optText(1000),
});

export async function saveUpworkEarning(raw: unknown): Promise<Result> {
  const input = EarningInput.safeParse(raw);
  if (!input.success) return { ok: false, error: FORM_ERROR };
  const me = await staff("finance.payments.record");
  if (!me) return { ok: false, error: NO_ACCESS };
  const { id: rowId, fee, ...rest } = input.data;
  const row = { ...rest, hours: rest.kind === "hourly" ? rest.hours : null, fee: fee ?? upworkFee(rest.earned) };
  if (row.fee > row.earned) return { ok: false, error: "The fee can't be more than the amount earned." };
  const supabase = await createClient();
  const { error } = rowId
    ? await supabase.from("upwork_earnings").update(row).eq("id", rowId)
    : await supabase.from("upwork_earnings").insert({ ...row, created_by: me.id });
  if (error) return { ok: false, error: error.message };
  refresh("/finance/invoices");
  return { ok: true };
}

export async function deleteUpworkEarning(raw: unknown): Promise<Result> {
  const input = id.safeParse(raw);
  if (!input.success) return { ok: false, error: FORM_ERROR };
  if (!(await staff("finance.payments.record"))) return { ok: false, error: NO_ACCESS };
  const supabase = await createClient();
  const { error } = await supabase.from("upwork_earnings").delete().eq("id", input.data);
  if (error) return { ok: false, error: error.message };
  refresh("/finance/invoices");
  return { ok: true };
}

const WithdrawalInput = z.object({
  amount: z.coerce.number().positive().max(1e11),
  currency: cur,
  withdrawn_on: z.iso.date(),
  to_account: z.string().trim().min(1).max(120),
  reference: optText(120),
});

export async function addUpworkWithdrawal(raw: unknown): Promise<Result> {
  const input = WithdrawalInput.safeParse(raw);
  if (!input.success) return { ok: false, error: FORM_ERROR };
  const me = await staff("finance.payments.record");
  if (!me) return { ok: false, error: NO_ACCESS };
  const supabase = await createClient();
  const { error } = await supabase.from("upwork_withdrawals").insert({ ...input.data, created_by: me.id });
  if (error) return { ok: false, error: error.message };
  refresh("/finance/invoices");
  return { ok: true };
}

// ---------------------------------------------------------------- exports

const ExportInput = z.object({
  kind: z.enum(EXPORT_KINDS),
  entityId: z.union([id, z.literal("")]).optional().transform((v) => v || null),
  from: z.iso.date(),
  to: z.iso.date(),
});

/** Builds a CSV and logs the export. The browser turns `csv` into a download. */
export async function runExport(raw: unknown): Promise<Result<{ csv: string; filename: string; rows: number }>> {
  const input = ExportInput.safeParse(raw);
  if (!input.success) return { ok: false, error: FORM_ERROR };
  const { kind, entityId, from, to } = input.data;
  if (to < from) return { ok: false, error: "The end date is before the start date." };
  const me = await staff(kind === "payments" ? "finance.payments.view" : "finance.invoices.view");
  if (!me) return { ok: false, error: NO_ACCESS };

  const entities = await listEntities();
  const entityNames = new Map(entities.map((e) => [e.id, e.name]));
  let table;
  if (kind === "invoices") {
    table = invoicesExport(await loadInvoices({ entityId: entityId ?? undefined, from, to }), entityNames);
  } else if (kind === "aging") {
    // Aging is "as of" the end date: every invoice issued up to then.
    table = agingExport(await loadInvoices({ entityId: entityId ?? undefined, to }), to);
  } else {
    // Receipts have no entity; narrow by the clients that entity bills.
    let clientIds: string[] | undefined;
    if (entityId) {
      const supabase = await createClient();
      const bp = await supabase.from("billing_profiles").select("client_id").eq("entity_id", entityId);
      clientIds = ((bp.data ?? []) as { client_id: string }[]).map((r) => r.client_id);
    }
    table = paymentsExport(await loadReceipts({ from, to, clientIds }));
  }
  const rows = kind === "aging" ? table.filter((r) => r.length && r[0] !== "" && r[0] !== "Totals").length - 1 : table.length - 1;
  const supabase = await createClient();
  await supabase.from("finance_exports").insert({
    kind,
    entity_id: entityId,
    entity_label: entityId ? entityNames.get(entityId) ?? null : "All entities",
    from_date: kind === "aging" ? null : from,
    to_date: to,
    row_count: Math.max(0, rows),
    created_by: me.id,
  });
  refresh("/finance/invoices");
  return { ok: true, csv: toCsv(table), filename: `${kind}-${kind === "aging" ? to : `${from}-to-${to}`}.csv`, rows: Math.max(0, rows) };
}

// ---------------------------------------------------------------- email sending

const EmailSettingsInput = z.object({
  provider: z.enum(EMAIL_PROVIDERS),
  from_name: optText(120),
  from_email: z.union([z.email(), z.literal("")]).optional().transform((v) => v || null),
  reply_to: z.union([z.email(), z.literal("")]).optional().transform((v) => v || null),
});

export async function saveEmailSettings(raw: unknown): Promise<Result> {
  const input = EmailSettingsInput.safeParse(raw);
  if (!input.success) return { ok: false, error: "Check the email addresses and try again." };
  const me = await staff("finance.settings.manage");
  if (!me) return { ok: false, error: NO_ACCESS };
  const domain = input.data.from_email?.split("@")[1] ?? null;
  const supabase = await createClient();
  const { error } = await supabase
    .from("email_settings")
    .upsert({ singleton: true, ...input.data, domain, updated_by: me.id }, { onConflict: "singleton" });
  if (error) return { ok: false, error: error.message };
  refresh("/finance/settings");
  return { ok: true };
}

export async function sendTestEmail(raw: unknown): Promise<Result> {
  const input = z.email().safeParse(raw);
  if (!input.success) return { ok: false, error: "Enter a valid email address." };
  const me = await staff("finance.settings.manage");
  if (!me) return { ok: false, error: NO_ACCESS };
  const { settings } = await getEmailStatus();
  const provider = settings?.provider ?? "none";
  const subject = "Test email from the finance portal";
  const res = await getEmailSender(provider).send(input.data, subject, "<p>This is a test email. Sending works.</p>");
  const supabase = await createClient();
  await supabase.from("email_log").insert({
    kind: "test",
    to_email: input.data,
    subject,
    provider,
    status: res.ok ? "sent" : "failed",
    error: res.ok ? null : res.error,
    created_by: me.id,
  });
  refresh("/finance/settings");
  return res.ok ? { ok: true } : { ok: false, error: res.error };
}

// ---------------------------------------------------------------- sub-account linked billing

const LinkInput = z.object({ parentId: id, childId: id });

/**
 * Bills `childId` under `parentId` (client_sub_accounts.billing = 'parent').
 * client_sub_accounts writes need clients.data.manage under RLS, so after the billing permission check
 * this uses the service client and touches only that one row.
 */
export async function linkSubAccount(raw: unknown): Promise<Result> {
  const input = LinkInput.safeParse(raw);
  if (!input.success) return { ok: false, error: FORM_ERROR };
  const me = await staff("clients.billing.edit");
  if (!me) return { ok: false, error: NO_ACCESS };
  const { parentId, childId } = input.data;
  const bad = checkSubLink(parentId, childId, await getSubLinks());
  if (bad) return { ok: false, error: bad };
  const admin = createAdminClient();
  const { error } = await admin
    .from("client_sub_accounts")
    .upsert({ parent_client_id: parentId, child_client_id: childId, billing: "parent", linked_by: me.id }, { onConflict: "child_client_id" });
  if (error) return { ok: false, error: error.message };
  refresh("/finance/clients", `/clients/${parentId}`);
  return { ok: true };
}

/** Stops billing a sub-account under its main account. The account link itself stays (billing = 'own'). */
export async function unlinkSubAccount(raw: unknown): Promise<Result> {
  const input = LinkInput.safeParse(raw);
  if (!input.success) return { ok: false, error: FORM_ERROR };
  const me = await staff("clients.billing.edit");
  if (!me) return { ok: false, error: NO_ACCESS };
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("client_sub_accounts")
    .update({ billing: "own" })
    .eq("parent_client_id", input.data.parentId)
    .eq("child_client_id", input.data.childId)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return { ok: false, error: "That sub-account isn't linked." };
  refresh("/finance/clients", `/clients/${input.data.parentId}`);
  return { ok: true };
}

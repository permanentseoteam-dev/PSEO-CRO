import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Currency, InvoiceStatus, Rates } from "./logic";
import type { BillTo, ClientOption, Entity, InvoiceDetail, InvoiceEvent, InvoiceLine, InvoiceRow, PayChannel, Receipt, Refund } from "./types";

/** Today as YYYY-MM-DD (UTC). */
export const todayIso = () => new Date().toISOString().slice(0, 10);

const num = (v: unknown) => (v == null ? 0 : Number(v));

type Raw = Record<string, unknown>;

const INVOICE_COLS =
  "id, number, draft_no, status, client_id, entity_id, currency, issued_on, due_on, title, total, amount_paid, amount_refunded, written_off_amount, fx_rate_usd, clients(name)";

function toRow(r: Raw): InvoiceRow {
  const c = r.clients as { name?: string } | { name?: string }[] | null;
  const clientName = Array.isArray(c) ? c[0]?.name : c?.name;
  return {
    id: r.id as string,
    number: (r.number as string) ?? null,
    draft_no: num(r.draft_no),
    status: r.status as InvoiceStatus,
    client_id: r.client_id as string,
    client_name: clientName ?? "Unknown client",
    entity_id: r.entity_id as string,
    currency: r.currency as Currency,
    issued_on: r.issued_on as string,
    due_on: r.due_on as string,
    title: (r.title as string) ?? "",
    total: num(r.total),
    amount_paid: num(r.amount_paid),
    amount_refunded: num(r.amount_refunded),
    written_off_amount: num(r.written_off_amount),
    fx_rate_usd: r.fx_rate_usd == null ? null : Number(r.fx_rate_usd),
  };
}

export async function getRefData() {
  const supabase = await createClient();
  const [ents, chans, clients, fx] = await Promise.all([
    supabase.from("entities").select("id, code, name, short_name, country, address, tax_id, invoice_prefix, tax_label, tax_rate, currency").eq("active", true).order("code"),
    supabase.from("channels_pay").select("id, name, type, account, details").eq("active", true).order("name"),
    supabase.from("clients").select("id, name, currency").neq("status", "internal").order("name"),
    supabase.from("fx_rates").select("currency, rate_to_usd, valid_from").order("valid_from", { ascending: false }),
  ]);
  const rates: Rates = {};
  for (const r of fx.data ?? []) {
    const cur = r.currency as Currency;
    if (rates[cur] == null) rates[cur] = Number(r.rate_to_usd);
  }
  return {
    entities: (ents.data ?? []).map((e) => ({ ...e, tax_rate: num(e.tax_rate) })) as Entity[],
    channels: (chans.data ?? []) as PayChannel[],
    clients: (clients.data ?? []) as ClientOption[],
    rates,
  };
}

export async function listInvoices(): Promise<InvoiceRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("invoices")
    .select(INVOICE_COLS)
    .order("issued_on", { ascending: false })
    .order("number", { ascending: false, nullsFirst: true });
  return (data ?? []).map((r) => toRow(r as Raw));
}

export async function getInvoice(id: string): Promise<{ invoice: InvoiceDetail; events: InvoiceEvent[] } | null> {
  const supabase = await createClient();
  const { data: r } = await supabase
    .from("invoices")
    .select(`${INVOICE_COLS}, po_ref, discount, subtotal, tax_total, channel_id, pay_link, notes, terms, bill_to, status_reason`)
    .eq("id", id)
    .maybeSingle();
  if (!r) return null;
  const [{ data: lines }, { data: events }] = await Promise.all([
    supabase.from("invoice_lines").select("id, description, detail, qty, rate, tax_pct").eq("invoice_id", id).order("position"),
    supabase.from("invoice_events").select("id, kind, note, amount, created_at, actor:members(name)").eq("invoice_id", id).order("created_at", { ascending: false }),
  ]);
  const raw = r as Raw;
  return {
    invoice: {
      ...toRow(raw),
      po_ref: (raw.po_ref as string) ?? null,
      discount: num(raw.discount),
      subtotal: num(raw.subtotal),
      tax_total: num(raw.tax_total),
      channel_id: (raw.channel_id as string) ?? null,
      pay_link: (raw.pay_link as string) ?? null,
      notes: (raw.notes as string) ?? null,
      terms: (raw.terms as string) ?? null,
      bill_to: (raw.bill_to as BillTo) ?? {},
      status_reason: (raw.status_reason as string) ?? null,
      lines: (lines ?? []).map(
        (l): InvoiceLine => ({ id: l.id, description: l.description ?? "", detail: l.detail ?? "", qty: num(l.qty), rate: num(l.rate), tax_pct: num(l.tax_pct) }),
      ),
    },
    events: (events ?? []).map((e) => {
      const a = e.actor as { name?: string } | { name?: string }[] | null;
      return {
        id: e.id,
        kind: e.kind,
        note: e.note,
        amount: e.amount == null ? null : Number(e.amount),
        created_at: e.created_at,
        actor_name: (Array.isArray(a) ? a[0]?.name : a?.name) ?? null,
      };
    }),
  };
}

/**
 * Billing defaults for a new invoice. billing_profiles belongs to 0111_finance_ops; read it loosely so this
 * page still works if that table is missing or named columns differ.
 */
export async function getBillingDefaults(clientId: string): Promise<{
  billTo: BillTo;
  entityId?: string;
  channelId?: string;
  currency?: Currency;
  termsDays?: number;
}> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("billing_profiles").select("*").eq("client_id", clientId).maybeSingle();
  if (error || !data) return { billTo: {} };
  const p = data as Raw;
  const s = (...keys: string[]) => {
    for (const k of keys) if (typeof p[k] === "string" && p[k]) return p[k] as string;
    return undefined;
  };
  const cc = Array.isArray(p.cc_emails) ? (p.cc_emails as string[]).join(", ") : s("cc", "cc_email");
  return {
    billTo: {
      name: s("legal_name", "name"),
      contact: s("contact", "contact_name"),
      address: s("address"),
      tax_id: s("tax_id"),
      email: s("billing_email", "email"),
      cc,
    },
    entityId: s("entity_id"),
    channelId: s("channel_id"),
    currency: s("currency") as Currency | undefined,
    termsDays: p.terms_days == null ? undefined : Number(p.terms_days),
  };
}

// ---------------------------------------------------------------- dashboard

/**
 * Receipts and reminders live in 0111_finance_ops. They're read loosely (select *) and mapped from the
 * likely column names, so the dashboard degrades to zero instead of crashing if that module differs.
 */
export async function getDashboardData() {
  const supabase = await createClient();
  const today = todayIso();
  const [invoices, receipts, refunds, reminders] = await Promise.all([
    listInvoices(),
    supabase.from("receipts").select("*"),
    supabase.from("invoice_events").select("amount, meta, created_at, invoices(currency, fx_rate_usd)").eq("kind", "refund"),
    supabase.from("reminders").select("*"),
  ]);

  const pick = (r: Raw, ...keys: string[]) => {
    for (const k of keys) if (r[k] != null) return r[k];
    return null;
  };
  const rcpts: Receipt[] = (receipts.error ? [] : (receipts.data as Raw[]))
    .filter((r) => r.status !== "void" && !r.voided_at)
    .map((r) => {
      const rate = pick(r, "fx_rate_usd", "rate_to_usd", "fx_rate", "rate");
      return {
        date: String(pick(r, "received_on", "received_at", "date") ?? "").slice(0, 10),
        amount: num(r.amount),
        fee: num(r.fee),
        currency: (r.currency as Currency) ?? "USD",
        rate: rate == null ? null : Number(rate),
        channelId: (pick(r, "channel_id") as string) ?? null,
      };
    })
    .filter((r) => r.date);

  const refundRows: Refund[] = (refunds.data ?? []).map((e) => {
    const inv = (Array.isArray(e.invoices) ? e.invoices[0] : e.invoices) as { currency?: Currency; fx_rate_usd?: number } | null;
    const meta = (e.meta ?? {}) as { date?: string };
    return {
      date: meta.date ?? String(e.created_at).slice(0, 10),
      amount: num(e.amount),
      currency: inv?.currency ?? "USD",
      rate: inv?.fx_rate_usd == null ? null : Number(inv.fx_rate_usd),
    };
  });

  let remindersToday: { total: number; auto: number } | null = null;
  if (!reminders.error) {
    const due = (reminders.data as Raw[]).filter((r) => {
      const on = String(pick(r, "send_on", "scheduled_on", "due_on", "on_date") ?? "").slice(0, 10);
      const paused = r.paused_until != null && String(r.paused_until) > today;
      const done = ["sent", "skipped", "cancelled"].includes(String(r.status ?? ""));
      return on && on <= today && !paused && !done;
    });
    remindersToday = { total: due.length, auto: due.filter((r) => r.auto === true).length };
  }

  return { today, invoices, receipts: rcpts, refunds: refundRows, remindersToday };
}

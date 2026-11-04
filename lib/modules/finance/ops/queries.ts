import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { balance, fmtDay, isOverdue, type Currency, type Rates } from "../core/logic";
import { listInvoices } from "../core/queries";
import { computeProfitability, monthRange, monthlyAgreedFee, type FeeBasis, type ProfClient, type Stage } from "./logic";
import type {
  BillingRow,
  ChannelPick,
  ChannelRow,
  ClientPick,
  CreditRow,
  EntityRow,
  OpenInvoiceRow,
  OpsSettings,
  ReceiptRow,
  RefundRow,
  ReminderRow,
  SalaryRow,
} from "./types";

export { todayIso } from "../core/queries";

type Raw = Record<string, unknown>;
const num = (v: unknown) => (v == null ? 0 : Number(v));
const str = (v: unknown) => (typeof v === "string" ? v : "");
/** A to-one embedded relation can come back as an object or a one-item array. */
const one = <T>(v: unknown): T | null => (Array.isArray(v) ? ((v[0] as T) ?? null) : ((v as T) ?? null));

async function latestRates(): Promise<Rates> {
  const supabase = await createClient();
  const { data } = await supabase.from("fx_rates").select("currency, rate_to_usd, valid_from").order("valid_from", { ascending: false });
  const rates: Rates = {};
  for (const r of data ?? []) if (rates[r.currency as Currency] == null) rates[r.currency as Currency] = Number(r.rate_to_usd);
  rates.USD ??= 1;
  return rates;
}

// ---------------------------------------------------------------- payments

export async function getPaymentsData() {
  const supabase = await createClient();
  const [rc, cr, refunds, clients, chans, profiles, invoices, rates] = await Promise.all([
    supabase
      .from("receipts")
      .select(
        "id, receipt_no, client_id, received_on, currency, amount, fee, landed_amount, fx_rate_usd, channel_id, account, reference, note, proof_paths, no_proof_reason, status, void_reason, clients(name), channels_pay(name), receipt_allocations(invoice_id, amount, invoices(number))",
      )
      .order("received_on", { ascending: false })
      .order("receipt_no", { ascending: false }),
    supabase.from("client_credit").select("client_id, currency, amount, receipt_id, note, created_at, clients(name), receipts(receipt_no, received_on)"),
    supabase
      .from("invoice_events")
      .select("amount, note, meta, created_at, invoice_id, invoices(number, currency, fx_rate_usd, clients(name))")
      .eq("kind", "refund")
      .order("created_at", { ascending: false }),
    supabase.from("clients").select("id, name, currency").neq("status", "internal").order("name"),
    supabase.from("channels_pay").select("id, name, account").eq("active", true).order("name"),
    supabase.from("billing_profiles").select("client_id, currency, channel_id"),
    listInvoices(),
    latestRates(),
  ]);

  const creditByReceipt = new Map<string, number>();
  for (const c of (cr.data ?? []) as Raw[]) if (c.receipt_id) creditByReceipt.set(c.receipt_id as string, num(c.amount));

  const receipts: ReceiptRow[] = ((rc.data ?? []) as Raw[]).map((r) => ({
    id: r.id as string,
    no: num(r.receipt_no),
    clientId: r.client_id as string,
    clientName: one<{ name: string }>(r.clients)?.name ?? "Unknown client",
    date: r.received_on as string,
    currency: r.currency as Currency,
    amount: num(r.amount),
    fee: num(r.fee),
    landed: num(r.landed_amount),
    rate: r.fx_rate_usd == null ? null : Number(r.fx_rate_usd),
    channelId: (r.channel_id as string) ?? null,
    channelName: one<{ name: string }>(r.channels_pay)?.name ?? null,
    account: (r.account as string) ?? null,
    reference: (r.reference as string) ?? null,
    note: (r.note as string) ?? null,
    proofPaths: (r.proof_paths as string[]) ?? [],
    noProofReason: (r.no_proof_reason as string) ?? null,
    status: r.status as "recorded" | "void",
    voidReason: (r.void_reason as string) ?? null,
    allocations: ((r.receipt_allocations as Raw[]) ?? []).map((a) => ({
      invoiceId: a.invoice_id as string,
      number: one<{ number: string }>(a.invoices)?.number ?? "Invoice",
      amount: num(a.amount),
    })),
    credit: creditByReceipt.get(r.id as string) ?? 0,
  }));

  // Credit balance per client and currency.
  const creditMap = new Map<string, CreditRow>();
  for (const c of (cr.data ?? []) as Raw[]) {
    const key = `${c.client_id}|${c.currency}`;
    const rcp = one<{ receipt_no: number; received_on: string }>(c.receipts);
    const from = rcp ? `P-${rcp.receipt_no}, ${fmtDay(rcp.received_on)}` : str(c.note);
    const row = creditMap.get(key) ?? {
      clientId: c.client_id as string,
      clientName: one<{ name: string }>(c.clients)?.name ?? "Unknown client",
      currency: c.currency as Currency,
      amount: 0,
      from,
    };
    row.amount += num(c.amount);
    creditMap.set(key, row);
  }
  const credits = [...creditMap.values()].filter((c) => c.amount > 0.004);

  const refundRows: RefundRow[] = ((refunds.data ?? []) as Raw[]).map((e) => {
    const inv = one<{ number: string; currency: Currency; fx_rate_usd: number | null; clients: unknown }>(e.invoices);
    const meta = (e.meta ?? {}) as { date?: string; reason?: string };
    const note = str(e.note);
    return {
      date: meta.date ?? String(e.created_at).slice(0, 10),
      clientName: one<{ name: string }>(inv?.clients)?.name ?? "Unknown client",
      invoiceId: e.invoice_id as string,
      number: inv?.number ?? "Invoice",
      currency: inv?.currency ?? "USD",
      amount: num(e.amount),
      reason: meta.reason ?? (note.includes(": ") ? note.slice(note.indexOf(": ") + 2) : note),
      rate: inv?.fx_rate_usd == null ? null : Number(inv.fx_rate_usd),
    };
  });

  const profileBy = new Map(((profiles.data ?? []) as Raw[]).map((p) => [p.client_id as string, p]));
  const clientPicks: ClientPick[] = ((clients.data ?? []) as Raw[]).map((c) => {
    const p = profileBy.get(c.id as string);
    return {
      id: c.id as string,
      name: c.name as string,
      currency: ((p?.currency as Currency) ?? (c.currency as Currency)) || "USD",
      channelId: (p?.channel_id as string) ?? null,
    };
  });

  return { receipts, credits, refunds: refundRows, clients: clientPicks, channels: (chans.data ?? []) as ChannelPick[], invoices, rates };
}

/** Open invoices with balances, for the record payment dialog and the still owed tab. */
export function openInvoicesFrom(invoices: Awaited<ReturnType<typeof listInvoices>>, today: string): OpenInvoiceRow[] {
  return invoices
    .map((i) => {
      const money = { status: i.status, total: i.total, paid: i.amount_paid, due: i.due_on };
      return {
        id: i.id,
        number: i.number ?? "Draft",
        clientId: i.client_id,
        clientName: i.client_name,
        currency: i.currency,
        due: i.due_on,
        balance: balance(money),
        overdue: isOverdue(money, today),
        rate: i.fx_rate_usd,
      };
    })
    .filter((i) => i.balance > 0)
    .sort((a, b) => a.due.localeCompare(b.due));
}

// ---------------------------------------------------------------- billing clients

export async function getBillingRows(): Promise<{ rows: BillingRow[]; entities: { id: string; name: string; currency: Currency }[]; channels: ChannelPick[] }> {
  const supabase = await createClient();
  const [clients, profiles, ents, chans, invoices] = await Promise.all([
    supabase.from("clients").select("id, name, currency, country").neq("status", "internal").order("name"),
    supabase.from("billing_profiles").select("*, entities(short_name), channels_pay(name)"),
    supabase.from("entities").select("id, name, currency").eq("active", true).order("code"),
    supabase.from("channels_pay").select("id, name, account").eq("active", true).order("name"),
    supabase.from("invoices").select("client_id, status, total, amount_paid, currency").in("status", ["issued", "partly_paid", "disputed"]),
  ]);
  const owed = new Map<string, number>();
  for (const i of (invoices.data ?? []) as Raw[]) {
    const b = Math.max(num(i.total) - num(i.amount_paid), 0);
    owed.set(i.client_id as string, (owed.get(i.client_id as string) ?? 0) + b);
  }
  const byClient = new Map(((profiles.data ?? []) as Raw[]).map((p) => [p.client_id as string, p]));
  const rows: BillingRow[] = ((clients.data ?? []) as Raw[]).map((c) => {
    const p = byClient.get(c.id as string);
    return {
      clientId: c.id as string,
      clientName: c.name as string,
      clientCurrency: c.currency as Currency,
      hasProfile: !!p,
      legalName: str(p?.legal_name),
      contact: str(p?.contact),
      billingEmail: str(p?.billing_email),
      cc: str(p?.cc),
      country: str(p?.country) || str(c.country),
      address: str(p?.address),
      taxId: str(p?.tax_id),
      entityId: (p?.entity_id as string) ?? null,
      entityShort: one<{ short_name: string }>(p?.entities)?.short_name ?? null,
      currency: ((p?.currency as Currency) ?? (c.currency as Currency)) || "USD",
      channelId: (p?.channel_id as string) ?? null,
      channelName: one<{ name: string }>(p?.channels_pay)?.name ?? null,
      termsDays: p ? num(p.terms_days) : 14,
      agreedFee: num(p?.agreed_fee),
      feeBasis: ((p?.fee_basis as FeeBasis) ?? "monthly") as FeeBasis,
      hoursBudget: p?.hours_budget == null ? null : Number(p.hours_budget),
      notes: str(p?.notes),
      autoReminders: p ? p.auto_reminders === true : true,
      openBalance: Math.round((owed.get(c.id as string) ?? 0) * 100) / 100,
    };
  });
  return { rows, entities: (ents.data ?? []) as { id: string; name: string; currency: Currency }[], channels: (chans.data ?? []) as ChannelPick[] };
}

// ---------------------------------------------------------------- reminders

export async function syncReminders() {
  const supabase = await createClient();
  await supabase.rpc("sync_payment_reminders");
}

export async function getReminderRows(): Promise<ReminderRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reminders")
    .select(
      "id, invoice_id, stage, send_on, status, auto, paused_until, pause_note, sent_at, result, sender:members(name), invoices(number, client_id, currency, total, amount_paid, due_on, clients(name, owner:members!clients_owner_id_fkey(name, email)))",
    )
    .order("send_on", { ascending: true });
  const rows = (data ?? []) as Raw[];
  const clientIds = [...new Set(rows.map((r) => one<{ client_id: string }>(r.invoices)?.client_id).filter(Boolean))] as string[];
  const { data: profiles } = clientIds.length
    ? await supabase.from("billing_profiles").select("client_id, billing_email, cc, contact, channels_pay(name)").in("client_id", clientIds)
    : { data: [] };
  const prof = new Map(((profiles ?? []) as Raw[]).map((p) => [p.client_id as string, p]));

  return rows.map((r) => {
    const inv = one<Raw>(r.invoices) ?? {};
    const client = one<Raw>(inv.clients) ?? {};
    const owner = one<{ name: string; email: string }>(client.owner);
    const p = prof.get(inv.client_id as string);
    return {
      id: r.id as string,
      invoiceId: r.invoice_id as string,
      number: str(inv.number) || "Invoice",
      clientId: inv.client_id as string,
      clientName: str(client.name) || "Unknown client",
      currency: (inv.currency as Currency) ?? "USD",
      balance: Math.max(num(inv.total) - num(inv.amount_paid), 0),
      due: str(inv.due_on),
      stage: r.stage as Stage,
      sendOn: r.send_on as string,
      status: r.status as ReminderRow["status"],
      auto: r.auto === true,
      pausedUntil: (r.paused_until as string) ?? null,
      pauseNote: (r.pause_note as string) ?? null,
      sentAt: (r.sent_at as string) ?? null,
      sentByName: one<{ name: string }>(r.sender)?.name ?? null,
      result: (r.result as string) ?? null,
      ownerName: owner?.name ?? null,
      ownerEmail: owner?.email ?? null,
      billingEmail: str(p?.billing_email),
      cc: str(p?.cc),
      contact: str(p?.contact),
      channelName: one<{ name: string }>(p?.channels_pay)?.name ?? null,
    };
  });
}

// ---------------------------------------------------------------- settings

const DEFAULT_SETTINGS: OpsSettings = {
  marginAlertPct: 35,
  workingHours: 160,
  alertMargin: true,
  alertBudget: true,
  alertNegative: false,
  alertTo: "leaders",
  reminderStages: ["before", "late_1", "late_7", "late_14", "late_30"],
  tellAmAt30: true,
  reminderRunTime: "10:00",
  reminderFrom: "billing@permanentseo.com",
};

export async function getOpsSettings(): Promise<OpsSettings> {
  const supabase = await createClient();
  const { data: s } = await supabase.from("finance_ops_settings").select("*").maybeSingle();
  if (!s) return DEFAULT_SETTINGS;
  return {
    marginAlertPct: num(s.margin_alert_pct),
    workingHours: num(s.working_hours),
    alertMargin: !!s.alert_margin,
    alertBudget: !!s.alert_budget,
    alertNegative: !!s.alert_negative,
    alertTo: s.alert_to,
    reminderStages: s.reminder_stages as Stage[],
    tellAmAt30: !!s.tell_am_at_30,
    reminderRunTime: String(s.reminder_run_time).slice(0, 5),
    reminderFrom: s.reminder_from,
  };
}

export async function getSettingsData() {
  const supabase = await createClient();
  const [ents, chans, fx, members, sal] = await Promise.all([
    supabase.from("entities").select("*").order("code"),
    supabase.from("channels_pay").select("*").order("name"),
    supabase.from("fx_rates").select("currency, rate_to_usd, valid_from, updated_at").order("valid_from", { ascending: false }),
    supabase.from("members").select("id, name, departments!members_department_id_fkey(name)").eq("kind", "staff").eq("status", "active").order("name"),
    supabase.from("salaries").select("member_id, monthly_amount, currency, valid_from").order("valid_from", { ascending: false }),
  ]);
  const entities: EntityRow[] = ((ents.data ?? []) as Raw[]).map((e) => ({
    id: e.id as string,
    code: e.code as string,
    name: e.name as string,
    shortName: e.short_name as string,
    country: (e.country as string) ?? null,
    address: (e.address as string) ?? null,
    taxId: (e.tax_id as string) ?? null,
    prefix: e.invoice_prefix as string,
    taxLabel: e.tax_label as string,
    taxRate: num(e.tax_rate),
    currency: e.currency as Currency,
    nextNumber: num(e.next_number),
    active: e.active === true,
  }));
  const channels: ChannelRow[] = ((chans.data ?? []) as Raw[]).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    type: c.type as ChannelRow["type"],
    account: (c.account as string) ?? null,
    details: (c.details as string) ?? null,
    feeNote: (c.fee_note as string) ?? null,
    active: c.active === true,
  }));
  const rates: Partial<Record<Currency, { rate: number; validFrom: string; updatedAt: string }>> = {};
  for (const r of (fx.data ?? []) as Raw[]) {
    const cur = r.currency as Currency;
    if (!rates[cur]) rates[cur] = { rate: num(r.rate_to_usd), validFrom: r.valid_from as string, updatedAt: r.updated_at as string };
  }
  const latestSal = new Map<string, Raw>();
  for (const s of (sal.data ?? []) as Raw[]) if (!latestSal.has(s.member_id as string)) latestSal.set(s.member_id as string, s);
  const salaries: SalaryRow[] | null = sal.error
    ? null
    : ((members.data ?? []) as Raw[]).map((m) => {
        const s = latestSal.get(m.id as string);
        return {
          memberId: m.id as string,
          name: m.name as string,
          department: one<{ name: string }>(m.departments)?.name ?? "No department",
          amount: s ? num(s.monthly_amount) : null,
          currency: ((s?.currency as Currency) ?? "USD") as Currency,
          validFrom: (s?.valid_from as string) ?? null,
        };
      });
  return { entities, channels, rates, salaries };
}

// ---------------------------------------------------------------- profitability

/**
 * Profitability for each month in `months` (YYYY-MM), in USD. Reads salaries and everyone's time across clients,
 * so it uses the service client: call it only after can(me, "finance.profitability.view", "all").
 */
export async function getProfitability(months: string[], workingHours: number) {
  const admin = createAdminClient();
  const from = monthRange(months[0]).from;
  const to = monthRange(months[months.length - 1]).to;
  const [members, sal, entries, team, clients, profiles, invoices, rates] = await Promise.all([
    admin.from("members").select("id, name, departments!members_department_id_fkey(name)").eq("kind", "staff").neq("status", "left"),
    admin.from("salaries").select("member_id, monthly_amount, currency, valid_from").order("valid_from", { ascending: false }),
    admin.from("time_entries").select("member_id, minutes, date, tickets(client_id)").gte("date", from).lte("date", to),
    admin.from("client_team").select("client_id, member_id"),
    admin.from("clients").select("id, name, services, status, start_date, end_date").neq("status", "internal"),
    admin.from("billing_profiles").select("client_id, agreed_fee, fee_basis, currency, hours_budget"),
    admin
      .from("invoices")
      .select("client_id, issued_on, total, tax_total, currency, fx_rate_usd, status")
      .gte("issued_on", from)
      .lte("issued_on", to)
      .not("status", "in", "(draft,void)"),
    admin.from("fx_rates").select("currency, rate_to_usd, valid_from").order("valid_from", { ascending: false }),
  ]);

  const rateNow: Rates = { USD: 1 };
  for (const r of (rates.data ?? []) as Raw[]) rateNow[r.currency as Currency] ??= num(r.rate_to_usd);
  const usd = (amount: number, cur: Currency, rate?: number | null) => amount * (rate ?? rateNow[cur] ?? 1);

  const salRows = (sal.data ?? []) as Raw[];
  const prof = new Map(((profiles.data ?? []) as Raw[]).map((p) => [p.client_id as string, p]));
  const memberRows = (members.data ?? []) as Raw[];
  const clientRows = (clients.data ?? []) as Raw[];
  const entryRows = ((entries.data ?? []) as Raw[]).map((e) => ({
    memberId: e.member_id as string,
    minutes: num(e.minutes),
    date: e.date as string,
    clientId: one<{ client_id: string | null }>(e.tickets)?.client_id ?? null,
  }));
  const invRows = (invoices.data ?? []) as Raw[];
  const teamRows = ((team.data ?? []) as Raw[]).map((t) => ({ clientId: t.client_id as string, memberId: t.member_id as string }));

  return months.map((ym) => {
    const { from: mFrom, to: mTo } = monthRange(ym);
    const monthEntries = entryRows.filter((e) => e.date >= mFrom && e.date <= mTo);
    const profMembers = memberRows
      .map((m) => {
        const s = salRows.find((x) => x.member_id === m.id && String(x.valid_from) <= mTo);
        return {
          id: m.id as string,
          name: m.name as string,
          department: one<{ name: string }>(m.departments)?.name ?? "No department",
          salary: s ? usd(num(s.monthly_amount), s.currency as Currency) : 0,
        };
      })
      .filter((m) => m.salary > 0);
    const profClients: ProfClient[] = clientRows
      .filter((c) => (!c.start_date || String(c.start_date) <= mTo) && (!c.end_date || String(c.end_date) >= mFrom) && c.status !== "paused")
      .map((c) => {
        const p = prof.get(c.id as string);
        const inv = invRows.filter((i) => i.client_id === c.id && String(i.issued_on) >= mFrom && String(i.issued_on) <= mTo);
        const hours = monthEntries.filter((e) => e.clientId === c.id).reduce((a, e) => a + e.minutes / 60, 0);
        const agreed = p ? usd(monthlyAgreedFee(num(p.agreed_fee), p.fee_basis as FeeBasis, hours), p.currency as Currency) : 0;
        return {
          id: c.id as string,
          name: c.name as string,
          services: (c.services as string[]) ?? [],
          invoiced: inv.length
            ? inv.reduce((a, i) => a + usd(num(i.total) - num(i.tax_total), i.currency as Currency, i.fx_rate_usd == null ? null : Number(i.fx_rate_usd)), 0)
            : null,
          agreedFee: agreed,
          hoursBudget: p?.hours_budget == null ? null : Number(p.hours_budget),
        };
      });
    return {
      month: ym,
      ...computeProfitability({ members: profMembers, entries: monthEntries, team: teamRows, clients: profClients, workingHours }),
    };
  });
}

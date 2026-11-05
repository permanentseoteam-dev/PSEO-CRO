import "server-only";
import { createClient } from "@/lib/supabase/server";
import { buildMonthlyDrafts, creditBalances, invoiceBalance, isOpen, isPortalVisible, monthStart, nextMonthStart } from "./logic";
import type {
  BillingProfile,
  CreditIn,
  CreditMovement,
  Currency,
  EmailLogRow,
  EmailSettings,
  EntityOption,
  ExportLog,
  FeeBasis,
  InvoiceExtra,
  InvoiceLite,
  InvoiceStatus,
  Option,
  ReceiptLite,
  SubLink,
  UpworkEarning,
  UpworkWithdrawal,
} from "./types";

// Reads run as the signed-in user, so RLS decides what comes back. Errors read as empty.
//
// Phase 1 column names assumed here (keep in sync with 0108/0110/0111, see WIRING.md):
//   clients(id, name)
//   entities(id, name, tax_rate, currency)
//   billing_profiles(client_id, entity_id, currency, agreed_fee, fee_basis, terms_days)
//   invoices(id, number, client_id, entity_id, currency, status, title, issued_on, due_on, total, amount_paid)
//   client_credit(client_id, amount, currency)                       -- credit in (overpayments)
//   receipts(received_on, client_id, amount, fee, landed_amount, currency, channel_id -> channels_pay(name), reference)
type Row = Record<string, unknown>;
const rows = <T,>(r: { data: unknown }) => (r.data ?? []) as T[];
const num = (v: unknown) => Number(v ?? 0) || 0;

/** Today as YYYY-MM-DD in the agency's timezone (Asia/Dubai). */
export const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Dubai" });

export const INVOICE_COLS = "id, number, client_id, entity_id, currency, status, title, issued_on, due_on, total, amount_paid";

export async function listClients(): Promise<Option[]> {
  const supabase = await createClient();
  return rows<Option>(await supabase.from("clients").select("id, name").order("name"));
}

export async function listEntities(): Promise<EntityOption[]> {
  const supabase = await createClient();
  const r = rows<Row>(await supabase.from("entities").select("id, name, currency").order("name"));
  return r.map((e) => ({ id: String(e.id), name: String(e.name), currency: (e.currency as Currency) ?? "USD" }));
}

const nameMap = (list: Option[]) => new Map(list.map((c) => [c.id, c.name]));

/** Invoices with extras and applied credit folded in. `ids` narrows the read. */
export async function loadInvoices(filter: { ids?: string[]; clientId?: string; entityId?: string; from?: string; to?: string } = {}): Promise<InvoiceLite[]> {
  const supabase = await createClient();
  let q = supabase.from("invoices").select(INVOICE_COLS);
  if (filter.ids) q = q.in("id", filter.ids.length ? filter.ids : ["00000000-0000-0000-0000-000000000000"]);
  if (filter.clientId) q = q.eq("client_id", filter.clientId);
  if (filter.entityId) q = q.eq("entity_id", filter.entityId);
  if (filter.from) q = q.gte("issued_on", filter.from);
  if (filter.to) q = q.lte("issued_on", filter.to);
  const inv = rows<Row>(await q.order("issued_on", { ascending: true }));
  if (!inv.length) return [];
  const ids = inv.map((i) => String(i.id));
  const [clients, extras, credit] = await Promise.all([
    listClients(),
    supabase.from("invoice_extras").select("invoice_id, paid_before_portal").in("invoice_id", ids),
    supabase.from("invoice_credit_applied").select("invoice_id, amount").in("invoice_id", ids),
  ]);
  const names = nameMap(clients);
  const before = new Map(rows<Row>(extras).map((x) => [String(x.invoice_id), num(x.paid_before_portal)]));
  const applied = new Map(rows<Row>(credit).map((x) => [String(x.invoice_id), num(x.amount)]));
  return inv.map((i) => ({
    id: String(i.id),
    number: (i.number as string | null) ?? null,
    clientId: String(i.client_id),
    clientName: names.get(String(i.client_id)) ?? "Unknown client",
    entityId: (i.entity_id as string | null) ?? null,
    currency: i.currency as Currency,
    status: i.status as InvoiceStatus,
    title: (i.title as string | null) ?? null,
    issuedOn: (i.issued_on as string | null) ?? null,
    dueOn: (i.due_on as string | null) ?? null,
    total: num(i.total),
    amountPaid: num(i.amount_paid),
    paidBeforePortal: before.get(String(i.id)) ?? 0,
    creditApplied: applied.get(String(i.id)) ?? 0,
  }));
}

// ---------------------------------------------------------------- monthly drafts

export async function getBillingProfiles(): Promise<BillingProfile[]> {
  const supabase = await createClient();
  const [bp, ents, clients] = await Promise.all([
    supabase.from("billing_profiles").select("client_id, entity_id, currency, agreed_fee, fee_basis, terms_days"),
    supabase.from("entities").select("id, name, tax_rate"),
    listClients(),
  ]);
  const names = nameMap(clients);
  const ent = new Map(rows<Row>(ents).map((e) => [String(e.id), e]));
  return rows<Row>(bp).map((p) => {
    const e = ent.get(String(p.entity_id));
    return {
      clientId: String(p.client_id),
      clientName: names.get(String(p.client_id)) ?? "Unknown client",
      entityId: String(p.entity_id),
      entityName: e ? String(e.name) : "",
      currency: p.currency as Currency,
      agreedFee: num(p.agreed_fee),
      feeBasis: p.fee_basis as FeeBasis,
      termsDays: num(p.terms_days),
      taxRate: e ? num(e.tax_rate) : 0,
    };
  });
}

export async function getSubLinks(): Promise<SubLink[]> {
  const supabase = await createClient();
  const r = rows<Row>(await supabase.from("client_sub_accounts").select("parent_client_id, child_client_id, billing"));
  return r.map((l) => ({ parentId: String(l.parent_client_id), childId: String(l.child_client_id), billing: l.billing as SubLink["billing"] }));
}

/** Draft plans for `month` (default: next month) for clients that have no draft yet. */
export async function getDraftPreview(month = nextMonthStart(todayIso())) {
  const supabase = await createClient();
  const [profiles, links, existing] = await Promise.all([
    getBillingProfiles(),
    getSubLinks(),
    supabase.from("monthly_drafts").select("client_id").eq("month", month),
  ]);
  const existingClientIds = rows<Row>(existing).map((r) => String(r.client_id));
  return { month, plans: buildMonthlyDrafts({ profiles, links, month, existingClientIds }), made: existingClientIds.length };
}

// ---------------------------------------------------------------- invoice extras

export async function getInvoiceExtra(invoiceId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("invoice_extras").select("*").eq("invoice_id", invoiceId).maybeSingle();
  const extra = (data ?? null) as InvoiceExtra | null;
  let docUrl: string | null = null;
  if (extra?.original_doc_path) {
    const s = await supabase.storage.from("invoice-originals").createSignedUrl(extra.original_doc_path, 600);
    docUrl = s.data?.signedUrl ?? null;
  }
  return { extra, docUrl };
}

/**
 * For the client portal: which of the given invoices the client may see, plus a signed link to each
 * original document. Runs under the client's RLS, so only their visible rows come back.
 */
export async function getPortalInvoiceExtras(invoices: { id: string; status: InvoiceStatus }[]) {
  const supabase = await createClient();
  const ids = invoices.map((i) => i.id);
  const extras = ids.length ? rows<InvoiceExtra>(await supabase.from("invoice_extras").select("*").in("invoice_id", ids)) : [];
  const byId = new Map(extras.map((x) => [x.invoice_id, x]));
  // RLS already hides invoices marked hidden (restrictive policy in 0206); this also drops drafts and voids.
  const visibleIds = invoices.filter((i) => isPortalVisible(i.status, byId.get(i.id) ?? null)).map((i) => i.id);
  const docs = new Map<string, string>();
  for (const x of extras) {
    if (!x.original_doc_path || !visibleIds.includes(x.invoice_id)) continue;
    const s = await supabase.storage.from("invoice-originals").createSignedUrl(x.original_doc_path, 600);
    if (s.data?.signedUrl) docs.set(x.invoice_id, s.data.signedUrl);
  }
  return { visibleIds, docs };
}

// ---------------------------------------------------------------- credit

export async function getCredit() {
  const supabase = await createClient();
  const [credits, moves, clients] = await Promise.all([
    supabase.from("client_credit").select("client_id, amount, currency"),
    supabase
      .from("credit_movements")
      .select("id, client_id, kind, amount, currency, invoice_id, channel, reference, reason, created_at")
      .order("created_at", { ascending: false }),
    listClients(),
  ]);
  const names = nameMap(clients);
  const ins: CreditIn[] = rows<Row>(credits).map((c) => ({ clientId: String(c.client_id), currency: c.currency as Currency, amount: num(c.amount) }));
  const mv = rows<Row>(moves);
  const invIds = [...new Set(mv.map((m) => m.invoice_id).filter(Boolean) as string[])];
  const numbers = new Map<string, string>();
  if (invIds.length) {
    for (const i of rows<Row>(await supabase.from("invoices").select("id, number").in("id", invIds))) numbers.set(String(i.id), String(i.number ?? ""));
  }
  const movements: CreditMovement[] = mv.map((m) => ({
    id: String(m.id),
    clientId: String(m.client_id),
    clientName: names.get(String(m.client_id)) ?? "Unknown client",
    kind: m.kind as CreditMovement["kind"],
    amount: num(m.amount),
    currency: m.currency as Currency,
    invoiceNumber: m.invoice_id ? numbers.get(String(m.invoice_id)) ?? null : null,
    channel: (m.channel as string | null) ?? null,
    reference: (m.reference as string | null) ?? null,
    reason: (m.reason as string | null) ?? null,
    createdAt: String(m.created_at),
  }));
  const balances = creditBalances(ins, movements, names);
  return { balances, movements };
}

/** Open invoices of clients that hold credit, for the "Apply to" select. */
export async function getOpenInvoicesFor(clientIds: string[]) {
  if (!clientIds.length) return [];
  const all = await Promise.all(clientIds.map((id) => loadInvoices({ clientId: id })));
  return all
    .flat()
    .filter(isOpen)
    .sort((a, b) => (a.dueOn ?? "").localeCompare(b.dueOn ?? ""))
    .map((i) => ({ id: i.id, clientId: i.clientId, number: i.number ?? "Draft", currency: i.currency, balance: invoiceBalance(i) }));
}

// ---------------------------------------------------------------- Upwork

export async function getUpwork(today = todayIso()) {
  const supabase = await createClient();
  const [e, w] = await Promise.all([
    supabase.from("upwork_earnings").select("*").order("earned_on", { ascending: false }),
    supabase.from("upwork_withdrawals").select("*").order("withdrawn_on", { ascending: false }),
  ]);
  const earnings = rows<Row>(e).map((x) => ({ ...x, earned: num(x.earned), fee: num(x.fee), hours: x.hours == null ? null : num(x.hours) })) as UpworkEarning[];
  const withdrawals = rows<Row>(w).map((x) => ({ ...x, amount: num(x.amount) })) as UpworkWithdrawal[];
  return { earnings, withdrawals, month: monthStart(today) };
}

// ---------------------------------------------------------------- exports

export async function listRecentExports(): Promise<ExportLog[]> {
  const supabase = await createClient();
  const [log, members] = await Promise.all([
    supabase.from("finance_exports").select("id, kind, entity_label, from_date, to_date, row_count, created_at, created_by").order("created_at", { ascending: false }).limit(10),
    supabase.from("members").select("id, name"),
  ]);
  const names = new Map(rows<Row>(members).map((m) => [String(m.id), String(m.name)]));
  return rows<Row>(log).map((l) => ({
    id: String(l.id),
    kind: l.kind as ExportLog["kind"],
    entity_label: (l.entity_label as string | null) ?? null,
    from_date: (l.from_date as string | null) ?? null,
    to_date: (l.to_date as string | null) ?? null,
    row_count: num(l.row_count),
    created_at: String(l.created_at),
    by_name: l.created_by ? names.get(String(l.created_by)) ?? null : null,
  }));
}

export async function loadReceipts(filter: { from?: string; to?: string; clientIds?: string[] }): Promise<ReceiptLite[]> {
  const supabase = await createClient();
  let q = supabase.from("receipts").select("received_on, client_id, amount, fee, landed_amount, currency, reference, channels_pay(name)").eq("status", "recorded");
  if (filter.from) q = q.gte("received_on", filter.from);
  if (filter.to) q = q.lte("received_on", filter.to);
  if (filter.clientIds) q = q.in("client_id", filter.clientIds.length ? filter.clientIds : ["00000000-0000-0000-0000-000000000000"]);
  const [r, clients] = await Promise.all([q.order("received_on"), listClients()]);
  const names = nameMap(clients);
  return rows<Row>(r).map((x) => ({
    receivedOn: String(x.received_on),
    clientName: names.get(String(x.client_id)) ?? "Unknown client",
    amount: num(x.amount),
    fee: num(x.fee),
    landed: x.landed_amount == null ? null : num(x.landed_amount),
    currency: x.currency as Currency,
    channel: ((x.channels_pay as { name?: string } | null)?.name as string | undefined) ?? null,
    reference: (x.reference as string | null) ?? null,
  }));
}

// ---------------------------------------------------------------- email sending

export async function getEmailStatus() {
  const supabase = await createClient();
  const [s, log] = await Promise.all([
    supabase.from("email_settings").select("*").maybeSingle(),
    supabase.from("email_log").select("status, created_at").order("created_at", { ascending: false }).limit(2000),
  ]);
  return { settings: (s.data ?? null) as EmailSettings | null, log: rows<EmailLogRow>(log) };
}

// ---------------------------------------------------------------- sub-accounts

/** Sub-accounts of `clientId` and clients that could be linked. */
export async function getSubAccounts(clientId: string) {
  const [links, clients] = await Promise.all([getSubLinks(), listClients()]);
  return subAccountsOf(clientId, links, clients);
}

/** Same as getSubAccounts for many clients, with one read (Billing clients table). */
export async function getSubAccountsFor(clientIds: string[]) {
  const [links, clients] = await Promise.all([getSubLinks(), listClients()]);
  return new Map(clientIds.map((id) => [id, subAccountsOf(id, links, clients)]));
}

function subAccountsOf(clientId: string, links: SubLink[], clients: Option[]) {
  const names = nameMap(clients);
  const subs = links.filter((l) => l.parentId === clientId).map((l) => ({ ...l, name: names.get(l.childId) ?? "Unknown client" }));
  const taken = new Set(links.map((l) => l.childId));
  const parents = new Set(links.map((l) => l.parentId));
  const candidates = clients.filter((c) => c.id !== clientId && !taken.has(c.id) && !parents.has(c.id));
  return { subs, candidates };
}

/** For the Billing clients table: main client id -> number of sub-accounts billed under it. */
export async function getSubAccountCounts(): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  for (const l of await getSubLinks()) if (l.billing === "parent") out[l.parentId] = (out[l.parentId] ?? 0) + 1;
  return out;
}

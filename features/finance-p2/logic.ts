// Pure rules for finance-p2. No I/O. Tested in __tests__/logic.test.ts.
import { addDays, differenceInCalendarDays, format, parseISO, startOfMonth, addMonths } from "date-fns";
import type { Tone } from "@/components/ui";
import type {
  BillingProfile,
  CreditBalance,
  CreditIn,
  Currency,
  DnsState,
  DraftLine,
  DraftPlan,
  EmailLogRow,
  EmailSettings,
  InvoiceExtra,
  InvoiceLite,
  InvoiceStatus,
  ReceiptLite,
  SubLink,
  UpworkEarning,
  UpworkStatus,
  UpworkWithdrawal,
} from "./types";

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const iso = (d: Date) => format(d, "yyyy-MM-dd");

export const fmtMoney = (amount: number, currency: string) =>
  `${currency} ${amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
export const fmtDate = (d: string | null | undefined) => (d ? format(parseISO(d), "d MMM yyyy") : "");

// ---------------------------------------------------------------- months
/** First day of the month after `today` (drafts are made for next month). */
export const nextMonthStart = (today: string) => iso(startOfMonth(addMonths(parseISO(today), 1)));
export const monthStart = (d: string) => iso(startOfMonth(parseISO(d)));
export const monthName = (month: string) => format(parseISO(month), "MMMM");
export const monthLabel = (month: string) => format(parseISO(month), "MMMM yyyy");

// ---------------------------------------------------------------- monthly drafts
/**
 * One draft per monthly-billed client that has no draft for `month` yet.
 * A sub-account billed under its parent (billing = 'parent', same currency, parent billed monthly) is added
 * to the parent's draft as its own line and gets no draft of its own.
 */
export function buildMonthlyDrafts(input: {
  profiles: BillingProfile[];
  links: SubLink[];
  month: string;
  existingClientIds: string[];
}): DraftPlan[] {
  const { profiles, links, month } = input;
  const done = new Set(input.existingClientIds);
  const byClient = new Map(profiles.map((p) => [p.clientId, p]));
  const billable = (p: BillingProfile | undefined): p is BillingProfile => !!p && p.feeBasis === "monthly" && p.agreedFee > 0;

  // child -> parent, only when the child really rolls into the parent's draft
  const rollsInto = new Map<string, string>();
  for (const l of links) {
    const parent = byClient.get(l.parentId);
    const child = byClient.get(l.childId);
    if (l.billing === "parent" && billable(parent) && billable(child) && child.currency === parent.currency) {
      rollsInto.set(l.childId, l.parentId);
    }
  }

  const name = monthName(month);
  const plans: DraftPlan[] = [];
  for (const p of profiles) {
    if (!billable(p) || rollsInto.has(p.clientId) || done.has(p.clientId)) continue;
    const subs = profiles.filter((c) => rollsInto.get(c.clientId) === p.clientId);
    const lines: DraftLine[] = [
      { description: `${name} retainer`, qty: 1, rate: p.agreedFee, taxPct: p.taxRate },
      ...subs.map((s) => ({ description: `${name} retainer, ${s.clientName}`, qty: 1, rate: s.agreedFee, taxPct: p.taxRate })),
    ];
    const t = lineTotals(lines);
    plans.push({
      clientId: p.clientId,
      clientName: p.clientName,
      entityId: p.entityId,
      entityName: p.entityName,
      currency: p.currency,
      title: `${name} retainer`,
      issuedOn: month,
      dueOn: iso(addDays(parseISO(month), p.termsDays)),
      lines,
      ...t,
      subClientIds: subs.map((s) => s.clientId),
    });
  }
  return plans;
}

/** line = qty x rate; tax per line; total = subtotal + tax. */
export function lineTotals(lines: DraftLine[]): { subtotal: number; tax: number; total: number } {
  let subtotal = 0;
  let tax = 0;
  for (const l of lines) {
    const amt = l.qty * l.rate;
    subtotal += amt;
    tax += (amt * l.taxPct) / 100;
  }
  subtotal = round2(subtotal);
  tax = round2(tax);
  return { subtotal, tax, total: round2(subtotal + tax) };
}

// ---------------------------------------------------------------- past invoices and portal visibility
/** Status for an invoice recorded after the fact, from what was already paid. */
export function pastInvoiceStatus(total: number, paid: number): InvoiceStatus {
  if (paid >= total) return "paid";
  if (paid > 0) return "partly_paid";
  return "issued";
}

export function checkPastInvoice(i: { total: number; paid: number; issuedOn: string; dueOn: string; today: string }): string | null {
  if (i.total <= 0) return "Total must be more than zero.";
  if (i.paid < 0) return "Already paid can't be negative.";
  if (i.paid > i.total) return "Already paid can't be more than the total.";
  if (i.dueOn < i.issuedOn) return "Due date can't be before the issue date.";
  if (i.issuedOn > i.today) return "A past invoice can't be issued in the future.";
  return null;
}

/** Drafts and voided invoices never show in the portal; others follow the toggle (shown by default). */
export function isPortalVisible(status: InvoiceStatus, extra: Pick<InvoiceExtra, "portal_visible"> | null | undefined): boolean {
  if (status === "draft" || status === "void") return false;
  return extra?.portal_visible ?? true;
}

// ---------------------------------------------------------------- balances and credit
export const invoiceBalance = (i: Pick<InvoiceLite, "total" | "amountPaid" | "paidBeforePortal" | "creditApplied">) =>
  Math.max(0, round2(i.total - i.amountPaid - i.paidBeforePortal - i.creditApplied));

const OPEN: InvoiceStatus[] = ["issued", "partly_paid", "disputed"];
export const isOpen = (i: InvoiceLite) => OPEN.includes(i.status) && invoiceBalance(i) > 0;

/** Credit left per client and currency: credit received minus credit applied or given back. */
export function creditBalances(
  credits: CreditIn[],
  used: { clientId: string; currency: Currency; amount: number }[],
  names: Map<string, string>,
): CreditBalance[] {
  const sums = new Map<string, number>();
  const key = (c: string, cur: string) => `${c}|${cur}`;
  for (const c of credits) sums.set(key(c.clientId, c.currency), (sums.get(key(c.clientId, c.currency)) ?? 0) + c.amount);
  for (const u of used) sums.set(key(u.clientId, u.currency), (sums.get(key(u.clientId, u.currency)) ?? 0) - u.amount);
  const out: CreditBalance[] = [];
  for (const [k, amount] of sums) {
    const [clientId, currency] = k.split("|");
    const a = round2(amount);
    if (a > 0) out.push({ clientId, clientName: names.get(clientId) ?? "Unknown client", currency: currency as Currency, amount: a });
  }
  return out.sort((a, b) => a.clientName.localeCompare(b.clientName));
}

export function checkApplyCredit(i: { amount: number; available: number; invoiceBalance: number; sameClient: boolean; sameCurrency: boolean }): string | null {
  if (!i.sameClient) return "Credit can only go on the same client's invoice.";
  if (!i.sameCurrency) return "The invoice is in a different currency from the credit.";
  if (i.amount <= 0) return "Enter an amount above zero.";
  if (i.amount > i.available) return "That is more than the credit left.";
  if (i.amount > i.invoiceBalance) return "That is more than the invoice balance.";
  return null;
}

export function checkGiveBack(i: { amount: number; available: number; reason: string }): string | null {
  if (i.amount <= 0) return "Enter an amount above zero.";
  if (i.amount > i.available) return "That is more than the credit left.";
  if (!i.reason.trim()) return "Add a reason.";
  return null;
}

/** Plain-words preview line under the apply-credit form. */
export function applyCreditPreview(invoiceNumber: string, balance: number, amount: number, available: number, currency: string): string {
  const left = round2(available - amount);
  const after = round2(balance - amount);
  return `${invoiceNumber} balance drops to ${fmtMoney(after, currency)}. ${left > 0 ? `${fmtMoney(left, currency)} credit left.` : "No credit left."}`;
}

// ---------------------------------------------------------------- Upwork
export const UPWORK_FEE_PCT = 10;
export const upworkFee = (earned: number, pct = UPWORK_FEE_PCT) => round2((earned * pct) / 100);

export const UPWORK_STATUS: Record<UpworkStatus, { label: string; tone: Tone }> = {
  in_review: { label: "In review", tone: "violet" },
  pending_release: { label: "Pending release", tone: "warn" },
  released: { label: "Released", tone: "ok" },
};

/** Cards: earned and fees this month, pending (not yet released, after fees), withdrawn this month. */
export function upworkStats(earnings: UpworkEarning[], withdrawals: UpworkWithdrawal[], month: string) {
  const inMonth = (d: string) => monthStart(d) === month;
  const sum = (xs: number[]) => round2(xs.reduce((a, b) => a + b, 0));
  const thisMonth = earnings.filter((e) => inMonth(e.earned_on));
  const w = withdrawals.filter((x) => inMonth(x.withdrawn_on)).sort((a, b) => b.withdrawn_on.localeCompare(a.withdrawn_on));
  return {
    earned: sum(thisMonth.map((e) => e.earned)),
    fees: sum(thisMonth.map((e) => e.fee)),
    pending: sum(earnings.filter((e) => e.status !== "released").map((e) => e.earned - e.fee)),
    withdrawn: sum(w.map((x) => x.amount)),
    lastAccount: w[0]?.to_account ?? null,
  };
}

// ---------------------------------------------------------------- aging and exports
export type AgingBucket = "not_due" | "1_30" | "31_60" | "61_90" | "90_plus";
export const AGING_LABEL: Record<AgingBucket, string> = {
  not_due: "Not due",
  "1_30": "1–30 days",
  "31_60": "31–60 days",
  "61_90": "61–90 days",
  "90_plus": "90+ days",
};

export function agingBucket(dueOn: string | null, today: string): AgingBucket {
  if (!dueOn) return "not_due";
  const late = differenceInCalendarDays(parseISO(today), parseISO(dueOn));
  if (late <= 0) return "not_due";
  if (late <= 30) return "1_30";
  if (late <= 60) return "31_60";
  if (late <= 90) return "61_90";
  return "90_plus";
}

type Cell = string | number | null | undefined;
const csvCell = (v: Cell) => {
  if (v == null) return "";
  const s = typeof v === "number" ? String(round2(v)) : v;
  // Quote when needed; prefix formula-like text so spreadsheets don't run it.
  const safe = /^[=+\-@\t\r]/.test(s) && typeof v !== "number" ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};
export const toCsv = (rows: Cell[][]) => rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";

const STATUS_LABEL: Record<InvoiceStatus, string> = {
  draft: "Draft",
  issued: "Issued",
  partly_paid: "Partly paid",
  paid: "Paid",
  void: "Void",
  refunded: "Refunded",
  partly_refunded: "Partly refunded",
  written_off: "Written off",
  disputed: "Disputed",
};
export const invoiceStatusLabel = (s: InvoiceStatus) => STATUS_LABEL[s] ?? s;

export function invoicesExport(invoices: InvoiceLite[], entityNames: Map<string, string>): Cell[][] {
  return [
    ["Number", "Client", "Entity", "Title", "Issued", "Due", "Currency", "Total", "Paid", "Credit applied", "Balance", "Status"],
    ...invoices.map((i) => [
      i.number,
      i.clientName,
      i.entityId ? entityNames.get(i.entityId) ?? "" : "",
      i.title,
      i.issuedOn,
      i.dueOn,
      i.currency,
      i.total,
      round2(i.amountPaid + i.paidBeforePortal),
      i.creditApplied,
      invoiceBalance(i),
      invoiceStatusLabel(i.status),
    ]),
  ];
}

export function paymentsExport(receipts: ReceiptLite[]): Cell[][] {
  return [
    ["Date", "Client", "Currency", "Amount", "Fee", "Landed", "Channel", "Reference"],
    ...receipts.map((r) => [r.receivedOn, r.clientName, r.currency, r.amount, r.fee, r.landed, r.channel, r.reference]),
  ];
}

/** One row per open invoice with its bucket, then a total per currency and bucket. */
export function agingExport(invoices: InvoiceLite[], today: string): Cell[][] {
  const open = invoices.filter(isOpen);
  const rows: Cell[][] = [["Number", "Client", "Due", "Currency", "Balance", "Days late", "Bucket"]];
  const totals = new Map<string, number>();
  for (const i of open) {
    const b = agingBucket(i.dueOn, today);
    const bal = invoiceBalance(i);
    const late = i.dueOn ? Math.max(0, differenceInCalendarDays(parseISO(today), parseISO(i.dueOn))) : 0;
    rows.push([i.number, i.clientName, i.dueOn, i.currency, bal, late, AGING_LABEL[b]]);
    const k = `${i.currency}|${b}`;
    totals.set(k, round2((totals.get(k) ?? 0) + bal));
  }
  rows.push([]);
  rows.push(["Totals", "", "", "Currency", "Balance", "", "Bucket"]);
  for (const [k, v] of [...totals].sort()) {
    const [cur, b] = k.split("|");
    rows.push(["", "", "", cur, v, "", AGING_LABEL[b as AgingBucket]]);
  }
  return rows;
}

// ---------------------------------------------------------------- sub-account billing
/** Rules for linking `childId` to be billed under `parentId`. */
export function checkSubLink(parentId: string, childId: string, links: SubLink[]): string | null {
  if (parentId === childId) return "A client can't be its own sub-account.";
  const childLink = links.find((l) => l.childId === childId);
  if (childLink && childLink.parentId !== parentId) return "That client is already a sub-account of another client.";
  if (links.some((l) => l.childId === parentId)) return "This client is itself a sub-account. Link it at the main account.";
  if (links.some((l) => l.parentId === childId)) return "That client has its own sub-accounts.";
  return null;
}

// ---------------------------------------------------------------- email sending
const DNS: Record<DnsState, { label: string; tone: Tone }> = {
  passing: { label: "Passing", tone: "ok" },
  failing: { label: "Failing", tone: "danger" },
  missing: { label: "Not set, add a record", tone: "warn" },
  unknown: { label: "Not checked", tone: "muted" },
};
export const dnsStatus = (s: DnsState) => DNS[s];

export function domainStatus(s: EmailSettings["domain_status"]): { label: string; tone: Tone } {
  if (s === "verified") return { label: "Verified", tone: "ok" };
  if (s === "pending") return { label: "Waiting for DNS", tone: "warn" };
  if (s === "failed") return { label: "Failed", tone: "danger" };
  return { label: "Not checked", tone: "muted" };
}

/** Sent / bounced / failed in the 30 days up to `today`. */
export function sendSummary(rows: EmailLogRow[], today: string) {
  const from = iso(addDays(parseISO(today), -29));
  const recent = rows.filter((r) => r.created_at.slice(0, 10) >= from);
  return {
    sent: recent.filter((r) => r.status === "sent").length,
    bounced: recent.filter((r) => r.status === "bounced").length,
    failed: recent.filter((r) => r.status === "failed").length,
  };
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

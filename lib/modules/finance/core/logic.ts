// Pure finance maths and status rules. No I/O.
import type { Tone } from "@/components/ui";

export type Currency = "AED" | "USD" | "PKR";
export const CURRENCIES: Currency[] = ["USD", "AED", "PKR"];

export type InvoiceStatus =
  | "draft"
  | "issued"
  | "partly_paid"
  | "paid"
  | "void"
  | "refunded"
  | "partly_refunded"
  | "written_off"
  | "disputed";

export const STATUS: Record<InvoiceStatus, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "muted" },
  issued: { label: "Issued", tone: "blue" },
  partly_paid: { label: "Partly paid", tone: "violet" },
  paid: { label: "Paid", tone: "ok" },
  void: { label: "Void", tone: "muted" },
  refunded: { label: "Refunded", tone: "warn" },
  partly_refunded: { label: "Partly refunded", tone: "warn" },
  written_off: { label: "Written off", tone: "muted" },
  disputed: { label: "Disputed", tone: "danger" },
};

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// ---------------------------------------------------------------- totals
export type LineInput = { qty: number; rate: number; taxPct: number };
export type Totals = { lines: number[]; subtotal: number; discount: number; tax: number; total: number };

/** line = qty × rate; the discount is spread over lines pro rata before tax; total = subtotal − discount + tax. */
export function computeTotals(lines: LineInput[], discount: number): Totals {
  const amounts = lines.map((l) => round2((l.qty || 0) * (l.rate || 0)));
  const subtotal = round2(amounts.reduce((a, b) => a + b, 0));
  const disc = round2(Math.min(Math.max(discount || 0, 0), subtotal));
  let tax = 0;
  amounts.forEach((amt, i) => {
    const share = subtotal ? (disc * amt) / subtotal : 0;
    tax += ((amt - share) * (lines[i].taxPct || 0)) / 100;
  });
  tax = round2(tax);
  return { lines: amounts, subtotal, discount: disc, tax, total: round2(subtotal - disc + tax) };
}

// ---------------------------------------------------------------- balances and status
export type Money = { status: InvoiceStatus; total: number; paid: number; refunded?: number; due: string };

const OPEN: InvoiceStatus[] = ["issued", "partly_paid", "disputed"];

export const balance = (i: Money) => (OPEN.includes(i.status) ? round2(Math.max(i.total - i.paid, 0)) : 0);
export const isOpen = (i: Money) => balance(i) > 0;

/** Whole days between two ISO dates (b − a). */
export function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5);
}

export function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const lateDays = (i: Money, today: string) => (isOpen(i) ? Math.max(daysBetween(i.due, today), 0) : 0);

/** Overdue is derived: open, not disputed, past its due date. */
export const isOverdue = (i: Money, today: string) => isOpen(i) && i.status !== "disputed" && lateDays(i, today) > 0;

/** Status after money moves on an issued invoice. Mirrors public.finance_status_from_amounts(). */
export function statusFromAmounts(total: number, paid: number, refunded: number): InvoiceStatus {
  if (refunded > 0) return refunded >= paid ? "refunded" : "partly_refunded";
  if (total > 0 && paid >= total) return "paid";
  if (paid > 0) return "partly_paid";
  return "issued";
}

/** Status shown in lists: Overdue wins over the stored status. */
export function displayStatus(i: Money, today: string): { label: string; tone: Tone; sub?: string } {
  if (isOverdue(i, today)) {
    const d = lateDays(i, today);
    return { label: "Overdue", tone: "danger", sub: `${d} ${d === 1 ? "day" : "days"}${i.status === "partly_paid" ? ", partly paid" : ""}` };
  }
  return STATUS[i.status];
}

/** Filter keys a row matches: its status, plus "open" and "overdue" when they apply. */
export function statusKeys(i: Money, today: string): string[] {
  const k: string[] = [i.status];
  if (isOpen(i)) k.push("open");
  if (isOverdue(i, today)) k.push("overdue");
  return k;
}

// ---------------------------------------------------------------- aging
export const AGING_LABELS = ["Not due", "1–30 days", "31–60 days", "61–90 days", "90+ days"] as const;

export function agingBucket(late: number) {
  return late <= 0 ? 0 : late <= 30 ? 1 : late <= 60 ? 2 : late <= 90 ? 3 : 4;
}

/** Sum open balances into the five aging buckets. `value` converts a balance (e.g. to the base currency). */
export function agingBuckets<T extends Money>(list: T[], today: string, value: (i: T, bal: number) => number = (_, b) => b) {
  const out = [0, 0, 0, 0, 0];
  for (const i of list) {
    if (!isOpen(i)) continue;
    out[agingBucket(daysBetween(i.due, today))] += value(i, balance(i));
  }
  return out.map(round2);
}

// ---------------------------------------------------------------- currency
export type Rates = Partial<Record<Currency, number>>; // 1 unit = rate USD

/** Convert between currencies through USD. Missing rates count as 1 so nothing silently disappears. */
export function convert(amount: number, from: Currency, to: Currency, rates: Rates, fromRate?: number | null) {
  if (from === to) return amount;
  const usd = amount * (fromRate ?? rates[from] ?? 1);
  return usd / (rates[to] ?? 1);
}

// ---------------------------------------------------------------- periods
export type PeriodKey = "month" | "last" | "quarter" | "ytd" | "year";
export const PERIOD_LABELS: Record<PeriodKey, string> = {
  month: "This month",
  last: "Last month",
  quarter: "Quarter",
  ytd: "YTD",
  year: "12 months",
};

const iso = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);

export function periodRange(key: PeriodKey, today: string): { from: string; to: string } {
  const [y, m] = today.split("-").map(Number);
  const mi = m - 1;
  switch (key) {
    case "last":
      return { from: iso(y, mi - 1, 1), to: iso(y, mi, 0) };
    case "quarter": {
      const q = Math.floor(mi / 3) * 3;
      return { from: iso(y, q, 1), to: iso(y, q + 3, 0) };
    }
    case "ytd":
      return { from: iso(y, 0, 1), to: today };
    case "year":
      return { from: iso(y, mi - 11, 1), to: iso(y, mi + 1, 0) };
    default:
      return { from: iso(y, mi, 1), to: iso(y, mi + 1, 0) };
  }
}

/** The last 12 months ending with today's month, as YYYY-MM keys. */
export function last12Months(today: string): string[] {
  const [y, m] = today.split("-").map(Number);
  return Array.from({ length: 12 }, (_, k) => iso(y, m - 12 + k, 1).slice(0, 7));
}

export const inRange = (d: string, r: { from: string; to: string }) => d >= r.from && d <= r.to;

// ---------------------------------------------------------------- formatting
export function money(n: number, cur: string, decimals: 0 | 2 = 2) {
  const v = decimals === 0 ? Math.round(n) : round2(n);
  return `${cur} ${v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: decimals })}`;
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const monthLabel = (ym: string) => MON[Number(ym.slice(5, 7)) - 1];
/** 15 Nov 2026 */
export const fmtDate = (d?: string | null) => (d ? `${Number(d.slice(8, 10))} ${MON[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}` : "—");
/** 15 Nov */
export const fmtDay = (d?: string | null) => (d ? `${Number(d.slice(8, 10))} ${MON[Number(d.slice(5, 7)) - 1]}` : "—");

/** Short axis label: 12k, 1.5M. */
export function axisLabel(v: number) {
  if (v >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (v >= 1e3) return Math.round(v / 1e3) + "k";
  return String(Math.round(v));
}

/** A round top value for a chart axis. */
export function niceTop(max: number) {
  if (max <= 0) return 1;
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  return Math.ceil(max / step) * step;
}

export const invoiceLabel = (i: { number: string | null; draft_no: number }) => i.number ?? `Draft ${i.draft_no}`;

// Pure helpers for the client portal. No I/O.
import type { Tone } from "@/components/ui/tone";

export type TicketStatus = "todo" | "in_progress" | "in_review" | "blocked" | "done";
export type Label = { label: string; tone: Tone };

const TZ = "Asia/Dubai";

/** "Good morning" / "Good afternoon" / "Good evening" for an hour 0-23. */
export function greeting(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Hour of day in Dubai. */
export function dubaiHour(now: Date): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" }).format(now));
}

/** Today's date in Dubai as YYYY-MM-DD. */
export function dubaiToday(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Ticket status in client words. */
export function clientStatus(status: TicketStatus): Label {
  switch (status) {
    case "todo":
      return { label: "Planned", tone: "muted" };
    case "in_progress":
      return { label: "In progress", tone: "blue" };
    case "in_review":
      return { label: "Ready soon", tone: "violet" };
    case "blocked":
      return { label: "On hold", tone: "warn" };
    case "done":
      return { label: "Done", tone: "ok" };
  }
}

/** Whole days from `from` to `to` (both YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** State of a dated commitment (a client-visible ticket) on `today`. */
export function commitmentState(t: { status: TicketStatus; due_date: string | null }, today: string): Label {
  if (t.status === "done") return { label: "Done", tone: "ok" };
  if (!t.due_date) return { label: "On track", tone: "ok" };
  const left = daysBetween(today, t.due_date);
  if (left < 0) return { label: "Late", tone: "danger" };
  if (t.status === "blocked" || (left <= 2 && t.status === "todo")) return { label: "At risk", tone: "danger" };
  return { label: "On track", tone: "ok" };
}

export type InvoiceLike = {
  status: string;
  due_on: string;
  total: number;
  amount_paid: number;
  written_off_amount: number;
};

/** What the client owes on an invoice and the status they see. Overdue is derived from the due date. */
export function invoiceView(inv: InvoiceLike, today: string): Label & { balance: number } {
  const owing = ["issued", "partly_paid", "disputed"].includes(inv.status);
  const balance = owing ? Math.max(0, round2(inv.total - inv.amount_paid - inv.written_off_amount)) : 0;
  switch (inv.status) {
    case "paid":
      return { label: "Paid", tone: "ok", balance };
    case "void":
      return { label: "Cancelled", tone: "muted", balance };
    case "refunded":
    case "partly_refunded":
      return { label: "Refunded", tone: "muted", balance };
    case "written_off":
      return { label: "Closed", tone: "muted", balance };
    case "disputed":
      return { label: "Under review", tone: "warn", balance };
  }
  if (balance === 0) return { label: "Paid", tone: "ok", balance };
  if (inv.due_on < today) return { label: "Overdue", tone: "danger", balance };
  if (inv.status === "partly_paid") return { label: "Partly paid", tone: "blue", balance };
  return { label: "Open", tone: "blue", balance };
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** "AED 14,000" or "AED 14,000.50". */
export function money(n: number, currency: string): string {
  const s = new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
  return `${currency} ${s}`;
}

/** "48 KB", "2.4 MB". */
export function fileSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Upper-case extension, e.g. "PDF"; "FILE" when there is none. */
export function fileType(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 && i < name.length - 1 ? name.slice(i + 1).toUpperCase() : "FILE";
}

/** Storage-safe object name: keeps letters, digits, dot, dash and underscore. */
export function safeName(name: string): string {
  const s = name.normalize("NFKD").replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return s.slice(-120) || "file";
}

/** Meeting link as a full URL, or null. */
export function meetHref(link: string | null | undefined): string | null {
  if (!link) return null;
  return /^https?:\/\//i.test(link) ? link : `https://${link}`;
}

/** "3 Nov" from a timestamp, in Dubai time. */
export function fmtDay(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "short" }).format(new Date(iso));
}

/** "10 Nov" from a plain date (YYYY-MM-DD), no time-zone shift. */
export function fmtDate(date: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" }).format(new Date(`${date}T00:00:00Z`));
}

/** "3 Nov, 16:20" in Dubai time. */
export function fmtDayTime(iso: string): string {
  const d = new Date(iso);
  const time = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
  return `${fmtDay(iso)}, ${time}`;
}

/** "Thu 6 Nov, 11:00" in Dubai time. */
export function fmtWhen(iso: string): string {
  const wd = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short" }).format(new Date(iso));
  return `${wd} ${fmtDayTime(iso)}`;
}

/** First name, for the greeting. */
export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** Paths a client login may open outside /portal. */
const CLIENT_OPEN = ["/api", "/auth", "/login", "/invite", "/reset", "/logout"];

/**
 * Where to send a request before it renders, or null to let it through.
 * Client logins live in /portal; "/portal" itself goes to /portal/home.
 */
export function portalRedirect(kind: "staff" | "client" | null, pathname: string): string | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/portal") return "/portal/home";
  if (kind !== "client") return null;
  if (path.startsWith("/portal/")) return null;
  if (CLIENT_OPEN.some((p) => path === p || path.startsWith(`${p}/`))) return null;
  return "/portal/home";
}

/**
 * Invoice page stats in one currency (the newest invoice's): open balance and count,
 * overdue amount and the oldest overdue invoice, and receipts this calendar year.
 */
export function invoiceTotals(
  invoices: (InvoiceLike & { number: string; currency: string })[],
  receipts: { amount: number; currency: string; receivedOn: string }[],
  today: string,
) {
  const currency = invoices[0]?.currency ?? receipts[0]?.currency ?? "AED";
  let open = 0;
  let openCount = 0;
  let overdue = 0;
  let oldest: { number: string; due_on: string } | null = null;
  for (const inv of invoices) {
    if (inv.currency !== currency) continue;
    const v = invoiceView(inv, today);
    if (v.balance <= 0) continue;
    open += v.balance;
    openCount++;
    if (v.label === "Overdue") {
      overdue += v.balance;
      if (!oldest || inv.due_on < oldest.due_on) oldest = { number: inv.number, due_on: inv.due_on };
    }
  }
  const year = today.slice(0, 4);
  const paidYear = receipts.filter((r) => r.currency === currency && r.receivedOn.startsWith(year)).reduce((a, r) => a + r.amount, 0);
  return { currency, open: round2(open), openCount, overdue: round2(overdue), oldest, paidYear: round2(paidYear) };
}

/**
 * CSS that applies a portal accent (#rgb / #rrggbb) over the theme's accent, or null for anything else.
 * `:root:root:root` outranks the light and dark theme rules in globals.css; the text tint mixes in
 * --ink so it stays readable in both themes.
 */
export function portalAccentCss(accent: string | null | undefined): string | null {
  if (!accent || !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(accent)) return null;
  return `:root:root:root{--accent:${accent};--accent-ink:color-mix(in srgb,${accent} 75%,var(--ink));--accent-soft:color-mix(in srgb,${accent} 14%,transparent);--accent-contrast:#fff}`;
}

/** Countdown text: 29:05. Never negative. */
export function mmss(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

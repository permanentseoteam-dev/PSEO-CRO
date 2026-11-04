// Pure maths and rules for payments, reminders and profitability. No I/O.
import type { Tone } from "@/components/ui";
import { addDays, daysBetween, round2 } from "../core/logic";

// ---------------------------------------------------------------- payments

export type OpenInvoice = { id: string; due: string; balance: number };
export type Allocation = { invoiceId: string; amount: number };

/** Apply an amount to open invoices, oldest due date first. Unticked invoices get nothing; what's left is credit. */
export function allocateOldestFirst(amount: number, invoices: OpenInvoice[], skip: ReadonlySet<string> = new Set()) {
  let rest = round2(Math.max(amount || 0, 0));
  const sorted = [...invoices].sort((a, b) => a.due.localeCompare(b.due) || a.id.localeCompare(b.id));
  const allocations: Allocation[] = sorted.map((i) => {
    const v = skip.has(i.id) ? 0 : round2(Math.min(rest, Math.max(i.balance, 0)));
    rest = round2(rest - v);
    return { invoiceId: i.id, amount: v };
  });
  return { allocations, credit: rest };
}

/** What's left of the amount after the allocations (negative = applied more than received). */
export const leftOver = (amount: number, allocations: Allocation[]) =>
  round2((amount || 0) - allocations.reduce((a, x) => a + (x.amount || 0), 0));

/** A problem with a set of allocations, or null when they're fine. */
export function allocationError(amount: number, allocations: Allocation[], invoices: OpenInvoice[]): string | null {
  if (!(amount > 0)) return "Enter the amount received.";
  const byId = new Map(invoices.map((i) => [i.id, i]));
  for (const a of allocations) {
    if (a.amount < 0) return "Amounts can't be negative.";
    const inv = byId.get(a.invoiceId);
    if (!inv) return "One of the invoices is no longer open.";
    if (a.amount > inv.balance + 0.001) return "An amount is more than that invoice's balance.";
  }
  if (leftOver(amount, allocations) < 0) return "You applied more than was received.";
  return null;
}

/** A payment of the same amount from the same client in the last `days` days. */
export function looksDuplicate(
  receipts: { clientId: string; amount: number; date: string; status: string }[],
  clientId: string,
  amount: number,
  date: string,
  days = 14,
) {
  if (!(amount > 0)) return false;
  return receipts.some(
    (r) => r.status !== "void" && r.clientId === clientId && round2(r.amount) === round2(amount) && Math.abs(daysBetween(r.date, date)) <= days,
  );
}

export const receiptLabel = (no: number) => `P-${no}`;

// ---------------------------------------------------------------- reminders

export type Stage = "before" | "late_1" | "late_7" | "late_14" | "late_30";
export const STAGES: Stage[] = ["before", "late_1", "late_7", "late_14", "late_30"];
/** Days from the due date. Same as public.reminder_offset(). */
export const STAGE_OFFSET: Record<Stage, number> = { before: -3, late_1: 1, late_7: 7, late_14: 14, late_30: 30 };
export const STAGE_LABEL: Record<Stage, string> = {
  before: "3 days before due",
  late_1: "1 day late",
  late_7: "7 days late",
  late_14: "14 days late",
  late_30: "30 days late",
};

/** The send date for each stage of an invoice due on `due`. */
export function stageDates(due: string): Record<Stage, string> {
  return Object.fromEntries(STAGES.map((s) => [s, addDays(due, STAGE_OFFSET[s])])) as Record<Stage, string>;
}

/** The latest stage already due on `today`, or null if none is due yet. */
export function currentStage(due: string, today: string, enabled: Stage[] = STAGES): Stage | null {
  let cur: Stage | null = null;
  for (const s of STAGES) if (enabled.includes(s) && addDays(due, STAGE_OFFSET[s]) <= today) cur = s;
  return cur;
}

export type ReminderLike = {
  invoiceId: string;
  stage: Stage;
  sendOn: string;
  status: "pending" | "sent" | "skipped";
  pausedUntil: string | null;
  sentAt: string | null;
};

const isPaused = (r: ReminderLike, today: string) => r.pausedUntil != null && r.pausedUntil >= today;

/**
 * Split reminder rows into the four lists. One row per invoice in Due today (the latest due stage), Paused and
 * Upcoming (the next stage); Recent is the last sent reminders, newest first.
 */
export function groupReminders<T extends ReminderLike>(rows: T[], today: string, recentLimit = 30) {
  const pending = new Map<string, T[]>();
  for (const r of rows) {
    if (r.status !== "pending") continue;
    const l = pending.get(r.invoiceId) ?? [];
    l.push(r);
    pending.set(r.invoiceId, l);
  }
  const dueToday: T[] = [];
  const paused: T[] = [];
  const upcoming: T[] = [];
  for (const list of pending.values()) {
    list.sort((a, b) => a.sendOn.localeCompare(b.sendOn));
    const due = list.filter((r) => r.sendOn <= today);
    const next = list.find((r) => r.sendOn > today);
    if (list.some((r) => isPaused(r, today))) {
      paused.push(due.at(-1) ?? list[0]);
      continue;
    }
    if (due.length) dueToday.push(due.at(-1)!);
    if (next) upcoming.push(next);
  }
  dueToday.sort((a, b) => STAGES.indexOf(b.stage) - STAGES.indexOf(a.stage) || a.sendOn.localeCompare(b.sendOn));
  paused.sort((a, b) => (a.pausedUntil ?? "").localeCompare(b.pausedUntil ?? ""));
  upcoming.sort((a, b) => a.sendOn.localeCompare(b.sendOn));
  const recent = rows
    .filter((r) => r.status === "sent")
    .sort((a, b) => (b.sentAt ?? b.sendOn).localeCompare(a.sentAt ?? a.sendOn))
    .slice(0, recentLimit);
  return { today: dueToday, paused, upcoming, recent };
}

/** Tone for a reminder result such as "Opened twice" or "Reply received". */
export function resultTone(result: string | null): Tone {
  const r = (result ?? "").toLowerCase();
  if (r.startsWith("reply")) return "violet";
  if (r.startsWith("opened")) return "ok";
  if (r.startsWith("delivered")) return "blue";
  if (r.startsWith("bounced")) return "danger";
  return "muted";
}

/** First name for an email greeting: "Dr. Rania Aziz" -> "Rania". */
export const firstName = (contact?: string | null) =>
  (contact ?? "").replace(/^(dr|mr|mrs|ms|prof)\.?\s+/i, "").trim().split(/\s+/)[0] || "there";

// ---------------------------------------------------------------- profitability

export type FeeBasis = "monthly" | "weekly" | "hourly" | "one_time";
export const FEE_BASIS_LABEL: Record<FeeBasis, string> = { monthly: "Monthly", weekly: "Weekly", hourly: "Hourly", one_time: "One-time" };

/** The agreed fee as a month's worth. One-time fees only count when invoiced. */
export function monthlyAgreedFee(fee: number, basis: FeeBasis, loggedHours: number) {
  if (basis === "monthly") return fee;
  if (basis === "weekly") return round2((fee * 52) / 12);
  if (basis === "hourly") return round2(fee * loggedHours);
  return 0;
}

export type ProfMember = { id: string; name: string; department: string; salary: number };
export type ProfEntry = { memberId: string; clientId: string | null; minutes: number };
export type ProfClient = {
  id: string;
  name: string;
  services: string[];
  /** Fees invoiced in the month (base currency), or null when nothing was invoiced. */
  invoiced: number | null;
  /** Agreed fee for a month (base currency), used when nothing was invoiced. */
  agreedFee: number;
  hoursBudget: number | null;
};
export type ProfInput = {
  members: ProfMember[];
  entries: ProfEntry[];
  team: { clientId: string; memberId: string }[];
  clients: ProfClient[];
  workingHours: number;
};

export type ClientProfit = {
  id: string;
  name: string;
  services: string[];
  fee: number;
  basis: "Invoiced" | "Agreed fee";
  logged: number;
  estimated: number;
  cost: number;
  margin: number;
  marginPct: number;
  hours: number;
  budget: number | null;
  people: { id: string; name: string; hours: number }[];
};
export type DeptProfit = { department: string; people: number; salaries: number; hours: number; onClients: number; toClients: number; overhead: number };

export const marginPct = (fee: number, cost: number) => (fee ? ((fee - cost) / fee) * 100 : cost > 0 ? -100 : 0);
export const marginTone = (pct: number, alert: number): Tone => (pct < 0 ? "danger" : pct < alert ? "warn" : "ok");
export const hoursTone = (hours: number, budget: number | null): Tone =>
  !budget ? "muted" : hours / budget >= 1 ? "danger" : hours / budget >= 0.8 ? "warn" : "ok";

/**
 * Cost per client for one month.
 * - Hourly cost = monthly salary ÷ working hours.
 * - Logged hours on a client's tickets cost that client (logged cost).
 * - The rest of a client-facing person's salary is split across their clients (estimated cost): by their logged
 *   hours on each client, or evenly over the client teams they're on when they logged none.
 * - People with no clients are overhead.
 */
export function computeProfitability(input: ProfInput) {
  const wh = Math.max(input.workingHours, 1);
  const clientIds = new Set(input.clients.map((c) => c.id));
  const logged = new Map<string, number>(); // client -> cost
  const est = new Map<string, number>();
  const hoursBy = new Map<string, Map<string, number>>(); // client -> member -> hours
  const deptMap = new Map<string, DeptProfit>();
  let overhead = 0;

  for (const m of input.members) {
    const hourly = m.salary / wh;
    const mine = input.entries.filter((e) => e.memberId === m.id);
    const onClient = new Map<string, number>(); // client -> hours
    let allHours = 0;
    for (const e of mine) {
      const h = e.minutes / 60;
      allHours += h;
      if (e.clientId && clientIds.has(e.clientId)) onClient.set(e.clientId, (onClient.get(e.clientId) ?? 0) + h);
    }
    let clientHours = 0;
    for (const [cid, h] of onClient) {
      clientHours += h;
      logged.set(cid, (logged.get(cid) ?? 0) + h * hourly);
      const per = hoursBy.get(cid) ?? new Map<string, number>();
      per.set(m.id, (per.get(m.id) ?? 0) + h);
      hoursBy.set(cid, per);
    }
    const loggedCost = clientHours * hourly;
    const teamClients = input.team.filter((t) => t.memberId === m.id && clientIds.has(t.clientId)).map((t) => t.clientId);
    const rest = Math.max(m.salary - loggedCost, 0);
    let toClients = loggedCost;
    if (clientHours > 0) {
      for (const [cid, h] of onClient) est.set(cid, (est.get(cid) ?? 0) + (rest * h) / clientHours);
      toClients += rest;
    } else if (teamClients.length) {
      for (const cid of teamClients) est.set(cid, (est.get(cid) ?? 0) + rest / teamClients.length);
      toClients += rest;
    } else {
      overhead += m.salary;
    }

    const d = deptMap.get(m.department) ?? { department: m.department, people: 0, salaries: 0, hours: 0, onClients: 0, toClients: 0, overhead: 0 };
    d.people += 1;
    d.salaries += m.salary;
    d.hours += allHours;
    d.onClients += clientHours; // hours for now; turned into a share below
    d.toClients += toClients;
    deptMap.set(m.department, d);
  }

  const names = new Map(input.members.map((m) => [m.id, m.name]));
  const clients: ClientProfit[] = input.clients
    .map((c) => {
      const l = round2(logged.get(c.id) ?? 0);
      const e = round2(est.get(c.id) ?? 0);
      const cost = round2(l + e);
      const fee = round2(c.invoiced ?? c.agreedFee);
      const per = hoursBy.get(c.id) ?? new Map<string, number>();
      const hours = round2([...per.values()].reduce((a, b) => a + b, 0));
      return {
        id: c.id,
        name: c.name,
        services: c.services,
        fee,
        basis: c.invoiced == null ? ("Agreed fee" as const) : ("Invoiced" as const),
        logged: l,
        estimated: e,
        cost,
        margin: round2(fee - cost),
        marginPct: marginPct(fee, cost),
        hours,
        budget: c.hoursBudget,
        people: [...per.entries()].map(([id, h]) => ({ id, name: names.get(id) ?? "Unknown", hours: round2(h) })).sort((a, b) => b.hours - a.hours),
      };
    })
    .filter((c) => c.fee > 0 || c.cost > 0);

  const depts = [...deptMap.values()]
    .map((d) => ({
      ...d,
      salaries: round2(d.salaries),
      hours: round2(d.hours),
      onClients: d.hours ? d.onClients / d.hours : 0,
      toClients: round2(d.toClients),
      overhead: round2(d.salaries - d.toClients),
    }))
    .sort((a, b) => b.salaries - a.salaries);

  const fees = round2(clients.reduce((a, c) => a + c.fee, 0));
  const cost = round2(clients.reduce((a, c) => a + c.cost, 0));
  const salaries = round2(input.members.reduce((a, m) => a + m.salary, 0));
  overhead = round2(overhead);
  return {
    clients,
    depts,
    totals: {
      fees,
      cost,
      margin: round2(fees - cost),
      marginPct: marginPct(fees, cost),
      overhead,
      salaries,
      after: round2(fees - cost - overhead),
      agreedFeeUsed: clients.some((c) => c.basis === "Agreed fee"),
    },
  };
}

/** Fees and cost by service. A client's fee and cost are split evenly over its services. */
export function byService(clients: ClientProfit[]) {
  const m = new Map<string, { service: string; clients: number; fee: number; cost: number }>();
  for (const c of clients) {
    const svcs = c.services.length ? c.services : ["Other"];
    for (const s of svcs) {
      const r = m.get(s) ?? { service: s, clients: 0, fee: 0, cost: 0 };
      r.clients += 1;
      r.fee += c.fee / svcs.length;
      r.cost += c.cost / svcs.length;
      m.set(s, r);
    }
  }
  return [...m.values()]
    .map((r) => ({ ...r, fee: round2(r.fee), cost: round2(r.cost), margin: round2(r.fee - r.cost), marginPct: marginPct(r.fee, r.cost) }))
    .sort((a, b) => b.fee - a.fee);
}

/** YYYY-MM shifted by n months. */
export function shiftMonth(ym: string, n: number) {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(5, 7)) - 1 + n;
  const d = new Date(Date.UTC(y, m, 1));
  return d.toISOString().slice(0, 7);
}

/** First and last day of a YYYY-MM month. */
export function monthRange(ym: string) {
  const from = `${ym}-01`;
  const to = addDays(`${shiftMonth(ym, 1)}-01`, -1);
  return { from, to };
}

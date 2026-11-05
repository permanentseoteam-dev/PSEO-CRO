// Pure dashboard maths: filters, KPIs, chart, aging and breakdowns, all in one target currency. No I/O.
import {
  agingBuckets,
  balance,
  convert,
  inRange,
  isOpen,
  isOverdue,
  last12Months,
  lateDays,
  periodRange,
  round2,
  settledOutside,
  type Currency,
  type Money,
  type PeriodKey,
  type Rates,
} from "./logic";
import type { Entity, InvoiceRow, PayChannel, Receipt, Refund } from "./types";

export type DashboardInput = {
  today: string;
  period: PeriodKey;
  entityId: string | null;
  currency: Currency;
  rates: Rates;
  entities: Entity[];
  channels: PayChannel[];
  invoices: InvoiceRow[];
  receipts: Receipt[];
  refunds: Refund[];
};

const money = (i: InvoiceRow): Money => ({ status: i.status, total: i.total, paid: i.amount_paid, refunded: i.amount_refunded, settled: settledOutside(i), due: i.due_on });

export function buildDashboard(d: DashboardInput) {
  const range = periodRange(d.period, d.today);
  const to = d.currency;
  const invC = (i: InvoiceRow, n: number) => convert(n, i.currency, to, d.rates, i.fx_rate_usd);
  const rcC = (r: { amount: number; currency: Currency; rate: number | null }, n = r.amount) => convert(n, r.currency, to, d.rates, r.rate);

  // Receipts carry no entity; they belong to the entity billing in that currency.
  const entityOfCurrency = (c: Currency) => d.entities.find((e) => e.currency === c)?.id ?? null;
  const invoices = d.invoices.filter((i) => i.status !== "draft" && (!d.entityId || i.entity_id === d.entityId));
  const receipts = d.receipts.filter((r) => !d.entityId || entityOfCurrency(r.currency) === d.entityId);
  const refunds = d.refunds.filter((r) => !d.entityId || entityOfCurrency(r.currency) === d.entityId);

  const counted = (i: InvoiceRow) => i.status !== "void";
  const inPeriod = invoices.filter((i) => inRange(i.issued_on, range));
  const rcInPeriod = receipts.filter((r) => inRange(r.date, range));
  const open = invoices.filter((i) => isOpen(money(i)));
  const overdue = open.filter((i) => isOverdue(money(i), d.today));
  const sum = <T>(list: T[], f: (x: T) => number) => round2(list.reduce((a, x) => a + f(x), 0));

  const stats = {
    invoiced: sum(inPeriod.filter(counted), (i) => invC(i, i.total)),
    collected: sum(rcInPeriod, (r) => rcC(r)),
    outstanding: sum(open, (i) => invC(i, balance(money(i)))),
    openCount: open.length,
    overdue: sum(overdue, (i) => invC(i, balance(money(i)))),
    overdueCount: overdue.length,
    fees: sum(rcInPeriod, (r) => rcC(r, r.fee)),
    refunded: sum(refunds.filter((r) => inRange(r.date, range)), (r) => rcC(r)),
    writtenOff: sum(inPeriod.filter((i) => i.status === "written_off"), (i) => invC(i, i.written_off_amount || i.total - i.amount_paid)),
    voided: sum(inPeriod.filter((i) => i.status === "void"), (i) => invC(i, i.total)),
  };

  const chart = last12Months(d.today).map((ym) => ({
    ym,
    invoiced: sum(invoices.filter((i) => counted(i) && i.issued_on.startsWith(ym)), (i) => invC(i, i.total)),
    collected: sum(receipts.filter((r) => r.date.startsWith(ym)), (r) => rcC(r)),
    inPeriod: inRange(`${ym}-15`, range),
  }));

  const aging = agingBuckets(open.map((i) => ({ ...money(i), row: i })), d.today, (x, b) => invC(x.row, b));

  const biggest = open
    .map((i) => {
      const bal = balance(money(i));
      return { invoice: i, balance: bal, converted: invC(i, bal), late: lateDays(money(i), d.today), overdue: isOverdue(money(i), d.today) };
    })
    .sort((a, b) => b.converted - a.converted)
    .slice(0, 5);

  const byEntity = d.entities
    .filter((e) => !d.entityId || e.id === d.entityId)
    .map((e) => ({
      entity: e,
      invoiced: sum(inPeriod.filter((i) => counted(i) && i.entity_id === e.id), (i) => invC(i, i.total)),
      collected: sum(rcInPeriod.filter((r) => entityOfCurrency(r.currency) === e.id), (r) => rcC(r)),
      open: sum(open.filter((i) => i.entity_id === e.id), (i) => invC(i, balance(money(i)))),
    }));

  const chMap = new Map<string, { name: string; count: number; collected: number; fees: number }>();
  for (const r of rcInPeriod) {
    const key = r.channelId ?? "none";
    const name = d.channels.find((c) => c.id === r.channelId)?.name ?? "Other";
    const row = chMap.get(key) ?? { name, count: 0, collected: 0, fees: 0 };
    row.count += 1;
    row.collected += rcC(r);
    row.fees += rcC(r, r.fee);
    chMap.set(key, row);
  }
  const byChannel = [...chMap.values()].sort((a, b) => b.collected - a.collected);

  return { range, stats, chart, aging, biggest, byEntity, byChannel };
}

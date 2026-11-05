import Link from "next/link";
import { requireMe, can } from "@/lib/auth/can";
import { ButtonLink, Card, CardBody, CardHead, EmptyState, NoAccess, Seg, StatCard, Stats, Table, Tabs, Td, Th } from "@/components/ui";
import {
  AGING_LABELS,
  PERIOD_LABELS,
  agingBuckets,
  convert,
  daysBetween,
  fmtDay,
  inRange,
  money,
  periodRange,
  type Currency,
  type PeriodKey,
} from "@/lib/modules/finance/core/logic";
import { getPaymentsData, openInvoicesFrom, todayIso } from "@/lib/modules/finance/ops/queries";
import { ApplyCreditSection, ClientCreditSection } from "@/features/finance-p2/sections";
import { RecordPaymentButton } from "./_components/record-payment";
import { ReceiptsTable } from "./_components/receipts-table";
import { UrlSelect } from "./_components/url-select";
import s from "./_components/ops.module.css";

export const metadata = { title: "Payments" };

const PERIODS: PeriodKey[] = ["month", "last", "quarter", "year"];
const AGING_TONES = ["t-ok", "t-warn", "t-warn", "t-danger", "t-danger"];

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireMe();
  if (me.kind !== "staff" || !can(me, "finance.payments.view", "all")) return <NoAccess />;
  const sp = await searchParams;
  const tab = sp.tab === "owed" ? "owed" : "recv";
  const period: PeriodKey = PERIODS.includes(sp.period as PeriodKey) ? (sp.period as PeriodKey) : "year";
  const canRecord = can(me, "finance.payments.record", "all");

  const today = todayIso();
  const d = await getPaymentsData();
  const usd = (n: number, cur: Currency, rate?: number | null) => convert(n, cur, "USD", d.rates, rate);
  const usd0 = (n: number) => money(n, "USD", 0);

  const href = (patch: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...sp, ...patch })) if (v) q.set(k, v);
    const qs = q.toString();
    return `/finance/payments${qs ? `?${qs}` : ""}`;
  };

  // ---------------------------------------------------------------- received
  const range = periodRange(period, today);
  const shown = d.receipts.filter(
    (r) =>
      inRange(r.date, range) &&
      (!sp.client || r.clientId === sp.client) &&
      (!sp.ch || r.channelId === sp.ch) &&
      (!sp.acc || r.account === sp.acc) &&
      (!sp.proof || (sp.proof === "yes" ? r.proofPaths.length > 0 : r.proofPaths.length === 0)),
  );
  const live = shown.filter((r) => r.status === "recorded");
  const recvU = live.reduce((a, r) => a + usd(r.amount, r.currency, r.rate), 0);
  const feeU = live.reduce((a, r) => a + usd(r.fee, r.currency, r.rate), 0);
  const missing = live.filter((r) => !r.proofPaths.length).length;
  const creditU = d.credits.reduce((a, c) => a + usd(c.amount, c.currency), 0);
  const refunds = d.refunds.filter((r) => inRange(r.date, range));
  const refU = refunds.reduce((a, r) => a + usd(r.amount, r.currency, r.rate), 0);
  const accounts = [...new Set(d.receipts.map((r) => r.account).filter(Boolean))] as string[];

  // ---------------------------------------------------------------- still owed
  const open = openInvoicesFrom(d.invoices, today);
  const owedU = open.reduce((a, i) => a + usd(i.balance, i.currency, i.rate), 0);
  const overdue = open.filter((i) => i.overdue);
  const overU = overdue.reduce((a, i) => a + usd(i.balance, i.currency, i.rate), 0);
  const aging = agingBuckets(
    open.map((i) => ({ status: "issued" as const, total: i.balance, paid: 0, due: i.due, cur: i.currency, rate: i.rate })),
    today,
    (i, b) => usd(b, i.cur, i.rate),
  );
  const agingMax = Math.max(1, ...aging);
  const byClient = new Map<string, typeof open>();
  for (const i of open) {
    const key = `${i.clientId}|${i.currency}`;
    byClient.set(key, [...(byClient.get(key) ?? []), i]);
  }
  const owing = new Set(open.map((i) => i.clientId));

  const recordProps = {
    clients: d.clients,
    channels: d.channels,
    openInvoices: open,
    recent: d.receipts.map((r) => ({ clientId: r.clientId, amount: r.amount, date: r.date, status: r.status })),
    rates: d.rates,
    today,
  };

  return (
    <div className="page">
      <div className="row between">
        <h1>Payments</h1>
        <div className="row">
          <ApplyCreditSection />
          {canRecord ? <RecordPaymentButton {...recordProps} /> : null}
        </div>
      </div>

      <Tabs
        label="Payments"
        value={tab}
        items={[
          { value: "recv", label: "Received", href: href({ tab: undefined }) },
          { value: "owed", label: "Still owed", href: href({ tab: "owed" }) },
        ]}
      />

      {tab === "recv" ? (
        <>
          <div className="toolbar">
            <Seg label="Period" value={period} items={PERIODS.map((k) => ({ value: k, label: PERIOD_LABELS[k], href: href({ period: k }) }))} />
            <UrlSelect param="client" label="Client" value={sp.client ?? ""} allLabel="All clients" options={d.clients.map((c) => ({ value: c.id, label: c.name }))} />
            <UrlSelect param="ch" label="Channel" value={sp.ch ?? ""} allLabel="All channels" options={d.channels.map((c) => ({ value: c.id, label: c.name }))} />
            <UrlSelect param="acc" label="Account" value={sp.acc ?? ""} allLabel="All accounts" options={accounts.map((a) => ({ value: a, label: a }))} />
            <UrlSelect
              param="proof"
              label="Proof"
              value={sp.proof ?? ""}
              allLabel="Any proof"
              options={[
                { value: "yes", label: "Proof attached" },
                { value: "no", label: "Missing proof" },
              ]}
            />
          </div>

          <Stats>
            <StatCard label="Received" value={usd0(recvU)} sub={`${live.length} ${live.length === 1 ? "payment" : "payments"}`} />
            <StatCard label="Fees" value={usd0(feeU)} sub="Taken by channels" />
            <StatCard label="Credit" value={usd0(creditU)} sub={`${new Set(d.credits.map((c) => c.clientId)).size} clients hold credit`} />
            <StatCard label="Refunded" value={usd0(refU)} sub={`${refunds.length} ${refunds.length === 1 ? "refund" : "refunds"}`} />
            <StatCard label="Missing proof" value={missing} tone={missing ? "warn" : undefined} sub="Add a file or a reason" />
          </Stats>

          <Card>
            {shown.length ? (
              <ReceiptsTable rows={shown} canRecord={canRecord} />
            ) : (
              <EmptyState title={d.receipts.length ? "No payments match these filters." : "No payments recorded yet."} />
            )}
          </Card>

          <Card>
            <CardHead title="Refunds" />
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Client</Th>
                  <Th>Invoice</Th>
                  <Th right>Amount</Th>
                  <Th>Reason</Th>
                </tr>
              </thead>
              <tbody>
                {refunds.length ? (
                  refunds.map((r, k) => (
                    <tr key={`${r.invoiceId}-${k}`}>
                      <Td num>{fmtDay(r.date)}</Td>
                      <Td>{r.clientName}</Td>
                      <Td num>
                        {r.invoiceId ? <Link href={`/finance/invoices/${r.invoiceId}`}>{r.number}</Link> : r.number}
                      </Td>
                      <Td right num>
                        {money(r.amount, r.currency)}
                      </Td>
                      <Td>{r.reason}</Td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <Td colSpan={5} className="muted">
                      No refunds in {PERIOD_LABELS[period].toLowerCase()}.
                    </Td>
                  </tr>
                )}
              </tbody>
            </Table>
          </Card>
        </>
      ) : (
        <>
          <Stats>
            <StatCard label="Owed" value={usd0(owedU)} sub={`${open.length} open ${open.length === 1 ? "invoice" : "invoices"}`} />
            <StatCard label="Overdue" value={usd0(overU)} tone={overU ? "danger" : undefined} sub={`${overdue.length} ${overdue.length === 1 ? "invoice" : "invoices"}`} />
            <StatCard label="Credit" value={usd0(creditU)} sub="Can be applied to open invoices" />
            <StatCard label="Clients owing" value={owing.size} sub={`of ${d.clients.length} clients`} />
          </Stats>

          <div className={s.owed}>
            <Card>
              <CardHead title="Aging, USD" />
              <CardBody>
                <div className="stack">
                  {AGING_LABELS.map((label, k) => (
                    <div key={label} className={s.aging}>
                      <span>{label}</span>
                      <div className={`bar ${AGING_TONES[k]}`}>
                        <i style={{ width: `${Math.max(2, Math.round((aging[k] / agingMax) * 100))}%` }} />
                      </div>
                      <span className="num right">{usd0(aging[k])}</span>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardHead title="By client" />
              {byClient.size ? (
                <Table>
                  <thead>
                    <tr>
                      <Th>Client</Th>
                      <Th right>Open</Th>
                      <Th right>Balance</Th>
                      <Th right>Overdue</Th>
                      <Th>Oldest due</Th>
                      <Th right>Credit</Th>
                      <Th aria-label="Actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {[...byClient.values()].map((list) => {
                      const first = list[0];
                      const bal = list.reduce((a, i) => a + i.balance, 0);
                      const od = list.filter((i) => i.overdue).reduce((a, i) => a + i.balance, 0);
                      const credit = d.credits.find((c) => c.clientId === first.clientId && c.currency === first.currency);
                      const late = daysBetween(first.due, today);
                      return (
                        <tr key={`${first.clientId}|${first.currency}`}>
                          <Td>{first.clientName}</Td>
                          <Td right num>
                            {list.length}
                          </Td>
                          <Td right num>
                            {money(bal, first.currency)}
                          </Td>
                          <Td right num>
                            {od ? <span className="t-danger">{money(od, first.currency)}</span> : "—"}
                          </Td>
                          <Td num>
                            {fmtDay(first.due)}
                            {first.overdue ? <span className="small t-danger"> {late} days late</span> : null}
                          </Td>
                          <Td right num>
                            {credit ? money(credit.amount, credit.currency) : "—"}
                          </Td>
                          <Td right>
                            <ButtonLink href={`/finance/invoices?client=${first.clientId}`} variant="ghost" size="sm">
                              Invoices
                            </ButtonLink>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              ) : (
                <CardBody>
                  <span className="muted">Nothing is owed right now.</span>
                </CardBody>
              )}
            </Card>
          </div>

          <ClientCreditSection />
        </>
      )}
    </div>
  );
}

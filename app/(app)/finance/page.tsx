import Link from "next/link";
import { requireMe, can } from "@/lib/auth/can";
import { ButtonLink, Card, CardBody, CardHead, NoAccess, Seg, StatCard, Stats, Table, Td, Th } from "@/components/ui";
import { buildDashboard } from "@/lib/modules/finance/core/dashboard";
import { AGING_LABELS, CURRENCIES, PERIOD_LABELS, fmtDay, invoiceLabel, money, type Currency, type PeriodKey } from "@/lib/modules/finance/core/logic";
import { getDashboardData, getRefData } from "@/lib/modules/finance/core/queries";
import { EntityFilter } from "./_core/entity-filter";
import { MonthChart } from "./_core/month-chart";
import s from "./_core/finance.module.css";

export const metadata = { title: "Finance" };

const AGING_TONES = ["t-ok", "t-warn", "t-warn", "t-danger", "t-danger"];

export default async function FinancePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireMe();
  if (me.kind !== "staff" || !can(me, "finance.dashboard.view")) return <NoAccess />;

  const sp = await searchParams;
  const period: PeriodKey = sp.period && sp.period in PERIOD_LABELS ? (sp.period as PeriodKey) : "month";
  const currency: Currency = CURRENCIES.includes(sp.cur as Currency) ? (sp.cur as Currency) : "USD";
  const [ref, data] = await Promise.all([getRefData(), getDashboardData()]);
  const entityId = ref.entities.some((e) => e.id === sp.entity) ? sp.entity! : null;

  const d = buildDashboard({ ...data, ...ref, period, entityId, currency });
  const c = (n: number) => money(n, currency, 0);
  const periodLabel = PERIOD_LABELS[period];
  const href = (patch: Record<string, string>) => {
    const q = new URLSearchParams({ period, cur: currency, ...(entityId ? { entity: entityId } : {}), ...patch });
    return `/finance?${q.toString()}`;
  };
  const agingMax = Math.max(1, ...d.aging);
  const st = d.stats;

  return (
    <div className="page">
      <div className="row between">
        <h1>Finance</h1>
        <div className="row">
          {can(me, "finance.settings.manage") ? <ButtonLink href="/finance/settings">Finance settings</ButtonLink> : null}
          {can(me, "finance.invoices.create", "all") ? (
            <ButtonLink href="/finance/invoices/new" variant="primary">
              New invoice
            </ButtonLink>
          ) : null}
        </div>
      </div>

      <div className="toolbar row">
        <Seg label="Period" value={period} items={(Object.keys(PERIOD_LABELS) as PeriodKey[]).map((k) => ({ value: k, label: PERIOD_LABELS[k], href: href({ period: k }) }))} />
        <EntityFilter entities={ref.entities} value={entityId ?? ""} />
        <Seg label="Currency" value={currency} items={CURRENCIES.map((cu) => ({ value: cu, label: cu, href: href({ cur: cu }) }))} />
      </div>

      {data.remindersToday && data.remindersToday.total > 0 ? (
        <div className={s.banner}>
          <div>
            <strong>
              {data.remindersToday.total} payment {data.remindersToday.total === 1 ? "reminder" : "reminders"} to send today.
            </strong>{" "}
            <span className="muted">{data.remindersToday.auto} go out on auto at 10:00.</span>
          </div>
          <ButtonLink href="/finance/reminders" variant="primary" size="sm">
            Review reminders
          </ButtonLink>
        </div>
      ) : null}

      <Stats>
        <StatCard label="Invoiced" value={<span className="num">{c(st.invoiced)}</span>} sub={periodLabel} />
        <StatCard
          label="Collected"
          value={<span className="num">{c(st.collected)}</span>}
          sub={`${st.invoiced ? Math.round((st.collected / st.invoiced) * 100) : 0}% of invoiced`}
        />
        <StatCard label="Outstanding" value={<span className="num">{c(st.outstanding)}</span>} sub={`${st.openCount} open ${st.openCount === 1 ? "invoice" : "invoices"}`} />
        <StatCard
          label="Overdue"
          value={<span className="num">{c(st.overdue)}</span>}
          tone={st.overdue > 0 ? "danger" : undefined}
          sub={`${st.overdueCount} ${st.overdueCount === 1 ? "invoice" : "invoices"} past due`}
        />
      </Stats>
      <Stats className={s.smallStats}>
        <StatCard label="Fees lost" value={<span className="num">{c(st.fees)}</span>} sub="Channel fees" />
        <StatCard label="Refunded" value={<span className="num">{c(st.refunded)}</span>} />
        <StatCard label="Written off" value={<span className="num">{c(st.writtenOff)}</span>} />
        <StatCard label="Voided" value={<span className="num">{c(st.voided)}</span>} />
      </Stats>

      <div className={s.wide}>
        <Card>
          <CardHead
            title="Invoiced vs collected, 12 months"
            actions={
              <div className={s.legend}>
                <span>
                  <i style={{ background: "var(--accent)" }} />
                  Invoiced
                </span>
                <span>
                  <i style={{ background: "var(--blue)" }} />
                  Collected
                </span>
              </div>
            }
          />
          <CardBody>
            <MonthChart months={d.chart} currency={currency} />
            <div className="small muted">
              In {currency}. Converted with the rate saved on each invoice and payment. Faded months are outside {periodLabel.toLowerCase()}.
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHead
            title="Aging"
            actions={
              <ButtonLink href="/finance/payments?tab=owed" variant="ghost" size="sm">
                Still owed
              </ButtonLink>
            }
          />
          <CardBody>
            <div className="stack">
              {d.aging.map((v, k) => (
                <div key={k} className={s.aging}>
                  <span>{AGING_LABELS[k]}</span>
                  <div className={`bar ${AGING_TONES[k]}`}>
                    <i style={{ width: `${Math.max(2, Math.round((v / agingMax) * 100))}%` }} />
                  </div>
                  <span className="num right">{c(v)}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid-3">
        <Card>
          <CardHead
            title="Biggest open balances"
            actions={
              <ButtonLink href="/finance/invoices" variant="ghost" size="sm">
                All invoices
              </ButtonLink>
            }
          />
          <Table>
            <thead>
              <tr>
                <Th>Client</Th>
                <Th>Invoice</Th>
                <Th right>Balance</Th>
              </tr>
            </thead>
            <tbody>
              {d.biggest.length ? (
                d.biggest.map((b) => (
                  <tr key={b.invoice.id}>
                    <Td>
                      {b.invoice.client_name}
                      <div className="small muted">
                        {b.overdue ? (
                          <span className={s.late}>{b.late} days late</span>
                        ) : b.invoice.status === "disputed" ? (
                          "Disputed"
                        ) : (
                          `Due ${fmtDay(b.invoice.due_on)}`
                        )}
                      </div>
                    </Td>
                    <Td num>
                      <Link href={`/finance/invoices/${b.invoice.id}`}>{invoiceLabel(b.invoice)}</Link>
                    </Td>
                    <Td num right>
                      {money(b.balance, b.invoice.currency, 0)}
                      {b.invoice.currency !== currency ? <div className="small muted">{c(b.converted)}</div> : null}
                    </Td>
                  </tr>
                ))
              ) : (
                <tr>
                  <Td colSpan={3} className="muted">
                    Nothing open.
                  </Td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card>
        <Card>
          <CardHead title="By entity" />
          <Table>
            <thead>
              <tr>
                <Th>Entity</Th>
                <Th right>Invoiced</Th>
                <Th right>Collected</Th>
                <Th right>Open</Th>
              </tr>
            </thead>
            <tbody>
              {d.byEntity.length ? (
                d.byEntity.map((r) => (
                  <tr key={r.entity.id}>
                    <Td>{r.entity.short_name}</Td>
                    <Td num right>
                      {c(r.invoiced)}
                    </Td>
                    <Td num right>
                      {c(r.collected)}
                    </Td>
                    <Td num right>
                      {c(r.open)}
                    </Td>
                  </tr>
                ))
              ) : (
                <tr>
                  <Td colSpan={4} className="muted">
                    No entities yet.
                  </Td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card>
        <Card>
          <CardHead title="Collected by channel" />
          <Table>
            <thead>
              <tr>
                <Th>Channel</Th>
                <Th right>Payments</Th>
                <Th right>Collected</Th>
                <Th right>Fees</Th>
              </tr>
            </thead>
            <tbody>
              {d.byChannel.length ? (
                d.byChannel.map((r) => (
                  <tr key={r.name}>
                    <Td>{r.name}</Td>
                    <Td num right>
                      {r.count}
                    </Td>
                    <Td num right>
                      {c(r.collected)}
                    </Td>
                    <Td num right>
                      {c(r.fees)}
                    </Td>
                  </tr>
                ))
              ) : (
                <tr>
                  <Td colSpan={4} className="muted">
                    No payments in {periodLabel.toLowerCase()}.
                  </Td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
}

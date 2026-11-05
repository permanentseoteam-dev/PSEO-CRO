import { can } from "@/lib/auth/can";
import { Card, CardBody, CardHead, EmptyState, NoAccess, StatCard, Stats } from "@/components/ui";
import { listInvoices, portalContext } from "@/lib/modules/portal/queries";
import { getPortalInvoiceExtras } from "@/features/finance-p2/queries";
import type { InvoiceStatus } from "@/features/finance-p2/types";
import { dubaiToday, fmtDate, invoiceTotals, money } from "@/lib/modules/portal/logic";
import { NoClient, PageHead } from "../../_components/page-head";
import { InvoiceTable } from "./_components/invoice-table";

export const metadata = { title: "Invoices" };

export default async function PortalInvoices() {
  const { me, client } = await portalContext();
  if (!can(me, "finance.invoices.view")) return <NoAccess />;
  if (!client) return <NoClient />;

  const today = dubaiToday(new Date());
  const { invoices: all, channels, receipts } = await listInvoices(client.id);
  // Drops drafts, voids and invoices hidden from the portal; adds links to original documents of past invoices.
  const { visibleIds, docs } = await getPortalInvoiceExtras(all.map((i) => ({ id: i.id, status: i.status as InvoiceStatus })));
  const invoices = all.filter((i) => visibleIds.includes(i.id));
  const t = invoiceTotals(
    invoices.map((i) => ({ number: i.number, status: i.status, due_on: i.dueOn, total: i.total, amount_paid: i.amountPaid, written_off_amount: i.writtenOff, currency: i.currency })),
    receipts,
    today,
  );

  return (
    <div className="page">
      <PageHead title="Invoices" sub="Your invoices, payments and receipts." />
      <Stats className="grid-3">
        <StatCard label="Open balance" value={money(t.open, t.currency)} sub={`${t.openCount} ${t.openCount === 1 ? "invoice" : "invoices"}`} />
        <StatCard
          label="Overdue"
          value={money(t.overdue, t.currency)}
          tone={t.overdue > 0 ? "danger" : undefined}
          sub={t.oldest ? `${t.oldest.number}, due ${fmtDate(t.oldest.due_on)}` : "Nothing overdue"}
        />
        <StatCard label="Paid this year" value={money(t.paidYear, t.currency)} sub={`Since 1 Jan ${today.slice(0, 4)}`} />
      </Stats>

      <Card>
        <CardHead title="All invoices" />
        {invoices.length ? (
          <InvoiceTable invoices={invoices} channels={channels} today={today} clientName={client.name} docs={Object.fromEntries(docs)} />
        ) : (
          <EmptyState title="No invoices yet">Invoices we send you show here.</EmptyState>
        )}
      </Card>

      <Card>
        <CardHead title="Receipts" />
        <CardBody>
          {receipts.length ? (
            <div className="list">
              {receipts.map((r) => (
                <div key={r.id} className="item row between">
                  <div>
                    <b>
                      Receipt P-{r.no}
                      {r.invoiceNumbers.length ? ` for ${r.invoiceNumbers.join(", ")}` : ""}
                    </b>
                    <div className="muted small">
                      Paid {fmtDate(r.receivedOn)} · {money(r.amount, r.currency)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted" style={{ margin: 0 }}>No payments recorded yet.</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

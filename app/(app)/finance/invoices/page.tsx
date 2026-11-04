import { requireMe, can } from "@/lib/auth/can";
import { Button, ButtonLink, EmptyState, NoAccess, PhaseTwo, Tabs } from "@/components/ui";
import { displayStatus, fmtDay, invoiceLabel, balance, statusKeys } from "@/lib/modules/finance/core/logic";
import { getRefData, listInvoices, todayIso } from "@/lib/modules/finance/core/queries";
import { InvoiceList, type ListRow } from "./_components/invoice-list";

export const metadata = { title: "Invoices" };

const PHASE_TWO: Record<string, string> = {
  drafts: "Monthly drafts",
  upwork: "Upwork earnings",
  exports: "Exports",
};

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireMe();
  if (me.kind !== "staff" || !can(me, "finance.invoices.view")) return <NoAccess />;
  const sp = await searchParams;
  const tab = sp.tab && sp.tab in PHASE_TWO ? sp.tab : "all";

  const today = todayIso();
  const [ref, invoices] = await Promise.all([getRefData(), listInvoices()]);
  const entityShort = new Map(ref.entities.map((e) => [e.id, e.short_name]));

  const rows: ListRow[] = invoices.map((i) => {
    const m = { status: i.status, total: i.total, paid: i.amount_paid, due: i.due_on };
    const st = displayStatus(m, today);
    return {
      id: i.id,
      label: invoiceLabel(i),
      title: i.title,
      client: i.client_name,
      clientId: i.client_id,
      entityId: i.entity_id,
      entity: entityShort.get(i.entity_id) ?? "",
      issued: fmtDay(i.issued_on),
      due: fmtDay(i.due_on),
      currency: i.currency,
      total: i.total,
      balance: balance(m),
      status: { label: st.label, tone: st.tone, sub: "sub" in st ? st.sub : undefined },
      keys: statusKeys(m, today),
    };
  });

  return (
    <div className="page">
      <div className="row between">
        <h1>Invoices</h1>
        <div className="row">
          <Button disabled title="Coming in phase 2">
            Record past invoice <PhaseTwo />
          </Button>
          {can(me, "finance.invoices.create", "all") ? (
            <ButtonLink href="/finance/invoices/new" variant="primary">
              New invoice
            </ButtonLink>
          ) : null}
        </div>
      </div>

      <Tabs
        label="Invoice views"
        value={tab}
        items={[
          { value: "all", label: "All invoices", href: "/finance/invoices" },
          ...Object.entries(PHASE_TWO).map(([value, label]) => ({
            value,
            label: (
              <>
                {label} <PhaseTwo />
              </>
            ),
            href: `/finance/invoices?tab=${value}`,
          })),
        ]}
      />

      {tab === "all" ? (
        <InvoiceList rows={rows} entities={ref.entities.map((e) => ({ id: e.id, name: e.name }))} clients={ref.clients.map((c) => ({ id: c.id, name: c.name }))} />
      ) : (
        <EmptyState title={`${PHASE_TWO[tab]} arrive in phase 2.`} />
      )}
    </div>
  );
}

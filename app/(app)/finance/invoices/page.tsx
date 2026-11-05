import { requireMe, can } from "@/lib/auth/can";
import { ButtonLink, NoAccess, Tabs } from "@/components/ui";
import { ExportsSection, MonthlyDraftsSection, RecordPastInvoiceSection, UpworkSection } from "@/features/finance-p2/sections";
import { displayStatus, fmtDay, invoiceLabel, balance, settledOutside, statusKeys } from "@/lib/modules/finance/core/logic";
import { getRefData, listInvoices, todayIso } from "@/lib/modules/finance/core/queries";
import { InvoiceList, type ListRow } from "./_components/invoice-list";

export const metadata = { title: "Invoices" };

const VIEWS: Record<string, string> = {
  drafts: "Monthly drafts",
  upwork: "Upwork earnings",
  exports: "Exports",
};

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireMe();
  if (me.kind !== "staff" || !can(me, "finance.invoices.view")) return <NoAccess />;
  const sp = await searchParams;
  const tab = sp.tab && sp.tab in VIEWS ? sp.tab : "all";

  const today = todayIso();
  const [ref, invoices] = await Promise.all([getRefData(), listInvoices()]);
  const entityShort = new Map(ref.entities.map((e) => [e.id, e.short_name]));

  const rows: ListRow[] = invoices.map((i) => {
    const m = { status: i.status, total: i.total, paid: i.amount_paid, settled: settledOutside(i), due: i.due_on };
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
      past: i.is_past === true,
      status: { label: st.label, tone: st.tone, sub: "sub" in st ? st.sub : undefined },
      keys: statusKeys(m, today),
    };
  });

  return (
    <div className="page">
      <div className="row between">
        <h1>Invoices</h1>
        <div className="row">
          <RecordPastInvoiceSection />
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
          ...Object.entries(VIEWS).map(([value, label]) => ({ value, label, href: `/finance/invoices?tab=${value}` })),
        ]}
      />

      {tab === "all" ? (
        <InvoiceList rows={rows} entities={ref.entities.map((e) => ({ id: e.id, name: e.name }))} clients={ref.clients.map((c) => ({ id: c.id, name: c.name }))} />
      ) : tab === "drafts" ? (
        <MonthlyDraftsSection />
      ) : tab === "upwork" ? (
        <UpworkSection />
      ) : (
        <ExportsSection />
      )}
    </div>
  );
}

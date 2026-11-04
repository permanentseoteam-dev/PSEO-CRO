import Link from "next/link";
import { requireMe, can } from "@/lib/auth/can";
import { NoAccess } from "@/components/ui";
import { addDays } from "@/lib/modules/finance/core/logic";
import { getBillingDefaults, getRefData, todayIso } from "@/lib/modules/finance/core/queries";
import type { BillTo } from "@/lib/modules/finance/core/types";
import { InvoiceEditor } from "../_components/invoice-editor";
import s from "../../_core/finance.module.css";

export const metadata = { title: "New invoice" };

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireMe();
  if (me.kind !== "staff" || !can(me, "finance.invoices.create", "all")) return <NoAccess />;
  const sp = await searchParams;
  const ref = await getRefData();
  const today = todayIso();

  const client = ref.clients.find((c) => c.id === sp.client) ?? null;
  const defaults: { billTo: BillTo; entityId?: string; channelId?: string; termsDays?: number } = client ? await getBillingDefaults(client.id) : { billTo: {} };
  const entity =
    ref.entities.find((e) => e.id === defaults.entityId) ?? (client ? ref.entities.find((e) => e.currency === client.currency) : undefined) ?? ref.entities[0];
  const terms = defaults.termsDays ?? 14;

  return (
    <div className="page">
      <div className="stack" style={{ gap: 4 }}>
        <Link className="small" href="/finance/invoices">
          ← Invoices
        </Link>
        <h1>New invoice</h1>
      </div>
      <div className={s.note}>This is a draft. It gets its number when you issue it.</div>
      <InvoiceEditor
        initial={{
          label: "Draft",
          client_id: client?.id ?? "",
          entity_id: entity?.id ?? "",
          currency: client?.currency ?? entity?.currency ?? "AED",
          issued_on: today,
          due_on: addDays(today, terms),
          po_ref: "",
          title: "",
          discount: 0,
          channel_id: defaults.channelId ?? "",
          pay_link: "",
          notes: "Thank you for your business. Please quote the invoice number with your transfer.",
          terms: `Payment due within ${terms} days. Late balances get reminders at 1, 7, 14 and 30 days.`,
          lines: [{ description: "", detail: "", qty: 1, rate: 0, tax_pct: entity?.tax_rate ?? 0 }],
        }}
        issued={false}
        readOnly={false}
        paid={0}
        billTo={defaults.billTo.name ? defaults.billTo : { name: client?.name }}
        entities={ref.entities}
        channels={ref.channels}
        clients={ref.clients}
      />
    </div>
  );
}

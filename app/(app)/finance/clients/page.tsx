import { requireMe, can } from "@/lib/auth/can";
import { NoAccess } from "@/components/ui";
import { getBillingRows } from "@/lib/modules/finance/ops/queries";
import { BillingTable } from "./_components/billing-table";

export const metadata = { title: "Billing clients" };

export default async function BillingClientsPage() {
  const me = await requireMe();
  if (me.kind !== "staff" || !can(me, "clients.billing.view")) return <NoAccess />;
  const { rows, entities, channels } = await getBillingRows();
  return (
    <div className="page">
      <BillingTable rows={rows} entities={entities} channels={channels} canEdit={can(me, "clients.billing.edit", "all")} />
    </div>
  );
}

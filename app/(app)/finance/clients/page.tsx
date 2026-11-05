import { requireMe, can } from "@/lib/auth/can";
import { NoAccess } from "@/components/ui";
import { getBillingRows } from "@/lib/modules/finance/ops/queries";
import { getSubAccountCounts } from "@/features/finance-p2/queries";
import { subAccountsSlots } from "@/features/finance-p2/sections";
import { BillingTable } from "./_components/billing-table";

export const metadata = { title: "Billing clients" };

export default async function BillingClientsPage() {
  const me = await requireMe();
  if (me.kind !== "staff" || !can(me, "clients.billing.view")) return <NoAccess />;
  const canEdit = can(me, "clients.billing.edit", "all");
  const { rows, entities, channels } = await getBillingRows();
  const [subCounts, subSlots] = await Promise.all([getSubAccountCounts(), canEdit ? subAccountsSlots(rows.map((r) => r.clientId)) : {}]);
  return (
    <div className="page">
      <BillingTable rows={rows} entities={entities} channels={channels} canEdit={canEdit} subCounts={subCounts} subAccountsSlots={subSlots} />
    </div>
  );
}

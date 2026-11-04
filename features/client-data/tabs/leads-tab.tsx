import { NoAccess, StatCard, Stats } from "@/components/ui";
import { formatMoney, formatNumber, formatPct, leadStats } from "../logic";
import { getClientBasics, listLeads } from "../queries";
import { LeadsTable } from "../components/leads-table";
import { dataAccess, today } from "./access";

/** Client page tab "Leads": website and ads leads with outcomes. */
export async function LeadsTab({ clientId }: { clientId: string }) {
  const { view, manage } = await dataAccess();
  if (!view) return <NoAccess />;

  const [client, leads] = await Promise.all([getClientBasics(clientId), listLeads(clientId)]);
  const s = leadStats(leads, today().now);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <Stats>
        <StatCard label="Leads, 28 days" value={formatNumber(s.total)} />
        <StatCard label="Contacted within 1 hour" value={s.contactedFastPct == null ? "None" : formatPct(s.contactedFastPct)} />
        <StatCard label="Appointments booked" value={formatNumber(s.booked)} />
        <StatCard label="Won" value={formatNumber(s.won)} sub={s.wonValue ? `${formatMoney(s.wonValue, s.wonCurrency)} in sales` : undefined} tone={s.won ? "ok" : undefined} />
      </Stats>
      <LeadsTable clientId={clientId} clientName={client?.name ?? "client"} leads={leads} canManage={manage} />
    </div>
  );
}

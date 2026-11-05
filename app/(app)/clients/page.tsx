import { requireMe, can } from "@/lib/auth/can";
import { Avatar, Card, CardHead, NoAccess, StatCard, Stats, Table, Td, Th } from "@/components/ui";
import { EndedClientsCard } from "@/features/client-admin/sections";
import { StatusReviewButton } from "@/features/client-success/components/status-review";
import { byOwner, fmtMeeting, money } from "@/lib/modules/clients/logic";
import { getPortfolio } from "@/lib/modules/clients/queries";
import { ClientFormButton } from "./_components/client-form";
import { PortfolioGrid } from "./_components/portfolio-grid";

export const metadata = { title: "Client portfolio" };

export default async function ClientsPage() {
  const me = await requireMe();
  if (me.kind !== "staff" || !can(me, "clients.view")) return <NoAccess />;
  const now = new Date();
  const { data, people } = await getPortfolio(now);
  const { stats } = data;
  const owners = byOwner(data.byOwner);
  const canManage = can(me, "clients.manage");
  const showFee = can(me, "clients.billing.view") && (can(me, "clients.billing.edit") || canManage);

  return (
    <div className="page">
      <div className="between">
        <h1>Client portfolio</h1>
        {canManage ? (
          <div className="row">
            <StatusReviewButton clients={data.cards.filter((c) => c.status !== "paused").map((c) => ({ id: c.id, name: c.name, band: c.band }))} />
            <ClientFormButton people={people} showFee={showFee} label="Add client" variant="primary" />
          </div>
        ) : null}
      </div>

      <Stats>
        <StatCard label="Clients" value={stats.total} sub={`${stats.active} active, ${stats.paused} paused`} />
        <StatCard label="At risk" value={stats.atRisk.length} sub={stats.atRisk.join(", ") || "None"} tone={stats.atRisk.length ? "danger" : undefined} />
        <StatCard
          label="Open escalations"
          value={stats.openEscalations}
          sub={stats.pastWindow ? `${stats.pastWindow} past ${stats.pastWindow === 1 ? "its" : "their"} window` : "All within window"}
          tone={stats.openEscalations ? "warn" : undefined}
        />
        <StatCard label="Last month's reports not sent" value={stats.reportsSeen ? stats.reportsNotSent : "–"} sub={stats.reportsSeen ? "Due 5th" : "No report tickets this month"} />
        <StatCard
          label="Meetings this week"
          value={stats.meetingsThisWeek}
          sub={stats.nextMeeting ? `Next: ${stats.nextMeeting.client}, ${fmtMeeting(stats.nextMeeting.at).split(",")[0]}` : "None booked"}
        />
      </Stats>

      <PortfolioGrid cards={data.cards} owners={data.owners} reportMonth={data.reportMonth} />

      <div className="grid-2">
        <Card>
          <CardHead title="By owner" />
          <Table>
            <thead>
              <tr>
                <Th>Owner</Th>
                <Th num>Clients</Th>
                <Th num>Healthy</Th>
                <Th num>Watch</Th>
                <Th num>At risk</Th>
                <Th num hideSm>New or no data</Th>
                <Th num>Open escalations</Th>
                {data.feesVisible ? <Th>Monthly fees</Th> : null}
              </tr>
            </thead>
            <tbody>
              {owners.map((o) => (
                <tr key={o.owner}>
                  <Td>
                    <div className="row" style={{ gap: 8 }}>
                      <Avatar name={o.owner} size={24} />
                      {o.owner}
                    </div>
                  </Td>
                  <Td num>{o.clients}</Td>
                  <Td num>{o.healthy}</Td>
                  <Td num>{o.watch}</Td>
                  <Td num>{o.atRisk}</Td>
                  <Td num hideSm>{o.newOrNoData}</Td>
                  <Td num>{o.escalations}</Td>
                  {data.feesVisible ? (
                    <Td num className="small">
                      {o.fees.map((f) => (
                        <div key={f.currency}>{money(f.amount, f.currency)}</div>
                      ))}
                    </Td>
                  ) : null}
                </tr>
              ))}
              {!owners.length ? (
                <tr>
                  <Td colSpan={8} className="muted">
                    No clients yet.
                  </Td>
                </tr>
              ) : null}
            </tbody>
          </Table>
        </Card>
        <EndedClientsCard />
      </div>
    </div>
  );
}

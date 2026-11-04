import { Card, CardHead, EmptyState, NoAccess, StatCard, Stats, StatusDot, Table, Td, Th } from "@/components/ui";
import { adTotals, budgetPacing, CAMPAIGN_STATUS, costPerLead, formatMoney, formatNumber, formatPct, monthStart, SOURCE_LABEL } from "../logic";
import { getAdBudget, listCampaigns } from "../queries";
import { BudgetEditor } from "../components/budget-editor";
import { dataAccess, today } from "./access";

/** Client page tab "Ads" (show when the client has PPC): month spend, pacing and campaigns. */
export async function AdsTab({ clientId }: { clientId: string }) {
  const { view, manage } = await dataAccess();
  if (!view) return <NoAccess />;

  const { today: day } = today();
  const month = monthStart(day);
  const [campaigns, budget] = await Promise.all([listCampaigns(clientId), getAdBudget(clientId, month)]);
  const totals = adTotals(campaigns);
  const currency = budget?.currency ?? campaigns[0]?.currency ?? null;
  const pacing = budget ? budgetPacing(totals.spendMtd, budget.amount, day) : null;
  const paceText = pacing
    ? `${pacing.dayOfMonth} of ${pacing.daysInMonth} days gone, ${pacing.pace === "on" ? "on pace" : pacing.pace === "ahead" ? "spending ahead" : "spending behind"}`
    : "No budget set";

  return (
    <div className="stack" style={{ gap: 16 }}>
      <Stats>
        <StatCard
          label="Spend this month"
          value={formatMoney(totals.spendMtd, currency)}
          sub={budget ? `of ${formatMoney(budget.amount, budget.currency)} budget` : undefined}
        />
        <StatCard label="Leads this month" value={formatNumber(totals.leadsMtd)} />
        <StatCard label="Cost per lead" value={totals.cplMtd == null ? "None" : formatMoney(totals.cplMtd, currency)} />
        <div className="stat">
          <span className="label">Budget pacing</span>
          <span className={pacing && pacing.pace !== "on" ? "value t-warn" : "value"}>{pacing ? formatPct(pacing.spentPct) : "None"}</span>
          <div className="bar">
            <i style={{ width: `${Math.min(pacing?.spentPct ?? 0, 100)}%` }} />
          </div>
          <span className="sub">{paceText}</span>
        </div>
      </Stats>

      <Card>
        <CardHead title="Campaigns, last 28 days" actions={manage ? <BudgetEditor clientId={clientId} month={month} budget={budget} /> : null} />
        {campaigns.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Campaign</Th>
                <Th hideSm>Platform</Th>
                <Th right>Spend</Th>
                <Th right hideSm>
                  Clicks
                </Th>
                <Th right>Leads</Th>
                <Th right>Cost per lead</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const cpl = costPerLead(c.spend28d, c.leads28d);
                return (
                  <tr key={c.id}>
                    <Td>
                      <strong>{c.name}</strong>
                    </Td>
                    <Td hideSm>{SOURCE_LABEL[c.platform]}</Td>
                    <Td right num>
                      {formatMoney(c.spend28d, c.currency)}
                    </Td>
                    <Td right num hideSm>
                      {formatNumber(c.clicks28d)}
                    </Td>
                    <Td right num>
                      {formatNumber(c.leads28d)}
                    </Td>
                    <Td right num>
                      {cpl == null ? <span className="muted">None</span> : formatMoney(cpl, c.currency)}
                    </Td>
                    <Td>
                      <StatusDot tone={CAMPAIGN_STATUS[c.status].tone}>{CAMPAIGN_STATUS[c.status].label}</StatusDot>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="No campaigns yet">Connect Google Ads or Meta Ads on the Performance tab to pull campaigns in.</EmptyState>
        )}
      </Card>
    </div>
  );
}

import { format } from "date-fns";
import { Card, CardBody, CardHead, EmptyState, NoAccess, Table, Td, Th } from "@/components/ui";
import { formatMoney, formatPct, leadsByChannel, monthStart } from "../logic";
import { getLatestAnalysis, listCampaigns, listLeads } from "../queries";
import { AnalysisEditor } from "../components/analysis-editor";
import { dataAccess, today } from "./access";

function Points({ items }: { items: string[] }) {
  if (!items.length) return <p className="small muted" style={{ margin: 0 }}>Nothing written yet.</p>;
  return (
    <ul className="small" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
      {items.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ul>
  );
}

/** Client page tab "Analysis": the month's what changed / why / next, plus leads by channel. */
export async function AnalysisTab({ clientId }: { clientId: string }) {
  const { view, manage } = await dataAccess();
  if (!view) return <NoAccess />;

  const { now, today: day } = today();
  const [analysis, leads, campaigns] = await Promise.all([getLatestAnalysis(clientId), listLeads(clientId, 1000), listCampaigns(clientId)]);
  const channels = leadsByChannel(leads, campaigns, now);
  // Default new analyses to last month, the one normally being reviewed.
  const lastMonth = monthStart(new Date(Date.parse(`${monthStart(day)}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10));
  const month = analysis ? format(new Date(`${analysis.period}T00:00:00Z`), "MMMM") : null;

  return (
    <div className="stack" style={{ gap: 16 }}>
      {manage ? (
        <div className="row between">
          <span className="muted">{month ? `Analysis for ${month}` : "No analysis written yet"}</span>
          <AnalysisEditor clientId={clientId} analysis={analysis} defaultPeriod={lastMonth} />
        </div>
      ) : null}
      <div className="grid-2">
        {analysis ? (
          <>
            <Card>
              <CardHead title={`What changed in ${month}`} />
              <CardBody>
                <Points items={analysis.whatChanged} />
              </CardBody>
            </Card>
            <Card>
              <CardHead title="Why" />
              <CardBody>
                <Points items={analysis.why} />
              </CardBody>
            </Card>
            <Card>
              <CardHead title="What we'll do next" />
              <CardBody>
                <Points items={analysis.nextSteps} />
              </CardBody>
            </Card>
          </>
        ) : (
          <Card>
            <EmptyState title="No analysis yet">Write what changed this month, why, and what the team will do next.</EmptyState>
          </Card>
        )}
        <Card>
          <CardHead title="Leads by channel" />
          {channels.length ? (
            <Table>
              <thead>
                <tr>
                  <Th>Channel</Th>
                  <Th right>Leads</Th>
                  <Th right>Share</Th>
                  <Th right>Cost per lead</Th>
                </tr>
              </thead>
              <tbody>
                {channels.map((c) => (
                  <tr key={c.source}>
                    <Td>{c.label}</Td>
                    <Td right num>
                      {c.count}
                    </Td>
                    <Td right num>
                      {formatPct(c.sharePct)}
                    </Td>
                    <Td right num>
                      {c.cpl == null ? <span className="muted">None</span> : formatMoney(c.cpl, c.currency)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState title="No leads in the last 28 days" />
          )}
        </Card>
      </div>
    </div>
  );
}

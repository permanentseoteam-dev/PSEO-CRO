import { Card, CardHead, EmptyState, NoAccess, StatCard, Stats, Table, Td, Th } from "@/components/ui";
import { formatNumber, formatPct, positionChange, seoSummary, snapshot28 } from "../logic";
import { getClientBasics, listMetricDays, listSeoQueries } from "../queries";
import { dataAccess, today } from "./access";

/** Client page tab "SEO": Search Console clicks, top 10 count, average position and top queries. */
export async function SeoTab({ clientId }: { clientId: string }) {
  const { view } = await dataAccess();
  if (!view) return <NoAccess />;

  const { yesterday } = today();
  const [client, queries, days] = await Promise.all([getClientBasics(clientId), listSeoQueries(clientId), listMetricDays(clientId, yesterday)]);
  const clicks = snapshot28(days, yesterday).rows.find((r) => r.key === "organic_clicks");
  const sum = seoSummary(queries);
  const hasSeo = client?.services.some((s) => s.toLowerCase() === "seo");

  return (
    <div className="stack" style={{ gap: 16 }}>
      {client && !hasSeo ? (
        <p className="small muted" style={{ margin: 0 }}>
          SEO isn&apos;t in {client.name}&apos;s current services. This view uses Search Console data so the team can spot openings.
        </p>
      ) : null}
      <Stats>
        <StatCard
          label="Organic clicks, 28 days"
          value={clicks?.current == null ? "No data" : formatNumber(clicks.current)}
          sub={clicks?.changePct == null ? undefined : `${formatPct(clicks.changePct, true)} on prior 28`}
        />
        <StatCard label="Keywords in top 10" value={queries.length ? sum.top10 : "No data"} />
        <StatCard label="Average position" value={sum.avgPosition == null ? "No data" : formatNumber(sum.avgPosition, 1)} />
      </Stats>
      <Card>
        <CardHead title="Top queries" />
        {queries.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Query</Th>
                <Th right>Position</Th>
                <Th right>Clicks</Th>
                <Th right hideSm>
                  Impressions
                </Th>
                <Th right>Change</Th>
              </tr>
            </thead>
            <tbody>
              {queries.map((q) => {
                const ch = positionChange(q);
                return (
                  <tr key={q.query}>
                    <Td>{q.query}</Td>
                    <Td right num>
                      {formatNumber(q.position, 1)}
                    </Td>
                    <Td right num>
                      {formatNumber(q.clicks)}
                    </Td>
                    <Td right num hideSm>
                      {formatNumber(q.impressions)}
                    </Td>
                    <Td right num className={ch == null || ch === 0 ? "muted" : ch > 0 ? "t-ok" : "t-danger"}>
                      {ch == null ? "New" : ch === 0 ? "0" : `${ch > 0 ? "+" : "-"}${formatNumber(Math.abs(ch), 1)}`}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="No Search Console data yet">Connect Google Search Console on the Performance tab.</EmptyState>
        )}
      </Card>
    </div>
  );
}

import { format } from "date-fns";
import { Card, CardHead, EmptyState, NoAccess, StatusDot, Table, Td, Th } from "@/components/ui";
import { allSources, formatMoney, formatNumber, formatPct, snapshot28, SOURCE_LABEL, SOURCE_STATUS } from "../logic";
import { listDataSources, listMetricDays } from "../queries";
import { SourceActions } from "../components/source-actions";
import { dataAccess, today } from "./access";

/** Client page tab "Performance": data sources (connect / refresh / disconnect) and last 28 days vs prior 28. */
export async function PerformanceTab({ clientId }: { clientId: string }) {
  const { view, manage } = await dataAccess();
  if (!view) return <NoAccess />;

  const { yesterday } = today();
  const [sources, days] = await Promise.all([listDataSources(clientId), listMetricDays(clientId, yesterday)]);
  const rows = allSources(sources);
  const snap = snapshot28(days, yesterday);
  const hasData = snap.rows.some((r) => r.current != null || r.prior != null);
  const show = (v: number | null, money: boolean) =>
    v == null ? <span className="muted">No data</span> : money ? formatMoney(v, snap.currency) : formatNumber(v);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <Card>
        <CardHead title="Data sources" />
        <Table>
          <thead>
            <tr>
              <Th>Source</Th>
              <Th hideSm>Account</Th>
              <Th>Status</Th>
              <Th hideSm>Last refresh</Th>
              {manage ? <Th aria-label="Actions" /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.source}>
                <Td>
                  <strong>{SOURCE_LABEL[s.source]}</strong>
                </Td>
                <Td hideSm>{s.accountLabel ?? <span className="muted">None</span>}</Td>
                <Td>
                  <StatusDot tone={SOURCE_STATUS[s.status].tone}>{SOURCE_STATUS[s.status].label}</StatusDot>
                  {s.status === "error" && s.lastError ? <div className="small muted">{s.lastError}</div> : null}
                </Td>
                <Td hideSm>{s.lastRefreshAt ? format(new Date(s.lastRefreshAt), "d MMM HH:mm") : <span className="muted">Never</span>}</Td>
                {manage ? (
                  <Td right>
                    <SourceActions clientId={clientId} source={s.source} status={s.status} />
                  </Td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card>
        <CardHead title="Last 28 days vs prior 28" />
        {hasData ? (
          <Table>
            <thead>
              <tr>
                <Th>Metric</Th>
                <Th right>Last 28 days</Th>
                <Th right hideSm>
                  Prior 28
                </Th>
                <Th right>Change</Th>
              </tr>
            </thead>
            <tbody>
              {snap.rows.map((r) => (
                <tr key={r.key}>
                  <Td>{r.label}</Td>
                  <Td right num>
                    {show(r.current, r.money)}
                  </Td>
                  <Td right num hideSm className="muted">
                    {show(r.prior, r.money)}
                  </Td>
                  <Td right num className={r.good == null ? "muted" : r.good ? "t-ok" : "t-danger"}>
                    {r.changePct == null ? "No change data" : formatPct(r.changePct, true)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="No data yet">Connect a source above. Numbers appear after the first refresh.</EmptyState>
        )}
      </Card>
    </div>
  );
}

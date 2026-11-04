import Link from "next/link";
import { Avatar, Card, CardBody, CardHead, EmptyState, NoAccess, Table, Td, Th } from "@/components/ui";
import { can, requireMe } from "@/lib/auth/can";
import { failedChecks, mostRevised, qualityGroups, rangeKey } from "../logic";
import { getQualityData, todayIso } from "../queries";

// Reviews → Quality report extras. Phase 1 owns the report, its range filter and tab bar;
// these render the content of the new tabs and panel. `range` is the report's "d30" | "d90" | "y".

/** Tab items to append to the report's People / Departments / Clients tabs. */
export const QUALITY_EXTRA_TABS = [
  { value: "svc", label: "Services" },
  { value: "most", label: "Most revised" },
] as const;

const show = (v: number | null, suffix = "") => (v == null ? <span className="muted">None</span> : `${v}${suffix}`);

/** "Services" tab: reviewed, first-time pass, avg rounds, avg wait per service (the project's department). */
export async function QualityServicesTab({ range }: { range?: string }) {
  const me = await requireMe();
  if (me.kind !== "staff" || !can(me, "work.quality.view")) return <NoAccess />;
  const { rounds, tickets } = await getQualityData(rangeKey(range), todayIso());
  const rows = qualityGroups(rounds, (id) => tickets.get(id)?.service ?? null);
  if (!rows.length) return <EmptyState title="No reviews in this range" />;
  return (
    <Table>
      <thead>
        <tr>
          <Th>Service</Th>
          <Th num>Reviewed</Th>
          <Th num>First-time pass</Th>
          <Th num>Avg rounds</Th>
          <Th num>Avg wait</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.name}>
            <Td>{r.name}</Td>
            <Td num>{r.reviewed}</Td>
            <Td num>{show(r.firstTimePct, "%")}</Td>
            <Td num>{show(r.avgRounds)}</Td>
            <Td num>{show(r.avgWaitH, "h")}</Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

/** "Most revised" tab: tickets sent back most, with rounds and the main reason. */
export async function QualityMostRevisedTab({ range }: { range?: string }) {
  const me = await requireMe();
  if (me.kind !== "staff" || !can(me, "work.quality.view")) return <NoAccess />;
  const { rounds, tickets } = await getQualityData(rangeKey(range), todayIso());
  const rows = mostRevised(rounds).filter((r) => tickets.has(r.ticketId));
  if (!rows.length) return <EmptyState title="Nothing was sent back in this range" />;
  return (
    <Table>
      <thead>
        <tr>
          <Th>Ticket</Th>
          <Th>Owner</Th>
          <Th num>Rounds</Th>
          <Th hideSm>Main reason</Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const t = tickets.get(r.ticketId)!;
          return (
            <tr key={r.ticketId}>
              <Td>
                <Link href={`/t/${t.key}`}>{t.key}</Link> {t.title}
              </Td>
              <Td>
                {t.owner ? (
                  <span className="row" style={{ flexWrap: "nowrap" }}>
                    <Avatar name={t.owner} size={22} /> {t.owner}
                  </span>
                ) : (
                  <span className="muted">Unassigned</span>
                )}
              </Td>
              <Td num>{r.rounds}</Td>
              <Td hideSm>{r.mainReason ?? <span className="muted">None given</span>}</Td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}

/** Panel "QA checks failed most", next to "Why work goes back". */
export async function FailedChecksPanel({ range }: { range?: string }) {
  const me = await requireMe();
  if (me.kind !== "staff" || !can(me, "work.quality.view")) return null;
  const { results } = await getQualityData(rangeKey(range), todayIso());
  const rows = failedChecks(results);
  const top = rows[0]?.[1] ?? 1;
  return (
    <Card>
      <CardHead title="QA checks failed most" />
      <CardBody className="stack">
        {rows.length === 0 ? <p className="muted">No failed checks in this range.</p> : null}
        {rows.map(([label, n]) => (
          <div key={label} className="row" style={{ flexWrap: "nowrap" }}>
            <span style={{ flex: "1 1 45%", minWidth: 0 }}>{label}</span>
            <div className="bar t-danger" style={{ flex: "1 1 40%" }}>
              <i style={{ width: `${Math.round((n / top) * 100)}%` }} />
            </div>
            <span className="num" style={{ width: 32, textAlign: "right" }}>
              {n}
            </span>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

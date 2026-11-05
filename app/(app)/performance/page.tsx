import { requireMe, can } from "@/lib/auth/can";
import { Avatar, Card, CardBody, CardHead, EmptyState, NoAccess, StatCard, Stats, StatusDot, Table, Tabs, Td, Th } from "@/components/ui";
import type { Tone } from "@/components/ui";
import {
  band,
  CONFIDENCE,
  fmtDay,
  fmtValue,
  kpiScore,
  kpiSummary,
  krOnTrack,
  okrAverage,
  QUARTER_RE,
  quarterOf,
  quarterScore,
  recentQuarters,
  REVIEW,
  teamOf,
} from "@/lib/modules/team/logic";
import { getPerformance, listPeople } from "@/lib/modules/team/queries";
import { SetupTab, TrainingTab } from "@/features/hr-p2";
import { CheckInButton, NewObjectiveButton, QuarterSelect, SelfReviewButton, UpdateKpiButton } from "./_components/perf-forms";

export const metadata = { title: "Performance" };

const TABS = ["growth", "team", "okrs", "training", "setup"] as const;
type Tab = (typeof TABS)[number];

function ScoreBar({ score, tone }: { score: number; tone?: Tone }) {
  return (
    <div className="flex min-w-[140px] items-center gap-2">
      <div className={`bar flex-1 t-${tone ?? band(score)}`}>
        <i style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
      </div>
      <span className="num">{score}</span>
    </div>
  );
}

export default async function PerformancePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireMe();
  if (me.kind !== "staff") return <NoAccess />;
  const sp = await searchParams;
  const now = new Date();
  const quarters = recentQuarters(now, 4);
  const quarter = sp.q && QUARTER_RE.test(sp.q) ? sp.q : quarterOf(now);
  if (!quarters.includes(quarter)) quarters.push(quarter);

  const seeTeam = can(me, "performance.team.view", "team");
  const setup = can(me, "perf.setup.manage", "team");
  const visible = TABS.filter((t) => (t === "team" ? seeTeam : t === "setup" ? setup : true));
  const tab: Tab = visible.includes(sp.tab as Tab) ? (sp.tab as Tab) : "growth";

  const [data, { people, departments }] = await Promise.all([getPerformance(me.id, quarter), listPeople()]);
  const myReview = data.reviews.get(me.id) ?? (data.cycle ? "self_review" : null);
  const canSelfReview = data.cycle?.status === "open" && myReview === "self_review";
  const href = (t: Tab) => `/performance?q=${encodeURIComponent(quarter)}&tab=${t}`;

  return (
    <div className="page">
      <div className="row between">
        <QuarterSelect quarters={quarters} value={quarter} tab={tab} />
        {canSelfReview && data.cycle ? <SelfReviewButton cycleId={data.cycle.id} quarter={quarter} /> : null}
      </div>

      <Tabs
        value={tab}
        label="Performance"
        items={visible.map((t) => ({
          value: t,
          href: href(t),
          label:
            t === "growth" ? "My growth" : t === "team" ? "Team" : t === "okrs" ? "OKRs" : t === "training" ? "Training" : "Setup",
        }))}
      />

      {tab === "growth" ? <Growth data={data} myReview={myReview} /> : null}
      {tab === "team" ? (
        <TeamTab
          data={data}
          people={teamOf(me, people, departments, can(me, "performance.team.view", "all") ? "all" : "team")}
        />
      ) : null}
      {tab === "okrs" ? (
        <section className="stack">
          <div className="row between">
            <span className="muted">
              <b>{data.objectives.length}</b> objectives in {quarter}
            </span>
            <NewObjectiveButton
              people={can(me, "performance.manage", "team") ? people.map((p) => ({ id: p.id, name: p.name })) : [{ id: me.id, name: me.name }]}
              meId={me.id}
              quarters={quarters}
              quarter={quarter}
            />
          </div>
          {data.objectives.length ? (
            data.objectives.map((o) => (
              <Card key={o.id}>
                <CardHead title={o.title} actions={<CheckInButton krs={o.keyResults} />} />
                <CardBody>
                  <div className="row between small muted">
                    <span>{o.owner}</span>
                    <span>{okrAverage(o.keyResults)}% overall</span>
                  </div>
                  {o.keyResults.map((k) => (
                    <div key={k.id} className="grid items-center gap-3 border-t border-line py-2.5 sm:grid-cols-[1fr_140px_110px]">
                      <span>{k.title}</span>
                      <ScoreBar score={k.progress} tone={CONFIDENCE[k.confidence].tone} />
                      <StatusDot tone={CONFIDENCE[k.confidence].tone}>{CONFIDENCE[k.confidence].label}</StatusDot>
                    </div>
                  ))}
                </CardBody>
              </Card>
            ))
          ) : (
            <Card>
              <EmptyState title={`No objectives in ${quarter}`}>Set one objective with up to 6 measurable key results.</EmptyState>
            </Card>
          )}
        </section>
      ) : null}
      {tab === "training" ? <TrainingTab /> : null}
      {tab === "setup" ? <SetupTab /> : null}
    </div>
  );
}

type Data = Awaited<ReturnType<typeof getPerformance>>;

function Growth({ data, myReview }: { data: Data; myReview: keyof typeof REVIEW | null }) {
  const score = quarterScore(data.myKpis);
  const sum = kpiSummary(data.myKpis);
  const due = data.cycle ? (myReview === "self_review" ? data.cycle.selfDue : data.cycle.managerDue) : null;
  return (
    <section className="stack">
      <Stats>
        <StatCard
          label="Quarter score"
          value={<span className="text-[40px] leading-none">{score ?? "–"}</span>}
          tone={score == null ? undefined : band(score)}
          sub="Good is 80 or more"
        />
        <StatCard label="KPIs on target" value={sum.total ? `${sum.onTarget} of ${sum.total}` : "–"} sub={sum.near ? `${sum.near} within 5%` : undefined} />
        <StatCard
          label="Review"
          value={myReview ? <StatusDot tone={REVIEW[myReview].tone}>{REVIEW[myReview].label}</StatusDot> : "–"}
          sub={due && myReview !== "acknowledged" ? `Due ${fmtDay(due)}` : data.cycle ? undefined : "No review cycle this quarter"}
        />
      </Stats>
      <Card>
        <CardHead
          title="Scorecard"
          actions={
            data.myKpis.length ? (
              <UpdateKpiButton kpis={data.myKpis.map((k) => ({ id: k.id, name: k.name, value: k.value }))} initialId={data.myKpis[0].id} label="Update value" />
            ) : null
          }
        />
        {data.myKpis.length ? (
          <Table>
            <thead>
              <tr>
                <Th>KPI</Th>
                <Th right>Now</Th>
                <Th right>Target</Th>
                <Th>Score</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {data.myKpis.map((k) => (
                <tr key={k.id}>
                  <Td>{k.name}</Td>
                  <Td right num>
                    {fmtValue(k.value, k.unit)}
                  </Td>
                  <Td right num>
                    {fmtValue(k.target, k.unit)}
                  </Td>
                  <Td>
                    <ScoreBar score={kpiScore(k.value, k.target, k.direction)} />
                  </Td>
                  <Td right>
                    <UpdateKpiButton
                      kpis={data.myKpis.map((x) => ({ id: x.id, name: x.name, value: x.value }))}
                      initialId={k.id}
                      label="Update"
                      variant="ghost"
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="No KPIs this quarter">Your manager sets your KPIs and targets.</EmptyState>
        )}
      </Card>
    </section>
  );
}

function TeamTab({ data, people }: { data: Data; people: { id: string; name: string }[] }) {
  return (
    <Card>
      <CardHead title="My team this quarter" />
      {people.length ? (
        <Table>
          <thead>
            <tr>
              <Th>Person</Th>
              <Th>Score</Th>
              <Th>OKRs</Th>
              <Th>Review</Th>
            </tr>
          </thead>
          <tbody>
            {people.map((p) => {
              const score = quarterScore(data.kpisByMember.get(p.id) ?? []);
              const krs = krOnTrack(data.objectives.filter((o) => o.ownerId === p.id).flatMap((o) => o.keyResults));
              const rv = data.reviews.get(p.id) ?? (data.cycle ? "self_review" : null);
              return (
                <tr key={p.id}>
                  <Td>
                    <div className="row">
                      <Avatar name={p.name} size={28} />
                      {p.name}
                    </div>
                  </Td>
                  <Td>{score == null ? <span className="muted">–</span> : <ScoreBar score={score} />}</Td>
                  <Td>{krs.total ? `${krs.onTrack} of ${krs.total} on track` : <span className="muted">–</span>}</Td>
                  <Td>{rv ? <StatusDot tone={REVIEW[rv].tone}>{REVIEW[rv].label}</StatusDot> : <span className="muted">–</span>}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      ) : (
        <EmptyState title="No one on your team yet" />
      )}
    </Card>
  );
}

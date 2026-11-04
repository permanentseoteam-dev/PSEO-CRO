import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { requireMe, can } from "@/lib/auth/can";
import {
  Avatar, ButtonLink, Card, CardBody, CardHead, EmptyState, NoAccess, PhaseTwo, Seg, StatCard, Stats, Table, Tabs, Td, Th,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { todayIn } from "@/lib/modules/tickets/logic";
import { hoursBetween, hrs, oneDp, pct, qualityBy, qualityStats, RANGES, rangeStart, reasonCounts, type Range } from "@/lib/modules/work/logic";
import { listClients, listDepartments, listQaChecklists, listStaff, reviewFacts, reviewQueue } from "@/lib/modules/work/queries";
import type { QualityRow, QueueRow } from "@/lib/modules/work/types";
import { QaChecklistsButton } from "./_components/qa-checklists";

export const metadata = { title: "Reviews" };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const BY = ["people", "dept", "clients", "svc", "most"] as const;
type By = (typeof BY)[number];

export default async function ReviewsPage({ searchParams }: { searchParams: SP }) {
  const me = await requireMe();
  if (me.kind !== "staff") return <NoAccess />;

  const sp = await searchParams;
  const canReport = can(me, "work.quality.view");
  const report = canReport && one(sp.view) === "report";
  const range: Range = RANGES.some((r) => r.value === one(sp.range)) ? (one(sp.range) as Range) : "30d";
  const by: By = (BY as readonly string[]).includes(one(sp.by)) ? (one(sp.by) as By) : "people";
  const href = (p: Record<string, string>) => `/reviews?${new URLSearchParams({ view: "report", range, by, ...p })}`;

  const canManageQa = can(me, "work.templates.manage");
  const qaLists = canManageQa ? await listQaChecklists() : [];

  return (
    <div className="page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="m-0">{report ? "Quality report" : "Review queue"}</h2>
        <div className="row">
          {canManageQa ? <QaChecklistsButton lists={qaLists} /> : null}
          {canReport ? (
            <ButtonLink variant="primary" href={report ? "/reviews" : "/reviews?view=report"}>
              {report ? "Review queue" : "Quality report"}
            </ButtonLink>
          ) : null}
        </div>
      </div>
      {report ? <Report range={range} by={by} href={href} /> : <Queue meId={me.id} departmentId={me.departmentId} all={can(me, "work.quality.view", "all")} />}
    </div>
  );
}

// ---------------------------------------------------------------- queue

async function Queue({ meId, departmentId, all }: { meId: string; departmentId: string | null; all: boolean }) {
  const { mine, team } = await reviewQueue({ id: meId, departmentId }, all);
  const now = new Date();

  const rows = (list: QueueRow[], withReviewer: boolean) => (
    <Table>
      <thead>
        <tr>
          <Th>Ticket</Th>
          <Th>Owner</Th>
          <Th>Project</Th>
          {withReviewer ? <Th hideSm>Reviewer</Th> : null}
          <Th>Waiting</Th>
        </tr>
      </thead>
      <tbody>
        {list.map((r) => {
          const h = Math.floor(hoursBetween(r.waitingSince, now));
          return (
            <tr key={r.ticketId}>
              <Td>
                <Link href={`/t/${r.key}`} title={r.title}>
                  {r.key}
                </Link>{" "}
                <span className="muted">· round {r.round}</span>
              </Td>
              <Td>
                <span className="row flex-nowrap">
                  <Avatar name={r.owner} size={22} /> {r.owner}
                </span>
              </Td>
              <Td>{r.project}</Td>
              {withReviewer ? <Td hideSm>{r.reviewer}</Td> : null}
              <Td num className={cn(h > 24 && "t-warn font-semibold")}>
                {h}h
              </Td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );

  return (
    <section className="stack gap-5">
      <Card>
        <CardHead title={<>Waiting for me <span className="muted num">{mine.length}</span></>} />
        {mine.length ? rows(mine, false) : <EmptyState icon={<ClipboardCheck />} title="Nothing to review">Work sent to you for review shows here.</EmptyState>}
      </Card>
      <Card>
        <CardHead title={<>Team queue <span className="muted num">{team.length}</span></>} />
        {team.length ? rows(team, true) : <EmptyState title="Your department's queue is clear" />}
      </Card>
    </section>
  );
}

// ---------------------------------------------------------------- report

async function Report({ range, by, href }: { range: Range; by: By; href: (p: Record<string, string>) => string }) {
  const [facts, staff, departments, clients] = await Promise.all([
    reviewFacts(rangeStart(range, todayIn())),
    listStaff(),
    listDepartments(),
    listClients(),
  ]);
  const s = qualityStats(facts);
  const reasons = reasonCounts(facts);
  const top = reasons[0]?.[1] ?? 1;
  const names = (list: { id: string; name: string }[]) => {
    const m = new Map(list.map((x) => [x.id, x.name]));
    return (id: string) => m.get(id) ?? "Unknown";
  };

  const tables: Partial<Record<By, { head: string; rows: QualityRow[]; avatar?: boolean }>> = {
    people: { head: "Person", rows: qualityBy(facts, (r) => r.owner_id, names(staff)), avatar: true },
    dept: { head: "Department", rows: qualityBy(facts, (r) => r.department_id, names(departments)) },
    clients: { head: "Client", rows: qualityBy(facts, (r) => r.client_id, names(clients)) },
  };
  const t = tables[by];

  return (
    <section className="stack gap-5">
      <div className="row between">
        <Seg label="Range" value={range} items={RANGES.map((r) => ({ value: r.value, label: r.label, href: href({ range: r.value }) }))} />
      </div>

      <Stats>
        <StatCard label="Tickets reviewed" value={<span className="num">{s.reviewed}</span>} />
        <StatCard label="Passed first time" value={<span className="num">{pct(s.firstPass)}</span>} tone="ok" />
        <StatCard label="Avg review rounds" value={<span className="num">{oneDp(s.avgRounds)}</span>} />
        <StatCard label="Avg wait for review" value={<span className="num">{hrs(s.avgWaitH)}</span>} sub="Target under 24h" />
        <StatCard label="Waited over 24h" value={<span className="num">{s.over24}</span>} tone="warn" />
      </Stats>

      <div className="grid-2">
        <Card>
          <CardHead title="Why work goes back" />
          <CardBody>
            {reasons.length ? (
              reasons.map(([r, v]) => (
                <div key={r} className="grid grid-cols-[110px_1fr_32px] items-center gap-2.5 py-1 text-[13px] sm:grid-cols-[160px_1fr_40px]">
                  <span>{r}</span>
                  <div className="bar t-warn">
                    <i style={{ width: `${Math.round((v / top) * 100)}%` }} />
                  </div>
                  <span className="num right">{v}</span>
                </div>
              ))
            ) : (
              <p className="muted m-0">Nothing was sent back in this range.</p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHead title={<>QA checks failed most <PhaseTwo /></>} />
          <CardBody>
            <p className="muted m-0">Failed checks from QA checklists show here in phase 2.</p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody className="stack">
          <Tabs
            label="Group by"
            value={by}
            items={[
              { value: "people", label: "People", href: href({ by: "people" }) },
              { value: "dept", label: "Departments", href: href({ by: "dept" }) },
              { value: "clients", label: "Clients", href: href({ by: "clients" }) },
              { value: "svc", label: <>Services <PhaseTwo /></>, href: href({ by: "svc" }) },
              { value: "most", label: <>Most revised <PhaseTwo /></>, href: href({ by: "most" }) },
            ]}
          />
          {!t ? (
            <p className="muted m-0">This view comes in phase 2.</p>
          ) : t.rows.length === 0 ? (
            <p className="muted m-0">No reviews were finished in this range.</p>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>{t.head}</Th>
                  <Th num>Reviewed</Th>
                  <Th num>First-time pass</Th>
                  <Th num>Avg rounds</Th>
                  <Th num>Avg wait</Th>
                </tr>
              </thead>
              <tbody>
                {t.rows.map((r) => (
                  <tr key={r.key}>
                    <Td>
                      {t.avatar ? (
                        <span className="row flex-nowrap">
                          <Avatar name={r.label} size={22} /> {r.label}
                        </span>
                      ) : (
                        r.label
                      )}
                    </Td>
                    <Td num>{r.reviewed}</Td>
                    <Td num>{pct(r.firstPass)}</Td>
                    <Td num>{oneDp(r.avgRounds)}</Td>
                    <Td num>{hrs(r.avgWaitH)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </CardBody>
      </Card>
    </section>
  );
}

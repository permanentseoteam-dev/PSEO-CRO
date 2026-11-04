import { Avatar, ButtonLink, Card, CardBody, CardHead, EmptyState, StatCard, Stats, StatusDot, Table, Td, Th } from "@/components/ui";
import { can, type Me } from "@/lib/auth/can";
import {
  getFinanceSnapshot,
  getHrToday,
  getOnboardingDone,
  getPulseInput,
  listAnnouncements,
  listDepartments,
  listMyDeals,
  listOverdueTickets,
  memberNames,
  today,
} from "../queries";
import { balancesByCurrency, daysBetween, monthBounds, money, overdueByPerson, pipelineOpen, pulse, shortDate, STAGE_INFO, sumByCurrency, visibleAnnouncements } from "../logic";
import { AnnouncementsCard } from "./announcements";
import { GettingStarted } from "./getting-started";
import { LeaveDecision } from "./leave-decision";
import { PushNudge } from "./push-nudge";

/**
 * Phase 2 Home role panels. Server component: each panel shows only for people with its permission,
 * and RLS limits the numbers. Mount under the Phase 1 Home panels (see WIRING.md).
 */
export async function HomeRolePanels({ me }: { me: Me }) {
  if (me.kind !== "staff") return null;
  const showPulse = can(me, "leadership.pulse.view");
  const showHr = can(me, "hr.directory.view", "team");
  const showFinance = can(me, "finance.invoices.view", "team");
  const showOverdue = can(me, "work.projects.manage", "team");

  const [anns, depts, done, pulseCard, hrCard, financeCard, pipelineCard, overdueCard] = await Promise.all([
    listAnnouncements(),
    listDepartments(),
    getOnboardingDone(me.id),
    showPulse ? PulsePanel() : null,
    showHr ? HrTodayPanel({ canDecide: can(me, "time.approve", "team") }) : null,
    showFinance ? FinancePanel() : null,
    PipelinePanel({ memberId: me.id }),
    showOverdue ? OverduePanel() : null,
  ]);

  return (
    <>
      <PushNudge />
      <div className="grid-2">
        {pulseCard}
        {hrCard}
        {financeCard}
        {pipelineCard}
        {overdueCard}
        <AnnouncementsCard
          items={visibleAnnouncements(anns, today())}
          canPost={can(me, "home.announcements.post")}
          canPostAll={can(me, "home.announcements.post", "all")}
          myDepartmentId={me.departmentId}
          departments={depts}
          meId={me.id}
        />
        <GettingStarted done={done} />
      </div>
    </>
  );
}

const monthName = (ymd: string) => new Date(`${ymd}T00:00:00Z`).toLocaleString("en-GB", { month: "long", timeZone: "UTC" });

async function PulsePanel() {
  const t = today();
  const { start, prevStart } = monthBounds(t);
  const p = pulse(await getPulseInput(), start);
  const change = p.changePct === null ? "No invoices last month" : `${p.changePct >= 0 ? "Up" : "Down"} ${Math.abs(p.changePct)}% on ${monthName(prevStart)}`;
  return (
    <Card>
      <CardHead title="CEO pulse" actions={<span className="small muted">{monthName(start)} to date</span>} />
      <CardBody className="stack">
        <Stats>
          <StatCard label="Revenue" value={<span className="num">{money(p.revenue, p.base)}</span>} sub={p.others.length ? `${change}. Also ${p.others.map(([c, v]) => money(v, c)).join(", ")}` : change} />
          <StatCard label="Active clients" value={<span className="num">{p.activeClients}</span>} sub={`${p.newThisMonth} new this month`} />
          <StatCard
            label="At risk"
            value={<span className="num">{p.atRisk}</span>}
            tone={p.atRisk ? "danger" : undefined}
            sub={p.lowest ? `${p.lowest.name} lowest at ${p.lowest.health_score ?? "?"}` : "None at risk"}
          />
        </Stats>
        <div className="between small">
          <span>Team utilisation</span>
          <span className="num">{p.utilisationPct}%</span>
        </div>
        <div className="bar" aria-hidden>
          <i style={{ width: `${p.utilisationPct}%` }} />
        </div>
      </CardBody>
    </Card>
  );
}

const LEAVE_KIND: Record<string, string> = { annual: "Annual leave", sick: "Sick leave", unpaid: "Unpaid leave", wfh: "Working from home" };
const range = (a: string, b: string) => (a === b ? shortDate(a) : `${shortDate(a)} to ${shortDate(b)}`);

async function HrTodayPanel({ canDecide }: { canDecide: boolean }) {
  const { pending, offToday } = await getHrToday();
  const names = await memberNames([...pending, ...offToday].map((l) => l.member_id));
  const empty = !pending.length && !offToday.length;
  return (
    <Card>
      <CardHead title="HR today" actions={<ButtonLink size="sm" variant="ghost" href="/people">Directory</ButtonLink>} />
      <CardBody className="list">
        {empty ? <EmptyState title="Everyone is in today" /> : null}
        {offToday.map((l) => (
          <div key={l.id} className="item between">
            <span className="row min-w-0" style={{ gap: 8 }}>
              <Avatar name={names.get(l.member_id) ?? "?"} size={24} /> {names.get(l.member_id) ?? "Someone"}
            </span>
            <span className="small muted">{LEAVE_KIND[l.kind] ?? l.kind}</span>
          </div>
        ))}
        {pending.map((l) => (
          <div key={l.id} className="item between">
            <span className="min-w-0">
              <span className="row" style={{ gap: 8 }}>
                <Avatar name={names.get(l.member_id) ?? "?"} size={24} /> {names.get(l.member_id) ?? "Someone"}
              </span>
              <span className="small muted">
                {LEAVE_KIND[l.kind] ?? l.kind}, {range(l.starts_on, l.ends_on)}
              </span>
            </span>
            {canDecide ? <LeaveDecision id={l.id} /> : <StatusDot tone="warn">Waiting</StatusDot>}
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

async function FinancePanel() {
  const t = today();
  const snap = await getFinanceSnapshot();
  const { rows, overdueCount } = balancesByCurrency(snap.invoices, t);
  const received = Object.entries(sumByCurrency(snap.receivedThisWeek));
  return (
    <Card>
      <CardHead title="Finance & accounts" actions={<ButtonLink size="sm" variant="ghost" href="/finance/invoices">Invoices</ButtonLink>} />
      <CardBody className="stack">
        {rows.length === 0 ? (
          <EmptyState title="Nothing outstanding" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Currency</Th>
                <Th right>Outstanding</Th>
                <Th right>Overdue</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.currency}>
                  <Td>{r.currency}</Td>
                  <Td right num>{money(r.outstanding, r.currency)}</Td>
                  <Td right num className={r.overdue > 0 ? "text-danger" : undefined}>{money(r.overdue, r.currency)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <div className="row small muted">
          <span>{overdueCount === 1 ? "1 invoice overdue" : `${overdueCount} invoices overdue`}</span>
          <span>·</span>
          <span>{received.length ? `${received.map(([c, v]) => money(v, c)).join(", ")} received this week` : "Nothing received this week"}</span>
        </div>
      </CardBody>
    </Card>
  );
}

async function PipelinePanel({ memberId }: { memberId: string }) {
  const deals = await listMyDeals(memberId);
  if (!deals.length) return null; // Only people who own deals see this panel.
  const open = Object.entries(pipelineOpen(deals));
  return (
    <Card>
      <CardHead title="My pipeline" actions={open.length ? <span className="small muted">{open.map(([c, v]) => money(v, c)).join(", ")} open</span> : null} />
      <CardBody className="list">
        {deals.map((d) => (
          <div key={d.id} className="item between">
            <div className="min-w-0">
              <div>{d.name}</div>
              {d.service ? <div className="small muted">{d.service}</div> : null}
            </div>
            <div className="right">
              <div className="num">{money(d.value, d.currency)}</div>
              <StatusDot tone={STAGE_INFO[d.stage].tone} className="small">{STAGE_INFO[d.stage].label}</StatusDot>
            </div>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

async function OverduePanel() {
  const t = today();
  const rows = overdueByPerson(await listOverdueTickets(), t).slice(0, 8);
  const names = await memberNames(rows.map((r) => r.memberId));
  return (
    <Card>
      <CardHead title="Overdue by person" actions={<ButtonLink size="sm" variant="ghost" href="/tickets?due=overdue">Tickets</ButtonLink>} />
      {rows.length === 0 ? (
        <CardBody>
          <EmptyState title="Nothing overdue" />
        </CardBody>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Person</Th>
              <Th right>Overdue</Th>
              <Th>Oldest</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const name = r.memberId ? (names.get(r.memberId) ?? "Someone") : "Unassigned";
              return (
                <tr key={r.memberId ?? "none"}>
                  <Td>
                    <span className="row" style={{ gap: 8 }}>
                      <Avatar name={name} size={24} /> {name}
                    </span>
                  </Td>
                  <Td right num><span className="count">{r.count}</span></Td>
                  <Td className="text-danger">{daysBetween(r.oldest, t)} days late</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </Card>
  );
}

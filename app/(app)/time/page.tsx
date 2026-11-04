import Link from "next/link";
import { requireMe, can } from "@/lib/auth/can";
import { Avatar, ButtonLink, Card, CardBody, CardHead, EmptyState, NoAccess, StatCard, Stats, StatusDot, Table, Tabs, Td, Th } from "@/components/ui";
import {
  DOW,
  SHEET_STATUS,
  addDays,
  buildWeekGrid,
  clockedByDay,
  dow,
  fmtDay,
  fmtMinutes,
  fmtRange,
  inScope,
  monthDays,
  monthLabel,
  pct,
  requestLabel,
  shiftMonth,
  today,
  underLogged,
  weekDays,
  weekStart,
} from "@/lib/modules/personal/logic";
import {
  clientNames,
  getEntries,
  getSessionsFor,
  getSheets,
  listStaff,
  nameOf,
  onLeave,
  pendingLeaveToDecide,
  runningTimer,
  submittedSheets,
  ticketOptions,
} from "@/lib/modules/personal/queries";
import type { Entry } from "@/lib/modules/personal/types";
import type { Me } from "@/lib/auth/can";
import { TimerCard } from "./_components/timer-card";
import { WeekGrid } from "./_components/week-grid";
import { LeaveActions, SheetActions } from "./_components/approvals";

export const metadata = { title: "Time" };

type SP = Record<string, string | undefined>;
const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
const isMonth = (s?: string) => !!s && /^\d{4}-\d{2}$/.test(s);
const sum = (es: Entry[], f: (e: Entry) => boolean = () => true) => es.filter(f).reduce((a, e) => a + e.minutes, 0);

export default async function TimePage({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requireMe();
  if (me.kind !== "staff") return <NoAccess />;
  const sp = await searchParams;
  const tabs = [
    { value: "week", label: "My week" },
    { value: "month", label: "My month" },
    ...(can(me, "time.approve", "team") ? [{ value: "appr", label: "Approvals" }] : []),
    ...(can(me, "time.view", "team") ? [{ value: "team", label: "Team" }] : []),
    ...(can(me, "time.clients", "team") ? [{ value: "clients", label: "By client" }] : []),
  ];
  const tab = tabs.some((t) => t.value === sp.tab) ? sp.tab! : "week";
  const [tickets, running] = await Promise.all([ticketOptions(me.id), runningTimer(me.id)]);

  return (
    <div className="page">
      <TimerCard tickets={tickets} running={running} />
      <Tabs label="Time views" value={tab} items={tabs.map((t) => ({ ...t, href: `/time?tab=${t.value}` }))} />
      {tab === "week" ? <Week me={me} sp={sp} /> : null}
      {tab === "month" ? <Month me={me} sp={sp} /> : null}
      {tab === "appr" ? <Approvals me={me} /> : null}
      {tab === "team" ? <Team me={me} sp={sp} /> : null}
      {tab === "clients" ? <ByClient sp={sp} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------- my week (or someone's, from Approvals > View)

async function Week({ me, sp }: { me: Me; sp: SP }) {
  const t = today();
  const start = weekStart(isDate(sp.week) ? sp.week! : t);
  let memberId = me.id;
  let who: string | null = null;
  if (sp.member && sp.member !== me.id) {
    const staff = await listStaff();
    const p = staff.find((x) => x.id === sp.member);
    const scope = me.perms["time.view"] ?? "none";
    const approve = me.perms["time.approve"] ?? "none";
    if (!p || !(inScope(p, me, scope) || inScope(p, me, approve))) return <NoAccess />;
    memberId = p.id;
    who = p.name;
  }
  const days = weekDays(start);
  const [entries, sessions, sheets, approver] = await Promise.all([
    getEntries([memberId], start, days[6]),
    getSessionsFor([memberId], start, days[6]),
    getSheets([memberId], [start]),
    who ? Promise.resolve(null) : nameOf(me.managerId),
  ]);
  const grid = buildWeekGrid(entries, start);
  const clocked = clockedByDay(sessions, new Date());
  const sheet = sheets[0];
  const q = (w: string) => `/time?tab=week&week=${w}${who ? `&member=${memberId}` : ""}`;
  const thisWeek = weekStart(t);

  return (
    <WeekGrid
      key={`${memberId}${start}${JSON.stringify(grid.rows.map((r) => [r.ticketId, r.days]))}`}
      title={`${who ? `${who}, week` : "Week"} of ${fmtDay(start)}`}
      weekStart={start}
      days={days}
      rows={grid.rows}
      clocked={days.map((d) => clocked[d] ?? 0)}
      status={sheet?.status ?? "open"}
      returnNote={sheet?.returnNote ?? null}
      today={t}
      readOnly={!!who}
      approver={approver}
      nav={{ prev: q(addDays(start, -7)), next: start < thisWeek ? q(addDays(start, 7)) : null }}
    />
  );
}

// ---------------------------------------------------------------- my month

async function Month({ me, sp }: { me: Me; sp: SP }) {
  const t = today();
  const month = isMonth(sp.month) ? sp.month! : t.slice(0, 7);
  const prev = shiftMonth(month, -1);
  const days = monthDays(month);
  const prevDays = monthDays(prev);
  const prevWeeks = [...new Set(prevDays.map(weekStart))];
  const [entries, sessions, prevEntries, prevSheets] = await Promise.all([
    getEntries([me.id], days[0], days[days.length - 1]),
    getSessionsFor([me.id], days[0], days[days.length - 1]),
    getEntries([me.id], prevDays[0], prevDays[prevDays.length - 1]),
    getSheets([me.id], prevWeeks),
  ]);
  const logged = sum(entries);
  const billable = sum(entries, (e) => e.billable);
  const clocked = Object.values(clockedByDay(sessions, new Date())).reduce((a, b) => a + b, 0);
  const prevTotal = sum(prevEntries);
  const allApproved = prevWeeks.every((w) => prevSheets.some((s) => s.weekStart === w && s.status === "approved"));
  const byDay = new Map<string, number>();
  for (const e of entries) byDay.set(e.date, (byDay.get(e.date) ?? 0) + e.minutes);
  const isCurrent = month === t.slice(0, 7);

  return (
    <section className="stack">
      <Stats>
        <StatCard label="Logged" value={<span className="num">{fmtMinutes(logged)}</span>} sub={isCurrent ? `${monthLabel(month).split(" ")[0]} so far` : monthLabel(month)} />
        <StatCard label="Clocked" value={<span className="num">{fmtMinutes(clocked)}</span>} sub={`${pct(logged, clocked)}% of it logged`} tone={underLogged(logged, clocked) ? "danger" : undefined} />
        <StatCard label="Billable" value={<span className="num">{fmtMinutes(billable)}</span>} sub={`${pct(billable, logged)}% of logged`} />
        <StatCard label={`${monthLabel(prev).split(" ")[0]} total`} value={<span className="num">{fmtMinutes(prevTotal)}</span>} sub={allApproved ? "Approved" : "Not all approved yet"} />
      </Stats>
      <Card>
        <CardHead
          title={monthLabel(month)}
          actions={
            <>
              <ButtonLink size="sm" variant="ghost" href={`/time?tab=month&month=${prev}`}>Previous</ButtonLink>
              {!isCurrent ? <ButtonLink size="sm" variant="ghost" href={`/time?tab=month&month=${shiftMonth(month, 1)}`}>Next</ButtonLink> : null}
            </>
          }
        />
        <CardBody>
          <div className="mb-1 grid grid-cols-7 gap-1 text-center text-xs text-ink-3">
            {DOW.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>
          <div className="cal-grid">
            {Array.from({ length: dow(days[0]) }, (_, i) => (
              <div key={`b${i}`} className="cal-cell dim" />
            ))}
            {days.map((d) => (
              <div key={d} className={`cal-cell${dow(d) >= 5 ? " dim" : ""}${d === t ? " today" : ""}`}>
                <span className="small">{Number(d.slice(8))}</span>
                {byDay.get(d) ? (
                  <Link className="ev" href={`/time?tab=week&week=${weekStart(d)}`}>
                    {fmtMinutes(byDay.get(d)!)} logged
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </section>
  );
}

// ---------------------------------------------------------------- approvals

async function Approvals({ me }: { me: Me }) {
  const [allSheets, leave, staff] = await Promise.all([submittedSheets(me.id), pendingLeaveToDecide(me.id), listStaff()]);
  // Only people I can approve (time.view may show more than time.approve allows).
  const scope = me.perms["time.approve"] ?? "none";
  const mayDecide = (id: string) => staff.some((p) => p.id === id && inScope(p, me, scope));
  const sheets = allSheets.filter((s) => mayDecide(s.memberId));
  const decidable = leave.filter((l) => mayDecide(l.memberId));
  const ids = [...new Set(sheets.map((s) => s.memberId))];
  const from = sheets.reduce((a, s) => (s.weekStart < a ? s.weekStart : a), "9999-12-31");
  const to = sheets.reduce((a, s) => (s.weekStart > a ? s.weekStart : a), "0000-01-01");
  const [entries, sessions] = sheets.length
    ? await Promise.all([getEntries(ids, from, addDays(to, 6)), getSessionsFor(ids, from, addDays(to, 6))])
    : [[], []];
  const now = new Date();

  return (
    <section className="stack">
      <Card>
        <CardHead title="Waiting for approval" actions={<span className="small muted"><b>{sheets.length}</b> {sheets.length === 1 ? "timesheet" : "timesheets"}</span>} />
        {sheets.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Person</Th>
                <Th>Week</Th>
                <Th right>Logged</Th>
                <Th right hideSm>Billable</Th>
                <Th right>Clocked</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {sheets.map((s) => {
                const end = addDays(s.weekStart, 6);
                const inWeek = (d: string) => d >= s.weekStart && d <= end;
                const mine = entries.filter((e) => e.memberId === s.memberId && inWeek(e.date));
                const logged = sum(mine);
                const clocked = Object.entries(clockedByDay(sessions.filter((x) => x.memberId === s.memberId), now))
                  .filter(([d]) => inWeek(d))
                  .reduce((a, [, m]) => a + m, 0);
                return (
                  <tr key={s.id}>
                    <Td>
                      <div className="row flex-nowrap">
                        <Avatar name={s.name} size={26} />
                        {s.name}
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap">{fmtRange(s.weekStart, end)}</Td>
                    <Td right num>{fmtMinutes(logged)}</Td>
                    <Td right num hideSm>{fmtMinutes(sum(mine, (e) => e.billable))}</Td>
                    <Td right num>{fmtMinutes(clocked)}</Td>
                    <Td>
                      {underLogged(logged, clocked) ? (
                        <StatusDot tone="danger">Logged under 50% of clocked</StatusDot>
                      ) : (
                        <StatusDot tone="violet">Submitted</StatusDot>
                      )}
                    </Td>
                    <Td right>
                      <div className="row flex-nowrap justify-end">
                        <ButtonLink size="sm" variant="ghost" href={`/time?tab=week&week=${s.weekStart}&member=${s.memberId}`}>View</ButtonLink>
                        <SheetActions id={s.id} name={s.name} />
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="Nothing waiting">Submitted timesheets from your team show here.</EmptyState>
        )}
      </Card>
      {decidable.length ? (
        <Card>
          <CardHead title="Leave waiting" actions={<span className="small muted"><b>{decidable.length}</b> {decidable.length === 1 ? "request" : "requests"}</span>} />
          <Table>
            <thead>
              <tr>
                <Th>Person</Th>
                <Th>Type</Th>
                <Th>Dates</Th>
                <Th right>Days</Th>
                <Th hideSm>Reason</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {decidable.map((l) => (
                <tr key={l.id}>
                  <Td>
                    <div className="row flex-nowrap">
                      <Avatar name={l.name} size={26} />
                      {l.name}
                    </div>
                  </Td>
                  <Td>{requestLabel(l.type)}</Td>
                  <Td className="whitespace-nowrap">{fmtRange(l.start, l.end)}{l.halfDay ? " (half day)" : ""}</Td>
                  <Td right num>{l.type === "overtime" ? fmtMinutes(l.minutes ?? 0) : l.days}</Td>
                  <Td hideSm>{l.reason ?? <span className="muted">None</span>}</Td>
                  <Td right>
                    <LeaveActions id={l.id} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------- team this week

async function Team({ me, sp }: { me: Me; sp: SP }) {
  const t = today();
  const start = weekStart(isDate(sp.week) ? sp.week! : t);
  const end = addDays(start, 6);
  const scope = me.perms["time.view"] ?? "none";
  const people = (await listStaff()).filter((p) => inScope(p, me, scope));
  const ids = people.map((p) => p.id);
  const [entries, sessions, sheets, away] = await Promise.all([
    getEntries(ids, start, end),
    getSessionsFor(ids, start, end),
    getSheets(ids, [start]),
    onLeave(t),
  ]);
  const now = new Date();

  return (
    <Card>
      <CardHead
        title={start === weekStart(t) ? "Team this week" : `Team, week of ${fmtDay(start)}`}
        actions={
          <>
            <ButtonLink size="sm" variant="ghost" href={`/time?tab=team&week=${addDays(start, -7)}`}>Previous</ButtonLink>
            {start < weekStart(t) ? <ButtonLink size="sm" variant="ghost" href={`/time?tab=team&week=${addDays(start, 7)}`}>Next</ButtonLink> : null}
            <a className="btn sm ghost" href={`/time/export?week=${start}`} download>Export timesheets</a>
          </>
        }
      />
      <Table>
        <thead>
          <tr>
            <Th>Person</Th>
            <Th right>Logged</Th>
            <Th right>Clocked</Th>
            <Th right>Billable</Th>
            <Th>Week</Th>
          </tr>
        </thead>
        <tbody>
          {people.map((p) => {
            const mine = entries.filter((e) => e.memberId === p.id);
            const logged = sum(mine);
            const clocked = Object.values(clockedByDay(sessions.filter((s) => s.memberId === p.id), now)).reduce((a, b) => a + b, 0);
            const sheet = sheets.find((s) => s.memberId === p.id);
            const st = SHEET_STATUS[sheet?.status ?? "open"];
            const leave = !logged && !clocked && away.has(p.id);
            return (
              <tr key={p.id}>
                <Td>
                  <Link href={`/time?tab=week&week=${start}&member=${p.id}`} className="row flex-nowrap text-ink no-underline">
                    <Avatar name={p.name} size={26} />
                    {p.name}
                  </Link>
                </Td>
                <Td right num>{fmtMinutes(logged)}</Td>
                <Td right num>{fmtMinutes(clocked)}</Td>
                <Td right num>{logged ? `${pct(sum(mine, (e) => e.billable), logged)}%` : "–"}</Td>
                <Td>{leave ? <StatusDot tone="muted">On leave</StatusDot> : <StatusDot tone={st.tone}>{st.label}</StatusDot>}</Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </Card>
  );
}

// ---------------------------------------------------------------- by client

async function ByClient({ sp }: { sp: SP }) {
  const month = isMonth(sp.month) ? sp.month! : shiftMonth(today().slice(0, 7), -1);
  const days = monthDays(month);
  const [entries, names] = await Promise.all([getEntries(null, days[0], days[days.length - 1]), clientNames()]);
  const by = new Map<string, { bill: number; non: number }>();
  for (const e of entries) {
    const k = e.clientId ?? "";
    const row = by.get(k) ?? { bill: 0, non: 0 };
    if (e.billable) row.bill += e.minutes;
    else row.non += e.minutes;
    by.set(k, row);
  }
  const rows = [...by.entries()]
    .map(([id, v]) => ({ name: id ? (names.get(id) ?? "Unknown client") : "Internal (no client)", internal: !id, ...v }))
    .sort((a, b) => Number(a.internal) - Number(b.internal) || a.name.localeCompare(b.name));
  const thisMonth = today().slice(0, 7);

  return (
    <Card>
      <CardHead
        title={`${monthLabel(month)} by client`}
        actions={
          <>
            <ButtonLink size="sm" variant="ghost" href={`/time?tab=clients&month=${shiftMonth(month, -1)}`}>Previous</ButtonLink>
            {month < thisMonth ? <ButtonLink size="sm" variant="ghost" href={`/time?tab=clients&month=${shiftMonth(month, 1)}`}>Next</ButtonLink> : null}
          </>
        }
      />
      {rows.length ? (
        <Table>
          <thead>
            <tr>
              <Th>Client</Th>
              <Th right>Billable</Th>
              <Th right>Not billable</Th>
              <Th hideSm>Split</Th>
              <Th right>Billable share</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const share = pct(r.bill, r.bill + r.non);
              return (
                <tr key={r.name}>
                  <Td>{r.name}</Td>
                  <Td right num>{fmtMinutes(r.bill)}</Td>
                  <Td right num>{fmtMinutes(r.non)}</Td>
                  <Td hideSm>
                    <div className="flex h-2 min-w-[140px] overflow-hidden rounded bg-surface-2" role="img" aria-label={`${share}% billable`}>
                      <i className="bg-accent" style={{ width: `${share}%` }} />
                    </div>
                  </Td>
                  <Td right num>{share}%</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      ) : (
        <EmptyState title="No time logged">Nothing was logged in {monthLabel(month)}.</EmptyState>
      )}
    </Card>
  );
}

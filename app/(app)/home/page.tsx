import Link from "next/link";
import { Suspense } from "react";
import { requireMe, can } from "@/lib/auth/can";
import {
  Avatar,
  Avatars,
  ButtonLink,
  Card,
  CardBody,
  CardHead,
  Priority,
  StatusDot,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { SkeletonPanel, SkeletonTable } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  DEFAULT_CAPACITY,
  getDepartments,
  getDeptPanel,
  getFinanceSnapshot,
  getMyClients,
  getMyEvents,
  getMyTickets,
  getUpdates,
} from "@/lib/modules/home/queries";
import {
  ago,
  bandTone,
  dueLabel,
  fmtLong,
  fmtShort,
  greeting,
  homeStats,
  loadBar,
  localDate,
  localTime,
  plural,
  todayItems,
  upNext,
  WHY_TEXT,
} from "@/lib/modules/home/logic";
import { HomeRolePanels } from "@/features/platform-p2/components/server";
import { DeptSelect, MarkAllRead, NewTicketButton } from "./_components/home-controls";

export const metadata = { title: "Home" };

const TAG = { now: ["Now", "text-danger"], soon: ["Soon", "text-warn"], later: ["Later", "text-ink-3"] } as const;

function Due({ due, today }: { due: string | null; today: string }) {
  const d = dueLabel(due, today);
  if (d.tone === "late") return <span className="text-danger">{d.text}</span>;
  if (d.tone === "today") return <strong>{d.text}</strong>;
  if (d.tone === "none") return <span className="muted">{d.text}</span>;
  return <span>{d.text}</span>;
}

const money = (n: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);

const when = (iso: string, today: string) => `${localDate(iso) === today ? "Today" : fmtShort(localDate(iso))}, ${localTime(iso)}`;

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireMe();
  const now = new Date();
  const today = localDate(now);
  const sp = await searchParams;

  // Start every read now. The optional panels (department, finance) stream in under <Suspense>.
  const deptP = loadDept(sp.dept, me.departmentId, today);
  const financeP = can(me, "finance.dashboard.view") ? getFinanceSnapshot(today) : null;
  const ticketsP = getMyTickets(me.id);
  const [tickets, events, clients, updates] = await Promise.all([
    ticketsP,
    getMyEvents(me.id, now),
    getMyClients(me.id, today, now),
    getUpdates(me.id, ticketsP),
  ]);

  const mine = tickets.filter((t) => t.assigneeId === me.id);
  const s = homeStats(mine, today);
  const todayList = todayItems(mine, events, now, today);
  const next = upNext(mine);
  const meetings = events.slice(0, 4);
  const firstName = me.name.split(" ")[0];

  return (
    <div className="page">
      <Card>
        <CardBody className="stack">
          <div className="row between">
            <div>
              <h2 className="m-0 text-[22px]">
                {greeting(Number(localTime(now).slice(0, 2)))}, {firstName}
              </h2>
              <div className="muted">{fmtLong(today)}</div>
            </div>
            <div className="row">
              <NewTicketButton />
              <ButtonLink href="/calendar">New meeting</ButtonLink>
              <ButtonLink href="/time">Log time</ButtonLink>
              <ButtonLink href="/chat" variant="ghost">
                Open chat
              </ButtonLink>
            </div>
          </div>
          <h3 className="mt-2">Today</h3>
          <div className="list">
            {todayList.length ? (
              todayList.map((i, n) => (
                <div key={n} className="item grid! grid-cols-[52px_1fr_auto_auto] gap-3 max-sm:grid-cols-[44px_1fr_auto]">
                  <span className="small num text-ink-2">{i.time}</span>
                  <Link href={i.href} className="min-w-0 truncate">
                    {i.title}
                  </Link>
                  <span className="max-sm:hidden">
                    {i.join ? (
                      <a className="btn sm" href={i.join} target="_blank" rel="noreferrer">
                        Join
                      </a>
                    ) : i.href.startsWith("/t/") ? (
                      <ButtonLink href={i.href} size="sm" variant="ghost">
                        Open
                      </ButtonLink>
                    ) : null}
                  </span>
                  <span className={cn("min-w-10 text-right text-[13px] font-semibold", TAG[i.tag][1])}>{TAG[i.tag][0]}</span>
                </div>
              ))
            ) : (
              <div className="item muted">Nothing due and no meetings left today.</div>
            )}
          </div>
        </CardBody>
      </Card>

      <div className="stats">
        <Link className="stat text-ink hover:no-underline" href="/my">
          <span className="label">My open tickets</span>
          <span className="value num">{s.open}</span>
          <span className="sub">{s.urgent} high or urgent</span>
        </Link>
        <Link className="stat text-ink hover:no-underline" href="/my">
          <span className="label">Overdue</span>
          <span className={cn("value num", s.overdue > 0 && "t-danger")}>{s.overdue}</span>
          <span className="sub">{s.overdue ? `Oldest ${plural(s.oldestLate, "day")} late` : "Nothing late"}</span>
        </Link>
        <Link className="stat text-ink hover:no-underline" href="/my">
          <span className="label">Due today</span>
          <span className="value num">{s.dueToday}</span>
          <span className="sub">{s.dueTodayInProgress} in progress</span>
        </Link>
        <Link className="stat text-ink hover:no-underline" href="/my">
          <span className="label">Blocked</span>
          <span className="value num">{s.blocked}</span>
          <span className="sub">{s.review} in review</span>
        </Link>
      </div>

      <div className="grid-2">
        <Card>
          <CardHead title="Up next for me" actions={<ButtonLink href="/my" size="sm" variant="ghost">My work</ButtonLink>} />
          <CardBody className="list">
            {next.length ? (
              next.map((t) => (
                <Link key={t.id} href={`/t/${t.key}`} className="item between text-ink hover:no-underline">
                  <span className="min-w-0">
                    <span className="muted num">{t.key}</span> {t.title}
                  </span>
                  <span className="row flex-nowrap">
                    <Priority level={t.priority} />
                    <span className="small min-w-[76px] text-right">
                      <Due due={t.due} today={today} />
                    </span>
                  </span>
                </Link>
              ))
            ) : (
              <div className="item muted">No open tickets assigned to you.</div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHead title="Updates on my tickets" actions={<MarkAllRead disabled={!updates.length} />} />
          <CardBody className="list">
            {updates.length ? (
              updates.map((u) => (
                <div key={u.id} className="item grid! grid-cols-[28px_1fr] gap-2.5">
                  <Avatar name={u.actorName} size={28} />
                  <div className="min-w-0">
                    <div>
                      <strong>{u.actorName.split(" ")[0]}</strong> {u.action}{" "}
                      {u.subject ? (u.href ? <Link href={u.href}>{u.subject}</Link> : u.subject) : null} {u.detail}
                    </div>
                    <div className="text-xs text-ink-3">
                      {ago(u.createdAt, now)}
                      {u.why ? ` · ${WHY_TEXT[u.why]}` : ""}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="item muted">You&apos;re all caught up.</div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid-2">
        <Suspense fallback={<SkeletonPanel lines={6} />}>
          <DeptCard data={deptP} />
        </Suspense>

        <Card>
          <CardHead title="Next meetings" actions={<ButtonLink href="/calendar" size="sm" variant="ghost">Calendar</ButtonLink>} />
          <CardBody className="list">
            {meetings.length ? (
              meetings.map((e) => (
                <div key={e.id} className="item between text-ink hover:no-underline">
                  <div className="min-w-0">
                    <div>
                      <Link href="/calendar">{e.title}</Link>
                    </div>
                    <div className="small muted">
                      {when(e.startsAt, today)}–{localTime(e.endsAt)}
                      {e.clientName ? ` · ${e.clientName}` : ""}
                    </div>
                  </div>
                  <span className="row flex-nowrap">
                    <Avatars>
                      {e.attendees.slice(0, 3).map((n) => (
                        <Avatar key={n} name={n} size={24} />
                      ))}
                    </Avatars>
                    {e.meetLink ? (
                      <a className="btn sm" href={e.meetLink} target="_blank" rel="noreferrer">
                        Join
                      </a>
                    ) : null}
                  </span>
                </div>
              ))
            ) : (
              <div className="item muted">No meetings booked.</div>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHead title="My clients" actions={<ButtonLink href="/clients" size="sm" variant="ghost">All clients</ButtonLink>} />
        {clients.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Client</Th>
                <Th>Health</Th>
                <Th>Open tickets</Th>
                <Th>Report sent</Th>
                <Th hideSm>Next meeting</Th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <Td>
                    <Link href={`/clients/${c.id}`}>{c.name}</Link>
                    {c.services.length ? <div className="small muted">{c.services.join(", ")}</div> : null}
                  </Td>
                  <Td>
                    {c.health == null ? (
                      <span className="muted">New</span>
                    ) : (
                      <>
                        <span className="num">{c.health}</span> {c.band ? <StatusDot tone={bandTone(c.band)}>{c.band}</StatusDot> : null}
                      </>
                    )}
                  </Td>
                  <Td num>{c.open}</Td>
                  <Td>
                    <StatusDot tone={c.report.tone}>{c.report.label}</StatusDot>
                  </Td>
                  <Td hideSm>{c.nextMeeting ? when(c.nextMeeting, today) : <span className="muted">None booked</span>}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <CardBody>
            <span className="muted">No clients assigned to you.</span>
          </CardBody>
        )}
      </Card>

      <Suspense
        fallback={
          <div className="grid-2">
            <SkeletonPanel lines={4} />
            <SkeletonPanel lines={4} />
          </div>
        }
      >
        <HomeRolePanels me={me} />
      </Suspense>

      {financeP ? (
        <Suspense fallback={<SkeletonTable rows={3} cols={3} />}>
          <FinanceCard data={financeP} />
        </Suspense>
      ) : null}
    </div>
  );
}

async function loadDept(wanted: string | undefined, mine: string | null, today: string) {
  const departments = await getDepartments();
  const deptId = departments.find((d) => d.id === wanted)?.id ?? mine ?? departments[0]?.id ?? null;
  return { departments, deptId, dept: deptId ? await getDeptPanel(deptId, today) : null };
}

async function DeptCard({ data }: { data: ReturnType<typeof loadDept> }) {
  const { departments, deptId, dept } = await data;
  return (
    <Card>
      <CardHead
        title="Department"
        actions={deptId && departments.length ? <DeptSelect value={deptId} options={departments} /> : null}
      />
      <CardBody>
        {dept ? (
          <>
            <div className="mb-3.5 grid grid-cols-5 gap-2 max-sm:grid-cols-3">
              {(
                [
                  ["Open", dept.open, false],
                  ["Overdue", dept.overdue, true],
                  ["Unassigned", dept.unassigned, false],
                  ["Blocked", dept.blocked, true],
                  ["In review", dept.review, false],
                ] as const
              ).map(([label, v, bad]) => (
                <div key={label} className="rounded-[var(--radius)] bg-surface-2 px-2.5 py-2">
                  <b className={cn("num block text-xl", bad && v > 0 && "text-danger")}>{v}</b>
                  <span className="text-xs text-ink-2">{label}</span>
                </div>
              ))}
            </div>
            <div className="small muted mb-1">Open tickets per person, against weekly capacity</div>
            {dept.load.length ? (
              dept.load.map((p) => {
                const bar = loadBar(p.open, DEFAULT_CAPACITY);
                return (
                  <div key={p.name} className="grid grid-cols-[28px_1fr_2fr_64px] items-center gap-2.5 py-1.5 max-sm:grid-cols-[28px_1fr_1fr_56px]">
                    <Avatar name={p.name} size={28} />
                    <span className="truncate">{p.name}</span>
                    <div className={cn("bar", bar.tone && `t-${bar.tone}`)}>
                      <i style={{ width: `${bar.pct}%` }} />
                    </div>
                    <span className="num small text-right">
                      {p.open} / {DEFAULT_CAPACITY}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="muted small">No one in this department yet.</div>
            )}
          </>
        ) : (
          <div className="muted">No departments yet.</div>
        )}
      </CardBody>
    </Card>
  );
}

async function FinanceCard({ data }: { data: ReturnType<typeof getFinanceSnapshot> }) {
  const finance = await data;
  if (!finance) return null;
  return (
    <Card>
      <CardHead title="Finance snapshot" actions={<ButtonLink href="/finance/invoices" size="sm" variant="ghost">Invoices</ButtonLink>} />
      {finance.length ? (
        <Table>
          <thead>
            <tr>
              <Th>Currency</Th>
              <Th right>Outstanding</Th>
              <Th right>Overdue</Th>
            </tr>
          </thead>
          <tbody>
            {finance.map((f) => (
              <tr key={f.currency}>
                <Td>{f.currency}</Td>
                <Td right num>
                  {money(f.outstanding, f.currency)}
                </Td>
                <Td right num className={f.overdue > 0 ? "text-danger" : undefined}>
                  {money(f.overdue, f.currency)}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <CardBody>
          <span className="muted">No unpaid invoices.</span>
        </CardBody>
      )}
    </Card>
  );
}

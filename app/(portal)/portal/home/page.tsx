import Link from "next/link";
import type { ReactNode } from "react";
import { Activity, CalendarDays, CalendarPlus, ClipboardCheck, FileText, FolderOpen, ListChecks, Users } from "lucide-react";
import { can } from "@/lib/auth/can";
import { Avatar, ButtonLink, Card, CardBody, CardHead, StatusDot } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import {
  countOpenTickets,
  countSharedFiles,
  countWaitingApprovals,
  latestReport,
  listActivity,
  listClientTickets,
  listTeam,
  listUpcomingMeetings,
  portalContext,
} from "@/lib/modules/portal/queries";
import {
  commitmentState,
  daysBetween,
  dubaiHour,
  dubaiToday,
  fmtDate,
  fmtDay,
  fmtDayTime,
  fmtWhen,
  greetName,
  greeting,
  meetHref,
} from "@/lib/modules/portal/logic";
import { NoClient } from "../../_components/page-head";
import s from "../portal.module.css";

export const metadata = { title: "Home" };

const RESULTS = ["Leads", "Cost per lead", "Spend", "Clicks"];

/** Soft empty state: icon, one line, at most one action. */
function Blank({ icon, children, action }: { icon: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <div className={s.blank}>
      <span className={s.blankIcon} aria-hidden>
        {icon}
      </span>
      <p>{children}</p>
      {action}
    </div>
  );
}

/** "Today", "Tomorrow" or "In 3 days", by Dubai dates. */
function inDays(today: string, iso: string): string {
  const d = daysBetween(today, dubaiToday(new Date(iso)));
  return d <= 0 ? "Today" : d === 1 ? "Tomorrow" : `In ${d} days`;
}

export default async function PortalHome() {
  const { me, client, preview } = await portalContext();
  if (!client) return <NoClient />;

  const now = new Date();
  const today = dubaiToday(now);
  const mayApprove = can(me, "portal.approve") || me.kind === "staff";
  const [waiting, openCount, fileCount, open, done, meetings, report, activity, team] = await Promise.all([
    mayApprove ? countWaitingApprovals(client.id) : Promise.resolve(0),
    countOpenTickets(client.id),
    countSharedFiles(client.id),
    listClientTickets(client.id, false, 5),
    listClientTickets(client.id, true, 2),
    listUpcomingMeetings(client.id, now.toISOString(), 1),
    latestReport(client.id),
    listActivity(client.id, 5),
    listTeam(client.id),
  ]);
  if (me.kind === "client" && !preview) await (await createClient()).rpc("portal_touch");

  const commitments = [...open.filter((t) => t.dueDate), ...done].slice(0, 5);
  const doneCount = commitments.filter((t) => t.status === "done").length;
  const next = meetings[0];
  const join = next ? meetHref(next.meetLink) : null;
  const dateLine = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", weekday: "long", day: "numeric", month: "long" }).format(now);
  const tiles = [
    { href: "/portal/work", icon: <ListChecks />, value: openCount, label: "Work in progress", hot: false },
    { href: "/portal/work", icon: <ClipboardCheck />, value: waiting, label: "Waiting for your approval", hot: waiting > 0 },
    { href: "/portal/meetings", icon: <CalendarDays />, value: next ? inDays(today, next.startsAt) : "None booked", label: "Next meeting", hot: false },
    { href: "/portal/files", icon: <FolderOpen />, value: fileCount, label: "Files shared", hot: false },
  ];

  return (
    <div className="page">
      <div className={s.welcome}>
        <div className={s.greet}>
          <h1>
            {greeting(dubaiHour(now))}, {greetName(me.name, client.name)}
          </h1>
          <p>{client.welcome || `Here is how ${client.name} is doing this month.`}</p>
        </div>
        <time className={s.today} dateTime={today}>
          {dateLine}
        </time>
      </div>

      <div className={s.kpis}>
        {tiles.map((t) => (
          <Link key={t.label} href={t.href} className={t.hot ? `${s.kpi} ${s.hot}` : s.kpi}>
            <span className={s.kpiIcon} aria-hidden>
              {t.icon}
            </span>
            <span className={s.kpiValue}>{t.value}</span>
            <span className={s.kpiLabel}>{t.label}</span>
          </Link>
        ))}
      </div>

      <Card>
        <CardHead title="Results this month" />
        <CardBody className="stack" style={{ gap: 12 }}>
          <div className={s.metrics}>
            {RESULTS.map((m) => (
              <div key={m} className={s.metric}>
                <span>{m}</span>
                <b>—</b>
              </div>
            ))}
          </div>
          <p className="muted small" style={{ margin: 0 }}>
            Shows once your ad accounts are connected.
          </p>
        </CardBody>
      </Card>

      <div className="grid-2">
        <Card>
          <CardHead title="Our commitments to you" />
          <CardBody>
            {commitments.length ? (
              <>
                <div className={s.progress}>
                  <span>
                    <b>{doneCount}</b> of {commitments.length} done
                  </span>
                  <div
                    className="bar t-ok"
                    role="progressbar"
                    aria-label="Commitments done"
                    aria-valuemin={0}
                    aria-valuemax={commitments.length}
                    aria-valuenow={doneCount}
                  >
                    <i style={{ width: `${(doneCount / commitments.length) * 100}%` }} />
                  </div>
                </div>
                {commitments.map((t) => {
                  const st = commitmentState({ status: t.status, due_date: t.dueDate }, today);
                  return (
                    <div key={t.id} className={s.commit}>
                      <span>
                        {t.title}
                        {t.dueDate && t.status !== "done" ? ` by ${fmtDate(t.dueDate)}` : ""}
                      </span>
                      <StatusDot tone={st.tone}>{st.label}</StatusDot>
                    </div>
                  );
                })}
              </>
            ) : (
              <Blank icon={<ListChecks />}>Dated work we commit to will show here.</Blank>
            )}
          </CardBody>
        </Card>

        <div className="stack" style={{ gap: 20 }}>
          <Card>
            <CardHead title="Next meeting" />
            <CardBody className="stack">
              {next ? (
                <>
                  <div className={s.when}>{fmtWhen(next.startsAt)}</div>
                  <div className="muted">
                    {next.title}
                    {next.with.length ? ` with ${next.with.join(", ")}` : ""}
                  </div>
                  <div className="row">
                    {join ? (
                      <a className="btn primary" href={join} target="_blank" rel="noopener noreferrer">
                        Join
                      </a>
                    ) : null}
                    <ButtonLink variant="ghost" href="/portal/meetings">
                      All meetings
                    </ButtonLink>
                  </div>
                </>
              ) : (
                <Blank icon={<CalendarPlus />} action={<ButtonLink href="/portal/meetings">Book a meeting</ButtonLink>}>
                  Pick a time to catch up with your team.
                </Blank>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHead title="Latest report" />
            <CardBody className={report ? "row between" : undefined}>
              {report ? (
                <>
                  <div>
                    <b>{report.name.replace(/\.[^.]+$/, "")}</b>
                    <div className="muted small">Shared {fmtDay(report.date)}</div>
                  </div>
                  {report.versionId ? (
                    <a className="btn" href={`/portal/files/download/${report.versionId}`}>
                      View report
                    </a>
                  ) : null}
                </>
              ) : (
                <Blank icon={<FileText />}>Your first report will show here.</Blank>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="grid-2">
        <Card>
          <CardHead title="Recent activity" />
          <CardBody>
            {activity.length ? (
              <div className="list">
                {activity.map((a) => (
                  <div key={a.id} className="item row" style={{ flexWrap: "nowrap" }}>
                    <Avatar name={a.actorName} size={28} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <b>{a.actorName}</b> {a.href ? <Link href={a.href}>{a.action}</Link> : a.action}
                      <div className="muted small">{fmtDayTime(a.happenedAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Blank icon={<Activity />}>Updates from your team will show here.</Blank>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHead title="Your team" />
          <CardBody>
            {team.length ? (
              <div className="list">
                {team.map((t) => (
                  <div key={t.id} className="item row between">
                    <div className="row" style={{ flexWrap: "nowrap" }}>
                      <Avatar name={t.name} size={36} />
                      <div>
                        <b>{t.name}</b>
                        <div className="muted small">{t.title}</div>
                      </div>
                    </div>
                    {can(me, "chat.use") ? (
                      <ButtonLink size="sm" href="/portal/messages">
                        Message
                      </ButtonLink>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <Blank icon={<Users />}>Your team will show here once it is assigned.</Blank>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

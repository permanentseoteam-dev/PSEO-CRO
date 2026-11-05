import Link from "next/link";
import { can } from "@/lib/auth/can";
import { Avatar, ButtonLink, Card, CardBody, CardHead, EmptyState, PhaseTwo, StatusDot } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import {
  countWaitingApprovals,
  latestReport,
  listActivity,
  listClientTickets,
  listTeam,
  listUpcomingMeetings,
  portalContext,
} from "@/lib/modules/portal/queries";
import { commitmentState, dubaiHour, dubaiToday, firstName, fmtDate, fmtDay, fmtDayTime, fmtWhen, greeting, meetHref } from "@/lib/modules/portal/logic";
import { NoClient } from "../../_components/page-head";
import s from "../portal.module.css";

export const metadata = { title: "Home" };

export default async function PortalHome() {
  const { me, client, preview } = await portalContext();
  if (!client) return <NoClient />;

  const now = new Date();
  const today = dubaiToday(now);
  const mayApprove = can(me, "portal.approve") || me.kind === "staff";
  const [waiting, open, done, meetings, report, activity, team] = await Promise.all([
    mayApprove ? countWaitingApprovals(client.id) : Promise.resolve(0),
    listClientTickets(client.id, false, 5),
    listClientTickets(client.id, true, 2),
    listUpcomingMeetings(client.id, now.toISOString(), 1),
    latestReport(client.id),
    listActivity(client.id, 5),
    listTeam(client.id),
  ]);
  if (me.kind === "client" && !preview) await (await createClient()).rpc("portal_touch");

  const commitments = [...open.filter((t) => t.dueDate), ...done].slice(0, 5);
  const next = meetings[0];
  const join = next ? meetHref(next.meetLink) : null;

  return (
    <div className="page">
      <div className={s.greet}>
        <h1>
          {greeting(dubaiHour(now))}, {firstName(me.name)}
        </h1>
        <p>{client.welcome || `Here is how ${client.name} is doing this month.`}</p>
      </div>

      {waiting > 0 ? (
        <Link className={s.await} href="/portal/work">
          Waiting for your approval <b>({waiting})</b>
          <span className="muted">Review now</span>
        </Link>
      ) : null}

      <Card>
        <CardHead
          title={
            <>
              Results this month <PhaseTwo />
            </>
          }
        />
        <CardBody>
          <p className="muted" style={{ margin: 0 }}>
            Leads, cost per lead, spend and clicks show here once your ad accounts are connected.
          </p>
        </CardBody>
      </Card>

      <div className="grid-2">
        <Card>
          <CardHead title="Our commitments to you" />
          <CardBody>
            {commitments.length ? (
              commitments.map((t) => {
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
              })
            ) : (
              <p className="muted" style={{ margin: 0 }}>No dated work yet.</p>
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
                <>
                  <p className="muted" style={{ margin: 0 }}>No meeting booked.</p>
                  <div className="row">
                    <ButtonLink href="/portal/meetings">Book a meeting</ButtonLink>
                  </div>
                </>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHead title="Latest report" />
            <CardBody className="row between">
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
                <p className="muted" style={{ margin: 0 }}>Your first report will show here.</p>
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
              <EmptyState title="Nothing yet">Updates from your team show here.</EmptyState>
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
              <p className="muted" style={{ margin: 0 }}>Your team will show here.</p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

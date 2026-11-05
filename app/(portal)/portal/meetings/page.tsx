import { Avatar, Avatars, Card, CardBody, CardHead, EmptyState } from "@/components/ui";
import { listPastMeetings, listTeam, listUpcomingMeetings, portalContext } from "@/lib/modules/portal/queries";
import { dubaiToday, fmtWhen, meetHref } from "@/lib/modules/portal/logic";
import { NoClient, PageHead } from "../../_components/page-head";
import { BookMeeting } from "./_components/book-meeting";
import { TodoCheck } from "./_components/todo-check";
import s from "../portal.module.css";

export const metadata = { title: "Meetings" };

export default async function PortalMeetings() {
  const { me, client, preview } = await portalContext();
  if (!client) return <NoClient />;
  const isClient = me.kind === "client";

  const [upcoming, past, team] = await Promise.all([
    listUpcomingMeetings(client.id, new Date().toISOString(), 10),
    listPastMeetings(client.id),
    listTeam(client.id),
  ]);

  return (
    <div className="page">
      <PageHead
        title="Meetings"
        sub="Upcoming calls and what we agreed in past ones."
        actions={isClient ? <BookMeeting team={team.map((t) => t.name)} today={dubaiToday(new Date())} readOnly={!!preview} /> : null}
      />

      <Card>
        <CardHead title="Upcoming" />
        <CardBody>
          {upcoming.length ? (
            <div className="list">
              {upcoming.map((u) => {
                const join = meetHref(u.meetLink);
                return (
                  <div key={u.id} className="item row between">
                    <div>
                      <b>{u.title}</b>
                      <div className="muted small">
                        {fmtWhen(u.startsAt)} · {u.minutes} min{u.with.length ? ` · with ${u.with.join(", ")}` : ""}
                      </div>
                    </div>
                    {join ? (
                      <a className="btn primary sm" href={join} target="_blank" rel="noopener noreferrer">
                        Join
                      </a>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="muted" style={{ margin: 0 }}>No meetings booked.</p>
          )}
        </CardBody>
      </Card>

      <h2 style={{ margin: 0, fontSize: 18 }}>Past meetings</h2>
      {past.length ? (
        <div className="grid-2">
          {past.map((m) => (
            <Card key={m.id}>
              <CardHead title={m.title} actions={<span className="muted small">{fmtWhen(m.heldAt)}</span>} />
              <CardBody className="stack" style={{ gap: 12 }}>
                {m.people.length ? (
                  <Avatars>
                    {m.people.map((p) => (
                      <Avatar key={p} name={p} size={26} />
                    ))}
                  </Avatars>
                ) : null}
                {m.summary ? <p className={s.notes}>{m.summary}</p> : null}
                {m.decisions.length ? (
                  <div>
                    <b>Decisions</b>
                    <ul className={s.dec}>
                      {m.decisions.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {m.todos.length ? (
                  <div className="stack">
                    <b>Your to-dos</b>
                    {m.todos.map((t) => (
                      <TodoCheck key={t.id} id={t.id} title={t.title} done={t.done} disabled={!isClient || !!preview} />
                    ))}
                  </div>
                ) : null}
              </CardBody>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="No meeting notes yet">Notes and decisions from your calls show here.</EmptyState>
      )}
    </div>
  );
}

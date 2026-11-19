import { StatusDot } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { listClientTickets, portalContext } from "@/lib/modules/portal/queries";
import { clientStatus, dubaiHour, dubaiToday, fmtDate, greetName, greeting, groupTasks } from "@/lib/modules/portal/logic";
import { STATUS_LABEL } from "@/lib/modules/tickets/logic";
import type { ClientTicket } from "@/lib/modules/portal/types";
import { NoClient } from "../../_components/page-head";
import s from "../portal.module.css";

export const metadata = { title: "Dashboard" };

function Column({ title, tasks, empty }: { title: string; tasks: ClientTicket[]; empty: string }) {
  return (
    <section className={s.taskCol} aria-label={title}>
      <h2>
        {title} <span>{tasks.length}</span>
      </h2>
      {tasks.length ? (
        <ul>
          {tasks.map((t) => (
            <li key={t.id} className={s.task}>
              <b title={t.title}>{t.title}</b>
              <div className={s.taskMeta}>
                <StatusDot tone={clientStatus(t.status).tone}>{STATUS_LABEL[t.status]}</StatusDot>
                {t.dueDate ? <span>Due {fmtDate(t.dueDate)}</span> : null}
                {t.assignee ? <span className={s.taskWho}>{t.assignee}</span> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className={s.taskEmpty}>{empty}</p>
      )}
    </section>
  );
}

export default async function PortalHome() {
  const { me, client, preview } = await portalContext();
  if (!client) return <NoClient />;

  const now = new Date();
  const today = dubaiToday(now);
  const open = await listClientTickets(client.id, false, 1000);
  if (me.kind === "client" && !preview) await (await createClient()).rpc("portal_touch");

  const { current, todo, processing } = groupTasks(open);
  const dateLine = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", weekday: "long", day: "numeric", month: "long" }).format(now);

  return (
    <div className="page">
      <div className={s.welcome}>
        <div className={s.greet}>
          <h1>
            {greeting(dubaiHour(now))}, {greetName(me.name, client.name)}
          </h1>
          <p>{client.welcome || `Here are the tasks we are working on for ${client.name}.`}</p>
        </div>
        <time className={s.today} dateTime={today}>
          {dateLine}
        </time>
      </div>

      <div className={s.taskCols}>
        <Column title="Current" tasks={current} empty="No open tasks right now." />
        <Column title="To-do" tasks={todo} empty="Nothing waiting to start." />
        <Column title="Processing" tasks={processing} empty="Nothing being worked on right now." />
      </div>
    </div>
  );
}

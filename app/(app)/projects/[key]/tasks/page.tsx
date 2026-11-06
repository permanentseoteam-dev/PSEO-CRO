import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { requireMe, can } from "@/lib/auth/can";
import { NoAccess } from "@/components/ui";
import { getTicket, listPeople } from "@/lib/modules/tickets/queries";
import { markRead } from "@/lib/modules/tickets/actions";
import { todayIn } from "@/lib/modules/tickets/logic";
import { getProjectSpace, listProjectTasks } from "@/lib/modules/work/space";
import { TicketTitle } from "../../../t/[key]/_components/header";
import { Description } from "../../../t/[key]/_components/description";
import { Subtasks } from "../../../t/[key]/_components/subtasks";
import { Files } from "../../../t/[key]/_components/files";
import { Activity } from "../../../t/[key]/_components/activity";
import { SidePanel } from "../../../t/[key]/_components/side-panel";
import { TasksView } from "./_components/tasks-view";
import { TaskDrawer } from "./_components/task-drawer";
import { TypeField } from "./_components/type-field";
import { SoftActions } from "./_components/soft-actions";
import s from "./tasks.module.css";

type Props = {
  params: Promise<{ key: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ProjectTasksPage({ params, searchParams }: Props) {
  const me = await requireMe();
  if (me.kind !== "staff" || !can(me, "tickets.view")) return <NoAccess />;
  const [{ key }, sp] = await Promise.all([params, searchParams]);
  const space = await getProjectSpace(decodeURIComponent(key));
  if (!space) notFound();

  const view = sp.view === "kanban" ? "kanban" : "table";
  const taskKey = typeof sp.task === "string" && /^[A-Za-z]{2,8}-\d{1,7}$/.test(sp.task) ? sp.task.toUpperCase() : null;

  const [tasks, t, people] = await Promise.all([
    listProjectTasks(space.id),
    taskKey ? getTicket(taskKey, me) : null,
    taskKey ? listPeople() : [],
  ]);
  if (t) await markRead(t.id);
  const today = todayIn();

  return (
    <>
      <TasksView projectId={space.id} tasks={tasks} config={space.config} view={view} today={today} />
      {taskKey ? (
        <TaskDrawer
          view={view}
          crumb={
            <>
              <span>{space.name}</span> / <span>{t?.key ?? taskKey}</span>
              {t ? (
                <Link href={`/t/${t.key}`} className={s.fullLink} title="Open full page" aria-label="Open full page">
                  <ExternalLink size={16} aria-hidden="true" />
                </Link>
              ) : null}
            </>
          }
          left={
            t ? (
              <div className="stack" style={{ gap: 16 }}>
                <TicketTitle id={t.id} title={t.title} canEdit={t.canEdit} />
                <div id="tp-props">
                <SidePanel
                  t={t}
                  people={people}
                  today={today}
                  typeField={<TypeField ticketId={t.id} typeId={t.typeId} types={space.config.taskTypes} canEdit={t.canEdit} />}
                  shortcutActions={<SoftActions canEdit={t.canEdit} hasSubtasks={!t.parent} />}
                />
                </div>
                <Description id={t.id} description={t.description} doneWhen={t.doneWhen} canEdit={t.canEdit} />
                {!t.parent ? (
                  <div id="tp-subtasks">
                    <Subtasks key={t.id} parentId={t.id} items={t.subtasks} people={people} canEdit={t.canEdit} defaultAssigneeId={t.project?.createdBy} />
                  </div>
                ) : null}
                <div id="tp-files">
                  <Files ticketId={t.id} files={t.attachments} canDelete={t.canEdit} />
                </div>
              </div>
            ) : (
              <p className="muted">This task wasn&apos;t found, or you don&apos;t have access to it.</p>
            )
          }
          right={
            t ? (
              <Activity
                ticketId={t.id}
                comments={t.comments}
                history={t.history}
                names={Object.fromEntries(people.map((p) => [p.id, p.name]))}
                meId={me.id}
                canModerate={t.canModerate}
              />
            ) : null
          }
        />
      ) : null}
    </>
  );
}

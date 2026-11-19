import Link from "next/link";
import { notFound } from "next/navigation";
import { PageTitle } from "@/components/shell/page-title";
import { requireMe, can } from "@/lib/auth/can";
import { createClient } from "@/lib/supabase/server";
import { EmptyState, NoAccess } from "@/components/ui";
import { getTicket, listPeople, listProjects } from "@/lib/modules/tickets/queries";
import { markRead } from "@/lib/modules/tickets/actions";
import { TASK_TYPES } from "@/lib/modules/work/space-logic";
import { TypeField } from "../../../projects/[key]/tasks/_components/type-field";
import { SoftActions } from "../../../projects/[key]/tasks/_components/soft-actions";
import { todayIn } from "@/lib/modules/tickets/logic";
import { HeaderActions, TicketTitle } from "./header";
import { Description } from "./description";
import { Subtasks } from "./subtasks";
import { Files } from "./files";
import { Activity } from "./activity";
import { SidePanel } from "./side-panel";
import s from "./ticket.module.css";

/** Task detail body, shared by the full page /t/KEY and the pop-up opened over the board. */
export async function TicketView({ ticketKey }: { ticketKey: string }) {
  const me = await requireMe();
  if (me.kind !== "staff" || !can(me, "tickets.view")) return <NoAccess />;
  if (!/^[A-Za-z]{2,8}-\d{1,7}$/.test(ticketKey)) notFound();

  const [t, people, projects] = await Promise.all([getTicket(ticketKey, me), listPeople(), listProjects()]);
  if (!t) {
    return (
      <div className="page">
        <EmptyState
          title="Task not found"
          action={<Link className="btn" href="/tickets">Back to tasks</Link>}
        >
          It may have been deleted, or you don&apos;t have access to it.
        </EmptyState>
      </div>
    );
  }
  // Client-facing controls only make sense when the task has a client.
  const [, own] = await Promise.all([markRead(t.id), (await createClient()).from("tickets").select("client_id").eq("id", t.id).maybeSingle()]);
  const hasClient = Boolean(own.data?.client_id);
  const today = todayIn();
  const names = Object.fromEntries(people.map((p) => [p.id, p.name]));

  return (
    <div className="page">
      <PageTitle title={t.key} />
      <nav className={s.crumb} aria-label="Breadcrumb">
        <Link href="/tickets">Task</Link> /
        {t.project ? <><Link href={`/tickets?proj=${t.project.id}`}>{t.project.name}</Link> /</> : null}
        {t.parent ? <><Link href={`/t/${t.parent.key}`}>{t.parent.key}</Link> /</> : null}
        <span>{t.key}</span>
      </nav>

      <div className={s.headRow}>
        <TicketTitle id={t.id} title={t.title} canEdit={t.canEdit} />
        <HeaderActions
          id={t.id}
          ticketKey={t.key}
          title={t.title}
          projectId={t.projectId}
          projects={projects}
          watching={t.watching}
          canEdit={t.canEdit}
          canDelete={t.canDelete}
          assigneeId={t.assigneeId}
          priority={t.priority}
          today={today}
          canRepeat={t.canEdit && can(me, "work.recurring.manage")}
          fileCount={t.attachments.length}
          commentCount={t.comments.length}
        />
      </div>
      <div className={s.split}>
        <div className="stack" style={{ gap: 16 }}>
          <Description id={t.id} description={t.description} doneWhen={t.doneWhen} canEdit={t.canEdit} />
          {!t.parent ? <div id="tp-subtasks"><Subtasks key={t.id} parentId={t.id} items={t.subtasks} people={people} canEdit={t.canEdit} defaultAssigneeId={t.project?.createdBy} /></div> : null}
          <div id="tp-files"><Files ticketId={t.id} files={t.attachments} canDelete={t.canEdit} /></div>
          <Activity ticketId={t.id} comments={t.comments} history={t.history} names={names} meId={me.id} canModerate={t.canModerate} hasClient={hasClient} />
        </div>
        <aside className="stack" style={{ gap: 16 }}>
          <SidePanel
            t={t}
            people={people}
            today={today}
            typeField={<TypeField ticketId={t.id} typeId={t.typeId} types={TASK_TYPES} canEdit={t.canEdit} />}
            shortcutActions={<SoftActions canEdit={t.canEdit} hasSubtasks={!t.parent} />}
          />
        </aside>
      </div>
    </div>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMe, can } from "@/lib/auth/can";
import { EmptyState, NoAccess, Priority, TicketStatusDot } from "@/components/ui";
import { getTicket, listPeople, listProjects } from "@/lib/modules/tickets/queries";
import { markRead } from "@/lib/modules/tickets/actions";
import { todayIn } from "@/lib/modules/tickets/logic";
import { TicketClientCard, TicketDependencies, TicketPeopleFields, TicketScopeCard } from "@/features/work-p2";
import { DueLabel } from "../../tickets/_components/bits";
import { HeaderActions, TicketTitle } from "./_components/header";
import { Description } from "./_components/description";
import { Checklist } from "./_components/checklist";
import { Subtasks } from "./_components/subtasks";
import { Review } from "./_components/review";
import { Files } from "./_components/files";
import { Activity } from "./_components/activity";
import { SidePanel } from "./_components/side-panel";
import s from "./_components/ticket.module.css";

type Params = { params: Promise<{ key: string }> };

export async function generateMetadata({ params }: Params) {
  const { key } = await params;
  return { title: decodeURIComponent(key).toUpperCase() };
}

export default async function TicketPage({ params }: Params) {
  const me = await requireMe();
  if (me.kind !== "staff" || !can(me, "tickets.view")) return <NoAccess />;
  const { key } = await params;
  if (!/^[A-Za-z]{2,8}-\d{1,7}$/.test(decodeURIComponent(key))) notFound();

  const [t, people, projects] = await Promise.all([getTicket(decodeURIComponent(key), me), listPeople(), listProjects()]);
  if (!t) {
    return (
      <div className="page">
        <EmptyState
          title="Ticket not found"
          action={<Link className="btn" href="/tickets">Back to tickets</Link>}
        >
          It may have been deleted, or you don&apos;t have access to it.
        </EmptyState>
      </div>
    );
  }
  await markRead(t.id);
  const today = todayIn();
  const names = Object.fromEntries(people.map((p) => [p.id, p.name]));

  return (
    <div className="page">
      <nav className={s.crumb} aria-label="Breadcrumb">
        <Link href="/tickets">Tickets</Link> /
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
      <div className="row small">
        <TicketStatusDot status={t.status} />
        <Priority level={t.priority} />
        <span className="muted">Due</span> <DueLabel due={t.due} status={t.status} today={today} />
        {t.rounds.length ? <span className="muted">· {t.rounds.length} {t.rounds.length === 1 ? "revision" : "revisions"}</span> : null}
      </div>

      <div className={s.split}>
        <div className="stack" style={{ gap: 16 }}>
          <Description id={t.id} description={t.description} doneWhen={t.doneWhen} canEdit={t.canEdit} />
          <Checklist ticketId={t.id} items={t.checklist} canEdit={t.canEdit} />
          {!t.parent ? <Subtasks parentId={t.id} items={t.subtasks} people={people} canEdit={t.canEdit} /> : null}
          <TicketDependencies ticketId={t.id} />
          <Review
            ticketId={t.id}
            status={t.status}
            round={t.reviewRound}
            rounds={t.rounds}
            reviewerId={t.reviewerId}
            meId={me.id}
            people={people}
            canEdit={t.canEdit}
            canModerate={t.canModerate}
          />
          <TicketClientCard ticketId={t.id} />
          <Files ticketId={t.id} files={t.attachments} canDelete={t.canEdit} />
          <Activity ticketId={t.id} comments={t.comments} history={t.history} names={names} meId={me.id} canModerate={t.canModerate} />
        </div>
        <aside className="stack" style={{ gap: 16 }}>
          <SidePanel t={t} people={people} projects={projects} today={today} peopleFields={<TicketPeopleFields ticketId={t.id} />} />
          <TicketScopeCard ticketId={t.id} />
        </aside>
      </div>
    </div>
  );
}

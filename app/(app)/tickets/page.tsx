import Link from "next/link";
import { Plus } from "lucide-react";
import { requireMe, can } from "@/lib/auth/can";
import { ButtonLink, NoAccess, Seg, Tabs } from "@/components/ui";
import { WorkloadView } from "@/features/work-p2";
import {
  byStatusTab, dueBucket, filterTickets, groupTickets, parseFilters, sortTickets, STATUSES, STATUS_LABEL, statusCounts, toQuery, todayIn,
} from "@/lib/modules/tickets/logic";
import { listPeople, listProjects, listSavedViews, listTemplates, listTickets, myTeamIds } from "@/lib/modules/tickets/queries";
import type { Filters, StatusTab } from "@/lib/modules/tickets/types";
import { TicketFilters } from "./_components/filters";
import { TicketList } from "./_components/ticket-list";
import { TicketBoard } from "./_components/ticket-board";
import { NewTicketButton } from "./_components/new-ticket";
import { TaskToolbar } from "./_components/toolbar";
import s from "./_components/tickets.module.css";

export const metadata = { title: "Task" };

export default async function TicketsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireMe();
  if (me.kind !== "staff" || !can(me, "tickets.view")) return <NoAccess />;

  const today = todayIn();
  const sp = await searchParams;
  const parsed = parseFilters(sp, today);
  // Calendar view is hidden for now: an old ?view=cal link shows the list.
  const f: Filters = parsed.view === "cal" ? { ...parsed, view: "list" } : parsed;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
  const canWorkload = can(me, "work.workload.view");
  const workload = canWorkload && one(sp.view) === "workload";
  const [all, people, projects, teamIds, views, templates] = await Promise.all([
    listTickets(f.view === "board"),
    listPeople(),
    listProjects(),
    myTeamIds(me),
    listSavedViews(me.id),
    listTemplates(),
  ]);

  const names = Object.fromEntries(people.map((p) => [p.id, p.name]));
  const projectNames = Object.fromEntries(projects.map((p) => [p.id, p.name]));
  const tags = [...new Set(all.flatMap((t) => t.tags))].sort();
  const filtered = filterTickets(all, f, { meId: me.id, teamIds, today });
  const counts = statusCounts(filtered);
  const overdue = filtered.filter((t) => dueBucket(t.due, t.status, today) === "overdue").length;
  const dueToday = filtered.filter((t) => t.status !== "done" && t.due === today).length;
  const inTab = sortTickets(byStatusTab(filtered, f.st), f.sort);
  const canEdit = can(me, "tickets.manage");
  const filtersActive = !!(f.q || f.who || f.pri || f.due || f.tag || f.proj || f.group);
  const colors = Object.fromEntries(projects.map((p) => [p.id, p.color ?? null]));
  const href = (patch: Partial<Filters>) => `/tickets?${toQuery({ ...f, ...patch })}`;

  const tabs: { value: StatusTab; label: string }[] = [{ value: "active", label: "Active" }, ...STATUSES.map((st) => ({ value: st, label: STATUS_LABEL[st] }))];

  return (
    <div className="page">
      <TaskToolbar
        left={
          <>
            {canEdit ? (
              <NewTicketButton
                meId={me.id}
                people={people}
                projects={projects}
                templates={templates}
                today={today}
                defaultProject={f.proj || undefined}
                openOnMount={one(sp.new) === "1"}
                label={<><Plus size={16} aria-hidden="true" /> Add new</>}
              />
            ) : null}
            <Seg
              label="View"
              value={workload ? "workload" : f.view}
              items={[
                { value: "list", label: "Table view", href: href({ view: "list" }) },
                { value: "board", label: "Kanban board", href: href({ view: "board" }) },
                ...(canWorkload ? [{ value: "workload", label: "Workload", href: "/tickets?view=workload" }] : []),
              ]}
            />
          </>
        }
        right={<ButtonLink href="/tickets/recurring">Recurring</ButtonLink>}
        panel={workload ? null : <TicketFilters filters={f} people={people} projects={projects} tags={tags} views={views} canShare={!!me.departmentId} />}
        filters={f}
        people={people}
        active={filtersActive}
      />

      {!workload ? (
        <div className={s.stats}>
          {[
            { label: "Open", value: counts.active, href: href({ view: "list", st: "active" }) },
            { label: "Overdue", value: overdue, href: href({ due: "overdue" }), danger: overdue > 0 },
            { label: "Due today", value: dueToday, href: href({ due: "today" }) },
            { label: "Blocked", value: counts.blocked, href: href({ view: "list", st: "blocked" }) },
            { label: "In review", value: counts.in_review, href: href({ view: "list", st: "in_review" }) },
          ].map((x) => (
            <Link key={x.label} className={s.stat} href={x.href}>
              <span className={s.statLabel}>{x.label}</span>
              <span className={x.danger ? `${s.statValue} ${s.danger}` : s.statValue}>{x.value}</span>
            </Link>
          ))}
        </div>
      ) : null}

      {workload ? <WorkloadView week={one(sp.week)} dept={one(sp.dept)} basePath="/tickets?view=workload" /> : null}

      {!workload && f.view !== "board" ? (
        <Tabs
          label="Status"
          value={f.st}
          items={tabs.map((t) => ({ value: t.value, label: t.label, count: counts[t.value], href: href({ st: t.value }) }))}
        />
      ) : null}

      {!workload && f.view === "list" ? (
        <TicketList
          groups={groupTickets(inTab, f.group, { people: names, projects: projectNames, today })}
          names={names}
          people={people}
          projects={projects}
          today={today}
          canEdit={canEdit}
          clearHref="/tickets"
        />
      ) : null}
      {!workload && f.view === "board" ? <TicketBoard rows={sortTickets(filtered, f.sort)} names={names} colors={colors} today={today} canEdit={canEdit} defaultProject={f.proj || undefined} clearHref="/tickets" /> : null}
    </div>
  );
}

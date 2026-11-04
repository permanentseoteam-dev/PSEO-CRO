import { requireMe, can } from "@/lib/auth/can";
import { NoAccess, Seg, Tabs } from "@/components/ui";
import {
  byStatusTab, filterTickets, groupTickets, parseFilters, shiftMonth, sortTickets, STATUSES, STATUS_LABEL, statusCounts, toQuery, todayIn,
} from "@/lib/modules/tickets/logic";
import { listPeople, listProjects, listSavedViews, listTemplates, listTickets, myTeamIds } from "@/lib/modules/tickets/queries";
import type { Filters, StatusTab } from "@/lib/modules/tickets/types";
import { TicketFilters } from "./_components/filters";
import { TicketList } from "./_components/ticket-list";
import { TicketBoard } from "./_components/ticket-board";
import { TicketCalendar } from "./_components/ticket-calendar";
import { NewTicketButton } from "./_components/new-ticket";
import s from "./_components/tickets.module.css";

export const metadata = { title: "Tickets" };

export default async function TicketsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireMe();
  if (me.kind !== "staff" || !can(me, "tickets.view")) return <NoAccess />;

  const today = todayIn();
  const f = parseFilters(await searchParams, today);
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
  const inTab = sortTickets(byStatusTab(filtered, f.st), f.sort);
  const canEdit = can(me, "tickets.manage");
  const href = (patch: Partial<Filters>) => `/tickets?${toQuery({ ...f, ...patch })}`;

  const tabs: { value: StatusTab; label: string }[] = [{ value: "active", label: "Active" }, ...STATUSES.map((st) => ({ value: st, label: STATUS_LABEL[st] }))];

  return (
    <div className="page">
      <div className={s.headRow}>
        <Seg
          label="View"
          value={f.view}
          items={[
            { value: "list", label: "List", href: href({ view: "list" }) },
            { value: "board", label: "Board", href: href({ view: "board" }) },
            { value: "cal", label: "Calendar", href: href({ view: "cal" }) },
          ]}
        />
        {canEdit ? (
          <NewTicketButton
            meId={me.id}
            people={people}
            projects={projects}
            templates={templates}
            today={today}
            defaultProject={f.proj || undefined}
          />
        ) : null}
      </div>

      {f.view !== "board" ? (
        <Tabs
          label="Status"
          value={f.st}
          items={tabs.map((t) => ({ value: t.value, label: t.label, count: counts[t.value], href: href({ st: t.value }) }))}
        />
      ) : null}

      <TicketFilters filters={f} people={people} projects={projects} tags={tags} views={views} canShare={!!me.departmentId} />

      {f.view === "list" ? (
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
      {f.view === "board" ? <TicketBoard rows={sortTickets(filtered, f.sort)} names={names} today={today} canEdit={canEdit} /> : null}
      {f.view === "cal" ? (
        <TicketCalendar
          rows={inTab.filter((t) => t.due)}
          month={f.month}
          today={today}
          canEdit={canEdit}
          prevHref={href({ month: shiftMonth(f.month, -1) })}
          nextHref={href({ month: shiftMonth(f.month, 1) })}
          todayHref={href({ month: today.slice(0, 7) })}
        />
      ) : null}
    </div>
  );
}

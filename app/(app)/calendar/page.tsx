import { requireMe, can } from "@/lib/auth/can";
import { NoAccess } from "@/components/ui";
import { listBusy, listClients, listMyEvents, listPeople } from "@/lib/modules/calendar/queries";
import { parseParams, toLocal, viewRange } from "@/lib/modules/calendar/logic";
import { Calendar } from "./_components/calendar";

export const metadata = { title: "Calendar" };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireMe();
  if (!can(me, "calendar.use")) return <NoAccess />;

  const now = toLocal(new Date());
  const { view, cursor, showCol } = parseParams(await searchParams, now.date);
  const { from, to } = viewRange(view, cursor);

  const [clients, people] = await Promise.all([listClients(), listPeople()]);
  const [events, busy] = await Promise.all([
    listMyEvents(me.id, from, to, clients),
    showCol ? listBusy(from, to) : Promise.resolve([]),
  ]);

  return (
    <Calendar
      me={{ id: me.id, name: me.name, perms: me.perms }}
      view={view}
      cursor={cursor}
      showCol={showCol}
      today={now.date}
      nowMin={now.min}
      events={events}
      busy={busy.filter((b) => b.memberId !== me.id)}
      people={people}
      clients={clients}
    />
  );
}

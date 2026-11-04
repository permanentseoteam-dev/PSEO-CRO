import { requireMe, can } from "@/lib/auth/can";
import { NoAccess, StatCard, Stats, Table, Tabs, Td, Th } from "@/components/ui";
import { actionSummary, shortDate, zoneDate } from "@/lib/modules/clientops/logic";
import { getMeetings, listClients } from "@/lib/modules/clientops/queries";
import { MeetingsToolbar } from "./_components/toolbar";
import { ReviewCard } from "./_components/review-card";
import { NoClientRow } from "./_components/no-client-row";

export const metadata = { title: "Meetings" };

const TABS = [
  { value: "review", label: "To review" },
  { value: "recent", label: "Recent calls" },
  { value: "noclient", label: "No client" },
] as const;
type Tab = (typeof TABS)[number]["value"];

const TZ = "Asia/Dubai";

function when(iso: string, durationMin: number | null, now: Date) {
  const d = new Date(iso);
  const day = d.toLocaleDateString("en-GB", { weekday: "short", timeZone: TZ });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ });
  return `${day} ${shortDate(iso, now, TZ)}, ${time}${durationMin ? ` · ${durationMin} min` : ""}`;
}

export default async function MeetingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireMe();
  if (me.kind !== "staff" || !can(me, "clients.view")) return <NoAccess />;

  const sp = await searchParams;
  const mine = sp.mine === "1";
  const tab: Tab = TABS.some((t) => t.value === sp.tab) ? (sp.tab as Tab) : "review";
  const now = new Date();
  const [d, clients] = await Promise.all([getMeetings(me.id, mine, now), listClients()]);
  const href = (t: Tab) => `/meetings?tab=${t}${mine ? "&mine=1" : ""}`;
  const canTicket = can(me, "tickets.manage");

  return (
    <div className="page">
      <div className="between">
        <h1>Meetings</h1>
        <MeetingsToolbar mine={mine} clients={clients} today={zoneDate(now, TZ)} />
      </div>

      <Stats>
        <StatCard label="To review" value={d.toReview.length} sub="Notes waiting" />
        <StatCard label="Calls this week" value={d.stats.callsThisWeek} />
        <StatCard label="Open action items" value={d.stats.openActions} sub={`${d.stats.openTodos} are client to-dos`} />
        <StatCard label="No client yet" value={d.noClient.length} tone={d.noClient.length ? "warn" : undefined} />
        <StatCard label="Tickets from calls, this month" value={d.stats.ticketsThisMonth} />
      </Stats>

      <Tabs
        label="Meetings"
        value={tab}
        items={TABS.map((t) => ({
          value: t.value,
          label: t.label,
          href: href(t.value),
          count: t.value === "review" ? d.toReview.length : t.value === "noclient" ? d.noClient.length : undefined,
        }))}
      />

      {tab === "review" ? (
        d.toReview.length ? (
          <div className="stack" style={{ gap: 16 }}>
            {d.toReview.map((m) => (
              <ReviewCard key={m.id} meeting={m} when={when(m.heldAt, m.durationMin, now)} canTicket={canTicket} />
            ))}
          </div>
        ) : (
          <div className="card">
            <div className="empty">Nothing to review. Log meeting notes after your next call.</div>
          </div>
        )
      ) : null}

      {tab === "recent" ? (
        <Table>
          <thead>
            <tr>
              <Th>Call</Th>
              <Th>Client</Th>
              <Th>When</Th>
              <Th>Action items</Th>
            </tr>
          </thead>
          <tbody>
            {d.recent.length ? (
              d.recent.map((m) => (
                <tr key={m.id}>
                  <Td>
                    <strong>{m.title}</strong>
                  </Td>
                  <Td>{m.clientName}</Td>
                  <Td>{shortDate(m.heldAt, now, TZ)}</Td>
                  <Td>{actionSummary(m.actions.map((a) => a.outcome))}</Td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4}>
                  <div className="empty">No reviewed calls yet.</div>
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      ) : null}

      {tab === "noclient" ? (
        <div className="card">
          {d.noClient.length ? (
            <div className="card-body list">
              {d.noClient.map((m) => (
                <NoClientRow
                  key={m.id}
                  id={m.id}
                  title={m.title}
                  meta={[when(m.heldAt, m.durationMin, now), m.attendeeEmails].filter(Boolean).join(" · ")}
                  clients={clients}
                />
              ))}
            </div>
          ) : (
            <div className="empty">Every call has a client. Nothing to sort.</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

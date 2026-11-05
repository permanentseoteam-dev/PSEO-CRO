import { requireMe, can } from "@/lib/auth/can";
import { Avatar, NoAccess, Seg, StatCard, Stats, StatusDot, Table, Tabs, Td, Th } from "@/components/ui";
import { formatMinutes, KIND_LABEL, parseRange, RANGES, whenLabel } from "@/lib/modules/clientops/logic";
import { getResponseTimes } from "@/lib/modules/clientops/queries";
import { InboxCountsCard } from "@/features/platform-p2/components/server";
import { TargetsButton } from "./_components/targets-dialog";

export const metadata = { title: "Response times" };

const TABS = [
  { value: "wait", label: "Waiting now" },
  { value: "person", label: "By person" },
  { value: "client", label: "By client" },
  { value: "answered", label: "Answered" },
] as const;
type Tab = (typeof TABS)[number]["value"];

const pct = (v: number | null) => (v == null ? "–" : `${v}%`);
const dur = (v: number | null) => (v == null ? "–" : formatMinutes(v));

function Person({ name }: { name: string | null }) {
  if (!name) return <span className="muted">Nobody yet</span>;
  return (
    <span className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
      <Avatar name={name} size={22} />
      {name}
    </span>
  );
}

export default async function ResponseTimesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireMe();
  if (me.kind !== "staff" || !can(me, "clients.view")) return <NoAccess />;

  const sp = await searchParams;
  const range = parseRange(sp.range);
  const tab: Tab = TABS.some((t) => t.value === sp.tab) ? (sp.tab as Tab) : "wait";
  const now = new Date();
  const d = await getResponseTimes(range, now);
  const tz = d.settings.timezone;
  const href = (r: number, t: Tab) => `/response-times?range=${r}&tab=${t}`;

  return (
    <div className="page">
      <div className="between">
        <h1>Response times</h1>
        <div className="row">
          <Seg label="Range" value={String(range)} items={RANGES.map((r) => ({ value: String(r), label: `${r} days`, href: href(r, tab) }))} />
          {can(me, "clients.manage", "all") ? <TargetsButton settings={d.settings} /> : null}
        </div>
      </div>

      <Stats>
        <StatCard
          label="On time"
          value={pct(d.summary.onTimePct)}
          sub={`Target ${d.settings.ontimeGoal}%`}
          tone={d.summary.onTimePct != null && d.summary.onTimePct < d.settings.ontimeGoal ? "warn" : undefined}
        />
        <StatCard label="Typical answer" value={dur(d.summary.typicalMin)} sub="Working hours" />
        <StatCard label="Waiting now" value={d.waitingNow} sub={`${d.late} past target`} />
        <StatCard label="Waiting now late" value={d.late} sub={`${d.past2x} past 2× target`} tone={d.late ? "danger" : undefined} />
        <StatCard label="Answered" value={d.summary.answered} sub="Client waits closed" />
        <StatCard label="Slowest answer" value={dur(d.summary.slowest?.minutes ?? null)} sub={d.summary.slowest?.clientName} tone={d.summary.slowest ? "warn" : undefined} />
      </Stats>

      <Tabs label="Response times" value={tab} items={TABS.map((t) => ({ value: t.value, label: t.label, href: href(range, t.value) }))} />

      {tab === "wait" ? (
        <Table>
          <thead>
            <tr>
              <Th>Client</Th>
              <Th hideSm>From</Th>
              <Th>Kind</Th>
              <Th num>Waiting</Th>
              <Th num hideSm>Target</Th>
              <Th>Needs answer from</Th>
              <Th>State</Th>
            </tr>
          </thead>
          <tbody>
            {d.waiting.length ? (
              d.waiting.map((w) => (
                <tr key={w.id}>
                  <Td>
                    <strong>{w.clientName}</strong>
                  </Td>
                  <Td hideSm>{w.fromName ?? "–"}</Td>
                  <Td>{w.subject}</Td>
                  <Td num>{formatMinutes(w.waitedMin)}</Td>
                  <Td num hideSm>{formatMinutes(w.targetMin)}</Td>
                  <Td>
                    <Person name={w.answererName} />
                  </Td>
                  <Td>
                    <StatusDot tone={w.state.tone}>{w.state.label}</StatusDot>
                  </Td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7}>
                  <div className="empty">No client is waiting for an answer.</div>
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      ) : null}

      {tab === "person" ? (
        <Table>
          <thead>
            <tr>
              <Th>Person</Th>
              <Th num>Answered</Th>
              <Th num>On time</Th>
              <Th num>Typical answer</Th>
              <Th num>Late now</Th>
            </tr>
          </thead>
          <tbody>
            {d.people.length ? (
              d.people.map((p) => (
                <tr key={p.id}>
                  <Td>
                    <Person name={p.name} />
                  </Td>
                  <Td num>{p.answered}</Td>
                  <Td num>{pct(p.onTimePct)}</Td>
                  <Td num>{dur(p.typicalMin)}</Td>
                  <Td num>{p.lateNow}</Td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>
                  <div className="empty">No answers in the last {range} days.</div>
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      ) : null}

      {tab === "client" ? (
        <Table>
          <thead>
            <tr>
              <Th>Client</Th>
              <Th num>Waits</Th>
              <Th num>On time</Th>
              <Th num>Typical answer</Th>
              <Th num hideSm>Slowest</Th>
              <Th num>Waiting now</Th>
            </tr>
          </thead>
          <tbody>
            {d.clients.length ? (
              d.clients.map((c) => (
                <tr key={c.clientId}>
                  <Td>
                    <strong>{c.clientName}</strong>
                  </Td>
                  <Td num>{c.waits}</Td>
                  <Td num>{pct(c.onTimePct)}</Td>
                  <Td num>{dur(c.typicalMin)}</Td>
                  <Td num hideSm>{dur(c.slowestMin)}</Td>
                  <Td num>{c.waitingNow}</Td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>
                  <div className="empty">No client waits in the last {range} days.</div>
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      ) : null}

      {tab === "answered" ? (
        <Table>
          <thead>
            <tr>
              <Th>Client</Th>
              <Th>Kind</Th>
              <Th hideSm>Asked</Th>
              <Th>Answered by</Th>
              <Th num>Took</Th>
              <Th num hideSm>Target</Th>
              <Th>Result</Th>
            </tr>
          </thead>
          <tbody>
            {d.answered.length ? (
              d.answered.map((w) => (
                <tr key={w.id}>
                  <Td>
                    <strong>{w.clientName}</strong>
                  </Td>
                  <Td>{KIND_LABEL[w.kind]}</Td>
                  <Td hideSm>{whenLabel(w.askedAt, now, tz)}</Td>
                  <Td>{w.answeredByName ?? "–"}</Td>
                  <Td num>{formatMinutes(w.tookMin)}</Td>
                  <Td num hideSm>{formatMinutes(w.targetMin)}</Td>
                  <Td>{w.tookMin <= w.targetMin ? <StatusDot tone="ok">On time</StatusDot> : <StatusDot tone="danger">Late</StatusDot>}</Td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7}>
                  <div className="empty">No answers in the last {range} days.</div>
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      ) : null}

      <InboxCountsCard />
    </div>
  );
}

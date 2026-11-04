import Link from "next/link";
import type { CSSProperties } from "react";
import { Avatar, Avatars, Card, CardHead, StatusDot } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  RSVP,
  calHref,
  dayHead,
  daysBetween,
  dnum,
  fmtLong,
  fmtShort,
  fmtT,
  isWeekend,
  timeRange,
  viewRange,
  type View,
} from "@/lib/modules/calendar/logic";
import type { BusyBlock, CalEvent, Person } from "@/lib/modules/calendar/types";
import s from "./calendar.module.css";

const HOUR0 = 8;
const HOUR1 = 19;
const PX = 48;

export type ViewProps = {
  view: View;
  cursor: string;
  showCol: boolean;
  today: string;
  nowMin: number;
  meId: string;
  events: CalEvent[];
  busy: BusyBlock[];
  people: Person[];
  onOpen: (id: string) => void;
};

const kindClass = (e: CalEvent) => (e.kind === "client_meeting" ? s.client : s.internal);
const first = (name: string) => name.split(" ")[0];
const on = <T extends { date: string; start: number }>(list: T[], d: string) =>
  list.filter((x) => x.date === d).sort((a, b) => a.start - b.start);

export function CalendarBody(p: ViewProps) {
  if (p.view === "month") return <MonthView {...p} />;
  if (p.view === "week") return <TimeGrid {...p} days={daysBetween(viewRange("week", p.cursor).from, viewRange("week", p.cursor).to)} />;
  if (p.view === "day") return <DayView {...p} />;
  return <AgendaView {...p} />;
}

function MonthView(p: ViewProps) {
  const { from, to } = viewRange("month", p.cursor);
  const month = p.cursor.slice(0, 7);
  return (
    <>
      <div className={s.dows}>
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="cal-grid">
        {daysBetween(from, to).map((d) => {
          const evs = on(p.events, d);
          const busyPeople = p.showCol ? new Set(p.busy.filter((b) => b.date === d).map((b) => b.memberId)).size : 0;
          const dayLink = calHref("day", d, p.showCol);
          return (
            <div key={d} className={cn("cal-cell", s.cell, d.slice(0, 7) !== month && "dim", d === p.today && "today")}>
              <Link className={s.dn} href={dayLink} aria-label={`Open ${fmtLong(d)}`}>
                {dnum(d)}
              </Link>
              {evs.slice(0, 3).map((e) => (
                <button key={e.id} type="button" className={cn(s.ev, kindClass(e))} title={e.title} onClick={() => p.onOpen(e.id)}>
                  {fmtT(e.start)} {e.title}
                </button>
              ))}
              {evs.length > 3 ? (
                <Link className={s.more} href={dayLink}>
                  {evs.length - 3} more
                </Link>
              ) : null}
              {busyPeople ? <div className={s.busyline}>{busyPeople} colleagues busy</div> : null}
            </div>
          );
        })}
      </div>
    </>
  );
}

function TimeGrid(p: ViewProps & { days: string[] }) {
  const top = (m: number) => Math.max(0, ((m - HOUR0 * 60) / 60) * PX);
  const names = new Map(p.people.map((x) => [x.id, x.name]));
  const hours = [];
  for (let h = HOUR0; h < HOUR1; h++) hours.push(`${String(h).padStart(2, "0")}:00`);
  return (
    <div className={s.scrollx}>
      <div className={cn(s.tg, p.showCol && s.cols)} style={{ "--cols": p.days.length } as CSSProperties}>
        <div className={s.hd} />
        {p.days.map((d) => (
          <div key={d} className={cn(s.hd, d === p.today && s.today)}>
            {dayHead(d)}
          </div>
        ))}
        <div className={s.hours}>
          {hours.map((h) => (
            <div key={h}>{h}</div>
          ))}
        </div>
        {p.days.map((d) => (
          <div key={d} className={cn(s.col, isWeekend(d) && s.off)}>
            {p.showCol
              ? on(p.busy, d).map((b, i) => {
                  const name = names.get(b.memberId) ?? "Colleague";
                  return (
                    <div
                      key={i}
                      className={cn(s.blk, s.b, s.busy)}
                      style={{ top: top(b.start), height: Math.max(16, (b.mins / 60) * PX - 2) }}
                      title={`${name} busy ${timeRange(b.start, b.mins)}`}
                    >
                      Busy · {first(name)}
                    </div>
                  );
                })
              : null}
            {on(p.events, d).map((e) => (
              <button
                key={e.id}
                type="button"
                className={cn(s.blk, s.e, kindClass(e))}
                style={{ top: top(e.start), height: Math.max(20, (e.mins / 60) * PX - 2) }}
                title={e.title}
                onClick={() => p.onOpen(e.id)}
              >
                <strong>{e.title}</strong>
                <br />
                <span className="small">{timeRange(e.start, e.mins)}</span>
              </button>
            ))}
            {d === p.today && p.nowMin >= HOUR0 * 60 && p.nowMin <= HOUR1 * 60 ? (
              <div className={s.now} style={{ top: top(p.nowMin) }} title="Now" />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function DayView(p: ViewProps) {
  const d = p.cursor;
  const evs = on(p.events, d);
  return (
    <div className={s.dayw}>
      <TimeGrid {...p} days={[d]} />
      {p.showCol ? (
        <Card>
          <CardHead title="Colleagues" actions={<span className="small muted">Busy or free only</span>} />
          <div className="list">
            {p.people
              .filter((x) => x.id !== p.meId)
              .map((x) => {
                const b = on(p.busy, d).filter((y) => y.memberId === x.id);
                return (
                  <div key={x.id} className="item between">
                    <span className="row" style={{ flexWrap: "nowrap" }}>
                      <Avatar name={x.name} size={24} /> {x.name}
                    </span>
                    <span className="small">
                      {isWeekend(d) ? (
                        <StatusDot tone="muted">Day off</StatusDot>
                      ) : b.length ? (
                        <StatusDot tone="warn">Busy {b.map((y) => timeRange(y.start, y.mins)).join(", ")}</StatusDot>
                      ) : (
                        <StatusDot tone="ok">Free all day</StatusDot>
                      )}
                    </span>
                  </div>
                );
              })}
          </div>
        </Card>
      ) : (
        <Card>
          <CardHead title="On this day" actions={<span className="small muted">{evs.length === 1 ? "1 meeting" : `${evs.length} meetings`}</span>} />
          <div className="list">
            {evs.length ? (
              evs.map((e) => (
                <button key={e.id} type="button" className={cn("item", s.agRow, s.dayRow)} onClick={() => p.onOpen(e.id)}>
                  <span className="num small">{timeRange(e.start, e.mins)}</span>
                  <span>{e.title}</span>
                </button>
              ))
            ) : (
              <div className="empty">No meetings. Good day for deep work.</div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function AgendaView(p: ViewProps) {
  const { from, to } = viewRange("agenda", p.cursor);
  const days = daysBetween(from, to)
    .map((d) => ({ d, evs: on(p.events, d) }))
    .filter((x) => x.evs.length);
  if (!days.length) return <div className="empty">Nothing in the next 30 days.</div>;
  return (
    <div>
      {days.map(({ d, evs }) => (
        <div key={d} className={cn(s.agDay, d === p.today && s.today)}>
          <h4>
            {d === p.today ? "Today, " : ""}
            {fmtShort(d)}
          </h4>
          {evs.map((e) => {
            const mine = RSVP[e.attendees.find((a) => a.id === p.meId)?.rsvp ?? "pending"];
            return (
              <button key={e.id} type="button" className={s.agRow} onClick={() => p.onOpen(e.id)}>
                <span className="num small">{timeRange(e.start, e.mins)}</span>
                <span>
                  <span className={cn(s.sw, kindClass(e))} />
                  {e.title}
                  {e.clientName ? <span className="muted small"> · {e.clientName}</span> : null}
                </span>
                <span className={s.hideSm}>
                  <Avatars>
                    {e.attendees.slice(0, 4).map((a) => (
                      <Avatar key={a.id} name={a.name} size={22} />
                    ))}
                  </Avatars>
                </span>
                <span className={cn("small", s.hideSm)}>
                  <StatusDot tone={mine.tone}>{mine.label}</StatusDot>
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

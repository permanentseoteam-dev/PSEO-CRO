"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button, ButtonLink, Card, CardBody, Seg } from "@/components/ui";
import type { Scope } from "@/lib/auth/perms";
import { VIEWS, calHref, stepCursor, viewTitle, type View } from "@/lib/modules/calendar/logic";
import type { BusyBlock, CalEvent, ClientOption, Person } from "@/lib/modules/calendar/types";
import { CalendarBody } from "./views";
import { EventDialog } from "./event-dialog";
import { MeetingForm, type FormState } from "./meeting-form";
import s from "./calendar.module.css";

export type CalMe = { id: string; name: string; perms: Record<string, Scope> };

type Props = {
  me: CalMe;
  view: View;
  cursor: string;
  showCol: boolean;
  today: string;
  nowMin: number;
  events: CalEvent[];
  busy: BusyBlock[];
  people: Person[];
  clients: ClientOption[];
  /** Server-rendered `<CalendarSyncBar />` (platform-p2), passed in from the page. */
  syncBar?: ReactNode;
};

export function Calendar(p: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const open = p.events.find((e) => e.id === openId) ?? null;
  const href = (view: View, cursor: string, col = p.showCol) => calHref(view, cursor, col);

  return (
    <div className="page">
      <div className={s.top}>
        <div className="row">
          <ButtonLink href={href(p.view, p.today)}>Today</ButtonLink>
          <Link className="icon-btn" aria-label="Previous" title="Previous" href={href(p.view, stepCursor(p.view, p.cursor, -1))}>
            <ChevronLeft />
          </Link>
          <Link className="icon-btn" aria-label="Next" title="Next" href={href(p.view, stepCursor(p.view, p.cursor, 1))}>
            <ChevronRight />
          </Link>
          <h2>{viewTitle(p.view, p.cursor)}</h2>
        </div>
        <div className="row">
          <Seg
            label="Calendar view"
            value={p.view}
            items={VIEWS.map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1), href: href(v, p.cursor) }))}
          />
          <ButtonLink
            variant={p.showCol ? "primary" : "default"}
            href={href(p.view, p.cursor, !p.showCol)}
            aria-pressed={p.showCol}
          >
            {p.showCol ? "Hide colleagues" : "Show colleagues"}
          </ButtonLink>
          <Button onClick={() => setForm({ kind: "client" })}>Client meeting</Button>
          <Button variant="primary" onClick={() => setForm({ kind: "internal" })}>
            New meeting
          </Button>
        </div>
      </div>

      <div className="row between small">
        <div>{p.syncBar}</div>
        <div className={`${s.legend} muted`}>
          <span>
            <i className={`${s.sw} ${s.client}`} />
            Client meeting
          </span>
          <span>
            <i className={`${s.sw} ${s.internal}`} />
            Internal
          </span>
          <span>
            <i className={`${s.sw} ${s.busy}`} />
            Colleague busy
          </span>
        </div>
      </div>

      <Card>
        <CardBody>
          <CalendarBody
            view={p.view}
            cursor={p.cursor}
            showCol={p.showCol}
            today={p.today}
            nowMin={p.nowMin}
            meId={p.me.id}
            events={p.events}
            busy={p.busy}
            people={p.people}
            onOpen={setOpenId}
          />
        </CardBody>
      </Card>

      <EventDialog
        event={open}
        me={p.me}
        onClose={() => setOpenId(null)}
        onEdit={(e) => {
          setOpenId(null);
          setForm({ kind: e.kind === "client_meeting" ? "client" : "internal", event: e });
        }}
      />
      <MeetingForm
        state={form}
        onClose={() => setForm(null)}
        me={p.me}
        people={p.people}
        clients={p.clients}
        defaultDate={p.cursor >= p.today ? p.cursor : p.today}
        view={p.view}
        showCol={p.showCol}
      />
    </div>
  );
}

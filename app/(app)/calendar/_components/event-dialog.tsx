"use client";

import { useTransition } from "react";
import { Avatar, Button, Dialog, Seg, StatusDot, useToast } from "@/components/ui";
import { can } from "@/lib/auth/perms";
import { REPEAT_LABEL, RSVP, fmtLong, timeRange } from "@/lib/modules/calendar/logic";
import type { CalEvent } from "@/lib/modules/calendar/types";
import { cancelMeeting, setRsvp } from "../actions";
import type { CalMe } from "./calendar";
import s from "./calendar.module.css";

const VIS = { team: "Team can see details", private: "Private", client: "Client can see it" } as const;

const joinUrl = (link: string) => (/^https?:\/\//i.test(link) ? link : `https://${link}`);

export function EventDialog({
  event: e,
  me,
  onClose,
  onEdit,
}: {
  event: CalEvent | null;
  me: CalMe;
  onClose: () => void;
  onEdit: (e: CalEvent) => void;
}) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const mine = e?.attendees.find((a) => a.id === me.id)?.rsvp ?? "pending";
  const canEdit = !!e && (e.createdBy === me.id || can(me, "calendar.use", "all"));

  const reply = (rsvp: "yes" | "maybe" | "no") =>
    e &&
    start(async () => {
      const r = await setRsvp({ eventId: e.id, rsvp });
      toast(r.ok ? `You replied ${RSVP[rsvp].label.toLowerCase()}` : r.error);
    });

  const cancel = (all: boolean) =>
    e &&
    start(async () => {
      const r = await cancelMeeting({ eventId: e.id, all });
      if (!r.ok) return toast(r.error);
      onClose();
      toast(r.count > 1 ? `${r.count} meetings cancelled. Attendees notified.` : "Meeting cancelled. Attendees notified.");
    });

  return (
    <Dialog
      open={!!e}
      onClose={onClose}
      title={e?.title ?? "Meeting"}
      footer={
        e && canEdit ? (
          <>
            <Button disabled={pending} onClick={() => onEdit(e)}>
              Edit
            </Button>
            <Button variant="danger" disabled={pending} onClick={() => cancel(false)}>
              {e.seriesId ? "Cancel this one" : "Cancel meeting"}
            </Button>
            {e.seriesId ? (
              <Button variant="danger" disabled={pending} onClick={() => cancel(true)}>
                Cancel all in series
              </Button>
            ) : null}
          </>
        ) : null
      }
    >
      {e ? (
        <div className="stack">
          <div>
            <strong>{fmtLong(e.date)}</strong>, {timeRange(e.start, e.mins)}{" "}
            <span className="muted">
              ({e.mins} min{e.repeat !== "none" ? ` · ${REPEAT_LABEL[e.repeat]}` : ""})
            </span>
          </div>
          {e.clientId ? (
            <div>
              Client: <a href={`/clients/${e.clientId}`}>{e.clientName ?? "Open client"}</a>
            </div>
          ) : null}
          <div className="row">
            {e.meetLink ? (
              <>
                <a className="btn primary" href={joinUrl(e.meetLink)} target="_blank" rel="noopener noreferrer">
                  Join Meet
                </a>
                <span className="small muted">{e.meetLink.replace(/^https?:\/\//i, "")}</span>
              </>
            ) : (
              <span>Location: {e.location ?? "Not set"}</span>
            )}
          </div>
          <div>
            <div className="small muted" style={{ marginBottom: 4 }}>
              Your answer
            </div>
            <Seg
              label="Your answer"
              value={mine}
              items={[
                { value: "yes", label: "Going" },
                { value: "maybe", label: "Maybe" },
                { value: "no", label: "No" },
              ]}
              onChange={(v) => !pending && reply(v as "yes" | "maybe" | "no")}
            />
          </div>
          <div>
            <h4 style={{ margin: "6px 0" }}>
              Attendees <span className="muted small">{e.attendees.filter((a) => a.rsvp === "yes").length} going</span>
            </h4>
            {e.attendees.map((a) => (
              <div key={a.id} className={s.att}>
                <Avatar name={a.name} size={26} />
                <span>
                  {a.name}
                  {a.id === me.id ? <span className="muted small"> (you)</span> : null}
                  {a.id === e.createdBy ? <span className="muted small"> organiser</span> : null}
                </span>
                <span className="small">
                  <StatusDot tone={RSVP[a.rsvp].tone}>{RSVP[a.rsvp].label}</StatusDot>
                </span>
              </div>
            ))}
            {e.guests.map((g) => (
              <div key={g} className={s.att}>
                <span />
                <span>
                  {g} <span className="muted small">guest</span>
                </span>
                <span className="small">
                  <StatusDot tone="muted">No reply</StatusDot>
                </span>
              </div>
            ))}
          </div>
          {e.agenda ? (
            <div>
              <h4 style={{ margin: "6px 0" }}>Agenda</h4>
              <div style={{ whiteSpace: "pre-wrap" }}>{e.agenda}</div>
            </div>
          ) : null}
          <div className="small muted">Visibility: {VIS[e.visibility]}</div>
        </div>
      ) : null}
    </Dialog>
  );
}

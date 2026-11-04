"use client";

import { useState, useTransition } from "react";
import { Avatar, Avatars, Button, Seg, useToast } from "@/components/ui";
import { OUTCOME_LABEL, saveLabel, type Outcome } from "@/lib/modules/clientops/logic";
import type { Meeting } from "@/lib/modules/clientops/types";
import { reviewMeeting } from "../actions";

const OUTCOMES: Outcome[] = ["ticket", "todo", "skip"];

export function ReviewCard({ meeting: m, when, canTicket }: { meeting: Meeting; when: string; canTicket: boolean }) {
  const [choice, setChoice] = useState<Record<string, Outcome>>(() =>
    Object.fromEntries(m.actions.map((a) => [a.id, !canTicket && a.outcome === "ticket" ? "todo" : a.outcome])),
  );
  const [pending, start] = useTransition();
  const toast = useToast();
  const tickets = Object.values(choice).filter((o) => o === "ticket").length;

  function save() {
    start(async () => {
      const res = await reviewMeeting({ meetingId: m.id, outcomes: Object.entries(choice).map(([id, outcome]) => ({ id, outcome })) });
      if (!res.ok) return toast(res.error);
      toast(`${res.created} ticket${res.created === 1 ? "" : "s"} created, notes saved`);
    });
  }

  return (
    <section className="card">
      <div className="card-head">
        <h3>{m.title}</h3>
        <span className="small muted">
          {m.clientName} · {when}
        </span>
      </div>
      <div className="card-body stack" style={{ gap: 12 }}>
        {m.people.length || m.guests ? (
          <div className="row small" style={{ gap: 8 }}>
            <Avatars>
              {m.people.map((p) => (
                <Avatar key={p} name={p} size={22} />
              ))}
            </Avatars>
            {m.guests ? <span className="muted">with {m.guests}</span> : null}
          </div>
        ) : null}
        {m.summary ? <p style={{ margin: 0 }}>{m.summary}</p> : null}
        {m.decisions.length ? (
          <div>
            <h4 className="text-[13px]">Decisions</h4>
            <ul className="small" style={{ margin: "4px 0 0", paddingLeft: 18 }}>
              {m.decisions.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {m.concerns.length ? (
          <div>
            <h4 className="text-[13px]">Concerns</h4>
            {m.concerns.map((c, i) => (
              <div key={i} className="small" style={{ marginTop: 4 }}>
                <strong>{c.topic}</strong>
                {c.quote ? <blockquote className="mt-1 border-l-[3px] border-line px-2.5 py-1 italic text-ink-2">&ldquo;{c.quote}&rdquo;</blockquote> : null}
              </div>
            ))}
          </div>
        ) : null}
        <div>
          <h4 className="text-[13px]">Action items</h4>
          {m.actions.length ? (
            <div className="list">
              {m.actions.map((a) => (
                <div key={a.id} className="item flex-wrap justify-between">
                  <div className="stack" style={{ gap: 2, minWidth: 0 }}>
                    <span>{a.title}</span>
                    {a.ownerName ? <span className="small muted">{a.ownerName}</span> : null}
                  </div>
                  <Seg
                    className="sm"
                    label={`What to do with: ${a.title}`}
                    value={choice[a.id]}
                    onChange={(v) => {
                      if (v === "ticket" && !canTicket) return toast("You can't create tickets.");
                      setChoice((c) => ({ ...c, [a.id]: v as Outcome }));
                    }}
                    items={OUTCOMES.map((o) => ({ value: o, label: OUTCOME_LABEL[o] }))}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="small muted" style={{ margin: "4px 0 0" }}>
              No action items.
            </p>
          )}
        </div>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <Button variant="primary" onClick={save} disabled={pending}>
            {tickets ? saveLabel(tickets) : "Save"}
          </Button>
        </div>
      </div>
    </section>
  );
}

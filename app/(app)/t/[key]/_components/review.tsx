"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, CardHead, Checkbox, Field, Select, Textarea, useToast } from "@/components/ui";
import { approveReview, sendBack, submitForReview } from "@/lib/modules/tickets/actions";
import { SEND_BACK_REASONS } from "@/lib/modules/tickets/logic";
import type { Person, ReviewRound, TicketStatus } from "@/lib/modules/tickets/types";
import s from "./ticket.module.css";

type Props = {
  ticketId: string;
  status: TicketStatus;
  round: number;
  rounds: ReviewRound[];
  reviewerId: string | null;
  meId: string;
  people: Person[];
  canEdit: boolean;
  canModerate: boolean;
};

const when = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Dubai" });

/** Basic review: submit with a note and reviewer; the reviewer approves or sends back with reasons. */
export function Review({ ticketId, status, round, rounds, reviewerId, meId, people, canEdit, canModerate }: Props) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [backOpen, setBackOpen] = useState(false);
  const reviewer = people.find((p) => p.id === reviewerId);
  const isReviewer = status === "in_review" && (reviewerId === meId || canModerate);

  const done = (msg: string) => (r: { ok: boolean; error?: string }) => {
    toast(r.ok ? msg : r.error ?? "Couldn't save");
    if (r.ok) router.refresh();
  };

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const rid = String(fd.get("reviewer") ?? "");
    start(async () => done(`Sent to ${people.find((p) => p.id === rid)?.name ?? "the reviewer"} for review`)(
      await submitForReview({ ticketId, reviewerId: rid, note: String(fd.get("note") ?? "") }),
    ));
  }

  function back(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await sendBack({ ticketId, reasons: fd.getAll("reason").map(String), note: String(fd.get("note") ?? "") });
      if (r.ok) setBackOpen(false);
      done(`Sent back. Round ${round + 1} starts when it is resubmitted`)(r);
    });
  }

  return (
    <Card>
      <CardHead
        title="Review"
        actions={round ? <span className="muted small">Round {round} · {rounds.length} {rounds.length === 1 ? "revision" : "revisions"}</span> : null}
      />
      <CardBody className="stack">
        {status === "in_review" ? (
          <p style={{ margin: 0 }}>Waiting for <b>{reviewer?.name ?? "a reviewer"}</b>.</p>
        ) : canEdit && status !== "done" ? (
          <form className="stack" onSubmit={submit}>
            <Field label="Reviewer" htmlFor="tk-rv-who">
              <Select id="tk-rv-who" name="reviewer" required defaultValue={reviewerId && reviewerId !== meId ? reviewerId : ""}>
                <option value="" disabled>Pick a reviewer</option>
                {people.filter((p) => p.id !== meId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
            <Field label="Note for the reviewer" htmlFor="tk-rv-note">
              <Textarea id="tk-rv-note" name="note" rows={2} maxLength={2000} placeholder="What changed and what to check" />
            </Field>
            <div><Button variant="primary" type="submit" disabled={pending}>Submit for review</Button></div>
          </form>
        ) : status === "done" && round ? (
          <p className="muted" style={{ margin: 0 }}>Approved after {round} {round === 1 ? "round" : "rounds"}.</p>
        ) : (
          <p className="muted" style={{ margin: 0 }}>Not submitted for review.</p>
        )}

        {isReviewer ? (
          <div className={`stack ${s.reviewer}`}>
            <div className="row">
              <Button variant="primary" disabled={pending} onClick={() => start(async () => done("Approved. Ticket marked done")(await approveReview(ticketId)))}>
                Approve
              </Button>
              <Button onClick={() => setBackOpen((v) => !v)}>Send back with changes</Button>
            </div>
            {backOpen ? (
              <form className="stack" onSubmit={back}>
                <div className="row">
                  {SEND_BACK_REASONS.map((r) => <Checkbox key={r} name="reason" value={r} label={r} />)}
                </div>
                <Field label="What to change" htmlFor="tk-rv-back">
                  <Textarea id="tk-rv-back" name="note" rows={3} required minLength={3} maxLength={2000} placeholder="Be specific so it can be fixed in one go" />
                </Field>
                <div><Button variant="primary" type="submit" disabled={pending}>Send back</Button></div>
              </form>
            ) : null}
          </div>
        ) : null}

        {rounds.map((r) => (
          <details key={r.round} className={s.round}>
            <summary>Round {r.round} · sent back by {r.by} · {when(r.at)}</summary>
            <p className="small">Reasons: {r.reasons}. &ldquo;{r.note}&rdquo;</p>
          </details>
        ))}
      </CardBody>
    </Card>
  );
}

"use client";

import { useState, useTransition } from "react";
import { Button, Card, CardBody, CardHead, Checkbox, Field, FormGrid, Input, Select, StatusDot, Textarea, useToast } from "@/components/ui";
import { cancelExit, setExitTask, startExit } from "../actions";
import { EXIT_CHECKLIST, EXIT_REASONS, checklistProgress, fmtDate } from "../logic";
import type { Exit } from "../types";

export function LeavingTabClient({ memberId, exit }: { memberId: string; exit: Exit | null }) {
  const open = exit?.status === "started" ? exit : null;
  const [lastDay, setLastDay] = useState("");
  const [reason, setReason] = useState<string>(EXIT_REASONS[0]);
  const [notes, setNotes] = useState("");
  const [busy, start] = useTransition();
  const toast = useToast();
  const progress = checklistProgress(open?.tasks ?? []);

  function begin() {
    if (!window.confirm("Start this person's exit? The offboarding checklist will be created.")) return;
    start(async () => {
      const r = await startExit({ memberId, lastDay, reason, notes });
      toast(r.ok ? "Exit started" : r.error);
    });
  }

  function stay() {
    if (!open || !window.confirm("Mark them as staying? The exit will be cancelled.")) return;
    start(async () => {
      const r = await cancelExit({ exitId: open.id });
      toast(r.ok ? "Marked as staying" : r.error);
    });
  }

  function tick(taskId: string, done: boolean) {
    start(async () => {
      const r = await setExitTask({ taskId, done });
      if (!r.ok) toast(r.error);
    });
  }

  const status = open ? (
    <StatusDot tone="warn">{open.last_day ? `Leaving ${fmtDate(open.last_day)}` : "Exit started"}</StatusDot>
  ) : exit?.status === "cancelled" ? (
    <StatusDot tone="ok">Staying</StatusDot>
  ) : (
    <StatusDot tone="muted">No exit started</StatusDot>
  );

  return (
    <div className="grid-2">
      <Card>
        <CardHead title="Exit details" actions={status} />
        <CardBody className="stack">
          {open ? (
            <>
              <p>
                <b>{open.reason}</b>
                {open.last_day ? ` · last working day ${fmtDate(open.last_day)}` : ""}
              </p>
              {open.notes ? <p>{open.notes}</p> : null}
              <div className="row">
                <Button disabled={busy} onClick={stay}>
                  They&apos;re staying
                </Button>
              </div>
            </>
          ) : (
            <>
              <FormGrid>
                <Field label="Last working day" htmlFor="exit-day">
                  <Input id="exit-day" type="date" value={lastDay} onChange={(e) => setLastDay(e.target.value)} />
                </Field>
                <Field label="Reason" htmlFor="exit-reason">
                  <Select id="exit-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
                    {EXIT_REASONS.map((r) => (
                      <option key={r}>{r}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Notes" htmlFor="exit-notes" full>
                  <Textarea id="exit-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
                </Field>
              </FormGrid>
              <div className="row">
                <Button variant="danger" disabled={busy} onClick={begin}>
                  Start exit
                </Button>
              </div>
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHead title="Offboarding checklist" actions={<span className="small muted">{open ? `${progress.done} of ${progress.total}` : `0 of ${EXIT_CHECKLIST.length}`}</span>} />
        <CardBody className="stack">
          {open
            ? open.tasks.map((t) => <Checkbox key={t.id} label={t.label} checked={!!t.done_at} disabled={busy} onChange={(e) => tick(t.id, e.target.checked)} />)
            : EXIT_CHECKLIST.map((label) => <Checkbox key={label} label={label} checked={false} disabled readOnly />)}
        </CardBody>
      </Card>
    </div>
  );
}

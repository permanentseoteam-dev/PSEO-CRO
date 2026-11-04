"use client";

import { useTransition } from "react";
import { Button, Card, CardBody, CardHead, StatusDot, useToast } from "@/components/ui";
import { clock } from "../actions";
import { RequestButton } from "./request-button";

/** Today's clock: clock in/out and breaks. The shift end is used to warn about leaving early. */
export function ClockCard({ clockedInAt, onBreak, shiftEnd }: { clockedInAt: string | null; onBreak: boolean; shiftEnd: string | null }) {
  const [pending, start] = useTransition();
  const toast = useToast();

  const run = (op: "in" | "out" | "break_start" | "break_end", msg: string) =>
    start(async () => {
      const r = await clock(op);
      toast(r.ok ? msg : r.error);
    });

  function clockOut() {
    const now = new Date();
    const local = new Date(now.getTime() + 4 * 3600 * 1000).toISOString().slice(11, 16);
    run("out", shiftEnd && local < shiftEnd ? `Clocked out before your shift ends at ${shiftEnd}` : "Clocked out");
  }

  const status = !clockedInAt ? (
    <StatusDot tone="muted">Clocked out</StatusDot>
  ) : onBreak ? (
    <StatusDot tone="warn">On break</StatusDot>
  ) : (
    <StatusDot tone="ok">Clocked in at {clockedInAt}</StatusDot>
  );

  return (
    <Card>
      <CardHead title="Today" actions={status} />
      <CardBody className="row">
        {clockedInAt ? (
          <>
            <Button disabled={pending} onClick={() => run(onBreak ? "break_end" : "break_start", onBreak ? "Break ended" : "Break started")}>
              {onBreak ? "End break" : "Start break"}
            </Button>
            <Button disabled={pending} onClick={clockOut}>Clock out</Button>
          </>
        ) : (
          <Button variant="primary" disabled={pending} onClick={() => run("in", "Clocked in")}>Clock in</Button>
        )}
        <span className="flex-1" />
        <RequestButton kind="wfh" variant="ghost" />
        <RequestButton kind="overtime" variant="ghost" />
      </CardBody>
    </Card>
  );
}

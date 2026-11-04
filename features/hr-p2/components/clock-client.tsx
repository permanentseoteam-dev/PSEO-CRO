"use client";

import { useEffect, useState, useTransition } from "react";
import { Button, Card, CardBody, CardHead, Dialog, StatusDot, useToast } from "@/components/ui";
import { clock } from "../actions";
import { clockState, fmtMinutes, hm, isEarlyClockOut, localHm, workedMinutes } from "../logic";
import type { ClockDay } from "../types";
import css from "../hr.module.css";

export function ClockWidgetClient({ day: initial, shiftEnd }: { day: ClockDay | null; shiftEnd: string }) {
  const [day, setDay] = useState(initial);
  const [now, setNow] = useState(() => new Date());
  const [confirmEarly, setConfirmEarly] = useState(false);
  const [busy, start] = useTransition();
  const toast = useToast();
  const state = clockState(day);

  useEffect(() => {
    if (state !== "in" && state !== "break") return;
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, [state]);

  function run(action: "in" | "break_start" | "break_end" | "out", msg: string) {
    start(async () => {
      const r = await clock({ action });
      if (!r.ok) return toast(r.error);
      if (r.data) setDay(r.data);
      setNow(new Date());
      toast(msg);
    });
  }

  function clockOut() {
    if (isEarlyClockOut(new Date(), shiftEnd)) return setConfirmEarly(true);
    run("out", "Clocked out");
  }

  const status =
    state === "out" ? (
      <StatusDot tone="muted">Not clocked in</StatusDot>
    ) : state === "break" ? (
      <StatusDot tone="warn">On break</StatusDot>
    ) : state === "done" ? (
      <StatusDot tone="muted">{`Clocked out at ${localHm(day!.clock_out_at!)}`}</StatusDot>
    ) : (
      <StatusDot tone="ok">{`Clocked in at ${localHm(day!.clock_in_at)}`}</StatusDot>
    );

  return (
    <Card>
      <CardHead title="Today" actions={status} />
      <CardBody className="row" style={{ flexWrap: "wrap" }}>
        {day ? (
          <span className={css.clockTime} aria-label="Worked today" suppressHydrationWarning>
            {fmtMinutes(workedMinutes(day, now))}
          </span>
        ) : null}
        <span style={{ flex: 1 }} />
        {state === "in" ? (
          <Button disabled={busy} onClick={() => run("break_start", "Break started")}>
            Start break
          </Button>
        ) : null}
        {state === "break" ? (
          <Button disabled={busy} onClick={() => run("break_end", "Break ended")}>
            End break
          </Button>
        ) : null}
        {state === "in" || state === "break" ? (
          <Button variant="primary" disabled={busy} onClick={clockOut}>
            Clock out
          </Button>
        ) : (
          <Button variant="primary" disabled={busy} onClick={() => run("in", "Clocked in")}>
            Clock in
          </Button>
        )}
      </CardBody>
      <Dialog
        open={confirmEarly}
        onClose={() => setConfirmEarly(false)}
        title="Clock out early?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmEarly(false)}>
              Keep working
            </Button>
            <Button
              variant="primary-danger"
              disabled={busy}
              onClick={() => {
                setConfirmEarly(false);
                run("out", "Clocked out early");
              }}
            >
              Clock out now
            </Button>
          </>
        }
      >
        <p>Your shift ends at {hm(shiftEnd)}. Clocking out now counts as leaving early.</p>
      </Dialog>
    </Card>
  );
}

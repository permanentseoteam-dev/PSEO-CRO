"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { Button, Card, Dialog, Field, FormGrid, Input, Select, Textarea, useToast } from "@/components/ui";
import { startTimer, stopTimer } from "@/lib/modules/tickets/actions";
import { LOG_DAYS_BACK, addDays, fmtClock, fmtMinutes, today } from "@/lib/modules/personal/logic";
import type { TicketOpt } from "@/lib/modules/personal/types";
import { logEntry } from "../actions";

type Running = { id: string; ticketId: string | null; startedAt: string } | null;

/** Timer (one at a time, under 1 minute logs nothing) and the Log time dialog. */
export function TimerCard({ tickets, running }: { tickets: TicketOpt[]; running: Running }) {
  const [ticketId, setTicketId] = useState(running?.ticketId ?? tickets[0]?.id ?? "");
  const [secs, setSecs] = useState(0);
  const [pending, start] = useTransition();
  const toast = useToast();

  useEffect(() => {
    if (!running) return;
    const tick = () => setSecs(Math.max(0, Math.floor((Date.now() - new Date(running.startedAt).getTime()) / 1000)));
    tick();
    const h = setInterval(tick, 1000);
    return () => clearInterval(h);
  }, [running]);

  const keyOf = (id: string | null) => tickets.find((t) => t.id === id)?.key ?? "no ticket";

  function toggle() {
    start(async () => {
      if (running) {
        const r = await stopTimer(running.id);
        if (!r.ok) return toast(r.error);
        const m = r.data?.minutes ?? 0;
        toast(m < 1 ? "Under 1 minute, so nothing was logged" : `Logged ${fmtMinutes(m)} to ${keyOf(running.ticketId)}`);
      } else {
        const r = await startTimer({ ticketId: ticketId || null });
        if (!r.ok) return toast(r.error);
        toast(`Timer started on ${keyOf(ticketId || null)}`);
      }
    });
  }

  return (
    <Card className="flex flex-wrap items-center gap-3 p-4">
      <Select aria-label="Ticket" value={ticketId} disabled={!!running} onChange={(e) => setTicketId(e.currentTarget.value)} className="min-w-0 max-w-full">
        <option value="">No ticket</option>
        {tickets.map((t) => (
          <option key={t.id} value={t.id}>
            {t.key} · {t.title}
          </option>
        ))}
      </Select>
      <span className={`num min-w-[130px] text-[28px] font-bold${running ? " text-accent" : ""}`} aria-live="off">
        {fmtClock(running ? secs : 0)}
      </span>
      <Button variant="primary" disabled={pending} onClick={toggle}>
        {running ? "Stop" : "Start"}
      </Button>
      <span className="flex-1" />
      <LogTime tickets={tickets} />
    </Card>
  );
}

function LogTime({ tickets }: { tickets: TicketOpt[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const t = today();

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    start(async () => {
      const r = await logEntry({ ticketId: f.ticketId || null, duration: f.duration, date: f.date, note: f.note, billable: f.billable });
      if (!r.ok) return toast(r.error);
      setOpen(false);
      toast(`Logged ${fmtMinutes(r.data?.minutes ?? 0)}`);
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>Log time</Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Log time"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" form="log-time" disabled={pending}>Log time</Button>
          </>
        }
      >
        <form id="log-time" onSubmit={submit}>
          <FormGrid>
            <Field label="Ticket" htmlFor="lt-ticket" full>
              <Select id="lt-ticket" name="ticketId" defaultValue={tickets[0]?.id ?? ""}>
                <option value="">No ticket</option>
                {tickets.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.key} · {x.title}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Duration" htmlFor="lt-dur">
              <Input id="lt-dur" name="duration" placeholder="1h 30m" required />
            </Field>
            <Field label="Date" htmlFor="lt-date">
              <Input id="lt-date" name="date" type="date" defaultValue={t} min={addDays(t, -LOG_DAYS_BACK)} max={t} required />
            </Field>
            <Field label="Note (needed for past days)" htmlFor="lt-note" full>
              <Textarea id="lt-note" name="note" rows={2} maxLength={500} />
            </Field>
            <Field label="Billable" htmlFor="lt-bill">
              <Select id="lt-bill" name="billable" defaultValue="auto">
                <option value="auto">Auto</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </Select>
            </Field>
          </FormGrid>
        </form>
      </Dialog>
    </>
  );
}

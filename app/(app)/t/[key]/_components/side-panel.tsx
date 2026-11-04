"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Avatars, Button, Card, CardBody, Checkbox, Dialog, Field, FormGrid, Input, PhaseTwo, Textarea, useToast } from "@/components/ui";
import { logTime, startTimer, stopTimer, updateTicket } from "@/lib/modules/tickets/actions";
import { fmtClock, fmtMinutes, parseDuration, parseTags, PRIORITIES, PRIORITY_LABEL, STATUSES, STATUS_LABEL } from "@/lib/modules/tickets/logic";
import type { Person, ProjectOpt, TicketDetail, TicketStatus } from "@/lib/modules/tickets/types";
import s from "./ticket.module.css";

type Props = { t: TicketDetail; people: Person[]; projects: ProjectOpt[]; today: string };

export function SidePanel({ t, people, projects, today }: Props) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirmDone, setConfirmDone] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const dis = !t.canEdit || pending;
  const openItems = t.checklist.filter((c) => !c.done).length;

  function save(patch: Record<string, unknown>, msg = "Saved") {
    start(async () => {
      const r = await updateTicket({ id: t.id, patch });
      toast(r.ok ? msg : r.error);
      router.refresh();
    });
  }

  function onStatus(v: TicketStatus) {
    if (v === "done" && openItems > 0) return setConfirmDone(true);
    save({ status: v }, `Status set to ${STATUS_LABEL[v]}`);
  }

  // Text fields save on blur when changed.
  const onBlurSave = (current: string, parse: (v: string) => unknown, key: string) => (e: React.FocusEvent<HTMLInputElement>) => {
    const v = e.currentTarget.value.trim();
    if (v === current) return;
    const parsed = parse(v);
    if (parsed === undefined) {
      toast("Couldn't read that value");
      e.currentTarget.value = current;
      return;
    }
    save({ [key]: parsed });
  };

  function onLog(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await logTime({
        ticketId: t.id,
        date: String(fd.get("date") ?? today),
        minutes: String(fd.get("spent") ?? ""),
        billable: fd.get("billable") === "on",
        note: String(fd.get("note") ?? ""),
      });
      if (!r.ok) return toast(r.error);
      setLogOpen(false);
      toast(`Logged ${fmtMinutes(r.data?.minutes ?? 0)}`);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardBody>
        <dl className={s.dl}>
          <dt>Project</dt>
          <dd>
            <select aria-label="Project" value={t.projectId ?? ""} disabled={dis} onChange={(e) => save({ projectId: e.target.value || null }, "Project changed")}>
              <option value="">No project</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </dd>
          <dt>Status</dt>
          <dd>
            <select aria-label="Status" value={t.status} disabled={dis} onChange={(e) => onStatus(e.target.value as TicketStatus)}>
              {STATUSES.map((x) => <option key={x} value={x}>{STATUS_LABEL[x]}</option>)}
            </select>
          </dd>
          <dt>Priority</dt>
          <dd>
            <select aria-label="Priority" value={t.priority} disabled={dis} onChange={(e) => save({ priority: e.target.value }, "Priority saved")}>
              {PRIORITIES.map((x) => <option key={x} value={x}>{PRIORITY_LABEL[x]}</option>)}
            </select>
          </dd>
          <dt>Assignee</dt>
          <dd>
            <select aria-label="Assignee" value={t.assigneeId ?? ""} disabled={dis} onChange={(e) => save({ assigneeId: e.target.value || null }, "Assignee saved")}>
              <option value="">Unassigned</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </dd>
          <dt>Co-assignees</dt>
          <dd className="row">
            {t.coAssignees.length ? <Avatars>{t.coAssignees.map((n) => <Avatar key={n} name={n} size={22} />)}</Avatars> : <span className="muted">None</span>}
            <PhaseTwo />
          </dd>
          <dt>Due</dt>
          <dd>
            <input type="date" aria-label="Due" key={`due-${t.due}`} defaultValue={t.due ?? ""} disabled={dis} onChange={(e) => save({ due: e.target.value || null }, "Due date saved")} />
          </dd>
          <dt>Estimate</dt>
          <dd>
            <input
              aria-label="Estimate"
              key={`est-${t.estimateMin}`}
              defaultValue={t.estimateMin ? fmtMinutes(t.estimateMin) : ""}
              placeholder="e.g. 6h"
              disabled={dis}
              onBlur={onBlurSave(t.estimateMin ? fmtMinutes(t.estimateMin) : "", (v) => (v ? parseDuration(v) ?? undefined : null), "estimateMin")}
            />
          </dd>
          <dt>Start</dt>
          <dd>
            <input type="date" aria-label="Start" key={`start-${t.start}`} defaultValue={t.start ?? ""} disabled={dis} onChange={(e) => save({ start: e.target.value || null }, "Start date saved")} />
          </dd>
          <dt>Tags</dt>
          <dd>
            <input
              aria-label="Tags"
              key={`tags-${t.tags.join(",")}`}
              defaultValue={t.tags.join(", ")}
              placeholder="content, onpage"
              disabled={dis}
              onBlur={onBlurSave(t.tags.join(", "), (v) => parseTags(v), "tags")}
            />
          </dd>
          <dt>Reporter</dt>
          <dd className="row" style={{ flexWrap: "nowrap" }}>
            {t.reporter ? <><Avatar name={t.reporter} size={22} /> {t.reporter}</> : <span className="muted">Unknown</span>}
          </dd>
          {t.source ? (
            <>
              <dt>Source</dt>
              <dd>{t.source}</dd>
            </>
          ) : null}
          <dt>Watchers</dt>
          <dd>{t.watchers.length ? <Avatars>{t.watchers.map((n) => <Avatar key={n} name={n} size={22} />)}</Avatars> : <span className="muted">None</span>}</dd>
          <dt>Time logged</dt>
          <dd>
            <b className="num">{fmtMinutes(t.loggedMin)}</b>
            {t.estimateMin ? <span className="muted"> of {fmtMinutes(t.estimateMin)}</span> : null}
          </dd>
          <dt>Timer</dt>
          <dd><TimerControl ticketId={t.id} timer={t.timer} /></dd>
          <dt />
          <dd><Button size="sm" onClick={() => setLogOpen(true)}>Log time</Button></dd>
        </dl>
      </CardBody>

      <Dialog
        open={confirmDone}
        onClose={() => setConfirmDone(false)}
        title="Finish with open checklist items?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDone(false)}>Keep working</Button>
            <Button
              variant="primary"
              onClick={() => {
                setConfirmDone(false);
                save({ status: "done" }, "Marked done");
              }}
            >
              Mark done
            </Button>
          </>
        }
      >
        <p>{openItems} checklist {openItems === 1 ? "item is" : "items are"} still open.</p>
      </Dialog>

      <Dialog
        open={logOpen}
        onClose={() => setLogOpen(false)}
        title="Log time"
        footer={
          <>
            <Button variant="ghost" onClick={() => setLogOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" form="tk-log" disabled={pending}>Log time</Button>
          </>
        }
      >
        <form id="tk-log" onSubmit={onLog}>
          <FormGrid>
            <Field label="Date" htmlFor="tk-log-date">
              <Input id="tk-log-date" name="date" type="date" defaultValue={today} max={today} required />
            </Field>
            <Field label="Time spent" htmlFor="tk-log-spent">
              <Input id="tk-log-spent" name="spent" required placeholder="1h 30m" />
            </Field>
            <Field label="What you did" htmlFor="tk-log-note" full>
              <Textarea id="tk-log-note" name="note" rows={2} maxLength={500} />
            </Field>
            <Checkbox name="billable" label="Billable" defaultChecked />
          </FormGrid>
        </form>
      </Dialog>
    </Card>
  );
}

function TimerControl({ ticketId, timer }: { ticketId: string; timer: TicketDetail["timer"] }) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!timer) return;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [timer]);

  const sec = timer && now ? Math.max(0, Math.floor((now - new Date(timer.startedAt).getTime()) / 1000)) : 0;

  function toggle() {
    start(async () => {
      if (timer) {
        const r = await stopTimer(timer.id);
        toast(!r.ok ? r.error : r.data?.minutes ? `Logged ${fmtMinutes(r.data.minutes)}` : "Under a minute, nothing logged");
      } else {
        const r = await startTimer({ ticketId });
        toast(r.ok ? "Timer started" : r.error);
      }
      router.refresh();
    });
  }

  return (
    <span className="row" style={{ flexWrap: "nowrap" }}>
      <span className={s.timer}>{fmtClock(sec)}</span>
      <Button size="sm" variant={timer ? "default" : "primary"} onClick={toggle} disabled={pending}>
        {timer ? "Stop" : "Start timer"}
      </Button>
    </span>
  );
}

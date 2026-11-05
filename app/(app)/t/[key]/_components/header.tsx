"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Checkbox, Dialog, Field, FormGrid, Input, Select, useToast } from "@/components/ui";
import { copyTicket, deleteTicket, setWatching, updateTicket } from "@/lib/modules/tickets/actions";
import type { PriorityLevel, ProjectOpt } from "@/lib/modules/tickets/types";
import { saveRule } from "@/features/work-p2/actions";
import { WEEKDAYS } from "@/features/work-p2/logic";
import { cn } from "@/lib/utils";
import s from "./ticket.module.css";

/** Click-to-edit title. Enter saves, Esc cancels, blur saves. */
export function TicketTitle({ id, title, canEdit }: { id: string; title: string; canEdit: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [, start] = useTransition();

  function save(v: string) {
    setEditing(false);
    const next = v.trim();
    if (!next || next === title) return;
    start(async () => {
      const r = await updateTicket({ id, patch: { title: next } });
      toast(r.ok ? "Title saved" : r.error);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <input
        className={s.titleInput}
        defaultValue={title}
        aria-label="Ticket title"
        autoFocus
        maxLength={200}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={(e) => save(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }
  return (
    <h2
      className={cn(s.title, canEdit && s.editable)}
      title={canEdit ? "Click to edit" : undefined}
      tabIndex={canEdit ? 0 : undefined}
      onClick={() => canEdit && setEditing(true)}
      onKeyDown={(e) => canEdit && e.key === "Enter" && setEditing(true)}
    >
      {title}
    </h2>
  );
}

type ActionsProps = {
  id: string;
  ticketKey: string;
  title: string;
  projectId: string | null;
  projects: ProjectOpt[];
  watching: boolean;
  canEdit: boolean;
  canDelete: boolean;
  assigneeId: string | null;
  priority: PriorityLevel;
  today: string;
  /** Can set up a recurring rule (work.recurring.manage). Needs a project, since rules always have one. */
  canRepeat: boolean;
  fileCount: number;
  commentCount: number;
};

/** Watch, Copy link, Copy to…, Repeat…, Delete. */
export function HeaderActions(p: ActionsProps) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [dlg, setDlg] = useState<"" | "copy" | "repeat" | "delete">("");
  const [freq, setFreq] = useState("monthly");

  function watch() {
    start(async () => {
      const r = await setWatching({ ticketId: p.id, on: !p.watching });
      toast(!r.ok ? r.error : p.watching ? "Stopped watching" : "You will get updates on this ticket");
      router.refresh();
    });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(`${location.origin}/t/${p.ticketKey}`);
      toast("Link copied");
    } catch {
      toast("Couldn't copy. Copy the address bar instead.");
    }
  }

  function onCopy(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await copyTicket({
        id: p.id,
        projectId: String(fd.get("project") ?? "") || null,
        title: String(fd.get("title") ?? ""),
        checklist: fd.get("checklist") === "on",
        subtasks: fd.get("subtasks") === "on",
        assignees: fd.get("assignees") === "on",
      });
      if (!r.ok || !r.data) return toast(r.ok ? "Couldn't copy the ticket." : r.error);
      setDlg("");
      toast(`Copied as ${r.data.key}`);
      router.push(`/t/${r.data.key}`);
    });
  }

  function onRepeat(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await saveRule({
        titlePattern: String(fd.get("title") ?? ""),
        projectId: p.projectId,
        assigneeId: p.assigneeId,
        priority: p.priority,
        frequency: freq,
        weekday: freq === "weekly" ? fd.get("weekday") : null,
        monthDay: freq === "monthly" ? fd.get("monthDay") : null,
        dueOffsetDays: fd.get("dueOffsetDays"),
        startsOn: String(fd.get("startsOn") ?? ""),
      });
      if (!r.ok) return toast(r.error);
      setDlg("");
      toast("Recurring rule created");
    });
  }

  function onDelete() {
    start(async () => {
      const r = await deleteTicket(p.id);
      if (!r.ok) return toast(r.error);
      toast(`${p.ticketKey} deleted`);
      router.push("/tickets");
    });
  }

  return (
    <div className="row">
      <Button size="sm" onClick={watch} disabled={pending}>{p.watching ? "Watching" : "Watch"}</Button>
      <Button size="sm" onClick={copyLink}>Copy link</Button>
      {p.canEdit ? <Button size="sm" onClick={() => setDlg("copy")}>Copy to…</Button> : null}
      {p.canRepeat && p.projectId ? <Button size="sm" onClick={() => setDlg("repeat")}>Repeat…</Button> : null}
      {p.canDelete ? <Button size="sm" variant="danger" onClick={() => setDlg("delete")}>Delete</Button> : null}

      <Dialog
        open={dlg === "copy"}
        onClose={() => setDlg("")}
        title="Copy ticket"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDlg("")}>Cancel</Button>
            <Button variant="primary" type="submit" form="tk-copy" disabled={pending}>Copy ticket</Button>
          </>
        }
      >
        <form id="tk-copy" onSubmit={onCopy}>
          <FormGrid>
            <Field label="Copy to project" htmlFor="tk-copy-project" full>
              <Select id="tk-copy-project" name="project" defaultValue={p.projectId ?? ""}>
                <option value="">No project</option>
                {p.projects.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
              </Select>
            </Field>
            <Field label="New title" htmlFor="tk-copy-title" full>
              <Input id="tk-copy-title" name="title" required maxLength={200} defaultValue={`Copy of: ${p.title}`.slice(0, 200)} />
            </Field>
            <Checkbox name="checklist" label="Checklist" defaultChecked />
            <Checkbox name="subtasks" label="Subtasks" defaultChecked />
            <Checkbox name="assignees" label="Assignees" />
          </FormGrid>
        </form>
      </Dialog>

      <Dialog
        open={dlg === "repeat"}
        onClose={() => setDlg("")}
        title="Repeat this ticket"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDlg("")}>Cancel</Button>
            <Button variant="primary" type="submit" form="tk-repeat" disabled={pending}>Create rule</Button>
          </>
        }
      >
        <form id="tk-repeat" onSubmit={onRepeat}>
          <FormGrid>
            <Field label="Ticket title" htmlFor="tk-repeat-title" hint="Use {client}, {project}, {month} or {date}" full>
              <Input id="tk-repeat-title" name="title" required minLength={2} maxLength={200} defaultValue={p.title.slice(0, 200)} />
            </Field>
            <Field label="Repeats" htmlFor="tk-repeat-freq">
              <Select id="tk-repeat-freq" value={freq} onChange={(e) => setFreq(e.target.value)}>
                <option value="daily">Daily</option>
                <option value="weekdays">Weekdays</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </Select>
            </Field>
            {freq === "weekly" ? (
              <Field label="Day" htmlFor="tk-repeat-wd">
                <Select id="tk-repeat-wd" name="weekday" defaultValue="1">
                  {WEEKDAYS.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}
                </Select>
              </Field>
            ) : freq === "monthly" ? (
              <Field label="Day of month" htmlFor="tk-repeat-md">
                <Input id="tk-repeat-md" name="monthDay" type="number" min={1} max={28} defaultValue={1} required />
              </Field>
            ) : (
              <div />
            )}
            <Field label="Due after (days)" htmlFor="tk-repeat-due">
              <Input id="tk-repeat-due" name="dueOffsetDays" type="number" min={0} max={90} defaultValue={5} required />
            </Field>
            <Field label="Start" htmlFor="tk-repeat-start">
              <Input id="tk-repeat-start" name="startsOn" type="date" defaultValue={p.today} required />
            </Field>
          </FormGrid>
        </form>
      </Dialog>

      <Dialog
        open={dlg === "delete"}
        onClose={() => setDlg("")}
        title={`Delete ${p.ticketKey}?`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDlg("")}>Keep ticket</Button>
            <Button variant="primary-danger" onClick={onDelete} disabled={pending}>Delete ticket</Button>
          </>
        }
      >
        <p>
          This removes the ticket, its checklist, subtasks, {p.fileCount} {p.fileCount === 1 ? "file" : "files"} and {p.commentCount}{" "}
          {p.commentCount === 1 ? "comment" : "comments"}. You can&apos;t undo this.
        </p>
      </Dialog>
    </div>
  );
}

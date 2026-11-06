"use client";

import Link from "next/link";
import { Fragment, useOptimistic, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronRight, CornerDownRight, Plus } from "lucide-react";
import { Button, Priority, Seg, useToast } from "@/components/ui";
import { createProjectTask } from "@/lib/modules/work/space-actions";
import { updateTicket } from "@/lib/modules/tickets/actions";
import type { ProjectTask, StatusKey, TaskType, WorkConfig } from "@/lib/modules/work/space-types";
import { cn } from "@/lib/utils";
import { DueLabel } from "../../../../tickets/_components/bits";
import s from "../tasks.module.css";
import { landingIndex, moveTask } from "./kanban-move";

const ORDER: StatusKey[] = ["todo", "in_progress", "in_review", "blocked", "done"];

type View = "table" | "kanban";
type Props = { projectId: string; tasks: ProjectTask[]; config: WorkConfig; view: View; today: string; canEdit: boolean };

export function TasksView({ projectId, tasks, config, view, today, canEdit }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [pending, start] = useTransition();

  const viewQs = view === "kanban" ? "view=kanban&" : "";
  const taskHref = (key: string) => `${pathname}?${viewQs}task=${encodeURIComponent(key)}`;

  // Groups and Kanban list main tasks only; subtasks show under their main task.
  const mains = tasks.filter((t) => !t.parentId);
  const subsOf = new Map<string, ProjectTask[]>();
  for (const t of tasks) if (t.parentId) subsOf.set(t.parentId, [...(subsOf.get(t.parentId) ?? []), t]);

  // Both "+ Add new" and the inline row create here; the new task opens in the panel.
  function create(title: string, done?: () => void) {
    start(async () => {
      const r = await createProjectTask({ projectId, title });
      if (!r.ok) return toast(r.error ?? "Couldn't create the task");
      done?.();
      router.push(taskHref(r.key), { scroll: false });
    });
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="row" style={{ gap: 12 }}>
        <Button variant="primary" onClick={() => create("New task")} disabled={pending}>
          <Plus size={16} aria-hidden="true" /> Add new
        </Button>
        <Seg
          label="View"
          value={view}
          items={[
            { value: "table", label: "Table view", href: pathname },
            { value: "kanban", label: "Kanban", href: `${pathname}?view=kanban` },
          ]}
        />
      </div>

      {view === "kanban" ? (
        <Kanban tasks={mains} subsOf={subsOf} config={config} taskHref={taskHref} today={today} canEdit={canEdit} />
      ) : (
        <>
          <Group title="Open tasks" rows={mains.filter((t) => t.status !== "done")} subsOf={subsOf} config={config} taskHref={taskHref} today={today} defaultOpen>
            <CreateRow pending={pending} onCreate={create} />
          </Group>
          <Group title="Completed" rows={mains.filter((t) => t.status === "done")} subsOf={subsOf} config={config} taskHref={taskHref} today={today} />
        </>
      )}
    </div>
  );
}

type GroupProps = {
  title: string;
  rows: ProjectTask[];
  subsOf: Map<string, ProjectTask[]>;
  config: WorkConfig;
  taskHref: (key: string) => string;
  today: string;
  defaultOpen?: boolean;
  children?: React.ReactNode;
};

function Group({ title, rows, subsOf, config, taskHref, today, defaultOpen = false, children }: GroupProps) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const [folded, setFolded] = useState<Set<string>>(() => new Set());
  const types = Object.fromEntries(config.taskTypes.map((x) => [x.id, x]));

  function toggleFold(id: string) {
    setFolded((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  return (
    <section className={s.group}>
      <button type="button" className={s.groupHead} aria-expanded={open} onClick={() => setOpen(!open)}>
        <ChevronRight size={16} aria-hidden="true" className={cn(s.chev, open && s.chevOpen)} />
        <span className={s.groupTitle}>{title}</span>
        <span className="muted">{rows.length}</span>
      </button>
      {open ? (
        <div className="table-wrap">
          <table className={cn("tbl", s.tbl)}>
            <thead>
              <tr>
                <th scope="col">Title</th>
                <th scope="col">Status</th>
                <th scope="col">Type</th>
                <th scope="col">Assignee</th>
                <th scope="col">Due date</th>
                <th scope="col">Priority</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const subs = subsOf.get(t.id) ?? [];
                const isFolded = folded.has(t.id);
                const go = (key: string) => router.push(taskHref(key), { scroll: false });
                return (
                  <Fragment key={t.id}>
                    <tr className={s.row} onClick={() => go(t.key)}>
                      <td>
                        {subs.length ? (
                          <button
                            type="button"
                            className={s.rowChev}
                            aria-expanded={!isFolded}
                            aria-label={isFolded ? "Show subtasks" : "Hide subtasks"}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFold(t.id);
                            }}
                          >
                            <ChevronRight size={14} aria-hidden="true" className={cn(s.chev, !isFolded && s.chevOpen)} />
                          </button>
                        ) : null}
                        <Link href={taskHref(t.key)} scroll={false} className={s.rowTitle} onClick={(e) => e.stopPropagation()}>
                          {t.title}
                        </Link>
                        {subs.length ? <SubCount subs={subs} /> : null}
                      </td>
                      <Cells t={t} config={config} types={types} today={today} />
                    </tr>
                    {isFolded
                      ? null
                      : subs.map((sub) => (
                          <tr key={sub.id} className={cn(s.row, s.subRow)} onClick={() => go(sub.key)}>
                            <td>
                              <CornerDownRight size={14} aria-hidden="true" className={s.subIcon} />{" "}
                              <Link
                                href={taskHref(sub.key)}
                                scroll={false}
                                className={cn(s.subTitle, sub.status === "done" && s.subDone)}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {sub.title}
                              </Link>
                            </td>
                            <Cells t={sub} config={config} types={types} today={today} />
                          </tr>
                        ))}
                  </Fragment>
                );
              })}
              {children}
              {!rows.length && !children ? (
                <tr>
                  <td colSpan={6} className="muted">Nothing here yet.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

/** The five columns after Title, shared by main and subtask rows. */
function Cells({ t, config, types, today }: { t: ProjectTask; config: WorkConfig; types: Record<string, TaskType>; today: string }) {
  const st = config.statuses[t.status];
  const ty = t.typeId ? types[t.typeId] : undefined;
  return (
    <>
      <td className={s.nowrap}>{st ? `${st.emoji} ${st.label}` : t.status}</td>
      <td className={s.nowrap}>
        {ty ? (
          <span className={s.type}>
            <span className={s.swatch} style={{ background: ty.color }} aria-hidden="true" /> {ty.name}
          </span>
        ) : (
          <span className="muted">None</span>
        )}
      </td>
      <td className={s.nowrap}>{t.assigneeName ?? <span className="muted">Unassigned</span>}</td>
      <td className={s.nowrap}>
        <DueLabel due={t.dueDate} status={t.status} today={today} />
      </td>
      <td>
        <Priority level={t.priority} />
      </td>
    </>
  );
}

/** Muted "done/total" subtask count. */
function SubCount({ subs }: { subs: ProjectTask[] }) {
  const done = subs.filter((x) => x.status === "done").length;
  return (
    <span className={s.count} aria-label={`${done} of ${subs.length} subtasks done`}>
      {done}/{subs.length}
    </span>
  );
}

/** Last row of "Open tasks": a "+ Create task" button that turns into an input. Enter creates, Esc cancels. */
function CreateRow({ pending, onCreate }: { pending: boolean; onCreate: (title: string, done?: () => void) => void }) {
  const [editing, setEditing] = useState(false);
  return (
    <tr>
      <td colSpan={6}>
        {editing ? (
          <input
            className={s.createInput}
            autoFocus
            maxLength={200}
            placeholder="Task title"
            aria-label="New task title"
            disabled={pending}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditing(false);
              if (e.key === "Enter") {
                const v = e.currentTarget.value.trim();
                if (v) onCreate(v, () => setEditing(false));
              }
            }}
            onBlur={(e) => !e.currentTarget.value.trim() && setEditing(false)}
          />
        ) : (
          <button type="button" className={s.createBtn} onClick={() => setEditing(true)}>
            <Plus size={15} aria-hidden="true" /> Create task
          </button>
        )}
      </td>
    </tr>
  );
}

type KanbanProps = {
  tasks: ProjectTask[];
  subsOf: Map<string, ProjectTask[]>;
  config: WorkConfig;
  taskHref: (key: string) => string;
  today: string;
  canEdit: boolean;
};

/** Drag a card to another column (or use its "Move to" select) to change its status. No reordering: tasks have no sort column. */
function Kanban({ tasks, subsOf, config, taskHref, today, canEdit }: KanbanProps) {
  const router = useRouter();
  const toast = useToast();
  const [, start] = useTransition();
  const [items, move] = useOptimistic(tasks, (cur: ProjectTask[], m: { id: string; status: StatusKey }) => moveTask(cur, m.id, m.status));
  const [drag, setDrag] = useState<{ id: string; height: number } | null>(null);
  const [over, setOver] = useState<StatusKey | null>(null);
  const types = Object.fromEntries(config.taskTypes.map((x) => [x.id, x]));
  const dragged = drag ? items.find((t) => t.id === drag.id) : undefined;

  function setStatus(t: ProjectTask, status: StatusKey) {
    if (t.status === status) return;
    start(async () => {
      move({ id: t.id, status });
      const r = await updateTicket({ id: t.id, patch: { status } });
      // On failure the transition ends with the old props, so the card goes back by itself.
      if (!r.ok) toast(r.error ?? "Couldn't move the task");
    });
  }

  function endDrag() {
    setDrag(null);
    setOver(null);
  }

  return (
    <div className="board">
      {ORDER.map((st) => {
        const list = items.filter((t) => t.status === st);
        const head = config.statuses[st];
        const slotAt = dragged && over === st && dragged.status !== st ? landingIndex(items, dragged.id, st) : -1;
        const slot = <div className={s.slot} style={{ height: drag?.height }} aria-hidden="true" />;
        return (
          <div
            key={st}
            className={cn("col", s.col, over === st && "drop")}
            onDragOver={(e) => {
              if (!drag) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (over !== st) setOver(st);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragged) setStatus(dragged, st);
              endDrag();
            }}
          >
            <div className="col-head">
              <span>{head.emoji} {head.label}</span> <span className="muted">{list.length}</span>
            </div>
            {list.map((t, i) => {
              const ty = t.typeId ? types[t.typeId] : undefined;
              const subs = subsOf.get(t.id) ?? [];
              return (
                <Fragment key={t.id}>
                  {i === slotAt ? slot : null}
                  <article
                    className={cn("kcard", s.kcard, canEdit && s.kDrag, drag?.id === t.id && "dragging")}
                    draggable={canEdit}
                    onClick={() => router.push(taskHref(t.key), { scroll: false })}
                    onDragStart={(e) => {
                      const el = e.currentTarget;
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", t.key);
                      // The browser snapshots the drag image after this handler: lift the card for that
                      // snapshot only, then dim the original left in the column.
                      el.classList.add(s.lift);
                      const height = el.offsetHeight;
                      setTimeout(() => {
                        el.classList.remove(s.lift);
                        setDrag({ id: t.id, height });
                      }, 0);
                    }}
                    onDragEnd={endDrag}
                  >
                    <Link href={taskHref(t.key)} scroll={false} className={s.kTitle} draggable={false} onClick={(e) => e.stopPropagation()}>
                      {t.title}
                    </Link>
                    <span className={s.kFoot}>
                      {ty ? (
                        <span className={s.type}>
                          <span className={s.swatch} style={{ background: ty.color }} aria-hidden="true" /> {ty.name}
                        </span>
                      ) : null}
                      <DueLabel due={t.dueDate} status={t.status} today={today} />
                      <Priority level={t.priority} />
                      {subs.length ? <SubCount subs={subs} /> : null}
                    </span>
                    {t.assigneeName || canEdit ? (
                      <span className={s.kBottom}>
                        {t.assigneeName ? <span className="muted small">{t.assigneeName}</span> : <span />}
                        {canEdit ? (
                          <select
                            className={s.kMove}
                            aria-label={`Move ${t.key} to`}
                            value={t.status}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setStatus(t, e.target.value as StatusKey)}
                          >
                            {ORDER.map((x) => (
                              <option key={x} value={x}>{config.statuses[x].label}</option>
                            ))}
                          </select>
                        ) : null}
                      </span>
                    ) : null}
                  </article>
                </Fragment>
              );
            })}
            {slotAt === list.length ? slot : null}
          </div>
        );
      })}
    </div>
  );
}

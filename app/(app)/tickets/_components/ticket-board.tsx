"use client";

import Link from "next/link";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ListChecks, MessageSquare, Plus } from "lucide-react";
import { Avatar, Priority, TicketStatusDot, useToast } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { daysLeft, STATUSES, STATUS_LABEL } from "@/lib/modules/tickets/logic";
import { createTicket, updateTicket } from "@/lib/modules/tickets/actions";
import { projectTint } from "@/lib/modules/work/project-colors";
import type { TicketRow, TicketStatus } from "@/lib/modules/tickets/types";
import { cn } from "@/lib/utils";
import s from "./tickets.module.css";

export type BoardTicket = Pick<TicketRow, "id" | "key" | "title" | "status" | "priority" | "assigneeId" | "coAssigneeIds" | "due" | "checkDone" | "checkTotal" | "commentCount"> &
  Partial<Pick<TicketRow, "projectId">>;

type Props = {
  rows: BoardTicket[];
  names: Record<string, string>;
  /** Project id to its colour. Cards without a project stay on the plain surface. */
  colors?: Record<string, string | null>;
  today: string;
  canEdit: boolean;
  /** Project for tasks made with quick add (the active project filter). */
  defaultProject?: string;
};

/** Kanban board: drag a card to another column to change its status. Live-updates from Supabase Realtime. */
export function TicketBoard({ rows, names, colors = {}, today, canEdit, defaultProject }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [, start] = useTransition();
  const [creating, startCreate] = useTransition();
  const [items, move] = useOptimistic(rows, (cur: BoardTicket[], m: { id: string; status: TicketStatus }) =>
    cur.map((t) => (t.id === m.id ? { ...t, status: m.status } : t)),
  );
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<TicketStatus | null>(null);
  // The card that just changed column plays a short settle when it mounts there.
  const [settledId, setSettledId] = useState<string | null>(null);
  // Phones show one column at a time, picked from the tabs above the board.
  const [tab, setTab] = useState<TicketStatus>("todo");
  // Column whose quick-add input is open.
  const [adding, setAdding] = useState<TicketStatus | null>(null);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Someone else moved a ticket: refetch (debounced).
  useEffect(() => {
    const db = createClient();
    const ch = db
      .channel("tickets-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, () => {
        clearTimeout(refreshTimer.current);
        refreshTimer.current = setTimeout(() => router.refresh(), 400);
      })
      .subscribe();
    return () => {
      clearTimeout(refreshTimer.current);
      db.removeChannel(ch);
    };
  }, [router]);

  function drop(status: TicketStatus) {
    const t = items.find((x) => x.id === dragId);
    setDragId(null);
    setOver(null);
    if (t) setStatus(t, status);
  }

  // Shared by drag and drop and the keyboard "Move to" select.
  function setStatus(t: BoardTicket, status: TicketStatus) {
    if (t.status === status) return;
    setSettledId(t.id);
    start(async () => {
      move({ id: t.id, status });
      const r = await updateTicket({ id: t.id, patch: { status } });
      if (!r.ok) return toast(r.error);
      toast(`${t.key} moved to ${STATUS_LABEL[status]}`);
      router.refresh();
    });
  }

  function quickAdd(status: TicketStatus, input: HTMLInputElement) {
    const title = input.value.trim();
    if (title.length < 2) return toast("Give the task a title of at least 2 characters.");
    startCreate(async () => {
      const r = await createTicket({ title, status, projectId: defaultProject || null });
      if (!r.ok || !r.data) return toast(r.ok ? "Couldn't create the task." : r.error);
      input.value = "";
      setAdding(null);
      toast(`${r.data.key} created`);
      router.refresh();
    });
  }

  return (
    <>
      <div className={s.colTabs} role="group" aria-label="Column">
        {STATUSES.map((st) => (
          <button key={st} type="button" aria-pressed={tab === st} onClick={() => setTab(st)}>
            {STATUS_LABEL[st]} <span className={s.colN}>{items.filter((t) => t.status === st).length}</span>
          </button>
        ))}
      </div>
      <div className={cn("board", s.board)}>
        {STATUSES.map((st) => {
          const list = items.filter((t) => t.status === st);
          return (
            <div
              key={st}
              className={cn("col", over === st && "drop", tab !== st && s.colOff)}
              onDragOver={(e) => {
                if (!dragId) return;
                e.preventDefault();
                setOver(st);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                drop(st);
              }}
            >
              <div className="col-head">
                <TicketStatusDot status={st} /> <span className={s.colN}>{list.length}</span>
              </div>
              {list.map((t) => {
                const due = t.due && t.status !== "done" ? daysLeft(t.due, today) : null;
                const assignee = t.assigneeId ? names[t.assigneeId] : undefined;
                return (
                  <article
                    key={t.id}
                    className={cn("kcard card-lift card-press", dragId === t.id && "dragging", settledId === t.id && "card-settle")}
                    style={t.projectId ? { background: projectTint(colors[t.projectId]) } : undefined}
                    draggable={canEdit}
                    onDragStart={(e) => {
                      setDragId(t.id);
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", t.key);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setOver(null);
                    }}
                  >
                    <div className={s.kHead}>
                      {assignee ? <Avatar name={assignee} size={24} /> : null}
                      <Link href={`/t/${t.key}`} className={s.kTitle} title={t.title}>{t.title}</Link>
                    </div>
                    <div className={s.kMeta}>
                      {due ? <span className={cn("num", due.overdue && s.kOverdue)}>{due.label}</span> : null}
                      {t.checkTotal ? (
                        <span className="num row" style={{ gap: 4 }} title="Checklist">
                          <ListChecks size={14} aria-hidden="true" /> {t.checkDone}/{t.checkTotal}
                        </span>
                      ) : null}
                      {t.commentCount ? (
                        <span className="num row" style={{ gap: 4 }} title="Comments">
                          <MessageSquare size={14} aria-hidden="true" /> {t.commentCount}
                        </span>
                      ) : null}
                      {t.status === "blocked" ? <span className={s.kBlocked}>Blocked</span> : null}
                    </div>
                    <div className={s.kFoot}>
                      <span className={s.key}>{t.key}</span>
                      <Priority level={t.priority} />
                      {canEdit ? (
                        <select
                          className={s.kMove}
                          aria-label={`Move ${t.key} to`}
                          value={t.status}
                          onChange={(e) => setStatus(t, e.target.value as TicketStatus)}
                        >
                          {STATUSES.map((x) => (
                            <option key={x} value={x}>{STATUS_LABEL[x]}</option>
                          ))}
                        </select>
                      ) : null}
                    </div>
                  </article>
                );
              })}
              {canEdit ? (
                adding === st ? (
                  <input
                    className={s.quickAdd}
                    autoFocus
                    maxLength={200}
                    placeholder="Task title, then Enter"
                    aria-label={`New task in ${STATUS_LABEL[st]}`}
                    disabled={creating}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        quickAdd(st, e.currentTarget);
                      } else if (e.key === "Escape") setAdding(null);
                    }}
                    onBlur={(e) => {
                      if (!e.currentTarget.value.trim() && !creating) setAdding(null);
                    }}
                  />
                ) : (
                  <button type="button" className={s.addTask} onClick={() => setAdding(st)}>
                    <Plus size={14} aria-hidden="true" /> Add task
                  </button>
                )
              ) : null}
            </div>
          );
        })}
      </div>
    </>
  );
}

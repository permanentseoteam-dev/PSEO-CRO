"use client";

import Link from "next/link";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ListChecks } from "lucide-react";
import { Priority, TicketStatusDot, useToast } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { STATUSES, STATUS_LABEL } from "@/lib/modules/tickets/logic";
import { updateTicket } from "@/lib/modules/tickets/actions";
import type { TicketRow, TicketStatus } from "@/lib/modules/tickets/types";
import { cn } from "@/lib/utils";
import { DueLabel, People } from "./bits";
import s from "./tickets.module.css";

export type BoardTicket = Pick<TicketRow, "id" | "key" | "title" | "status" | "priority" | "assigneeId" | "coAssigneeIds" | "due" | "checkDone" | "checkTotal">;

/** Kanban board: drag a card to another column to change its status. Live-updates from Supabase Realtime. */
export function TicketBoard({ rows, names, today, canEdit }: { rows: BoardTicket[]; names: Record<string, string>; today: string; canEdit: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [, start] = useTransition();
  const [items, move] = useOptimistic(rows, (cur: BoardTicket[], m: { id: string; status: TicketStatus }) =>
    cur.map((t) => (t.id === m.id ? { ...t, status: m.status } : t)),
  );
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<TicketStatus | null>(null);
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
    start(async () => {
      move({ id: t.id, status });
      const r = await updateTicket({ id: t.id, patch: { status } });
      if (!r.ok) return toast(r.error);
      toast(`${t.key} moved to ${STATUS_LABEL[status]}`);
      router.refresh();
    });
  }

  return (
    <div className="board">
      {STATUSES.map((st) => {
        const list = items.filter((t) => t.status === st);
        return (
          <div
            key={st}
            className={cn("col", over === st && "drop")}
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
            {list.map((t) => (
              <article
                key={t.id}
                className={cn("kcard", dragId === t.id && "dragging")}
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
                <div className={s.kTop}>
                  <span className={s.key}>{t.key}</span>
                  <Priority level={t.priority} />
                </div>
                <Link href={`/t/${t.key}`} className={s.kTitle}>{t.title}</Link>
                <div className={s.kFoot}>
                  <People ids={[t.assigneeId, ...t.coAssigneeIds]} names={names} size={22} />
                  <DueLabel due={t.due} status={t.status} today={today} />
                  {t.checkTotal ? (
                    <span className="num row" style={{ gap: 4 }} title="Checklist">
                      <ListChecks size={14} aria-hidden="true" /> {t.checkDone}/{t.checkTotal}
                    </span>
                  ) : null}
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
            ))}
          </div>
        );
      })}
    </div>
  );
}

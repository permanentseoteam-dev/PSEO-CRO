"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/components/ui";
import { fmtDate, monthCells, monthLabel } from "@/lib/modules/tickets/logic";
import { updateTicket } from "@/lib/modules/tickets/actions";
import type { TicketRow } from "@/lib/modules/tickets/types";
import { cn } from "@/lib/utils";
import s from "./tickets.module.css";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Props = { rows: TicketRow[]; month: string; today: string; canEdit: boolean; prevHref: string; nextHref: string; todayHref: string };

/** Month calendar of due dates. Drag a ticket to another day to change its due date. */
export function TicketCalendar({ rows, month, today, canEdit, prevHref, nextHref, todayHref }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [, start] = useTransition();
  const [items, setDue] = useOptimistic(rows, (cur: TicketRow[], m: { id: string; due: string }) =>
    cur.map((t) => (t.id === m.id ? { ...t, due: m.due } : t)),
  );
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());

  function drop(date: string) {
    const t = items.find((x) => x.id === dragId);
    setDragId(null);
    setOver(null);
    if (!t || t.due === date) return;
    start(async () => {
      setDue({ id: t.id, due: date });
      const r = await updateTicket({ id: t.id, patch: { due: date } });
      if (!r.ok) return toast(r.error);
      toast(`${t.key} due ${fmtDate(date)}`);
      router.refresh();
    });
  }

  const tone = (t: TicketRow) => (t.status === "done" ? "t-ok" : t.due! < today ? "t-danger" : t.status === "blocked" ? "t-warn" : "");

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="row between">
        <h3 style={{ margin: 0 }}>{monthLabel(month)}</h3>
        <div className="row">
          <Link className="btn sm ghost" href={prevHref} aria-label="Previous month"><ChevronLeft size={16} /></Link>
          <Link className="btn sm" href={todayHref}>Today</Link>
          <Link className="btn sm ghost" href={nextHref} aria-label="Next month"><ChevronRight size={16} /></Link>
        </div>
      </div>
      <div className="table-wrap">
        <div className="cal-grid" style={{ minWidth: 640 }}>
          {DAYS.map((d) => (
            <div key={d} className="cal-head">{d}</div>
          ))}
          {monthCells(month).map((c) => {
            const evs = items.filter((t) => t.due === c.date);
            const expanded = open.has(c.date);
            const shown = expanded ? evs : evs.slice(0, 2);
            return (
              <div
                key={c.date}
                className={cn("cal-cell", !c.inMonth && "dim", c.date === today && "today", over === c.date && s.over, s.calCell)}
                onDragOver={(e) => {
                  if (!dragId) return;
                  e.preventDefault();
                  setOver(c.date);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  drop(c.date);
                }}
              >
                <span className="d">{Number(c.date.slice(8))}</span>
                {shown.map((t) => (
                  <div
                    key={t.id}
                    className={cn("ev", tone(t), canEdit && s.ev)}
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
                    title={`${t.key} ${t.title}`}
                  >
                    <Link href={`/t/${t.key}`}>{t.key} {t.title}</Link>
                  </div>
                ))}
                {evs.length > 2 ? (
                  <button
                    type="button"
                    className={s.more}
                    onClick={() =>
                      setOpen((cur) => {
                        const n = new Set(cur);
                        if (expanded) n.delete(c.date);
                        else n.add(c.date);
                        return n;
                      })
                    }
                  >
                    {expanded ? "Show less" : `+${evs.length - 2} more`}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

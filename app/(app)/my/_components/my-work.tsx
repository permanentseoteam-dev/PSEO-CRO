"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Avatar, Button, Card, Checkbox, Priority, Seg, Table, Td, Th, TicketStatusDot } from "@/components/ui";
import { cn } from "@/lib/utils";
import { dueLabel, fmtShort, GROUPS, groupTickets, inView, lastDone, metaLine, VIEWS } from "@/lib/modules/home/logic";
import { TicketBoard, type BoardTicket } from "../../tickets/_components/ticket-board";
import type { MyTicket, View } from "@/lib/modules/home/types";

function Row({ t, today }: { t: MyTicket; today: string }) {
  const d = dueLabel(t.due, today);
  const meta = metaLine(t);
  return (
    <tr>
      <Td num className="whitespace-nowrap">
        <Link href={`/t/${t.key}`}>{t.key}</Link>
      </Td>
      <Td className="min-w-60">
        <Link href={`/t/${t.key}`} className="text-ink">
          {t.title}
        </Link>
        {meta ? <div className="small muted mt-0.5">{meta}</div> : null}
      </Td>
      <Td>
        <TicketStatusDot status={t.status} />
      </Td>
      <Td>
        <Priority level={t.priority} />
      </Td>
      <Td>
        {t.assigneeName ? (
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <Avatar name={t.assigneeName} size={22} />
            <span className="hide-sm">{t.assigneeName}</span>
          </span>
        ) : (
          <span className="muted">Unassigned</span>
        )}
      </Td>
      <Td className="whitespace-nowrap">
        {t.status === "done" ? (
          <span className="muted">{t.doneOn ? `Done ${fmtShort(t.doneOn)}` : "Done"}</span>
        ) : d.tone === "late" ? (
          <span className="text-danger">{d.text}</span>
        ) : d.tone === "today" ? (
          <strong>{d.text}</strong>
        ) : (
          <span className={d.tone === "none" ? "muted" : undefined}>{d.text}</span>
        )}
      </Td>
    </tr>
  );
}

function Group({ id, label, rows, today, empty }: { id: string; label: string; rows: MyTicket[]; today: string; empty: string }) {
  const [open, setOpen] = useState(true);
  return (
    <Card>
      <button
        type="button"
        className="card-head w-full cursor-pointer border-x-0 border-t-0 bg-transparent text-left"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <h3 className={cn("flex items-center gap-1.5", id === "overdue" && "text-danger")}>
          <ChevronDown size={16} className={cn("text-ink-3 transition-transform", !open && "-rotate-90")} aria-hidden="true" />
          {label}
          <span className="muted num font-normal">{rows.length}</span>
        </h3>
      </button>
      {open ? (
        rows.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Key</Th>
                <Th>Title</Th>
                <Th>Status</Th>
                <Th>Priority</Th>
                <Th>Assignee</Th>
                <Th>Due</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <Row key={t.id} t={t} today={today} />
              ))}
            </tbody>
          </Table>
        ) : (
          <div className="empty py-6!">{empty}</div>
        )
      ) : null}
    </Card>
  );
}

export function MyWork({ tickets, meId, today, initialView, initialLayout = "list", canEdit = false }: { tickets: MyTicket[]; meId: string; today: string; initialView: View; initialLayout?: "list" | "board"; canEdit?: boolean }) {
  const [layout, setLayout] = useState<"list" | "board">(initialLayout);
  const [view, setView] = useState<View>(initialView);
  const [q, setQ] = useState("");
  const [showDone, setShowDone] = useState(false);

  const needle = q.trim().toLowerCase();
  const list = tickets
    .filter((t) => inView(t, view, meId))
    .filter((t) => !needle || `${t.key} ${t.title} ${t.projectName ?? ""}`.toLowerCase().includes(needle));
  const groups = groupTickets(list, today);
  const names = Object.fromEntries(tickets.filter((t) => t.assigneeId && t.assigneeName).map((t) => [t.assigneeId!, t.assigneeName!]));
  const boardRows: BoardTicket[] = [...list.filter((t) => t.status !== "done"), ...(showDone ? lastDone(list) : [])].map((t) => ({
    id: t.id, key: t.key, title: t.title, status: t.status, priority: t.priority,
    assigneeId: t.assigneeId, coAssigneeIds: [], due: t.due, checkDone: t.checklistDone, checkTotal: t.checklistTotal,
  }));

  const updateUrl = (nextView: View, nextLayout: "list" | "board") => {
    const params = new URLSearchParams();
    if (nextView !== "assigned") params.set("view", nextView);
    if (nextLayout === "board") params.set("layout", "board");
    window.history.replaceState(null, "", params.size ? "/my?" + params : "/my");
  };
  const pick = (v: string) => {
    setView(v as View);
    updateUrl(v as View, layout);
  };
  const pickLayout = (v: string) => {
    const next = v === "board" ? "board" : "list";
    setLayout(next);
    updateUrl(view, next);
  };

  return (
    <div className="page">
      <div className="row between">
        <Seg
          label="Which tasks"
          value={view}
          onChange={pick}
          items={VIEWS.map(([v, label]) => ({
            value: v,
            label,
            count: tickets.filter((t) => t.status !== "done" && inView(t, v, meId)).length,
          }))}
        />
        <div className="row">
          <Seg label="My work layout" value={layout} onChange={pickLayout} items={[{ value: "list", label: "List" }, { value: "board", label: "Board" }]} />
          <Button
            variant="primary"
            onClick={() => document.querySelector<HTMLButtonElement>("button.new-ticket")?.click()}
          >
            New task
          </Button>
        </div>
      </div>
      <div className="toolbar">
        <input type="search" placeholder="Search my tasks" aria-label="Search my tasks" value={q} onChange={(e) => setQ(e.target.value)} />
        <Checkbox label="Show done tasks" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
      </div>
      {layout === "board" ? <TicketBoard rows={boardRows} names={names} today={today} canEdit={canEdit} /> : (
        <div className="stack gap-4!">
          {GROUPS.map(([g, label]) => (
            <Group key={g} id={g} label={label} rows={groups[g]} today={today} empty="Nothing here." />
          ))}
          {showDone ? <Group id="done" label="Done, last 40" rows={lastDone(list)} today={today} empty="No done tickets yet." /> : null}
        </div>
      )}
    </div>
  );
}

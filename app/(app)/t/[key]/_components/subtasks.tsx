"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Button, Card, CardBody, CardHead, TicketStatusDot, useToast } from "@/components/ui";
import { addSubtask } from "@/lib/modules/tickets/actions";
import type { Person, Subtask } from "@/lib/modules/tickets/types";
import s from "./ticket.module.css";

export function Subtasks({ parentId, items, people, canEdit }: { parentId: string; items: Subtask[]; people: Person[]; canEdit: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [pending, start] = useTransition();
  const done = items.filter((x) => x.status === "done").length;

  function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await addSubtask({ parentId, title: String(fd.get("title") ?? ""), assigneeId: String(fd.get("assignee") ?? "") || null });
      if (!r.ok) return toast(r.error);
      setAdding(false);
      toast(`${r.data?.key ?? "Subtask"} added`);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHead
        title={<>Subtasks <span className="muted num">{done}/{items.length}</span></>}
        actions={canEdit && !adding ? <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>Add subtask</Button> : null}
      />
      <CardBody>
        {adding ? (
          <form className="row" onSubmit={add} style={{ marginBottom: 8 }}>
            <input name="title" required minLength={2} maxLength={200} placeholder="Subtask title" aria-label="Subtask title" style={{ flex: "1 1 200px" }} autoFocus />
            <select name="assignee" aria-label="Assignee" defaultValue="" style={{ width: "auto" }}>
              <option value="">Unassigned</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <Button size="sm" variant="primary" type="submit" disabled={pending}>Add</Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
          </form>
        ) : null}
        {items.length ? (
          <div className="list">
            {items.map((x) => (
              <div key={x.id} className="item between">
                <span style={{ minWidth: 0 }}>
                  <span className={s.key}>{x.key}</span> <Link href={`/t/${x.key}`}>{x.title}</Link>
                </span>
                <span className="row" style={{ flexWrap: "nowrap" }}>
                  <TicketStatusDot status={x.status} />
                  {x.assignee ? <Avatar name={x.assignee} size={22} /> : null}
                </span>
              </div>
            ))}
          </div>
        ) : !adding ? (
          <p className="muted" style={{ margin: 0 }}>No subtasks.</p>
        ) : null}
      </CardBody>
    </Card>
  );
}

"use client";

import { useOptimistic, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, X } from "lucide-react";
import { Button, Card, CardBody, CardHead, IconButton, useToast } from "@/components/ui";
import { addChecklistItem, deleteChecklistItem, reorderChecklist, toggleChecklistItem } from "@/lib/modules/tickets/actions";
import { moveItem } from "@/lib/modules/tickets/logic";
import type { ChecklistItem } from "@/lib/modules/tickets/types";
import { cn } from "@/lib/utils";
import s from "./ticket.module.css";

type Op = { kind: "toggle"; id: string; done: boolean } | { kind: "move"; i: number; dir: -1 | 1 } | { kind: "remove"; id: string };

export function Checklist({ ticketId, items, canEdit }: { ticketId: string; items: ChecklistItem[]; canEdit: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const [list, apply] = useOptimistic(items, (cur: ChecklistItem[], op: Op) => {
    if (op.kind === "toggle") return cur.map((c) => (c.id === op.id ? { ...c, done: op.done } : c));
    if (op.kind === "move") return moveItem(cur, op.i, op.dir);
    return cur.filter((c) => c.id !== op.id);
  });
  const done = list.filter((c) => c.done).length;

  const run = (op: Op, call: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      apply(op);
      const r = await call();
      if (!r.ok) toast(r.error ?? "Couldn't save");
      router.refresh();
    });

  function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const label = input.current?.value.trim();
    if (!label) return;
    start(async () => {
      const r = await addChecklistItem({ ticketId, label });
      if (!r.ok) return toast(r.error);
      if (input.current) input.current.value = "";
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHead title={<>Checklist <span className="muted num">{done}/{list.length}</span></>} />
      <CardBody>
        <div className="bar"><i style={{ width: `${list.length ? Math.round((done / list.length) * 100) : 0}%` }} /></div>
        <div>
          {list.map((c, i) => (
            <div key={c.id} className={cn(s.ckRow, c.done && s.done)}>
              <label>
                <input
                  type="checkbox"
                  checked={c.done}
                  disabled={!canEdit}
                  onChange={(e) => {
                    const v = e.target.checked;
                    run({ kind: "toggle", id: c.id, done: v }, () => toggleChecklistItem({ id: c.id, done: v }));
                  }}
                />
                <span>{c.label}</span>
              </label>
              {canEdit ? (
                <>
                  <IconButton size="sm" label="Move up" disabled={i === 0} onClick={() => run({ kind: "move", i, dir: -1 }, () => reorderChecklist({ ticketId, ids: moveItem(list, i, -1).map((x) => x.id) }))}>
                    <ArrowUp size={14} />
                  </IconButton>
                  <IconButton size="sm" label="Move down" disabled={i === list.length - 1} onClick={() => run({ kind: "move", i, dir: 1 }, () => reorderChecklist({ ticketId, ids: moveItem(list, i, 1).map((x) => x.id) }))}>
                    <ArrowDown size={14} />
                  </IconButton>
                  <IconButton size="sm" label="Remove item" onClick={() => run({ kind: "remove", id: c.id }, () => deleteChecklistItem(c.id))}>
                    <X size={14} />
                  </IconButton>
                </>
              ) : null}
            </div>
          ))}
        </div>
        {canEdit ? (
          <form className="row" onSubmit={add} style={{ marginTop: 8, flexWrap: "nowrap" }}>
            <input ref={input} placeholder="Add an item" aria-label="New checklist item" maxLength={300} style={{ flex: 1 }} />
            <Button size="sm" type="submit" disabled={pending}>Add</Button>
          </form>
        ) : null}
      </CardBody>
    </Card>
  );
}

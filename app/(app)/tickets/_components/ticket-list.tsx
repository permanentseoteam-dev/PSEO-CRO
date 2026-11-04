"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, EmptyState, Priority, Table, Td, Th, TicketStatusDot, useToast } from "@/components/ui";
import { PRIORITIES, PRIORITY_LABEL, STATUSES, STATUS_LABEL, type Group } from "@/lib/modules/tickets/logic";
import { bulkUpdate } from "@/lib/modules/tickets/actions";
import type { Person, ProjectOpt } from "@/lib/modules/tickets/types";
import { DueLabel, People } from "./bits";
import s from "./tickets.module.css";

type Props = { groups: Group[]; names: Record<string, string>; people: Person[]; projects: ProjectOpt[]; today: string; canEdit: boolean; clearHref: string };

export function TicketList({ groups, names, people, projects, today, canEdit, clearHref }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const all = groups.flatMap((g) => g.rows);

  const toggle = (id: string, on: boolean) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  function apply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const v = (k: string) => String(fd.get(k) ?? "");
    const patch: Record<string, string | null> = {};
    if (v("status")) patch.status = v("status");
    if (v("priority")) patch.priority = v("priority");
    if (v("owner")) patch.assigneeId = v("owner") === "none" ? null : v("owner");
    if (v("due")) patch.due = v("due");
    if (v("project")) patch.projectId = v("project");
    start(async () => {
      const r = await bulkUpdate({ ids: [...picked], patch });
      if (!r.ok) return toast(r.error);
      const n = r.data?.updated ?? 0;
      toast(n === picked.size ? `Updated ${n} tickets` : `Updated ${n} of ${picked.size} tickets. You can't edit the rest.`);
      setPicked(new Set());
      router.refresh();
    });
  }

  if (!all.length) {
    return <EmptyState title="No tickets match these filters" action={<Link className="btn sm" href={clearHref}>Clear filters</Link>} />;
  }

  return (
    <div className="stack" style={{ gap: 12 }}>
      {canEdit && picked.size > 0 ? (
        <form className={s.bulk} onSubmit={apply}>
          <strong>{picked.size} selected</strong>
          <select name="status" aria-label="Set status" defaultValue="">
            <option value="">Status…</option>
            {STATUSES.map((x) => <option key={x} value={x}>{STATUS_LABEL[x]}</option>)}
          </select>
          <select name="priority" aria-label="Set priority" defaultValue="">
            <option value="">Priority…</option>
            {PRIORITIES.map((x) => <option key={x} value={x}>{PRIORITY_LABEL[x]}</option>)}
          </select>
          <select name="owner" aria-label="Set owner" defaultValue="">
            <option value="">Owner…</option>
            <option value="none">Unassigned</option>
            {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input type="date" name="due" aria-label="Set due date" />
          <select name="project" aria-label="Move to project" defaultValue="">
            <option value="">Move to project…</option>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <Button type="submit" size="sm" variant="primary" disabled={pending}>Apply</Button>
          <Button size="sm" variant="ghost" onClick={() => setPicked(new Set())}>Clear</Button>
        </form>
      ) : null}

      {groups.map((g) => (
        <div key={g.key} className="stack" style={{ gap: 8 }}>
          {g.label ? (
            <h3 className={s.groupHead}>
              {g.label} <span className="count">{g.rows.length}</span>
            </h3>
          ) : null}
          <Table>
            <thead>
              <tr>
                {canEdit ? (
                  <Th style={{ width: 36 }}>
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={g.rows.every((t) => picked.has(t.id))}
                      onChange={(e) => g.rows.forEach((t) => toggle(t.id, e.target.checked))}
                    />
                  </Th>
                ) : null}
                <Th>Key</Th>
                <Th>Title</Th>
                <Th>Status</Th>
                <Th>Priority</Th>
                <Th hideSm>Assignee</Th>
                <Th>Due</Th>
              </tr>
            </thead>
            <tbody>
              {g.rows.map((t) => (
                <tr
                  key={t.id}
                  className="click"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("input,a,button")) return;
                    router.push(`/t/${t.key}`);
                  }}
                >
                  {canEdit ? (
                    <Td>
                      <input type="checkbox" aria-label={`Select ${t.key}`} checked={picked.has(t.id)} onChange={(e) => toggle(t.id, e.target.checked)} />
                    </Td>
                  ) : null}
                  <Td className={s.key}>{t.key}</Td>
                  <Td>
                    <Link href={`/t/${t.key}`} className={s.title}>{t.title}</Link>
                    {t.tags.length ? <div className={s.tags}>{t.tags.map((x) => `#${x}`).join(" ")}</div> : null}
                  </Td>
                  <Td><TicketStatusDot status={t.status} /></Td>
                  <Td><Priority level={t.priority} /></Td>
                  <Td hideSm><People ids={[t.assigneeId, ...t.coAssigneeIds]} names={names} /></Td>
                  <Td><DueLabel due={t.due} status={t.status} today={today} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      ))}
    </div>
  );
}

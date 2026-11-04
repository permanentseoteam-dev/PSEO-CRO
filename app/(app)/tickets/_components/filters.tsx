"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button, Checkbox, Dialog, Field, FormGrid, Input, useToast } from "@/components/ui";
import { PRIORITIES, PRIORITY_LABEL, toQuery } from "@/lib/modules/tickets/logic";
import { deleteView, saveView } from "@/lib/modules/tickets/actions";
import type { Filters, Person, ProjectOpt, SavedView } from "@/lib/modules/tickets/types";
import s from "./tickets.module.css";

type Props = { filters: Filters; people: Person[]; projects: ProjectOpt[]; tags: string[]; views: SavedView[]; canShare: boolean };

export function TicketFilters({ filters, people, projects, tags, views, canShare }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [q, setQ] = useState(filters.q);
  const [saveOpen, setSaveOpen] = useState(false);
  const [pending, start] = useTransition();

  const go = (patch: Partial<Filters>) => router.replace(`/tickets?${toQuery({ ...filters, ...patch })}`, { scroll: false });

  // Search updates the URL after a short pause.
  useEffect(() => {
    if (q === filters.q) return;
    const id = setTimeout(() => go({ q }), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const sel = (key: keyof Filters) => ({
    value: filters[key],
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => go({ [key]: e.target.value } as Partial<Filters>),
  });

  function onSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await saveView({ name: String(fd.get("name") ?? ""), query: toQuery({ ...filters, month: "" }), shared: fd.get("shared") === "on" });
      if (!r.ok) return toast(r.error);
      setSaveOpen(false);
      toast("View saved");
    });
  }

  function onDelete(v: SavedView) {
    start(async () => {
      const r = await deleteView(v.id);
      toast(r.ok ? `Removed "${v.name}"` : r.error);
    });
  }

  return (
    <>
      <div className="toolbar">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search tickets" aria-label="Search tickets" />
        <select aria-label="Assignee" {...sel("who")}>
          <option value="">Any assignee</option>
          <option value="me">Me</option>
          <option value="team">My team</option>
          <option value="none">Unassigned</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select aria-label="Priority" {...sel("pri")}>
          <option value="">Any priority</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
          ))}
        </select>
        <select aria-label="Due" {...sel("due")}>
          <option value="">Any due date</option>
          <option value="overdue">Overdue</option>
          <option value="today">Due today</option>
          <option value="week">This week</option>
          <option value="none">No due date</option>
        </select>
        <select aria-label="Tag" {...sel("tag")}>
          <option value="">Any tag</option>
          {tags.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select aria-label="Project" {...sel("proj")}>
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        {filters.view === "list" ? (
          <>
            <select aria-label="Group by" {...sel("group")}>
              <option value="">Group: none</option>
              <option value="status">Group: status</option>
              <option value="assignee">Group: assignee</option>
              <option value="project">Group: project</option>
              <option value="priority">Group: priority</option>
              <option value="due">Group: due</option>
            </select>
            <select aria-label="Sort" {...sel("sort")}>
              <option value="due">Sort: due date</option>
              <option value="priority">Sort: priority</option>
              <option value="updated">Sort: last updated</option>
              <option value="key">Sort: key</option>
            </select>
          </>
        ) : null}
        <Button size="sm" onClick={() => setSaveOpen(true)}>Save view</Button>
      </div>

      <div className={s.saved}>
        <span className="muted">Saved views:</span>
        {views.map((v) => (
          <span key={v.id} className="row" style={{ gap: 4 }}>
            <Link href={`/tickets?${v.query}`}>{v.name}</Link>
            {v.mine ? (
              <button type="button" aria-label={`Remove ${v.name}`} title="Remove view" onClick={() => onDelete(v)} disabled={pending}>
                <X size={12} />
              </button>
            ) : null}
          </span>
        ))}
        <Link href={filters.view === "list" ? "/tickets" : `/tickets?view=${filters.view}`} onClick={() => setQ("")}>Clear filters</Link>
      </div>

      <Dialog
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title="Save this view"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSaveOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" form="tk-save-view" disabled={pending}>Save view</Button>
          </>
        }
      >
        <form id="tk-save-view" onSubmit={onSave}>
          <FormGrid>
            <Field label="Name" htmlFor="tk-view-name" full>
              <Input id="tk-view-name" name="name" required maxLength={80} placeholder="My urgent this week" />
            </Field>
            {canShare ? (
              <div className="field full">
                <Checkbox name="shared" label="Share with my department" />
              </div>
            ) : null}
          </FormGrid>
        </form>
      </Dialog>
    </>
  );
}

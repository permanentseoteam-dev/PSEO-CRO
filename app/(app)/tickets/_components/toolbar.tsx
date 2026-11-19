"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Filter, Rows3 } from "lucide-react";
import { Avatar, Button } from "@/components/ui";
import { toQuery } from "@/lib/modules/tickets/logic";
import type { Filters, Person } from "@/lib/modules/tickets/types";
import { cn } from "@/lib/utils";
import s from "./tickets.module.css";

type Props = {
  /** "+ Add new" and the view switch. */
  left: ReactNode;
  /** Extra links on the right (Recurring). */
  right?: ReactNode;
  /** The filter controls; null hides Group, Filter and the people stack (workload view). */
  panel: ReactNode | null;
  filters: Filters;
  people: Person[];
  /** Open the panel on load when any filter is already set. */
  active: boolean;
};

const MAX_FACES = 5;

/** Task toolbar: add and view switch on the left; group, filter and a people stack that filters by assignee on the right. */
export function TaskToolbar({ left, right, panel, filters, people, active }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(active);
  const faces = people.slice(0, MAX_FACES);
  const extra = people.length - faces.length;
  const pick = (id: string) => router.replace(`/tickets?${toQuery({ ...filters, who: filters.who === id ? "" : id })}`, { scroll: false });

  return (
    <>
      <div className={s.headRow}>
        <div className="row">{left}</div>
        <div className="row">
          {right}
          {panel ? (
            <>
              {filters.view === "list" ? (
                <Button aria-expanded={open} onClick={() => setOpen((o) => !o)}>
                  <Rows3 size={16} aria-hidden="true" /> Group
                </Button>
              ) : null}
              <Button aria-expanded={open} onClick={() => setOpen((o) => !o)}>
                <Filter size={16} aria-hidden="true" /> Filter
              </Button>
              {faces.length ? (
                <div className={s.faces} role="group" aria-label="Filter by person">
                  {faces.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={cn(s.face, filters.who === p.id && s.faceOn)}
                      aria-pressed={filters.who === p.id}
                      aria-label={filters.who === p.id ? `Show everyone's tasks` : `Show tasks for ${p.name}`}
                      onClick={() => pick(p.id)}
                    >
                      <Avatar name={p.name} size={30} />
                    </button>
                  ))}
                  {extra > 0 ? (
                    <button type="button" className={cn(s.face, s.faceMore)} aria-label={`${extra} more people: open filters`} onClick={() => setOpen(true)}>
                      +{extra}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
      {panel && open ? panel : null}
    </>
  );
}

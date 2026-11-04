"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Seg, StatusDot } from "@/components/ui";
import { matchesPerson, PRESENCE } from "@/lib/modules/team/logic";
import type { Person } from "@/lib/modules/team/types";
import { AvatarDot } from "./avatar-dot";

export function Directory({ people }: { people: Person[] }) {
  const [dept, setDept] = useState("");
  const [q, setQ] = useState("");
  const depts = useMemo(() => [...new Set(people.map((p) => p.department).filter((d): d is string => !!d))].sort(), [people]);
  const shown = people.filter((p) => matchesPerson(p, dept, q));

  return (
    <>
      <div className="toolbar">
        <Seg
          label="Department"
          value={dept}
          onChange={setDept}
          items={[{ value: "", label: "All" }, ...depts.map((d) => ({ value: d, label: d }))]}
        />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, title or skill" aria-label="Search people" />
      </div>

      {shown.length ? (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
          {shown.map((p) => {
            const pr = PRESENCE[p.presence] ?? PRESENCE.offline;
            return (
              <Link
                key={p.id}
                href={`/people/${p.id}`}
                className="card flex items-start gap-3 p-4 text-ink no-underline hover:border-line-2 hover:no-underline"
              >
                <AvatarDot name={p.name} size={48} presence={p.presence} />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <b>{p.name}</b>
                  {p.title ? <div className="small">{p.title}</div> : null}
                  {p.department ? <div className="small muted">{p.department}</div> : null}
                  <div className="small mt-1.5 flex flex-wrap gap-1.5">
                    <StatusDot tone={pr.tone}>{pr.label}</StatusDot>
                    {p.statusNote ? <span className="muted">{p.statusNote}</span> : null}
                  </div>
                  <div className="small muted">{p.clockedIn ? "Clocked in" : "Not clocked in"}</div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="empty">No one matches. Try another department or search.</div>
      )}
    </>
  );
}

"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui";
import { autoLead } from "@/lib/modules/work/space-logic";
import type { Department } from "@/lib/modules/work/types";

/**
 * Ticked departments (in tick order; first = primary) and the lead, which follows the
 * first ticked department's head until the user picks a lead by hand.
 */
export function useDepartmentsAndLead(departments: Department[], initialIds: string[], initialLead: string) {
  const headOf = (ids: string[]) => ids.map((id) => departments.find((d) => d.id === id)?.headId ?? null);
  const [ids, setIds] = useState(initialIds);
  const [lead, setLead] = useState(initialLead);
  const [lastAuto, setLastAuto] = useState(() => headOf(initialIds).find(Boolean) ?? "");

  function toggle(id: string, on: boolean) {
    const next = on ? [...ids.filter((x) => x !== id), id] : ids.filter((x) => x !== id);
    setIds(next);
    const auto = autoLead(headOf(next), lead, lastAuto);
    if (auto) {
      setLead(auto);
      setLastAuto(auto);
    }
  }
  return { ids, toggle, lead, setLead };
}

export function DepartmentChecks({
  departments,
  value,
  onToggle,
  disabled,
}: {
  departments: Department[];
  value: string[];
  onToggle: (id: string, on: boolean) => void;
  disabled?: boolean;
}) {
  if (!departments.length) return <span className="muted small">No departments yet.</span>;
  return (
    <div role="group" aria-label="Departments" className="grid max-h-40 gap-1.5 overflow-y-auto rounded-[var(--radius-ctl)] border border-line p-2">
      {departments.map((d) => (
        <Checkbox
          key={d.id}
          label={d.name}
          checked={value.includes(d.id)}
          disabled={disabled}
          onChange={(e) => onToggle(d.id, e.target.checked)}
        />
      ))}
    </div>
  );
}

"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui";
import { setTicketType } from "@/lib/modules/work/space-actions";
import type { TaskType } from "@/lib/modules/work/space-types";

/** The Type row for the ticket side panel's property list (a `<dt>/<dd>` pair). */
export function TypeField({ ticketId, typeId, types, canEdit }: { ticketId: string; typeId: string | null; types: TaskType[]; canEdit: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const color = types.find((x) => x.id === typeId)?.color;

  function onChange(v: string) {
    start(async () => {
      const r = await setTicketType({ ticketId, typeId: v || null });
      toast(r.ok ? "Type saved" : r.error ?? "Couldn't save the type");
      router.refresh();
    });
  }

  return (
    <>
      <dt>Type</dt>
      <dd className="row" style={{ flexWrap: "nowrap", gap: 8 }}>
        <span aria-hidden="true" style={{ width: 10, height: 10, flex: "none", borderRadius: 3, background: color ?? "var(--line-2)" }} />
        <select aria-label="Type" value={typeId ?? ""} disabled={!canEdit || pending} onChange={(e) => onChange(e.target.value)}>
          <option value="">No type</option>
          {types.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </dd>
    </>
  );
}

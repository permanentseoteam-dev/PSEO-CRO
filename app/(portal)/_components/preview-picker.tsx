"use client";

import { useTransition } from "react";
import { useToast } from "@/components/ui";
import { setPreviewClient } from "../portal/actions";

/** Staff bar above the portal: which client's portal is shown. */
export function PreviewPicker({ clients, value }: { clients: { id: string; name: string }[]; value: string }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  if (!clients.length) return null;
  return (
    <div className="row" style={{ padding: "12px 24px 0", gap: 8 }}>
      <label htmlFor="portal-preview" className="muted small">
        Previewing the portal as
      </label>
      <select
        id="portal-preview"
        value={value}
        disabled={pending}
        style={{ width: "auto" }}
        onChange={(e) =>
          start(async () => {
            const r = await setPreviewClient(e.target.value);
            if (!r.ok) toast(r.error);
          })
        }
      >
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}

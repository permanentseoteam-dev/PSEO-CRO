"use client";

import { useState, useTransition } from "react";
import { Button, Select, useToast } from "@/components/ui";
import type { Option } from "@/lib/modules/clientops/types";
import { assignClient, markNotClient } from "../actions";

export function NoClientRow({ id, title, meta, clients }: { id: string; title: string; meta: string; clients: Option[] }) {
  const [clientId, setClientId] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();

  function assign() {
    if (!clientId) return toast("Choose a client first");
    start(async () => {
      const res = await assignClient({ meetingId: id, clientId });
      toast(res.ok ? `Assigned to ${clients.find((c) => c.id === clientId)?.name}` : res.error);
    });
  }

  function notClient() {
    start(async () => {
      const res = await markNotClient({ meetingId: id });
      toast(res.ok ? "Marked as not a client call" : res.error);
    });
  }

  return (
    <div className="item flex-wrap justify-between">
      <div className="stack" style={{ gap: 2 }}>
        <strong>{title}</strong>
        <span className="small muted">{meta}</span>
      </div>
      <div className="row">
        <Select aria-label="Client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">Choose client</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Button size="sm" onClick={assign} disabled={pending}>
          Assign
        </Button>
        <Button size="sm" variant="ghost" onClick={notClient} disabled={pending}>
          Not a client call
        </Button>
      </div>
    </div>
  );
}

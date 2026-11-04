"use client";

import { useState, useTransition } from "react";
import { Button, Field, Select, StatusDot, useToast } from "@/components/ui";
import { linkSubAccount, unlinkSubAccount } from "../actions";
import type { Option } from "../types";

type Sub = { childId: string; name: string; billing: "parent" | "own" };

/** Billing clients > Edit billing: "Sub-accounts billed under this client". */
export function SubAccountsField({ clientId, subs, candidates, canEdit }: { clientId: string; subs: Sub[]; candidates: Option[]; canEdit: boolean }) {
  const [adding, setAdding] = useState(false);
  const [pick, setPick] = useState("");
  const [busy, start] = useTransition();
  const toast = useToast();
  const choices = [...candidates, ...subs.filter((s) => s.billing === "own").map((s) => ({ id: s.childId, name: s.name }))];

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, done: string) {
    start(async () => {
      const r = await fn();
      toast(r.ok ? done : r.error ?? "Something went wrong.");
      if (r.ok) setAdding(false);
    });
  }

  return (
    <Field label="Sub-accounts billed under this client" full>
      <div className="list">
        {subs.length === 0 ? <div className="item muted">No sub-accounts linked.</div> : null}
        {subs.map((s) => (
          <div key={s.childId} className="item row between">
            <span>{s.name}</span>
            {s.billing === "parent" ? (
              canEdit ? (
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => unlinkSubAccount({ parentId: clientId, childId: s.childId }), "Sub-account unlinked")}>
                  Unlink
                </Button>
              ) : (
                <StatusDot tone="ok">Billed here</StatusDot>
              )
            ) : (
              <StatusDot tone="muted">Billed separately</StatusDot>
            )}
          </div>
        ))}
      </div>
      {canEdit ? (
        adding ? (
          <div className="row" style={{ marginTop: 6 }}>
            <Select aria-label="Client to bill here" value={pick} onChange={(e) => setPick(e.target.value)} style={{ flex: 1, minWidth: 160 }}>
              <option value="">Choose a client</option>
              {choices.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <Button size="sm" variant="primary" disabled={busy || !pick} onClick={() => run(() => linkSubAccount({ parentId: clientId, childId: pick }), "Sub-account linked")}>
              Link
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button size="sm" style={{ marginTop: 6, alignSelf: "flex-start" }} disabled={!choices.length} onClick={() => setAdding(true)}>
            Link a sub-account
          </Button>
        )
      ) : null}
    </Field>
  );
}

"use client";

import { useTransition } from "react";
import { Button, Card, CardHead, Select, StatusDot, useToast } from "@/components/ui";
import { startWinback, updateWinback } from "../actions";
import { endedLine, fmtDate, WINBACK } from "../logic";
import { WINBACK_STATUSES, type EndedClient } from "../types";

/** Client Portfolio card: ended clients, each with "Start win-back" or the win-back in progress. */
export function WinbackCard({ clients, canManage }: { clients: EndedClient[]; canManage: boolean }) {
  const [busy, start] = useTransition();
  const toast = useToast();

  function begin(c: EndedClient) {
    start(async () => {
      const r = await startWinback({ clientId: c.id });
      toast(r.ok ? `Win-back started for ${c.name}` : r.error);
    });
  }

  function setStatus(c: EndedClient, status: string) {
    if (!c.winback) return;
    start(async () => {
      const r = await updateWinback({ clientId: c.id, winbackId: c.winback!.id, status, next_step: c.winback!.next_step, due_on: c.winback!.due_on });
      toast(r.ok ? "Win-back updated" : r.error);
    });
  }

  return (
    <Card>
      <CardHead title="Ended clients" />
      {clients.length ? (
        <div className="list">
          {clients.map((c) => {
            const w = c.winback;
            const active = w && w.status === "open";
            return (
              <div key={c.id} className="item between" style={{ gap: 12, flexWrap: "wrap" }}>
                <div className="stack" style={{ gap: 2, minWidth: 0 }}>
                  <strong>{c.name}</strong>
                  <span className="small muted">{endedLine(c)}</span>
                  {w ? (
                    <span className="small">
                      <StatusDot tone={WINBACK[w.status].tone}>{WINBACK[w.status].label}</StatusDot>
                      {w.owner_name ? ` · ${w.owner_name}` : ""}
                      {active && w.next_step ? ` · ${w.next_step}` : ""}
                      {active && w.due_on ? ` by ${fmtDate(w.due_on)}` : ""}
                    </span>
                  ) : null}
                </div>
                {canManage ? (
                  active ? (
                    <Select aria-label={`Win-back status for ${c.name}`} value={w.status} disabled={busy} onChange={(e) => setStatus(c, e.target.value)}>
                      {WINBACK_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {WINBACK[s].label}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    <Button size="sm" disabled={busy} onClick={() => begin(c)}>
                      Start win-back
                    </Button>
                  )
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card-body muted small">No ended clients.</div>
      )}
    </Card>
  );
}

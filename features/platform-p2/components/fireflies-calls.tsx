"use client";

import { useState, useTransition } from "react";
import { Button, Card, CardBody, CardHead, EmptyState, Select, StatusDot, useToast } from "@/components/ui";
import { assignCallClient, importFireflies, summarizeCall } from "../actions";
import { MATCH_LABEL, shortDate } from "../logic";
import type { ConnectionStatus, FirefliesCall } from "../types";

type Props = {
  calls: FirefliesCall[];
  status: ConnectionStatus;
  /** Shown for the "No client" tab so calls can be assigned. Omit on a client page. */
  clients?: { id: string; name: string }[];
  title?: string;
};

/** Meetings → Fireflies calls: import, AI summary ("Read now" / "Read again") and no-client assignment. */
export function FirefliesCalls({ calls, status, clients, title = "Fireflies calls" }: Props) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [openId, setOpenId] = useState<string | null>(null);

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, done: string) =>
    start(async () => {
      const r = await fn();
      toast(r.ok ? done : r.error);
    });

  return (
    <Card>
      <CardHead
        title={title}
        actions={
          <Button size="sm" disabled={pending} onClick={() => run(() => importFireflies(), "Fireflies calls imported")}>
            Import from Fireflies
          </Button>
        }
      />
      <CardBody className="list">
        {status !== "connected" ? (
          <div className="item small">
            <StatusDot tone={status === "error" ? "danger" : "muted"}>{status === "error" ? "Fireflies import failed" : "Fireflies not connected"}</StatusDot>
          </div>
        ) : null}
        {calls.length === 0 ? <EmptyState title="No calls imported yet" /> : null}
        {calls.map((c) => {
          const s = c.summary;
          const open = openId === c.id;
          return (
            <div key={c.id} className="item stack">
              <div className="between row">
                <div className="min-w-0">
                  <strong className="break-words">{c.title}</strong>
                  <div className="small muted">
                    {[shortDate(c.occurred_at), `${c.minutes} min`, c.client_name, MATCH_LABEL[c.match_method]].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <div className="row" style={{ gap: 6 }}>
                  {s ? (
                    <Button size="sm" variant="ghost" onClick={() => setOpenId(open ? null : c.id)}>
                      {open ? "Hide" : "Read summary"}
                    </Button>
                  ) : null}
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => summarizeCall({ id: c.id }), "Summary ready")}>
                    {s ? "Read again" : "Read now"}
                  </Button>
                </div>
              </div>
              {c.summary_status === "not_configured" && !s ? <StatusDot tone="muted" className="small">AI summary not set up</StatusDot> : null}
              {clients && !c.client_id ? (
                <Select
                  aria-label={`Client for ${c.title}`}
                  defaultValue=""
                  disabled={pending}
                  onChange={(e) => e.target.value && run(() => assignCallClient({ id: c.id, clientId: e.target.value }), "Client assigned")}
                >
                  <option value="">Assign a client</option>
                  {clients.map((o) => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </Select>
              ) : null}
              {open && s ? (
                <div className="stack small">
                  {s.decisions.length ? (
                    <p className="m-0">
                      <strong>Decisions:</strong> {s.decisions.join(" ")}
                    </p>
                  ) : null}
                  {s.concerns.length ? (
                    <div>
                      <strong>Concerns:</strong>
                      <ul className="m-0 pl-5">
                        {s.concerns.map((x, i) => (
                          <li key={i}>
                            {x.text}
                            {x.quote ? <span className="muted"> &ldquo;{x.quote}&rdquo;</span> : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {s.actions.length ? (
                    <div>
                      <strong>Action items:</strong>
                      <ul className="m-0 pl-5">
                        {s.actions.map((x, i) => (
                          <li key={i}>
                            {x.text}
                            {x.owner ? <span className="muted"> · {x.owner}</span> : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}

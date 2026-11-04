"use client";

import { useTransition } from "react";
import { Button, Card, CardBody, CardHead, StatusDot, useToast } from "@/components/ui";
import { checkInbox } from "../actions";
import { INBOX_OUTCOMES, type ConnectionStatus, type InboxOutcome } from "../types";

type Props = {
  mailbox: string | null;
  status: ConnectionStatus;
  lastCheck: string;
  counts: Record<InboxOutcome, number>;
  days: number;
};

/** Response times → client email inboxes: shared Gmail inbox status and triage counts. */
export function InboxCard({ mailbox, status, lastCheck, counts, days }: Props) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const connected = status === "connected";

  return (
    <Card>
      <CardHead
        title="Client email inboxes"
        actions={
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await checkInbox();
                toast(r.ok ? "Inbox checked" : r.error);
              })
            }
          >
            Check now
          </Button>
        }
      />
      <CardBody className="stack">
        <div className="row small">
          {connected ? <StatusDot tone="ok">Connected</StatusDot> : status === "error" ? <StatusDot tone="danger">Check failed</StatusDot> : <StatusDot tone="muted">Not connected</StatusDot>}
          <span className="muted">
            {connected
              ? `${mailbox ?? "The shared inbox"} is checked every 10 minutes. Last check ${lastCheck}.`
              : "Emails from client contacts will start a wait or join a ticket once Gmail is connected."}
          </span>
        </div>
        <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
          {INBOX_OUTCOMES.map((o) => (
            <div key={o.key} className="rounded-lg bg-surface-2 px-3 py-2.5">
              <span className="small muted">{o.label}</span>
              <strong className="num block text-xl">{counts[o.key]}</strong>
            </div>
          ))}
        </div>
        <span className="small muted">Last {days} days</span>
      </CardBody>
    </Card>
  );
}

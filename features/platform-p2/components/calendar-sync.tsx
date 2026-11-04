"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Button, StatusDot, useToast } from "@/components/ui";
import { connectGoogleCalendar, syncGoogleCalendar } from "../actions";
import type { ConnectionStatus } from "../types";

/** Calendar toolbar line: Google Calendar sync status, last sync time and "Sync now" (or "Connect"). */
export function CalendarSync({ status, lastSync }: { status: ConnectionStatus; lastSync: string }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const connected = status === "connected";

  return (
    <div className="row small" style={{ alignItems: "center" }}>
      {connected ? (
        <StatusDot tone="ok">Google Calendar sync</StatusDot>
      ) : status === "error" ? (
        <StatusDot tone="danger">Google Calendar sync failed</StatusDot>
      ) : (
        <StatusDot tone="muted">Google Calendar not connected</StatusDot>
      )}
      {connected || status === "error" ? <span className="muted">Last synced <span className="num">{lastSync}</span></span> : null}
      {connected || status === "error" ? (
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await syncGoogleCalendar();
              toast(r.ok ? "Calendar synced" : r.error);
            })
          }
        >
          <RefreshCw size={14} className={pending ? "animate-spin" : undefined} /> Sync now
        </Button>
      ) : (
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await connectGoogleCalendar();
              if (r.ok && r.data) window.location.assign(r.data.url);
              else if (!r.ok) toast(r.error);
            })
          }
        >
          Connect Google Calendar
        </Button>
      )}
    </div>
  );
}

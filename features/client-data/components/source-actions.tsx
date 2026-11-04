"use client";

import { useTransition } from "react";
import { Button, useToast } from "@/components/ui";
import { connectSource, disconnectSource, refreshSource } from "../actions";
import type { Source, SourceStatus } from "../types";

/** Connect, or Refresh + Disconnect, for one data source row. */
export function SourceActions({ clientId, source, status }: { clientId: string; source: Source; status: SourceStatus }) {
  const [pending, start] = useTransition();
  const toast = useToast();

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, okMsg: string) =>
    start(async () => {
      const res = await fn();
      toast(res.ok ? okMsg : res.error);
    });

  if (status === "not_connected") {
    return (
      <Button
        size="sm"
        variant="primary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await connectSource({ clientId, source });
            if (res.ok) window.location.href = res.url;
            else toast(res.error);
          })
        }
      >
        Connect
      </Button>
    );
  }
  return (
    <div className="row" style={{ gap: 6 }}>
      <Button size="sm" disabled={pending} onClick={() => run(() => refreshSource({ clientId, source }), "Refreshed")}>
        Refresh
      </Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => disconnectSource({ clientId, source }), "Disconnected")}>
        Disconnect
      </Button>
    </div>
  );
}

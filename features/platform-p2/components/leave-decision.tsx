"use client";

import { useTransition } from "react";
import { Button, useToast } from "@/components/ui";
import { decideLeave } from "../actions";

export function LeaveDecision({ id }: { id: string }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const decide = (decision: "approved" | "declined") =>
    start(async () => {
      const r = await decideLeave({ id, decision });
      toast(r.ok ? (decision === "approved" ? "Leave approved" : "Leave declined") : r.error);
    });
  return (
    <span className="row" style={{ gap: 6 }}>
      <Button size="sm" variant="primary" disabled={pending} onClick={() => decide("approved")}>Approve</Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => decide("declined")}>Decline</Button>
    </span>
  );
}

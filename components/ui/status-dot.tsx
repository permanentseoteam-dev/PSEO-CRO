import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Tone } from "./tone";

/** Status as a coloured dot plus text. Never a pill. */
export function StatusDot({ tone = "muted", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("status", `t-${tone}`, className)}>
      <i aria-hidden="true" />
      {children}
    </span>
  );
}

export type TicketStatus = "todo" | "in_progress" | "in_review" | "blocked" | "done";

export const TICKET_STATUS: Record<TicketStatus, { label: string; tone: Tone }> = {
  todo: { label: "To do", tone: "muted" },
  in_progress: { label: "In progress", tone: "blue" },
  in_review: { label: "In review", tone: "violet" },
  blocked: { label: "Blocked", tone: "danger" },
  done: { label: "Done", tone: "ok" },
};

/** Ticket status with the standard label and tone. */
export function TicketStatusDot({ status }: { status: TicketStatus }) {
  const s = TICKET_STATUS[status];
  return <StatusDot tone={s.tone}>{s.label}</StatusDot>;
}

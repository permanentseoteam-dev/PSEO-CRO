import { Avatar, Avatars, StatusDot } from "@/components/ui";
import { fmtDate } from "@/lib/modules/tickets/logic";
import type { TicketStatus } from "@/lib/modules/tickets/types";

/** Due date: overdue in red, today in amber, otherwise the plain date. */
export function DueLabel({ due, status, today }: { due: string | null; status: TicketStatus; today: string }) {
  if (!due) return <span className="muted">None</span>;
  if (status !== "done" && due < today) return <StatusDot tone="danger">Overdue · {fmtDate(due)}</StatusDot>;
  if (due === today) return <StatusDot tone="warn">Today</StatusDot>;
  return <span className="num">{fmtDate(due)}</span>;
}

/** Assignee plus co-assignees as overlapping avatars. */
export function People({ ids, names, size = 24 }: { ids: (string | null)[]; names: Record<string, string>; size?: number }) {
  const list = ids.filter((id): id is string => !!id && !!names[id]);
  if (!list.length) return <span className="muted small">Unassigned</span>;
  return (
    <Avatars>
      {list.map((id) => (
        <Avatar key={id} name={names[id]} size={size} />
      ))}
    </Avatars>
  );
}

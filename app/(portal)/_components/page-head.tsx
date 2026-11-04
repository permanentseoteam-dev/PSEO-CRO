import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui";

/** Portal page title with one short line and optional actions on the right. */
export function PageHead({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="row between">
      <div>
        <h1 style={{ margin: 0, fontSize: 22 }}>{title}</h1>
        {sub ? <p className="muted" style={{ margin: "4px 0 0" }}>{sub}</p> : null}
      </div>
      {actions ? <div className="row">{actions}</div> : null}
    </div>
  );
}

/** Shown when the login has no client to show (e.g. a staff member who can't see any client). */
export function NoClient() {
  return (
    <div className="page">
      <EmptyState title="No client to show">Your account is not linked to a client yet. Ask your account team for access.</EmptyState>
    </div>
  );
}

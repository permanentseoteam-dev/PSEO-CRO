import { Lock } from "lucide-react";
import { EmptyState } from "./empty-state";

/** Shown by a page when can() says no. */
export function NoAccess() {
  return (
    <div className="card">
      <EmptyState icon={<Lock />} title="You don't have access to this page">
        Ask an admin if you need it.
      </EmptyState>
    </div>
  );
}

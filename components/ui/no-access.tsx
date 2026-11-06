import { Lock } from "lucide-react";
import { EmptyState } from "./empty-state";
import { AccessHelp } from "./access-help";
import { accessHelp } from "@/lib/modules/access/request";

/** Shown by a page when can() says no: who can help, and a Request access button. */
export async function NoAccess() {
  const { admins, canMessage } = await accessHelp();
  return (
    <div className="card">
      <EmptyState
        icon={<Lock />}
        title="You don't have access to this page"
        action={<AccessHelp admins={admins} canMessage={canMessage} />}
      >
        An admin can give you access.
      </EmptyState>
    </div>
  );
}

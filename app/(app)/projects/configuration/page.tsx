import { requireMe, can } from "@/lib/auth/can";
import { NoAccess } from "@/components/ui";
import { getWorkConfig } from "@/lib/modules/work/space";
import { WorkspaceConfig } from "./workspace-config";

export const metadata = { title: "Workspace configuration" };

export default async function ConfigurationPage() {
  const me = await requireMe();
  if (me.kind !== "staff") return <NoAccess />;
  const config = await getWorkConfig();
  // Same check as setWorkConfig in space-actions.ts.
  const canEdit = can(me, "admin.access.manage", "all");

  return (
    <div className="page" style={{ maxWidth: 860 }}>
      <div className="stack">
        <h1 style={{ margin: 0, font: "800 22px/1.25 var(--font-head)" }}>Workspace configuration</h1>
        <p className="muted" style={{ margin: 0 }}>
          {canEdit ? "Projects that inherit the workspace configuration use these settings." : "Only admins can change these settings."}
        </p>
      </div>
      <WorkspaceConfig config={config} canEdit={canEdit} />
    </div>
  );
}

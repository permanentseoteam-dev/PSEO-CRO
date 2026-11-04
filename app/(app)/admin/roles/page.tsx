import { NoAccess } from "@/components/ui";
import { requireMe, can } from "@/lib/auth/can";
import { cellKey } from "@/lib/modules/access/logic";
import { listGrants, listPermissions, listRoles } from "@/lib/modules/access/queries";
import type { Scope } from "@/lib/auth/perms";
import { AdminHeader } from "../_components/admin-tabs";
import { Matrix } from "./_components/matrix";

export const metadata = { title: "Roles & permissions · Admin" };

export default async function RolesPage() {
  const me = await requireMe();
  if (!can(me, "admin.access.manage", "all")) return <NoAccess />;

  const [roles, perms, grants] = await Promise.all([listRoles(), listPermissions(), listGrants()]);
  const saved: Record<string, Scope> = {};
  for (const g of grants) saved[cellKey(g.role, g.perm_key)] = g.scope;

  return (
    <div className="page">
      <AdminHeader value="roles" />
      <Matrix
        // Super admin always has everything, so it has no column.
        roles={roles.filter((r) => r.key !== "super_admin").map((r) => ({ key: r.key, name: r.name }))}
        perms={perms}
        saved={saved}
      />
    </div>
  );
}

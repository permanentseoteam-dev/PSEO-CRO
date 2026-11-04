import { NoAccess } from "@/components/ui";
import { requireMe, can } from "@/lib/auth/can";
import { formatDay, inviteState } from "@/lib/modules/access/logic";
import { listClientOptions, listDepartments, listInvites, listRoles } from "@/lib/modules/access/queries";
import { AdminHeader } from "../_components/admin-tabs";
import { InvitesCard } from "./_components/invites-card";

export const metadata = { title: "Invites · Admin" };

export default async function InvitesPage() {
  const me = await requireMe();
  if (!can(me, "admin.access.manage", "all")) return <NoAccess />;

  const [invites, roles, departments, clients] = await Promise.all([listInvites(), listRoles(), listDepartments(), listClientOptions()]);
  const roleName = new Map(roles.map((r) => [r.key, r.name]));
  const now = new Date();

  return (
    <div className="page">
      <AdminHeader value="invites" />
      <InvitesCard
        rows={invites.map((i) => ({
          id: i.id,
          email: i.email,
          role: roleName.get(i.role) ?? i.role,
          sent: formatDay(i.sent_at),
          state: inviteState(i, now),
        }))}
        roles={roles
          .filter((r) => r.key !== "super_admin" || me.roles.includes("super_admin"))
          .map((r) => ({ key: r.key, name: r.name, kind: r.kind }))}
        departments={departments}
        clients={clients}
      />
    </div>
  );
}

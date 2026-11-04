import { notFound } from "next/navigation";
import { ButtonLink, Card, CardHead, Avatar, NoAccess, StatusDot } from "@/components/ui";
import { requireMe, can } from "@/lib/auth/can";
import { resolvePerms, type Scope } from "@/lib/auth/perms";
import { MEMBER_STATUS } from "@/lib/modules/access/logic";
import { getPerson, listGrants, listPermissions, listRoles } from "@/lib/modules/access/queries";
import { AccessForm } from "./_components/access-form";
import { OverridesTable } from "./_components/overrides-table";

export const metadata = { title: "Person · Admin" };

export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireMe();
  if (!can(me, "admin.access.manage", "all")) return <NoAccess />;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [found, roles, perms, grants] = await Promise.all([getPerson(id), listRoles(), listPermissions(), listGrants()]);
  if (!found) notFound();
  const { person, overrides } = found;

  const keys = perms.map((p) => p.key);
  // What the roles alone give; the table shows the override on top.
  const fromRoles = resolvePerms({ keys, roles: person.roles, grants, overrides: [] });
  const st = MEMBER_STATUS[person.status] ?? MEMBER_STATUS.active;
  const isSuper = person.roles.includes("super_admin");

  return (
    <div className="page">
      <div className="row between">
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <Avatar name={person.name} size={40} />
          <div className="min-w-0">
            <h1>{person.name}</h1>
            <div className="muted truncate">
              {person.email} · <StatusDot tone={st.tone}>{st.label}</StatusDot>
            </div>
          </div>
        </div>
        <ButtonLink href={person.kind === "client" ? "/admin/people?kind=client" : "/admin/people"} variant="ghost" size="sm">
          Back to people
        </ButtonLink>
      </div>

      <Card>
        <CardHead title="Roles and status" />
        <AccessForm
          memberId={person.id}
          roles={roles.filter((r) => r.kind === person.kind).map((r) => ({ key: r.key, name: r.name, description: r.description }))}
          initialRoles={person.roles}
          initialStatus={person.status === "invited" ? "active" : person.status}
          canGrantSuper={me.roles.includes("super_admin")}
        />
      </Card>

      <Card>
        <CardHead title="Permission overrides" />
        <OverridesTable
          memberId={person.id}
          isSelf={person.id === me.id}
          isSuper={isSuper}
          rows={perms.map((p) => ({
            key: p.key,
            label: p.label,
            fromRoles: (fromRoles[p.key] ?? "none") as Scope,
            override: (overrides.find((o) => o.perm_key === p.key)?.scope ?? "default") as Scope | "default",
          }))}
        />
      </Card>
    </div>
  );
}

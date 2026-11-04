import { ButtonLink, Card, CardHead, Avatar, EmptyState, NoAccess, Seg, StatusDot, Table, Td, Th } from "@/components/ui";
import { requireMe, can } from "@/lib/auth/can";
import { MEMBER_STATUS } from "@/lib/modules/access/logic";
import { listClientOptions, listDepartments, listPeople, listRoles } from "@/lib/modules/access/queries";
import { AdminHeader } from "../_components/admin-tabs";

export const metadata = { title: "People · Admin" };

export default async function PeoplePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireMe();
  if (!can(me, "admin.access.manage", "all")) return <NoAccess />;
  const kind = (await searchParams).kind === "client" ? "client" : "staff";

  const [people, roles, departments, clients] = await Promise.all([
    listPeople(kind),
    listRoles(),
    kind === "staff" ? listDepartments() : Promise.resolve([]),
    kind === "client" ? listClientOptions() : Promise.resolve([]),
  ]);
  const roleName = new Map(roles.map((r) => [r.key, r.name]));
  const groupName = new Map([...departments, ...clients].map((o) => [o.id, o.name]));

  return (
    <div className="page">
      <AdminHeader value="people" />
      <Card>
        <CardHead
          title={<>People <span className="count">{people.length}</span></>}
          actions={
            <>
              <Seg
                label="Kind"
                value={kind}
                items={[
                  { value: "staff", label: "Team", href: "/admin/people" },
                  { value: "client", label: "Client logins", href: "/admin/people?kind=client" },
                ]}
              />
              <ButtonLink href="/admin/invites" variant="primary" size="sm">
                Invite
              </ButtonLink>
            </>
          }
        />
        {people.length === 0 ? (
          <EmptyState title={kind === "client" ? "No client logins yet" : "No team members yet"} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Role</Th>
                <Th hideSm>{kind === "client" ? "Client" : "Department"}</Th>
                <Th>Status</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {people.map((p) => {
                const st = MEMBER_STATUS[p.status] ?? MEMBER_STATUS.active;
                const group = kind === "client" ? p.client_id : p.department_id;
                return (
                  <tr key={p.id}>
                    <Td>
                      <div className="row" style={{ flexWrap: "nowrap" }}>
                        <Avatar name={p.name} />
                        <div className="min-w-0">
                          <div className="font-semibold">{p.name}</div>
                          <div className="small muted truncate">{p.email}</div>
                        </div>
                      </div>
                    </Td>
                    <Td>{p.roles.map((r) => roleName.get(r) ?? r).join(", ") || <span className="muted">None</span>}</Td>
                    <Td hideSm>{(group && groupName.get(group)) ?? <span className="muted">None</span>}</Td>
                    <Td>
                      <StatusDot tone={st.tone}>{st.label}</StatusDot>
                    </Td>
                    <Td right>
                      <ButtonLink href={`/admin/people/${p.id}`} variant="ghost" size="sm">
                        Edit
                      </ButtonLink>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}

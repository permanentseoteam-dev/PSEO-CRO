import { ButtonLink, Card, CardBody, CardHead, EmptyState, NoAccess, Table, Td, Th } from "@/components/ui";
import { requireMe, can } from "@/lib/auth/can";
import { formatWhen } from "@/lib/modules/access/logic";
import { listAudit } from "@/lib/modules/access/queries";
import { AdminHeader } from "../_components/admin-tabs";

export const metadata = { title: "Audit log · Admin" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const me = await requireMe();
  if (!can(me, "admin.access.manage", "all")) return <NoAccess />;
  const page = Math.max(0, Math.min(1000, Number.parseInt((await searchParams).page ?? "0", 10) || 0));
  const { rows, more } = await listAudit(page);
  const now = new Date();

  return (
    <div className="page">
      <AdminHeader value="audit" />
      <Card>
        <CardHead title="Audit log" />
        {rows.length === 0 ? (
          <EmptyState title="Nothing logged yet" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Who</Th>
                <Th>What</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <Td className="whitespace-nowrap">
                    <time dateTime={r.created_at}>{formatWhen(r.created_at, now)}</time>
                  </Td>
                  <Td className="whitespace-nowrap">{r.actor ?? "System"}</Td>
                  <Td>{r.summary}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {page > 0 || more ? (
          <CardBody className="row between">
            {page > 0 ? (
              <ButtonLink href={page === 1 ? "/admin/audit" : `/admin/audit?page=${page - 1}`} variant="ghost" size="sm">
                Newer
              </ButtonLink>
            ) : (
              <span />
            )}
            {more ? (
              <ButtonLink href={`/admin/audit?page=${page + 1}`} variant="ghost" size="sm">
                Older
              </ButtonLink>
            ) : null}
          </CardBody>
        ) : null}
      </Card>
    </div>
  );
}

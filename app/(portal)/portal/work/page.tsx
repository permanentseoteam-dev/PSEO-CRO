import { can } from "@/lib/auth/can";
import { Avatar, Card, EmptyState, StatusDot, Table, Tabs, Td, Th } from "@/components/ui";
import { listApprovals, listClientTickets, portalContext } from "@/lib/modules/portal/queries";
import { clientStatus, dubaiToday, fmtDate, fmtDay } from "@/lib/modules/portal/logic";
import { NoClient, PageHead } from "../../_components/page-head";
import { Approvals } from "./_components/approvals";
import { RequestWork } from "./_components/request-work";

export const metadata = { title: "Work and approvals" };

export default async function PortalWork({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { me, client, preview } = await portalContext();
  if (!client) return <NoClient />;

  const isClient = me.kind === "client";
  const seesApprovals = isClient ? can(me, "portal.approve") : true;
  const sp = await searchParams;
  const tab = sp.tab === "prog" || sp.tab === "done" ? sp.tab : seesApprovals ? "wait" : "prog";

  const [approvals, open, done] = await Promise.all([
    seesApprovals ? listApprovals(client.id, { decidedWithinDays: 14 }) : Promise.resolve([]),
    tab === "prog" ? listClientTickets(client.id, false) : Promise.resolve([]),
    tab === "done" ? listClientTickets(client.id, true, 30) : Promise.resolve([]),
  ]);
  const waiting = approvals.filter((a) => a.status === "waiting").length;
  const today = dubaiToday(new Date());

  return (
    <div className="page">
      <PageHead
        title="Work and approvals"
        sub="Approve what we send and see what we are working on."
        actions={isClient ? <RequestWork today={today} readOnly={!!preview} /> : null}
      />
      <Tabs
        label="Work"
        value={tab}
        items={[
          ...(seesApprovals ? [{ value: "wait", label: "Waiting for you", count: waiting, href: "/portal/work" }] : []),
          { value: "prog", label: "In progress", href: "/portal/work?tab=prog" },
          { value: "done", label: "Done", href: "/portal/work?tab=done" },
        ]}
      />

      {tab === "wait" ? (
        approvals.length ? (
          <Approvals items={approvals} canDecide={isClient && can(me, "portal.approve")} readOnly={!!preview} />
        ) : (
          <EmptyState title="Nothing waiting for you">When we send work for your approval, it shows here.</EmptyState>
        )
      ) : null}

      {tab === "prog" ? (
        <Card>
          {open.length ? (
            <Table>
              <thead>
                <tr>
                  <Th>Request</Th>
                  <Th>Status</Th>
                  <Th>Due</Th>
                  <Th>Who</Th>
                </tr>
              </thead>
              <tbody>
                {open.map((t) => {
                  const st = clientStatus(t.status);
                  return (
                    <tr key={t.id}>
                      <Td>
                        {t.title}
                        {t.details ? <div className="small muted">{t.details}</div> : null}
                      </Td>
                      <Td>
                        {t.needsApproval ? <StatusDot tone="warn">Needs your approval</StatusDot> : <StatusDot tone={st.tone}>{st.label}</StatusDot>}
                      </Td>
                      <Td num>{t.dueDate ? fmtDate(t.dueDate) : "–"}</Td>
                      <Td>
                        {t.assignee ? (
                          <span className="row" style={{ flexWrap: "nowrap" }}>
                            <Avatar name={t.assignee} size={24} />
                            <span className="hide-sm">{t.assignee}</span>
                          </span>
                        ) : (
                          <span className="muted">Not assigned yet</span>
                        )}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          ) : (
            <EmptyState title="Nothing in progress">Send a request and we will pick it up.</EmptyState>
          )}
        </Card>
      ) : null}

      {tab === "done" ? (
        <Card>
          {done.length ? (
            <Table>
              <thead>
                <tr>
                  <Th>Request</Th>
                  <Th>Finished</Th>
                </tr>
              </thead>
              <tbody>
                {done.map((t) => (
                  <tr key={t.id}>
                    <Td>{t.title}</Td>
                    <Td num>{t.completedAt ? fmtDay(t.completedAt) : "–"}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState title="Nothing finished yet">Finished work shows here.</EmptyState>
          )}
        </Card>
      ) : null}
    </div>
  );
}

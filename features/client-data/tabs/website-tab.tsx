import type { ReactNode } from "react";
import { format } from "date-fns";
import { Card, CardBody, CardHead, EmptyState, NoAccess, StatCard, Stats, Table, Td, Th, TicketStatusDot } from "@/components/ui";
import { formatNumber } from "../logic";
import { getWebsite, listWebsiteChangeRequests } from "../queries";
import { WebsiteEditor } from "../components/website-editor";
import { dataAccess } from "./access";

const fmtDay = (d: string | null) => (d ? format(new Date(`${d.slice(0, 10)}T00:00:00Z`), "d MMM yyyy") : null);
const fmtTime = (d: string | null) => (d ? format(new Date(d), "d MMM HH:mm") : null);

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="row between">
      <span className="muted">{label}</span>
      <span>{value ?? <span className="muted">Not set</span>}</span>
    </div>
  );
}

/** Client page tab "Website": health stats, site facts and open website change requests (tickets). */
export async function WebsiteTab({ clientId }: { clientId: string }) {
  const { view, manage } = await dataAccess();
  if (!view) return <NoAccess />;

  const [site, requests] = await Promise.all([getWebsite(clientId), listWebsiteChangeRequests(clientId)]);
  const speedTone = site?.mobileSpeed == null ? undefined : site.mobileSpeed >= 90 ? "ok" : site.mobileSpeed >= 50 ? "warn" : "danger";

  return (
    <div className="stack" style={{ gap: 16 }}>
      {site ? (
        <Stats>
          <StatCard
            label="Uptime, 30 days"
            value={site.uptime30d == null ? "No data" : `${formatNumber(site.uptime30d, 2)}%`}
            tone={site.uptime30d != null && site.uptime30d >= 99.9 ? "ok" : undefined}
          />
          <StatCard
            label="Mobile speed score"
            value={site.mobileSpeed ?? "No data"}
            sub={site.lcpMs ? `LCP ${formatNumber(site.lcpMs / 1000, 1)}s` : undefined}
            tone={speedTone}
          />
          <StatCard
            label="Forms working"
            value={site.formsTotal ? `${site.formsWorking} of ${site.formsTotal}` : "None tracked"}
            sub={site.formsTestedAt ? `Tested ${fmtTime(site.formsTestedAt)}` : undefined}
            tone={site.formsTotal && site.formsWorking < site.formsTotal ? "danger" : undefined}
          />
          <StatCard label="Last backup" value={fmtTime(site.lastBackupAt) ?? "None"} />
        </Stats>
      ) : null}
      <div className="grid-2">
        <Card>
          <CardHead title="Site" actions={manage ? <WebsiteEditor clientId={clientId} site={site} /> : null} />
          <CardBody>
            {site ? (
              <div className="stack small">
                <Fact
                  label="Address"
                  value={
                    <a href={site.url.startsWith("http") ? site.url : `https://${site.url}`} target="_blank" rel="noreferrer">
                      {site.url.replace(/^https?:\/\//, "")}
                    </a>
                  }
                />
                <Fact label="Platform" value={[site.platform, site.hosting].filter(Boolean).join(", ") || null} />
                <Fact label="SSL" value={site.sslRenewsOn ? `Renews ${fmtDay(site.sslRenewsOn)}` : null} />
                <Fact label="Domain" value={site.domainRenewsOn ? `Renews ${fmtDay(site.domainRenewsOn)}` : null} />
                <Fact label="Tracking" value={site.tracking.join(", ") || null} />
              </div>
            ) : (
              <EmptyState title="No site details yet" />
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHead title="Change requests" />
          {requests.length ? (
            <Table>
              <thead>
                <tr>
                  <Th>Request</Th>
                  <Th>Ticket</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.key}>
                    <Td>{r.title}</Td>
                    <Td num>
                      <a href={`/t/${r.key}`}>{r.key}</a>
                    </Td>
                    <Td>
                      <TicketStatusDot status={r.status} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState title="No open website requests">Tickets tagged “website” show here.</EmptyState>
          )}
        </Card>
      </div>
    </div>
  );
}

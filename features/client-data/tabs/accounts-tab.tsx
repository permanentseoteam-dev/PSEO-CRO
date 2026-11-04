import { ButtonLink, Card, CardHead, EmptyState, NoAccess, Table, Td, Th } from "@/components/ui";
import { getClientBasics, listClientOptions, listProjects, listSubAccounts } from "../queries";
import { LinkSubAccountButton, UnlinkButton } from "../components/sub-accounts";
import { dataAccess } from "./access";

/** Client page tab "Accounts & projects": linked sub-accounts (agency clients) and every project across them. */
export async function AccountsTab({ clientId }: { clientId: string }) {
  const { view, manage } = await dataAccess();
  if (!view) return <NoAccess />;

  const [client, subs, options] = await Promise.all([getClientBasics(clientId), listSubAccounts(clientId), manage ? listClientOptions(clientId) : []]);
  if (!client) return <NoAccess />;
  const accounts = [{ id: client.id, name: client.name }, ...subs.map((s) => ({ id: s.childClientId, name: s.childName }))];
  const projects = await listProjects(accounts.map((a) => a.id));
  const keysFor = (cid: string) => projects.filter((p) => p.clientId === cid).map((p) => p.key);
  const nameOf = (cid: string) => accounts.find((a) => a.id === cid)?.name ?? "";
  const linkable = options.filter((o) => !subs.some((s) => s.childClientId === o.id));

  return (
    <div className="stack" style={{ gap: 16 }}>
      <Card>
        <CardHead title="Linked accounts" actions={manage ? <LinkSubAccountButton parentId={clientId} options={linkable} /> : null} />
        <Table>
          <thead>
            <tr>
              <Th>Account</Th>
              <Th>Type</Th>
              <Th hideSm>Projects</Th>
              <Th>Billing</Th>
              {manage ? <Th aria-label="Actions" /> : null}
            </tr>
          </thead>
          <tbody>
            <tr>
              <Td>
                <strong>{client.name}</strong>
              </Td>
              <Td>Parent</Td>
              <Td hideSm className="num">
                {keysFor(client.id).join(", ") || <span className="muted">None yet</span>}
              </Td>
              <Td>Own invoice</Td>
              {manage ? <Td /> : null}
            </tr>
            {subs.map((s) => (
              <tr key={s.id}>
                <Td>{s.childName}</Td>
                <Td>Sub-account</Td>
                <Td hideSm className="num">
                  {keysFor(s.childClientId).join(", ") || <span className="muted">None yet</span>}
                </Td>
                <Td>{s.billing === "parent" ? "Billed to parent" : "Own invoice"}</Td>
                {manage ? (
                  <Td right>
                    <UnlinkButton id={s.id} parentId={clientId} name={s.childName} />
                  </Td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card>
        <CardHead title="Projects" />
        {projects.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Key</Th>
                <Th>Project</Th>
                <Th hideSm>Account</Th>
                <Th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id}>
                  <Td num>{p.key}</Td>
                  <Td>
                    <strong>{p.name}</strong>
                  </Td>
                  <Td hideSm>{nameOf(p.clientId)}</Td>
                  <Td right>
                    <ButtonLink size="sm" variant="ghost" href={`/tickets?project=${encodeURIComponent(p.key)}&view=board`}>
                      Board
                    </ButtonLink>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="No projects yet">Projects for this client and its sub-accounts show here.</EmptyState>
        )}
      </Card>
    </div>
  );
}

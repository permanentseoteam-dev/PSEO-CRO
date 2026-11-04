import { Card, CardBody, CardHead, Table, Td, Th } from "@/components/ui";
import { API_RESOURCES } from "../api/handler";

/** The API docs page body. Static: describes the read-only endpoints served by api/handler.ts. */
export function ApiDocs({ baseUrl = "" }: { baseUrl?: string }) {
  const example = `curl -H "Authorization: Bearer pk_ab12cd_..." "${baseUrl}/api/v1/tickets?limit=50"`;
  return (
    <div className="page">
      <h1>API docs</h1>
      <Card>
        <CardHead title="Sign in with a key" />
        <CardBody className="stack">
          <p>
            Create a key in Settings → API keys and pick its scopes. Send it in the <code>Authorization</code> header on every request.
            Keys are read-only. A revoked key stops working at once.
          </p>
          <pre className="overflow-x-auto rounded-lg bg-surface-2 p-3 small">{example}</pre>
        </CardBody>
      </Card>

      <Card>
        <CardHead title="Endpoints" />
        <Table>
          <thead>
            <tr>
              <Th>Endpoint</Th>
              <Th>Scope</Th>
              <Th hideSm>Fields</Th>
              <Th>Returns</Th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(API_RESOURCES).map(([path, r]) => (
              <tr key={path}>
                <Td className="whitespace-nowrap">
                  <code>GET /api/v1/{path}</code>
                </Td>
                <Td>
                  <code>{r.scope}</code>
                </Td>
                <Td hideSm className="small">{r.columns}</Td>
                <Td>{r.about}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card>
        <CardHead title="Paging and errors" />
        <CardBody className="stack">
          <p>
            Use <code>limit</code> (1 to 200, default 50) and <code>offset</code>. Results are newest first. The reply is{" "}
            <code>{"{ data, limit, offset }"}</code>.
          </p>
          <Table>
            <thead>
              <tr>
                <Th>Status</Th>
                <Th>Meaning</Th>
              </tr>
            </thead>
            <tbody>
              <tr><Td num>401</Td><Td>The key is missing, wrong or revoked.</Td></tr>
              <tr><Td num>403</Td><Td>The key doesn&apos;t have the scope this endpoint needs.</Td></tr>
              <tr><Td num>404</Td><Td>There is no such endpoint.</Td></tr>
            </tbody>
          </Table>
        </CardBody>
      </Card>
    </div>
  );
}

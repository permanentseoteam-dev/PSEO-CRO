"use client";

import { useState, useTransition } from "react";
import { Button, Card, CardHead, Dialog, EmptyState, Field, FormGrid, Input, Select, StatusDot, Table, Td, Th, useToast } from "@/components/ui";
import { INVITE_STATE, type InviteState } from "@/lib/modules/access/logic";
import type { Option } from "@/lib/modules/access/types";
import { createInvite, resendInvite, revokeInvite } from "../../actions";

type Row = { id: string; email: string; role: string; sent: string; state: InviteState };
type Role = { key: string; name: string; kind: "staff" | "client" };
type Sent = { email: string; link: string; emailed: boolean };

export function InvitesCard({ rows, roles, departments, clients }: { rows: Row[]; roles: Role[]; departments: Option[]; clients: Option[] }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("member");
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState<Sent>();
  const [pending, start] = useTransition();
  const kind = roles.find((r) => r.key === role)?.kind ?? "staff";

  const resend = (r: Row) =>
    start(async () => {
      const res = await resendInvite({ id: r.id });
      if (res.ok) setSent({ email: r.email, link: res.link, emailed: res.emailed });
      else toast(res.error);
    });

  const revoke = (r: Row) =>
    start(async () => {
      const res = await revokeInvite({ id: r.id });
      toast(res.ok ? "Invite revoked" : res.error);
    });

  return (
    <Card>
      <CardHead
        title="Invites"
        actions={
          <Button variant="primary" size="sm" onClick={() => { setError(undefined); setOpen(true); }}>
            Invite
          </Button>
        }
      />
      {rows.length === 0 ? (
        <EmptyState title="No invites yet" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Email</Th>
              <Th>Role</Th>
              <Th hideSm>Sent</Th>
              <Th>Status</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const st = INVITE_STATE[r.state];
              const canAct = r.state === "waiting" || r.state === "expired";
              return (
                <tr key={r.id}>
                  <Td>{r.email}</Td>
                  <Td>{r.role}</Td>
                  <Td hideSm>{r.sent}</Td>
                  <Td>
                    <StatusDot tone={st.tone}>{st.label}</StatusDot>
                  </Td>
                  <Td right>
                    {canAct ? (
                      <div className="row" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
                        <Button variant="ghost" size="sm" disabled={pending} onClick={() => resend(r)}>
                          Resend
                        </Button>
                        <Button variant="danger" size="sm" disabled={pending} onClick={() => revoke(r)}>
                          Revoke
                        </Button>
                      </div>
                    ) : null}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Invite someone"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="invite-form" variant="primary" disabled={pending}>
              {pending ? "Sending…" : "Send invite"}
            </Button>
          </>
        }
      >
        <form
          id="invite-form"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const email = String(fd.get("email") ?? "");
            setError(undefined);
            start(async () => {
              const res = await createInvite({
                email,
                name: fd.get("name") || undefined,
                role,
                departmentId: fd.get("departmentId") || undefined,
                clientId: fd.get("clientId") || undefined,
              });
              if (!res.ok) return setError(res.error);
              setOpen(false);
              setSent({ email, link: res.link, emailed: res.emailed });
            });
          }}
        >
          <FormGrid>
            <Field label="Email" htmlFor="inv-email" full>
              <Input id="inv-email" name="email" type="email" required placeholder="name@company.com" autoFocus />
            </Field>
            <Field label="Name" htmlFor="inv-name" full>
              <Input id="inv-name" name="name" placeholder="Optional" />
            </Field>
            <Field label="Role" htmlFor="inv-role">
              <Select id="inv-role" value={role} onChange={(e) => setRole(e.target.value)}>
                {roles.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.name}
                  </option>
                ))}
              </Select>
            </Field>
            {kind === "client" ? (
              <Field label="Client" htmlFor="inv-client">
                <Select id="inv-client" name="clientId" required defaultValue="">
                  <option value="" disabled>
                    Pick a client
                  </option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <Field label="Department" htmlFor="inv-dept">
                <Select id="inv-dept" name="departmentId" defaultValue="">
                  <option value="">None</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </FormGrid>
          {error ? (
            <p role="alert" className="mt-3 text-danger">
              {error}
            </p>
          ) : null}
        </form>
      </Dialog>

      <Dialog
        open={Boolean(sent)}
        onClose={() => setSent(undefined)}
        title="Invite link"
        footer={
          <Button variant="primary" onClick={() => setSent(undefined)}>
            Done
          </Button>
        }
      >
        {sent ? (
          <>
            <p>
              {sent.emailed
                ? `We emailed the invite to ${sent.email}. You can also share this link.`
                : `Email isn't set up yet. Copy this link and send it to ${sent.email}.`}
            </p>
            <div className="row" style={{ flexWrap: "nowrap" }}>
              <Input aria-label="Invite link" value={sent.link} readOnly onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1" />
              <Button
                onClick={async () => {
                  await navigator.clipboard.writeText(sent.link);
                  toast("Link copied");
                }}
              >
                Copy link
              </Button>
            </div>
          </>
        ) : null}
      </Dialog>
    </Card>
  );
}

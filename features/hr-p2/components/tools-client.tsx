"use client";

import { useState, useTransition } from "react";
import { Button, Card, CardBody, CardHead, Dialog, EmptyState, Field, FormGrid, Input, StatusDot, Table, Td, Th, useToast } from "@/components/ui";
import { grantTool, revokeTool } from "../actions";
import { fmtDate } from "../logic";
import type { ToolAccess } from "../types";

export function ToolsTabClient({ memberId, tools, canManage }: { memberId: string; tools: ToolAccess[]; canManage: boolean }) {
  const [open, setOpen] = useState(false);
  const [busy, start] = useTransition();
  const toast = useToast();

  function revoke(t: ToolAccess) {
    if (!window.confirm(`Revoke ${t.tool} access?`)) return;
    start(async () => {
      const r = await revokeTool({ id: t.id });
      toast(r.ok ? "Access revoked" : r.error);
    });
  }

  return (
    <Card>
      <CardHead
        title="Tool access"
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setOpen(true)}>
              Grant access
            </Button>
          ) : null
        }
      />
      {tools.length ? (
        <Table>
          <thead>
            <tr>
              <Th>Tool</Th>
              <Th>Login</Th>
              <Th>Access level</Th>
              <Th hideSm>Since</Th>
              {canManage ? <Th aria-label="Actions" /> : null}
            </tr>
          </thead>
          <tbody>
            {tools.map((t) => (
              <tr key={t.id}>
                <Td>{t.tool}</Td>
                <Td>{t.login ?? ""}</Td>
                <Td>{t.revoked_at ? <StatusDot tone="danger">{`Revoked ${fmtDate(t.revoked_at)}`}</StatusDot> : (t.access_level ?? "")}</Td>
                <Td hideSm>{fmtDate(t.granted_on)}</Td>
                {canManage ? (
                  <Td right>
                    {t.revoked_at ? null : (
                      <Button size="sm" variant="danger" disabled={busy} onClick={() => revoke(t)}>
                        Revoke
                      </Button>
                    )}
                  </Td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <EmptyState title="No tool access recorded" />
      )}
      <CardBody className="small muted">Passwords are never stored here.</CardBody>
      {open ? <GrantDialog memberId={memberId} onClose={() => setOpen(false)} /> : null}
    </Card>
  );
}

function GrantDialog({ memberId, onClose }: { memberId: string; onClose: () => void }) {
  const [tool, setTool] = useState("");
  const [login, setLogin] = useState("");
  const [level, setLevel] = useState("Viewer");
  const [busy, start] = useTransition();
  const toast = useToast();

  function save() {
    start(async () => {
      const r = await grantTool({ memberId, tool, login, accessLevel: level });
      toast(r.ok ? "Access granted" : r.error);
      if (r.ok) onClose();
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Grant tool access"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={busy || !tool.trim()} onClick={save}>
            Grant access
          </Button>
        </>
      }
    >
      <FormGrid>
        <Field label="Tool" htmlFor="tool-name">
          <Input id="tool-name" placeholder="e.g. Ahrefs" value={tool} onChange={(e) => setTool(e.target.value)} />
        </Field>
        <Field label="Login" htmlFor="tool-login">
          <Input id="tool-login" autoComplete="off" value={login} onChange={(e) => setLogin(e.target.value)} />
        </Field>
        <Field label="Access level" htmlFor="tool-level" full>
          <Input id="tool-level" value={level} onChange={(e) => setLevel(e.target.value)} />
        </Field>
      </FormGrid>
    </Dialog>
  );
}

"use client";

import { useState, useTransition } from "react";
import { Button, Card, CardBody, CardHead, Select, Table, Td, Th, useToast } from "@/components/ui";
import { SCOPES, type Scope } from "@/lib/auth/perms";
import { cellKey, matrixChanges } from "@/lib/modules/access/logic";
import type { PermissionRow } from "@/lib/modules/access/types";
import { saveRolePermissions } from "../../actions";

/** Roles × permissions with a none/own/team/all select per cell. Edits stay local until "Save permissions". */
export function Matrix({ roles, perms, saved }: { roles: { key: string; name: string }[]; perms: PermissionRow[]; saved: Record<string, Scope> }) {
  const toast = useToast();
  const [base, setBase] = useState(saved);
  const [edited, setEdited] = useState<Record<string, Scope>>({});
  const [pending, start] = useTransition();
  const changes = matrixChanges(base, edited);

  const save = () =>
    start(async () => {
      const res = await saveRolePermissions({ changes });
      if (!res.ok) return toast(res.error);
      setBase((b) => ({ ...b, ...edited }));
      setEdited({});
      toast(`Saved ${res.count} change${res.count === 1 ? "" : "s"}`);
    });

  return (
    <Card>
      <CardHead title="Roles & permissions" />
      <Table className="whitespace-nowrap">
        <thead>
          <tr>
            <Th>Permission</Th>
            {roles.map((r) => (
              <Th key={r.key}>{r.name}</Th>
            ))}
          </tr>
        </thead>
        <tbody>
          {perms.map((p) => (
            <tr key={p.key}>
              <Td>
                <code>{p.key}</code>
                <div className="small muted">{p.label}</div>
              </Td>
              {roles.map((r) => {
                const k = cellKey(r.key, p.key);
                const value = edited[k] ?? base[k] ?? "none";
                const locked = r.key === "admin" && p.key === "admin.access.manage";
                return (
                  <Td key={r.key}>
                    <Select
                      aria-label={`${p.key} for ${r.name}`}
                      value={value}
                      disabled={locked}
                      title={locked ? "Admins always keep this" : undefined}
                      className={value !== (base[k] ?? "none") ? "font-semibold" : undefined}
                      style={{ padding: "3px 6px" }}
                      onChange={(e) => setEdited((cur) => ({ ...cur, [k]: e.target.value as Scope }))}
                    >
                      {SCOPES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Select>
                  </Td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </Table>
      <CardBody className="row">
        <Button variant="primary" disabled={pending || changes.length === 0} onClick={save}>
          {pending ? "Saving…" : "Save permissions"}
        </Button>
        {changes.length ? (
          <span className="muted">
            <b className="count">{changes.length}</b> unsaved
          </span>
        ) : null}
      </CardBody>
    </Card>
  );
}

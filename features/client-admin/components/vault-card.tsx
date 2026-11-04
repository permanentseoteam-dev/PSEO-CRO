"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button, Card, CardHead, Dialog, Field, FormGrid, IconButton, Input, Table, Td, Th, Textarea, useToast } from "@/components/ui";
import { deleteVaultItem, revealVaultItem, saveVaultItem } from "../actions";
import { fmtDate, REVEAL_SECONDS } from "../logic";
import type { VaultItem } from "../types";

type Props = { clientId: string; items: VaultItem[]; canManage: boolean };

/** Vault: saved logins. Reveals are logged in SQL and the password hides again after 30 seconds. */
export function VaultCard({ clientId, items, canManage }: Props) {
  const [editing, setEditing] = useState<VaultItem | "new" | null>(null);
  const [busy, start] = useTransition();
  const toast = useToast();

  function remove(item: VaultItem) {
    if (!window.confirm(`Delete the ${item.service} login?`)) return;
    start(async () => {
      const r = await deleteVaultItem({ clientId, itemId: item.id });
      toast(r.ok ? "Login deleted" : r.error);
    });
  }

  return (
    <Card>
      <CardHead
        title="Vault"
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setEditing("new")}>
              Add login
            </Button>
          ) : null
        }
      />
      {items.length ? (
        <Table>
          <thead>
            <tr>
              <Th>Service</Th>
              <Th>Username</Th>
              <Th>Password</Th>
              <Th hideSm>Last revealed</Th>
              {canManage ? <Th aria-label="Actions" /> : null}
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id}>
                <Td>{i.service}</Td>
                <Td>{i.username}</Td>
                <Td>
                  <Reveal clientId={clientId} itemId={i.id} />
                </Td>
                <Td hideSm className="muted">
                  {i.last_reveal ? `${i.last_reveal.name} · ${fmtDate(i.last_reveal.at.slice(0, 10))}` : "Never"}
                </Td>
                {canManage ? (
                  <Td right>
                    <div className="row" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
                      <IconButton size="sm" label={`Edit ${i.service}`} onClick={() => setEditing(i)}>
                        <Pencil size={14} />
                      </IconButton>
                      <IconButton size="sm" label={`Delete ${i.service}`} disabled={busy} onClick={() => remove(i)}>
                        <Trash2 size={14} />
                      </IconButton>
                    </div>
                  </Td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <div className="card-body muted small">No saved logins yet.</div>
      )}
      <div className="card-body small muted">Every reveal is logged. Passwords hide again after {REVEAL_SECONDS} seconds.</div>
      {editing ? <VaultDialog clientId={clientId} item={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
    </Card>
  );
}

function Reveal({ clientId, itemId }: { clientId: string; itemId: string }) {
  const [value, setValue] = useState<string | null>(null);
  const [left, setLeft] = useState(0);
  const [busy, start] = useTransition();
  const toast = useToast();

  useEffect(() => {
    if (value == null) return;
    const tick = setInterval(() => setLeft((s) => s - 1), 1000);
    const hide = setTimeout(() => setValue(null), REVEAL_SECONDS * 1000);
    return () => {
      clearInterval(tick);
      clearTimeout(hide);
    };
  }, [value]);

  function reveal() {
    start(async () => {
      const r = await revealVaultItem({ clientId, itemId });
      if (!r.ok) return toast(r.error);
      setLeft(REVEAL_SECONDS);
      setValue(r.value);
    });
  }

  return (
    <span className="row" style={{ gap: 8, flexWrap: "nowrap" }}>
      <span style={{ fontFamily: "ui-monospace, monospace" }}>{value ?? "••••••••••"}</span>
      {value != null ? (
        <Button size="sm" variant="ghost" onClick={() => setValue(null)}>
          Hide ({left}s)
        </Button>
      ) : (
        <Button size="sm" variant="ghost" disabled={busy} onClick={reveal}>
          Reveal
        </Button>
      )}
    </span>
  );
}

function VaultDialog({ clientId, item, onClose }: { clientId: string; item: VaultItem | null; onClose: () => void }) {
  const [busy, start] = useTransition();
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <Dialog
      open
      onClose={onClose}
      title={item ? `Edit ${item.service}` : "Add login"}
      footer={
        <Button variant="primary" disabled={busy} onClick={() => formRef.current?.requestSubmit()}>
          Save login
        </Button>
      }
    >
      <form
        ref={formRef}
        autoComplete="off"
        action={(fd) =>
          start(async () => {
            const r = await saveVaultItem({
              clientId,
              itemId: item?.id ?? null,
              service: fd.get("service"),
              username: fd.get("username"),
              password: fd.get("password"),
              notes: fd.get("notes"),
            });
            toast(r.ok ? "Login saved to vault" : r.error);
            if (r.ok) onClose();
          })
        }
      >
        <FormGrid>
          <Field label="Service" htmlFor="v-svc">
            <Input id="v-svc" name="service" required defaultValue={item?.service ?? ""} placeholder="e.g. Google Ads" />
          </Field>
          <Field label="Username" htmlFor="v-user">
            <Input id="v-user" name="username" defaultValue={item?.username ?? ""} />
          </Field>
          <Field label={item ? "New password (leave empty to keep)" : "Password"} htmlFor="v-pw" full>
            <Input id="v-pw" name="password" type="password" autoComplete="new-password" required={!item} />
          </Field>
          <Field label="Notes" htmlFor="v-notes" full>
            <Textarea id="v-notes" name="notes" rows={2} defaultValue={item?.notes ?? ""} />
          </Field>
        </FormGrid>
      </form>
    </Dialog>
  );
}

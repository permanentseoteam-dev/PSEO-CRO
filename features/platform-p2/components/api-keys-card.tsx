"use client";

import { useState, useTransition } from "react";
import { Copy } from "lucide-react";
import { Button, ButtonLink, Card, CardHead, Checkbox, Dialog, EmptyState, Field, FormGrid, IconButton, Input, StatusDot, Table, Td, Th, useToast } from "@/components/ui";
import { createApiKey, revokeApiKey } from "../actions";
import { shortDate } from "../logic";
import { API_SCOPES, type ApiKeyRow } from "../types";

/** Settings → API keys (admin). The full key appears once, right after it is created. */
export function ApiKeysCard({ keys, docsHref = "/settings/api" }: { keys: ApiKeyRow[]; docsHref?: string }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(form: HTMLFormElement) {
    const f = new FormData(form);
    start(async () => {
      const r = await createApiKey({ name: f.get("name"), scopes: f.getAll("scopes") });
      if (!r.ok) return toast(r.error);
      setCreated(r.data?.key ?? null);
    });
  }

  function close() {
    setOpen(false);
    setCreated(null);
  }

  return (
    <Card id="api">
      <CardHead
        title="API keys"
        actions={
          <span className="row" style={{ gap: 6 }}>
            <ButtonLink size="sm" variant="ghost" href={docsHref}>API docs</ButtonLink>
            <Button size="sm" variant="primary" onClick={() => setOpen(true)}>Create key</Button>
          </span>
        }
      />
      {keys.length === 0 ? (
        <EmptyState title="No API keys yet" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Scopes</Th>
              <Th hideSm>Created</Th>
              <Th hideSm>Last used</Th>
              <Th right>Status</Th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id}>
                <Td>
                  <div>{k.name}</div>
                  <code className="small muted">{k.prefix}_…</code>
                </Td>
                <Td>
                  {k.scopes.map((s, i) => (
                    <span key={s}>
                      {i ? ", " : ""}
                      <code>{s}</code>
                    </span>
                  ))}
                </Td>
                <Td hideSm>{shortDate(k.created_at)}</Td>
                <Td hideSm>{k.last_used_at ? shortDate(k.last_used_at) : "Never"}</Td>
                <Td right>
                  {k.revoked_at ? (
                    <StatusDot tone="muted">Revoked</StatusDot>
                  ) : (
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={pending}
                      onClick={() =>
                        start(async () => {
                          const r = await revokeApiKey({ id: k.id });
                          toast(r.ok ? "API key revoked" : r.error);
                        })
                      }
                    >
                      Revoke
                    </Button>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <Dialog
        open={open}
        onClose={close}
        title={created ? "Copy your new key" : "Create API key"}
        footer={
          created ? (
            <Button variant="primary" onClick={close}>Done</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={close}>Cancel</Button>
              <Button variant="primary" type="submit" form="pp2-key" disabled={pending}>Create key</Button>
            </>
          )
        }
      >
        {created ? (
          <div className="stack">
            <p className="small">This is the only time you can see this key. Store it somewhere safe.</p>
            <div className="row" style={{ flexWrap: "nowrap" }}>
              <Input readOnly value={created} aria-label="New API key" className="min-w-0 flex-1 font-mono" onFocus={(e) => e.currentTarget.select()} />
              <IconButton
                label="Copy key"
                onClick={() => {
                  void navigator.clipboard.writeText(created).then(() => toast("Key copied"));
                }}
              >
                <Copy size={16} />
              </IconButton>
            </div>
          </div>
        ) : (
          <form
            id="pp2-key"
            onSubmit={(e) => {
              e.preventDefault();
              submit(e.currentTarget);
            }}
          >
            <FormGrid>
              <Field label="Name" htmlFor="pp2-key-name" full>
                <Input id="pp2-key-name" name="name" required maxLength={80} placeholder="e.g. Data warehouse sync" />
              </Field>
              {API_SCOPES.map((s) => (
                <Checkbox key={s} name="scopes" value={s} label={<code>{s}</code>} />
              ))}
            </FormGrid>
          </form>
        )}
      </Dialog>
    </Card>
  );
}

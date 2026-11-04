"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog, Field, Input, useToast } from "@/components/ui";
import { checkDeleteClient, deleteClient } from "../actions";
import { nameMatches } from "../logic";

type Check = { allowed: boolean; blockers: string[]; removes: string[] };

/** "Delete client" button. Opens a dialog that checks the client's history and needs the exact name typed. */
export function DeleteClientButton({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [check, setCheck] = useState<Check | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function openDialog() {
    setOpen(true);
    setTyped("");
    setCheck(null);
    setError(null);
    start(async () => {
      const r = await checkDeleteClient({ clientId });
      if (r.ok) setCheck(r);
      else setError(r.error);
    });
  }

  function remove() {
    start(async () => {
      const r = await deleteClient({ clientId, typedName: typed });
      if (!r.ok) return toast(r.error);
      toast(`${clientName} deleted`);
      setOpen(false);
      router.push("/clients");
    });
  }

  const ready = !!check?.allowed && nameMatches(typed, clientName);

  return (
    <>
      <Button variant="danger" size="sm" onClick={openDialog}>
        Delete client
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Delete ${clientName}`}
        footer={
          <Button variant="primary-danger" disabled={!ready || busy} onClick={remove}>
            Delete for good
          </Button>
        }
      >
        <div className="stack">
          {error ? <p className="small t-danger">{error}</p> : null}
          {!check && !error ? <p className="small muted">Checking this client&rsquo;s history…</p> : null}
          {check && !check.allowed ? (
            <p className="small t-danger">Can&rsquo;t delete: {check.blockers.join(" ")}</p>
          ) : null}
          {check?.allowed ? (
            <>
              <p className="small" style={{ margin: 0 }}>
                This removes the client{check.removes.length ? ` with ${check.removes.join(", ")}` : ""}, its terms, vault logins and portal
                activity. It can&rsquo;t be undone. Type <strong>{clientName}</strong> to confirm.
              </p>
              <Field label="Client name" htmlFor="del-name">
                <Input id="del-name" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={clientName} autoComplete="off" />
              </Field>
            </>
          ) : null}
        </div>
      </Dialog>
    </>
  );
}

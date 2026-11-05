"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog, Field, Input, Select, useToast } from "@/components/ui";
import { END_REASONS } from "@/lib/modules/clients/logic";
import { archiveClient, checkDeleteClient, deleteClient } from "../actions";
import { nameMatches } from "../logic";

type Check = { allowed: boolean; blockers: string[]; removes: string[] };

/**
 * "Delete client" button. Opens a dialog that checks the client's history and needs the exact name typed.
 * A client with invoices is archived (ended) instead of deleted.
 */
export function DeleteClientButton({ clientId, clientName, ended }: { clientId: string; clientName: string; ended: boolean }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [reason, setReason] = useState("");
  const [check, setCheck] = useState<Check | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function openDialog() {
    setOpen(true);
    setTyped("");
    setReason("");
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

  function archive() {
    start(async () => {
      const r = await archiveClient({ clientId, typedName: typed, reason });
      if (!r.ok) return toast(r.error);
      toast(`${clientName} archived`);
      setOpen(false);
      router.refresh();
    });
  }

  const archiving = !!check && !check.allowed;
  const named = nameMatches(typed, clientName);
  const ready = archiving ? !ended && named && !!reason : !!check?.allowed && named;

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
          archiving && ended ? null : (
            <Button variant="primary-danger" disabled={!ready || busy} onClick={archiving ? archive : remove}>
              {archiving ? "Archive client" : "Delete for good"}
            </Button>
          )
        }
      >
        <div className="stack">
          {error ? <p className="small t-danger">{error}</p> : null}
          {!check && !error ? <p className="small muted">Checking this client&rsquo;s history…</p> : null}
          {archiving ? (
            <>
              <p className="small" style={{ margin: 0 }}>
                Can&rsquo;t delete: {check.blockers.join(" ")}
                {ended ? ` ${clientName} is already ended, so nothing more is needed.` : ` Type ${clientName} and choose a reason to end the client.`}
              </p>
              {!ended ? (
                <>
                  <Field label="Reason" htmlFor="arc-reason">
                    <Select id="arc-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
                      <option value="" disabled>
                        Choose a reason
                      </option>
                      {END_REASONS.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Client name" htmlFor="arc-name">
                    <Input id="arc-name" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={clientName} autoComplete="off" />
                  </Field>
                </>
              ) : null}
            </>
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

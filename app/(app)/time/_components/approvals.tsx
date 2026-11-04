"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Button, Dialog, Field, FormGrid, Textarea, useToast } from "@/components/ui";
import { decideLeave, decideSheet } from "../actions";

export function SheetActions({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();

  const approve = () =>
    start(async () => {
      const r = await decideSheet({ id, decision: "approve" });
      toast(r.ok ? "Timesheet approved" : r.error);
    });

  function sendBack(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const note = String(new FormData(e.currentTarget).get("note") ?? "");
    start(async () => {
      const r = await decideSheet({ id, decision: "return", note });
      if (!r.ok) return toast(r.error);
      setOpen(false);
      toast("Timesheet returned");
    });
  }

  return (
    <div className="row flex-nowrap justify-end">
      <Button size="sm" disabled={pending} onClick={() => setOpen(true)}>Return</Button>
      <Button size="sm" variant="primary" disabled={pending} onClick={approve}>Approve</Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Return ${name}'s timesheet`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" form={`ret-${id}`} disabled={pending}>Return timesheet</Button>
          </>
        }
      >
        <form id={`ret-${id}`} onSubmit={sendBack}>
          <FormGrid>
            <Field label="Note for the person" htmlFor={`ret-note-${id}`} full>
              <Textarea id={`ret-note-${id}`} name="note" rows={3} maxLength={1000} required />
            </Field>
          </FormGrid>
        </form>
      </Dialog>
    </div>
  );
}

export function LeaveActions({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const run = (decision: "approve" | "decline") =>
    start(async () => {
      const r = await decideLeave({ id, decision });
      toast(r.ok ? (decision === "approve" ? "Request approved" : "Request declined") : r.error);
    });
  return (
    <div className="row flex-nowrap justify-end">
      <Button size="sm" disabled={pending} onClick={() => run("decline")}>Decline</Button>
      <Button size="sm" variant="primary" disabled={pending} onClick={() => run("approve")}>Approve</Button>
    </div>
  );
}

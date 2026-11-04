"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Button, Checkbox, Dialog, Field, FormGrid, Input, Select, useToast } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { acknowledgeReview, addDocument, cancelLeave, documentUrl } from "../actions";

const MAX = 15 * 1024 * 1024;

export function UploadDoc({ memberId, canHr }: { memberId: string; canHr: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const file = fd.get("file");
    if (!(file instanceof File) || !file.size) return toast("Choose a file.");
    if (file.size > MAX) return toast("Files can be up to 15 MB.");
    start(async () => {
      const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-120);
      const path = `${memberId}/${crypto.randomUUID()}-${safe}`;
      const { error } = await createClient().storage.from("member-docs").upload(path, file, { contentType: file.type || undefined });
      if (error) return toast(error.message);
      const r = await addDocument({
        path,
        name: file.name.slice(0, 200),
        type: fd.get("type"),
        expiresOn: (fd.get("expires") as string) || null,
        hrOnly: fd.get("hrOnly") === "on",
        size: file.size,
      });
      if (!r.ok) return toast(r.error);
      setOpen(false);
      toast("Document uploaded");
    });
  }

  return (
    <>
      <Button variant="primary" size="sm" onClick={() => setOpen(true)}>Upload</Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Upload document"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" form="doc-up" disabled={pending}>{pending ? "Uploading…" : "Upload"}</Button>
          </>
        }
      >
        <form id="doc-up" onSubmit={submit}>
          <FormGrid>
            <Field label="File (up to 15 MB)" htmlFor="doc-file" full>
              <Input id="doc-file" name="file" type="file" required />
            </Field>
            <Field label="Type" htmlFor="doc-type">
              <Select id="doc-type" name="type" defaultValue="other">
                <option value="id">ID</option>
                <option value="visa">Visa</option>
                <option value="contract">Contract</option>
                <option value="letter">Letter</option>
                <option value="education">Education</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field label="Expiry" htmlFor="doc-exp">
              <Input id="doc-exp" name="expires" type="date" />
            </Field>
            {canHr ? <Checkbox className="field full" name="hrOnly" label="HR only" /> : null}
          </FormGrid>
        </form>
      </Dialog>
    </>
  );
}

export function OpenDoc({ id, hasFile }: { id: string; hasFile: boolean }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={!hasFile || pending}
      title={hasFile ? undefined : "No file uploaded yet"}
      onClick={() =>
        start(async () => {
          const r = await documentUrl(id);
          if (!r.ok || !r.data) return toast(r.ok ? "Couldn't open the file." : r.error);
          window.open(r.data.url, "_blank", "noopener");
        })
      }
    >
      Open
    </Button>
  );
}

export function AckReview({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await acknowledgeReview(id);
          toast(r.ok ? "Review acknowledged" : r.error);
        })
      }
    >
      Acknowledge
    </Button>
  );
}

export function CancelLeave({ id }: { id: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await cancelLeave(id);
          toast(r.ok ? "Request cancelled" : r.error);
        })
      }
    >
      Cancel
    </Button>
  );
}

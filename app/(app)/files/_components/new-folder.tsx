"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Checkbox, Dialog, Field, FormGrid, Input, Select, useToast } from "@/components/ui";
import type { Option } from "@/lib/modules/clientops/types";
import { createFolder } from "../actions";

export function NewFolderButton({ clients, clientId }: { clients: Option[]; clientId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();

  function submit(fd: FormData) {
    const cid = String(fd.get("clientId"));
    start(async () => {
      const res = await createFolder({ clientId: cid, name: fd.get("name"), clientVisible: fd.get("visible") === "on" });
      if (!res.ok) return toast(res.error);
      toast("Folder created");
      setOpen(false);
      router.push(`/files?client=${cid}&folder=${res.id}`);
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>New folder</Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="New folder"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="new-folder" disabled={pending}>
              Create folder
            </Button>
          </>
        }
      >
        <form id="new-folder" action={submit}>
          <FormGrid>
            <Field label="Client" htmlFor="nf-client">
              <Select id="nf-client" name="clientId" defaultValue={clientId}>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Folder name" htmlFor="nf-name">
              <Input id="nf-name" name="name" placeholder="e.g. Ramadan 2027" maxLength={80} required />
            </Field>
            <Field label="Visibility" full>
              <Checkbox label="Client can see this folder" name="visible" defaultChecked />
            </Field>
          </FormGrid>
        </form>
      </Dialog>
    </>
  );
}

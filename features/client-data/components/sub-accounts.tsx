"use client";

import { useState, useTransition } from "react";
import { Button, Dialog, Field, FormGrid, Select, useToast } from "@/components/ui";
import { linkSubAccount, unlinkSubAccount } from "../actions";

export function LinkSubAccountButton({ parentId, options }: { parentId: string; options: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [childId, setChildId] = useState("");
  const [billing, setBilling] = useState<"parent" | "own">("parent");
  const [pending, start] = useTransition();
  const toast = useToast();

  const save = () =>
    start(async () => {
      const res = await linkSubAccount({ parentId, childId, billing });
      if (!res.ok) return toast(res.error);
      toast("Sub-account linked");
      setOpen(false);
      setChildId("");
    });

  return (
    <>
      <Button size="sm" variant="primary" onClick={() => setOpen(true)}>
        Link sub-account
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Link sub-account"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={!childId || pending} onClick={save}>
              Link
            </Button>
          </>
        }
      >
        <FormGrid>
          <Field label="Client" htmlFor="sub-child" full>
            <Select id="sub-child" value={childId} onChange={(e) => setChildId(e.target.value)}>
              <option value="">Choose a client</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Billing" htmlFor="sub-billing" full>
            <Select id="sub-billing" value={billing} onChange={(e) => setBilling(e.target.value as "parent" | "own")}>
              <option value="parent">Billed to parent</option>
              <option value="own">Own invoice</option>
            </Select>
          </Field>
        </FormGrid>
      </Dialog>
    </>
  );
}

export function UnlinkButton({ id, parentId, name }: { id: string; parentId: string; name: string }) {
  const [pending, start] = useTransition();
  const toast = useToast();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      aria-label={`Unlink ${name}`}
      onClick={() =>
        start(async () => {
          const res = await unlinkSubAccount({ id, parentId });
          toast(res.ok ? "Sub-account unlinked" : res.error);
        })
      }
    >
      Unlink
    </Button>
  );
}

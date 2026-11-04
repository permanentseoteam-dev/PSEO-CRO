"use client";

import { useState, useTransition } from "react";
import { Button, Dialog, Field, FormGrid, Input, Textarea, useToast } from "@/components/ui";
import type { BrandKit } from "@/lib/modules/clientops/types";
import { saveBrandKit } from "../actions";

export function BrandKitButton({ clientId, kit, label }: { clientId: string; kit: BrandKit | null; label: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();

  function submit(fd: FormData) {
    start(async () => {
      const res = await saveBrandKit({
        clientId,
        colours: fd.get("colours") ?? "",
        fonts: fd.get("fonts") ?? "",
        tone: fd.get("tone") ?? "",
        dos: fd.get("dos") ?? "",
        donts: fd.get("donts") ?? "",
      });
      if (!res.ok) return toast(res.error);
      toast("Brand kit saved");
      setOpen(false);
    });
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Edit brand kit"
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="brand-kit" disabled={pending}>
              Save brand kit
            </Button>
          </>
        }
      >
        <form id="brand-kit" action={submit}>
          <FormGrid>
            <Field label="Colours (name and hex, one per line)" htmlFor="bk-col" full>
              <Textarea id="bk-col" name="colours" rows={3} placeholder="Alba red #c8102e" defaultValue={kit?.colours.map((c) => `${c.name} ${c.hex}`).join("\n")} />
            </Field>
            <Field label="Fonts" htmlFor="bk-fonts" full>
              <Input id="bk-fonts" name="fonts" maxLength={300} defaultValue={kit?.fonts ?? ""} />
            </Field>
            <Field label="Tone" htmlFor="bk-tone" full>
              <Textarea id="bk-tone" name="tone" rows={2} defaultValue={kit?.tone ?? ""} />
            </Field>
            <Field label="Do's (one per line)" htmlFor="bk-dos">
              <Textarea id="bk-dos" name="dos" rows={3} defaultValue={kit?.dos.join("\n")} />
            </Field>
            <Field label="Don'ts (one per line)" htmlFor="bk-donts">
              <Textarea id="bk-donts" name="donts" rows={3} defaultValue={kit?.donts.join("\n")} />
            </Field>
          </FormGrid>
        </form>
      </Dialog>
    </>
  );
}

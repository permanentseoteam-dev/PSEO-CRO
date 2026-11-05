"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button, Checkbox, Dialog, Field, FormGrid, Input, Select, Textarea, useToast } from "@/components/ui";
import type { Option } from "@/lib/modules/clientops/types";
import { logMeeting } from "../actions";

export function MeetingsToolbar({ mine, clients, today }: { mine: boolean; clients: Option[]; today: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();

  function toggleMine(on: boolean) {
    const p = new URLSearchParams(window.location.search);
    if (on) p.set("mine", "1");
    else p.delete("mine");
    router.replace(`${pathname}?${p.toString()}`);
  }

  function submit(fd: FormData) {
    start(async () => {
      const res = await logMeeting({
        clientId: fd.get("clientId"),
        date: fd.get("date"),
        title: fd.get("title"),
        summary: fd.get("summary") ?? "",
        decisions: fd.get("decisions") ?? "",
        concerns: fd.get("concerns") ?? "",
        actions: fd.get("actions") ?? "",
      });
      if (!res.ok) return toast(res.error);
      toast("Notes saved. Review the action items below.");
      setOpen(false);
      router.push("/meetings?tab=review");
    });
  }

  return (
    <div className="row">
      <Checkbox label="Only my clients" checked={mine} onChange={(e) => toggleMine(e.target.checked)} />
      <Button variant="primary" onClick={() => setOpen(true)} disabled={!clients.length}>
        Log meeting notes
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Log meeting notes"
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="meet-log" disabled={pending}>
              Save and review actions
            </Button>
          </>
        }
      >
        <form id="meet-log" action={submit}>
          <FormGrid>
            <Field label="Client" htmlFor="ml-client">
              <Select id="ml-client" name="clientId" required defaultValue={clients[0]?.id}>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Date" htmlFor="ml-date">
              <Input id="ml-date" name="date" type="date" defaultValue={today} required />
            </Field>
            <Field label="Title" htmlFor="ml-title" full>
              <Input id="ml-title" name="title" placeholder="e.g. Monthly review" maxLength={200} required />
            </Field>
            <Field label="Summary" htmlFor="ml-sum" full>
              <Textarea id="ml-sum" name="summary" rows={2} />
            </Field>
            <Field label="Decisions (one per line)" htmlFor="ml-dec" full>
              <Textarea id="ml-dec" name="decisions" rows={2} />
            </Field>
            <Field label="Concerns and quotes (topic: quote)" htmlFor="ml-con" full>
              <Textarea id="ml-con" name="concerns" rows={2} placeholder="Lead emails late: We got the leads a day late." />
            </Field>
            <Field label="Action items (one per line, owner after a dash)" htmlFor="ml-act" full>
              <Textarea id="ml-act" name="actions" rows={3} placeholder="Fix lead email routing - Daniel Reyes" />
            </Field>
          </FormGrid>
        </form>
      </Dialog>
    </div>
  );
}

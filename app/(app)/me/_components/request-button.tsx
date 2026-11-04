"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Button, Checkbox, Dialog, Field, FormGrid, Input, Select, Textarea, useToast } from "@/components/ui";
import { addDays, parseDuration, today } from "@/lib/modules/personal/logic";
import { requestLeave } from "../actions";

const TITLES = { leave: ["Request leave", "Request leave"], wfh: ["Request WFH", "Request work from home"], overtime: ["Request overtime", "Request overtime"] } as const;

/** Leave, work-from-home or overtime request: a button plus its dialog. */
export function RequestButton({ kind, variant = "default" }: { kind: "leave" | "wfh" | "overtime"; variant?: "default" | "primary" | "ghost" }) {
  const [open, setOpen] = useState(false);
  const [half, setHalf] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  const t = today();
  const id = `rq-${kind}`;

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    let minutes: number | undefined;
    if (kind === "overtime") {
      const m = parseDuration(f.extra ?? "");
      if (!m) return toast("Enter the extra time, like 2h 00m.");
      minutes = m;
    }
    start(async () => {
      const r = await requestLeave({
        type: kind === "leave" ? f.type : kind,
        start: f.start,
        end: f.end || f.start,
        halfDay: half,
        minutes,
        reason: f.reason ?? "",
      });
      if (!r.ok) return toast(r.error);
      setOpen(false);
      setHalf(false);
      toast("Request sent");
    });
  }

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        {TITLES[kind][0]}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={TITLES[kind][1]}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" form={id} disabled={pending}>Send request</Button>
          </>
        }
      >
        <form id={id} onSubmit={submit}>
          <FormGrid>
            {kind === "leave" ? (
              <Field label="Type" htmlFor={`${id}-type`}>
                <Select id={`${id}-type`} name="type" defaultValue="annual">
                  <option value="annual">Annual</option>
                  <option value="sick">Sick</option>
                  <option value="wfh">Work from home</option>
                  <option value="unpaid">Unpaid</option>
                </Select>
              </Field>
            ) : null}
            {kind !== "overtime" ? (
              <Checkbox className="field" label="Half day" checked={half} onChange={(e) => setHalf(e.currentTarget.checked)} />
            ) : null}
            <Field label={kind === "leave" ? "From" : "Date"} htmlFor={`${id}-start`}>
              <Input id={`${id}-start`} name="start" type="date" required defaultValue={kind === "leave" ? addDays(t, 12) : kind === "wfh" ? addDays(t, 2) : addDays(t, -1)} />
            </Field>
            {kind === "leave" && !half ? (
              <Field label="To" htmlFor={`${id}-end`}>
                <Input id={`${id}-end`} name="end" type="date" defaultValue={addDays(t, 13)} />
              </Field>
            ) : null}
            {kind === "overtime" ? (
              <Field label="Extra time" htmlFor={`${id}-extra`}>
                <Input id={`${id}-extra`} name="extra" placeholder="2h 00m" required />
              </Field>
            ) : null}
            <Field label="Reason" htmlFor={`${id}-reason`} full>
              <Textarea id={`${id}-reason`} name="reason" rows={2} maxLength={1000} required={kind !== "leave"} />
            </Field>
          </FormGrid>
        </form>
      </Dialog>
    </>
  );
}

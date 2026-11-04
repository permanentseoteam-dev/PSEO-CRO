"use client";

import { useState, useTransition } from "react";
import { Button, Checkbox, Dialog, Field, FormGrid, Input, Select, useToast } from "@/components/ui";
import type { SlaSettings } from "@/lib/modules/clientops/types";
import { saveTargets } from "../actions";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const ZONES = [
  ["Asia/Dubai", "Asia/Dubai (GMT+4)"],
  ["Asia/Karachi", "Asia/Karachi (GMT+5)"],
  ["Europe/London", "Europe/London"],
];

export function TargetsButton({ settings }: { settings: SlaSettings }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();

  function submit(fd: FormData) {
    start(async () => {
      const res = await saveTargets({
        replyHours: fd.get("replyHours"),
        requestHours: fd.get("requestHours"),
        changesHours: fd.get("changesHours"),
        timezone: fd.get("timezone"),
        dayStart: fd.get("dayStart"),
        dayEnd: fd.get("dayEnd"),
        workdays: fd.getAll("workdays"),
        alertAnswerer: fd.get("alertAnswerer") === "on",
        alertManager: fd.get("alertManager") === "on",
        postDaily: fd.get("postDaily") === "on",
      });
      if (!res.ok) return toast(res.error);
      toast("Targets saved");
      setOpen(false);
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>Targets and hours</Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Targets and hours"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="sla-targets" disabled={pending}>
              Save targets
            </Button>
          </>
        }
      >
        <form id="sla-targets" action={submit}>
          <FormGrid>
            <Field label="Reply to a message (hours)" htmlFor="t-reply">
              <Input id="t-reply" name="replyHours" type="number" min={0.5} max={72} step={0.5} defaultValue={settings.replyHours} required />
            </Field>
            <Field label="Answer a request (hours)" htmlFor="t-req">
              <Input id="t-req" name="requestHours" type="number" min={0.5} max={72} step={0.5} defaultValue={settings.requestHours} required />
            </Field>
            <Field label="Act on changes (hours)" htmlFor="t-chg">
              <Input id="t-chg" name="changesHours" type="number" min={0.5} max={72} step={0.5} defaultValue={settings.changesHours} required />
            </Field>
            <Field label="Time zone" htmlFor="t-tz">
              <Select id="t-tz" name="timezone" defaultValue={settings.timezone}>
                {ZONES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Day starts" htmlFor="t-start">
              <Input id="t-start" name="dayStart" type="time" defaultValue={settings.dayStart} required />
            </Field>
            <Field label="Day ends" htmlFor="t-end">
              <Input id="t-end" name="dayEnd" type="time" defaultValue={settings.dayEnd} required />
            </Field>
            <Field label="Workdays" full>
              <div className="row" style={{ gap: 10 }}>
                {DAYS.map((d, i) => (
                  <Checkbox key={d} label={d} name="workdays" value={i + 1} defaultChecked={settings.workdays.includes(i + 1)} />
                ))}
              </div>
            </Field>
            <Field label="Alerts" full>
              <div className="stack" style={{ gap: 6 }}>
                <Checkbox label="Alert the person who should answer when the target is reached" name="alertAnswerer" defaultChecked={settings.alertAnswerer} />
                <Checkbox label="Alert their manager at 2× the target" name="alertManager" defaultChecked={settings.alertManager} />
                <Checkbox label="Post late waits in #client-success each morning" name="postDaily" defaultChecked={settings.postDaily} />
              </div>
            </Field>
          </FormGrid>
        </form>
      </Dialog>
    </>
  );
}

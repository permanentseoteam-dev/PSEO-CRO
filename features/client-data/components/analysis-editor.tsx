"use client";

import { useState, useTransition } from "react";
import { Button, Dialog, Field, FormGrid, Input, Textarea, useToast } from "@/components/ui";
import { saveAnalysis } from "../actions";
import type { Analysis } from "../types";

const split = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);

/** Edit (or start) the month's analysis. One point per line. */
export function AnalysisEditor({ clientId, analysis, defaultPeriod }: { clientId: string; analysis: Analysis | null; defaultPeriod: string }) {
  const [open, setOpen] = useState(false);
  const [period, setPeriod] = useState((analysis?.period ?? defaultPeriod).slice(0, 7));
  const [changed, setChanged] = useState(analysis?.whatChanged.join("\n") ?? "");
  const [why, setWhy] = useState(analysis?.why.join("\n") ?? "");
  const [next, setNext] = useState(analysis?.nextSteps.join("\n") ?? "");
  const [pending, start] = useTransition();
  const toast = useToast();

  const save = () =>
    start(async () => {
      const res = await saveAnalysis({ clientId, period: `${period}-01`, whatChanged: split(changed), why: split(why), nextSteps: split(next) });
      if (!res.ok) return toast(res.error);
      toast("Analysis saved");
      setOpen(false);
    });

  return (
    <>
      <Button size="sm" variant={analysis ? "default" : "primary"} onClick={() => setOpen(true)}>
        {analysis ? "Edit analysis" : "Write analysis"}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Monthly analysis"
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={pending} onClick={save}>
              Save analysis
            </Button>
          </>
        }
      >
        <FormGrid>
          <Field label="Month" htmlFor="an-month">
            <Input id="an-month" type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
          </Field>
          <Field label="What changed" htmlFor="an-changed" hint="One point per line" full>
            <Textarea id="an-changed" rows={4} value={changed} onChange={(e) => setChanged(e.target.value)} />
          </Field>
          <Field label="Why" htmlFor="an-why" full>
            <Textarea id="an-why" rows={4} value={why} onChange={(e) => setWhy(e.target.value)} />
          </Field>
          <Field label="What we'll do next" htmlFor="an-next" full>
            <Textarea id="an-next" rows={4} value={next} onChange={(e) => setNext(e.target.value)} />
          </Field>
        </FormGrid>
      </Dialog>
    </>
  );
}

"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog, Field, FormGrid, Input, Select, Textarea, useToast } from "@/components/ui";
import { CONFIDENCE, MAX_KEY_RESULTS } from "@/lib/modules/team/logic";
import type { Confidence } from "@/lib/modules/team/types";
import { checkIn, createObjective, setCycleStatus, submitSelfReview, updateKpiValue } from "../actions";

type Res = { ok: true } | { ok: false; error: string };
type Opt = { id: string; name: string };

/** Opens a dialog; runs the action on submit, toasts, refreshes. */
function useSubmit(done: string, close: () => void) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<Res>) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return toast(res.error);
      toast(done);
      close();
      router.refresh();
    });
  return { pending, run };
}

function FormDialog(props: {
  open: boolean;
  onClose: () => void;
  title: string;
  submit: string;
  pending: boolean;
  onSubmit: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      title={props.title}
      footer={
        <>
          <Button variant="ghost" onClick={props.onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="perf-form" disabled={props.pending}>
            {props.submit}
          </Button>
        </>
      }
    >
      <form
        id="perf-form"
        onSubmit={(e) => {
          e.preventDefault();
          props.onSubmit();
        }}
      >
        <FormGrid>{props.children}</FormGrid>
      </form>
    </Dialog>
  );
}

// ---------------------------------------------------------------- KPI value

export function UpdateKpiButton({
  kpis,
  initialId,
  label,
  variant,
}: {
  kpis: { id: string; name: string; value: number }[];
  initialId: string;
  label: string;
  variant?: "ghost";
}) {
  const [open, setOpen] = useState(false);
  const [id, setId] = useState(initialId);
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const { pending, run } = useSubmit("Value updated", () => setOpen(false));
  const show = () => {
    setId(initialId);
    setValue(String(kpis.find((k) => k.id === initialId)?.value ?? ""));
    setNote("");
    setOpen(true);
  };
  return (
    <>
      <Button size="sm" variant={variant} onClick={show}>
        {label}
      </Button>
      <FormDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Update KPI value"
        submit="Update value"
        pending={pending}
        onSubmit={() => run(() => updateKpiValue({ id, value, note }))}
      >
        <Field label="KPI" htmlFor="kpi-id">
          <Select
            id="kpi-id"
            value={id}
            onChange={(e) => {
              setId(e.target.value);
              setValue(String(kpis.find((k) => k.id === e.target.value)?.value ?? ""));
            }}
          >
            {kpis.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="New value" htmlFor="kpi-val">
          <Input id="kpi-val" type="number" min={0} step="any" required value={value} onChange={(e) => setValue(e.target.value)} />
        </Field>
        <Field label="Note" htmlFor="kpi-note" full>
          <Textarea id="kpi-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </FormDialog>
    </>
  );
}

// ---------------------------------------------------------------- self-review

export function SelfReviewButton({ cycleId, quarter }: { cycleId: string; quarter: string }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ wentWell: "", toImprove: "", rating: "4", nextGoal: "" });
  const { pending, run } = useSubmit("Self-review sent to your manager", () => setOpen(false));
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        Write self-review
      </Button>
      <FormDialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Self-review for ${quarter}`}
        submit="Submit self-review"
        pending={pending}
        onSubmit={() => run(() => submitSelfReview({ cycleId, ...f }))}
      >
        <Field label="What went well" htmlFor="sr-well" full>
          <Textarea id="sr-well" rows={3} required value={f.wentWell} onChange={set("wentWell")} />
        </Field>
        <Field label="What to improve" htmlFor="sr-improve" full>
          <Textarea id="sr-improve" rows={3} required value={f.toImprove} onChange={set("toImprove")} />
        </Field>
        <Field label="Rating for yourself" htmlFor="sr-rating">
          <Select id="sr-rating" value={f.rating} onChange={set("rating")}>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n} of 5
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Goal for next quarter" htmlFor="sr-goal">
          <Input id="sr-goal" value={f.nextGoal} onChange={set("nextGoal")} />
        </Field>
      </FormDialog>
    </>
  );
}

// ---------------------------------------------------------------- OKRs

export function NewObjectiveButton({ people, meId, quarters, quarter }: { people: Opt[]; meId: string; quarters: string[]; quarter: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [ownerId, setOwnerId] = useState(meId);
  const [q, setQ] = useState(quarter);
  const [krs, setKrs] = useState(["", "", ""]);
  const { pending, run } = useSubmit("Objective created", () => setOpen(false));
  const show = () => {
    setTitle("");
    setOwnerId(meId);
    setQ(quarter);
    setKrs(["", "", ""]);
    setOpen(true);
  };
  return (
    <>
      <Button variant="primary" onClick={show}>
        New objective
      </Button>
      <FormDialog
        open={open}
        onClose={() => setOpen(false)}
        title="New objective"
        submit="Create objective"
        pending={pending}
        onSubmit={() => run(() => createObjective({ title, ownerId, quarter: q, keyResults: krs }))}
      >
        <Field label="Objective" htmlFor="ob-title" full>
          <Input id="ob-title" required placeholder="e.g. Make reporting effortless" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Owner" htmlFor="ob-owner">
          <Select id="ob-owner" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Quarter" htmlFor="ob-q">
          <Select id="ob-q" value={q} onChange={(e) => setQ(e.target.value)}>
            {quarters.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </Select>
        </Field>
        {krs.map((k, i) => (
          <Field key={i} label={`Key result ${i + 1}`} htmlFor={`ob-kr-${i}`} full>
            <Input
              id={`ob-kr-${i}`}
              placeholder="Measurable result"
              required={i === 0}
              value={k}
              onChange={(e) => setKrs(krs.map((x, j) => (j === i ? e.target.value : x)))}
            />
          </Field>
        ))}
        {krs.length < MAX_KEY_RESULTS ? (
          <div className="field full">
            <Button size="sm" variant="ghost" onClick={() => setKrs([...krs, ""])}>
              Add key result
            </Button>
          </div>
        ) : null}
      </FormDialog>
    </>
  );
}

export function CheckInButton({ krs }: { krs: { id: string; title: string; progress: number; confidence: Confidence }[] }) {
  const [open, setOpen] = useState(false);
  const [id, setId] = useState("");
  const [progress, setProgress] = useState("");
  const [confidence, setConfidence] = useState<Confidence>("on_track");
  const [note, setNote] = useState("");
  const { pending, run } = useSubmit("Check-in saved", () => setOpen(false));
  const pick = (krId: string) => {
    const kr = krs.find((k) => k.id === krId);
    setId(krId);
    setProgress(String(kr?.progress ?? 0));
    setConfidence(kr?.confidence ?? "on_track");
  };
  return (
    <>
      <Button
        size="sm"
        disabled={!krs.length}
        onClick={() => {
          pick(krs[0]?.id ?? "");
          setNote("");
          setOpen(true);
        }}
      >
        Check in
      </Button>
      <FormDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Check in"
        submit="Save check-in"
        pending={pending}
        onSubmit={() => run(() => checkIn({ keyResultId: id, progress, confidence, note }))}
      >
        <Field label="Key result" htmlFor="ci-kr" full>
          <Select id="ci-kr" value={id} onChange={(e) => pick(e.target.value)}>
            {krs.map((k) => (
              <option key={k.id} value={k.id}>
                {k.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Progress %" htmlFor="ci-progress">
          <Input id="ci-progress" type="number" min={0} max={100} required value={progress} onChange={(e) => setProgress(e.target.value)} />
        </Field>
        <Field label="Confidence" htmlFor="ci-conf">
          <Select id="ci-conf" value={confidence} onChange={(e) => setConfidence(e.target.value as Confidence)}>
            {(Object.keys(CONFIDENCE) as Confidence[]).map((c) => (
              <option key={c} value={c}>
                {CONFIDENCE[c].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Note" htmlFor="ci-note" full>
          <Textarea id="ci-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </FormDialog>
    </>
  );
}

// ---------------------------------------------------------------- setup

export function CycleToggle({ id, status }: { id: string; status: "open" | "closed" }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const next = status === "open" ? "closed" : "open";
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await setCycleStatus({ id, status: next });
          if (!res.ok) return toast(res.error);
          toast(next === "closed" ? "Review cycle closed" : "Review cycle opened");
          router.refresh();
        })
      }
    >
      {status === "open" ? "Close cycle" : "Reopen cycle"}
    </Button>
  );
}

// ---------------------------------------------------------------- quarter selector

export function QuarterSelect({ quarters, value, tab }: { quarters: string[]; value: string; tab: string }) {
  const router = useRouter();
  return (
    <div className="row">
      <label htmlFor="perf-q" className="muted">
        Quarter
      </label>
      <Select
        id="perf-q"
        className="w-auto"
        value={value}
        onChange={(e) => router.push(`/performance?q=${encodeURIComponent(e.target.value)}&tab=${tab}`)}
      >
        {quarters.map((q) => (
          <option key={q}>{q}</option>
        ))}
      </Select>
    </div>
  );
}

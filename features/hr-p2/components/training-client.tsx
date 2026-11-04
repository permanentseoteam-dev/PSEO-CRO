"use client";

import { useTransition } from "react";
import { Card, CardBody, CardHead, Checkbox, StatusDot, useToast } from "@/components/ui";
import { setStepDone } from "../actions";
import { STEP_KIND_LABEL, STEP_STATUS, pathProgress, stepStatuses } from "../logic";
import type { MyPath } from "../types";
import css from "../hr.module.css";

export function TrainingTabClient({ paths }: { paths: MyPath[] }) {
  const [busy, start] = useTransition();
  const toast = useToast();

  function tick(assignmentId: string, stepId: string, done: boolean) {
    start(async () => {
      const r = await setStepDone({ assignmentId, stepId, done });
      toast(r.ok ? (done ? "Step done" : "Step reopened") : r.error);
    });
  }

  return (
    <div className="grid-2">
      {paths.map((p) => {
        const prog = pathProgress(p.steps, p.doneStepIds);
        const status = new Map(stepStatuses(p.steps, p.doneStepIds).map((s) => [s.id, s.status]));
        return (
          <Card key={p.assignmentId}>
            <CardHead title={p.name} actions={<span className="small muted">{`${prog.done} of ${prog.total}`}</span>} />
            <CardBody>
              <div className={`bar${prog.done === prog.total && prog.total ? " t-ok" : ""}`} role="progressbar" aria-valuenow={prog.pct} aria-valuemin={0} aria-valuemax={100}>
                <i style={{ width: `${prog.pct}%` }} />
              </div>
              <ol className={css.steps} style={{ marginTop: 12 }}>
                {p.steps.map((s) => {
                  const st = STEP_STATUS[status.get(s.id) ?? "not_started"];
                  const done = status.get(s.id) === "done";
                  return (
                    <li key={s.id}>
                      <Checkbox
                        label={
                          <span>
                            <span className="muted">{STEP_KIND_LABEL[s.kind]}</span> · {s.url ? <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a> : s.title}
                          </span>
                        }
                        checked={done}
                        disabled={busy}
                        onChange={(e) => tick(p.assignmentId, s.id, e.target.checked)}
                      />
                      <StatusDot tone={st.tone}>{st.label}</StatusDot>
                    </li>
                  );
                })}
              </ol>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}

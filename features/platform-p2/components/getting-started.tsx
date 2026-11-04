"use client";

import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import { Card, CardBody, CardHead, useToast } from "@/components/ui";
import { setOnboardingStep } from "../actions";
import { checklistProgress } from "../logic";
import { ONBOARDING_STEPS, type OnboardingStep } from "../types";

/** Getting started checklist. Hidden once every step is done. */
export function GettingStarted({ done }: { done: OnboardingStep[] }) {
  const toast = useToast();
  const [, start] = useTransition();
  const [steps, setSteps] = useOptimistic(done, (cur: OnboardingStep[], change: { step: OnboardingStep; on: boolean }) =>
    change.on ? [...cur, change.step] : cur.filter((s) => s !== change.step),
  );
  const p = checklistProgress(steps);
  if (checklistProgress(done).complete) return null;

  function toggle(step: OnboardingStep, on: boolean) {
    start(async () => {
      setSteps({ step, on });
      const r = await setOnboardingStep({ step, done: on });
      if (!r.ok) toast(r.error);
    });
  }

  return (
    <Card>
      <CardHead title="Getting started" actions={<span className="small muted num">{p.count} of {p.total} done</span>} />
      <CardBody className="stack">
        <div className="bar" aria-hidden>
          <i style={{ width: `${p.pct}%` }} />
        </div>
        {ONBOARDING_STEPS.map((s) => {
          const on = steps.includes(s.key);
          return (
            <div key={s.key} className="between row">
              <label className="check">
                <input type="checkbox" checked={on} onChange={(e) => toggle(s.key, e.target.checked)} />
                <span className={on ? "muted line-through" : undefined}>{s.label}</span>
              </label>
              {on ? null : (
                <Link href={s.href} className="small text-accent-ink">
                  Open
                </Link>
              )}
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}

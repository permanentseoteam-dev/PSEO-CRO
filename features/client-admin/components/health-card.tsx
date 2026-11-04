"use client";

import { useRef, useState, useTransition } from "react";
import { Button, Card, CardBody, CardHead, Dialog, Field, FormGrid, Input, Select, StatusDot, Textarea, useToast } from "@/components/ui";
import { addSentiment, raiseChurnAlert, setChurnOutcome } from "../actions";
import { CHURN_OUTCOME, CHURN_TRIGGER, fmtDate, sentimentLine } from "../logic";
import { CHURN_OUTCOMES, CHURN_TRIGGERS, SENTIMENTS, type ChurnAlert, type ChurnTrigger, type SentimentRow } from "../types";

type Props = {
  clientId: string;
  healthScore: number | null;
  sentiments: SentimentRow[];
  alerts: ChurnAlert[];
  /** Triggers the data points to that have no open alert yet. */
  suggestions: ChurnTrigger[];
  canManage: boolean;
};

/** Health card extras: sentiment with trend, churn alerts and their outcomes. */
export function HealthCard({ clientId, healthScore, sentiments, alerts, suggestions, canManage }: Props) {
  const [dialog, setDialog] = useState<null | "sentiment" | ChurnTrigger>(null);
  const [busy, start] = useTransition();
  const toast = useToast();
  const open = alerts.filter((a) => a.outcome === "open");
  const closed = alerts.filter((a) => a.outcome !== "open").slice(0, 3);

  function outcome(a: ChurnAlert, value: string) {
    start(async () => {
      const r = await setChurnOutcome({ clientId, alertId: a.id, outcome: value });
      toast(r.ok ? "Outcome saved" : r.error);
    });
  }

  return (
    <Card>
      <CardHead
        title="Health"
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setDialog("sentiment")}>
              Log sentiment
            </Button>
          ) : null
        }
      />
      <CardBody className="stack">
        <div className="row" style={{ gap: 12, alignItems: "baseline" }}>
          <strong className="num" style={{ fontSize: 28 }}>
            {healthScore ?? "–"}
          </strong>
          <span className="small muted">{sentimentLine(sentiments)}</span>
        </div>
        {sentiments[0]?.note ? <p className="small" style={{ margin: 0 }}>{sentiments[0].note}</p> : null}

        {open.map((a) => (
          <div key={a.id} className="stack" style={{ gap: 6, padding: 12, borderRadius: "var(--radius)", background: "var(--warn-soft)" }}>
            <strong>Churn alert: {CHURN_TRIGGER[a.trigger_kind]}</strong>
            <p className="small" style={{ margin: 0 }}>
              {a.detail}
              {a.nps_score != null ? ` NPS ${a.nps_score}.` : ""} Raised {fmtDate(a.raised_on)}.
            </p>
            {canManage ? (
              <div className="row">
                <Select aria-label="Churn alert outcome" value={a.outcome} disabled={busy} onChange={(e) => outcome(a, e.target.value)}>
                  {CHURN_OUTCOMES.map((o) => (
                    <option key={o} value={o}>
                      Outcome: {CHURN_OUTCOME[o].label.toLowerCase()}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
          </div>
        ))}

        {canManage && suggestions.length ? (
          <div className="stack" style={{ gap: 6 }}>
            {suggestions.map((t) => (
              <div key={t} className="between small">
                <span>Signal: {CHURN_TRIGGER[t].toLowerCase()}</span>
                <Button size="sm" variant="ghost" onClick={() => setDialog(t)}>
                  Raise alert
                </Button>
              </div>
            ))}
          </div>
        ) : null}

        {closed.length ? (
          <div className="list">
            {closed.map((a) => (
              <div key={a.id} className="item between small">
                <span>
                  {CHURN_TRIGGER[a.trigger_kind]} · {fmtDate(a.raised_on)}
                </span>
                <StatusDot tone={CHURN_OUTCOME[a.outcome].tone}>{CHURN_OUTCOME[a.outcome].label}</StatusDot>
              </div>
            ))}
          </div>
        ) : null}

        {canManage && !suggestions.length ? (
          <div>
            <Button size="sm" variant="ghost" onClick={() => setDialog("not_renewing")}>
              Raise churn alert
            </Button>
          </div>
        ) : null}
      </CardBody>
      {canManage && dialog === "sentiment" ? <SentimentDialog clientId={clientId} onClose={() => setDialog(null)} /> : null}
      {canManage && dialog && dialog !== "sentiment" ? (
        <AlertDialog clientId={clientId} initial={dialog} onClose={() => setDialog(null)} />
      ) : null}
    </Card>
  );
}

function SentimentDialog({ clientId, onClose }: { clientId: string; onClose: () => void }) {
  const [busy, start] = useTransition();
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <Dialog
      open
      onClose={onClose}
      title="Log sentiment"
      footer={
        <Button variant="primary" disabled={busy} onClick={() => formRef.current?.requestSubmit()}>
          Save sentiment
        </Button>
      }
    >
      <form
        ref={formRef}
        action={(fd) =>
          start(async () => {
            const r = await addSentiment({ clientId, sentiment: fd.get("sentiment"), note: fd.get("note") });
            toast(r.ok ? "Sentiment saved" : r.error);
            if (r.ok) onClose();
          })
        }
      >
        <FormGrid>
          <Field label="How do they feel?" htmlFor="s-sent">
            <Select id="s-sent" name="sentiment" defaultValue="neutral">
              {SENTIMENTS.map((s) => (
                <option key={s} value={s}>
                  {s[0].toUpperCase() + s.slice(1)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="What made you think so" htmlFor="s-note" full>
            <Textarea id="s-note" name="note" rows={3} />
          </Field>
        </FormGrid>
      </form>
    </Dialog>
  );
}

function AlertDialog({ clientId, initial, onClose }: { clientId: string; initial: ChurnTrigger; onClose: () => void }) {
  const [busy, start] = useTransition();
  const [kind, setKind] = useState<ChurnTrigger>(initial);
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <Dialog
      open
      onClose={onClose}
      title="Raise churn alert"
      footer={
        <Button variant="primary" disabled={busy} onClick={() => formRef.current?.requestSubmit()}>
          Raise alert
        </Button>
      }
    >
      <form
        ref={formRef}
        action={(fd) =>
          start(async () => {
            const r = await raiseChurnAlert({ clientId, trigger_kind: kind, detail: fd.get("detail"), nps_score: fd.get("nps") ?? "" });
            toast(r.ok ? "Churn alert raised" : r.error);
            if (r.ok) onClose();
          })
        }
      >
        <FormGrid>
          <Field label="Trigger" htmlFor="a-kind">
            <Select id="a-kind" value={kind} onChange={(e) => setKind(e.target.value as ChurnTrigger)}>
              {CHURN_TRIGGERS.map((t) => (
                <option key={t} value={t}>
                  {CHURN_TRIGGER[t]}
                </option>
              ))}
            </Select>
          </Field>
          {kind === "nps" ? (
            <Field label="NPS score (0–10)" htmlFor="a-nps">
              <Input id="a-nps" name="nps" type="number" min={0} max={10} required />
            </Field>
          ) : null}
          <Field label="What happened" htmlFor="a-detail" full>
            <Textarea id="a-detail" name="detail" rows={3} required placeholder='e.g. Karim said he may "pull back to Google only" in Q1.' />
          </Field>
        </FormGrid>
      </form>
    </Dialog>
  );
}

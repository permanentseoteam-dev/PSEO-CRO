"use client";

import { useRef, useState, useTransition } from "react";
import { Upload } from "lucide-react";
import { Button, Card, CardBody, CardHead, Checkbox, Dialog, Field, FormGrid, Input, Select, Textarea, useToast } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { saveAgreement, setAgreementFile } from "../actions";
import { fmtDate, fmtMoney, hoursUsage, renewalDate, renewalReminder, termLabel } from "../logic";
import { CURRENCIES, type Agreement } from "../types";

type Props = {
  clientId: string;
  agreement: Agreement | null;
  fileUrl: string | null;
  /** Hours logged this month, or null when time data isn't available. */
  hoursUsed: number | null;
  canManage: boolean;
};

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="between" style={{ gap: 12 }}>
      <span className="muted">{label}</span>
      <span className="right">{children}</span>
    </div>
  );
}

/** Terms card: fee, term, notice, renewal, monthly hours bar, scope and the signed agreement. */
export function TermsCard({ clientId, agreement: a, fileUrl, hoursUsed, canManage }: Props) {
  const [editing, setEditing] = useState(false);
  const [busy, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const renewal = a ? renewalDate(a) : null;
  const budget = a?.hours_per_month ? Number(a.hours_per_month) : 0;
  const usage = hoursUsed != null && budget > 0 ? hoursUsage(hoursUsed, budget) : null;

  function upload(file: File) {
    start(async () => {
      const safe = file.name.replace(/[^\w.-]+/g, "-").slice(-80);
      const path = `${clientId}/${Date.now()}-${safe}`;
      const { error } = await createClient().storage.from("client-agreements").upload(path, file, { upsert: false });
      if (error) return toast(error.message);
      const r = await setAgreementFile({ clientId, path, name: file.name });
      toast(r.ok ? "Agreement uploaded" : r.error);
    });
  }

  return (
    <Card>
      <CardHead
        title="Terms"
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setEditing(true)}>
              Edit terms
            </Button>
          ) : null
        }
      />
      <CardBody className="stack">
        {!a ? (
          <p className="muted small">No terms recorded yet.</p>
        ) : (
          <>
            <Line label="Monthly fee">
              <strong className="num">{a.monthly_fee != null ? fmtMoney(Number(a.monthly_fee), a.currency) : "Not set"}</strong>
            </Line>
            <Line label="Term">{termLabel(a)}</Line>
            <Line label="Notice period">{a.notice_days != null ? `${a.notice_days} days` : "Not set"}</Line>
            <Line label="Renewal">
              {renewal ? `${fmtDate(renewal)} · ${a.auto_renews ? "renews automatically" : `reminder ${fmtDate(renewalReminder(renewal))}`}` : "Not set"}
            </Line>
            {budget > 0 ? (
              <div className="stack" style={{ gap: 4 }}>
                <div className="between small">
                  <span>Hours this month</span>
                  <span className="num">{hoursUsed != null ? `${hoursUsed} of ${budget}` : `Budget ${budget}`}</span>
                </div>
                {usage ? (
                  <>
                    <div className={`bar t-${usage.tone}`} role="img" aria-label={`${usage.pct}% of monthly hours used`}>
                      <i style={{ width: `${Math.min(usage.pct, 100)}%` }} />
                    </div>
                    {usage.note ? <span className={`small t-${usage.tone}`}>{usage.note}</span> : null}
                  </>
                ) : null}
              </div>
            ) : null}
            {a.in_scope ? (
              <div className="small">
                <strong>In scope:</strong> {a.in_scope}
              </div>
            ) : null}
            {a.out_of_scope ? (
              <div className="small">
                <strong>Out of scope:</strong> {a.out_of_scope}
              </div>
            ) : null}
          </>
        )}
        <div className="between">
          {fileUrl && a?.agreement_name ? (
            <a className="small" href={fileUrl} target="_blank" rel="noreferrer">
              Signed agreement ({a.agreement_name})
            </a>
          ) : (
            <span className="small muted">No signed agreement uploaded</span>
          )}
          {canManage ? (
            <>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload(f);
                  e.target.value = "";
                }}
              />
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => fileRef.current?.click()}>
                <Upload size={14} aria-hidden="true" /> {a?.agreement_path ? "Replace" : "Upload"}
              </Button>
            </>
          ) : null}
        </div>
      </CardBody>
      {canManage ? <TermsDialog open={editing} onClose={() => setEditing(false)} clientId={clientId} a={a} /> : null}
    </Card>
  );
}

function TermsDialog({ open, onClose, clientId, a }: { open: boolean; onClose: () => void; clientId: string; a: Agreement | null }) {
  const [busy, start] = useTransition();
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  function submit(fd: FormData) {
    const v = (k: string) => String(fd.get(k) ?? "");
    start(async () => {
      const r = await saveAgreement({
        clientId,
        monthly_fee: v("monthly_fee"),
        currency: v("currency"),
        start_date: v("start_date"),
        term_months: v("term_months"),
        notice_days: v("notice_days"),
        hours_per_month: v("hours_per_month"),
        in_scope: v("in_scope"),
        out_of_scope: v("out_of_scope"),
        renewal_on: v("renewal_on"),
        auto_renews: fd.get("auto_renews") === "on",
      });
      toast(r.ok ? "Terms saved" : r.error);
      if (r.ok) onClose();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Edit terms"
      footer={
        <Button variant="primary" disabled={busy} onClick={() => formRef.current?.requestSubmit()}>
          Save terms
        </Button>
      }
    >
      <form ref={formRef} action={submit}>
        <FormGrid>
          <Field label="Monthly fee" htmlFor="t-fee">
            <Input id="t-fee" name="monthly_fee" type="number" min={0} step="0.01" defaultValue={a?.monthly_fee ?? ""} />
          </Field>
          <Field label="Currency" htmlFor="t-cur">
            <Select id="t-cur" name="currency" defaultValue={a?.currency ?? "AED"}>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Start date" htmlFor="t-start">
            <Input id="t-start" name="start_date" type="date" defaultValue={a?.start_date ?? ""} />
          </Field>
          <Field label="Term (months)" htmlFor="t-term">
            <Input id="t-term" name="term_months" type="number" min={1} max={120} defaultValue={a?.term_months ?? ""} />
          </Field>
          <Field label="Notice period (days)" htmlFor="t-notice">
            <Input id="t-notice" name="notice_days" type="number" min={0} max={365} defaultValue={a?.notice_days ?? ""} />
          </Field>
          <Field label="Hours per month" htmlFor="t-hours">
            <Input id="t-hours" name="hours_per_month" type="number" min={0} step="0.5" defaultValue={a?.hours_per_month ?? ""} />
          </Field>
          <Field label="Renewal date" htmlFor="t-renew" hint="Leave empty to use start date plus term">
            <Input id="t-renew" name="renewal_on" type="date" defaultValue={a?.renewal_on ?? ""} />
          </Field>
          <div className="field" style={{ justifyContent: "end" }}>
            <Checkbox name="auto_renews" label="Renews automatically" defaultChecked={a?.auto_renews ?? false} />
          </div>
          <Field label="In scope" htmlFor="t-in" full>
            <Textarea id="t-in" name="in_scope" rows={2} defaultValue={a?.in_scope ?? ""} />
          </Field>
          <Field label="Out of scope" htmlFor="t-out" full>
            <Textarea id="t-out" name="out_of_scope" rows={2} defaultValue={a?.out_of_scope ?? ""} />
          </Field>
        </FormGrid>
      </form>
    </Dialog>
  );
}

"use client";

import { useState, useTransition } from "react";
import { Button, Card, CardBody, CardHead, Dialog, Field, FormGrid, Input, Select, StatusDot, useToast } from "@/components/ui";
import { saveEmailSettings, sendTestEmail } from "../actions";
import { providerLabel } from "../email";
import { dnsStatus, domainStatus } from "../logic";
import { EMAIL_PROVIDERS, type EmailSettings } from "../types";

type Props = {
  settings: EmailSettings | null;
  summary: { sent: number; bounced: number; failed: number };
  /** True when the server has an API key for the chosen provider. Always false until an adapter is built. */
  connected: boolean;
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

/** Finance settings: "Email sending" card with provider connect state, sender, DNS checks and 30-day counts. */
export function EmailSendingCard({ settings: s, summary, connected, canManage }: Props) {
  const [editing, setEditing] = useState(false);
  const [testing, setTesting] = useState(false);
  const provider = s?.provider ?? "none";
  const sender = s?.from_email ? `${s.from_name ? `${s.from_name} ` : ""}<${s.from_email}>` : "Not set";
  const dom = domainStatus(s?.domain_status ?? "unknown");

  return (
    <Card>
      <CardHead
        title="Email sending"
        actions={
          canManage ? (
            <>
              <Button size="sm" variant="ghost" onClick={() => setTesting(true)}>
                Send test email
              </Button>
              <Button size="sm" onClick={() => setEditing(true)}>
                {provider === "none" ? "Connect" : "Edit"}
              </Button>
            </>
          ) : null
        }
      />
      <CardBody className="stack" style={{ gap: 8 }}>
        <Line label="Provider">
          {provider === "none" ? (
            <StatusDot tone="warn">Not connected</StatusDot>
          ) : (
            <StatusDot tone={connected ? "ok" : "warn"}>
              {providerLabel(provider)}, {connected ? "connected" : "waiting for the API key"}
            </StatusDot>
          )}
        </Line>
        <Line label="Sender">{sender}</Line>
        <Line label="Reply to">{s?.reply_to ?? "Not set"}</Line>
        <Line label="Domain">
          <StatusDot tone={dom.tone}>{s?.domain ? `${s.domain}, ${dom.label.toLowerCase()}` : dom.label}</StatusDot>
        </Line>
        {(["spf", "dkim", "dmarc"] as const).map((k) => {
          const d = dnsStatus(s?.[k] ?? "unknown");
          return (
            <Line key={k} label={k.toUpperCase()}>
              <StatusDot tone={d.tone}>{d.label}</StatusDot>
            </Line>
          );
        })}
        <Line label="Last 30 days">
          <span className="num">
            {summary.sent} sent · {summary.bounced} bounced{summary.failed ? ` · ${summary.failed} failed` : ""}
          </span>
        </Line>
      </CardBody>
      {canManage ? (
        <>
          <SettingsDialog key={editing ? "open" : "closed"} open={editing} onClose={() => setEditing(false)} s={s} />
          <TestDialog open={testing} onClose={() => setTesting(false)} />
        </>
      ) : null}
    </Card>
  );
}

function SettingsDialog({ open, onClose, s }: { open: boolean; onClose: () => void; s: EmailSettings | null }) {
  const [busy, start] = useTransition();
  const toast = useToast();

  function submit(form: HTMLFormElement) {
    const f = new FormData(form);
    start(async () => {
      const r = await saveEmailSettings({
        provider: f.get("provider"),
        from_name: f.get("from_name"),
        from_email: f.get("from_email"),
        reply_to: f.get("reply_to"),
      });
      if (!r.ok) return toast(r.error);
      toast("Email settings saved");
      onClose();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Email sending"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="fp2-email" disabled={busy}>
            Save email settings
          </Button>
        </>
      }
    >
      <form
        id="fp2-email"
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          submit(e.currentTarget);
        }}
      >
        <p className="small muted">The provider&apos;s API key is added on the server by an admin. It is never stored in the portal.</p>
        <FormGrid>
          <Field label="Provider" htmlFor="fp2-em-provider" full>
            <Select id="fp2-em-provider" name="provider" defaultValue={s?.provider ?? "none"}>
              {EMAIL_PROVIDERS.map((p) => (
                <option key={p} value={p}>
                  {providerLabel(p)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Sender name" htmlFor="fp2-em-name">
            <Input id="fp2-em-name" name="from_name" maxLength={120} defaultValue={s?.from_name ?? ""} />
          </Field>
          <Field label="Sender email" htmlFor="fp2-em-from">
            <Input id="fp2-em-from" name="from_email" type="email" defaultValue={s?.from_email ?? ""} />
          </Field>
          <Field label="Reply to" htmlFor="fp2-em-reply" full>
            <Input id="fp2-em-reply" name="reply_to" type="email" defaultValue={s?.reply_to ?? ""} />
          </Field>
        </FormGrid>
      </form>
    </Dialog>
  );
}

function TestDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [to, setTo] = useState("");
  const [busy, start] = useTransition();
  const toast = useToast();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Send test email"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={busy || !to}
            onClick={() =>
              start(async () => {
                const r = await sendTestEmail(to);
                toast(r.ok ? "Test email sent" : r.error);
                if (r.ok) onClose();
              })
            }
          >
            Send test email
          </Button>
        </>
      }
    >
      <Field label="Send to" htmlFor="fp2-em-test">
        <Input id="fp2-em-test" type="email" value={to} onChange={(e) => setTo(e.target.value)} />
      </Field>
    </Dialog>
  );
}

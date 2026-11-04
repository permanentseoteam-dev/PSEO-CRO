"use client";

import { useState, useTransition } from "react";
import { Mail } from "lucide-react";
import { Button, Dialog, Field, FormGrid, Input, Seg, StatusDot, Textarea, useToast } from "@/components/ui";
import { draftClientEmail } from "../actions";
import { TONES, type EmailTone } from "../types";

type Props = { clientId: string; to: string; contactName: string; aiConnected: boolean };

/** "Email client" button and dialog. The AI writes a draft in the chosen tone; the person edits and copies it. */
export function EmailDraftButton({ clientId, to: initialTo, contactName, aiConnected }: Props) {
  const [open, setOpen] = useState(false);
  const [to, setTo] = useState(initialTo);
  const [subject, setSubject] = useState("");
  const [points, setPoints] = useState("");
  const [tone, setTone] = useState<EmailTone>("Friendly");
  const [body, setBody] = useState("");
  const [busy, start] = useTransition();
  const toast = useToast();

  function draft() {
    start(async () => {
      const r = await draftClientEmail({ clientId, tone, contactName, subject, points });
      if (r.ok) setBody(r.body);
      else toast(r.error);
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`To: ${to}\nSubject: ${subject}\n\n${body}`);
      toast("Email copied");
    } catch {
      toast("Couldn't copy. Select the text and copy it.");
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Mail size={14} aria-hidden="true" /> Email client
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Email client"
        wide
        footer={
          <Button variant="primary" disabled={!body.trim()} onClick={copy}>
            Copy email
          </Button>
        }
      >
        <FormGrid>
          <Field label="To" htmlFor="e-to">
            <Input id="e-to" type="email" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="Subject" htmlFor="e-subj">
            <Input id="e-subj" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. October results and tomorrow's call" />
          </Field>
          <Field label="Points to cover" htmlFor="e-points" full>
            <Textarea
              id="e-points"
              rows={3}
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              placeholder="e.g. 142 leads, up 18%. Report lands Wednesday. Plan year-end push on tomorrow's call."
            />
          </Field>
          <div className="field full">
            {aiConnected ? (
              <div className="row" style={{ gap: 12, flexWrap: "wrap" }}>
                <Seg label="AI draft tone" items={TONES.map((t) => ({ value: t, label: t }))} value={tone} onChange={(v) => setTone(v as EmailTone)} />
                <Button size="sm" disabled={busy || !subject.trim() || !points.trim()} onClick={draft}>
                  {body ? "Redraft" : "Write draft"}
                </Button>
              </div>
            ) : (
              <StatusDot tone="muted">AI drafting isn&rsquo;t connected yet. Write the email below.</StatusDot>
            )}
          </div>
          <Field label="Email" htmlFor="e-body" full>
            <Textarea id="e-body" rows={9} value={body} onChange={(e) => setBody(e.target.value)} placeholder={aiConnected ? "" : "Write the email here."} />
          </Field>
        </FormGrid>
      </Dialog>
    </>
  );
}

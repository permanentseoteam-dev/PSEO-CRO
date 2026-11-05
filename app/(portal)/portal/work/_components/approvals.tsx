"use client";

import { useState, useTransition } from "react";
import { Button, Dialog, Field, FormGrid, StatusDot, Textarea, useToast } from "@/components/ui";
import { cn } from "@/lib/utils";
import { fmtDay } from "@/lib/modules/portal/logic";
import type { Approval } from "@/lib/modules/portal/types";
import { decideApproval } from "../../actions";
import s from "../../portal.module.css";

const STATE = {
  waiting: { label: "Waiting for you", tone: "warn" },
  approved: { label: "Approved", tone: "ok" },
  changes: { label: "Changes asked", tone: "warn" },
} as const;

/** Approval cards with Approve and Ask for changes (shown but disabled in a read-only preview). */
export function Approvals({ items, canDecide, readOnly = false }: { items: Approval[]; canDecide: boolean; readOnly?: boolean }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [target, setTarget] = useState<Approval | null>(null);
  const [note, setNote] = useState("");

  const decide = (a: Approval, decision: "approved" | "changes", text?: string) =>
    start(async () => {
      const r = await decideApproval({ id: a.id, decision, note: text });
      if (!r.ok) return toast(r.error);
      toast(decision === "approved" ? `Approved: ${a.title}` : "Change request sent");
      setTarget(null);
      setNote("");
    });

  return (
    <section className="stack" style={{ gap: 16 }}>
      {items.map((a) => {
        const st = STATE[a.status];
        return (
          <article key={a.id} className={cn(s.approval, a.status === "approved" && s.done, a.status === "changes" && s.changes)}>
            <div className="row between">
              <h3>{a.title}</h3>
              <StatusDot tone={st.tone}>{st.label}</StatusDot>
            </div>
            {a.body ? <p>{a.body}</p> : null}
            {a.files.length ? (
              <div className={s.tiles}>
                {a.files.map((f, i) => (
                  <div key={i} className={s.ftile}>
                    <div className={s.ph}>{f.type.split(" ")[0]}</div>
                    <div className={s.nm} title={f.name}>
                      {f.name}
                    </div>
                    <div className={s.ty}>{f.type}</div>
                  </div>
                ))}
              </div>
            ) : null}
            {a.status === "changes" && a.changeNote ? <p>Your note: {a.changeNote}</p> : null}
            <div className="row between">
              <span className="muted small">
                Sent {fmtDay(a.sentAt)} by {a.sentBy}
              </span>
              {a.status === "waiting" ? (
                canDecide ? (
                  <div className="row">
                    <Button variant="primary" disabled={pending || readOnly} onClick={() => decide(a, "approved")}>
                      Approve
                    </Button>
                    <Button disabled={pending || readOnly} onClick={() => setTarget(a)}>
                      Ask for changes
                    </Button>
                  </div>
                ) : null
              ) : (
                <span className="muted small">
                  {st.label} {a.decidedAt ? fmtDay(a.decidedAt) : ""}
                  {a.decidedBy ? ` by ${a.decidedBy}` : ""}
                </span>
              )}
            </div>
          </article>
        );
      })}

      <Dialog
        open={!!target}
        onClose={() => setTarget(null)}
        title="Ask for changes"
        footer={
          <>
            <Button variant="ghost" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="portal-changes" disabled={pending}>
              Send changes
            </Button>
          </>
        }
      >
        <form
          id="portal-changes"
          onSubmit={(e) => {
            e.preventDefault();
            if (target) decide(target, "changes", note);
          }}
        >
          <FormGrid>
            <Field label="What should we change?" htmlFor="pwc-why" full>
              <Textarea
                id="pwc-why"
                rows={4}
                required
                maxLength={2000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="For example: use the red car photo instead"
              />
            </Field>
          </FormGrid>
        </form>
      </Dialog>
    </section>
  );
}

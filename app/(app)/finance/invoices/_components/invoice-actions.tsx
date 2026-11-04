"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, ButtonLink, Dialog, Field, FormGrid, Seg, useToast } from "@/components/ui";
import { fmtDate, fmtDay, money, round2 } from "@/lib/modules/finance/core/logic";
import { disputeInvoice, duplicateInvoice, issueInvoice, refundInvoice, requestEmail, resolveDispute, voidInvoice, writeOffInvoice } from "../actions";

type Kind = "email" | "refund" | "dispute" | "resolve" | "writeoff" | "void";
type EmailKind = "invoice" | "reminder" | "receipt";

export type ActionInvoice = {
  id: string;
  label: string;
  status: string;
  clientId: string;
  currency: string;
  dueOn: string;
  title: string;
  balance: number;
  /** Paid minus refunded. */
  paid: number;
  payLink: string | null;
  email: string;
  cc: string;
  contact: string;
};

export type ActionPerms = { create: boolean; send: boolean; void: boolean; refund: boolean; recordPayment: boolean };

const today = () => new Date().toISOString().slice(0, 10);

export function InvoiceActions({ inv, perms, sender, channels }: { inv: ActionInvoice; perms: ActionPerms; sender: string; channels: { id: string; name: string }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState<Kind | null>(null);
  const [reason, setReason] = useState("");
  const close = () => {
    setOpen(null);
    setReason("");
  };

  const draft = inv.status === "draft";
  const isOpenInv = ["issued", "partly_paid", "disputed"].includes(inv.status);
  const closed = ["void", "written_off", "refunded"].includes(inv.status);
  const first = inv.contact.split(" ").filter((w) => !/^(dr|mr|mrs|ms)\.?$/i.test(w))[0] || "there";
  const bal = money(inv.balance, inv.currency);

  // Email drafts per kind
  const templates: Record<EmailKind, { subject: string; body: string; attach: string }> = {
    invoice: {
      subject: `Invoice ${inv.label} from Permanent SEO`,
      body: `Hi ${first},\n\nPlease find invoice ${inv.label}${inv.title ? ` for ${inv.title.toLowerCase()}` : ""} attached. The balance of ${bal} is due on ${fmtDate(inv.dueOn)}.${inv.payLink ? `\n\nPay link: ${inv.payLink}` : ""}\n\nThanks,\n${sender}\nPermanent SEO`,
      attach: `${inv.label}.pdf`,
    },
    reminder: {
      subject: `Reminder: ${inv.label} is due on ${fmtDay(inv.dueOn)}`,
      body: `Hi ${first},\n\nA quick reminder that ${bal} on invoice ${inv.label} is due on ${fmtDate(inv.dueOn)}.${inv.payLink ? `\n\nPay link: ${inv.payLink}` : ""}\n\nThanks,\n${sender}`,
      attach: `${inv.label}.pdf`,
    },
    receipt: {
      subject: `Receipt for your payment on ${inv.label}`,
      body: `Hi ${first},\n\nThanks for your payment of ${money(inv.paid, inv.currency)} against ${inv.label}. The balance is now ${bal}.\n\nBest,\n${sender}`,
      attach: `${inv.label}.pdf`,
    },
  };
  const [emailKind, setEmailKind] = useState<EmailKind>("invoice");
  const [email, setEmail] = useState({ to: inv.email, cc: inv.cc, ...templates.invoice });
  const pickKind = (k: EmailKind) => {
    setEmailKind(k);
    setEmail((e) => ({ ...e, ...templates[k] }));
  };

  const [refund, setRefund] = useState({ amount: String(round2(inv.paid)), date: today(), channel_id: "", reference: "" });

  function run(fn: () => Promise<{ ok: true } | { ok: false; error: string }>, done: string) {
    start(async () => {
      const res = await fn();
      if (!res.ok) return toast(res.error);
      close();
      toast(done);
      router.refresh();
    });
  }

  const issue = () =>
    start(async () => {
      const res = await issueInvoice(inv.id);
      if (!res.ok) return toast(res.error);
      toast(`Issued as ${res.number}`);
      router.refresh();
    });
  const duplicate = () =>
    start(async () => {
      const res = await duplicateInvoice(inv.id);
      if (!res.ok) return toast(res.error);
      toast("Duplicated as a new draft");
      router.push(`/finance/invoices/${res.id}`);
    });

  const reasonField = (label: string) => (
    <Field label={label} htmlFor="act-reason">
      <textarea id="act-reason" rows={3} required placeholder="Required" value={reason} onChange={(e) => setReason(e.target.value)} />
    </Field>
  );
  const foot = (label: string, onClick: () => void, danger = false, disabled = reason.trim().length < 3) => (
    <>
      <Button variant="ghost" onClick={close}>
        Cancel
      </Button>
      <Button variant={danger ? "primary-danger" : "primary"} disabled={pending || disabled} onClick={onClick}>
        {label}
      </Button>
    </>
  );

  return (
    <>
      <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
        {draft && perms.create ? (
          <Button variant="primary" disabled={pending} onClick={issue}>
            Issue
          </Button>
        ) : null}
        {!draft && !closed && perms.send ? <Button onClick={() => setOpen("email")}>Email</Button> : null}
        {isOpenInv && inv.status !== "disputed" && perms.recordPayment ? (
          <ButtonLink href={`/finance/payments?record=1&client=${inv.clientId}&invoice=${inv.id}`}>Record payment</ButtonLink>
        ) : null}
        <a className="btn" href={`/api/finance/invoices/${inv.id}/pdf`} download>
          Download PDF
        </a>
        {perms.create ? (
          <Button variant="ghost" disabled={pending} onClick={duplicate}>
            Duplicate
          </Button>
        ) : null}
        {!draft && inv.paid > 0 && inv.status !== "void" && perms.refund ? (
          <Button variant="ghost" onClick={() => setOpen("refund")}>
            Refund
          </Button>
        ) : null}
        {["issued", "partly_paid"].includes(inv.status) && perms.create ? (
          <Button variant="ghost" onClick={() => setOpen("dispute")}>
            Dispute
          </Button>
        ) : null}
        {inv.status === "disputed" && perms.create ? (
          <Button variant="ghost" onClick={() => setOpen("resolve")}>
            Resolve dispute
          </Button>
        ) : null}
        {isOpenInv && inv.balance > 0 && perms.void ? (
          <Button variant="ghost" onClick={() => setOpen("writeoff")}>
            Write off
          </Button>
        ) : null}
        {!draft && inv.status !== "void" && perms.void ? (
          <Button variant="danger" onClick={() => setOpen("void")}>
            Void
          </Button>
        ) : null}
      </div>

      <Dialog
        open={open === "email"}
        onClose={close}
        title="Email invoice"
        wide
        footer={foot(
          "Send email",
          () => run(() => requestEmail({ id: inv.id, kind: emailKind, ...email }), "Email saved. Sending starts once an email provider is set up."),
          false,
          !email.to.trim(),
        )}
      >
        <div className="stack">
          <Seg
            label="Email type"
            value={emailKind}
            onChange={(k) => pickKind(k as EmailKind)}
            items={[
              { value: "invoice", label: "Invoice" },
              { value: "reminder", label: "Reminder" },
              { value: "receipt", label: "Receipt" },
            ]}
          />
          <FormGrid>
            <Field label="To" htmlFor="em-to" full>
              <input id="em-to" value={email.to} onChange={(e) => setEmail({ ...email, to: e.target.value })} />
            </Field>
            <Field label="Cc" htmlFor="em-cc" full>
              <input id="em-cc" value={email.cc} onChange={(e) => setEmail({ ...email, cc: e.target.value })} />
            </Field>
            <Field label="Subject" htmlFor="em-subject" full>
              <input id="em-subject" value={email.subject} onChange={(e) => setEmail({ ...email, subject: e.target.value })} />
            </Field>
            <Field label="Message" htmlFor="em-body" full>
              <textarea id="em-body" rows={7} value={email.body} onChange={(e) => setEmail({ ...email, body: e.target.value })} />
            </Field>
          </FormGrid>
          <div className="row small muted">
            Attached: <strong style={{ color: "var(--ink)" }}>{email.attach}</strong>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={open === "refund"}
        onClose={close}
        title="Refund"
        footer={foot("Record refund", () =>
          run(() => refundInvoice({ id: inv.id, ...refund, channel_id: refund.channel_id || null, reason }), "Refund recorded"),
        )}
      >
        <div className="stack">
          <p className="small muted" style={{ margin: 0 }}>
            Up to {money(inv.paid, inv.currency)} has been paid on this invoice.
          </p>
          <FormGrid>
            <Field label="Amount" htmlFor="rf-amount">
              <input id="rf-amount" type="number" step="0.01" min="0" max={inv.paid} value={refund.amount} onChange={(e) => setRefund({ ...refund, amount: e.target.value })} />
            </Field>
            <Field label="Date" htmlFor="rf-date">
              <input id="rf-date" type="date" value={refund.date} onChange={(e) => setRefund({ ...refund, date: e.target.value })} />
            </Field>
            <Field label="Paid back by" htmlFor="rf-channel">
              <select id="rf-channel" value={refund.channel_id} onChange={(e) => setRefund({ ...refund, channel_id: e.target.value })}>
                <option value="">Not set</option>
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Reference" htmlFor="rf-ref">
              <input id="rf-ref" placeholder="Transfer reference" value={refund.reference} onChange={(e) => setRefund({ ...refund, reference: e.target.value })} />
            </Field>
            <Field label="Reason" htmlFor="act-reason" full>
              <textarea id="act-reason" rows={2} required placeholder="Required" value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
          </FormGrid>
        </div>
      </Dialog>

      <Dialog open={open === "dispute"} onClose={close} title="Mark as disputed" footer={foot("Mark disputed", () => run(() => disputeInvoice({ id: inv.id, reason }), "Marked as disputed"))}>
        <div className="stack">
          <p className="small muted" style={{ margin: 0 }}>
            Reminders pause while the invoice is disputed. Resolve it from this page.
          </p>
          {reasonField("What is the client disputing?")}
        </div>
      </Dialog>

      <Dialog
        open={open === "resolve"}
        onClose={close}
        title="Resolve dispute"
        footer={foot("Resolve dispute", () => run(() => resolveDispute({ id: inv.id, note: reason }), "Dispute resolved"), false, false)}
      >
        <div className="stack">
          <p className="small muted" style={{ margin: 0 }}>
            The invoice goes back to open and reminders start again.
          </p>
          <Field label="What was agreed" htmlFor="act-reason">
            <textarea id="act-reason" rows={3} placeholder="Optional" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </div>
      </Dialog>

      <Dialog
        open={open === "writeoff"}
        onClose={close}
        title="Write off balance"
        footer={foot(`Write off ${bal}`, () => run(() => writeOffInvoice({ id: inv.id, reason }), "Balance written off"), true)}
      >
        <div className="stack">
          <p className="small muted" style={{ margin: 0 }}>
            The open balance stops counting as owed and shows in Written off.
          </p>
          {reasonField("Reason")}
        </div>
      </Dialog>

      <Dialog open={open === "void"} onClose={close} title="Void invoice" footer={foot("Void invoice", () => run(() => voidInvoice({ id: inv.id, reason }), "Invoice voided"), true)}>
        <div className="stack">
          {inv.paid > 0 ? (
            <div className="small" style={{ padding: "10px 12px", borderRadius: 8, background: "var(--warn-soft)", border: "1px solid var(--warn)" }}>
              This invoice has a payment. Voiding moves {money(inv.paid, inv.currency)} to client credit. The number stays used.
            </div>
          ) : (
            <p className="small muted" style={{ margin: 0 }}>
              The number stays used and the invoice stops counting as owed.
            </p>
          )}
          {reasonField("Reason for voiding")}
        </div>
      </Dialog>
    </>
  );
}

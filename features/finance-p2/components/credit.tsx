"use client";

import { useState, useTransition } from "react";
import { Button, Card, CardHead, Dialog, EmptyState, Field, FormGrid, Input, Select, Table, Td, Textarea, Th, useToast } from "@/components/ui";
import { applyCredit, giveCreditBack } from "../actions";
import { applyCreditPreview, fmtDate, fmtMoney } from "../logic";
import type { CreditBalance, CreditMovement } from "../types";

export type OpenInvoice = { id: string; clientId: string; number: string; currency: string; balance: number };

const CHANNELS = ["Wise", "PayPal", "Slash", "Bank", "Payoneer", "Other"];
const keyOf = (b: Pick<CreditBalance, "clientId" | "currency">) => `${b.clientId}|${b.currency}`;

/** Payments header button: "Apply credit". */
export function ApplyCreditButton({ balances, invoices }: { balances: CreditBalance[]; invoices: OpenInvoice[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={!balances.length}>
        Apply credit
      </Button>
      <ApplyDialog open={open} onClose={() => setOpen(false)} balances={balances} invoices={invoices} start={balances[0]} />
    </>
  );
}

/** Payments > Still owed: client credit table with Apply credit and Give back, plus recent credit movements. */
export function ClientCreditCard({
  balances,
  invoices,
  movements,
  canRecord,
}: {
  balances: CreditBalance[];
  invoices: OpenInvoice[];
  movements: CreditMovement[];
  canRecord: boolean;
}) {
  const [apply, setApply] = useState<CreditBalance | null>(null);
  const [giveBack, setGiveBack] = useState<CreditBalance | null>(null);

  return (
    <>
      <Card>
        <CardHead title="Client credit" />
        {balances.length === 0 ? (
          <EmptyState title="No client holds credit">Overpayments show here and can go on open invoices.</EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Client</Th>
                <Th right>Credit</Th>
                {canRecord ? <Th right>Actions</Th> : null}
              </tr>
            </thead>
            <tbody>
              {balances.map((b) => (
                <tr key={keyOf(b)}>
                  <Td>{b.clientName}</Td>
                  <Td right num>
                    {fmtMoney(b.amount, b.currency)}
                  </Td>
                  {canRecord ? (
                    <Td right>
                      <div className="row" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
                        <Button size="sm" onClick={() => setApply(b)}>
                          Apply credit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setGiveBack(b)}>
                          Give back
                        </Button>
                      </div>
                    </Td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      {movements.length ? (
        <Card>
          <CardHead title="Credit used" />
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Client</Th>
                <Th right>Amount</Th>
                <Th>What</Th>
              </tr>
            </thead>
            <tbody>
              {movements.slice(0, 20).map((m) => (
                <tr key={m.id}>
                  <Td num>{fmtDate(m.createdAt.slice(0, 10))}</Td>
                  <Td>{m.clientName}</Td>
                  <Td right num>
                    {fmtMoney(m.amount, m.currency)}
                  </Td>
                  <Td>
                    {m.kind === "applied"
                      ? `Applied to ${m.invoiceNumber ?? "an invoice"}`
                      : `Given back${m.channel ? ` by ${m.channel}` : ""}: ${m.reason ?? ""}`}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : null}
      {canRecord ? (
        <>
          <ApplyDialog key={apply ? keyOf(apply) : "a"} open={!!apply} onClose={() => setApply(null)} balances={balances} invoices={invoices} start={apply ?? undefined} />
          <GiveBackDialog key={giveBack ? keyOf(giveBack) : "g"} open={!!giveBack} onClose={() => setGiveBack(null)} balances={balances} start={giveBack ?? undefined} />
        </>
      ) : null}
    </>
  );
}

function ApplyDialog({
  open,
  onClose,
  balances,
  invoices,
  start: initial,
}: {
  open: boolean;
  onClose: () => void;
  balances: CreditBalance[];
  invoices: OpenInvoice[];
  start?: CreditBalance;
}) {
  const [key, setKey] = useState(initial ? keyOf(initial) : "");
  const credit = balances.find((b) => keyOf(b) === key);
  const choices = invoices.filter((i) => credit && i.clientId === credit.clientId && i.currency === credit.currency);
  const [invoiceId, setInvoiceId] = useState("");
  const inv = choices.find((i) => i.id === invoiceId) ?? choices[0];
  const [amount, setAmount] = useState("");
  const amt = Number(amount || (credit && inv ? Math.min(credit.amount, inv.balance) : 0));
  const [busy, startT] = useTransition();
  const toast = useToast();

  function submit() {
    if (!credit || !inv) return;
    startT(async () => {
      const r = await applyCredit({ clientId: credit.clientId, currency: credit.currency, invoiceId: inv.id, amount: amt });
      if (!r.ok) return toast(r.error);
      toast("Credit applied");
      onClose();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Apply client credit"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={busy || !credit || !inv || amt <= 0} onClick={submit}>
            Apply credit
          </Button>
        </>
      }
    >
      <div className="stack">
        <FormGrid>
          <Field label="Client" htmlFor="fp2-ac-client">
            <Select id="fp2-ac-client" value={key} onChange={(e) => (setKey(e.target.value), setInvoiceId(""), setAmount(""))}>
              {balances.map((b) => (
                <option key={keyOf(b)} value={keyOf(b)}>
                  {b.clientName} · {fmtMoney(b.amount, b.currency)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Apply to" htmlFor="fp2-ac-inv">
            <Select id="fp2-ac-inv" value={inv?.id ?? ""} onChange={(e) => (setInvoiceId(e.target.value), setAmount(""))} disabled={!choices.length}>
              {choices.length ? (
                choices.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.number} · balance {fmtMoney(i.balance, i.currency)}
                  </option>
                ))
              ) : (
                <option value="">No open invoices in this currency</option>
              )}
            </Select>
          </Field>
          <Field label="Amount" htmlFor="fp2-ac-amt">
            <Input id="fp2-ac-amt" type="number" step="0.01" min="0.01" className="num" value={amount || (amt ? String(amt) : "")} onChange={(e) => setAmount(e.target.value)} />
          </Field>
        </FormGrid>
        {credit && inv && amt > 0 ? (
          <p className={`small ${amt > credit.amount || amt > inv.balance ? "t-danger" : "t-ok"}`}>
            {amt > credit.amount
              ? "That is more than the credit left."
              : amt > inv.balance
                ? "That is more than the invoice balance."
                : applyCreditPreview(inv.number, inv.balance, amt, credit.amount, inv.currency)}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}

function GiveBackDialog({ open, onClose, balances, start: initial }: { open: boolean; onClose: () => void; balances: CreditBalance[]; start?: CreditBalance }) {
  const [key, setKey] = useState(initial ? keyOf(initial) : "");
  const credit = balances.find((b) => keyOf(b) === key);
  const [busy, startT] = useTransition();
  const toast = useToast();

  function submit(form: HTMLFormElement) {
    if (!credit) return;
    const f = new FormData(form);
    startT(async () => {
      const r = await giveCreditBack({
        clientId: credit.clientId,
        currency: credit.currency,
        amount: f.get("amount"),
        channel: f.get("channel"),
        reference: f.get("reference"),
        reason: f.get("reason") ?? "",
      });
      if (!r.ok) return toast(r.error);
      toast("Refund of credit recorded");
      onClose();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Give credit back"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="fp2-giveback" disabled={busy || !credit}>
            Record refund of credit
          </Button>
        </>
      }
    >
      <form
        id="fp2-giveback"
        onSubmit={(e) => {
          e.preventDefault();
          submit(e.currentTarget);
        }}
      >
        <FormGrid>
          <Field label="Client" htmlFor="fp2-gb-client">
            <Select id="fp2-gb-client" value={key} onChange={(e) => setKey(e.target.value)}>
              {balances.map((b) => (
                <option key={keyOf(b)} value={keyOf(b)}>
                  {b.clientName} · {fmtMoney(b.amount, b.currency)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Amount" htmlFor="fp2-gb-amt">
            <Input id="fp2-gb-amt" name="amount" type="number" step="0.01" min="0.01" max={credit?.amount} required className="num" defaultValue={credit?.amount} />
          </Field>
          <Field label="Paid back by" htmlFor="fp2-gb-ch">
            <Select id="fp2-gb-ch" name="channel" defaultValue="Wise">
              {CHANNELS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Reference" htmlFor="fp2-gb-ref">
            <Input id="fp2-gb-ref" name="reference" maxLength={120} placeholder="Transfer reference" />
          </Field>
          <Field label="Reason" htmlFor="fp2-gb-reason" full>
            <Textarea id="fp2-gb-reason" name="reason" rows={2} required maxLength={1000} />
          </Field>
        </FormGrid>
      </form>
    </Dialog>
  );
}

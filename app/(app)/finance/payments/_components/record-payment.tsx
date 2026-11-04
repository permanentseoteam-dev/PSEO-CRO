"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog, Field, FormGrid, Table, Th, Td, useToast } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { CURRENCIES, fmtDay, money, type Currency, type Rates } from "@/lib/modules/finance/core/logic";
import { allocateOldestFirst, leftOver, looksDuplicate, receiptLabel } from "@/lib/modules/finance/ops/logic";
import type { ChannelPick, ClientPick, OpenInvoiceRow } from "@/lib/modules/finance/ops/types";
import { recordPayment } from "../actions";
import s from "./ops.module.css";

type Props = {
  clients: ClientPick[];
  channels: ChannelPick[];
  openInvoices: OpenInvoiceRow[];
  recent: { clientId: string; amount: number; date: string; status: string }[];
  rates: Rates;
  today: string;
};

/** Safe object name for Storage: letters, digits, dot, dash, underscore. */
export const safeName = (name: string) => name.replace(/[^\w.-]+/g, "_").slice(-120) || "file";

export function RecordPaymentButton(props: Props) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);
  return (
    <>
      <Button
        variant="primary"
        onClick={() => {
          setKey((k) => k + 1);
          setOpen(true);
        }}
      >
        Record payment
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Record payment" wide footer={<Footer onCancel={() => setOpen(false)} />}>
        {open ? <RecordForm key={key} {...props} onDone={() => setOpen(false)} /> : null}
      </Dialog>
    </>
  );
}

function Footer({ onCancel }: { onCancel: () => void }) {
  return (
    <>
      <Button variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
      <Button variant="primary" type="submit" form="record-payment-form">
        Record payment
      </Button>
    </>
  );
}

function RecordForm({ clients, channels, openInvoices, recent, rates, today, onDone }: Props & { onDone: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [id] = useState(() => crypto.randomUUID());
  const first = clients[0];
  const [clientId, setClientId] = useState(first?.id ?? "");
  const [date, setDate] = useState(today);
  const [currency, setCurrency] = useState<Currency>(first?.currency ?? "USD");
  const [amount, setAmount] = useState("");
  const [fee, setFee] = useState("0");
  const [channelId, setChannelId] = useState(first?.channelId ?? "");
  const [account, setAccount] = useState(channels.find((c) => c.id === first?.channelId)?.account ?? "");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [proofMode, setProofMode] = useState<"file" | "none">("file");
  const [files, setFiles] = useState<File[]>([]);
  const [noProof, setNoProof] = useState("");
  const [unticked, setUnticked] = useState<Set<string>>(new Set());
  const [manual, setManual] = useState<Record<string, string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = useMemo(
    () => openInvoices.filter((i) => i.clientId === clientId && i.currency === currency),
    [openInvoices, clientId, currency],
  );
  const amt = Number(amount) || 0;
  const auto = allocateOldestFirst(amt, open, unticked);
  const allocations = auto.allocations.map((a) => ({
    invoiceId: a.invoiceId,
    amount: manual && manual[a.invoiceId] != null ? Number(manual[a.invoiceId]) || 0 : a.amount,
  }));
  const left = leftOver(amt, allocations);
  const tooMuch = allocations.some((a) => a.amount > (open.find((i) => i.id === a.invoiceId)?.balance ?? 0) + 0.001);
  const dup = looksDuplicate(recent, clientId, amt, date);
  const rate = rates[currency];

  function pickClient(cid: string) {
    const c = clients.find((x) => x.id === cid);
    setClientId(cid);
    setManual(null);
    setUnticked(new Set());
    if (c) {
      setCurrency(c.currency);
      setChannelId(c.channelId ?? "");
      setAccount(channels.find((ch) => ch.id === c.channelId)?.account ?? "");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!(amt > 0)) return setError("Enter the amount received.");
    if (left < 0) return setError("You applied more than was received. Lower an amount.");
    if (tooMuch) return setError("An amount is more than that invoice's balance.");
    if (proofMode === "file" && !files.length) return setError("Attach a proof file, or choose No proof and say why.");
    if (proofMode === "none" && !noProof.trim()) return setError("Say why there is no proof.");
    setBusy(true);
    const paths: string[] = [];
    if (proofMode === "file") {
      const supabase = createClient();
      for (const [k, f] of files.entries()) {
        const path = `${id}/${k + 1}-${safeName(f.name)}`;
        const { error: upErr } = await supabase.storage.from("payment-proofs").upload(path, f, { upsert: false });
        if (upErr) {
          setBusy(false);
          return setError(`Couldn't upload ${f.name}: ${upErr.message}`);
        }
        paths.push(path);
      }
    }
    const res = await recordPayment({
      id,
      clientId,
      date,
      currency,
      amount: amt,
      fee: Number(fee) || 0,
      channelId: channelId || null,
      account,
      reference,
      note,
      proof: paths,
      noProofReason: proofMode === "none" ? noProof : "",
      allocations,
    });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    toast(`Recorded ${receiptLabel(res.no)}, ${money(amt, currency)}`);
    onDone();
    router.refresh();
  }

  const leftClass = !amt ? s.note : left < 0 ? `${s.note} ${s.noteDanger}` : left > 0 ? `${s.note} ${s.noteOk}` : s.note;
  const leftText = !amt
    ? "Enter an amount to allocate it."
    : left < 0
      ? `Applied ${money(-left, currency)} more than received. Lower an amount.`
      : left > 0
        ? `${money(left, currency)} left over becomes client credit.`
        : "Fully allocated. Nothing left over.";

  return (
    <form id="record-payment-form" className="stack" onSubmit={submit} aria-busy={busy}>
      <FormGrid>
        <Field label="Client" htmlFor="rp-client">
          <select id="rp-client" value={clientId} onChange={(e) => pickClient(e.target.value)} required>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date received" htmlFor="rp-date">
          <input id="rp-date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="Currency" htmlFor="rp-cur">
          <select
            id="rp-cur"
            value={currency}
            onChange={(e) => {
              setCurrency(e.target.value as Currency);
              setManual(null);
            }}
          >
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Amount received" htmlFor="rp-amount">
          <input
            id="rp-amount"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setManual(null);
            }}
            required
          />
        </Field>
        <Field label="Fee taken by channel" htmlFor="rp-fee">
          <input id="rp-fee" type="number" step="0.01" min="0" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} />
        </Field>
        <Field label="Landed amount" htmlFor="rp-landed">
          <input id="rp-landed" readOnly value={amt ? (amt - (Number(fee) || 0)).toFixed(2) : ""} />
        </Field>
      </FormGrid>

      {dup ? (
        <div className={`${s.note} ${s.noteWarn}`} role="status">
          A payment of this amount from this client was recorded in the last 14 days. Check it isn&apos;t a duplicate.
        </div>
      ) : null}

      <div className="stack">
        <h4>Apply to open invoices, oldest first</h4>
        <Table className={s.alloc}>
          <thead>
            <tr>
              <Th aria-label="Apply" />
              <Th>Invoice</Th>
              <Th>Due</Th>
              <Th right>Balance</Th>
              <Th right>Apply</Th>
            </tr>
          </thead>
          <tbody>
            {open.length ? (
              open
                .slice()
                .sort((a, b) => a.due.localeCompare(b.due))
                .map((i) => {
                  const a = allocations.find((x) => x.invoiceId === i.id)?.amount ?? 0;
                  return (
                    <tr key={i.id}>
                      <Td>
                        <input
                          type="checkbox"
                          aria-label={`Apply to ${i.number}`}
                          checked={!unticked.has(i.id)}
                          onChange={(e) => {
                            const n = new Set(unticked);
                            if (e.target.checked) n.delete(i.id);
                            else n.add(i.id);
                            setUnticked(n);
                            setManual(null);
                          }}
                        />
                      </Td>
                      <Td num>{i.number}</Td>
                      <Td num>
                        {fmtDay(i.due)}
                        {i.overdue ? <span className="small t-danger"> late</span> : null}
                      </Td>
                      <Td right num>
                        {money(i.balance, i.currency)}
                      </Td>
                      <Td right>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          aria-label={`Amount for ${i.number}`}
                          value={manual?.[i.id] ?? String(a)}
                          onChange={(e) => {
                            const base = Object.fromEntries(allocations.map((x) => [x.invoiceId, String(x.amount)]));
                            setManual({ ...base, ...manual, [i.id]: e.target.value });
                          }}
                        />
                      </Td>
                    </tr>
                  );
                })
            ) : (
              <tr>
                <Td colSpan={5} className="muted">
                  No open {currency} invoices. The full amount becomes client credit.
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
        <div className={leftClass}>{leftText}</div>
      </div>

      <FormGrid>
        <Field label="Channel" htmlFor="rp-channel">
          <select
            id="rp-channel"
            value={channelId}
            onChange={(e) => {
              setChannelId(e.target.value);
              setAccount(channels.find((c) => c.id === e.target.value)?.account ?? "");
            }}
          >
            <option value="">No channel</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Account" htmlFor="rp-account">
          <input id="rp-account" value={account} onChange={(e) => setAccount(e.target.value)} maxLength={120} />
        </Field>
        <Field label="Reference" htmlFor="rp-ref">
          <input id="rp-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Bank or transfer reference" maxLength={120} />
        </Field>
        <Field label="Rate saved" htmlFor="rp-rate">
          <input id="rp-rate" readOnly value={currency === "USD" ? "1 USD = 1 USD" : rate ? `1 ${currency} = ${rate} USD` : "No rate set"} />
        </Field>
        <Field label="Note" htmlFor="rp-note" full>
          <textarea id="rp-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything finance should know" maxLength={1000} />
        </Field>
      </FormGrid>

      <div className="stack">
        <div className={s.radios} role="radiogroup" aria-label="Proof">
          <label>
            <input type="radio" name="proof" checked={proofMode === "file"} onChange={() => setProofMode("file")} /> Attach proof
          </label>
          <label>
            <input type="radio" name="proof" checked={proofMode === "none"} onChange={() => setProofMode("none")} /> No proof
          </label>
        </div>
        {proofMode === "file" ? (
          <Field label="Proof files" htmlFor="rp-files">
            <input id="rp-files" type="file" multiple accept="image/*,.pdf" onChange={(e) => setFiles([...(e.target.files ?? [])].slice(0, 10))} />
          </Field>
        ) : (
          <Field label="Why is there no proof?" htmlFor="rp-noproof">
            <input
              id="rp-noproof"
              value={noProof}
              onChange={(e) => setNoProof(e.target.value)}
              placeholder="For example: cash handed to Hamza at the meeting"
              maxLength={300}
              required
            />
          </Field>
        )}
      </div>

      {error ? (
        <div className={`${s.note} ${s.noteDanger}`} role="alert">
          {error}
        </div>
      ) : null}
    </form>
  );
}

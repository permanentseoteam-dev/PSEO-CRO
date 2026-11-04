"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Dialog, Field, StatusDot, Table, Td, Th, useToast } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { fmtDate, fmtDay, money } from "@/lib/modules/finance/core/logic";
import { receiptLabel } from "@/lib/modules/finance/ops/logic";
import type { ReceiptRow } from "@/lib/modules/finance/ops/types";
import { addProof, proofLinks, voidReceipt } from "../actions";
import { safeName } from "./record-payment";
import s from "./ops.module.css";

/** Received payments. Clicking a row opens the payment: allocations, proof, add proof, void. */
export function ReceiptsTable({ rows, canRecord }: { rows: ReceiptRow[]; canRecord: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const current = rows.find((r) => r.id === openId) ?? null;
  return (
    <>
      <Table>
        <thead>
          <tr>
            <Th>Date</Th>
            <Th>Client</Th>
            <Th right>Amount</Th>
            <Th right hideSm>
              Fee
            </Th>
            <Th right hideSm>
              Landed
            </Th>
            <Th>Channel</Th>
            <Th>Applied to</Th>
            <Th>Proof</Th>
            <Th hideSm>Rate saved</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr
              key={p.id}
              className={`${s.clickRow} ${p.status === "void" ? s.faded : ""}`}
              tabIndex={0}
              onClick={() => setOpenId(p.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setOpenId(p.id);
              }}
            >
              <Td num>{fmtDay(p.date)}</Td>
              <Td>
                {p.clientName}
                <div className="small muted">
                  {receiptLabel(p.no)}
                  {p.reference ? ` · ${p.reference}` : ""}
                  {p.status === "void" ? " · void" : ""}
                </div>
              </Td>
              <Td right num>
                {money(p.amount, p.currency)}
              </Td>
              <Td right num hideSm>
                {p.fee ? money(p.fee, p.currency) : "—"}
              </Td>
              <Td right num hideSm>
                {money(p.landed, p.currency)}
              </Td>
              <Td>
                {p.channelName ?? "—"}
                {p.account ? <div className="small muted hide-sm">{p.account}</div> : null}
              </Td>
              <Td num>
                {p.allocations.length ? p.allocations.map((a) => a.number).join(", ") : null}
                {p.credit > 0 ? (
                  <span className="muted">
                    {p.allocations.length ? ", " : ""}Credit {money(p.credit, p.currency)}
                  </span>
                ) : null}
                {!p.allocations.length && !p.credit ? <span className="muted">—</span> : null}
              </Td>
              <Td>{p.proofPaths.length ? <StatusDot tone="ok">Attached</StatusDot> : <StatusDot tone="warn">Missing</StatusDot>}</Td>
              <Td num hideSm className="small muted">
                {p.currency === "USD" || p.rate == null ? "—" : `1 ${p.currency} = ${p.rate}`}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Dialog open={!!current} onClose={() => setOpenId(null)} title={current ? `Payment ${receiptLabel(current.no)}` : "Payment"}>
        {current ? <ReceiptDetail key={current.id} r={current} canRecord={canRecord} onClose={() => setOpenId(null)} /> : null}
      </Dialog>
    </>
  );
}

function ReceiptDetail({ r, canRecord, onClose }: { r: ReceiptRow; canRecord: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [links, setLinks] = useState<{ name: string; url: string }[] | null>(null);
  const [voiding, setVoiding] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function showProof() {
    const res = await proofLinks({ id: r.id });
    if (!res.ok) return setError(res.error);
    setLinks(res.links);
    if (!res.links.length) setError("The proof files couldn't be found.");
  }

  async function upload(files: File[]) {
    if (!files.length) return;
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const paths: string[] = [];
    for (const f of files.slice(0, 10)) {
      const path = `${r.id}/${Date.now()}-${safeName(f.name)}`;
      const { error: upErr } = await supabase.storage.from("payment-proofs").upload(path, f);
      if (upErr) {
        setBusy(false);
        return setError(`Couldn't upload ${f.name}: ${upErr.message}`);
      }
      paths.push(path);
    }
    const res = await addProof({ id: r.id, paths });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    toast("Proof added");
    router.refresh();
  }

  async function doVoid() {
    setBusy(true);
    const res = await voidReceipt({ id: r.id, reason });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    toast(`${receiptLabel(r.no)} voided`);
    onClose();
    router.refresh();
  }

  return (
    <div className="stack">
      <dl className={s.kv}>
        <dt>Client</dt>
        <dd>{r.clientName}</dd>
        <dt>Received</dt>
        <dd className="num">{fmtDate(r.date)}</dd>
        <dt>Amount</dt>
        <dd className="num">
          {money(r.amount, r.currency)}
          {r.fee ? ` · fee ${money(r.fee, r.currency)} · landed ${money(r.landed, r.currency)}` : ""}
        </dd>
        <dt>Channel</dt>
        <dd>{[r.channelName, r.account].filter(Boolean).join(" · ") || "—"}</dd>
        <dt>Reference</dt>
        <dd>{r.reference ?? "—"}</dd>
        <dt>Applied to</dt>
        <dd>
          {r.allocations.length
            ? r.allocations.map((a, i) => (
                <span key={a.invoiceId}>
                  {i ? ", " : ""}
                  <Link href={`/finance/invoices/${a.invoiceId}`}>{a.number}</Link> {money(a.amount, r.currency)}
                </span>
              ))
            : "—"}
        </dd>
        <dt>Credit</dt>
        <dd className="num">{r.credit ? money(r.credit, r.currency) : "—"}</dd>
        <dt>Rate saved</dt>
        <dd className="num">{r.currency === "USD" || r.rate == null ? "—" : `1 ${r.currency} = ${r.rate} USD`}</dd>
        {r.note ? (
          <>
            <dt>Note</dt>
            <dd>{r.note}</dd>
          </>
        ) : null}
        <dt>Proof</dt>
        <dd>
          {r.proofPaths.length ? (
            links ? (
              links.map((l) => (
                <div key={l.url}>
                  <a href={l.url} target="_blank" rel="noreferrer">
                    {l.name}
                  </a>
                </div>
              ))
            ) : (
              <Button size="sm" onClick={showProof}>
                View {r.proofPaths.length === 1 ? "file" : `${r.proofPaths.length} files`}
              </Button>
            )
          ) : (
            <StatusDot tone="warn">{r.noProofReason ? `Missing: ${r.noProofReason}` : "Missing"}</StatusDot>
          )}
        </dd>
        {r.status === "void" ? (
          <>
            <dt>Voided</dt>
            <dd>{r.voidReason}</dd>
          </>
        ) : null}
      </dl>

      {canRecord && r.status !== "void" ? (
        <Field label="Add proof files" htmlFor="rc-files">
          <input id="rc-files" type="file" multiple accept="image/*,.pdf" disabled={busy} onChange={(e) => upload([...(e.target.files ?? [])])} />
        </Field>
      ) : null}

      {canRecord && r.status !== "void" ? (
        voiding ? (
          <div className="stack">
            <Field label="Why are you voiding this payment?" htmlFor="rc-void">
              <textarea id="rc-void" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Required" maxLength={500} />
            </Field>
            <div className="row">
              <Button variant="primary-danger" disabled={busy || reason.trim().length < 3} onClick={doVoid}>
                Void payment
              </Button>
              <Button variant="ghost" onClick={() => setVoiding(false)}>
                Keep it
              </Button>
            </div>
          </div>
        ) : (
          <div className="row">
            <Button variant="danger" onClick={() => setVoiding(true)}>
              Void payment
            </Button>
          </div>
        )
      ) : null}

      {error ? (
        <div className={`${s.note} ${s.noteDanger}`} role="alert">
          {error}
        </div>
      ) : null}
    </div>
  );
}

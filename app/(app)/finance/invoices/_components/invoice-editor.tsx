"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button, Card, CardBody, CardHead, Dialog, Field, FormGrid, IconButton, Table, Th, useToast } from "@/components/ui";
import { addDays, computeTotals, fmtDate, money, round2, type Currency } from "@/lib/modules/finance/core/logic";
import type { BillTo, ClientOption, Entity, PayChannel } from "@/lib/modules/finance/core/types";
import { saveInvoice } from "../actions";
import s from "../../_core/finance.module.css";

type Line = { key: number; description: string; detail: string; qty: string; rate: string; tax_pct: string };

export type EditorValues = {
  id?: string;
  label: string;
  client_id: string;
  entity_id: string;
  currency: Currency;
  issued_on: string;
  due_on: string;
  po_ref: string;
  title: string;
  discount: number;
  channel_id: string;
  pay_link: string;
  notes: string;
  terms: string;
  lines: { description: string; detail: string; qty: number; rate: number; tax_pct: number }[];
};

type Props = {
  initial: EditorValues;
  issued: boolean;
  readOnly: boolean;
  /** Paid minus refunded; the total can't drop below it. */
  paid: number;
  billTo: BillTo;
  entities: Entity[];
  channels: PayChannel[];
  clients: ClientOption[];
  /** History card, rendered under the form. */
  children?: ReactNode;
};

let nextKey = 1;
const toLine = (l: EditorValues["lines"][number]): Line => ({
  key: nextKey++,
  description: l.description,
  detail: l.detail,
  qty: String(l.qty),
  rate: String(l.rate),
  tax_pct: String(l.tax_pct),
});

export function InvoiceEditor({ initial, issued, readOnly, paid, billTo, entities, channels, clients, children }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [v, setV] = useState(initial);
  const [lines, setLines] = useState<Line[]>(() => initial.lines.map(toLine));
  const [discount, setDiscount] = useState(String(initial.discount || 0));
  const [askReason, setAskReason] = useState(false);
  const [reason, setReason] = useState("");

  const set = <K extends keyof EditorValues>(k: K, val: EditorValues[K]) => setV((p) => ({ ...p, [k]: val }));
  const entity = entities.find((e) => e.id === v.entity_id) ?? null;
  const channel = channels.find((c) => c.id === v.channel_id) ?? null;
  const client = clients.find((c) => c.id === v.client_id);
  const cur = v.currency;
  const t = useMemo(
    () => computeTotals(lines.map((l) => ({ qty: Number(l.qty) || 0, rate: Number(l.rate) || 0, taxPct: Number(l.tax_pct) || 0 })), Number(discount) || 0),
    [lines, discount],
  );
  const below = issued && t.total < paid;
  const taxLabel = entity && entity.tax_label !== "None" ? entity.tax_label : "Tax";
  const due = Math.max(round2(t.total - paid), 0);

  const setLine = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const addLine = () => setLines((ls) => [...ls, toLine({ description: "", detail: "", qty: 1, rate: 0, tax_pct: entity?.tax_rate ?? 0 })]);

  const pickClient = (id: string) => {
    const c = clients.find((x) => x.id === id);
    const e = c ? entities.find((x) => x.currency === c.currency) : undefined;
    setV((p) => ({ ...p, client_id: id, ...(c ? { currency: c.currency } : {}), ...(e ? { entity_id: e.id } : {}) }));
  };
  const pickEntity = (id: string) => {
    const e = entities.find((x) => x.id === id);
    setV((p) => ({ ...p, entity_id: id, ...(e ? { currency: e.currency } : {}) }));
  };

  function save(withReason?: string) {
    if (!v.client_id || !v.entity_id) return toast("Pick a client and an entity.");
    if (below) return toast("The total is below the amount already paid.");
    start(async () => {
      const res = await saveInvoice({
        ...v,
        discount: Number(discount) || 0,
        channel_id: v.channel_id || null,
        lines: lines.map(({ description, detail, qty, rate, tax_pct }) => ({ description, detail, qty, rate, tax_pct })),
        reason: withReason,
      });
      if (!res.ok) return toast(res.error);
      setAskReason(false);
      setReason("");
      toast("Saved");
      if (!v.id) router.push(`/finance/invoices/${res.id}`);
      else router.refresh();
    });
  }

  const totals = (
    <div className={s.totals}>
      <span>Subtotal</span>
      <span className={s.r}>{money(t.subtotal, cur)}</span>
      {t.discount ? (
        <>
          <span>Discount</span>
          <span className={s.r}>− {money(t.discount, cur)}</span>
        </>
      ) : null}
      <span>{taxLabel}</span>
      <span className={s.r}>{money(t.tax, cur)}</span>
      <span className={s.grand}>Total</span>
      <span className={`${s.grand} ${s.r}`}>{money(t.total, cur)}</span>
      {issued && paid > 0 ? (
        <>
          <span>Paid</span>
          <span className={s.r}>− {money(paid, cur)}</span>
        </>
      ) : null}
      <span>
        <strong>Balance due</strong>
      </span>
      <span className={s.r}>
        <strong>{money(due, cur)}</strong>
      </span>
    </div>
  );

  return (
    <div className={s.editor}>
      <div className="stack" style={{ gap: 16 }}>
        <Card>
          <CardHead title="Details" />
          <CardBody>
            <FormGrid>
              <Field label="Entity" htmlFor="iv-entity">
                <select id="iv-entity" value={v.entity_id} disabled={readOnly || issued} onChange={(e) => pickEntity(e.target.value)}>
                  <option value="">Pick an entity</option>
                  {entities.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Client" htmlFor="iv-client">
                <select id="iv-client" value={v.client_id} disabled={readOnly || issued} onChange={(e) => pickClient(e.target.value)}>
                  <option value="">Pick a client</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Currency" htmlFor="iv-cur">
                <select id="iv-cur" value={cur} disabled={readOnly || issued} onChange={(e) => set("currency", e.target.value as Currency)}>
                  {(["AED", "USD", "PKR"] as Currency[]).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="PO or reference" htmlFor="iv-po">
                <input id="iv-po" value={v.po_ref} disabled={readOnly} onChange={(e) => set("po_ref", e.target.value)} />
              </Field>
              <Field label="Issue date" htmlFor="iv-issued">
                <input id="iv-issued" type="date" value={v.issued_on} disabled={readOnly} onChange={(e) => set("issued_on", e.target.value)} />
              </Field>
              <Field label="Due date" htmlFor="iv-due">
                <input id="iv-due" type="date" value={v.due_on} disabled={readOnly} onChange={(e) => set("due_on", e.target.value)} />
                {readOnly ? null : (
                  <div className={s.dueBtns}>
                    {[7, 14, 30].map((n) => (
                      <Button key={n} size="sm" variant="ghost" onClick={() => set("due_on", addDays(v.issued_on, n))}>
                        +{n}
                      </Button>
                    ))}
                  </div>
                )}
              </Field>
              <Field label="Title" htmlFor="iv-title" full>
                <input id="iv-title" value={v.title} disabled={readOnly} onChange={(e) => set("title", e.target.value)} />
              </Field>
            </FormGrid>
          </CardBody>
        </Card>

        <Card>
          <CardHead
            title="Lines"
            actions={
              readOnly ? null : (
                <Button size="sm" onClick={addLine}>
                  Add line
                </Button>
              )
            }
          />
          <Table className={s.lines}>
            <thead>
              <tr>
                <Th>Description</Th>
                <Th>Qty</Th>
                <Th>Rate</Th>
                <Th>Tax %</Th>
                <Th right>Amount</Th>
                {readOnly ? null : <Th aria-label="Remove" />}
              </tr>
            </thead>
            <tbody>
              {lines.map((l, k) => (
                <tr key={l.key}>
                  <td style={{ minWidth: 200 }}>
                    <input aria-label="Description" value={l.description} disabled={readOnly} onChange={(e) => setLine(l.key, { description: e.target.value })} />
                    <input
                      className={s.detail}
                      aria-label="Detail"
                      placeholder="Detail (optional)"
                      value={l.detail}
                      disabled={readOnly}
                      onChange={(e) => setLine(l.key, { detail: e.target.value })}
                    />
                  </td>
                  <td style={{ width: 80 }}>
                    <input className="num" aria-label="Quantity" type="number" step="0.5" min="0" value={l.qty} disabled={readOnly} onChange={(e) => setLine(l.key, { qty: e.target.value })} />
                  </td>
                  <td style={{ width: 120 }}>
                    <input className="num" aria-label="Rate" type="number" step="0.01" min="0" value={l.rate} disabled={readOnly} onChange={(e) => setLine(l.key, { rate: e.target.value })} />
                  </td>
                  <td style={{ width: 80 }}>
                    <input className="num" aria-label="Tax percent" type="number" step="0.5" min="0" max="100" value={l.tax_pct} disabled={readOnly} onChange={(e) => setLine(l.key, { tax_pct: e.target.value })} />
                  </td>
                  <td className="num right" style={{ width: 120 }}>
                    {money(t.lines[k] ?? 0, cur)}
                  </td>
                  {readOnly ? null : (
                    <td style={{ width: 40 }}>
                      <IconButton label="Remove line" size="sm" onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                        <X size={16} />
                      </IconButton>
                    </td>
                  )}
                </tr>
              ))}
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={6} className="muted">
                    No lines yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </Table>
          <CardBody className="stack">
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <label className="small muted" htmlFor="iv-disc">
                Discount
              </label>
              <input id="iv-disc" className={s.discount} type="number" step="0.01" min="0" value={discount} disabled={readOnly} onChange={(e) => setDiscount(e.target.value)} />
            </div>
            {totals}
            {below ? <div className={`${s.note} ${s.noteDanger}`}>The total is below the amount already paid. Raise it or refund the difference.</div> : null}
          </CardBody>
        </Card>

        <Card>
          <CardHead title="Payment and notes" />
          <CardBody className="stack">
            <FormGrid>
              <Field label="Pay by" htmlFor="iv-channel">
                <select id="iv-channel" value={v.channel_id} disabled={readOnly} onChange={(e) => set("channel_id", e.target.value)}>
                  <option value="">Not set</option>
                  {channels.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Pay link" htmlFor="iv-link">
                <input id="iv-link" value={v.pay_link} placeholder="Paste a link" disabled={readOnly} onChange={(e) => set("pay_link", e.target.value)} />
              </Field>
              <Field label="Notes" htmlFor="iv-notes" full>
                <textarea id="iv-notes" rows={2} value={v.notes} disabled={readOnly} onChange={(e) => set("notes", e.target.value)} />
              </Field>
              <Field label="Terms" htmlFor="iv-terms" full>
                <textarea id="iv-terms" rows={2} value={v.terms} disabled={readOnly} onChange={(e) => set("terms", e.target.value)} />
              </Field>
            </FormGrid>
            {readOnly ? null : (
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <Button variant="primary" disabled={pending || below} onClick={() => (issued ? setAskReason(true) : save())}>
                  {v.id ? "Save changes" : "Save draft"}
                </Button>
              </div>
            )}
          </CardBody>
        </Card>

        {children}
      </div>

      <div className={s.doc} aria-label="Invoice preview">
        <div className="row between" style={{ alignItems: "flex-start" }}>
          <div>
            <h2>Invoice</h2>
            <div className="num" style={{ color: "var(--ink)" }}>
              {v.label}
            </div>
          </div>
          {entity ? (
            <div className="right">
              <strong>{entity.name}</strong>
              {entity.address ? <div>{entity.address}</div> : null}
              {entity.tax_id ? <div>{entity.tax_id}</div> : null}
            </div>
          ) : null}
        </div>
        <div className="grid-2" style={{ gap: 12 }}>
          <div>
            <div className="muted">Bill to</div>
            <strong>{(v.client_id === initial.client_id && billTo.name) || client?.name || "No client yet"}</strong>
            {v.client_id === initial.client_id ? (
              <>
                {billTo.address ? <div>{billTo.address}</div> : null}
                {billTo.tax_id ? <div>{billTo.tax_id}</div> : null}
              </>
            ) : null}
          </div>
          <dl className={s.kv}>
            <dt>Issued</dt>
            <dd>{fmtDate(v.issued_on)}</dd>
            <dt>Due</dt>
            <dd>{fmtDate(v.due_on)}</dd>
            <dt>Reference</dt>
            <dd>{v.po_ref || "—"}</dd>
          </dl>
        </div>
        {v.title ? <strong>{v.title}</strong> : null}
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th className={s.r}>Qty</th>
              <th className={s.r}>Rate</th>
              <th className={s.r}>Tax</th>
              <th className={s.r}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.length ? (
              lines.map((l, k) => (
                <tr key={l.key}>
                  <td>
                    <strong>{l.description || "Untitled line"}</strong>
                    {l.detail ? <div>{l.detail}</div> : null}
                  </td>
                  <td className={s.r}>{Number(l.qty) || 0}</td>
                  <td className={s.r}>{money(Number(l.rate) || 0, cur)}</td>
                  <td className={s.r}>{Number(l.tax_pct) || 0}%</td>
                  <td className={s.r}>{money(t.lines[k] ?? 0, cur)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>No lines yet.</td>
              </tr>
            )}
          </tbody>
        </table>
        {totals}
        {channel || v.pay_link ? (
          <div className={s.paybox}>
            {channel ? <strong>Pay by {channel.name}</strong> : null}
            {channel?.details ? <div>{channel.details}</div> : null}
            {v.pay_link ? <div className="small">Pay online: {v.pay_link}</div> : null}
          </div>
        ) : null}
        {v.notes ? <div>{v.notes}</div> : null}
        {v.terms ? <div className="small muted">{v.terms}</div> : null}
      </div>

      <Dialog
        open={askReason}
        onClose={() => setAskReason(false)}
        title="Save changes to an issued invoice"
        footer={
          <>
            <Button variant="ghost" onClick={() => setAskReason(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={pending || reason.trim().length < 3} onClick={() => save(reason)}>
              Save changes
            </Button>
          </>
        }
      >
        <div className="stack">
          <p className="small muted" style={{ margin: 0 }}>
            The client gets the updated PDF if you email it again. The reason is kept in history.
          </p>
          <Field label="Reason for the change" htmlFor="iv-reason">
            <textarea id="iv-reason" rows={3} required placeholder="Required" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </div>
      </Dialog>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { Download } from "lucide-react";
import { Button, Card, CardBody, CardHead, Dialog, EmptyState, Field, FormGrid, Input, Select, StatusDot, Table, Td, Th, useToast } from "@/components/ui";
import { savePayRecord, savePayslip } from "../actions";
import { DEFAULT_SPLIT, PAY_COMPONENTS, fmtDate, fmtMonth, localDate, money, splitGross, type PayParts } from "../logic";
import { CURRENCIES, type Currency, type PayRecord, type Payslip } from "../types";

type Props = {
  memberId: string;
  current: PayRecord | null;
  history: PayRecord[];
  payslips: Payslip[];
  canManage: boolean;
  payslipBase: string;
};

export function PayTabClient({ memberId, current, history, payslips, canManage, payslipBase }: Props) {
  const currency: Currency = current?.currency ?? "AED";
  const [gross, setGross] = useState(String(current?.gross ?? 0));
  const [pcts, setPcts] = useState<PayParts>(DEFAULT_SPLIT);
  const [payDraft, setPayDraft] = useState<PayParts | null>(null);
  const [slipOpen, setSlipOpen] = useState(false);
  const split = splitGross(Number(gross), pcts);

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="grid-2">
        <Card>
          <CardHead
            title="Salary"
            actions={
              <>
                <span className="small muted">Monthly, {currency}</span>
                {canManage ? (
                  <Button size="sm" onClick={() => setPayDraft(current ?? { ...split.parts })}>
                    Change pay
                  </Button>
                ) : null}
              </>
            }
          />
          {current ? (
            <Table>
              <thead>
                <tr>
                  <Th>Component</Th>
                  <Th right>Amount</Th>
                </tr>
              </thead>
              <tbody>
                {PAY_COMPONENTS.map((c) => (
                  <tr key={c.key}>
                    <Td>{c.label}</Td>
                    <Td right num>
                      {money(current[c.key], currency)}
                    </Td>
                  </tr>
                ))}
                <tr>
                  <Td>
                    <b>Gross</b>
                  </Td>
                  <Td right num>
                    <b>{money(current.gross, currency)}</b>
                  </Td>
                </tr>
              </tbody>
            </Table>
          ) : (
            <EmptyState title="No salary on record" />
          )}
        </Card>

        <Card>
          <CardHead title="Split a gross" />
          <CardBody className="stack">
            <FormGrid>
              <Field label={`Gross per month (${currency})`} htmlFor="hr-gross" full>
                <Input id="hr-gross" type="number" min={0} step="0.01" value={gross} onChange={(e) => setGross(e.target.value)} />
              </Field>
              {PAY_COMPONENTS.map((c) => (
                <Field key={c.key} label={`${c.label} %`} htmlFor={`hr-pct-${c.key}`}>
                  <Input
                    id={`hr-pct-${c.key}`}
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={pcts[c.key]}
                    onChange={(e) => setPcts({ ...pcts, [c.key]: Number(e.target.value) })}
                  />
                </Field>
              ))}
            </FormGrid>
            <Table>
              <tbody>
                {PAY_COMPONENTS.map((c) => (
                  <tr key={c.key}>
                    <Td>{c.label}</Td>
                    <Td right num>
                      {money(split.parts[c.key], currency)}
                    </Td>
                  </tr>
                ))}
                <tr>
                  <Td>
                    <b>Total</b>
                  </Td>
                  <Td right num>
                    <b>{money(split.total, currency)}</b>
                  </Td>
                </tr>
              </tbody>
            </Table>
            <div className="row between">
              {split.ok ? <StatusDot tone="ok">Adds up to 100%</StatusDot> : <StatusDot tone="danger">{`Adds up to ${split.totalPct}%, needs 100%`}</StatusDot>}
              {canManage ? (
                <Button size="sm" disabled={!split.ok} onClick={() => setPayDraft({ ...split.parts })}>
                  Use as new pay
                </Button>
              ) : null}
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="grid-2">
        <Card>
          <CardHead title="Pay history" />
          {history.length ? (
            <Table>
              <thead>
                <tr>
                  <Th>From</Th>
                  <Th right>Gross</Th>
                  <Th>Reason</Th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <Td>{fmtDate(h.effective_from)}</Td>
                    <Td right num>
                      {money(h.gross, h.currency)}
                    </Td>
                    <Td>{h.reason ?? ""}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState title="No pay changes yet" />
          )}
        </Card>

        <Card>
          <CardHead
            title="Payslips"
            actions={
              canManage ? (
                <Button size="sm" onClick={() => setSlipOpen(true)}>
                  Add payslip
                </Button>
              ) : null
            }
          />
          {payslips.length ? (
            <Table>
              <thead>
                <tr>
                  <Th>Month</Th>
                  <Th right>Net</Th>
                  <Th aria-label="Download" />
                </tr>
              </thead>
              <tbody>
                {payslips.map((p) => (
                  <tr key={p.id}>
                    <Td>{fmtMonth(p.month)}</Td>
                    <Td right num>
                      {money(p.net, p.currency)}
                    </Td>
                    <Td right>
                      <a className="btn sm ghost" href={`${payslipBase}/${p.id}`} download>
                        <Download aria-hidden="true" size={14} />
                        Download PDF
                      </a>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <EmptyState title="No payslips yet" />
          )}
        </Card>
      </div>

      {payDraft ? <PayDialog memberId={memberId} start={payDraft} currency={currency} onClose={() => setPayDraft(null)} /> : null}
      {slipOpen ? <PayslipDialog memberId={memberId} gross={current?.gross ?? 0} currency={currency} onClose={() => setSlipOpen(false)} /> : null}
    </div>
  );
}

function PayDialog({ memberId, start, currency, onClose }: { memberId: string; start: PayParts; currency: Currency; onClose: () => void }) {
  const [parts, setParts] = useState<PayParts>({
    basic: start.basic,
    house_rent: start.house_rent,
    utilities: start.utilities,
    medical: start.medical,
    other: start.other,
  });
  const [cur, setCur] = useState<Currency>(currency);
  const [from, setFrom] = useState(localDate(new Date()));
  const [reason, setReason] = useState("");
  const [busy, startT] = useTransition();
  const toast = useToast();

  function save() {
    startT(async () => {
      const r = await savePayRecord({ memberId, effectiveFrom: from, currency: cur, reason, ...parts });
      toast(r.ok ? "Pay saved" : r.error);
      if (r.ok) onClose();
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Change pay"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={busy} onClick={save}>
            Save pay
          </Button>
        </>
      }
    >
      <FormGrid>
        <Field label="Effective from" htmlFor="pay-from">
          <Input id="pay-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Currency" htmlFor="pay-cur">
          <Select id="pay-cur" value={cur} onChange={(e) => setCur(e.target.value as Currency)}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        {PAY_COMPONENTS.map((c) => (
          <Field key={c.key} label={c.label} htmlFor={`pay-${c.key}`}>
            <Input
              id={`pay-${c.key}`}
              type="number"
              min={0}
              step="0.01"
              value={parts[c.key]}
              onChange={(e) => setParts({ ...parts, [c.key]: Number(e.target.value) })}
            />
          </Field>
        ))}
        <Field label="Reason" htmlFor="pay-reason">
          <Input id="pay-reason" placeholder="e.g. Promotion" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </FormGrid>
    </Dialog>
  );
}

function PayslipDialog({ memberId, gross, currency, onClose }: { memberId: string; gross: number; currency: Currency; onClose: () => void }) {
  const [month, setMonth] = useState(localDate(new Date()).slice(0, 7));
  const [g, setG] = useState(String(gross));
  const [ded, setDed] = useState("0");
  const [notes, setNotes] = useState("");
  const [busy, startT] = useTransition();
  const toast = useToast();

  function save() {
    startT(async () => {
      const r = await savePayslip({ memberId, month, gross: g, deductions: ded, currency, notes });
      toast(r.ok ? "Payslip added" : r.error);
      if (r.ok) onClose();
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Add payslip"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={busy} onClick={save}>
            Add payslip
          </Button>
        </>
      }
    >
      <FormGrid>
        <Field label="Month" htmlFor="slip-month">
          <Input id="slip-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </Field>
        <Field label={`Gross (${currency})`} htmlFor="slip-gross">
          <Input id="slip-gross" type="number" min={0} step="0.01" value={g} onChange={(e) => setG(e.target.value)} />
        </Field>
        <Field label={`Deductions (${currency})`} htmlFor="slip-ded">
          <Input id="slip-ded" type="number" min={0} step="0.01" value={ded} onChange={(e) => setDed(e.target.value)} />
        </Field>
        <Field label="Notes" htmlFor="slip-notes">
          <Input id="slip-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </FormGrid>
    </Dialog>
  );
}

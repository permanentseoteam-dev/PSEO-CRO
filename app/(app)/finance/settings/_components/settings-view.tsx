"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, CardHead, Checkbox, Dialog, Field, FormGrid, PhaseTwo, StatusDot, Table, Td, Th, useToast } from "@/components/ui";
import { CURRENCIES, fmtDay, money, type Currency } from "@/lib/modules/finance/core/logic";
import type { ChannelRow, EntityRow, SalaryRow } from "@/lib/modules/finance/ops/types";
import { saveChannel, saveEntity, saveRates, saveSalary } from "../actions";
import s from "../../payments/_components/ops.module.css";

type Rates = Partial<Record<Currency, { rate: number; validFrom: string; updatedAt: string }>>;
type Props = { entities: EntityRow[]; channels: ChannelRow[]; rates: Rates; salaries: SalaryRow[] | null; today: string; reminderFrom: string };

const CHANNEL_TYPES: { value: ChannelRow["type"]; label: string }[] = [
  { value: "wise", label: "Wise" },
  { value: "paypal", label: "PayPal" },
  { value: "slash", label: "Slash" },
  { value: "bank", label: "Bank" },
  { value: "payoneer", label: "Payoneer" },
  { value: "other", label: "Other" },
];

function useSave() {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(fn: () => Promise<{ ok: boolean; error?: string }>, done: string, after?: () => void) {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await fn();
    setBusy(false);
    if (!res.ok) return setError(res.error ?? "Something went wrong.");
    toast(done);
    after?.();
    router.refresh();
  }
  return { busy, error, save };
}

const ErrorNote = ({ error }: { error: string | null }) =>
  error ? (
    <div className={`${s.note} ${s.noteDanger}`} role="alert">
      {error}
    </div>
  ) : null;

export function SettingsView({ entities, channels, rates, salaries, today, reminderFrom }: Props) {
  const [entity, setEntity] = useState<EntityRow | "new" | null>(null);
  const [channel, setChannel] = useState<ChannelRow | "new" | null>(null);
  const [salary, setSalary] = useState<SalaryRow | null>(null);
  const updated = Object.values(rates)
    .map((r) => r?.updatedAt ?? "")
    .sort()
    .at(-1);

  return (
    <>
      <Card>
        <CardHead title="Entities" actions={<Button size="sm" onClick={() => setEntity("new")}>Add entity</Button>} />
        <Table>
          <thead>
            <tr>
              <Th>Legal name</Th>
              <Th>Country</Th>
              <Th>Prefix</Th>
              <Th>Next number</Th>
              <Th>Tax</Th>
              <Th>Currency</Th>
              <Th hideSm>Tax ID</Th>
              <Th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {entities.map((e) => (
              <tr key={e.id} className={e.active ? undefined : s.faded}>
                <Td>
                  {e.name}
                  {e.address ? <div className="small muted hide-sm">{e.address}</div> : null}
                  {e.active ? null : <div className="small muted">Inactive</div>}
                </Td>
                <Td>{e.country ?? "—"}</Td>
                <Td num>{e.prefix}</Td>
                <Td num>
                  INV-{e.prefix}-{String(e.nextNumber).padStart(4, "0")}
                </Td>
                <Td>
                  {e.taxLabel}
                  {e.taxRate ? ` ${e.taxRate}%` : ""}
                </Td>
                <Td>{e.currency}</Td>
                <Td num hideSm>
                  {e.taxId ?? "—"}
                </Td>
                <Td right>
                  <Button size="sm" variant="ghost" onClick={() => setEntity(e)}>
                    Edit
                  </Button>
                </Td>
              </tr>
            ))}
            {!entities.length ? (
              <tr>
                <Td colSpan={8} className="muted">
                  No entities yet. Add the company you invoice from.
                </Td>
              </tr>
            ) : null}
          </tbody>
        </Table>
      </Card>

      <div className="grid-2" style={{ alignItems: "start" }}>
        <Card>
          <CardHead title="Payment channels" actions={<Button size="sm" onClick={() => setChannel("new")}>Add channel</Button>} />
          <div className="list">
            {channels.map((c) => (
              <div key={c.id} className={`item row between ${c.active ? "" : s.faded}`} style={{ alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <strong>{c.name}</strong>
                  {c.account ? <span className="muted"> · {c.account}</span> : null}
                  {c.details ? <div className="small muted">{c.details}</div> : null}
                  <div className="small muted">
                    Fee: {c.feeNote || "None"}
                    {c.active ? "" : " · inactive"}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setChannel(c)}>
                  Edit
                </Button>
              </div>
            ))}
            {!channels.length ? <div className="item muted">No payment channels yet.</div> : null}
          </div>
        </Card>
        <div className="stack" style={{ gap: 16 }}>
          <Card>
            <CardHead title="Exchange rates" actions={<span className="small muted">Base USD{updated ? ` · updated ${fmtDay(updated.slice(0, 10))}` : ""}</span>} />
            <CardBody>
              <RatesForm rates={rates} today={today} />
            </CardBody>
          </Card>
          <Card>
            <CardHead
              title={
                <>
                  Email sending <PhaseTwo />
                </>
              }
            />
            <CardBody>
              <dl className={s.kv}>
                <dt>Sender</dt>
                <dd>Permanent SEO Billing &lt;{reminderFrom}&gt;</dd>
                <dt>Status</dt>
                <dd>
                  <StatusDot tone="warn">Not connected</StatusDot>
                </dd>
              </dl>
            </CardBody>
          </Card>
        </div>
      </div>

      {salaries ? (
        <Card>
          <CardHead title="Salaries" />
          <Table>
            <thead>
              <tr>
                <Th>Person</Th>
                <Th hideSm>Department</Th>
                <Th right>Monthly salary</Th>
                <Th>Since</Th>
                <Th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {salaries.map((r) => (
                <tr key={r.memberId}>
                  <Td>{r.name}</Td>
                  <Td hideSm>{r.department}</Td>
                  <Td right num>
                    {r.amount == null ? <span className="muted">Not set</span> : money(r.amount, r.currency)}
                  </Td>
                  <Td num>{r.validFrom ? fmtDay(r.validFrom) + " " + r.validFrom.slice(0, 4) : "—"}</Td>
                  <Td right>
                    <Button size="sm" variant="ghost" onClick={() => setSalary(r)}>
                      {r.amount == null ? "Set" : "Change"}
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ) : null}

      <EntityDialog key={entity === "new" ? "new" : (entity?.id ?? "none")} value={entity} onClose={() => setEntity(null)} />
      <ChannelDialog key={channel === "new" ? "new" : (channel?.id ?? "none")} value={channel} onClose={() => setChannel(null)} />
      <SalaryDialog key={salary?.memberId ?? "none"} value={salary} today={today} onClose={() => setSalary(null)} />
    </>
  );
}

function RatesForm({ rates, today }: { rates: Rates; today: string }) {
  const [aed, setAed] = useState(String(rates.AED?.rate ?? ""));
  const [pkr, setPkr] = useState(String(rates.PKR?.rate ?? ""));
  const { busy, error, save } = useSave();
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        save(
          () =>
            saveRates({
              date: today,
              rates: [
                { currency: "AED", rate: Number(aed) },
                { currency: "PKR", rate: Number(pkr) },
              ],
            }),
          "Rates saved",
        );
      }}
    >
      <FormGrid>
        <Field label="1 AED in USD" htmlFor="fx-aed">
          <input id="fx-aed" className="num" type="number" step="0.0001" min="0" value={aed} onChange={(e) => setAed(e.target.value)} required />
        </Field>
        <Field label="1 PKR in USD" htmlFor="fx-pkr">
          <input id="fx-pkr" className="num" type="number" step="0.00001" min="0" value={pkr} onChange={(e) => setPkr(e.target.value)} required />
        </Field>
      </FormGrid>
      <p className="small muted">Payments keep the rate saved when they were recorded. New rates only affect new payments and reports.</p>
      <div className="row">
        <Button variant="primary" type="submit" disabled={busy}>
          Save rates
        </Button>
      </div>
      <ErrorNote error={error} />
    </form>
  );
}

function EntityDialog({ value, onClose }: { value: EntityRow | "new" | null; onClose: () => void }) {
  const e = value && value !== "new" ? value : null;
  const [f, setF] = useState({
    code: e?.code ?? "",
    name: e?.name ?? "",
    shortName: e?.shortName ?? "",
    country: e?.country ?? "",
    prefix: e?.prefix ?? "",
    taxLabel: e?.taxLabel ?? "VAT",
    taxRate: String(e?.taxRate ?? 0),
    currency: e?.currency ?? ("USD" as Currency),
    taxId: e?.taxId ?? "",
    address: e?.address ?? "",
    active: e?.active ?? true,
  });
  const { busy, error, save } = useSave();
  const set = (k: keyof typeof f) => (ev: { target: { value: string } }) => setF({ ...f, [k]: ev.target.value });
  return (
    <Dialog
      open={!!value}
      onClose={onClose}
      title={e ? `Edit ${e.name}` : "Add entity"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="entity-form" disabled={busy}>
            Save entity
          </Button>
        </>
      }
    >
      <form
        id="entity-form"
        className="stack"
        onSubmit={(ev) => {
          ev.preventDefault();
          save(() => saveEntity({ id: e?.id ?? null, ...f, prefix: f.prefix.toUpperCase(), code: f.code.toLowerCase() }), "Entity saved", onClose);
        }}
      >
        <FormGrid>
          <Field label="Legal name" htmlFor="en-name" full>
            <input id="en-name" value={f.name} onChange={set("name")} required maxLength={120} />
          </Field>
          <Field label="Short name" htmlFor="en-short">
            <input id="en-short" value={f.shortName} onChange={set("shortName")} required maxLength={40} placeholder="FZ-LLC (UAE)" />
          </Field>
          <Field label="Code" htmlFor="en-code">
            <input id="en-code" value={f.code} onChange={set("code")} required maxLength={8} placeholder="ps" disabled={!!e} />
          </Field>
          <Field label="Country" htmlFor="en-country">
            <input id="en-country" value={f.country} onChange={set("country")} maxLength={80} />
          </Field>
          <Field label="Invoice prefix" htmlFor="en-prefix">
            <input id="en-prefix" value={f.prefix} onChange={set("prefix")} required maxLength={6} />
          </Field>
          <Field label="Tax label" htmlFor="en-taxlabel">
            <input id="en-taxlabel" value={f.taxLabel} onChange={set("taxLabel")} placeholder="VAT, GST or None" required maxLength={20} />
          </Field>
          <Field label="Tax rate %" htmlFor="en-taxrate">
            <input id="en-taxrate" type="number" step="0.5" min="0" max="100" value={f.taxRate} onChange={set("taxRate")} />
          </Field>
          <Field label="Default currency" htmlFor="en-cur">
            <select id="en-cur" value={f.currency} onChange={set("currency")}>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Tax ID" htmlFor="en-taxid">
            <input id="en-taxid" value={f.taxId} onChange={set("taxId")} maxLength={60} />
          </Field>
          <Field label="Address on invoices" htmlFor="en-address" full>
            <textarea id="en-address" rows={2} value={f.address} onChange={set("address")} maxLength={500} />
          </Field>
          <Checkbox className="field full" label="Active" checked={f.active} onChange={(ev) => setF({ ...f, active: ev.target.checked })} />
        </FormGrid>
        <ErrorNote error={error} />
      </form>
    </Dialog>
  );
}

function ChannelDialog({ value, onClose }: { value: ChannelRow | "new" | null; onClose: () => void }) {
  const c = value && value !== "new" ? value : null;
  const [f, setF] = useState({
    name: c?.name ?? "",
    type: c?.type ?? ("bank" as ChannelRow["type"]),
    account: c?.account ?? "",
    feeNote: c?.feeNote ?? "",
    details: c?.details ?? "",
    active: c?.active ?? true,
  });
  const { busy, error, save } = useSave();
  const set = (k: keyof typeof f) => (ev: { target: { value: string } }) => setF({ ...f, [k]: ev.target.value });
  return (
    <Dialog
      open={!!value}
      onClose={onClose}
      title={c ? `Edit ${c.name}` : "Add payment channel"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="channel-form" disabled={busy}>
            Save channel
          </Button>
        </>
      }
    >
      <form
        id="channel-form"
        className="stack"
        onSubmit={(ev) => {
          ev.preventDefault();
          save(() => saveChannel({ id: c?.id ?? null, ...f }), "Channel saved", onClose);
        }}
      >
        <FormGrid>
          <Field label="Name" htmlFor="ch-name">
            <input id="ch-name" value={f.name} onChange={set("name")} required maxLength={60} />
          </Field>
          <Field label="Type" htmlFor="ch-type">
            <select id="ch-type" value={f.type} onChange={set("type")}>
              {CHANNEL_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Account name" htmlFor="ch-account">
            <input id="ch-account" value={f.account} onChange={set("account")} maxLength={120} placeholder="Wise USD ••7720" />
          </Field>
          <Field label="Fee" htmlFor="ch-fee">
            <input id="ch-fee" value={f.feeNote} onChange={set("feeNote")} maxLength={60} placeholder="0.6% + USD 1" />
          </Field>
          <Field label="Details printed on invoices" htmlFor="ch-details" full>
            <textarea id="ch-details" rows={3} value={f.details} onChange={set("details")} maxLength={500} />
          </Field>
          <Checkbox className="field full" label="Active" checked={f.active} onChange={(ev) => setF({ ...f, active: ev.target.checked })} />
        </FormGrid>
        <ErrorNote error={error} />
      </form>
    </Dialog>
  );
}

function SalaryDialog({ value, today, onClose }: { value: SalaryRow | null; today: string; onClose: () => void }) {
  const [amount, setAmount] = useState(value?.amount == null ? "" : String(value.amount));
  const [currency, setCurrency] = useState<Currency>(value?.currency ?? "USD");
  const [validFrom, setValidFrom] = useState(`${today.slice(0, 7)}-01`);
  const { busy, error, save } = useSave();
  return (
    <Dialog
      open={!!value}
      onClose={onClose}
      title={value ? `Salary: ${value.name}` : "Salary"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="salary-form" disabled={busy}>
            Save salary
          </Button>
        </>
      }
    >
      <form
        id="salary-form"
        className="stack"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (value) save(() => saveSalary({ memberId: value.memberId, amount: Number(amount), currency, validFrom }), "Salary saved", onClose);
        }}
      >
        <FormGrid>
          <Field label="Monthly salary" htmlFor="sa-amount">
            <input id="sa-amount" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </Field>
          <Field label="Currency" htmlFor="sa-cur">
            <select id="sa-cur" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)}>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Applies from" htmlFor="sa-from">
            <input id="sa-from" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} required />
          </Field>
        </FormGrid>
        <ErrorNote error={error} />
      </form>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ButtonLink, Checkbox, Dialog, EmptyState, Field, FormGrid, PhaseTwo, Table, Td, Th, useToast } from "@/components/ui";
import { CURRENCIES, money, type Currency } from "@/lib/modules/finance/core/logic";
import { FEE_BASIS_LABEL, firstName, type FeeBasis } from "@/lib/modules/finance/ops/logic";
import type { BillingRow, ChannelPick } from "@/lib/modules/finance/ops/types";
import { saveBillingProfile } from "../actions";
import s from "../../payments/_components/ops.module.css";

type Props = {
  rows: BillingRow[];
  entities: { id: string; name: string; currency: Currency }[];
  channels: ChannelPick[];
  canEdit: boolean;
};

const COUNTRIES = ["United Arab Emirates", "United States", "United Kingdom", "Pakistan", "Saudi Arabia"];

function mailto(r: BillingRow) {
  const body = `Hi ${firstName(r.contact)},\n\nPlease find your statement of account attached. Open balance: ${money(r.openBalance, r.currency)}.\n\nThanks,\nPermanent SEO`;
  const q = new URLSearchParams({ subject: "Your account with Permanent SEO", body });
  if (r.cc) q.set("cc", r.cc);
  return `mailto:${r.billingEmail.replace(/\s+/g, "")}?${q.toString().replace(/\+/g, "%20")}`;
}

export function BillingTable({ rows, entities, channels, canEdit }: Props) {
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<BillingRow | null>(null);
  const needle = q.trim().toLowerCase();
  const shown = needle
    ? rows.filter((r) => [r.clientName, r.legalName, r.billingEmail, r.channelName, r.entityShort].join(" ").toLowerCase().includes(needle))
    : rows;

  return (
    <>
      <div className="row between">
        <h1>Billing clients</h1>
        <input type="search" placeholder="Search clients" aria-label="Search clients" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <section className="card">
        {shown.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Client</Th>
                <Th>Bills from</Th>
                <Th>Pays by</Th>
                <Th right>Agreed fee</Th>
                <Th hideSm>Billing email</Th>
                <Th right>Open balance</Th>
                <Th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.clientId}>
                  <Td>
                    {r.clientName}
                    {r.legalName ? <div className="small muted">{r.legalName}</div> : null}
                  </Td>
                  <Td>{r.entityShort ?? <span className="muted">Not set</span>}</Td>
                  <Td>
                    {r.channelName ?? <span className="muted">Not set</span>}
                    <div className="small muted">{r.termsDays} days</div>
                  </Td>
                  <Td right num>
                    {r.agreedFee ? money(r.agreedFee, r.currency) : "—"}
                    <div className="small muted">{FEE_BASIS_LABEL[r.feeBasis]}</div>
                  </Td>
                  <Td hideSm>
                    {r.billingEmail || <span className="muted">No email</span>}
                    {r.autoReminders ? null : <div className="small muted">Reminders off</div>}
                  </Td>
                  <Td right num>
                    {r.openBalance ? money(r.openBalance, r.currency) : <span className="muted">—</span>}
                  </Td>
                  <Td right>
                    <div className={s.rowActions}>
                      <ButtonLink href={`/finance/invoices?client=${r.clientId}`} variant="ghost" size="sm">
                        Invoices
                      </ButtonLink>
                      {r.billingEmail ? (
                        <a className="btn sm ghost" href={mailto(r)}>
                          Email
                        </a>
                      ) : null}
                      {canEdit ? (
                        <Button size="sm" onClick={() => setEditing(r)}>
                          Edit
                        </Button>
                      ) : null}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title={rows.length ? "No clients match." : "No clients yet."} />
        )}
      </section>
      <Dialog
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing ? `Edit billing: ${editing.clientName}` : "Edit billing"}
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="billing-form">
              Save billing details
            </Button>
          </>
        }
      >
        {editing ? <BillingForm key={editing.clientId} row={editing} entities={entities} channels={channels} onDone={() => setEditing(null)} /> : null}
      </Dialog>
    </>
  );
}

function BillingForm({ row, entities, channels, onDone }: { row: BillingRow; entities: Props["entities"]; channels: ChannelPick[]; onDone: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [f, setF] = useState({
    legalName: row.legalName,
    contact: row.contact,
    billingEmail: row.billingEmail,
    cc: row.cc,
    country: row.country,
    address: row.address,
    taxId: row.taxId,
    entityId: row.entityId ?? entities.find((e) => e.currency === row.currency)?.id ?? "",
    currency: row.currency,
    channelId: row.channelId ?? "",
    termsDays: String(row.termsDays),
    agreedFee: String(row.agreedFee || ""),
    feeBasis: row.feeBasis,
    hoursBudget: row.hoursBudget == null ? "" : String(row.hoursBudget),
    notes: row.notes,
    autoReminders: row.autoReminders,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof f>(k: K) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const countries = f.country && !COUNTRIES.includes(f.country) ? [f.country, ...COUNTRIES] : COUNTRIES;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const res = await saveBillingProfile({
      clientId: row.clientId,
      ...f,
      entityId: f.entityId || null,
      channelId: f.channelId || null,
      termsDays: Number(f.termsDays) || 0,
      agreedFee: Number(f.agreedFee) || 0,
      hoursBudget: f.hoursBudget === "" ? null : Number(f.hoursBudget),
    });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    toast(`Saved billing for ${row.clientName}`);
    onDone();
    router.refresh();
  }

  return (
    <form id="billing-form" onSubmit={submit} className="stack">
      <FormGrid>
        <Field label="Legal name" htmlFor="bc-legal" full>
          <input id="bc-legal" value={f.legalName} onChange={set("legalName")} maxLength={200} />
        </Field>
        <Field label="Billing contact" htmlFor="bc-contact">
          <input id="bc-contact" value={f.contact} onChange={set("contact")} maxLength={120} />
        </Field>
        <Field label="Country" htmlFor="bc-country">
          <select id="bc-country" value={f.country} onChange={set("country")}>
            <option value="">Not set</option>
            {countries.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Billing emails" htmlFor="bc-email">
          <input id="bc-email" value={f.billingEmail} onChange={set("billingEmail")} maxLength={300} placeholder="accounts@client.com" />
        </Field>
        <Field label="Cc" htmlFor="bc-cc">
          <input id="bc-cc" value={f.cc} onChange={set("cc")} maxLength={300} />
        </Field>
        <Field label="Address" htmlFor="bc-address" full>
          <textarea id="bc-address" rows={2} value={f.address} onChange={set("address")} maxLength={500} />
        </Field>
        <Field label="Tax ID" htmlFor="bc-tax">
          <input id="bc-tax" value={f.taxId} onChange={set("taxId")} maxLength={60} />
        </Field>
        <Field label="Bills from" htmlFor="bc-entity">
          <select id="bc-entity" value={f.entityId} onChange={set("entityId")}>
            <option value="">Not set</option>
            {entities.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Currency" htmlFor="bc-cur">
          <select id="bc-cur" value={f.currency} onChange={set("currency")}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Pays by" htmlFor="bc-channel">
          <select id="bc-channel" value={f.channelId} onChange={set("channelId")}>
            <option value="">Not set</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Payment terms (days)" htmlFor="bc-terms">
          <input id="bc-terms" type="number" min="0" max="180" value={f.termsDays} onChange={set("termsDays")} />
        </Field>
        <Field label="Agreed fee" htmlFor="bc-fee">
          <input id="bc-fee" type="number" step="0.01" min="0" value={f.agreedFee} onChange={set("agreedFee")} />
        </Field>
        <Field label="Fee basis" htmlFor="bc-basis">
          <select id="bc-basis" value={f.feeBasis} onChange={(e) => setF({ ...f, feeBasis: e.target.value as FeeBasis })}>
            {(Object.keys(FEE_BASIS_LABEL) as FeeBasis[]).map((b) => (
              <option key={b} value={b}>
                {FEE_BASIS_LABEL[b]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Hours budget a month" htmlFor="bc-hours">
          <input id="bc-hours" type="number" step="0.5" min="0" value={f.hoursBudget} onChange={set("hoursBudget")} />
        </Field>
        <Field label="Notes" htmlFor="bc-notes" full>
          <textarea id="bc-notes" rows={2} value={f.notes} onChange={set("notes")} maxLength={2000} />
        </Field>
        <Checkbox
          className="field full"
          label="Send payment reminders automatically"
          checked={f.autoReminders}
          onChange={(e) => setF({ ...f, autoReminders: e.target.checked })}
        />
        <Field
          label={
            <>
              Sub-accounts billed under this client <PhaseTwo />
            </>
          }
          full
        >
          <span className="muted small">No sub-accounts linked.</span>
        </Field>
      </FormGrid>
      {error ? (
        <div className={`${s.note} ${s.noteDanger}`} role="alert">
          {error}
        </div>
      ) : null}
    </form>
  );
}

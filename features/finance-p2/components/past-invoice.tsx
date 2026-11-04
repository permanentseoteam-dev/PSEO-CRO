"use client";

import { useState, useTransition } from "react";
import { Button, Checkbox, Dialog, Field, FormGrid, Input, Select, useToast } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { recordPastInvoice, setOriginalDocument } from "../actions";
import { CURRENCIES, type EntityOption, type Option } from "../types";

/** Invoices header: "Record past invoice" button and dialog (original number kept, optional original document). */
export function RecordPastInvoiceButton({ clients, entities }: { clients: Option[]; entities: EntityOption[] }) {
  const [open, setOpen] = useState(false);
  const [busy, start] = useTransition();
  const [currency, setCurrency] = useState<string>(entities[0]?.currency ?? "USD");
  const toast = useToast();

  function submit(form: HTMLFormElement) {
    const f = new FormData(form);
    const file = f.get("doc");
    start(async () => {
      const r = await recordPastInvoice({
        number: f.get("number"),
        clientId: f.get("clientId"),
        entityId: f.get("entityId"),
        currency: f.get("currency"),
        issuedOn: f.get("issuedOn"),
        dueOn: f.get("dueOn"),
        total: f.get("total"),
        paid: f.get("paid") || 0,
        title: f.get("title"),
        portalVisible: f.get("portalVisible") === "on",
      });
      if (!r.ok) return toast(r.error);
      if (file instanceof File && file.size > 0) {
        const safe = file.name.replace(/[^\w.-]+/g, "-").slice(-80);
        const path = `${f.get("clientId")}/${r.invoiceId}/${Date.now()}-${safe}`;
        const up = await createClient().storage.from("invoice-originals").upload(path, file, { upsert: false });
        if (up.error) return toast(`Invoice saved, but the document didn't upload: ${up.error.message}`);
        const d = await setOriginalDocument({ invoiceId: r.invoiceId, path, name: file.name });
        if (!d.ok) return toast(d.error);
      }
      toast("Past invoice saved");
      setOpen(false);
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>Record past invoice</Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Record past invoice"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="fp2-past" disabled={busy}>
              Save past invoice
            </Button>
          </>
        }
      >
        <form
          id="fp2-past"
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            submit(e.currentTarget);
          }}
        >
          <p className="small muted">For invoices raised before the portal. The number is kept as written on the original.</p>
          <FormGrid>
            <Field label="Original number" htmlFor="fp2-num">
              <Input id="fp2-num" name="number" required maxLength={40} placeholder="e.g. PS-2025-118" />
            </Field>
            <Field label="Client" htmlFor="fp2-client">
              <Select id="fp2-client" name="clientId" required>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Entity" htmlFor="fp2-ent">
              <Select
                id="fp2-ent"
                name="entityId"
                required
                onChange={(e) => setCurrency(entities.find((x) => x.id === e.target.value)?.currency ?? currency)}
              >
                {entities.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Currency" htmlFor="fp2-cur">
              <Select id="fp2-cur" name="currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="Issued" htmlFor="fp2-iss">
              <Input id="fp2-iss" name="issuedOn" type="date" required />
            </Field>
            <Field label="Due" htmlFor="fp2-due">
              <Input id="fp2-due" name="dueOn" type="date" required />
            </Field>
            <Field label="Total" htmlFor="fp2-total">
              <Input id="fp2-total" name="total" type="number" step="0.01" min="0.01" required className="num" />
            </Field>
            <Field label="Already paid" htmlFor="fp2-paid">
              <Input id="fp2-paid" name="paid" type="number" step="0.01" min="0" defaultValue="0" className="num" />
            </Field>
            <Field label="Title" htmlFor="fp2-title" full>
              <Input id="fp2-title" name="title" maxLength={200} placeholder="Past invoice" />
            </Field>
            <Field label="Original document" htmlFor="fp2-doc" full>
              <Input id="fp2-doc" name="doc" type="file" accept="application/pdf,image/png,image/jpeg" />
            </Field>
            <Checkbox name="portalVisible" defaultChecked label="Show this invoice in the client portal" className="field full" />
          </FormGrid>
        </form>
      </Dialog>
    </>
  );
}

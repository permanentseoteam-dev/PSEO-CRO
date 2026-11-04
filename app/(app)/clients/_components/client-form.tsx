"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button, Checkbox, Dialog, Field, FormGrid, useToast } from "@/components/ui";
import { CHANNELS, COUNTRIES, CURRENCIES, END_REASONS, isEnded, SERVICES } from "@/lib/modules/clients/logic";
import type { ClientRow, Person } from "@/lib/modules/clients/types";
import { saveClient } from "../actions";

type Props = {
  people: Person[];
  client?: ClientRow;
  fee?: { monthly_fee: number | null; hours_per_month: number | null } | null;
  showFee: boolean;
  label: string;
  variant?: "primary" | "default";
};

const STATUS_OPTS = [
  ["active", "Active"],
  ["onboarding", "Onboarding"],
  ["paused", "Paused"],
  ["churned", "Ended"],
  ["internal", "Internal"],
] as const;

/** Add client (no `client`) or Edit client. Ending a client needs an end date and a reason. */
export function ClientFormButton({ people, client, fee, showFee, label, variant = "default" }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [status, setStatus] = useState(client?.status === "terminated" ? "churned" : (client?.status ?? "onboarding"));
  const toast = useToast();
  const router = useRouter();
  const exec = people.filter((p) => p.department === "Client Success");
  const id = client ? `cf-${client.id}` : "cf-new";

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const str = (k: string) => String(fd.get(k) ?? "");
    const input = {
      id: client?.id ?? "",
      name: str("name"),
      site: str("site"),
      services: fd.getAll("services").map(String),
      country: str("country"),
      start_date: str("start_date"),
      channel: str("channel"),
      currency: str("currency"),
      owner_id: str("owner_id"),
      manager_id: str("manager_id"),
      notes: str("notes"),
      monthly_fee: showFee ? str("monthly_fee") : "",
      hours_per_month: showFee ? str("hours_per_month") : "",
      ...(client
        ? { status, end_date: isEnded(status) ? str("end_date") : "", end_reason: isEnded(status) ? str("end_reason") : "" }
        : { contact_name: str("contact_name"), contact_email: str("contact_email") }),
    };
    start(async () => {
      const r = await saveClient(input);
      if (!r.ok) return toast(r.error);
      toast(client ? "Client saved" : "Client added");
      setOpen(false);
      if (!client) router.push(`/clients/${r.id}`);
    });
  }

  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={client ? "Edit client" : "Add client"}
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form={id} disabled={pending}>
              {client ? "Save changes" : "Add client"}
            </Button>
          </>
        }
      >
        <form id={id} onSubmit={submit}>
          <FormGrid>
            <Field label="Client name" htmlFor={`${id}-name`}>
              <input id={`${id}-name`} name="name" required maxLength={120} defaultValue={client?.name} placeholder="e.g. Marina Bay Realty" />
            </Field>
            <Field label="Website" htmlFor={`${id}-site`}>
              <input id={`${id}-site`} name="site" defaultValue={client?.site ?? ""} placeholder="marinabayrealty.ae" />
            </Field>
            <Field label="Services" full>
              <div className="row">
                {SERVICES.map((sv) => (
                  <Checkbox key={sv} name="services" value={sv} label={sv} defaultChecked={client?.services.includes(sv)} />
                ))}
              </div>
            </Field>
            <Field label="Country" htmlFor={`${id}-country`}>
              <select id={`${id}-country`} name="country" defaultValue={client?.country ?? "UAE"}>
                {[...new Set([...COUNTRIES, client?.country].filter(Boolean))].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Start date" htmlFor={`${id}-start`}>
              <input id={`${id}-start`} name="start_date" type="date" defaultValue={client?.start_date ?? ""} />
            </Field>
            <Field label="Main channel" htmlFor={`${id}-channel`}>
              <select id={`${id}-channel`} name="channel" defaultValue={client?.channel ?? "whatsapp"}>
                {Object.entries(CHANNELS).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Currency" htmlFor={`${id}-cur`}>
              <select id={`${id}-cur`} name="currency" defaultValue={client?.currency ?? "AED"}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            {client ? (
              <Field label="Status" htmlFor={`${id}-status`}>
                <select id={`${id}-status`} value={status} onChange={(e) => setStatus(e.target.value)}>
                  {STATUS_OPTS.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            <Field label="Account executive" htmlFor={`${id}-owner`}>
              <select id={`${id}-owner`} name="owner_id" defaultValue={client?.owner_id ?? exec[0]?.id ?? ""}>
                {(exec.length ? exec : people).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Delivery manager" htmlFor={`${id}-mgr`}>
              <select id={`${id}-mgr`} name="manager_id" defaultValue={client?.manager_id ?? ""}>
                <option value="">Not set</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            {showFee ? (
              <>
                <Field label="Monthly fee" htmlFor={`${id}-fee`}>
                  <input id={`${id}-fee`} name="monthly_fee" type="number" min={0} step="0.01" defaultValue={fee?.monthly_fee ?? ""} />
                </Field>
                <Field label="Hours per month" htmlFor={`${id}-hours`}>
                  <input id={`${id}-hours`} name="hours_per_month" type="number" min={0} defaultValue={fee?.hours_per_month ?? ""} />
                </Field>
              </>
            ) : null}
            <Field label="Notes" htmlFor={`${id}-notes`} full>
              <textarea id={`${id}-notes`} name="notes" rows={3} defaultValue={client?.notes ?? ""} placeholder="What they sell, who decides, what worries them" />
            </Field>
            {client ? (
              isEnded(status) ? (
                <>
                  <Field label="End date" htmlFor={`${id}-end`}>
                    <input id={`${id}-end`} name="end_date" type="date" required defaultValue={client.end_date ?? ""} />
                  </Field>
                  <Field label="Reason" htmlFor={`${id}-reason`}>
                    <select id={`${id}-reason`} name="end_reason" required defaultValue={client.end_reason ?? ""}>
                      <option value="" disabled>
                        Choose a reason
                      </option>
                      {[...new Set([...END_REASONS, client.end_reason].filter(Boolean))].map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                  </Field>
                </>
              ) : null
            ) : (
              <>
                <Field label="Main contact name" htmlFor={`${id}-cn`}>
                  <input id={`${id}-cn`} name="contact_name" maxLength={120} />
                </Field>
                <Field label="Main contact email" htmlFor={`${id}-ce`}>
                  <input id={`${id}-ce`} name="contact_email" type="email" placeholder="name@company.com" />
                </Field>
              </>
            )}
          </FormGrid>
        </form>
      </Dialog>
    </>
  );
}

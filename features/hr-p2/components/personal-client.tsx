"use client";

import { useState, useTransition } from "react";
import { Button, Card, CardBody, CardHead, Dialog, EmptyState, Field, FormGrid, Input, Table, Td, Th, useToast } from "@/components/ui";
import { revealPersonal, savePersonal } from "../actions";
import { PERSONAL_FIELD_LABELS, fmtDate } from "../logic";
import type { PersonalChange, PersonalView } from "../types";
import css from "../hr.module.css";

type Props = {
  memberId: string;
  details: PersonalView | null;
  changes: (PersonalChange & { by: string })[];
  canEdit: boolean;
};

type Secrets = Pick<PersonalView, "id_number" | "tax_number" | "iban">;

export function PersonalTabClient({ memberId, details, changes, canEdit }: Props) {
  const [full, setFull] = useState<Secrets | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, start] = useTransition();
  const toast = useToast();
  const v = full ? { ...details, ...full } : details;

  function toggle() {
    if (full) return setFull(null);
    start(async () => {
      const r = await revealPersonal({ memberId });
      if (r.ok && r.data) {
        setFull(r.data);
        setTimeout(() => setFull(null), 30_000); // hide again after 30 seconds
      } else if (!r.ok) toast(r.error);
    });
  }

  return (
    <div className="grid-2">
      <Card>
        <CardHead
          title="Personal details"
          actions={
            <>
              {details ? (
                <Button size="sm" variant="ghost" disabled={busy} onClick={toggle}>
                  {full ? "Hide" : "Show"}
                </Button>
              ) : null}
              {canEdit ? (
                <Button size="sm" onClick={() => setEditing(true)}>
                  Edit
                </Button>
              ) : null}
            </>
          }
        />
        {v ? (
          <CardBody>
            <dl className={css.dl}>
              <dt>Date of birth</dt>
              <dd>{fmtDate(v.date_of_birth) || "Not set"}</dd>
              <dt>{v.id_type}</dt>
              <dd className={css.mono}>{v.id_number ?? "Not set"}</dd>
              <dt>Tax number</dt>
              <dd className={css.mono}>{v.tax_number ?? "Not set"}</dd>
              <dt>Bank</dt>
              <dd>{v.bank_name ?? "Not set"}</dd>
              <dt>IBAN</dt>
              <dd className={css.mono}>{v.iban ?? "Not set"}</dd>
            </dl>
          </CardBody>
        ) : (
          <EmptyState title="No personal details yet" />
        )}
      </Card>

      <Card>
        <CardHead title="Change log" />
        {changes.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Field</Th>
                <Th>Changed by</Th>
                <Th>When</Th>
              </tr>
            </thead>
            <tbody>
              {changes.map((c) => (
                <tr key={c.id}>
                  <Td>{PERSONAL_FIELD_LABELS[c.field] ?? c.field}</Td>
                  <Td>{c.by}</Td>
                  <Td>{fmtDate(c.created_at)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="No changes yet" />
        )}
      </Card>

      {editing ? <EditDialog memberId={memberId} details={details} onClose={() => setEditing(false)} /> : null}
    </div>
  );
}

function EditDialog({ memberId, details, onClose }: { memberId: string; details: PersonalView | null; onClose: () => void }) {
  const [f, setF] = useState({
    dateOfBirth: details?.date_of_birth ?? "",
    idType: details?.id_type ?? "Emirates ID",
    idNumber: "",
    taxNumber: "",
    bankName: details?.bank_name ?? "",
    iban: "",
  });
  const [busy, start] = useTransition();
  const toast = useToast();
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const keep = (saved: string | null | undefined) => (saved ? `Saved as ${saved}. Leave blank to keep.` : undefined);

  function save() {
    start(async () => {
      const r = await savePersonal({ memberId, ...f });
      toast(r.ok ? "Personal details saved" : r.error);
      if (r.ok) onClose();
    });
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Edit personal details"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={busy} onClick={save}>
            Save details
          </Button>
        </>
      }
    >
      <FormGrid>
        <Field label="Date of birth" htmlFor="pd-dob">
          <Input id="pd-dob" type="date" value={f.dateOfBirth} onChange={set("dateOfBirth")} />
        </Field>
        <Field label="ID type" htmlFor="pd-idtype">
          <Input id="pd-idtype" value={f.idType} onChange={set("idType")} />
        </Field>
        <Field label="ID number" htmlFor="pd-id" hint={keep(details?.id_number)}>
          <Input id="pd-id" autoComplete="off" value={f.idNumber} onChange={set("idNumber")} />
        </Field>
        <Field label="Tax number" htmlFor="pd-tax" hint={keep(details?.tax_number)}>
          <Input id="pd-tax" autoComplete="off" value={f.taxNumber} onChange={set("taxNumber")} />
        </Field>
        <Field label="Bank" htmlFor="pd-bank">
          <Input id="pd-bank" value={f.bankName} onChange={set("bankName")} />
        </Field>
        <Field label="IBAN" htmlFor="pd-iban" hint={keep(details?.iban)}>
          <Input id="pd-iban" autoComplete="off" value={f.iban} onChange={set("iban")} />
        </Field>
      </FormGrid>
    </Dialog>
  );
}

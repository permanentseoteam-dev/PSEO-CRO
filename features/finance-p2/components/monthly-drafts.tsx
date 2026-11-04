"use client";

import { useState, useTransition } from "react";
import { FileText } from "lucide-react";
import { Button, Card, CardBody, CardHead, EmptyState, Table, Td, Th, useToast } from "@/components/ui";
import { createMonthlyDrafts } from "../actions";
import { fmtMoney } from "../logic";
import type { DraftPlan } from "../types";

type Props = { month: string; monthName: string; plans: DraftPlan[]; made: number; canCreate: boolean };

/** Invoices > Monthly drafts: draft invoices from agreed fees, one per monthly-billed client. */
export function MonthlyDrafts({ month, monthName, plans, made, canCreate }: Props) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(plans.map((p) => p.clientId)));
  const [busy, start] = useTransition();
  const toast = useToast();
  const all = plans.length > 0 && picked.size === plans.length;

  function toggle(id: string) {
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function create() {
    start(async () => {
      const r = await createMonthlyDrafts({ month, clientIds: [...picked] });
      toast(r.ok ? `${r.created} ${monthName} drafts created` : r.error);
    });
  }

  return (
    <Card>
      <CardHead
        title={`${monthName} drafts from agreed fees`}
        actions={
          canCreate && plans.length ? (
            <Button variant="primary" size="sm" disabled={busy || picked.size === 0} onClick={create}>
              Create {picked.size} drafts
            </Button>
          ) : null
        }
      />
      <CardBody className="small muted">
        {made ? `${made} ${monthName} drafts already made. ` : ""}Review drafts, then issue them from the invoice page.
      </CardBody>
      {plans.length === 0 ? (
        <EmptyState icon={<FileText aria-hidden="true" />} title={`No ${monthName} drafts to make`}>
          Every client billed monthly already has a draft, or none has an agreed fee.
        </EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={all}
                  disabled={!canCreate}
                  onChange={() => setPicked(all ? new Set() : new Set(plans.map((p) => p.clientId)))}
                />
              </Th>
              <Th>Client</Th>
              <Th hideSm>Entity</Th>
              <Th>Title</Th>
              <Th right>Agreed fee</Th>
              <Th right hideSm>
                Tax
              </Th>
              <Th right>Total</Th>
            </tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.clientId}>
                <Td>
                  <input
                    type="checkbox"
                    aria-label={`Include ${p.clientName}`}
                    checked={picked.has(p.clientId)}
                    disabled={!canCreate}
                    onChange={() => toggle(p.clientId)}
                  />
                </Td>
                <Td>
                  {p.clientName}
                  {p.subClientIds.length ? <div className="small muted">Includes {p.subClientIds.length} sub-accounts</div> : null}
                </Td>
                <Td hideSm>{p.entityName}</Td>
                <Td>{p.title}</Td>
                <Td right num>
                  {fmtMoney(p.subtotal, p.currency)}
                </Td>
                <Td right num hideSm>
                  {p.tax ? fmtMoney(p.tax, p.currency) : "—"}
                </Td>
                <Td right num>
                  {fmtMoney(p.total, p.currency)}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}

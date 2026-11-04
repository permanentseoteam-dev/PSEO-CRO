"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { Button, Card, CardHead, EmptyState, Table, Td, Th, useToast } from "@/components/ui";
import { setLeadOutcome } from "../actions";
import { LEAD_OUTCOME_LABEL, LEAD_SOURCE_LABEL, leadsToCsv } from "../logic";
import { LEAD_OUTCOMES, type Lead, type LeadOutcome } from "../types";

export function LeadsTable({ clientId, clientName, leads, canManage }: { clientId: string; clientName: string; leads: Lead[]; canManage: boolean }) {
  const [rows, setRows] = useState(leads);
  const [, start] = useTransition();
  const toast = useToast();

  const change = (lead: Lead, outcome: LeadOutcome) => {
    const before = lead.outcome;
    setRows((r) => r.map((l) => (l.id === lead.id ? { ...l, outcome } : l)));
    start(async () => {
      const res = await setLeadOutcome({ clientId, leadId: lead.id, outcome });
      if (res.ok) return toast(`Outcome set to ${LEAD_OUTCOME_LABEL[outcome]}`);
      setRows((r) => r.map((l) => (l.id === lead.id ? { ...l, outcome: before } : l)));
      toast(res.error);
    });
  };

  const exportCsv = () => {
    const blob = new Blob([leadsToCsv(rows)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${clientName.replace(/[^\w-]+/g, "-").toLowerCase()}-leads.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <Card>
      <CardHead
        title="Leads"
        actions={
          rows.length ? (
            <Button size="sm" onClick={exportCsv}>
              Export CSV
            </Button>
          ) : null
        }
      />
      {rows.length ? (
        <Table>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>Name</Th>
              <Th>Source</Th>
              <Th hideSm>Interest</Th>
              <Th>Outcome</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id}>
                <Td num>{format(new Date(l.receivedAt), "d MMM HH:mm")}</Td>
                <Td>
                  <strong>{l.name}</strong>
                </Td>
                <Td>{LEAD_SOURCE_LABEL[l.source]}</Td>
                <Td hideSm>{l.interest ?? <span className="muted">None given</span>}</Td>
                <Td>
                  {canManage ? (
                    <select aria-label={`Outcome for ${l.name}`} value={l.outcome} onChange={(e) => change(l, e.target.value as LeadOutcome)}>
                      {LEAD_OUTCOMES.map((o) => (
                        <option key={o} value={o}>
                          {LEAD_OUTCOME_LABEL[o]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    LEAD_OUTCOME_LABEL[l.outcome]
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <EmptyState title="No leads yet">Leads from website forms and ads show here once they arrive.</EmptyState>
      )}
    </Card>
  );
}

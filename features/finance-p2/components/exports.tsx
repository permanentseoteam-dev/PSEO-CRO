"use client";

import { useState, useTransition } from "react";
import { Button, Card, CardBody, CardHead, Field, FormGrid, Input, Select, useToast } from "@/components/ui";
import { runExport } from "../actions";
import { fmtDate } from "../logic";
import type { EntityOption, ExportKind, ExportLog } from "../types";

const KIND_LABEL: Record<ExportKind, string> = { invoices: "Invoices", payments: "Payments", aging: "Aging (open invoices)" };

/** Invoices > Exports: CSV for invoices, payments or aging, and the recent exports log. */
export function ExportsPanel({ entities, recent, from, to }: { entities: EntityOption[]; recent: ExportLog[]; from: string; to: string }) {
  const [kind, setKind] = useState<ExportKind>("invoices");
  const [busy, start] = useTransition();
  const toast = useToast();

  function submit(form: HTMLFormElement) {
    const f = new FormData(form);
    start(async () => {
      const r = await runExport({ kind, entityId: f.get("entityId"), from: f.get("from") || f.get("to"), to: f.get("to") });
      if (!r.ok) return toast(r.error);
      const url = URL.createObjectURL(new Blob([r.csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = r.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast(`${r.rows} rows exported`);
    });
  }

  return (
    <div className="stack" style={{ gap: 14 }}>
      <Card>
        <CardHead title="Export for the accountant" />
        <CardBody>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(e.currentTarget);
            }}
          >
            <FormGrid>
              <Field label="What" htmlFor="fp2-ex-kind">
                <Select id="fp2-ex-kind" value={kind} onChange={(e) => setKind(e.target.value as ExportKind)}>
                  {(Object.keys(KIND_LABEL) as ExportKind[]).map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABEL[k]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Entity" htmlFor="fp2-ex-ent">
                <Select id="fp2-ex-ent" name="entityId" defaultValue="">
                  <option value="">All entities</option>
                  {entities.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </Select>
              </Field>
              {kind === "aging" ? null : (
                <Field label="From" htmlFor="fp2-ex-from">
                  <Input id="fp2-ex-from" name="from" type="date" required defaultValue={from} />
                </Field>
              )}
              <Field label={kind === "aging" ? "As of" : "To"} htmlFor="fp2-ex-to">
                <Input id="fp2-ex-to" name="to" type="date" required defaultValue={to} />
              </Field>
              <div className="field full row">
                <Button variant="primary" type="submit" disabled={busy}>
                  Download CSV
                </Button>
              </div>
            </FormGrid>
          </form>
        </CardBody>
      </Card>
      <Card>
        <CardHead title="Recent exports" />
        {recent.length ? (
          <div className="list">
            {recent.map((r) => (
              <div key={r.id} className="item row between">
                <span>
                  {KIND_LABEL[r.kind]}, {r.entity_label ?? "All entities"},{" "}
                  {r.from_date ? `${fmtDate(r.from_date)} to ${fmtDate(r.to_date)}` : `as of ${fmtDate(r.to_date)}`}, {r.row_count} rows
                </span>
                <span className="small muted">
                  {r.by_name ?? "Someone"}, {fmtDate(r.created_at.slice(0, 10))}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <CardBody className="muted small">No exports yet.</CardBody>
        )}
      </Card>
    </div>
  );
}

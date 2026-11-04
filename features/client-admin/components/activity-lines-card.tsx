"use client";

import { useRef, useState, useTransition } from "react";
import { Button, Card, CardHead, Dialog, Field, FormGrid, Input, Select, Table, Td, Th, useToast } from "@/components/ui";
import { addActivityLine, setActivityVisibility } from "../actions";
import { fmtDate, VISIBILITY } from "../logic";
import { VISIBILITIES, type ActivityLine } from "../types";

type Props = { clientId: string; lines: ActivityLine[]; canManage: boolean; today: string };

/** Activity lines the client sees on their portal Home. Only "Shared" lines reach the portal. */
export function ActivityLinesCard({ clientId, lines, canManage, today }: Props) {
  const [adding, setAdding] = useState(false);
  const [busy, start] = useTransition();
  const toast = useToast();

  function setVis(line: ActivityLine, visibility: string) {
    start(async () => {
      const r = await setActivityVisibility({ clientId, lineId: line.id, visibility });
      toast(r.ok ? "Visibility saved" : r.error);
    });
  }

  return (
    <Card>
      <CardHead
        title="Activity lines in the portal"
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setAdding(true)}>
              Add line
            </Button>
          ) : null
        }
      />
      {lines.length ? (
        <Table>
          <thead>
            <tr>
              <Th>Line</Th>
              <Th hideSm>When</Th>
              <Th>Shows as</Th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id}>
                <Td>{l.body}</Td>
                <Td hideSm className="muted">
                  {fmtDate(l.happened_on)}
                </Td>
                <Td>
                  {canManage ? (
                    <Select aria-label="Visibility" value={l.visibility} disabled={busy} onChange={(e) => setVis(l, e.target.value)}>
                      {VISIBILITIES.map((v) => (
                        <option key={v} value={v}>
                          {VISIBILITY[v]}
                        </option>
                      ))}
                    </Select>
                  ) : (
                    VISIBILITY[l.visibility]
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <div className="card-body muted small">No activity lines yet.</div>
      )}
      {adding ? <LineDialog clientId={clientId} today={today} onClose={() => setAdding(false)} /> : null}
    </Card>
  );
}

function LineDialog({ clientId, today, onClose }: { clientId: string; today: string; onClose: () => void }) {
  const [busy, start] = useTransition();
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <Dialog
      open
      onClose={onClose}
      title="Add activity line"
      footer={
        <Button variant="primary" disabled={busy} onClick={() => formRef.current?.requestSubmit()}>
          Add line
        </Button>
      }
    >
      <form
        ref={formRef}
        action={(fd) =>
          start(async () => {
            const r = await addActivityLine({
              clientId,
              body: fd.get("body"),
              happened_on: fd.get("happened_on"),
              visibility: fd.get("visibility"),
            });
            toast(r.ok ? "Line added" : r.error);
            if (r.ok) onClose();
          })
        }
      >
        <FormGrid>
          <Field label="Line" htmlFor="l-body" full>
            <Input id="l-body" name="body" required maxLength={300} placeholder="e.g. 6 new SUV creatives ready for your approval" />
          </Field>
          <Field label="When" htmlFor="l-date">
            <Input id="l-date" name="happened_on" type="date" required defaultValue={today} />
          </Field>
          <Field label="Shows as" htmlFor="l-vis">
            <Select id="l-vis" name="visibility" defaultValue="draft">
              {VISIBILITIES.map((v) => (
                <option key={v} value={v}>
                  {VISIBILITY[v]}
                </option>
              ))}
            </Select>
          </Field>
        </FormGrid>
      </form>
    </Dialog>
  );
}

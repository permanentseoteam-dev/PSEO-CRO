"use client";

import { useState } from "react";
import { Target } from "lucide-react";
import { Button, Card, CardHead, Checkbox, EmptyState, Field, FormGrid, Input, Select, StatCard, Stats, StatusDot, Table, Td, Textarea, Th } from "@/components/ui";
import { addCommitment, logCheckIn } from "../actions";
import { COMMITMENT_STATUS, checkInOverdue, commitmentCounts, shortDate } from "../logic";
import { CADENCES, COMMITMENT_KINDS, COMMITMENT_STATUSES, type CheckIn, type Commitment, type Person } from "../types";
import { FormDialog, formValues, strOrNull, useRun } from "./shared";

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export function CommitmentsView({
  clientId,
  commitments,
  checkins,
  staff,
  canManage,
  today,
}: {
  clientId: string;
  commitments: Commitment[];
  checkins: CheckIn[];
  staff: Person[];
  canManage: boolean;
  today: string;
}) {
  const c = commitmentCounts(commitments);
  const [addOpen, setAddOpen] = useState(false);
  const [checkFor, setCheckFor] = useState<Commitment | null>(null);
  const { pending, run } = useRun();

  return (
    <div className="stack" style={{ gap: 16 }}>
      <Stats>
        <StatCard label="Commitments" value={c.total} />
        <StatCard label="Met" value={c.met} tone="ok" />
        <StatCard label="On track" value={c.on_track} />
        <StatCard label="At risk" value={c.at_risk} tone={c.at_risk ? "warn" : undefined} />
        <StatCard label="Missed" value={c.missed} tone={c.missed ? "danger" : undefined} />
      </Stats>

      <Card>
        <CardHead
          title="Commitments"
          actions={
            canManage ? (
              <Button size="sm" variant="primary" onClick={() => setAddOpen(true)}>
                Add commitment
              </Button>
            ) : null
          }
        />
        {commitments.length === 0 ? (
          <EmptyState icon={<Target />} title="No commitments yet">
            Add the KPIs, deliverables and milestones you promised this client.
          </EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Commitment</Th>
                <Th hideSm>Kind</Th>
                <Th hideSm>Cadence</Th>
                <Th>Target</Th>
                <Th>Latest</Th>
                <Th>Status</Th>
                <Th hideSm>Last check-in</Th>
                {canManage ? <Th /> : null}
              </tr>
            </thead>
            <tbody>
              {commitments.map((x) => {
                const s = COMMITMENT_STATUS[x.status];
                const late = checkInOverdue(x.cadence, x.last_checkin_on, today);
                return (
                  <tr key={x.id}>
                    <Td>
                      <strong>{x.title}</strong>
                      {x.owner ? <div className="small muted">{x.owner.name}{x.client_visible ? "" : " · hidden from client"}</div> : null}
                    </Td>
                    <Td hideSm>{x.kind}</Td>
                    <Td hideSm>{cap(x.cadence)}</Td>
                    <Td>{x.target}</Td>
                    <Td>{x.latest ?? <span className="muted">None yet</span>}</Td>
                    <Td>
                      <StatusDot tone={s.tone}>{s.label}</StatusDot>
                    </Td>
                    <Td hideSm className={late ? "t-warn" : undefined}>
                      {x.last_checkin_on ? shortDate(x.last_checkin_on, today) : "Never"}
                    </Td>
                    {canManage ? (
                      <Td right>
                        <Button size="sm" onClick={() => setCheckFor(x)}>
                          Log check-in
                        </Button>
                      </Td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHead title="Recent check-ins" />
        {checkins.length === 0 ? (
          <p className="card-body small muted" style={{ margin: 0 }}>
            No check-ins yet.
          </p>
        ) : (
          <div className="list">
            {checkins.map((k) => (
              <div key={k.id} className="item">
                <div className="stack" style={{ gap: 2, width: "100%", minWidth: 0 }}>
                  <div className="between">
                    <strong>{k.commitment_title}</strong>
                    <span className="small muted">
                      {shortDate(k.checked_on, today)}
                      {k.by ? ` · ${k.by.name}` : ""}
                    </span>
                  </div>
                  <span className="small">
                    {[k.value, COMMITMENT_STATUS[k.status].label + ".", k.note].filter(Boolean).join(" ")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <FormDialog
        id="cs-commit-add"
        title="Add commitment"
        submitLabel="Add commitment"
        pending={pending}
        open={addOpen}
        setOpen={setAddOpen}
        onSubmit={(e) => {
          const v = formValues(e);
          run(
            () => addCommitment({ clientId, title: v.title, kind: v.kind, cadence: v.cadence, target: v.target, owner_id: strOrNull(v.owner_id), client_visible: v.client_visible }),
            "Commitment added",
            () => setAddOpen(false),
          );
        }}
      >
        <FormGrid>
          <Field label="Commitment" htmlFor="cs-c-title" full>
            <Input id="cs-c-title" name="title" required maxLength={200} placeholder="e.g. 20 Google reviews a month" />
          </Field>
          <Field label="Kind" htmlFor="cs-c-kind">
            <Select id="cs-c-kind" name="kind" defaultValue="kpi">
              {COMMITMENT_KINDS.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </Select>
          </Field>
          <Field label="Cadence" htmlFor="cs-c-cadence">
            <Select id="cs-c-cadence" name="cadence" defaultValue="monthly">
              {CADENCES.map((k) => (
                <option key={k} value={k}>
                  {cap(k)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Target" htmlFor="cs-c-target">
            <Input id="cs-c-target" name="target" maxLength={100} />
          </Field>
          <Field label="Owner" htmlFor="cs-c-owner">
            <Select id="cs-c-owner" name="owner_id" defaultValue="">
              <option value="">No owner</option>
              {staff.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="field full">
            <Checkbox name="client_visible" label="Show to the client in the portal" defaultChecked />
          </div>
        </FormGrid>
      </FormDialog>

      <FormDialog
        id="cs-commit-checkin"
        title="Log check-in"
        submitLabel="Save check-in"
        pending={pending}
        open={!!checkFor}
        setOpen={(o) => !o && setCheckFor(null)}
        onSubmit={(e) => {
          const v = formValues(e);
          if (!checkFor) return;
          run(
            () => logCheckIn({ clientId, commitment_id: checkFor.id, value: v.value, status: v.status, note: v.note, checked_on: v.checked_on }),
            "Check-in saved",
            () => setCheckFor(null),
          );
        }}
      >
        {checkFor ? (
          <FormGrid>
            <Field label="Commitment" full>
              <strong>{checkFor.title}</strong>
            </Field>
            <Field label="Latest value" htmlFor="cs-k-value">
              <Input id="cs-k-value" name="value" defaultValue={checkFor.latest ?? ""} maxLength={100} />
            </Field>
            <Field label="Status" htmlFor="cs-k-status">
              <Select id="cs-k-status" name="status" defaultValue={checkFor.status}>
                {COMMITMENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {COMMITMENT_STATUS[s].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Date" htmlFor="cs-k-date">
              <Input id="cs-k-date" name="checked_on" type="date" defaultValue={today} max={today} required />
            </Field>
            <Field label="Note" htmlFor="cs-k-note" full>
              <Textarea id="cs-k-note" name="note" rows={2} />
            </Field>
          </FormGrid>
        ) : null}
      </FormDialog>
    </div>
  );
}

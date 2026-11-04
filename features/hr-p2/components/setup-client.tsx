"use client";

import { useState, useTransition } from "react";
import { Button, Card, CardBody, CardHead, Dialog, EmptyState, Field, FormGrid, Input, Select, StatusDot, Table, Td, Textarea, Th, useToast } from "@/components/ui";
import { assignPath, createCycle, createPath, saveKpi, setCycleStatus, setKpiActive } from "../actions";
import { KPI_DIRECTION_LABEL, KPI_SOURCE_LABEL, fmtDate, kpiWeightTotal } from "../logic";
import { KPI_DIRECTIONS, KPI_SOURCES, type Kpi, type Option, type ReviewCycle, type TrainingPath } from "../types";

type Props = { kpis: Kpi[]; paths: TrainingPath[]; cycles: ReviewCycle[]; departments: Option[]; staff: Option[]; canEdit: boolean };

export function SetupTabClient({ kpis, paths, cycles, departments, staff, canEdit }: Props) {
  const [kpiEdit, setKpiEdit] = useState<Kpi | "new" | null>(null);
  const [pathOpen, setPathOpen] = useState(false);
  const [assignFor, setAssignFor] = useState<TrainingPath | null>(null);
  const [cycleOpen, setCycleOpen] = useState(false);
  const [checkDept, setCheckDept] = useState(departments[0]?.id ?? "");
  const [busy, start] = useTransition();
  const toast = useToast();
  const deptName = (id: string | null) => (id ? (departments.find((d) => d.id === id)?.name ?? "") : "Everyone");
  const total = kpiWeightTotal(kpis, checkDept || null);

  function toggleKpi(k: Kpi) {
    start(async () => {
      const r = await setKpiActive({ id: k.id, active: !k.active });
      toast(r.ok ? (k.active ? "KPI turned off" : "KPI turned on") : r.error);
    });
  }

  function toggleCycle(c: ReviewCycle) {
    const open = c.status === "open";
    if (!window.confirm(open ? `Close ${c.name}? Reviews can't be started after this.` : `Reopen ${c.name}?`)) return;
    start(async () => {
      const r = await setCycleStatus({ id: c.id, status: open ? "closed" : "open" });
      toast(r.ok ? (open ? "Review cycle closed" : "Review cycle opened") : r.error);
    });
  }

  return (
    <div className="stack" style={{ gap: 16 }}>
      <Card>
        <CardHead
          title="KPIs"
          actions={
            canEdit ? (
              <Button size="sm" onClick={() => setKpiEdit("new")}>
                Add KPI
              </Button>
            ) : null
          }
        />
        {kpis.length ? (
          <Table>
            <thead>
              <tr>
                <Th>KPI</Th>
                <Th>Source</Th>
                <Th right>Weight</Th>
                <Th hideSm>Direction</Th>
                <Th>Applies to</Th>
                {canEdit ? <Th aria-label="Actions" /> : null}
              </tr>
            </thead>
            <tbody>
              {kpis.map((k) => (
                <tr key={k.id} className={k.active ? undefined : "muted"}>
                  <Td>{k.active ? k.name : <StatusDot tone="muted">{`${k.name} (off)`}</StatusDot>}</Td>
                  <Td>{KPI_SOURCE_LABEL[k.source]}</Td>
                  <Td right num>
                    {k.weight}%
                  </Td>
                  <Td hideSm>{KPI_DIRECTION_LABEL[k.direction]}</Td>
                  <Td>{deptName(k.department_id)}</Td>
                  {canEdit ? (
                    <Td right>
                      <div className="row" style={{ justifyContent: "flex-end" }}>
                        <Button size="sm" variant="ghost" onClick={() => setKpiEdit(k)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => toggleKpi(k)}>
                          {k.active ? "Turn off" : "Turn on"}
                        </Button>
                      </div>
                    </Td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="No KPIs yet" />
        )}
        {kpis.length && departments.length ? (
          <CardBody className="row" style={{ flexWrap: "wrap" }}>
            <label htmlFor="kpi-check">Weights for</label>
            <Select id="kpi-check" value={checkDept} onChange={(e) => setCheckDept(e.target.value)}>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
            {total === 100 ? <StatusDot tone="ok">Adds up to 100%</StatusDot> : <StatusDot tone="warn">{`Adds up to ${total}%`}</StatusDot>}
          </CardBody>
        ) : null}
      </Card>

      <Card>
        <CardHead
          title="Training paths"
          actions={
            canEdit ? (
              <Button size="sm" onClick={() => setPathOpen(true)}>
                New path
              </Button>
            ) : null
          }
        />
        {paths.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Path</Th>
                <Th right>Steps</Th>
                <Th right>Assigned</Th>
                <Th right>Finished</Th>
                <Th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {paths.map((p) => (
                <tr key={p.id}>
                  <Td>{p.name}</Td>
                  <Td right num>
                    {p.steps.length}
                  </Td>
                  <Td right num>
                    {p.assigned}
                  </Td>
                  <Td right num>
                    {p.finished}
                  </Td>
                  <Td right>
                    <Button size="sm" variant="ghost" onClick={() => setAssignFor(p)}>
                      Assign
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="No training paths yet" />
        )}
      </Card>

      <Card>
        <CardHead
          title="Review cycles"
          actions={
            canEdit ? (
              <Button size="sm" onClick={() => setCycleOpen(true)}>
                New cycle
              </Button>
            ) : null
          }
        />
        {cycles.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Cycle</Th>
                <Th>Self-review due</Th>
                <Th>Manager review due</Th>
                <Th>Status</Th>
                {canEdit ? <Th aria-label="Actions" /> : null}
              </tr>
            </thead>
            <tbody>
              {cycles.map((c) => (
                <tr key={c.id}>
                  <Td>{c.name}</Td>
                  <Td>{fmtDate(c.self_due)}</Td>
                  <Td>{fmtDate(c.manager_due)}</Td>
                  <Td>{c.status === "open" ? <StatusDot tone="ok">Open</StatusDot> : <StatusDot tone="muted">Closed</StatusDot>}</Td>
                  {canEdit ? (
                    <Td right>
                      <Button size="sm" disabled={busy} onClick={() => toggleCycle(c)}>
                        {c.status === "open" ? "Close cycle" : "Reopen cycle"}
                      </Button>
                    </Td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="No review cycles yet" />
        )}
      </Card>

      {kpiEdit ? <KpiDialog kpi={kpiEdit === "new" ? null : kpiEdit} departments={departments} onClose={() => setKpiEdit(null)} /> : null}
      {pathOpen ? <PathDialog onClose={() => setPathOpen(false)} /> : null}
      {assignFor ? <AssignDialog path={assignFor} staff={staff} onClose={() => setAssignFor(null)} /> : null}
      {cycleOpen ? <CycleDialog onClose={() => setCycleOpen(false)} /> : null}
    </div>
  );
}

function useSave(onClose: () => void) {
  const [busy, start] = useTransition();
  const toast = useToast();
  const save = (fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) =>
    start(async () => {
      const r = await fn();
      toast(r.ok ? msg : (r.error ?? "Something went wrong."));
      if (r.ok) onClose();
    });
  return { busy, save };
}

function Foot({ busy, label, onClose, onSave, disabled }: { busy: boolean; label: string; onClose: () => void; onSave: () => void; disabled?: boolean }) {
  return (
    <>
      <Button variant="ghost" onClick={onClose}>
        Cancel
      </Button>
      <Button variant="primary" disabled={busy || disabled} onClick={onSave}>
        {label}
      </Button>
    </>
  );
}

function KpiDialog({ kpi, departments, onClose }: { kpi: Kpi | null; departments: Option[]; onClose: () => void }) {
  const [f, setF] = useState({
    name: kpi?.name ?? "",
    source: kpi?.source ?? "manual",
    weight: String(kpi?.weight ?? 10),
    direction: kpi?.direction ?? "higher",
    departmentId: kpi?.department_id ?? "",
  });
  const { busy, save } = useSave(onClose);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const label = kpi ? "Save KPI" : "Add KPI";
  return (
    <Dialog
      open
      onClose={onClose}
      title={kpi ? "Edit KPI" : "Add KPI"}
      footer={<Foot busy={busy} label={label} onClose={onClose} disabled={!f.name.trim()} onSave={() => save(() => saveKpi({ id: kpi?.id, ...f, departmentId: f.departmentId || null }), kpi ? "KPI saved" : "KPI added")} />}
    >
      <FormGrid>
        <Field label="Name" htmlFor="kpi-name" full>
          <Input id="kpi-name" value={f.name} onChange={set("name")} />
        </Field>
        <Field label="Source" htmlFor="kpi-src">
          <Select id="kpi-src" value={f.source} onChange={set("source")}>
            {KPI_SOURCES.map((s) => (
              <option key={s} value={s}>
                {KPI_SOURCE_LABEL[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Weight %" htmlFor="kpi-w">
          <Input id="kpi-w" type="number" min={1} max={100} value={f.weight} onChange={set("weight")} />
        </Field>
        <Field label="Direction" htmlFor="kpi-dir">
          <Select id="kpi-dir" value={f.direction} onChange={set("direction")}>
            {KPI_DIRECTIONS.map((d) => (
              <option key={d} value={d}>
                {KPI_DIRECTION_LABEL[d]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Applies to" htmlFor="kpi-dept">
          <Select id="kpi-dept" value={f.departmentId} onChange={set("departmentId")}>
            <option value="">Everyone</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </Field>
      </FormGrid>
    </Dialog>
  );
}

function PathDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("");
  const [steps, setSteps] = useState("Course: \nVideo: \nPractice: ");
  const { busy, save } = useSave(onClose);
  return (
    <Dialog
      open
      onClose={onClose}
      title="New training path"
      footer={<Foot busy={busy} label="Create path" onClose={onClose} disabled={!name.trim()} onSave={() => save(() => createPath({ name, steps }), "Path created")} />}
    >
      <FormGrid>
        <Field label="Name" htmlFor="path-name" full>
          <Input id="path-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Steps, one per line" htmlFor="path-steps" hint="Course, Video, Reading, Practice or Certification, then a colon and the step." full>
          <Textarea id="path-steps" rows={6} value={steps} onChange={(e) => setSteps(e.target.value)} />
        </Field>
      </FormGrid>
    </Dialog>
  );
}

function AssignDialog({ path, staff, onClose }: { path: TrainingPath; staff: Option[]; onClose: () => void }) {
  const [memberId, setMemberId] = useState(staff[0]?.id ?? "");
  const { busy, save } = useSave(onClose);
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Assign ${path.name}`}
      footer={<Foot busy={busy} label="Assign path" onClose={onClose} disabled={!memberId} onSave={() => save(() => assignPath({ pathId: path.id, memberId }), "Path assigned")} />}
    >
      <FormGrid>
        <Field label="Person" htmlFor="assign-who" full>
          <Select id="assign-who" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
      </FormGrid>
    </Dialog>
  );
}

function CycleDialog({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState({ name: "", selfDue: "", managerDue: "" });
  const { busy, save } = useSave(onClose);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <Dialog
      open
      onClose={onClose}
      title="New review cycle"
      footer={<Foot busy={busy} label="Open cycle" onClose={onClose} disabled={!f.name.trim() || !f.selfDue || !f.managerDue} onSave={() => save(() => createCycle(f), "Review cycle opened")} />}
    >
      <FormGrid>
        <Field label="Name" htmlFor="cyc-name" full>
          <Input id="cyc-name" placeholder="e.g. Q1 2027" value={f.name} onChange={set("name")} />
        </Field>
        <Field label="Self-review due" htmlFor="cyc-self">
          <Input id="cyc-self" type="date" value={f.selfDue} onChange={set("selfDue")} />
        </Field>
        <Field label="Manager review due" htmlFor="cyc-mgr">
          <Input id="cyc-mgr" type="date" value={f.managerDue} onChange={set("managerDue")} />
        </Field>
      </FormGrid>
    </Dialog>
  );
}

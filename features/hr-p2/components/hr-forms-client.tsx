"use client";

import { useState, useTransition } from "react";
import { Button, Card, CardBody, CardHead, Checkbox, Dialog, Field, FormGrid, Input, Select, StatusDot, useToast } from "@/components/ui";
import { probationAction, saveHrDetails, saveTitleChange } from "../actions";
import { PROBATION_EXTENSIONS, PROBATION_LABEL, fmtDate, hm, localDate } from "../logic";
import { CONTRACTS, TITLE_CHANGE_KINDS, type Contract, type Employment, type Option, type TitleChangeKind } from "../types";
import css from "../hr.module.css";

type Member = { id: string; name: string; title: string | null; department_id: string | null; manager_id: string | null };

const CONTRACT_LABEL: Record<Contract, string> = { full_time: "Full time", part_time: "Part time", contractor: "Contractor" };
const KIND_LABEL: Record<TitleChangeKind, string> = { promotion: "Promotion", transfer: "Transfer", title: "Title only" };

export function HrFormButtonsClient({ member, employment, departments, staff }: { member: Member; employment: Employment | null; departments: Option[]; staff: Option[] }) {
  const [open, setOpen] = useState<"hr" | "title" | null>(null);
  return (
    <>
      <Button onClick={() => setOpen("hr")}>Edit HR details</Button>
      <Button onClick={() => setOpen("title")}>Title change</Button>
      {open === "hr" ? <HrDialog member={member} employment={employment} departments={departments} staff={staff} onClose={() => setOpen(null)} /> : null}
      {open === "title" ? <TitleDialog member={member} departments={departments} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

function Foot({ busy, label, onClose, onSave }: { busy: boolean; label: string; onClose: () => void; onSave: () => void }) {
  return (
    <>
      <Button variant="ghost" onClick={onClose}>
        Cancel
      </Button>
      <Button variant="primary" disabled={busy} onClick={onSave}>
        {label}
      </Button>
    </>
  );
}

function HrDialog({ member, employment, departments, staff, onClose }: { member: Member; employment: Employment | null; departments: Option[]; staff: Option[]; onClose: () => void }) {
  const [f, setF] = useState({
    title: member.title ?? "",
    departmentId: member.department_id ?? "",
    managerId: member.manager_id ?? "",
    contract: employment?.contract ?? ("full_time" as Contract),
    joinedOn: employment?.joined_on ?? "",
    shiftStart: hm(employment?.shift_start ?? "09:00"),
    shiftEnd: hm(employment?.shift_end ?? "18:00"),
    location: employment?.location ?? "",
  });
  const [busy, start] = useTransition();
  const toast = useToast();
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  function save() {
    start(async () => {
      const r = await saveHrDetails({ memberId: member.id, ...f, departmentId: f.departmentId || null, managerId: f.managerId || null });
      toast(r.ok ? "HR details saved" : r.error);
      if (r.ok) onClose();
    });
  }

  return (
    <Dialog open onClose={onClose} title="Edit HR details" footer={<Foot busy={busy} label="Save details" onClose={onClose} onSave={save} />}>
      <FormGrid>
        <Field label="Title" htmlFor="hr-title">
          <Input id="hr-title" value={f.title} onChange={set("title")} />
        </Field>
        <Field label="Department" htmlFor="hr-dept">
          <Select id="hr-dept" value={f.departmentId} onChange={set("departmentId")}>
            <option value="">None</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Manager" htmlFor="hr-mgr">
          <Select id="hr-mgr" value={f.managerId} onChange={set("managerId")}>
            <option value="">None</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Contract" htmlFor="hr-contract">
          <Select id="hr-contract" value={f.contract} onChange={set("contract")}>
            {CONTRACTS.map((c) => (
              <option key={c} value={c}>
                {CONTRACT_LABEL[c]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Shift starts" htmlFor="hr-s1">
          <Input id="hr-s1" type="time" value={f.shiftStart} onChange={set("shiftStart")} />
        </Field>
        <Field label="Shift ends" htmlFor="hr-s2">
          <Input id="hr-s2" type="time" value={f.shiftEnd} onChange={set("shiftEnd")} />
        </Field>
        <Field label="Joined" htmlFor="hr-joined">
          <Input id="hr-joined" type="date" value={f.joinedOn} onChange={set("joinedOn")} />
        </Field>
        <Field label="Location" htmlFor="hr-loc">
          <Input id="hr-loc" placeholder="e.g. Dubai office" value={f.location} onChange={set("location")} />
        </Field>
      </FormGrid>
    </Dialog>
  );
}

function TitleDialog({ member, departments, onClose }: { member: Member; departments: Option[]; onClose: () => void }) {
  const [kind, setKind] = useState<TitleChangeKind>("promotion");
  const [effectiveOn, setEffectiveOn] = useState(localDate(new Date()));
  const [newTitle, setNewTitle] = useState(member.title ?? "");
  const [dept, setDept] = useState(member.department_id ?? "");
  const [congrats, setCongrats] = useState(true);
  const [busy, start] = useTransition();
  const toast = useToast();

  function save() {
    start(async () => {
      const r = await saveTitleChange({ memberId: member.id, kind, effectiveOn, newTitle, newDepartmentId: dept || null, postCongrats: congrats });
      if (!r.ok) return toast(r.error);
      toast(r.data?.applied ? "Title changed" : `Saved. It takes effect on ${fmtDate(effectiveOn)}.`);
      onClose();
    });
  }

  return (
    <Dialog open onClose={onClose} title="Title change" footer={<Foot busy={busy} label="Save title change" onClose={onClose} onSave={save} />}>
      <FormGrid>
        <Field label="Type" htmlFor="tc-kind">
          <Select id="tc-kind" value={kind} onChange={(e) => setKind(e.target.value as TitleChangeKind)}>
            {TITLE_CHANGE_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Effective from" htmlFor="tc-date">
          <Input id="tc-date" type="date" value={effectiveOn} onChange={(e) => setEffectiveOn(e.target.value)} />
        </Field>
        <Field label="New title" htmlFor="tc-title">
          <Input id="tc-title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
        </Field>
        <Field label="New department" htmlFor="tc-dept">
          <Select id="tc-dept" value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">None</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </Field>
        <Checkbox className="field full" label="Post a congratulations message in #general" checked={congrats} onChange={(e) => setCongrats(e.target.checked)} />
      </FormGrid>
    </Dialog>
  );
}

export function ProbationCardClient({ employment, decidedBy, canDecide }: { employment: Employment; decidedBy: string | null; canDecide: boolean }) {
  const [busy, start] = useTransition();
  const toast = useToast();
  const st = PROBATION_LABEL[employment.probation_status];
  const live = employment.probation_status === "on_probation";

  function act(action: "confirm" | "extend" | "end", days?: number) {
    const ask = action === "confirm" ? "Confirm their probation?" : action === "end" ? "End their employment at probation?" : `Extend probation by ${days} days?`;
    if (!window.confirm(ask)) return;
    start(async () => {
      const r = await probationAction({ memberId: employment.member_id, action, days });
      toast(r.ok ? (action === "confirm" ? "Probation confirmed" : action === "end" ? "Probation ended" : `Extended by ${days} days`) : r.error);
    });
  }

  return (
    <Card>
      <CardHead title="Probation" actions={<StatusDot tone={st.tone}>{st.label}</StatusDot>} />
      <CardBody className="stack">
        <dl className={css.dl}>
          <dt>Started</dt>
          <dd>{fmtDate(employment.probation_start) || "Not set"}</dd>
          <dt>{live ? "Ends" : "Ended"}</dt>
          <dd>{fmtDate(employment.probation_end) || "Not set"}</dd>
          {decidedBy ? (
            <>
              <dt>{employment.probation_status === "confirmed" ? "Confirmed by" : "Decided by"}</dt>
              <dd>{decidedBy}</dd>
            </>
          ) : null}
        </dl>
        {canDecide && live ? (
          <div className="row" style={{ flexWrap: "wrap" }}>
            <Button size="sm" disabled={busy} onClick={() => act("confirm")}>
              Confirm
            </Button>
            {PROBATION_EXTENSIONS.map((d) => (
              <Button key={d} size="sm" disabled={busy} onClick={() => act("extend", d)}>
                Extend +{d}
              </Button>
            ))}
            <Button size="sm" variant="danger" disabled={busy} onClick={() => act("end")}>
              End
            </Button>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

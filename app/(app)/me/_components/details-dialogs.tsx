"use client";

import { useState, useTransition, type FormEvent } from "react";
import { Button, Dialog, Field, FormGrid, Input, Select, Textarea, useToast } from "@/components/ui";
import { saveHrDetails, saveMyDetails } from "../actions";

type Mine = { bio: string; skills: string; phone: string; linkedin: string; emergencyName: string; emergencyPhone: string };

export function EditMyDetails({ initial }: { initial: Mine }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    start(async () => {
      const r = await saveMyDetails(f);
      if (!r.ok) return toast(r.error);
      setOpen(false);
      toast("Your details are saved");
    });
  }

  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)}>
        Edit my details
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Edit my details"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" form="me-edit" disabled={pending}>Save</Button>
          </>
        }
      >
        <form id="me-edit" onSubmit={submit}>
          <FormGrid>
            <Field label="Bio" htmlFor="me-bio" full>
              <Textarea id="me-bio" name="bio" rows={3} maxLength={2000} defaultValue={initial.bio} />
            </Field>
            <Field label="Skills" htmlFor="me-skills" hint="Separate with commas" full>
              <Input id="me-skills" name="skills" maxLength={500} defaultValue={initial.skills} />
            </Field>
            <Field label="Phone" htmlFor="me-phone">
              <Input id="me-phone" name="phone" type="tel" maxLength={40} defaultValue={initial.phone} />
            </Field>
            <Field label="LinkedIn" htmlFor="me-li">
              <Input id="me-li" name="linkedin" maxLength={200} defaultValue={initial.linkedin} />
            </Field>
            <Field label="Emergency contact name" htmlFor="me-en">
              <Input id="me-en" name="emergencyName" maxLength={100} defaultValue={initial.emergencyName} />
            </Field>
            <Field label="Emergency contact phone" htmlFor="me-ep">
              <Input id="me-ep" name="emergencyPhone" type="tel" maxLength={40} defaultValue={initial.emergencyPhone} />
            </Field>
          </FormGrid>
        </form>
      </Dialog>
    </>
  );
}

type Hr = {
  memberId: string;
  title: string;
  departmentId: string;
  managerId: string;
  shift: string;
  joinedOn: string;
  contract: string;
  location: string;
};

export function EditHrDetails({ initial, departments, people }: { initial: Hr; departments: { id: string; name: string }[]; people: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    start(async () => {
      const r = await saveHrDetails({
        memberId: initial.memberId,
        title: f.title,
        departmentId: f.departmentId || null,
        managerId: f.managerId || null,
        shift: f.shift,
        joinedOn: f.joinedOn || null,
        contract: f.contract,
        location: f.location,
      });
      if (!r.ok) return toast(r.error);
      setOpen(false);
      toast("HR details saved");
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>Edit HR details</Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Edit HR details"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" form="me-hr" disabled={pending}>Save</Button>
          </>
        }
      >
        <form id="me-hr" onSubmit={submit}>
          <FormGrid>
            <Field label="Title" htmlFor="hr-title">
              <Input id="hr-title" name="title" maxLength={120} defaultValue={initial.title} />
            </Field>
            <Field label="Department" htmlFor="hr-dept">
              <Select id="hr-dept" name="departmentId" defaultValue={initial.departmentId}>
                <option value="">None</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Manager" htmlFor="hr-mgr">
              <Select id="hr-mgr" name="managerId" defaultValue={initial.managerId}>
                <option value="">None</option>
                {people.filter((p) => p.id !== initial.memberId).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Shift" htmlFor="hr-shift">
              <Input id="hr-shift" name="shift" maxLength={60} defaultValue={initial.shift} />
            </Field>
            <Field label="Joined" htmlFor="hr-joined">
              <Input id="hr-joined" name="joinedOn" type="date" defaultValue={initial.joinedOn} />
            </Field>
            <Field label="Contract" htmlFor="hr-contract">
              <Select id="hr-contract" name="contract" defaultValue={initial.contract}>
                <option value="full_time">Full time</option>
                <option value="part_time">Part time</option>
                <option value="contractor">Contractor</option>
              </Select>
            </Field>
            <Field label="Location" htmlFor="hr-loc">
              <Input id="hr-loc" name="location" maxLength={100} defaultValue={initial.location} />
            </Field>
          </FormGrid>
        </form>
      </Dialog>
    </>
  );
}

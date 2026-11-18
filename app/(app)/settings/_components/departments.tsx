"use client";

import { useState, useTransition } from "react";
import { Button, Dialog, Field, Input, Select, Table, Td, Th, useToast } from "@/components/ui";
import { addDepartment, deleteDepartment, departmentUsage, updateDepartment } from "@/lib/modules/departments/actions";
import { DepartmentName, deleteWarning, duplicateError, isDuplicateName, type Department } from "@/lib/modules/departments/logic";

type Staff = { id: string; name: string };
type Draft = { id?: string; name: string; headId: string };

/** Admin: list, add, rename and delete departments, and pick each one's head. */
export function DepartmentsManager({ departments, staff }: { departments: Department[]; staff: Staff[] }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const names = new Map(staff.map((s) => [s.id, s.name]));

  const parsed = draft ? DepartmentName.safeParse(draft.name) : null;
  const problem = !draft
    ? null
    : !parsed?.success
      ? (parsed?.error.issues[0]?.message ?? null)
      : isDuplicateName(draft.name, departments, draft.id)
        ? duplicateError(draft.name)
        : null;

  function save() {
    if (!draft || problem) return;
    const input = { name: draft.name, headId: draft.headId || null };
    start(async () => {
      const r = draft.id ? await updateDepartment(draft.id, input) : await addDepartment(input);
      toast(r.ok ? (draft.id ? "Department saved" : "Department added") : r.error);
      if (r.ok) setDraft(null);
    });
  }

  function remove(d: Department) {
    start(async () => {
      const u = await departmentUsage(d.id);
      if (!u.ok) return toast(u.error);
      if (!window.confirm(deleteWarning(d.name, u.usage))) return;
      const r = await deleteDepartment(d.id);
      toast(r.ok ? `Deleted "${d.name}"` : r.error);
    });
  }

  return (
    <div className="stack">
      <Table>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Head</Th>
            <Th right>Actions</Th>
          </tr>
        </thead>
        <tbody>
          {departments.map((d) => (
            <tr key={d.id}>
              <Td>{d.name}</Td>
              <Td className="muted">{(d.headId && names.get(d.headId)) || "None"}</Td>
              <Td right>
                <div className="row justify-end">
                  <Button size="sm" disabled={pending} onClick={() => setDraft({ id: d.id, name: d.name, headId: d.headId ?? "" })}>
                    Edit
                  </Button>
                  <Button size="sm" variant="danger" disabled={pending} onClick={() => remove(d)}>
                    Delete
                  </Button>
                </div>
              </Td>
            </tr>
          ))}
          {departments.length === 0 ? (
            <tr>
              <Td colSpan={3} className="muted">
                No departments yet.
              </Td>
            </tr>
          ) : null}
        </tbody>
      </Table>
      <div className="row">
        <Button variant="primary" disabled={pending} onClick={() => setDraft({ name: "", headId: "" })}>
          Add department
        </Button>
      </div>

      <Dialog
        open={!!draft}
        onClose={() => setDraft(null)}
        title={draft?.id ? "Edit department" : "Add department"}
        footer={
          <>
            <Button onClick={() => setDraft(null)}>Cancel</Button>
            <Button variant="primary" disabled={pending || !!problem} onClick={save}>
              {draft?.id ? "Save" : "Add"}
            </Button>
          </>
        }
      >
        {draft ? (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <Field label="Name" htmlFor="dept-name">
              <Input id="dept-name" value={draft.name} maxLength={60} autoFocus onChange={(e) => setDraft({ ...draft, name: e.currentTarget.value })} />
            </Field>
            <Field label="Head" htmlFor="dept-head">
              <Select id="dept-head" value={draft.headId} onChange={(e) => setDraft({ ...draft, headId: e.currentTarget.value })}>
                <option value="">None</option>
                {draft.headId && !names.has(draft.headId) ? <option value={draft.headId}>Current head (inactive)</option> : null}
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            {problem && draft.name.trim() ? (
              <p role="alert" className="m-0 text-danger">
                {problem}
              </p>
            ) : null}
          </form>
        ) : null}
      </Dialog>
    </div>
  );
}

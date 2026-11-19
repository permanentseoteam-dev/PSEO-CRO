"use client";

import { useState, useTransition } from "react";
import { Button, Card, CardBody, Dialog, Field, Input, Select, Table, Td, Th, useToast } from "@/components/ui";
import { cn } from "@/lib/utils";
import { addDepartment, deleteDepartment, departmentUsage, setDepartmentMembers, updateDepartment } from "@/lib/modules/departments/actions";
import { DepartmentName, deleteWarning, duplicateError, isDuplicateName, type Department, type DepartmentStats } from "@/lib/modules/departments/logic";

type Staff = { id: string; name: string; departmentId?: string | null };
type Draft = { id?: string; name: string; headId: string; memberIds: string[] };

type Props = { departments: Department[]; staff: Staff[]; view?: "list" | "board"; stats?: Record<string, DepartmentStats> };

/** Admin: list, add, rename and delete departments, and pick each one's head. Board view shows them as cards with counts. */
export function DepartmentsManager({ departments, staff, view = "list", stats }: Props) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const names = new Map(staff.map((s) => [s.id, s.name]));
  const deptNames = new Map(departments.map((d) => [d.id, d.name]));
  const membersOf = (deptId: string) => staff.filter((s) => s.departmentId === deptId).map((s) => s.id);
  const edit = (d: Department) => setDraft({ id: d.id, name: d.name, headId: d.headId ?? "", memberIds: membersOf(d.id) });
  const toggleMember = (id: string) =>
    draft && setDraft({ ...draft, memberIds: draft.memberIds.includes(id) ? draft.memberIds.filter((m) => m !== id) : [...draft.memberIds, id] });

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
      if (!r.ok) return toast(r.error);
      const id = draft.id ?? (r.data as { id: string } | undefined)?.id;
      const m = id ? await setDepartmentMembers(id, draft.memberIds) : { ok: true as const };
      if (!m.ok) return toast(m.error);
      toast(draft.id ? "Department saved" : "Department added");
      setDraft(null);
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
      {view === "board" ? (
        departments.length === 0 ? (
          <p className="muted m-0">No departments yet.</p>
        ) : (
          <div className="grid-3">
            {departments.map((d) => {
              const st = stats?.[d.id] ?? { staff: 0, projects: 0, open: 0, overdue: 0 };
              return (
                <Card key={d.id}>
                  <CardBody className="stack">
                    <h4 className="m-0 text-[15px]">{d.name}</h4>
                    <div className="muted small">{(d.headId && names.get(d.headId)) || "No head"}</div>
                    <div className="flex flex-wrap gap-3.5 text-[13px] text-ink-2">
                      <span>
                        <b className="num text-ink">{st.staff}</b> staff
                      </span>
                      <span>
                        <b className="num text-ink">{st.projects}</b> active projects
                      </span>
                      <span>
                        <b className="num text-ink">{st.open}</b> open tasks
                      </span>
                      <span className={cn(st.overdue > 0 && "t-danger")}>
                        <b className={cn("num", st.overdue > 0 ? "text-danger" : "text-ink")}>{st.overdue}</b> overdue
                      </span>
                    </div>
                    <div className="row">
                      <Button size="sm" disabled={pending} onClick={() => edit(d)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="danger" disabled={pending} onClick={() => remove(d)}>
                        Delete
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )
      ) : (
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
                    <Button size="sm" disabled={pending} onClick={() => edit(d)}>
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
      )}
      <div className="row">
        <Button variant="primary" disabled={pending} onClick={() => setDraft({ name: "", headId: "", memberIds: [] })}>
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
            <Field label="Members">
              <div className="max-h-48 overflow-y-auto rounded-[var(--radius-ctl)] border border-line p-2">
                {staff.length === 0 ? <p className="muted m-0 small">No active staff yet.</p> : null}
                {staff.map((s) => {
                  const other = s.departmentId && s.departmentId !== draft.id ? deptNames.get(s.departmentId) : null;
                  return (
                    <label key={s.id} className="flex items-center gap-2 py-1 text-[13px]">
                      <input type="checkbox" checked={draft.memberIds.includes(s.id)} onChange={() => toggleMember(s.id)} />
                      {s.name}
                      {other ? <span className="muted small">in {other}</span> : null}
                    </label>
                  );
                })}
              </div>
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

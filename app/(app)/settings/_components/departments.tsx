"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Button, Card, CardBody, Dialog, Field, Input, Select, Table, Td, Th, useToast } from "@/components/ui";
import { cn } from "@/lib/utils";
import { addDepartment, deleteDepartment, departmentUsage, setDepartmentMembers, updateDepartment } from "@/lib/modules/departments/actions";
import { DepartmentName, deleteWarning, duplicateError, isDuplicateName, type Department, type DepartmentStats } from "@/lib/modules/departments/logic";

type Staff = { id: string; name: string; departmentId?: string | null };
type Draft = { id?: string; name: string; headId: string; memberIds: string[] };

type Props = { departments: Department[]; staff: Staff[]; view?: "list" | "board"; stats?: Record<string, DepartmentStats>; viewSwitch?: ReactNode };

/** Admin: list, add, rename and delete departments, and pick each one's head. Board view shows them as cards with counts. */
export function DepartmentsManager({ departments, staff, view = "list", stats, viewSwitch }: Props) {
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
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {viewSwitch}
        <Button variant="primary" className="ml-auto" disabled={pending} onClick={() => setDraft({ name: "", headId: "", memberIds: [] })}>
          Add department
        </Button>
      </div>
      {view === "board" ? (
        departments.length === 0 ? (
          <p className="muted m-0">No departments yet.</p>
        ) : (
          <div className="grid-3">
            {departments.map((d) => {
              const st = stats?.[d.id] ?? { staff: 0, projects: 0, open: 0, overdue: 0 };
              return (
                <Card key={d.id} className="flex flex-col">
                  <CardBody className="flex flex-1 flex-col gap-4">
                    <div className="min-w-0">
                      <h4 className="m-0 truncate text-[15px] leading-snug tracking-[-0.01em]" title={d.name}>
                        {d.name}
                      </h4>
                      <div className="muted small mt-0.5 truncate">{(d.headId && names.get(d.headId)) || "No head"}</div>
                    </div>
                    <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(84px,1fr))] gap-x-4 gap-y-3 text-[13px] text-ink-2">
                      {[
                        { n: st.staff, label: "staff" },
                        { n: st.projects, label: "active projects" },
                        { n: st.open, label: "open tasks" },
                      ].map((x) => (
                        <div key={x.label} className="flex min-w-0 flex-col-reverse gap-0.5">
                          <dt className="truncate">{x.label}</dt>
                          <dd className="num m-0 text-xl font-semibold leading-none text-ink">{x.n}</dd>
                        </div>
                      ))}
                      <div className={cn("flex min-w-0 flex-col-reverse gap-0.5", st.overdue > 0 && "t-danger")}>
                        <dt className="truncate">overdue</dt>
                        <dd className={cn("num m-0 text-xl font-semibold leading-none", st.overdue > 0 ? "text-danger" : "text-ink")}>{st.overdue}</dd>
                      </div>
                    </dl>
                    <div className="row mt-auto border-t border-line pt-3">
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
              <div className="max-h-56 overflow-y-auto rounded-[var(--radius-ctl)] border border-line px-3 py-1.5">
                {staff.length === 0 ? <p className="muted m-0 small">No active staff yet.</p> : null}
                {staff.map((s) => {
                  const other = s.departmentId && s.departmentId !== draft.id ? deptNames.get(s.departmentId) : null;
                  return (
                    <label key={s.id} className="flex min-h-9 cursor-pointer items-center gap-2.5 text-[13px]">
                      <input type="checkbox" checked={draft.memberIds.includes(s.id)} onChange={() => toggleMember(s.id)} />
                      <span className="min-w-0 flex-1 truncate">{s.name}</span>
                      {other ? <span className="muted small shrink-0">in {other}</span> : null}
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

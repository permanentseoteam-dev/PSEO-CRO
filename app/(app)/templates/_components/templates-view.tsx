"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LayoutTemplate } from "lucide-react";
import { Button, Card, CardBody, Checkbox, Dialog, EmptyState, Field, FormGrid, Input, Select, Textarea, useToast } from "@/components/ui";
import { cn } from "@/lib/utils";
import { fmtMinutes, PRIORITY_LABEL, PRIORITIES } from "@/lib/modules/tickets/logic";
import { formatSubtasks, groupInOrder } from "@/lib/modules/work/logic";
import type { Option, Template } from "@/lib/modules/work/types";
import { deleteTemplate, saveTemplate } from "../actions";

const SERVICES = ["SEO", "Content", "PPC", "Web", "Social", "Design"];
const code = "rounded bg-surface-2 px-1.5 py-px text-xs text-ink-2";

type Props = {
  templates: Template[];
  departments: Option[];
  people: Option[];
  qaLists: (Option & { active: boolean })[];
  canManage: boolean;
};

export function TemplatesView({ templates, departments, people, qaLists, canManage }: Props) {
  const [editing, setEditing] = useState<Template | "new" | null>(null);
  const deptName = new Map(departments.map((d) => [d.id, d.name]));
  const groups = groupInOrder(templates, (t) => t.service, SERVICES);

  return (
    <div className="page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="muted m-0">Start new tickets with the checklist and subtasks already filled in.</p>
        {canManage ? (
          <Button variant="primary" onClick={() => setEditing("new")}>
            New template
          </Button>
        ) : null}
      </div>

      {groups.length === 0 ? (
        <EmptyState icon={<LayoutTemplate />} title="No templates yet">
          Save repeat work once, then start tickets from it.
        </EmptyState>
      ) : (
        groups.map(([svc, list]) => (
          <section key={svc} className="stack">
            <h3 className="m-0 mt-1 text-base">{svc}</h3>
            <div className="grid-3">
              {list.map((t) => (
                <Card key={t.id} className={cn(!t.active && "opacity-60")}>
                  <CardBody className="stack">
                    <div className="row between">
                      <h4 className="m-0 text-[15px]">{t.name}</h4>
                      {canManage ? (
                        <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>
                          Edit
                        </Button>
                      ) : null}
                    </div>
                    <div>
                      <code className={code}>{t.titlePattern}</code>
                    </div>
                    <div className="flex flex-wrap gap-3.5 text-[13px] text-ink-2">
                      <span>
                        {t.checklist.length} checklist items · {t.subtasks.length} subtasks
                      </span>
                      {t.departmentId ? <span>{deptName.get(t.departmentId)}</span> : null}
                      <span>
                        Used <b className="num text-ink">{t.uses}</b> {t.uses === 1 ? "time" : "times"}
                      </span>
                    </div>
                    {t.active ? null : <div className="muted small">Switched off. Not offered when creating tickets.</div>}
                  </CardBody>
                </Card>
              ))}
            </div>
          </section>
        ))
      )}

      {editing ? (
        <TemplateEditor
          template={editing === "new" ? null : editing}
          departments={departments}
          people={people}
          qaLists={qaLists}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function TemplateEditor({
  template: t,
  departments,
  people,
  qaLists,
  onClose,
}: {
  template: Template | null;
  departments: Option[];
  people: Option[];
  qaLists: (Option & { active: boolean })[];
  onClose: () => void;
}) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const services = t && !SERVICES.includes(t.service) ? [...SERVICES, t.service] : SERVICES;

  const finish = (msg: string) => (r: { ok: boolean; error?: string }) => {
    if (!r.ok) return toast(r.error ?? "Couldn't save");
    toast(msg);
    onClose();
    router.refresh();
  };

  function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const s = (k: string) => String(fd.get(k) ?? "");
    const due = s("due").trim();
    start(async () =>
      finish("Template saved")(
        await saveTemplate({
          id: t?.id ?? null,
          name: s("name"),
          service: s("service"),
          titlePattern: s("title"),
          departmentId: s("department") || null,
          defaultAssigneeId: s("assignee") || null,
          priority: s("priority"),
          dueInDays: due === "" ? null : Number(due),
          estimate: s("estimate"),
          qaChecklistId: s("qa") || null,
          description: s("description"),
          doneWhen: s("doneWhen"),
          checklist: s("checklist"),
          subtasks: s("subtasks"),
          tags: s("tags"),
          reviewRequired: fd.get("review") === "on",
          active: fd.get("active") === "on",
        }),
      ),
    );
  }

  function remove() {
    if (!t || !confirm(`Delete "${t.name}"?`)) return;
    start(async () => finish("Template deleted")(await deleteTemplate(t.id)));
  }

  return (
    <Dialog
      open
      wide
      onClose={onClose}
      title={t ? "Edit template" : "New template"}
      footer={
        <>
          {t && t.uses === 0 ? (
            <Button variant="danger" className="mr-auto" disabled={pending} onClick={remove}>
              Delete
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="template-form" disabled={pending}>
            Save template
          </Button>
        </>
      }
    >
      <form id="template-form" onSubmit={save}>
        <FormGrid>
          <Field label="Name" htmlFor="tp-name">
            <Input id="tp-name" name="name" required minLength={2} maxLength={80} defaultValue={t?.name} />
          </Field>
          <Field label="Service" htmlFor="tp-service">
            <Select id="tp-service" name="service" defaultValue={t?.service ?? "SEO"}>
              {services.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
          </Field>
          <Field
            label="Ticket title"
            htmlFor="tp-title"
            full
            hint={
              <>
                Fills in automatically: <code className={code}>{"{client}"}</code> <code className={code}>{"{project}"}</code>{" "}
                <code className={code}>{"{month}"}</code> <code className={code}>{"{date}"}</code>
              </>
            }
          >
            <Input id="tp-title" name="title" required minLength={2} maxLength={200} defaultValue={t?.titlePattern ?? "{client} "} />
          </Field>
          <Field label="Department" htmlFor="tp-dept">
            <Select id="tp-dept" name="department" defaultValue={t?.departmentId ?? ""}>
              <option value="">None</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Default assignee" htmlFor="tp-assignee">
            <Select id="tp-assignee" name="assignee" defaultValue={t?.defaultAssigneeId ?? ""}>
              <option value="">Project lead</option>
              {people.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Priority" htmlFor="tp-priority">
            <Select id="tp-priority" name="priority" defaultValue={t?.priority ?? "normal"}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Due after (days)" htmlFor="tp-due">
            <Input id="tp-due" name="due" type="number" min={0} max={365} defaultValue={t?.dueInDays ?? ""} />
          </Field>
          <Field label="Estimate" htmlFor="tp-est">
            <Input id="tp-est" name="estimate" placeholder="3h" defaultValue={t?.estimateMin ? fmtMinutes(t.estimateMin) : ""} />
          </Field>
          <Field label="QA checklist" htmlFor="tp-qa">
            <Select id="tp-qa" name="qa" defaultValue={t?.qaChecklistId ?? ""}>
              <option value="">None</option>
              {qaLists
                .filter((q) => q.active || q.id === t?.qaChecklistId)
                .map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Description" htmlFor="tp-desc" full>
            <Textarea id="tp-desc" name="description" rows={2} defaultValue={t?.description ?? ""} />
          </Field>
          <Field label="Done when" htmlFor="tp-done" full>
            <Textarea id="tp-done" name="doneWhen" rows={2} maxLength={2000} defaultValue={t?.doneWhen ?? ""} />
          </Field>
          <Field label="Checklist (one per line)" htmlFor="tp-ck" full>
            <Textarea id="tp-ck" name="checklist" rows={5} defaultValue={t?.checklist.join("\n")} />
          </Field>
          <Field label="Subtasks (one per line)" htmlFor="tp-sub" full hint="Add a due offset like: Draft | +3d">
            <Textarea id="tp-sub" name="subtasks" rows={3} defaultValue={t ? formatSubtasks(t.subtasks) : ""} />
          </Field>
          <Field label="Tags" htmlFor="tp-tags" full>
            <Input id="tp-tags" name="tags" placeholder="report, seo" defaultValue={t?.tags.join(", ")} />
          </Field>
          <Checkbox name="review" label="Needs review before done" defaultChecked={t?.reviewRequired ?? true} />
          <Checkbox name="active" label="Template is on" defaultChecked={t?.active ?? true} />
        </FormGrid>
      </form>
    </Dialog>
  );
}

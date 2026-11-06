"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog, Field, FormGrid, Input, Select, Textarea, useToast } from "@/components/ui";
import { addDays, parseTags, PRIORITIES, PRIORITY_LABEL } from "@/lib/modules/tickets/logic";
import { createTicket } from "@/lib/modules/tickets/actions";
import { uploadTicketFiles } from "@/lib/modules/tickets/upload";
import type { Person, ProjectOpt } from "@/lib/modules/tickets/types";

type Template = { id: string; title: string; priority: string | null; dueInDays: number | null };
type Props = { meId: string; people: Person[]; projects: ProjectOpt[]; templates: Template[]; today: string; defaultProject?: string };

export function NewTicketButton({ people, projects, templates, today, defaultProject }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [tpl, setTpl] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [assignee, setAssignee] = useState<string | null>(null);
  const selectedProjectId = projectId ?? defaultProject ?? projects[0]?.id ?? "";
  const creatorId = projects.find((project) => project.id === selectedProjectId)?.createdBy;
  const defaultAssignee = people.some((person) => person.id === creatorId) ? creatorId ?? "" : "";
  const chosen = templates.find((t) => t.id === tpl);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const v = (k: string) => String(fd.get(k) ?? "");
    const files = (fd.getAll("files") as File[]).filter((f) => f.size > 0);
    start(async () => {
      const r = await createTicket({
        title: v("title"),
        projectId: v("project") || null,
        assigneeId: v("assignee") || null,
        priority: v("priority"),
        due: v("due") || null,
        description: v("description"),
        doneWhen: v("doneWhen"),
        tags: parseTags(v("tags")),
        templateId: tpl || null,
      });
      if (!r.ok || !r.data) return toast(r.ok ? "Couldn't create the ticket." : r.error);
      const up = files.length ? await uploadTicketFiles(r.data.id, files) : { problems: [] as string[] };
      setOpen(false);
      setTpl("");
      toast(up.problems.length ? `${r.data.key} created. ${up.problems[0]}` : `${r.data.key} created`);
      router.push(`/t/${r.data.key}`);
    });
  }

  return (
    <>
      <Button variant="primary" onClick={() => { setProjectId(null); setAssignee(null); setOpen(true); }}>New ticket</Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="New ticket"
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" type="submit" form="tk-new" disabled={pending}>{pending ? "Creating…" : "Create ticket"}</Button>
          </>
        }
      >
        <form id="tk-new" onSubmit={submit}>
          <FormGrid key={tpl}>
            {templates.length ? (
              <Field label="Start from template" htmlFor="tk-new-tpl" full>
                <Select id="tk-new-tpl" value={tpl} onChange={(e) => setTpl(e.target.value)}>
                  <option value="">Blank ticket</option>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                </Select>
              </Field>
            ) : null}
            <Field label="Title" htmlFor="tk-new-title" full>
              <Input id="tk-new-title" name="title" required minLength={2} maxLength={200} placeholder="What needs doing?" defaultValue={chosen?.title ?? ""} />
            </Field>
            <Field label="Project" htmlFor="tk-new-project">
              <Select id="tk-new-project" name="project" value={selectedProjectId} onChange={(event) => setProjectId(event.target.value)}>
                <option value="">No project</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
            <Field label="Assignee" htmlFor="tk-new-assignee">
              <Select id="tk-new-assignee" name="assignee" value={assignee ?? defaultAssignee} onChange={(event) => setAssignee(event.target.value)}>
                <option value="">Unassigned</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
            <Field label="Priority" htmlFor="tk-new-priority">
              <Select id="tk-new-priority" name="priority" defaultValue={chosen?.priority ?? "normal"}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
              </Select>
            </Field>
            <Field label="Due" htmlFor="tk-new-due">
              <Input id="tk-new-due" name="due" type="date" defaultValue={addDays(today, chosen?.dueInDays ?? 7)} />
            </Field>
            <Field label="Description" htmlFor="tk-new-desc" full>
              <Textarea id="tk-new-desc" name="description" rows={3} maxLength={10000} />
            </Field>
            <Field label="Done when" htmlFor="tk-new-done" full>
              <Textarea id="tk-new-done" name="doneWhen" rows={2} maxLength={2000} placeholder="How we know it is finished" />
            </Field>
            <Field label="Tags" htmlFor="tk-new-tags">
              <Input id="tk-new-tags" name="tags" placeholder="content, onpage" />
            </Field>
            <Field label="Files" htmlFor="tk-new-files" hint="Up to 2 MB each">
              <Input id="tk-new-files" name="files" type="file" multiple />
            </Field>
          </FormGrid>
        </form>
      </Dialog>
    </>
  );
}

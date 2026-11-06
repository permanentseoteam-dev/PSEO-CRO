"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Dialog, Field, FormGrid, Input, Select, Textarea, useToast } from "@/components/ui";
import { parseTags } from "@/lib/modules/shell/logic";
import { createTicket } from "@/lib/modules/shell/actions";
import type { TicketOptions } from "@/lib/modules/shell/types";

const addDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("en-CA"); // yyyy-mm-dd, local
};

export function NewTicketDialog({ open, onClose, options }: { open: boolean; onClose: () => void; options: TicketOptions | null; meId: string }) {
  const toast = useToast();
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const openAfter = useRef(false);
  const [pending, start] = useTransition();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("normal");
  const [due, setDue] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [assignee, setAssignee] = useState<string | null>(null);
  const selectedProject = options?.projects.find((project) => project.id === (projectId ?? options.projects[0]?.id));
  const creatorId = selectedProject?.createdBy;
  const defaultAssignee = options?.people.some((person) => person.id === creatorId) ? creatorId ?? "" : "";

  const pickTemplate = (id: string) => {
    const t = options?.templates.find((x) => x.id === id);
    if (!t) return;
    if (!title) setTitle(t.title);
    if (t.priority) setPriority(t.priority);
    if (t.dueInDays != null) setDue(addDays(t.dueInDays));
  };

  const close = () => {
    form.current?.reset();
    setTitle("");
    setPriority("normal");
    setDue("");
    setProjectId(null);
    setAssignee(null);
    onClose();
  };

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const goTo = openAfter.current;
    openAfter.current = false;
    start(async () => {
      const r = await createTicket({
        title,
        projectId: f.get("project"),
        assigneeId: f.get("assignee") || null,
        priority,
        due: due || null,
        description: String(f.get("description") ?? ""),
        doneWhen: String(f.get("doneWhen") ?? ""),
        tags: parseTags(String(f.get("tags") ?? "")),
      });
      if (!r.ok) return toast(r.error);
      const key = r.data?.key ?? "";
      toast(`Ticket ${key} created`);
      close();
      if (goTo && key) router.push(`/t/${key}`);
    });
  };

  const noProjects = options != null && options.projects.length === 0;

  return (
    <Dialog
      open={open}
      onClose={close}
      title="New ticket"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" form="nt-form" disabled={pending || noProjects} onClick={() => (openAfter.current = true)}>
            Create and open
          </Button>
          <Button type="submit" form="nt-form" variant="primary" disabled={pending || noProjects}>
            Create ticket
          </Button>
        </>
      }
    >
      {options == null ? (
        <p className="muted">Loading…</p>
      ) : (
        <form id="nt-form" ref={form} onSubmit={submit}>
          <FormGrid>
            <Field label="Template" htmlFor="nt-tpl" full>
              <Select id="nt-tpl" defaultValue="" onChange={(e) => pickTemplate(e.target.value)}>
                <option value="">No template</option>
                {options.templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Title" htmlFor="nt-title" full>
              <Input id="nt-title" required minLength={2} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Fix crawl errors on service pages" />
            </Field>
            <Field label="Project" htmlFor="nt-proj" hint={noProjects ? "Create a project first." : undefined}>
              <Select id="nt-proj" name="project" required value={selectedProject?.id ?? ""} onChange={(event) => setProjectId(event.target.value)}>
                {options.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.key} · {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Assignee" htmlFor="nt-asg">
              <Select id="nt-asg" name="assignee" value={assignee ?? defaultAssignee} onChange={(event) => setAssignee(event.target.value)}>
                <option value="">Unassigned</option>
                {options.people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Priority" htmlFor="nt-pri">
              <Select id="nt-pri" value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
              </Select>
            </Field>
            <Field label="Due" htmlFor="nt-due">
              <Input id="nt-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
            </Field>
            <Field label="Description" htmlFor="nt-desc" full>
              <Textarea id="nt-desc" name="description" placeholder="What needs doing?" />
            </Field>
            <Field label="Done when" htmlFor="nt-done" full>
              <Input id="nt-done" name="doneWhen" placeholder="All 404s on /services return 200 and Search Console shows 0 errors" />
            </Field>
            <Field label="Tags" htmlFor="nt-tags" full>
              <Input id="nt-tags" name="tags" placeholder="technical, on-page" />
            </Field>
          </FormGrid>
        </form>
      )}
    </Dialog>
  );
}

"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FolderKanban } from "lucide-react";
import {
  Avatar, Button, ButtonLink, Card, CardBody, Checkbox, Dialog, EmptyState, Field, FormGrid, Input, Seg, Select, Textarea, useToast,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { groupInOrder } from "@/lib/modules/work/logic";
import type { Option, ProjectCard } from "@/lib/modules/work/types";
import { saveProject } from "../actions";

type Props = { cards: ProjectCard[]; canCreate: boolean; people: Option[]; departments: Option[]; clients: Option[] };
type State = "active" | "archived" | "all";

const DEPT_ORDER = ["SEO", "PPC", "Web", "Content", "Design", "Social", "Client Success"];

export function ProjectsView({ cards, canCreate, people, departments, clients }: Props) {
  const [q, setQ] = useState("");
  const [state, setState] = useState<State>("active");
  const [editing, setEditing] = useState<ProjectCard | "new" | null>(null);

  const needle = q.trim().toLowerCase();
  const shown = cards.filter(
    (c) => (state === "all" || c.status === state) && (!needle || `${c.name} ${c.key} ${c.client}`.toLowerCase().includes(needle)),
  );
  const groups = groupInOrder(shown, (c) => c.department, DEPT_ORDER);

  return (
    <div className="page">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="row">
          <Input type="search" placeholder="Search projects" aria-label="Search projects" value={q} onChange={(e) => setQ(e.target.value)} />
          <Seg
            label="Project state"
            value={state}
            onChange={(v) => setState(v as State)}
            items={[
              { value: "active", label: "Active" },
              { value: "archived", label: "Archived" },
              { value: "all", label: "All" },
            ]}
          />
        </div>
        {canCreate ? (
          <Button variant="primary" onClick={() => setEditing("new")}>
            New project
          </Button>
        ) : null}
      </div>

      {groups.length === 0 ? (
        <EmptyState icon={<FolderKanban />} title={cards.length ? "No projects match" : "No projects yet"}>
          {cards.length ? "Try another search or switch to All." : "Projects group tickets for a client and give them their key."}
        </EmptyState>
      ) : (
        groups.map(([dept, list]) => (
          <section key={dept} className="stack">
            <h3 className="m-0 mt-1 text-base">{dept}</h3>
            <div className="grid-3">
              {list.map((p) => (
                <Card key={p.id}>
                  <CardBody className="stack">
                    <div className="row between">
                      <h4 className="m-0 text-[15px]">{p.name}</h4>
                      <span className="num text-xs font-semibold text-ink-3">{p.key}</span>
                    </div>
                    <div className="muted small">
                      {p.client || "No client"}
                      {p.status === "archived" ? " · Archived" : ""}
                    </div>
                    <div className="row small">
                      <Avatar name={p.lead} size={22} /> {p.lead}
                    </div>
                    <div className="flex flex-wrap gap-3.5 text-[13px] text-ink-2">
                      <span>
                        <b className="num text-ink">{p.open}</b> open
                      </span>
                      <span className={cn(p.overdue > 0 && "t-danger")}>
                        <b className={cn("num", p.overdue > 0 ? "text-danger" : "text-ink")}>{p.overdue}</b> overdue
                      </span>
                      <span>
                        <b className="num text-ink">{p.done30}</b> done in 30 days
                      </span>
                    </div>
                    <div className="row">
                      <ButtonLink size="sm" href={`/tickets?view=board&proj=${p.id}`}>
                        Board
                      </ButtonLink>
                      <ButtonLink size="sm" href={`/tickets?view=cal&proj=${p.id}`}>
                        Calendar
                      </ButtonLink>
                      {p.canEdit ? (
                        <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>
                          Edit
                        </Button>
                      ) : null}
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          </section>
        ))
      )}

      {editing ? (
        <ProjectEditor
          project={editing === "new" ? null : editing}
          people={people}
          departments={departments}
          clients={clients}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </div>
  );
}

function ProjectEditor({
  project,
  people,
  departments,
  clients,
  onClose,
}: {
  project: ProjectCard | null;
  people: Option[];
  departments: Option[];
  clients: Option[];
  onClose: () => void;
}) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const p = project;
  const formRef = useRef<HTMLFormElement>(null);

  function save(status: "active" | "archived") {
    const form = formRef.current;
    if (!form?.reportValidity()) return;
    const fd = new FormData(form);
    const s = (k: string) => String(fd.get(k) ?? "");
    const id = (k: string) => s(k) || null;
    start(async () => {
      const r = await saveProject({
        id: p?.id ?? null,
        name: s("name"),
        key: s("key"),
        departmentId: id("department"),
        clientId: id("client"),
        leadId: id("lead"),
        reviewerId: id("reviewer"),
        description: s("description"),
        reviewRequired: fd.get("review") === "on",
        status,
      });
      if (!r.ok) return toast(r.error);
      toast(status === "archived" && p?.status !== "archived" ? "Project archived" : "Project saved");
      onClose();
      router.refresh();
    });
  }

  const status = p?.status ?? "active";
  return (
    <Dialog
      open
      onClose={onClose}
      title={p ? "Edit project" : "New project"}
      footer={
        <>
          {p ? (
            <Button variant="ghost" className="mr-auto" disabled={pending} onClick={() => save(status === "active" ? "archived" : "active")}>
              {status === "active" ? "Archive" : "Restore"}
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={pending} onClick={() => save(status)}>
            Save project
          </Button>
        </>
      }
    >
      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          save(status);
        }}
      >
        <FormGrid>
          <Field label="Name" htmlFor="pj-name">
            <Input id="pj-name" name="name" required minLength={2} maxLength={120} defaultValue={p?.name} />
          </Field>
          <Field label="Key" htmlFor="pj-key" hint={`Ticket numbers start with this, like ${p?.key ?? "CPD"}-142.`}>
            <Input
              id="pj-key"
              name="key"
              required
              pattern="[A-Za-z]{2,8}"
              title="2 to 8 letters"
              defaultValue={p?.key}
              className="uppercase"
            />
          </Field>
          <Field label="Department" htmlFor="pj-dept">
            <Select id="pj-dept" name="department" defaultValue={p?.departmentId ?? ""}>
              <option value="">None</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Client" htmlFor="pj-client">
            <Select id="pj-client" name="client" defaultValue={p?.clientId ?? ""}>
              <option value="">Internal (no client)</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Lead" htmlFor="pj-lead">
            <Select id="pj-lead" name="lead" defaultValue={p?.leadId ?? ""}>
              <option value="">No lead</option>
              {people.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reviewer" htmlFor="pj-reviewer">
            <Select id="pj-reviewer" name="reviewer" defaultValue={p?.reviewerId ?? ""}>
              <option value="">No default reviewer</option>
              {people.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="What it covers" htmlFor="pj-desc" full>
            <Textarea id="pj-desc" name="description" rows={2} maxLength={2000} defaultValue={p?.description ?? ""} />
          </Field>
          <Checkbox name="review" label="Tickets need review before done" defaultChecked={p?.reviewRequired ?? true} />
        </FormGrid>
      </form>
    </Dialog>
  );
}

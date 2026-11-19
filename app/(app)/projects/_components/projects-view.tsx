"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderKanban } from "lucide-react";
import {
  Avatar, Button, ButtonLink, Card, CardBody, Checkbox, Dialog, EmptyState, Field, FormGrid, Input, Seg, Select, Textarea, useToast,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { groupInOrder } from "@/lib/modules/work/logic";
import { PROJECT_COLORS } from "@/lib/modules/work/project-colors";
import type { Department, Option, ProjectCard } from "@/lib/modules/work/types";
import { saveProject } from "../actions";
import { saveClient } from "../../clients/actions";
import { DepartmentChecks, useDepartmentsAndLead } from "./department-picker";

type Props = { cards: ProjectCard[]; canCreate: boolean; canAddClient: boolean; people: Option[]; departments: Department[]; clients: Option[] };
type State = "active" | "archived" | "all";

// Names for the swatches, in PROJECT_COLORS order (screen readers and tooltips).
const COLOR_NAMES = ["Blue", "Pink", "Mint", "Lavender", "Yellow", "Green", "Peach", "Sky"];
type ProjectColor = (typeof PROJECT_COLORS)[number];

const DEPT_ORDER = ["SEO", "PPC", "Web", "Content", "Design", "Social", "Client Success"];

export function ProjectsView({ cards, canCreate, canAddClient, people, departments, clients }: Props) {
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
        <div className="flex min-w-0 basis-full flex-wrap items-center gap-2.5 sm:flex-1 sm:basis-auto">
          <div className="w-full sm:w-80">
            <Input type="search" placeholder="Search projects" aria-label="Search projects" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
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
          {cards.length ? "Try another search or switch to All." : "Projects group tasks for a client and give them their key."}
        </EmptyState>
      ) : (
        groups.map(([dept, list]) => (
          <section key={dept} className="stack gap-2.5">
            <h3 className="m-0 mt-1 text-base">{dept}</h3>
            <div className="grid-3">
              {list.map((p) => (
                <Card key={p.id} className="flex flex-col" style={p.color ? { borderTop: `4px solid ${p.color}` } : undefined}>
                  <CardBody className="flex flex-1 flex-col gap-3">
                    <div className="grid gap-0.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <h4 className="m-0 min-w-0 truncate text-[15px]" title={p.name}>
                          <Link href={`/projects/${p.key}/tasks`} className="text-inherit hover:underline">{p.name}</Link>
                        </h4>
                        <span className="num flex-none text-xs font-semibold text-ink-3">{p.key}</span>
                      </div>
                      <div className="muted small truncate">
                        {p.client || "No client"}
                        {p.status === "archived" ? " · Archived" : ""}
                      </div>
                    </div>
                    <div className="flex min-w-0 items-center gap-2 text-[12.5px]">
                      <Avatar name={p.lead} size={22} />
                      <span className="min-w-0 truncate" title={p.lead}>{p.lead}</span>
                    </div>
                    <div className="mt-auto flex flex-wrap gap-x-3.5 gap-y-1 border-t border-line pt-3 text-[13px] text-ink-2">
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
                      <ButtonLink size="sm" href={`/projects/${p.key}/tasks`}>
                        Open
                      </ButtonLink>
                      <ButtonLink size="sm" href={`/tickets?view=board&proj=${p.id}`}>
                        Board
                      </ButtonLink>
                      <ButtonLink size="sm" href={`/tickets?view=list&proj=${p.id}`}>
                        List
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
          canAddClient={canAddClient}
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
  canAddClient,
  onClose,
}: {
  project: ProjectCard | null;
  people: Option[];
  departments: Department[];
  clients: Option[];
  canAddClient: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const p = project;
  const formRef = useRef<HTMLFormElement>(null);
  const team = useDepartmentsAndLead(departments, p?.departmentIds ?? [], p?.leadId ?? "");
  const [clientList, setClientList] = useState(clients);
  const [clientId, setClientId] = useState(p?.clientId ?? "");
  const [newClient, setNewClient] = useState<string | null>(null);
  const [color, setColor] = useState<string>(p?.color ?? "");

  function addClient() {
    const name = newClient?.trim() ?? "";
    if (!name) return;
    start(async () => {
      const r = await saveClient({
        id: "", name, site: "", services: [], country: "", start_date: "", channel: "whatsapp", currency: "AED",
        owner_id: "", manager_id: "", notes: "", monthly_fee: "", hours_per_month: "",
      });
      if (!r.ok) return toast(r.error);
      setClientList((l) => [...l, { id: r.id, name }].sort((a, b) => a.name.localeCompare(b.name)));
      setClientId(r.id);
      setNewClient(null);
      toast(`Client "${name}" added`);
    });
  }

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
        key: s("key") || undefined,
        departmentIds: team.ids,
        clientId: id("client"),
        leadId: id("lead"),
        reviewerId: id("reviewer"),
        description: s("description"),
        reviewRequired: fd.get("review") === "on",
        status,
        color: (PROJECT_COLORS as readonly string[]).includes(color) ? (color as ProjectColor) : undefined,
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
          <Field label="Task prefix" htmlFor="pj-key">
            <Input
              id="pj-key"
              name="key"
              required={!!p}
              pattern="[A-Za-z]{2,8}"
              title="2 to 8 letters"
              maxLength={8}
              placeholder={p ? undefined : "Made from the name if empty"}
              defaultValue={p?.key}
              onChange={(e) => (e.target.value = e.target.value.toUpperCase())}
            />
          </Field>
          <Field label="Colour" full>
            <div role="radiogroup" aria-label="Colour" className="flex flex-wrap gap-2.5">
              {PROJECT_COLORS.map((c, i) => (
                <label
                  key={c}
                  title={COLOR_NAMES[i]}
                  className="relative size-7 cursor-pointer rounded-full border border-line [&:has(:focus-visible)]:outline-2 [&:has(:focus-visible)]:outline-offset-2 [&:has(:focus-visible)]:outline-accent"
                  style={{ background: c, ...(color === c ? { outline: "2px solid var(--accent)", outlineOffset: 2 } : {}) }}
                >
                  <input
                    type="radio"
                    name="color"
                    value={c}
                    className="sr-only"
                    aria-label={COLOR_NAMES[i]}
                    checked={color === c}
                    onChange={() => setColor(c)}
                  />
                </label>
              ))}
            </div>
          </Field>
          <Field label="Departments" full>
            <DepartmentChecks departments={departments} value={team.ids} onToggle={team.toggle} />
          </Field>
          <Field label="Client" htmlFor="pj-client">
            {newClient !== null ? (
              <div className="flex gap-2">
                <Input
                  id="pj-client"
                  placeholder="New client name"
                  aria-label="New client name"
                  className="min-w-0 flex-1"
                  value={newClient}
                  maxLength={120}
                  autoFocus
                  onChange={(e) => setNewClient(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addClient();
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setNewClient(null);
                    }
                  }}
                />
                <Button disabled={pending || !newClient.trim()} onClick={addClient}>
                  Add
                </Button>
                <Button variant="ghost" onClick={() => setNewClient(null)}>
                  Cancel
                </Button>
                <input type="hidden" name="client" value={clientId} />
              </div>
            ) : (
              <Select
                id="pj-client"
                name="client"
                value={clientId}
                onChange={(e) => (e.target.value === "__new" ? setNewClient("") : setClientId(e.target.value))}
              >
                <option value="">Internal (no client)</option>
                {canAddClient ? <option value="__new">+ New client…</option> : null}
                {clientList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Lead" htmlFor="pj-lead">
            <Select id="pj-lead" name="lead" value={team.lead} onChange={(e) => team.setLead(e.target.value)}>
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
          <Checkbox name="review" label="Tasks need review before done" defaultChecked={p?.reviewRequired ?? true} />
        </FormGrid>
      </form>
    </Dialog>
  );
}

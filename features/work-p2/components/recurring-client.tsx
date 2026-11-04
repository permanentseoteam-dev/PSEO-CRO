"use client";

import { useState } from "react";
import { Repeat } from "lucide-react";
import { Avatar, Button, Dialog, EmptyState, Field, FormGrid, Input, Select, StatusDot, Table, Td, Textarea, Th } from "@/components/ui";
import { deleteRule, runDueRules, saveRule, setRulePaused } from "../actions";
import { firstRun, repeatsLabel, shortDate, WEEKDAYS } from "../logic";
import type { Frequency, RecurringRule } from "../types";
import { useRun } from "./shared";

type Props = {
  rules: RecurringRule[];
  projects: { id: string; name: string; clientName: string | null }[];
  people: { id: string; name: string }[];
  templates: { id: string; name: string; pattern: string }[];
  today: string;
  meId: string;
  canManage: boolean;
  /** team or all scope: may set any assignee */
  canManageAll: boolean;
  canRunNow: boolean;
};

export function RecurringClient(p: Props) {
  const { pending, run } = useRun();
  const [editing, setEditing] = useState<RecurringRule | "new" | null>(null);
  const project = new Map(p.projects.map((x) => [x.id, x.name]));
  const person = new Map(p.people.map((x) => [x.id, x.name]));
  const template = new Map(p.templates.map((x) => [x.id, x.name]));
  const mayEdit = (r: RecurringRule) => p.canManage && (p.canManageAll || r.assignee_id === p.meId);

  return (
    <>
      <div className="row between">
        <h2 style={{ margin: 0 }}>Recurring tickets</h2>
        <div className="row">
          {p.canRunNow ? (
            <Button disabled={pending} onClick={() => run(runDueRules, "Due rules checked")}>
              Run due rules now
            </Button>
          ) : null}
          {p.canManage ? (
            <Button variant="primary" onClick={() => setEditing("new")}>
              New rule
            </Button>
          ) : null}
        </div>
      </div>

      {p.rules.length === 0 ? (
        <EmptyState icon={<Repeat />} title="No recurring tickets yet" />
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Template</Th>
              <Th>Ticket title</Th>
              <Th>Project</Th>
              <Th hideSm>Assignee</Th>
              <Th>Repeats</Th>
              <Th>Next run</Th>
              <Th>State</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {p.rules.map((r) => (
              <tr key={r.id}>
                <Td>{r.template_id ? (template.get(r.template_id) ?? "Template") : <span className="muted">None</span>}</Td>
                <Td>
                  <code>{r.title_pattern}</code>
                </Td>
                <Td>{project.get(r.project_id) ?? "Project"}</Td>
                <Td hideSm>
                  {r.assignee_id ? (
                    <span className="row" style={{ flexWrap: "nowrap" }}>
                      <Avatar name={person.get(r.assignee_id) ?? "?"} size={22} /> {person.get(r.assignee_id) ?? "Former member"}
                    </span>
                  ) : (
                    <span className="muted">Unassigned</span>
                  )}
                </Td>
                <Td>{repeatsLabel(r)}</Td>
                <Td num>{!r.paused && r.next_run ? shortDate(r.next_run) : <span className="muted">None</span>}</Td>
                <Td>{r.paused ? <StatusDot tone="muted">Paused</StatusDot> : <StatusDot tone="ok">Active</StatusDot>}</Td>
                <Td right style={{ whiteSpace: "nowrap" }}>
                  {mayEdit(r) ? (
                    <span className="row" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
                      <Button
                        size="sm"
                        disabled={pending}
                        onClick={() => run(() => setRulePaused({ id: r.id, paused: !r.paused }), r.paused ? "Rule resumed" : "Rule paused")}
                      >
                        {r.paused ? "Resume" : "Pause"}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>
                        Edit
                      </Button>
                    </span>
                  ) : null}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <RuleDialog
        key={editing === null ? "closed" : editing === "new" ? "new" : editing.id}
        rule={editing}
        onClose={() => setEditing(null)}
        {...p}
      />
    </>
  );
}

function RuleDialog({ rule, onClose, projects, people, templates, today, meId, canManageAll }: Props & { rule: RecurringRule | "new" | null; onClose: () => void }) {
  const { pending, run } = useRun();
  const r = rule && rule !== "new" ? rule : null;
  const [freq, setFreq] = useState<Frequency>(r?.frequency ?? "monthly");
  const [weekday, setWeekday] = useState(r?.weekday ?? 1);
  const [monthDay, setMonthDay] = useState(r?.month_day ?? 1);
  const [startsOn, setStartsOn] = useState(r?.starts_on ?? today);
  const [title, setTitle] = useState(r?.title_pattern ?? "");
  const next = /^\d{4}-\d{2}-\d{2}$/.test(startsOn) ? firstRun({ frequency: freq, weekday, month_day: monthDay, starts_on: startsOn }, today) : null;
  const formId = "rule-form";
  const assignees = canManageAll ? people : people.filter((x) => x.id === meId);

  return (
    <Dialog
      open={rule !== null}
      onClose={onClose}
      title={r ? "Edit recurring rule" : "New recurring rule"}
      footer={
        <>
          {r ? (
            <Button variant="danger" disabled={pending} onClick={() => run(() => deleteRule(r.id), "Rule deleted", onClose)} style={{ marginRight: "auto" }}>
              Delete
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={formId} disabled={pending}>
            {r ? "Save rule" : "Create rule"}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          run(
            () =>
              saveRule({
                id: r?.id,
                templateId: (f.get("templateId") as string) || null,
                titlePattern: title,
                description: f.get("description") ?? "",
                projectId: f.get("projectId"),
                assigneeId: (f.get("assigneeId") as string) || null,
                priority: f.get("priority"),
                frequency: freq,
                weekday: freq === "weekly" ? weekday : null,
                monthDay: freq === "monthly" ? monthDay : null,
                dueOffsetDays: f.get("dueOffsetDays"),
                startsOn,
              }),
            r ? "Rule saved" : "Rule created",
            onClose,
          );
        }}
      >
        <FormGrid>
          <Field label="Template" htmlFor="rr-tpl">
            <Select
              id="rr-tpl"
              name="templateId"
              defaultValue={r?.template_id ?? ""}
              onChange={(e) => {
                const t = templates.find((x) => x.id === e.target.value);
                if (t?.pattern && !title) setTitle(t.pattern);
              }}
            >
              <option value="">No template</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Ticket title" htmlFor="rr-title" hint="Use {client}, {project}, {month} or {date}">
            <Input id="rr-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="{client} SEO report · {month}" required minLength={2} maxLength={200} />
          </Field>
          <Field label="Project" htmlFor="rr-project">
            <Select id="rr-project" name="projectId" defaultValue={r?.project_id ?? projects[0]?.id ?? ""} required>
              {projects.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Assignee" htmlFor="rr-assignee">
            <Select id="rr-assignee" name="assigneeId" defaultValue={r?.assignee_id ?? (canManageAll ? "" : meId)}>
              {canManageAll ? <option value="">Unassigned</option> : null}
              {assignees.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Repeats" htmlFor="rr-freq">
            <Select id="rr-freq" value={freq} onChange={(e) => setFreq(e.target.value as Frequency)}>
              <option value="daily">Daily</option>
              <option value="weekdays">Weekdays</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </Select>
          </Field>
          {freq === "weekly" ? (
            <Field label="Day" htmlFor="rr-wd">
              <Select id="rr-wd" value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
                {WEEKDAYS.map((d, i) => (
                  <option key={d} value={i + 1}>
                    {d}
                  </option>
                ))}
              </Select>
            </Field>
          ) : freq === "monthly" ? (
            <Field label="Day of month" htmlFor="rr-md">
              <Input id="rr-md" type="number" min={1} max={28} value={monthDay} onChange={(e) => setMonthDay(Number(e.target.value))} required />
            </Field>
          ) : (
            <div />
          )}
          <Field label="Due after (days)" htmlFor="rr-due">
            <Input id="rr-due" name="dueOffsetDays" type="number" min={0} max={365} defaultValue={r?.due_offset_days ?? 5} required />
          </Field>
          <Field label="Start" htmlFor="rr-start" hint={next ? `First ticket on ${shortDate(next)}` : undefined}>
            <Input id="rr-start" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} required />
          </Field>
          <Field label="Priority" htmlFor="rr-pri">
            <Select id="rr-pri" name="priority" defaultValue={r?.priority ?? "normal"}>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </Select>
          </Field>
          <Field label="Description" htmlFor="rr-desc" full>
            <Textarea id="rr-desc" name="description" rows={2} defaultValue={r?.description ?? ""} />
          </Field>
        </FormGrid>
      </form>
    </Dialog>
  );
}

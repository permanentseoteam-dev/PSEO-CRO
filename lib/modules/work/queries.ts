import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { PriorityLevel } from "@/components/ui";
import type { Option, Project, QaChecklist, QueueRow, ReviewFact, Subtask, Template } from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const rows = (res: { data: unknown; error: unknown }): Row[] => (res.error || !res.data ? [] : (res.data as Row[]));

export type Member = Option & { departmentId: string | null; managerId: string | null };

/** Active staff, A–Z. */
export async function listStaff(): Promise<Member[]> {
  const db = await createClient();
  const res = await db.from("members").select("id, name, department_id, manager_id").eq("kind", "staff").eq("status", "active").order("name");
  return rows(res).map((m) => ({ id: m.id, name: m.name, departmentId: m.department_id, managerId: m.manager_id }));
}

export async function listDepartments(): Promise<Option[]> {
  const db = await createClient();
  return rows(await db.from("departments").select("id, name").order("name")) as Option[];
}

/** Clients (owned by 0108_clients). Empty if that table isn't there yet. */
export async function listClients(): Promise<Option[]> {
  const db = await createClient();
  return rows(await db.from("clients").select("id, name").order("name")) as Option[];
}

export async function listProjects(): Promise<Project[]> {
  const db = await createClient();
  const res = await db
    .from("projects")
    .select("id, key, name, description, department_id, client_id, lead_id, reviewer_id, review_required, status")
    .order("name");
  return rows(res).map((p) => ({
    id: p.id,
    key: p.key,
    name: p.name,
    description: p.description,
    departmentId: p.department_id,
    clientId: p.client_id,
    leadId: p.lead_id,
    reviewerId: p.reviewer_id,
    reviewRequired: p.review_required,
    status: p.status,
  }));
}

/** Ticket fields the project cards count (RLS limits to tickets the user can see). */
export async function projectTicketFacts() {
  const db = await createClient();
  const res = await db.from("tickets").select("project_id, status, due_date, completed_at").not("project_id", "is", null).limit(10000);
  return rows(res) as { project_id: string | null; status: string; due_date: string | null; completed_at: string | null }[];
}

export async function listTemplates(): Promise<Template[]> {
  const db = await createClient();
  const res = await db.from("templates").select("*").order("name");
  return rows(res).map((t) => ({
    id: t.id,
    name: t.name,
    service: t.service,
    titlePattern: t.title_pattern,
    departmentId: t.department_id,
    defaultAssigneeId: t.default_assignee_id,
    priority: t.priority as PriorityLevel,
    dueInDays: t.due_in_days,
    estimateMin: t.estimate_min,
    qaChecklistId: t.qa_checklist_id,
    description: t.description,
    doneWhen: t.done_when,
    checklist: t.checklist ?? [],
    subtasks: ((t.subtasks ?? []) as Subtask[]).map((s) => ({ title: s.title, due_offset_days: s.due_offset_days ?? null })),
    tags: t.tags ?? [],
    reviewRequired: t.review_required,
    active: t.active,
    uses: t.uses,
  }));
}

export async function listQaChecklists(): Promise<QaChecklist[]> {
  const db = await createClient();
  const res = await db.from("qa_checklists").select("id, name, services, items, active").order("name");
  return rows(res).map((c) => ({ id: c.id, name: c.name, services: c.services ?? [], items: c.items ?? [], active: c.active }));
}

/**
 * Tickets waiting for review, split into mine (I'm the reviewer) and the rest of my department
 * (owner in my department; everyone when `all`). Waiting time comes from the open review round.
 */
export async function reviewQueue(me: { id: string; departmentId: string | null }, all: boolean) {
  const db = await createClient();
  const [tk, staff, projects, open] = await Promise.all([
    db.from("tickets").select("id, key, title, assignee_id, reviewer_id, project_id, review_round, updated_at").eq("status", "in_review").limit(500),
    listStaff(),
    db.from("projects").select("id, name"),
    db.from("reviews").select("ticket_id, round, submitted_at").eq("status", "waiting"),
  ]);
  const person = new Map(staff.map((m) => [m.id, m]));
  const projectName = new Map(rows(projects).map((p) => [p.id as string, p.name as string]));
  const since = new Map(rows(open).map((r) => [r.ticket_id as string, r.submitted_at as string]));

  const toRow = (t: Row): QueueRow => ({
    ticketId: t.id,
    key: t.key,
    title: t.title,
    round: Math.max(1, t.review_round ?? 1),
    owner: person.get(t.assignee_id)?.name ?? "Unassigned",
    project: projectName.get(t.project_id) ?? "No project",
    reviewer: person.get(t.reviewer_id)?.name ?? "Not set",
    waitingSince: since.get(t.id) ?? t.updated_at,
  });
  const oldest = (a: QueueRow, b: QueueRow) => a.waitingSince.localeCompare(b.waitingSince);

  const list = rows(tk);
  const mine = list.filter((t) => t.reviewer_id === me.id).map(toRow).sort(oldest);
  const team = list
    .filter((t) => t.reviewer_id !== me.id)
    .filter((t) => all || (me.departmentId != null && person.get(t.assignee_id)?.departmentId === me.departmentId))
    .map(toRow)
    .sort(oldest);
  return { mine, team };
}

/** Review rounds decided on or after `since` (YYYY-MM-DD). RLS limits them to the user's scope. */
export async function reviewFacts(since: string): Promise<ReviewFact[]> {
  const db = await createClient();
  const res = await db
    .from("reviews")
    .select("ticket_id, round, status, reasons, submitted_at, decided_at, owner_id, department_id, client_id")
    .gte("decided_at", `${since}T00:00:00+04:00`)
    .limit(10000);
  return rows(res).map((r) => ({ ...r, reasons: r.reasons ?? [] })) as ReviewFact[];
}

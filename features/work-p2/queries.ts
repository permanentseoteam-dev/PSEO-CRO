import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { addDays, rangeStart, splitTerms, type RangeKey } from "./logic";
import {
  DEFAULT_SETTINGS,
  type Capacity,
  type ClientCard,
  type Dependency,
  type HandledAlert,
  type LoadTicket,
  type Option,
  type Person,
  type RecurringRule,
  type ReviewRound,
  type ScopeFlag,
  type ScopeTerms,
  type TicketLite,
  type WorkloadSettings,
} from "./types";

// Reads run as the signed-in user, so RLS decides what comes back. A missing table or error reads as empty.
// Phase 1 tables are read by the names in docs/PLAN.md; column names follow lib/modules/home/queries.ts:
//   tickets (0106): id, key, title, description, status, assignee_id, project_id, due_date, start_date, estimate_min, tags, client_visible
//   ticket_watchers (0106): ticket_id, member_id      attachments (0106): id, ticket_id, name
//   projects (0107): id, key, name, client_id, department_id      templates (0107): id, title|name
//   reviews (0107): ticket_id, round, status, reasons, submitted_at|created_at, decided_at
//   qa_results (0107): review_id, label|item, passed      clients / client_terms (0108): in_scope, out_of_scope
type DB = Awaited<ReturnType<typeof createClient>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const rows = (res: { data: unknown; error: unknown }): Row[] => (res.error || !res.data ? [] : (res.data as Row[]));
const one = (res: { data: unknown; error: unknown }): Row | null => (res.error || !res.data ? null : (res.data as Row));

export const todayIso = () => new Date().toISOString().slice(0, 10);

async function staff(db: DB): Promise<Person[]> {
  const res = await db.from("members").select("id, name, department_id, manager_id").eq("kind", "staff").eq("status", "active").order("name");
  return rows(res).map((m) => ({ id: m.id, name: m.name, departmentId: m.department_id ?? null, managerId: m.manager_id ?? null }));
}

const lite = (t: Row): TicketLite => ({ id: t.id, key: t.key, title: t.title, status: t.status });

// ---------------------------------------------------------------- workload
export async function getWorkloadData(monday: string) {
  const db = await createClient();
  const [people, departments, caps, settings, handled, open] = await Promise.all([
    staff(db),
    db.from("departments").select("id, name").order("name"),
    db.from("member_capacity").select("member_id, weekly_hours, workdays"),
    db.from("workload_settings").select("overloaded_pct, overdue_count, has_room_pct, default_estimate_min").maybeSingle(),
    db.from("workload_alerts").select("id, member_id, week_start, kind, moved_ticket_id, moved_from, moved_to").eq("week_start", monday),
    // select * so a ticket column added or renamed by 0106 (start_date, estimate_min) never breaks the read.
    db.from("tickets").select("*").neq("status", "done").not("assignee_id", "is", null).limit(2000),
  ]);
  const tickets: LoadTicket[] = rows(open).map((t) => ({
    id: t.id,
    key: t.key,
    title: t.title,
    assigneeId: t.assignee_id ?? null,
    estimateMin: t.estimate_min ?? null,
    start: t.start_date ?? null,
    due: t.due_date ?? null,
  }));
  return {
    people,
    departments: rows(departments) as Option[],
    capacities: rows(caps).map((c): Capacity => ({ member_id: c.member_id, weekly_hours: Number(c.weekly_hours), workdays: c.workdays ?? [] })),
    settings: (one(settings) as WorkloadSettings | null) ?? DEFAULT_SETTINGS,
    handled: rows(handled) as HandledAlert[],
    tickets,
  };
}

// ---------------------------------------------------------------- recurring
export async function getRecurringData() {
  const db = await createClient();
  const [rules, projects, people, templates, clients] = await Promise.all([
    db.from("recurring_ticket_rules").select("*").order("created_at"),
    db.from("projects").select("id, name, client_id").order("name"),
    staff(db),
    db.from("templates").select("*").limit(200),
    db.from("clients").select("id, name"),
  ]);
  const clientName = new Map(rows(clients).map((c) => [c.id as string, c.name as string]));
  return {
    rules: rows(rules) as RecurringRule[],
    projects: rows(projects).map((p) => ({ id: p.id as string, name: p.name as string, clientName: p.client_id ? (clientName.get(p.client_id) ?? null) : null })),
    people: people.map(({ id, name }) => ({ id, name })),
    templates: rows(templates)
      .filter((t) => t.active !== false)
      .map((t) => ({ id: t.id as string, name: (t.name ?? t.title ?? "Template") as string, pattern: (t.title_pattern ?? t.title ?? "") as string })),
  };
}

// ---------------------------------------------------------------- ticket page
export async function getTicket(ticketId: string) {
  const db = await createClient();
  return one(await db.from("tickets").select("*").eq("id", ticketId).maybeSingle());
}

export async function getDependencies(ticketId: string): Promise<{ blockedBy: Dependency[]; blocks: Dependency[] }> {
  const db = await createClient();
  const [up, down] = await Promise.all([
    db.from("ticket_blockers").select("id, blocked_by_id").eq("ticket_id", ticketId),
    db.from("ticket_blockers").select("id, ticket_id").eq("blocked_by_id", ticketId),
  ]);
  const ids = [...rows(up).map((r) => r.blocked_by_id), ...rows(down).map((r) => r.ticket_id)];
  const tickets = ids.length ? rows(await db.from("tickets").select("id, key, title, status").in("id", ids)) : [];
  const byId = new Map(tickets.map((t) => [t.id as string, lite(t)]));
  const pick = (list: Row[], col: string) => list.filter((r) => byId.has(r[col])).map((r) => ({ id: r.id as string, ticket: byId.get(r[col])! }));
  return { blockedBy: pick(rows(up), "blocked_by_id"), blocks: pick(rows(down), "ticket_id") };
}

/** Every blocker edge, for the loop check when adding one. */
export async function getBlockerEdges() {
  const db = await createClient();
  return rows(await db.from("ticket_blockers").select("ticket_id, blocked_by_id")).map((e) => ({ ticketId: e.ticket_id as string, blockedById: e.blocked_by_id as string }));
}

export async function getTicketPeople(ticketId: string) {
  const db = await createClient();
  const [people, co, watch] = await Promise.all([
    staff(db),
    db.from("ticket_co_assignees").select("member_id").eq("ticket_id", ticketId),
    db.from("ticket_watchers").select("member_id").eq("ticket_id", ticketId),
  ]);
  return {
    people: people.map(({ id, name }) => ({ id, name })),
    coAssignees: rows(co).map((r) => r.member_id as string),
    watchers: rows(watch).map((r) => r.member_id as string),
  };
}

async function projectClient(db: DB, projectId: string | null) {
  if (!projectId) return null;
  const p = one(await db.from("projects").select("client_id").eq("id", projectId).maybeSingle());
  return (p?.client_id as string | undefined) ?? null;
}

export async function getClientCardData(ticketId: string) {
  const db = await createClient();
  const ticket = await getTicket(ticketId);
  if (!ticket) return null;
  const clientId = await projectClient(db, ticket.project_id ?? null);
  const [card, files] = await Promise.all([
    db.from("ticket_client_cards").select("show_in_portal, client_title, client_details, needs_approval, shared_file_ids").eq("ticket_id", ticketId).maybeSingle(),
    db.from("attachments").select("*").eq("ticket_id", ticketId),
  ]);
  const c = one(card);
  const value: ClientCard = c
    ? {
        show_in_portal: Boolean(c.show_in_portal),
        client_title: c.client_title ?? "",
        client_details: c.client_details ?? "",
        needs_approval: Boolean(c.needs_approval),
        shared_file_ids: c.shared_file_ids ?? [],
      }
    : { show_in_portal: Boolean(ticket.client_visible), client_title: ticket.title ?? "", client_details: "", needs_approval: false, shared_file_ids: [] };
  return {
    clientId,
    card: value,
    files: rows(files).map((f) => ({ id: f.id as string, name: (f.name ?? f.file_name ?? f.path ?? "File") as string })),
  };
}

export async function getScopeData(ticketId: string) {
  const db = await createClient();
  const ticket = await getTicket(ticketId);
  if (!ticket) return null;
  const clientId = await projectClient(db, ticket.project_id ?? null);
  if (!clientId) return { clientId: null, text: "", terms: { inScope: [], outOfScope: [] } as ScopeTerms, flag: null };
  const [terms, flag] = await Promise.all([
    db.from("client_terms").select("*").eq("client_id", clientId).limit(1).maybeSingle(),
    db.from("ticket_scope_flags").select("status, reason, matched_term, flagged_by").eq("ticket_id", ticketId).maybeSingle(),
  ]);
  const t = one(terms);
  const f = one(flag);
  const by = f?.flagged_by ? one(await db.from("members").select("name").eq("id", f.flagged_by).maybeSingle()) : null;
  return {
    clientId,
    text: [ticket.title, ticket.description, ...(Array.isArray(ticket.tags) ? ticket.tags : [])].filter(Boolean).join(" \n"),
    terms: { inScope: splitTerms(t?.in_scope), outOfScope: splitTerms(t?.out_of_scope) },
    flag: f ? ({ status: f.status, reason: f.reason ?? null, matched_term: f.matched_term ?? null, flagged_by_name: (by?.name as string) ?? null } as ScopeFlag) : null,
  };
}

// ---------------------------------------------------------------- quality report
/** Cached per request: the Services tab, Most revised tab and failed-checks panel share one read. */
export const getQualityData = cache(async (range: RangeKey, today: string) => {
  const db = await createClient();
  const since = rangeStart(range, today);
  const reviews = rows(await db.from("reviews").select("*").gte("created_at", since).lte("created_at", `${addDays(today, 1)}T00:00:00Z`).limit(5000));
  const rounds: ReviewRound[] = reviews.map((r) => ({
    ticketId: r.ticket_id,
    round: Number(r.round ?? 1),
    status: r.status,
    reasons: Array.isArray(r.reasons) ? r.reasons : [],
    submittedAt: r.submitted_at ?? r.created_at,
    decidedAt: r.decided_at ?? r.reviewed_at ?? null,
  }));
  const ticketIds = [...new Set(rounds.map((r) => r.ticketId))];
  const reviewIds = reviews.map((r) => r.id as string);
  const [tickets, results, departments, people] = await Promise.all([
    ticketIds.length ? db.from("tickets").select("id, key, title, assignee_id, project_id").in("id", ticketIds) : Promise.resolve({ data: [], error: null }),
    reviewIds.length ? db.from("qa_results").select("*").in("review_id", reviewIds) : Promise.resolve({ data: [], error: null }),
    db.from("departments").select("id, name"),
    staff(db),
  ]);
  const ts = rows(tickets);
  const projectIds = [...new Set(ts.map((t) => t.project_id).filter(Boolean))];
  const projects = projectIds.length ? rows(await db.from("projects").select("id, department_id").in("id", projectIds)) : [];
  const deptName = new Map(rows(departments).map((d) => [d.id as string, d.name as string]));
  const projectDept = new Map(projects.map((p) => [p.id as string, p.department_id as string | null]));
  const name = new Map(people.map((p) => [p.id, p.name]));
  return {
    rounds,
    tickets: new Map(
      ts.map((t) => [
        t.id as string,
        {
          key: t.key as string,
          title: t.title as string,
          owner: t.assignee_id ? (name.get(t.assignee_id) ?? null) : null,
          service: deptName.get(projectDept.get(t.project_id) ?? "") ?? null,
        },
      ]),
    ),
    results: rows(results).map((r) => ({ label: String(r.label ?? r.item ?? r.check ?? ""), passed: Boolean(r.passed ?? r.ok ?? r.done) })),
  };
});

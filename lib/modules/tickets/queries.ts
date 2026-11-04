import "server-only";
import { createClient } from "@/lib/supabase/server";
import { can, type Me } from "@/lib/auth/can";
import type {
  Attachment, ChecklistItem, Comment, HistoryItem, Person, PriorityLevel, ProjectOpt, ReviewRound, SavedView, Subtask,
  TicketDetail, TicketRow, TicketStatus,
} from "./types";

// Reads `projects` (0107_work: id, key, name) without an embed, since its FK to tickets may not exist yet.
// A missing table reads as empty.

type DB = Awaited<ReturnType<typeof createClient>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const rows = (res: { data: unknown; error: unknown }): Row[] => (res.error || !res.data ? [] : (res.data as Row[]));

const LIST_COLS = "id, key, title, status, priority, assignee_id, co_assignee_ids, reporter_id, project_id, parent_id, due_date, tags, updated_at";

function toRow(t: Row, checks?: Map<string, [number, number]>): TicketRow {
  const c = checks?.get(t.id) ?? [0, 0];
  return {
    id: t.id,
    key: t.key,
    title: t.title,
    status: t.status as TicketStatus,
    priority: t.priority as PriorityLevel,
    assigneeId: t.assignee_id,
    coAssigneeIds: t.co_assignee_ids ?? [],
    reporterId: t.reporter_id,
    projectId: t.project_id,
    parentId: t.parent_id,
    due: t.due_date,
    tags: t.tags ?? [],
    updatedAt: t.updated_at,
    checkDone: c[0],
    checkTotal: c[1],
  };
}

/** Every ticket the user can see (RLS limits it), with checklist counts when asked. */
export async function listTickets(withChecklist: boolean): Promise<TicketRow[]> {
  const db = await createClient();
  const [tickets, checks] = await Promise.all([
    db.from("tickets").select(LIST_COLS).order("created_at", { ascending: false }).limit(3000),
    withChecklist ? db.from("checklist_items").select("ticket_id, done").limit(50000) : Promise.resolve({ data: [], error: null }),
  ]);
  const counts = new Map<string, [number, number]>();
  for (const c of rows(checks)) {
    const cur = counts.get(c.ticket_id) ?? [0, 0];
    counts.set(c.ticket_id, [cur[0] + (c.done ? 1 : 0), cur[1] + 1]);
  }
  return rows(tickets).map((t) => toRow(t, counts));
}

export async function listPeople(): Promise<Person[]> {
  const db = await createClient();
  const res = await db.from("members").select("id, name").eq("kind", "staff").eq("status", "active").order("name");
  return rows(res).map((m) => ({ id: m.id, name: m.name }));
}

export async function listProjects(): Promise<ProjectOpt[]> {
  const db = await createClient();
  const res = await db.from("projects").select("id, key, name").order("key");
  return rows(res).map((p) => ({ id: p.id, key: p.key, name: p.name }));
}

/** People in my team for the "My team" filter: my department plus my direct reports. */
export async function myTeamIds(me: Me): Promise<string[]> {
  const db = await createClient();
  const or = [`manager_id.eq.${me.id}`];
  if (me.departmentId) or.push(`department_id.eq.${me.departmentId}`);
  const res = await db.from("members").select("id").eq("kind", "staff").or(or.join(","));
  return [...new Set([me.id, ...rows(res).map((m) => m.id as string)])];
}

export async function listSavedViews(meId: string): Promise<SavedView[]> {
  const db = await createClient();
  const res = await db.from("saved_filters").select("id, name, query, shared, member_id").order("name");
  return rows(res).map((v) => ({ id: v.id, name: v.name, query: v.query, shared: v.shared, mine: v.member_id === meId }));
}

async function names(db: DB, ids: (string | null | undefined)[]) {
  const uniq = [...new Set(ids.filter(Boolean))] as string[];
  if (!uniq.length) return new Map<string, string>();
  const res = await db.from("members").select("id, name").in("id", uniq);
  return new Map(rows(res).map((m) => [m.id as string, m.name as string]));
}

/** Full ticket page data, or null when it doesn't exist or isn't visible. */
export async function getTicket(key: string, me: Me): Promise<TicketDetail | null> {
  const db = await createClient();
  const { data: t } = await db.from("tickets").select("*").eq("key", key.toUpperCase()).maybeSingle();
  if (!t) return null;
  const id = t.id as string;

  const [checks, subs, files, comments, history, watchers, reads, time, timer, project, parent] = await Promise.all([
    db.from("checklist_items").select("id, label, done, position").eq("ticket_id", id).order("position").order("created_at"),
    db.from("tickets").select("id, key, title, status, assignee_id").eq("parent_id", id).order("created_at"),
    db.from("attachments").select("id, path, name, size_bytes, mime, uploaded_by, created_at").eq("ticket_id", id).order("created_at"),
    db.from("comments").select("id, author_id, body, is_update, to_client, from_client, edited_at, created_at").eq("ticket_id", id).order("created_at", { ascending: false }),
    db.from("ticket_history").select("id, actor_id, field, old_value, new_value, created_at").eq("ticket_id", id).order("created_at", { ascending: false }).limit(200),
    db.from("ticket_watchers").select("member_id").eq("ticket_id", id),
    db.from("ticket_reads").select("member_id, read_at").eq("ticket_id", id),
    db.from("time_entries").select("minutes").eq("ticket_id", id),
    db.from("timers").select("id, ticket_id, started_at").eq("member_id", me.id).maybeSingle(),
    t.project_id ? db.from("projects").select("id, key, name").eq("id", t.project_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
    t.parent_id ? db.from("tickets").select("key, title").eq("id", t.parent_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ]);

  const fileRows = rows(files);
  const signed = fileRows.length
    ? await db.storage.from("ticket-files").createSignedUrls(fileRows.map((f) => f.path as string), 3600)
    : { data: [] };
  const urlByPath = new Map((signed.data ?? []).map((s) => [s.path, s.signedUrl]));

  const watcherIds = rows(watchers).map((w) => w.member_id as string);
  const commentRows = rows(comments);
  const historyRows = rows(history);
  const readRows = rows(reads);
  const who = await names(db, [
    t.reporter_id, ...(t.co_assignee_ids ?? []), ...watcherIds,
    ...commentRows.map((c) => c.author_id), ...historyRows.map((h) => h.actor_id), ...rows(subs).map((s) => s.assignee_id),
    ...fileRows.map((f) => f.uploaded_by),
  ]);
  const nm = (id: string | null) => (id ? who.get(id) ?? "Someone" : "Someone");

  const rounds: ReviewRound[] = historyRows
    .filter((h) => h.field === "review_back")
    .reverse()
    .map((h, i) => ({ round: i + 1, by: nm(h.actor_id), reasons: h.old_value ?? "", note: h.new_value ?? "", at: h.created_at }));

  const tm = timer.data as Row | null;
  const editable = me.kind === "staff" && (
    can(me, "tickets.manage", "all") ||
    (can(me, "tickets.manage") && [t.assignee_id, t.reporter_id, ...(t.co_assignee_ids ?? [])].includes(me.id)) ||
    can(me, "tickets.manage", "team")
  );

  return {
    id,
    key: t.key,
    title: t.title,
    description: t.description,
    doneWhen: t.done_when,
    status: t.status,
    priority: t.priority,
    assigneeId: t.assignee_id,
    coAssignees: (t.co_assignee_ids ?? []).map(nm),
    reporter: t.reporter_id ? nm(t.reporter_id) : null,
    reviewerId: t.reviewer_id,
    reviewRound: t.review_round ?? 0,
    projectId: t.project_id,
    project: project.data ? { id: project.data.id, key: project.data.key, name: project.data.name } : null,
    parent: parent.data ? { key: parent.data.key, title: parent.data.title } : null,
    due: t.due_date,
    start: t.start_date,
    estimateMin: t.estimate_min,
    tags: t.tags ?? [],
    source: t.source,
    createdAt: t.created_at,
    checklist: rows(checks) as ChecklistItem[],
    subtasks: rows(subs).map((s): Subtask => ({ id: s.id, key: s.key, title: s.title, status: s.status, assignee: s.assignee_id ? nm(s.assignee_id) : null })),
    attachments: fileRows.map((f): Attachment => ({
      id: f.id, name: f.name, size: f.size_bytes, mime: f.mime, url: urlByPath.get(f.path) ?? null,
      uploadedBy: f.uploaded_by ? nm(f.uploaded_by) : null, createdAt: f.created_at,
    })),
    comments: commentRows.map((c): Comment => ({
      id: c.id, authorId: c.author_id, author: nm(c.author_id), body: c.body, isUpdate: c.is_update, toClient: c.to_client,
      fromClient: c.from_client, editedAt: c.edited_at, createdAt: c.created_at,
      seenBy: readRows.filter((r) => r.member_id !== c.author_id && r.read_at >= c.created_at).length,
    })),
    history: historyRows.map((h): HistoryItem => ({ id: h.id, actor: nm(h.actor_id), field: h.field, oldValue: h.old_value, newValue: h.new_value, createdAt: h.created_at })),
    rounds,
    watchers: watcherIds.map(nm),
    watching: watcherIds.includes(me.id),
    loggedMin: rows(time).reduce((a, r) => a + (r.minutes as number), 0),
    timer: tm && tm.ticket_id === id ? { id: tm.id, startedAt: tm.started_at } : null,
    canEdit: editable,
    canDelete: editable && (can(me, "tickets.manage", "team") || t.reporter_id === me.id),
    canModerate: can(me, "tickets.manage", "all"),
  };
}

/** Names for history lines that store member ids (assignee changes). */
export async function memberNameMap(ids: (string | null)[]) {
  const db = await createClient();
  return names(db, ids);
}

/** Active ticket templates (0107_work owns the table; read loosely, empty if it isn't there yet). */
export async function listTemplates(): Promise<{ id: string; title: string; priority: string | null; dueInDays: number | null }[]> {
  const db = await createClient();
  const res = await db.from("templates").select("*").limit(200);
  return rows(res)
    .filter((t) => t.active !== false)
    .map((t) => ({ id: t.id, title: t.title ?? t.name ?? "Template", priority: t.priority ?? null, dueInDays: t.due_in_days ?? null }));
}

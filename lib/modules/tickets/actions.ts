"use server";
// Ticket writes. Other modules import createTicket, logTime, startTimer and stopTimer from here.
// Every action: zod parse -> can() check -> Supabase write (RLS is the real guard) -> revalidate.
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getMe, can, type Me } from "@/lib/auth/can";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fileProblem, minutesBetween, parseDuration, todayIn } from "./logic";
import type { Result } from "./types";

const BAD = { ok: false as const, error: "Check the form and try again." };
const NO = { ok: false as const, error: "You don't have access to do that." };
const fail = (e: { message: string } | null | undefined, fallback = "Something went wrong. Try again.") => ({ ok: false as const, error: e?.message ?? fallback });

const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const status = z.enum(["todo", "in_progress", "in_review", "blocked", "done"]);
const priority = z.enum(["urgent", "high", "normal", "low"]);
const tags = z.array(z.string().trim().min(1).max(40)).max(20);

function refresh() {
  revalidatePath("/", "layout");
}

async function staff(): Promise<Me | null> {
  const me = await getMe();
  return me && me.kind === "staff" ? me : null;
}

async function history(ticketId: string, actorId: string, field: string, oldValue: string | null, newValue: string | null) {
  const db = await createClient();
  await db.from("ticket_history").insert({ ticket_id: ticketId, actor_id: actorId, field, old_value: oldValue, new_value: newValue });
}

// ---------------------------------------------------------------- create

const NewTicket = z.object({
  title: z.string().trim().min(2).max(200),
  projectId: uuid.nullable().optional(),
  assigneeId: uuid.nullable().optional(),
  priority: priority.default("normal"),
  due: date.nullable().optional(),
  description: z.string().max(10000).optional(),
  doneWhen: z.string().max(2000).optional(),
  tags: tags.optional(),
  parentId: uuid.nullable().optional(),
  templateId: uuid.nullable().optional(),
  source: z.string().max(200).optional(),
});

/** Creates a ticket (key comes from the project, e.g. CPD-156). Applies a template's checklist and subtasks. */
export async function createTicket(raw: unknown): Promise<Result<{ id: string; key: string }>> {
  const p = NewTicket.safeParse(raw);
  if (!p.success) return BAD;
  const me = await staff();
  if (!me || !can(me, "tickets.manage")) return NO;
  const d = p.data;
  const db = await createClient();

  let checklist: string[] = [];
  let subtasks: string[] = [];
  if (d.templateId) {
    // templates is owned by 0107_work; read loosely so a column change doesn't break creation.
    const { data: tpl } = await db.from("templates").select("*").eq("id", d.templateId).maybeSingle();
    const labels = (v: unknown) =>
      Array.isArray(v)
        ? v.map((x) => (typeof x === "string" ? x : (x as { label?: string; title?: string })?.label ?? (x as { title?: string })?.title ?? "")).filter(Boolean)
        : [];
    if (tpl) {
      checklist = labels((tpl as Record<string, unknown>).checklist);
      subtasks = labels((tpl as Record<string, unknown>).subtasks);
    }
  }

  const { data, error } = await db
    .from("tickets")
    .insert({
      title: d.title,
      project_id: d.projectId ?? null,
      parent_id: d.parentId ?? null,
      assignee_id: d.assigneeId ?? null,
      reporter_id: me.id,
      priority: d.priority,
      status: "todo",
      due_date: d.due ?? null,
      description: d.description?.trim() || null,
      done_when: d.doneWhen?.trim() || null,
      tags: d.tags ?? [],
      source: d.source ?? null,
    })
    .select("id, key")
    .single();
  if (error || !data) return fail(error);

  if (checklist.length) {
    await db.from("checklist_items").insert(checklist.slice(0, 100).map((label, i) => ({ ticket_id: data.id, label: label.slice(0, 300), position: i })));
  }
  for (const title of subtasks.slice(0, 30)) {
    await db.from("tickets").insert({
      title: title.slice(0, 200), project_id: d.projectId ?? null, parent_id: data.id, reporter_id: me.id,
      assignee_id: d.assigneeId ?? null, priority: d.priority, status: "todo",
    });
  }
  refresh();
  return { ok: true, data: { id: data.id as string, key: data.key as string } };
}

/** Adds a subtask under a ticket, in the same project. */
export async function addSubtask(raw: unknown): Promise<Result<{ id: string; key: string }>> {
  const p = z.object({ parentId: uuid, title: z.string().trim().min(2).max(200), assigneeId: uuid.nullable().optional() }).safeParse(raw);
  if (!p.success) return BAD;
  const db = await createClient();
  const { data: parent } = await db.from("tickets").select("project_id, priority").eq("id", p.data.parentId).maybeSingle();
  if (!parent) return { ok: false, error: "That ticket no longer exists." };
  return createTicket({
    title: p.data.title, parentId: p.data.parentId, projectId: parent.project_id, assigneeId: p.data.assigneeId ?? null, priority: parent.priority,
  });
}

// ---------------------------------------------------------------- update

const Patch = z
  .object({
    title: z.string().trim().min(2).max(200),
    description: z.string().max(10000).nullable(),
    doneWhen: z.string().max(2000).nullable(),
    status,
    priority,
    assigneeId: uuid.nullable(),
    due: date.nullable(),
    start: date.nullable(),
    estimateMin: z.number().int().min(0).max(100000).nullable(),
    tags,
    projectId: uuid.nullable(),
  })
  .partial();

const COLS: Record<keyof z.infer<typeof Patch>, string> = {
  title: "title", description: "description", doneWhen: "done_when", status: "status", priority: "priority",
  assigneeId: "assignee_id", due: "due_date", start: "start_date", estimateMin: "estimate_min", tags: "tags", projectId: "project_id",
};

function toColumns(patch: z.infer<typeof Patch>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) if (v !== undefined) out[COLS[k as keyof typeof COLS]] = typeof v === "string" && k !== "title" ? v.trim() || null : v;
  return out;
}

/** Updates one or more fields on a ticket (side panel, title, description, board drag, calendar drag). */
export async function updateTicket(raw: unknown): Promise<Result> {
  const p = z.object({ id: uuid, patch: Patch }).safeParse(raw);
  if (!p.success) return BAD;
  const me = await staff();
  if (!me || !can(me, "tickets.manage")) return NO;
  const cols = toColumns(p.data.patch);
  if (!Object.keys(cols).length) return { ok: true };
  const db = await createClient();
  const { data, error } = await db.from("tickets").update(cols).eq("id", p.data.id).select("id");
  if (error) return fail(error);
  if (!data?.length) return { ok: false, error: "You can't edit this ticket." };
  refresh();
  return { ok: true };
}

/** Bulk bar: same change on many tickets. Returns how many were updated (RLS may skip some). */
export async function bulkUpdate(raw: unknown): Promise<Result<{ updated: number }>> {
  const p = z
    .object({ ids: z.array(uuid).min(1).max(500), patch: Patch.pick({ status: true, priority: true, assigneeId: true, due: true, projectId: true }) })
    .safeParse(raw);
  if (!p.success) return BAD;
  const me = await staff();
  if (!me || !can(me, "tickets.manage")) return NO;
  const cols = toColumns(p.data.patch);
  if (!Object.keys(cols).length) return { ok: false, error: "Pick a change to apply." };
  const db = await createClient();
  const { data, error } = await db.from("tickets").update(cols).in("id", p.data.ids).select("id");
  if (error) return fail(error);
  refresh();
  return { ok: true, data: { updated: data?.length ?? 0 } };
}

export async function deleteTicket(raw: unknown): Promise<Result> {
  const id = uuid.safeParse(raw);
  if (!id.success) return BAD;
  const me = await staff();
  if (!me || !can(me, "tickets.manage")) return NO;
  const db = await createClient();
  const { data: files } = await db.from("attachments").select("path").eq("ticket_id", id.data);
  const { data, error } = await db.from("tickets").delete().eq("id", id.data).select("id");
  if (error) return fail(error);
  if (!data?.length) return { ok: false, error: "You can't delete this ticket." };
  if (files?.length) await db.storage.from("ticket-files").remove(files.map((f) => f.path as string));
  refresh();
  return { ok: true };
}

/** "Copy to…": a new ticket in a project, optionally with checklist, subtasks and assignees. */
export async function copyTicket(raw: unknown): Promise<Result<{ key: string }>> {
  const p = z
    .object({ id: uuid, projectId: uuid.nullable(), title: z.string().trim().min(2).max(200), checklist: z.boolean(), subtasks: z.boolean(), assignees: z.boolean() })
    .safeParse(raw);
  if (!p.success) return BAD;
  const d = p.data;
  const db = await createClient();
  const { data: src } = await db.from("tickets").select("*").eq("id", d.id).maybeSingle();
  if (!src) return { ok: false, error: "That ticket no longer exists." };
  const made = await createTicket({
    title: d.title, projectId: d.projectId, priority: src.priority, due: src.due_date, description: src.description ?? "",
    doneWhen: src.done_when ?? "", tags: src.tags ?? [], assigneeId: d.assignees ? src.assignee_id : null, source: `Copied from ${src.key}`,
  });
  if (!made.ok || !made.data) return made.ok ? BAD : made;
  const newId = made.data.id;
  if (d.assignees && src.co_assignee_ids?.length) await db.from("tickets").update({ co_assignee_ids: src.co_assignee_ids }).eq("id", newId);
  if (d.checklist) {
    const { data: items } = await db.from("checklist_items").select("label, position").eq("ticket_id", d.id).order("position");
    if (items?.length) await db.from("checklist_items").insert(items.map((i) => ({ ticket_id: newId, label: i.label, position: i.position })));
  }
  if (d.subtasks) {
    const { data: subs } = await db.from("tickets").select("title, priority, assignee_id").eq("parent_id", d.id);
    for (const s of subs ?? []) {
      await createTicket({ title: s.title, parentId: newId, projectId: d.projectId, priority: s.priority, assigneeId: d.assignees ? s.assignee_id : null });
    }
  }
  refresh();
  return { ok: true, data: { key: made.data.key } };
}

// ---------------------------------------------------------------- checklist

export async function addChecklistItem(raw: unknown): Promise<Result> {
  const p = z.object({ ticketId: uuid, label: z.string().trim().min(1).max(300) }).safeParse(raw);
  if (!p.success) return BAD;
  const me = await staff();
  if (!me || !can(me, "tickets.manage")) return NO;
  const db = await createClient();
  const { data: last } = await db.from("checklist_items").select("position").eq("ticket_id", p.data.ticketId).order("position", { ascending: false }).limit(1).maybeSingle();
  const { error } = await db.from("checklist_items").insert({ ticket_id: p.data.ticketId, label: p.data.label, position: (last?.position ?? -1) + 1 });
  if (error) return fail(error);
  refresh();
  return { ok: true };
}

export async function toggleChecklistItem(raw: unknown): Promise<Result> {
  const p = z.object({ id: uuid, done: z.boolean() }).safeParse(raw);
  if (!p.success) return BAD;
  const me = await staff();
  if (!me || !can(me, "tickets.manage")) return NO;
  const db = await createClient();
  const { data, error } = await db.from("checklist_items").update({ done: p.data.done }).eq("id", p.data.id).select("ticket_id, label").maybeSingle();
  if (error) return fail(error);
  if (!data) return { ok: false, error: "You can't edit this checklist." };
  if (p.data.done) await history(data.ticket_id, me.id, "checklist", null, data.label);
  refresh();
  return { ok: true };
}

/** Saves a new order: ids top to bottom. */
export async function reorderChecklist(raw: unknown): Promise<Result> {
  const p = z.object({ ticketId: uuid, ids: z.array(uuid).max(500) }).safeParse(raw);
  if (!p.success) return BAD;
  const me = await staff();
  if (!me || !can(me, "tickets.manage")) return NO;
  const db = await createClient();
  const results = await Promise.all(
    p.data.ids.map((id, position) => db.from("checklist_items").update({ position }).eq("id", id).eq("ticket_id", p.data.ticketId)),
  );
  const err = results.find((r) => r.error)?.error;
  if (err) return fail(err);
  refresh();
  return { ok: true };
}

export async function deleteChecklistItem(raw: unknown): Promise<Result> {
  const id = uuid.safeParse(raw);
  if (!id.success) return BAD;
  const me = await staff();
  if (!me || !can(me, "tickets.manage")) return NO;
  const db = await createClient();
  const { error } = await db.from("checklist_items").delete().eq("id", id.data);
  if (error) return fail(error);
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------- comments, watch, reads

export async function postComment(raw: unknown): Promise<Result> {
  const p = z.object({ ticketId: uuid, body: z.string().trim().min(1).max(10000), isUpdate: z.boolean(), toClient: z.boolean() }).safeParse(raw);
  if (!p.success) return BAD;
  const me = await staff();
  if (!me) return NO;
  const db = await createClient();
  const { error } = await db.from("comments").insert({
    ticket_id: p.data.ticketId, author_id: me.id, body: p.data.body, is_update: p.data.isUpdate, to_client: p.data.toClient,
  });
  if (error) return fail(error);
  await db.from("ticket_reads").upsert({ ticket_id: p.data.ticketId, member_id: me.id, read_at: new Date().toISOString() });
  refresh();
  return { ok: true };
}

/** Only the author edits. */
export async function editComment(raw: unknown): Promise<Result> {
  const p = z.object({ id: uuid, body: z.string().trim().min(1).max(10000) }).safeParse(raw);
  if (!p.success) return BAD;
  const me = await staff();
  if (!me) return NO;
  const db = await createClient();
  const { data, error } = await db
    .from("comments")
    .update({ body: p.data.body, edited_at: new Date().toISOString() })
    .eq("id", p.data.id)
    .eq("author_id", me.id)
    .select("id");
  if (error) return fail(error);
  if (!data?.length) return { ok: false, error: "Only the author can edit this comment." };
  refresh();
  return { ok: true };
}

/** The author or a moderator (tickets.manage all) deletes. */
export async function deleteComment(raw: unknown): Promise<Result> {
  const id = uuid.safeParse(raw);
  if (!id.success) return BAD;
  const me = await staff();
  if (!me) return NO;
  const db = await createClient();
  const { data, error } = await db.from("comments").delete().eq("id", id.data).select("id");
  if (error) return fail(error);
  if (!data?.length) return { ok: false, error: "You can't delete this comment." };
  refresh();
  return { ok: true };
}

export async function setWatching(raw: unknown): Promise<Result> {
  const p = z.object({ ticketId: uuid, on: z.boolean() }).safeParse(raw);
  if (!p.success) return BAD;
  const me = await staff();
  if (!me || !can(me, "tickets.view")) return NO;
  const db = await createClient();
  const { error } = p.data.on
    ? await db.from("ticket_watchers").upsert({ ticket_id: p.data.ticketId, member_id: me.id })
    : await db.from("ticket_watchers").delete().eq("ticket_id", p.data.ticketId).eq("member_id", me.id);
  if (error) return fail(error);
  refresh();
  return { ok: true };
}

/** Marks the ticket read by me now (drives "Seen by N"). Called when the page opens. */
export async function markRead(raw: unknown): Promise<Result> {
  const id = uuid.safeParse(raw);
  if (!id.success) return BAD;
  const me = await staff();
  if (!me) return NO;
  const db = await createClient();
  const { error } = await db.from("ticket_reads").upsert({ ticket_id: id.data, member_id: me.id, read_at: new Date().toISOString() });
  return error ? fail(error) : { ok: true };
}

// ---------------------------------------------------------------- files

/** Records a file the browser already uploaded to Storage at "<ticketId>/<name>". */
export async function addAttachment(raw: unknown): Promise<Result> {
  const p = z
    .object({ ticketId: uuid, path: z.string().min(3).max(300), name: z.string().min(1).max(200), size: z.number().int().min(0), mime: z.string().max(120).nullable() })
    .safeParse(raw);
  if (!p.success) return BAD;
  const d = p.data;
  if (!d.path.startsWith(`${d.ticketId}/`)) return BAD;
  const problem = fileProblem(d.name, d.size);
  if (problem) return { ok: false, error: problem };
  const me = await staff();
  if (!me) return NO;
  const db = await createClient();
  const { error } = await db.from("attachments").insert({ ticket_id: d.ticketId, path: d.path, name: d.name, size_bytes: d.size, mime: d.mime, uploaded_by: me.id });
  if (error) {
    await db.storage.from("ticket-files").remove([d.path]);
    return fail(error);
  }
  await history(d.ticketId, me.id, "file", null, d.name);
  refresh();
  return { ok: true };
}

export async function deleteAttachment(raw: unknown): Promise<Result> {
  const id = uuid.safeParse(raw);
  if (!id.success) return BAD;
  const me = await staff();
  if (!me) return NO;
  const db = await createClient();
  const { data, error } = await db.from("attachments").delete().eq("id", id.data).select("path");
  if (error) return fail(error);
  if (!data?.length) return { ok: false, error: "You can't delete this file." };
  await db.storage.from("ticket-files").remove(data.map((f) => f.path as string));
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------- review (basic; 0107_work owns full rounds and QA lists)

export async function submitForReview(raw: unknown): Promise<Result> {
  const p = z.object({ ticketId: uuid, reviewerId: uuid, note: z.string().max(2000) }).safeParse(raw);
  if (!p.success) return BAD;
  const me = await staff();
  if (!me || !can(me, "tickets.manage")) return NO;
  if (p.data.reviewerId === me.id) return { ok: false, error: "Pick someone else to review your work." };
  const db = await createClient();
  const { data: t } = await db.from("tickets").select("review_round").eq("id", p.data.ticketId).maybeSingle();
  if (!t) return { ok: false, error: "That ticket no longer exists." };
  const { data, error } = await db
    .from("tickets")
    .update({ status: "in_review", reviewer_id: p.data.reviewerId, review_round: (t.review_round ?? 0) + 1 })
    .eq("id", p.data.ticketId)
    .select("id");
  if (error) return fail(error);
  if (!data?.length) return { ok: false, error: "You can't edit this ticket." };
  await history(p.data.ticketId, me.id, "review_submit", null, p.data.note.trim() || null);
  refresh();
  return { ok: true };
}

/** The reviewer (or a manager with full access) approves or sends back. The reviewer may not otherwise edit the ticket. */
async function reviewerDb(ticketId: string, me: Me) {
  const db = await createClient();
  const { data: t } = await db.from("tickets").select("reviewer_id, status").eq("id", ticketId).maybeSingle();
  if (!t) return null;
  const isReviewer = t.reviewer_id === me.id;
  if (!isReviewer && !can(me, "tickets.manage", "all")) return null;
  return { db: isReviewer && !can(me, "tickets.manage", "all") ? createAdminClient() : db, status: t.status as string };
}

export async function approveReview(raw: unknown): Promise<Result> {
  const id = uuid.safeParse(raw);
  if (!id.success) return BAD;
  const me = await staff();
  if (!me) return NO;
  const r = await reviewerDb(id.data, me);
  if (!r) return { ok: false, error: "Only the reviewer can approve this." };
  if (r.status !== "in_review") return { ok: false, error: "This ticket isn't waiting for review." };
  const { error } = await r.db.from("tickets").update({ status: "done" }).eq("id", id.data);
  if (error) return fail(error);
  await history(id.data, me.id, "review_approve", null, null);
  refresh();
  return { ok: true };
}

export async function sendBack(raw: unknown): Promise<Result> {
  const p = z.object({ ticketId: uuid, reasons: z.array(z.string().max(40)).min(1).max(5), note: z.string().trim().min(3).max(2000) }).safeParse(raw);
  if (!p.success) return { ok: false, error: "Pick at least one reason and say what to change." };
  const me = await staff();
  if (!me) return NO;
  const r = await reviewerDb(p.data.ticketId, me);
  if (!r) return { ok: false, error: "Only the reviewer can send this back." };
  if (r.status !== "in_review") return { ok: false, error: "This ticket isn't waiting for review." };
  const { error } = await r.db.from("tickets").update({ status: "in_progress" }).eq("id", p.data.ticketId);
  if (error) return fail(error);
  await history(p.data.ticketId, me.id, "review_back", p.data.reasons.join(", "), p.data.note);
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------- time (used by the Time module and the shell)

const LogTime = z.object({
  ticketId: uuid.nullable(),
  date: date.optional(),
  /** Minutes, or text like "1h 30m". */
  minutes: z.union([z.number().int().min(1).max(1440), z.string().max(20)]),
  billable: z.boolean().default(true),
  note: z.string().max(500).optional(),
});

export async function logTime(raw: unknown): Promise<Result<{ minutes: number }>> {
  const p = LogTime.safeParse(raw);
  if (!p.success) return BAD;
  const minutes = typeof p.data.minutes === "number" ? p.data.minutes : parseDuration(p.data.minutes);
  if (!minutes || minutes > 1440) return { ok: false, error: "Enter time like 1h 30m (up to 24h)." };
  const me = await staff();
  if (!me) return NO;
  const db = await createClient();
  const { error } = await db.from("time_entries").insert({
    member_id: me.id, ticket_id: p.data.ticketId, date: p.data.date ?? todayIn(), minutes, billable: p.data.billable, note: p.data.note?.trim() || null,
  });
  if (error) return fail(error);
  if (p.data.ticketId) await history(p.data.ticketId, me.id, "time", null, String(minutes));
  refresh();
  return { ok: true, data: { minutes } };
}

/** Starts my timer on a ticket (or with no ticket). A running timer is stopped and logged first. */
export async function startTimer(raw: unknown): Promise<Result<{ id: string; startedAt: string }>> {
  const p = z.object({ ticketId: uuid.nullable(), note: z.string().max(200).optional() }).safeParse(raw);
  if (!p.success) return BAD;
  const me = await staff();
  if (!me) return NO;
  const db = await createClient();
  const { data: running } = await db.from("timers").select("id").eq("member_id", me.id).maybeSingle();
  if (running) {
    const stopped = await stopTimer(running.id);
    if (!stopped.ok) return stopped;
  }
  const { data, error } = await db
    .from("timers")
    .insert({ member_id: me.id, ticket_id: p.data.ticketId, note: p.data.note ?? null })
    .select("id, started_at")
    .single();
  if (error || !data) return fail(error);
  refresh();
  return { ok: true, data: { id: data.id, startedAt: data.started_at } };
}

/** Stops my timer and logs whole minutes (under 1 minute logs nothing). */
export async function stopTimer(raw: unknown): Promise<Result<{ minutes: number }>> {
  const id = uuid.safeParse(raw);
  if (!id.success) return BAD;
  const me = await staff();
  if (!me) return NO;
  const db = await createClient();
  const { data: t } = await db.from("timers").select("id, ticket_id, started_at, note").eq("id", id.data).eq("member_id", me.id).maybeSingle();
  if (!t) return { ok: false, error: "That timer has already stopped." };
  const minutes = Math.min(1440, minutesBetween(t.started_at, new Date()));
  if (minutes > 0) {
    const { error } = await db.from("time_entries").insert({
      member_id: me.id, ticket_id: t.ticket_id, date: todayIn(), minutes, billable: true, note: t.note,
    });
    if (error) return fail(error);
    if (t.ticket_id) await history(t.ticket_id, me.id, "time", null, String(minutes));
  }
  const { error } = await db.from("timers").delete().eq("id", t.id);
  if (error) return fail(error);
  refresh();
  return { ok: true, data: { minutes } };
}

// ---------------------------------------------------------------- saved views

export async function saveView(raw: unknown): Promise<Result> {
  const p = z.object({ name: z.string().trim().min(1).max(80), query: z.string().max(1000), shared: z.boolean() }).safeParse(raw);
  if (!p.success) return BAD;
  const me = await staff();
  if (!me) return NO;
  const db = await createClient();
  const { error } = await db.from("saved_filters").insert({
    member_id: me.id, name: p.data.name, query: p.data.query.replace(/^\?/, ""), shared: p.data.shared && !!me.departmentId,
    department_id: p.data.shared ? me.departmentId : null,
  });
  if (error) return fail(error);
  refresh();
  return { ok: true };
}

export async function deleteView(raw: unknown): Promise<Result> {
  const id = uuid.safeParse(raw);
  if (!id.success) return BAD;
  const me = await staff();
  if (!me) return NO;
  const db = await createClient();
  const { error } = await db.from("saved_filters").delete().eq("id", id.data).eq("member_id", me.id);
  if (error) return fail(error);
  refresh();
  return { ok: true };
}

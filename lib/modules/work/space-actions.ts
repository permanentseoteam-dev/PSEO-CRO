"use server";
// Project workspace writes. zod parse -> can() check -> Supabase write (RLS is the real guard) -> revalidate.
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getMe, can, type Me } from "@/lib/auth/can";
import { createClient } from "@/lib/supabase/server";
import { saveProject } from "@/app/(app)/projects/actions";
import { createTicket } from "@/lib/modules/tickets/actions";
import { normalizeKey } from "./logic";
import { suggestKey } from "./space-logic";
import type { Result } from "./types";

type Fail = { ok: false; error: string };
const BAD: Fail = { ok: false, error: "Check the form and try again." };
const NO: Fail = { ok: false, error: "You don't have access to do that." };
const fail = (e: { code?: string; message: string } | null | undefined): Fail =>
  e?.code === "42501" ? NO : { ok: false, error: e?.message ?? "Something went wrong. Try again." };

const uuid = z.string().uuid();
const typeId = z.string().trim().regex(/^[a-z0-9_-]{1,40}$/);
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const TypeItem = z.object({ id: typeId, name: z.string().trim().min(1).max(40), color: hex });
const Status = z.object({ label: z.string().trim().min(1).max(40), emoji: z.string().trim().min(1).max(16) });
const Statuses = z.object({ todo: Status, in_progress: Status, in_review: Status, blocked: Status, done: Status });
const uniqueIds = (list: { id: string }[]) => new Set(list.map((t) => t.id)).size === list.length;
const Types = z.array(TypeItem).max(30).refine(uniqueIds);
const WorkConfigInput = z.object({
  statuses: Statuses,
  taskTypes: Types,
  eventTypes: Types,
});
const ProjectConfigInput = z.object({
  statuses: z
    .object({ todo: Status.partial(), in_progress: Status.partial(), in_review: Status.partial(), blocked: Status.partial(), done: Status.partial() })
    .partial()
    .optional(),
  taskTypes: Types.optional(),
  eventTypes: Types.optional(),
});

function refresh() {
  revalidatePath("/projects");
  revalidatePath("/", "layout");
}

async function staff(): Promise<Me | null> {
  const me = await getMe();
  return me && me.kind === "staff" ? me : null;
}

async function projectManager(): Promise<Me | null> {
  const me = await staff();
  return me && can(me, "work.projects.manage", "team") ? me : null;
}

// ---------------------------------------------------------------- folders

export async function createFolder(raw: unknown): Promise<Result> {
  const p = z.object({ name: z.string().trim().min(1).max(80) }).safeParse(raw);
  if (!p.success) return BAD;
  if (!(await projectManager())) return NO;
  const db = await createClient();
  const { error } = await db.from("project_folders").insert({ name: p.data.name });
  if (error) return fail(error);
  refresh();
  return { ok: true };
}

export async function renameFolder(raw: unknown): Promise<Result> {
  const p = z.object({ id: uuid, name: z.string().trim().min(1).max(80) }).safeParse(raw);
  if (!p.success) return BAD;
  if (!(await projectManager())) return NO;
  const db = await createClient();
  const { data, error } = await db.from("project_folders").update({ name: p.data.name }).eq("id", p.data.id).select("id");
  if (error) return fail(error);
  if (!data?.length) return NO;
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------- projects

/** New project with an automatic key; the creator leads it (so 'team' managers pass the projects RLS). */
export async function createSpaceProject(raw: unknown): Promise<{ ok: true; key: string } | Fail> {
  const p = z.object({ name: z.string().trim().min(2).max(120), folderId: uuid.nullable().optional() }).safeParse(raw);
  if (!p.success) return BAD;
  const me = await projectManager();
  if (!me) return NO;
  const db = await createClient();
  const { data: keys } = await db.from("projects").select("key");
  const key = suggestKey(p.data.name, (keys ?? []).map((k) => k.key as string));

  const saved = await saveProject({
    id: null, name: p.data.name, key, departmentId: me.departmentId, clientId: null, leadId: me.id, reviewerId: null,
    description: "", reviewRequired: false, status: "active",
  });
  if (!saved.ok) return saved;
  if (p.data.folderId) {
    const { error } = await db.from("projects").update({ folder_id: p.data.folderId }).eq("key", key);
    if (error) return fail(error);
  }
  refresh();
  return { ok: true, key };
}

export async function moveProjectToFolder(raw: unknown): Promise<Result> {
  const p = z.object({ projectId: uuid, folderId: uuid.nullable() }).safeParse(raw);
  if (!p.success) return BAD;
  if (!(await projectManager())) return NO;
  const db = await createClient();
  const { data, error } = await db.from("projects").update({ folder_id: p.data.folderId }).eq("id", p.data.projectId).select("id");
  if (error) return fail(error);
  if (!data?.length) return { ok: false, error: "You can only manage projects led by your team." };
  refresh();
  return { ok: true };
}

/**
 * Renames a project and/or changes its key. Ticket keys are set once at insert from projects.key
 * (0106 tickets_before_write), so existing tasks keep their old keys; only new tasks use the new one.
 */
export async function updateProjectDetails(raw: unknown): Promise<Result> {
  const p = z.object({ projectId: uuid, name: z.string().trim().min(2).max(120), key: z.string().trim().min(2).max(8) }).safeParse(raw);
  if (!p.success) return BAD;
  const key = normalizeKey(p.data.key);
  if (!key) return { ok: false, error: "The key must be 2 to 8 letters." };
  if (!(await projectManager())) return NO;
  const db = await createClient();
  const { data, error } = await db.from("projects").update({ name: p.data.name, key }).eq("id", p.data.projectId).select("id");
  if (error?.code === "23505") return { ok: false, error: `The key ${key} is already used by another project.` };
  if (error) return fail(error);
  if (!data?.length) return { ok: false, error: "You can only manage projects led by your team." };
  refresh();
  return { ok: true };
}

/** Deletes a project for good: its notes and recurring rules go with it; its tickets stay, without a project. */
export async function deleteProject(raw: unknown): Promise<Result> {
  const p = z.object({ projectId: uuid }).safeParse(raw);
  if (!p.success) return BAD;
  if (!(await projectManager())) return NO;
  const db = await createClient();
  const { data, error } = await db.from("projects").delete().eq("id", p.data.projectId).select("id");
  if (error) return fail(error);
  if (!data?.length) return { ok: false, error: "You can only manage projects led by your team." };
  refresh();
  return { ok: true };
}

/** Inherit the workspace settings, or use the project's own. Omitting config keeps the stored one. */
export async function setProjectConfig(raw: unknown): Promise<Result> {
  const p = z.object({ projectId: uuid, mode: z.enum(["inherit", "custom"]), config: ProjectConfigInput.optional() }).safeParse(raw);
  if (!p.success) return BAD;
  if (!(await projectManager())) return NO;
  const db = await createClient();
  const patch = p.data.config ? { config_mode: p.data.mode, config: p.data.config } : { config_mode: p.data.mode };
  const { data, error } = await db.from("projects").update(patch).eq("id", p.data.projectId).select("id");
  if (error) return fail(error);
  if (!data?.length) return { ok: false, error: "You can only manage projects led by your team." };
  refresh();
  return { ok: true };
}

/** Workspace task settings; admins only. */
export async function setWorkConfig(raw: unknown): Promise<Result> {
  const p = WorkConfigInput.safeParse(raw);
  if (!p.success) return BAD;
  const me = await staff();
  if (!me || !can(me, "admin.access.manage", "all")) return NO;
  const db = await createClient();
  const { data, error } = await db.from("work_config").update({ config: p.data }).eq("id", true).select("id");
  if (error) return fail(error);
  if (!data?.length) return NO;
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------- tasks

/** Quick-add a task to a project through the normal ticket path (key, history, notifications). */
export async function createProjectTask(raw: unknown): Promise<{ ok: true; key: string } | Fail> {
  const p = z.object({ projectId: uuid, title: z.string().trim().min(2).max(200) }).safeParse(raw);
  if (!p.success) return BAD;
  const res = await createTicket({ title: p.data.title, projectId: p.data.projectId });
  if (!res.ok) return res;
  refresh();
  return { ok: true, key: res.data!.key };
}

export async function setTicketType(raw: unknown): Promise<Result> {
  const p = z.object({ ticketId: uuid, typeId: z.enum(["responsible", "accountable", "consulted", "informed"]) }).safeParse(raw);
  if (!p.success) return BAD;
  const me = await staff();
  if (!me || !can(me, "tickets.manage")) return NO;
  const db = await createClient();
  const { data, error } = await db.from("tickets").update({ type_id: p.data.typeId }).eq("id", p.data.ticketId).select("id");
  if (error) return fail(error);
  if (!data?.length) return NO;
  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------- notes

export async function createNote(raw: unknown): Promise<{ ok: true; id: string } | Fail> {
  const p = z.object({ projectId: uuid, title: z.string().trim().min(1).max(200) }).safeParse(raw);
  if (!p.success) return BAD;
  const me = await staff();
  if (!me) return NO;
  const db = await createClient();
  const { data, error } = await db
    .from("project_notes")
    .insert({ project_id: p.data.projectId, title: p.data.title, author_id: me.id })
    .select("id")
    .single();
  if (error || !data) return fail(error);
  refresh();
  return { ok: true, id: data.id as string };
}

export async function updateNote(raw: unknown): Promise<Result> {
  const p = z.object({ id: uuid, title: z.string().trim().min(1).max(200), body: z.string().max(100000) }).safeParse(raw);
  if (!p.success) return BAD;
  if (!(await staff())) return NO;
  const db = await createClient();
  const { data, error } = await db.from("project_notes").update({ title: p.data.title, body: p.data.body }).eq("id", p.data.id).select("id");
  if (error) return fail(error);
  if (!data?.length) return { ok: false, error: "Only the author or a project manager can edit this note." };
  refresh();
  return { ok: true };
}

export async function deleteNote(raw: unknown): Promise<Result> {
  const p = z.object({ id: uuid }).safeParse(raw);
  if (!p.success) return BAD;
  if (!(await staff())) return NO;
  const db = await createClient();
  const { data, error } = await db.from("project_notes").delete().eq("id", p.data.id).select("id");
  if (error) return fail(error);
  if (!data?.length) return { ok: false, error: "Only the author or a project manager can delete this note." };
  refresh();
  return { ok: true };
}

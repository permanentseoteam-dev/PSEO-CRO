import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getMe, can } from "@/lib/auth/can";
import { DEFAULT_WORK_CONFIG, effectiveConfig } from "./space-logic";
import type { ConfigMode, ProjectNote, ProjectSpace, ProjectTask, SidebarProject, SidebarProjects, StatusKey, WorkConfig } from "./space-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const rows = (res: { data: unknown; error: unknown }): Row[] => (res.error || !res.data ? [] : (res.data as Row[]));

async function memberNames(ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((x): x is string => !!x))];
  if (!unique.length) return new Map();
  const db = await createClient();
  return new Map(rows(await db.from("members").select("id, name").in("id", unique)).map((m) => [m.id as string, m.name as string]));
}

/** Active projects for the sidebar, grouped by folder; both ordered by position, then name. */
export async function listSidebarProjects(): Promise<SidebarProjects> {
  const db = await createClient();
  const [folders, projects] = await Promise.all([
    db.from("project_folders").select("id, name").order("position").order("name"),
    db.from("projects").select("id, key, name, folder_id").eq("status", "active").order("position").order("name"),
  ]);
  const byFolder = new Map<string, SidebarProject[]>();
  const loose: SidebarProject[] = [];
  for (const p of rows(projects)) {
    const item = { id: p.id, key: p.key, name: p.name };
    if (p.folder_id) byFolder.set(p.folder_id, [...(byFolder.get(p.folder_id) ?? []), item]);
    else loose.push(item);
  }
  return { folders: rows(folders).map((f) => ({ id: f.id, name: f.name, projects: byFolder.get(f.id) ?? [] })), loose };
}

/** Workspace task settings (defaults fill anything missing). */
export async function getWorkConfig(): Promise<WorkConfig> {
  const db = await createClient();
  const { data } = await db.from("work_config").select("config").eq("id", true).maybeSingle();
  return effectiveConfig(DEFAULT_WORK_CONFIG, "custom", data?.config);
}

export async function getProjectSpace(key: string): Promise<ProjectSpace | null> {
  const db = await createClient();
  const [{ data: p }, workspace, me] = await Promise.all([
    db.from("projects").select("id, key, name, description, folder_id, lead_id, config_mode, config").eq("key", key.toUpperCase()).maybeSingle(),
    getWorkConfig(),
    getMe(),
  ]);
  if (!p) return null;
  let canManage = !!me && me.kind === "staff" && can(me, "work.projects.manage", "all");
  if (!canManage && me?.kind === "staff" && can(me, "work.projects.manage", "team") && p.lead_id) {
    const { data } = await db.rpc("in_my_team", { target: p.lead_id });
    canManage = data === true;
  }
  const mode = p.config_mode as ConfigMode;
  return {
    id: p.id,
    key: p.key,
    name: p.name,
    description: p.description,
    folderId: p.folder_id,
    configMode: mode,
    config: effectiveConfig(workspace, mode, p.config),
    canManage,
  };
}

const TASK_COLS = "id, key, title, status, priority, due_date, assignee_id, type_id, estimate_min, created_at, completed_at, parent_id";

/** A project's top-level tickets, newest first, then their subtasks (oldest first). RLS limits to tickets the user can see. */
export async function listProjectTasks(projectId: string): Promise<ProjectTask[]> {
  const db = await createClient();
  const top = rows(
    await db.from("tickets").select(TASK_COLS).eq("project_id", projectId).is("parent_id", null).order("created_at", { ascending: false }).limit(2000),
  );
  // Subtasks by parent id, not project id: a subtask keeps whatever project it had when created.
  const ids = top.map((t) => t.id as string);
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 200) chunks.push(ids.slice(i, i + 200));
  const subs = (
    await Promise.all(chunks.map((c) => db.from("tickets").select(TASK_COLS).in("parent_id", c).order("created_at", { ascending: true })))
  ).flatMap(rows);
  const list = [...top, ...subs];
  const names = await memberNames(list.map((t) => t.assignee_id));
  return list.map((t) => ({
    id: t.id,
    key: t.key,
    title: t.title,
    status: t.status as StatusKey,
    priority: t.priority,
    dueDate: t.due_date,
    assigneeId: t.assignee_id,
    assigneeName: names.get(t.assignee_id) ?? null,
    typeId: t.type_id,
    estimateMin: t.estimate_min,
    createdAt: t.created_at,
    completedAt: t.completed_at,
    parentId: t.parent_id,
  }));
}

/** A project's notes, last edited first. */
export async function listProjectNotes(projectId: string): Promise<ProjectNote[]> {
  const db = await createClient();
  const list = rows(
    await db.from("project_notes").select("id, title, body, author_id, updated_at").eq("project_id", projectId).order("updated_at", { ascending: false }),
  );
  const names = await memberNames(list.map((n) => n.author_id));
  return list.map((n) => ({ id: n.id, title: n.title, body: n.body, authorName: names.get(n.author_id) ?? null, updatedAt: n.updated_at }));
}

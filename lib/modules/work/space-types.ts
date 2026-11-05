// Types for the project workspace (sidebar projects, folders, tasks, notes, settings).

export type StatusKey = "todo" | "in_progress" | "in_review" | "blocked" | "done";

export type TaskType = { id: string; name: string; color: string };
export type EventType = { id: string; name: string; color: string };

/** Workspace task settings. The status list is fixed; config only renames them and sets their emoji. */
export type WorkConfig = {
  statuses: Record<StatusKey, { label: string; emoji: string }>;
  taskTypes: TaskType[];
  eventTypes: EventType[];
};

export type ConfigMode = "inherit" | "custom";

export type SidebarProject = { id: string; key: string; name: string };
export type SidebarProjects = { folders: { id: string; name: string; projects: SidebarProject[] }[]; loose: SidebarProject[] };

export type ProjectSpace = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  folderId: string | null;
  configMode: ConfigMode;
  /** Effective config: workspace config, with the project's own merged over it in custom mode. */
  config: WorkConfig;
  canManage: boolean;
};

export type ProjectTask = {
  id: string;
  key: string;
  title: string;
  status: StatusKey;
  priority: "urgent" | "high" | "normal" | "low";
  dueDate: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  typeId: string | null;
  estimateMin: number | null;
  createdAt: string;
  completedAt: string | null;
  /** Main task id for subtasks; null for main tasks. */
  parentId: string | null;
};

export type ProjectNote = { id: string; title: string; body: string; authorName: string | null; updatedAt: string };

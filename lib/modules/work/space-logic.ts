// Pure helpers for the project workspace. No I/O.
import type { ConfigMode, StatusKey, TaskType, WorkConfig } from "./space-types";

export const STATUS_KEYS: StatusKey[] = ["todo", "in_progress", "in_review", "blocked", "done"];

/** Fixed RACI options; legacy workspace/project custom types cannot add choices. */
export const TASK_TYPES: TaskType[] = [
  { id: "responsible", name: "Responsible", color: "#ef4444" },
  { id: "accountable", name: "Accountable", color: "#3b82f6" },
  { id: "consulted", name: "Consulted", color: "#eab308" },
  { id: "informed", name: "Informed", color: "#22c55e" },
];
export const DEFAULT_WORK_CONFIG: WorkConfig = {
  statuses: {
    todo: { label: "New task", emoji: "✉️" },
    in_progress: { label: "In progress", emoji: "🛠️" },
    in_review: { label: "In review", emoji: "👀" },
    blocked: { label: "Blocked", emoji: "⛔" },
    done: { label: "Completed", emoji: "✅" },
  },
  taskTypes: TASK_TYPES,
  eventTypes: [
    { id: "meeting", name: "Meeting", color: "#cfe3ff" },
    { id: "phone_call", name: "Phone call", color: "#d4f0e7" },
  ],
};

const str = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";

function typeList(v: unknown): TaskType[] | null {
  if (!Array.isArray(v)) return null;
  return v
    .filter((t) => t && str(t.id) && str(t.name) && str(t.color))
    .map((t) => ({ id: t.id as string, name: t.name as string, color: t.color as string }));
}

/**
 * The config a project uses. Inherit: the workspace's. Custom: whatever the project sets
 * (per status label/emoji, or a whole type list) over the workspace's; anything missing or malformed falls back.
 */
export function effectiveConfig(workspace: WorkConfig, mode: ConfigMode, projectConfig: unknown): WorkConfig {
  const base = workspace.taskTypes === TASK_TYPES ? workspace : { ...workspace, taskTypes: TASK_TYPES };
  if (mode !== "custom" || !projectConfig || typeof projectConfig !== "object") return base;
  const p = projectConfig as Record<string, unknown>;
  const ps = (p.statuses && typeof p.statuses === "object" ? p.statuses : {}) as Record<string, Record<string, unknown> | undefined>;
  const statuses = {} as WorkConfig["statuses"];
  for (const k of STATUS_KEYS) {
    const s = ps[k];
    statuses[k] = {
      label: str(s?.label) ? s.label : workspace.statuses[k].label,
      emoji: str(s?.emoji) ? s.emoji : workspace.statuses[k].emoji,
    };
  }
  return {
    statuses,
    taskTypes: TASK_TYPES,
    eventTypes: typeList(p.eventTypes) ?? workspace.eventTypes,
  };
}

/** A free project key for a name: 2 to 8 upper-case letters, not in `taken`. */
export function suggestKey(name: string, taken: string[]): string {
  const used = new Set(taken.map((k) => k.toUpperCase()));
  const words = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .split(/[^A-Z]+/)
    .filter(Boolean);
  const letters = words.join("") || "PR";
  const initials = words.map((w) => w[0]).join("");
  let base = (initials.length >= 2 ? initials : letters).slice(0, 4);
  if (base.length < 2) base = (base + letters + "PR").slice(0, 2);

  const tries: string[] = [base];
  for (let n = base.length + 1; n <= Math.min(8, letters.length); n++) tries.push(letters.slice(0, n));
  for (const t of tries) if (!used.has(t)) return t;

  const stem = base.slice(0, 6);
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (const a of A) if (!used.has(stem + a)) return stem + a;
  for (const a of A) for (const b of A) if (!used.has(stem + a + b)) return stem + a + b;
  return stem; // 702 clashes on one stem: give up and let the unique index report it
}

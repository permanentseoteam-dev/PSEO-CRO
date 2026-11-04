import type { PriorityLevel, TicketStatus } from "@/components/ui";

export type { PriorityLevel, TicketStatus };

export type Person = { id: string; name: string };
export type ProjectOpt = { id: string; key: string; name: string };

/** A ticket as the list, board and calendar need it. */
export type TicketRow = {
  id: string;
  key: string;
  title: string;
  status: TicketStatus;
  priority: PriorityLevel;
  assigneeId: string | null;
  coAssigneeIds: string[];
  reporterId: string | null;
  projectId: string | null;
  parentId: string | null;
  due: string | null;
  tags: string[];
  updatedAt: string;
  checkDone: number;
  checkTotal: number;
};

export type View = "list" | "board" | "cal";
export type StatusTab = "active" | TicketStatus;
export type DueFilter = "" | "overdue" | "today" | "week" | "none";
export type GroupBy = "" | "status" | "assignee" | "project" | "priority" | "due";
export type SortBy = "due" | "priority" | "updated" | "key";

/** Every filter lives in the query string. */
export type Filters = {
  view: View;
  st: StatusTab;
  q: string;
  /** "", "me", "team", "none" or a member id. */
  who: string;
  pri: "" | PriorityLevel;
  due: DueFilter;
  tag: string;
  proj: string;
  group: GroupBy;
  sort: SortBy;
  /** Calendar month, YYYY-MM. */
  month: string;
};

export type SavedView = { id: string; name: string; query: string; shared: boolean; mine: boolean };

export type ChecklistItem = { id: string; label: string; done: boolean; position: number };
export type Subtask = { id: string; key: string; title: string; status: TicketStatus; assignee: string | null };
export type Attachment = { id: string; name: string; size: number; mime: string | null; url: string | null; uploadedBy: string | null; createdAt: string };
export type Comment = {
  id: string;
  authorId: string | null;
  author: string;
  body: string;
  isUpdate: boolean;
  toClient: boolean;
  fromClient: boolean;
  editedAt: string | null;
  createdAt: string;
  seenBy: number;
};
export type HistoryItem = { id: string; actor: string; field: string; oldValue: string | null; newValue: string | null; createdAt: string };
export type ReviewRound = { round: number; by: string; reasons: string; note: string; at: string };

export type TicketDetail = {
  id: string;
  key: string;
  title: string;
  description: string | null;
  doneWhen: string | null;
  status: TicketStatus;
  priority: PriorityLevel;
  assigneeId: string | null;
  coAssignees: string[];
  reporter: string | null;
  reviewerId: string | null;
  reviewRound: number;
  projectId: string | null;
  project: ProjectOpt | null;
  parent: { key: string; title: string } | null;
  due: string | null;
  start: string | null;
  estimateMin: number | null;
  tags: string[];
  source: string | null;
  createdAt: string;
  checklist: ChecklistItem[];
  subtasks: Subtask[];
  attachments: Attachment[];
  comments: Comment[];
  history: HistoryItem[];
  rounds: ReviewRound[];
  watchers: string[];
  watching: boolean;
  loggedMin: number;
  timer: { id: string; startedAt: string } | null;
  canEdit: boolean;
  canDelete: boolean;
  canModerate: boolean;
};

export type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

import type { PriorityLevel } from "@/components/ui";

export type Option = { id: string; name: string };

export type Project = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  departmentId: string | null;
  clientId: string | null;
  leadId: string | null;
  reviewerId: string | null;
  reviewRequired: boolean;
  status: "active" | "archived";
};

export type ProjectCard = Project & {
  department: string;
  client: string;
  lead: string;
  open: number;
  overdue: number;
  done30: number;
  canEdit: boolean;
};

export type Subtask = { title: string; due_offset_days: number | null };

export type Template = {
  id: string;
  name: string;
  service: string;
  titlePattern: string;
  departmentId: string | null;
  defaultAssigneeId: string | null;
  priority: PriorityLevel;
  dueInDays: number | null;
  estimateMin: number | null;
  qaChecklistId: string | null;
  description: string | null;
  doneWhen: string | null;
  checklist: string[];
  subtasks: Subtask[];
  tags: string[];
  reviewRequired: boolean;
  active: boolean;
  uses: number;
};

export type QaChecklist = { id: string; name: string; services: string[]; items: string[]; active: boolean };

/** One review round, as the quality maths needs it. */
export type ReviewFact = {
  ticket_id: string;
  round: number;
  status: "waiting" | "approved" | "changes";
  reasons: string[];
  submitted_at: string;
  decided_at: string | null;
  owner_id: string | null;
  department_id: string | null;
  client_id: string | null;
};

export type QualityRow = {
  key: string;
  label: string;
  reviewed: number;
  firstPass: number | null;
  avgRounds: number | null;
  avgWaitH: number | null;
  over24: number;
};

export type QueueRow = {
  ticketId: string;
  key: string;
  title: string;
  round: number;
  owner: string;
  project: string;
  reviewer: string;
  waitingSince: string;
};

export type Result = { ok: true } | { ok: false; error: string };

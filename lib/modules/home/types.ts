import type { PriorityLevel, TicketStatus, Tone } from "@/components/ui";

/** A ticket as Home and My work show it. Dates are yyyy-mm-dd (agency time zone). */
export type MyTicket = {
  id: string;
  key: string;
  title: string;
  status: TicketStatus;
  priority: PriorityLevel;
  assigneeId: string | null;
  assigneeName: string | null;
  reporterId: string | null;
  watching: boolean;
  due: string | null;
  doneOn: string | null;
  projectName: string | null;
  subtasks: number;
  checklistDone: number;
  checklistTotal: number;
  comments: number;
};

export type View = "assigned" | "on" | "watching" | "asked";
export type DueGroup = "overdue" | "today" | "week" | "later" | "none";

/** A calendar event I attend. Times are ISO timestamps. */
export type MyEvent = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  meetLink: string | null;
  clientName: string | null;
  attendees: string[];
};

export type TodayTag = "now" | "soon" | "later";
export type TodayItem = {
  sort: number;
  time: string;
  title: string;
  href: string;
  tag: TodayTag;
  join: string | null;
};

export type Update = {
  id: string;
  actorName: string;
  action: string;
  subject: string | null;
  detail: string | null;
  href: string | null;
  createdAt: string;
  why: "assigned" | "reported" | "watching" | null;
};

export type DeptPanel = {
  open: number;
  overdue: number;
  unassigned: number;
  blocked: number;
  review: number;
  load: { name: string; open: number }[];
};

export type ClientRow = {
  id: string;
  name: string;
  services: string[];
  health: number | null;
  band: string | null;
  open: number;
  report: { label: string; tone: Tone };
  nextMeeting: string | null;
};

export type FinanceRow = { currency: string; outstanding: number; overdue: number };

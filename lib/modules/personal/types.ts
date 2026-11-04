// Row and view types for My profile, Time and Settings.

export type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export type LeaveType = "annual" | "sick" | "wfh" | "unpaid";
export type RequestType = LeaveType | "overtime";
export type RequestStatus = "pending" | "approved" | "declined" | "cancelled";
export type SheetStatus = "open" | "submitted" | "approved" | "returned";
export type DocType = "id" | "visa" | "contract" | "letter" | "education" | "other";
export type NotifEvent = "assigned" | "mention" | "client_reply" | "watch_change" | "review_wait" | "invoice_overdue";

export type Session = { id: string; clockIn: string; clockOut: string | null; breakMinutes: number; breakStartedAt: string | null; wfh: boolean };

export type LeaveRequest = {
  id: string;
  memberId: string;
  type: RequestType;
  start: string;
  end: string;
  halfDay: boolean;
  days: number;
  minutes: number | null;
  reason: string | null;
  status: RequestStatus;
  decidedBy: string | null;
};

export type Balance = { type: LeaveType; allowance: number; per: "year" | "month" };

export type Doc = {
  id: string;
  name: string;
  type: DocType;
  hrOnly: boolean;
  expiresOn: string | null;
  storagePath: string | null;
  createdAt: string;
};

export type Review = {
  id: string;
  quarter: string;
  selfDue: string | null;
  status: "self_review" | "manager_review" | "shared" | "acknowledged";
  reviewer: string | null;
  rating: number | null;
  notes: string | null;
};

export type Profile = {
  id: string;
  name: string;
  title: string | null;
  email: string;
  presence: string;
  department: string | null;
  departmentId: string | null;
  manager: string | null;
  managerId: string | null;
  statusNote: string | null;
  skills: string[];
  phone: string | null;
  joinedOn: string | null;
  shift: string | null;
  bio: string | null;
  linkedin: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  slackUserId: string | null;
  location: string | null;
  contract: "full_time" | "part_time" | "contractor";
  probationStart: string | null;
  probationEnd: string | null;
  probationStatus: "on_probation" | "extended" | "confirmed" | "ended";
  probationConfirmedBy: string | null;
  jobSummary: string | null;
  jobDuties: string[];
  team: string[];
  clients: string[];
  career: { title: string; kind: string; onDate: string }[];
};

export type Entry = {
  id: string;
  memberId: string;
  ticketId: string | null;
  ticketKey: string | null;
  ticketTitle: string | null;
  clientId: string | null;
  date: string;
  minutes: number;
  billable: boolean;
};

export type TicketOpt = { id: string; key: string; title: string; clientId: string | null };

export type Sheet = { id: string; memberId: string; weekStart: string; status: SheetStatus; returnNote: string | null };

export type Person = { id: string; name: string; managerId: string | null; departmentId: string | null };

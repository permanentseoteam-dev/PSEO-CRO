import "server-only";
import { createClient } from "@/lib/supabase/server";
import { addDays } from "./logic";
import type { Balance, Doc, Entry, LeaveRequest, Person, Profile, Review, Session, Sheet, TicketOpt } from "./types";

// Reads tables from other modules: members/departments (core), member_profiles + perf_reviews/review_cycles (0112_team),
// client_team/clients (0108_clients), tickets/time_entries/timers (0106_tickets). A missing table gives empty data.

type Db = Awaited<ReturnType<typeof createClient>>;
const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

/** Instant range covering Dubai dates from..to (inclusive), for timestamptz filters. */
const instantRange = (from: string, to: string) => ({ gte: `${from}T00:00:00+04:00`, lt: `${addDays(to, 1)}T00:00:00+04:00` });

// ---------------------------------------------------------------- profile

export async function getProfile(id: string): Promise<Profile | null> {
  const db = await createClient();
  const [m, prof, det, career, team, clients] = await Promise.all([
    db
      .from("members")
      .select("id, name, title, email, presence, department_id, manager_id, department:departments!members_department_id_fkey(name), manager:members!manager_id(name)")
      .eq("id", id)
      .maybeSingle(),
    db.from("member_profiles").select("status_note, skills, phone, joined_on, shift").eq("member_id", id).maybeSingle(),
    db.from("member_details").select("*").eq("member_id", id).maybeSingle(),
    db.from("career_steps").select("title, kind, on_date").eq("member_id", id).order("on_date", { ascending: false }),
    db.from("members").select("name").eq("manager_id", id).eq("status", "active").order("name"),
    db.from("client_team").select("client:clients(name)").eq("member_id", id),
  ]);
  if (!m.data) return null;
  const r = m.data as unknown as {
    id: string; name: string; title: string | null; email: string; presence: string; department_id: string | null; manager_id: string | null;
    department: { name: string } | { name: string }[] | null; manager: { name: string } | { name: string }[] | null;
  };
  const p = (prof.data ?? {}) as { status_note?: string | null; skills?: string[]; phone?: string | null; joined_on?: string | null; shift?: string | null };
  const d = (det.data ?? {}) as Record<string, unknown>;
  const s = (k: string) => (d[k] as string | null | undefined) ?? null;
  return {
    id: r.id,
    name: r.name,
    title: r.title,
    email: r.email,
    presence: r.presence,
    department: one(r.department)?.name ?? null,
    departmentId: r.department_id,
    manager: one(r.manager)?.name ?? null,
    managerId: r.manager_id,
    statusNote: p.status_note ?? null,
    skills: p.skills ?? [],
    phone: p.phone ?? null,
    joinedOn: p.joined_on ?? null,
    shift: p.shift ?? null,
    bio: s("bio"),
    linkedin: s("linkedin"),
    emergencyName: s("emergency_name"),
    emergencyPhone: s("emergency_phone"),
    slackUserId: s("slack_user_id"),
    location: s("location"),
    contract: (s("contract") ?? "full_time") as Profile["contract"],
    probationStart: s("probation_start"),
    probationEnd: s("probation_end"),
    probationStatus: (s("probation_status") ?? "on_probation") as Profile["probationStatus"],
    probationConfirmedBy: s("probation_confirmed_by"),
    jobSummary: s("job_summary"),
    jobDuties: (d.job_duties as string[] | undefined) ?? [],
    team: ((team.data ?? []) as { name: string }[]).map((t) => t.name),
    clients: ((clients.data ?? []) as unknown as { client: { name: string } | { name: string }[] | null }[])
      .map((c) => one(c.client)?.name)
      .filter((n): n is string => !!n)
      .sort(),
    career: ((career.data ?? []) as { title: string; kind: string; on_date: string }[]).map((c) => ({ title: c.title, kind: c.kind, onDate: c.on_date })),
  };
}

export async function nameOf(id: string | null): Promise<string | null> {
  if (!id) return null;
  const db = await createClient();
  const { data } = await db.from("members").select("name").eq("id", id).maybeSingle();
  return (data as { name: string } | null)?.name ?? null;
}

export async function listStaff(): Promise<Person[]> {
  const db = await createClient();
  const { data } = await db.from("members").select("id, name, manager_id, department_id").eq("kind", "staff").eq("status", "active").order("name");
  return ((data ?? []) as { id: string; name: string; manager_id: string | null; department_id: string | null }[]).map((m) => ({
    id: m.id, name: m.name, managerId: m.manager_id, departmentId: m.department_id,
  }));
}

export async function listDepartments(): Promise<{ id: string; name: string }[]> {
  const db = await createClient();
  const { data } = await db.from("departments").select("id, name").order("name");
  return (data ?? []) as { id: string; name: string }[];
}

// ---------------------------------------------------------------- attendance, leave, documents, reviews

const toSession = (r: { id: string; clock_in: string; clock_out: string | null; break_minutes: number; break_started_at: string | null; wfh: boolean }): Session => ({
  id: r.id, clockIn: r.clock_in, clockOut: r.clock_out, breakMinutes: r.break_minutes, breakStartedAt: r.break_started_at, wfh: r.wfh,
});
const SESSION_COLS = "id, member_id, clock_in, clock_out, break_minutes, break_started_at, wfh";

async function sessions(db: Db, memberIds: string[] | null, from: string, to: string) {
  const r = instantRange(from, to);
  let q = db.from("attendance").select(SESSION_COLS).gte("clock_in", r.gte).lt("clock_in", r.lt).order("clock_in");
  if (memberIds) q = q.in("member_id", memberIds);
  const { data } = await q;
  return ((data ?? []) as (Parameters<typeof toSession>[0] & { member_id: string })[]).map((x) => ({ ...toSession(x), memberId: x.member_id }));
}

export async function getSessions(memberId: string, from: string, to: string): Promise<Session[]> {
  return sessions(await createClient(), [memberId], from, to);
}

export async function getOpenSession(memberId: string): Promise<Session | null> {
  const db = await createClient();
  const { data } = await db.from("attendance").select(SESSION_COLS).eq("member_id", memberId).is("clock_out", null).maybeSingle();
  return data ? toSession(data as Parameters<typeof toSession>[0]) : null;
}

const toRequest = (r: Record<string, unknown>): LeaveRequest => ({
  id: r.id as string,
  memberId: r.member_id as string,
  type: r.type as LeaveRequest["type"],
  start: r.start_date as string,
  end: r.end_date as string,
  halfDay: r.half_day as boolean,
  days: Number(r.days),
  minutes: (r.minutes as number | null) ?? null,
  reason: (r.reason as string | null) ?? null,
  status: r.status as LeaveRequest["status"],
  decidedBy: (r.decided_by as string | null) ?? null,
});

export async function getLeave(memberId: string, year: number): Promise<{ balances: Balance[]; requests: LeaveRequest[] }> {
  const db = await createClient();
  const [b, r] = await Promise.all([
    db.from("leave_balances").select("type, allowance, per").eq("member_id", memberId).eq("year", year),
    db.from("leave_requests").select("*").eq("member_id", memberId).order("start_date", { ascending: false }).limit(100),
  ]);
  return {
    balances: ((b.data ?? []) as { type: Balance["type"]; allowance: number; per: Balance["per"] }[]).map((x) => ({ ...x, allowance: Number(x.allowance) })),
    requests: ((r.data ?? []) as Record<string, unknown>[]).map(toRequest),
  };
}

/** Pending requests from other people that I may decide (RLS limits what I see; I filter out my own). */
export async function pendingLeaveToDecide(meId: string): Promise<(LeaveRequest & { name: string })[]> {
  const db = await createClient();
  const { data } = await db
    .from("leave_requests")
    .select("*, member:members!leave_requests_member_id_fkey(name)")
    .eq("status", "pending")
    .neq("member_id", meId)
    .order("start_date");
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({ ...toRequest(r), name: one(r.member as { name: string } | null)?.name ?? "" }));
}

export async function getDocuments(memberId: string): Promise<Doc[]> {
  const db = await createClient();
  const { data } = await db
    .from("documents")
    .select("id, name, type, hr_only, expires_on, storage_path, created_at")
    .eq("member_id", memberId)
    .order("created_at", { ascending: false });
  return ((data ?? []) as { id: string; name: string; type: Doc["type"]; hr_only: boolean; expires_on: string | null; storage_path: string | null; created_at: string }[]).map((d) => ({
    id: d.id, name: d.name, type: d.type, hrOnly: d.hr_only, expiresOn: d.expires_on, storagePath: d.storage_path, createdAt: d.created_at,
  }));
}

export async function getReviews(memberId: string): Promise<Review[]> {
  const db = await createClient();
  const { data } = await db
    .from("perf_reviews")
    .select("id, status, manager_rating, manager_notes, cycle:review_cycles(quarter, self_due), reviewer:members!perf_reviews_reviewer_id_fkey(name)")
    .eq("member_id", memberId);
  type Row = {
    id: string; status: Review["status"]; manager_rating: number | null; manager_notes: string | null;
    cycle: { quarter: string; self_due: string } | { quarter: string; self_due: string }[] | null;
    reviewer: { name: string } | { name: string }[] | null;
  };
  const rows = ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    quarter: one(r.cycle)?.quarter ?? "",
    selfDue: one(r.cycle)?.self_due ?? null,
    status: r.status,
    reviewer: one(r.reviewer)?.name ?? null,
    rating: r.status === "shared" || r.status === "acknowledged" ? r.manager_rating : null,
    notes: r.status === "shared" || r.status === "acknowledged" ? r.manager_notes : null,
  }));
  // Newest quarter first ("Q4 2026" > "Q3 2026").
  const key = (q: string) => `${q.slice(3)}${q.slice(1, 2)}`;
  return rows.sort((a, b) => key(b.quarter).localeCompare(key(a.quarter)));
}

// ---------------------------------------------------------------- time

const ENTRY_COLS = "id, member_id, ticket_id, date, minutes, billable, ticket:tickets(key, title, client_id)";
type EntryRow = {
  id: string; member_id: string; ticket_id: string | null; date: string; minutes: number; billable: boolean;
  ticket: { key: string; title: string; client_id: string | null } | { key: string; title: string; client_id: string | null }[] | null;
};
const toEntry = (r: EntryRow): Entry => {
  const t = one(r.ticket);
  return { id: r.id, memberId: r.member_id, ticketId: r.ticket_id, ticketKey: t?.key ?? null, ticketTitle: t?.title ?? null, clientId: t?.client_id ?? null, date: r.date, minutes: r.minutes, billable: r.billable };
};

export async function getEntries(memberIds: string[] | null, from: string, to: string): Promise<Entry[]> {
  const db = await createClient();
  let q = db.from("time_entries").select(ENTRY_COLS).gte("date", from).lte("date", to).order("date");
  if (memberIds) q = q.in("member_id", memberIds);
  const { data } = await q;
  return ((data ?? []) as unknown as EntryRow[]).map(toEntry);
}

export async function getSheets(memberIds: string[] | null, weeks: string[]): Promise<Sheet[]> {
  const db = await createClient();
  let q = db.from("timesheets").select("id, member_id, week_start, status, return_note").in("week_start", weeks);
  if (memberIds) q = q.in("member_id", memberIds);
  const { data } = await q;
  return ((data ?? []) as { id: string; member_id: string; week_start: string; status: Sheet["status"]; return_note: string | null }[]).map((s) => ({
    id: s.id, memberId: s.member_id, weekStart: s.week_start, status: s.status, returnNote: s.return_note,
  }));
}

export async function getSessionsFor(memberIds: string[] | null, from: string, to: string) {
  return sessions(await createClient(), memberIds, from, to);
}

/** Submitted timesheets I can see (RLS), not my own. */
export async function submittedSheets(meId: string): Promise<(Sheet & { name: string })[]> {
  const db = await createClient();
  const { data } = await db
    .from("timesheets")
    .select("id, member_id, week_start, status, return_note, member:members!timesheets_member_id_fkey(name)")
    .eq("status", "submitted")
    .neq("member_id", meId)
    .order("week_start");
  return ((data ?? []) as Record<string, unknown>[]).map((s) => ({
    id: s.id as string, memberId: s.member_id as string, weekStart: s.week_start as string, status: s.status as Sheet["status"],
    returnNote: (s.return_note as string | null) ?? null, name: one(s.member as { name: string } | null)?.name ?? "",
  }));
}

/** Open tickets for the timer and the Log time dialog: mine first, then everything else I can see. */
export async function ticketOptions(meId: string): Promise<TicketOpt[]> {
  const db = await createClient();
  const { data } = await db
    .from("tickets")
    .select("id, key, title, client_id, assignee_id, co_assignee_ids")
    .neq("status", "done")
    .order("key")
    .limit(300);
  const rows = (data ?? []) as { id: string; key: string; title: string; client_id: string | null; assignee_id: string | null; co_assignee_ids: string[] }[];
  const mine = (r: (typeof rows)[number]) => r.assignee_id === meId || r.co_assignee_ids?.includes(meId);
  return [...rows.filter(mine), ...rows.filter((r) => !mine(r))].map((r) => ({ id: r.id, key: r.key, title: r.title, clientId: r.client_id }));
}

export async function runningTimer(meId: string): Promise<{ id: string; ticketId: string | null; startedAt: string } | null> {
  const db = await createClient();
  const { data } = await db.from("timers").select("id, ticket_id, started_at").eq("member_id", meId).maybeSingle();
  return data ? { id: data.id as string, ticketId: data.ticket_id as string | null, startedAt: data.started_at as string } : null;
}

export async function clientNames(): Promise<Map<string, string>> {
  const db = await createClient();
  const { data } = await db.from("clients").select("id, name");
  return new Map(((data ?? []) as { id: string; name: string }[]).map((c) => [c.id, c.name]));
}

/** People on approved leave (not WFH/overtime) on a given day. */
export async function onLeave(day: string): Promise<Set<string>> {
  const db = await createClient();
  const { data } = await db
    .from("leave_requests")
    .select("member_id")
    .eq("status", "approved")
    .in("type", ["annual", "sick", "unpaid"])
    .lte("start_date", day)
    .gte("end_date", day);
  return new Set(((data ?? []) as { member_id: string }[]).map((r) => r.member_id));
}

// ---------------------------------------------------------------- settings

export async function getSettings(meId: string) {
  const db = await createClient();
  const [s, n, d] = await Promise.all([
    db.from("user_settings").select("theme, density, email_digest, quiet_from, quiet_to").eq("member_id", meId).maybeSingle(),
    db.from("notification_prefs").select("event, in_app, email, phone").eq("member_id", meId),
    db.from("member_details").select("slack_user_id").eq("member_id", meId).maybeSingle(),
  ]);
  const st = (s.data ?? {}) as { theme?: string; density?: string; email_digest?: string; quiet_from?: string | null; quiet_to?: string | null };
  return {
    theme: (st.theme ?? "system") as "system" | "light" | "dark",
    density: (st.density ?? "comfortable") as "comfortable" | "compact",
    email: (st.email_digest ?? "daily") as "daily" | "urgent" | "off",
    quietFrom: st.quiet_from?.slice(0, 5) ?? "",
    quietTo: st.quiet_to?.slice(0, 5) ?? "",
    notif: (n.data ?? []) as { event: string; in_app: boolean; email: boolean; phone: boolean }[],
    slackUserId: (d.data as { slack_user_id: string | null } | null)?.slack_user_id ?? "",
  };
}


import "server-only";
import { createClient } from "@/lib/supabase/server";
import { balance } from "@/lib/modules/finance/core/logic";
import { settledByInvoice } from "@/lib/modules/finance/core/queries";
import type { PriorityLevel, TicketStatus } from "@/components/ui";
import { dayDiff, localDate, reportStatus, whyFor } from "./logic";
import type { ClientRow, DeptPanel, FinanceRow, MyEvent, MyTicket, Update } from "./types";

// Home reads tables owned by other modules. Column names are kept here so a rename is a one-line fix.
//   tickets          (0106_tickets): id, key, title, status, priority, assignee_id, reporter_id, project_id,
//                                    parent_id, due_date date, completed_at timestamptz, tags text[]
//   ticket_watchers  (0106_tickets): ticket_id, member_id
//   checklist_items  (0106_tickets): ticket_id, done boolean
//   comments         (0106_tickets): ticket_id
//   projects         (0107_work):    id, name, client_id, department_id
//   events           (0104_calendar): id, title, client_id, starts_at, minutes, meet_link
//   event_attendees  (0104_calendar): event_id, member_id
//   clients          (0108_clients): id, name, services text[], health_score, health_band, owner_id, manager_id
//   client_team      (0108_clients): client_id, member_id
//   invoices         (0110_finance_core): status, currency, total, amount_paid, due_on
//   notifications    (0101_shell)
// No embeds across modules (their FKs may not exist yet): each table is read on its own and joined here.
// A missing table (module not applied yet) reads as empty, so every panel still renders.

type DB = Awaited<ReturnType<typeof createClient>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

const rows = (res: { data: unknown; error: unknown }): Row[] => (res.error || !res.data ? [] : (res.data as Row[]));
const none = Promise.resolve({ data: [] as Row[], error: null });
const OPEN_INVOICE = ["issued", "partly_paid", "disputed"];
/** Weekly capacity in open tickets per person, until Team adds a per-person value. */
export const DEFAULT_CAPACITY = 12;

async function memberNames(db: DB, ids: (string | null)[]) {
  const uniq = [...new Set(ids.filter(Boolean))] as string[];
  if (!uniq.length) return new Map<string, string>();
  const res = await db.from("members").select("id, name").in("id", uniq);
  return new Map(rows(res).map((m) => [m.id as string, m.name as string]));
}

/** Every ticket I'm assigned to, reported or watch: all open ones plus the latest 200 done. */
export async function getMyTickets(meId: string): Promise<MyTicket[]> {
  const db = await createClient();
  const watched = rows(await db.from("ticket_watchers").select("ticket_id").eq("member_id", meId)).map((r) => r.ticket_id as string);
  const mine = [`assignee_id.eq.${meId}`, `reporter_id.eq.${meId}`];
  if (watched.length) mine.push(`id.in.(${watched.join(",")})`);
  const cols = "id, key, title, status, priority, assignee_id, reporter_id, project_id, due_date, completed_at";

  const [open, done] = await Promise.all([
    db.from("tickets").select(cols).neq("status", "done").or(mine.join(",")),
    db.from("tickets").select(cols).eq("status", "done").or(mine.join(",")).order("completed_at", { ascending: false }).limit(200),
  ]);
  const list = [...rows(open), ...rows(done)];
  if (!list.length) return [];

  const ids = list.map((t) => t.id as string);
  const projectIds = [...new Set(list.map((t) => t.project_id).filter(Boolean))] as string[];
  const [checks, comments, subs, projects, names] = await Promise.all([
    db.from("checklist_items").select("ticket_id, done").in("ticket_id", ids),
    db.from("comments").select("ticket_id").in("ticket_id", ids),
    db.from("tickets").select("parent_id").in("parent_id", ids),
    projectIds.length ? db.from("projects").select("id, name").in("id", projectIds) : none,
    memberNames(db, list.map((t) => t.assignee_id)),
  ]);

  const count = (rs: Row[], col: string, pred: (r: Row) => boolean = () => true) => {
    const m = new Map<string, number>();
    for (const r of rs) if (pred(r)) m.set(r[col], (m.get(r[col]) ?? 0) + 1);
    return m;
  };
  const checkTotal = count(rows(checks), "ticket_id");
  const checkDone = count(rows(checks), "ticket_id", (r) => Boolean(r.done));
  const commentN = count(rows(comments), "ticket_id");
  const subN = count(rows(subs), "parent_id");
  const projName = new Map(rows(projects).map((p) => [p.id as string, p.name as string]));
  const watchSet = new Set(watched);

  return list.map(
    (t): MyTicket => ({
      id: t.id,
      key: t.key,
      title: t.title,
      status: t.status as TicketStatus,
      priority: (t.priority ?? "normal") as PriorityLevel,
      assigneeId: t.assignee_id ?? null,
      assigneeName: t.assignee_id ? (names.get(t.assignee_id) ?? null) : null,
      reporterId: t.reporter_id ?? null,
      watching: watchSet.has(t.id),
      due: t.due_date ?? null,
      doneOn: t.completed_at ? localDate(t.completed_at) : null,
      projectName: t.project_id ? (projName.get(t.project_id) ?? null) : null,
      subtasks: subN.get(t.id) ?? 0,
      checklistDone: checkDone.get(t.id) ?? 0,
      checklistTotal: checkTotal.get(t.id) ?? 0,
      comments: commentN.get(t.id) ?? 0,
    }),
  );
}

/** Meetings I attend that haven't ended yet, next 30 days. */
export async function getMyEvents(meId: string, now: Date): Promise<MyEvent[]> {
  const db = await createClient();
  const mineIds = rows(await db.from("event_attendees").select("event_id").eq("member_id", meId)).map((r) => r.event_id as string);
  if (!mineIds.length) return [];
  const until = new Date(now.getTime() + 30 * 86400000).toISOString();
  const endOf = (e: Row) => new Date(new Date(e.starts_at).getTime() + Number(e.minutes ?? 0) * 60000).toISOString();
  const evs = rows(
    await db
      .from("events")
      .select("id, title, client_id, starts_at, minutes, meet_link")
      .in("id", mineIds)
      .gt("starts_at", new Date(now.getTime() - 10 * 3600000).toISOString()) // longest meeting is 600 min
      .lt("starts_at", until)
      .order("starts_at")
      .limit(60),
  ).filter((e) => endOf(e) > now.toISOString());
  if (!evs.length) return [];
  const clientIds = [...new Set(evs.map((e) => e.client_id).filter(Boolean))] as string[];
  const [att, clients] = await Promise.all([
    db.from("event_attendees").select("event_id, member_id").in("event_id", evs.map((e) => e.id)),
    clientIds.length ? db.from("clients").select("id, name").in("id", clientIds) : none,
  ]);
  const names = await memberNames(db, rows(att).map((a) => a.member_id));
  const clientName = new Map(rows(clients).map((c) => [c.id as string, c.name as string]));
  return evs.map((e) => ({
    id: e.id,
    title: e.title,
    startsAt: e.starts_at,
    endsAt: endOf(e),
    meetLink: e.meet_link ?? null,
    clientName: e.client_id ? (clientName.get(e.client_id) ?? null) : null,
    attendees: rows(att)
      .filter((a) => a.event_id === e.id)
      .map((a) => names.get(a.member_id))
      .filter(Boolean) as string[],
  }));
}

/** Latest ticket notifications for me, with why they reached me. `tickets` may still be loading. */
export async function getUpdates(meId: string, tickets: MyTicket[] | Promise<MyTicket[]>): Promise<Update[]> {
  const db = await createClient();
  const res = await db
    .from("notifications")
    .select("id, actor_id, action, subject, detail, href, created_at")
    .eq("member_id", meId)
    .in("kind", ["ticket", "review", "mention"])
    .is("read_at", null)
    .order("created_at", { ascending: false })
    .limit(6);
  const list = rows(res);
  const names = await memberNames(db, list.map((n) => n.actor_id));
  const byKey = new Map((await tickets).map((t) => [t.key, t]));
  return list.map((n) => ({
    id: n.id,
    actorName: (n.actor_id && names.get(n.actor_id)) || "Portal",
    action: n.action,
    subject: n.subject,
    detail: n.detail,
    href: n.href,
    createdAt: n.created_at,
    why: whyFor(n.subject ? byKey.get(n.subject) : undefined, meId),
  }));
}

export async function getDepartments() {
  const db = await createClient();
  return rows(await db.from("departments").select("id, name").order("name")).map((d) => ({ id: d.id as string, name: d.name as string }));
}

/** Department panel: open work in the department's projects, and open tickets per member. */
export async function getDeptPanel(deptId: string, today: string): Promise<DeptPanel> {
  const db = await createClient();
  const [projects, members] = await Promise.all([
    db.from("projects").select("id").eq("department_id", deptId),
    db.from("members").select("id, name").eq("department_id", deptId).eq("kind", "staff").eq("status", "active").order("name"),
  ]);
  const projectIds = rows(projects).map((p) => p.id as string);
  const people = rows(members);
  const [deptTickets, personTickets] = await Promise.all([
    projectIds.length
      ? db.from("tickets").select("status, assignee_id, due_date").neq("status", "done").in("project_id", projectIds)
      : none,
    people.length
      ? db.from("tickets").select("assignee_id").neq("status", "done").in("assignee_id", people.map((p) => p.id))
      : none,
  ]);
  const open = rows(deptTickets);
  const perPerson = rows(personTickets);
  return {
    open: open.length,
    overdue: open.filter((t) => t.due_date && dayDiff(t.due_date, today) < 0).length,
    unassigned: open.filter((t) => !t.assignee_id).length,
    blocked: open.filter((t) => t.status === "blocked").length,
    review: open.filter((t) => t.status === "in_review").length,
    load: people.map((p) => ({ name: p.name as string, open: perPerson.filter((t) => t.assignee_id === p.id).length })),
  };
}

/** Clients I own, manage or work on, with open tickets, this month's report and next meeting. */
export async function getMyClients(meId: string, today: string, now: Date): Promise<ClientRow[]> {
  const db = await createClient();
  const team = rows(await db.from("client_team").select("client_id").eq("member_id", meId)).map((r) => r.client_id as string);
  const who = [`owner_id.eq.${meId}`, `manager_id.eq.${meId}`];
  if (team.length) who.push(`id.in.(${team.join(",")})`);
  const clients = rows(
    await db.from("clients").select("id, name, services, health_score, health_band").or(who.join(",")).order("name"),
  );
  if (!clients.length) return [];
  const clientIds = clients.map((c) => c.id as string);

  const [projects, meetings] = await Promise.all([
    db.from("projects").select("id, client_id").in("client_id", clientIds),
    db.from("events").select("client_id, starts_at").in("client_id", clientIds).gt("starts_at", now.toISOString()).order("starts_at").limit(200),
  ]);
  const projClient = new Map(rows(projects).map((p) => [p.id as string, p.client_id as string]));
  const projectIds = [...projClient.keys()];
  const monthStart = `${today.slice(0, 7)}-01`;
  const [open, reports] = await Promise.all([
    projectIds.length ? db.from("tickets").select("project_id").neq("status", "done").in("project_id", projectIds) : none,
    projectIds.length
      ? db
          .from("tickets")
          .select("project_id, status, due_date, completed_at")
          .in("project_id", projectIds)
          .contains("tags", ["report"])
          .gte("due_date", monthStart)
          .order("due_date", { ascending: false })
      : none,
  ]);

  return clients.map((c): ClientRow => {
    const mine = (r: Row) => projClient.get(r.project_id) === c.id;
    const report = rows(reports).find(mine);
    const next = rows(meetings).find((m) => m.client_id === c.id);
    return {
      id: c.id,
      name: c.name,
      services: (c.services as string[] | null) ?? [],
      health: c.health_score ?? null,
      band: c.health_band ?? null,
      open: rows(open).filter(mine).length,
      report: reportStatus(
        report ? { status: report.status, due: report.due_date, doneOn: report.completed_at ? localDate(report.completed_at) : null } : null,
        today,
      ),
      nextMeeting: next?.starts_at ?? null,
    };
  });
}

/** Outstanding and overdue invoice balances per currency. */
export async function getFinanceSnapshot(today: string): Promise<FinanceRow[] | null> {
  const db = await createClient();
  const res = await db.from("invoices").select("id, status, currency, total, amount_paid, due_on").in("status", OPEN_INVOICE);
  if (res.error) return null;
  const settled = await settledByInvoice(rows(res).map((i) => i.id as string));
  const by = new Map<string, FinanceRow>();
  for (const i of rows(res)) {
    const r = by.get(i.currency) ?? { currency: i.currency, outstanding: 0, overdue: 0 };
    const bal = balance({ status: i.status, total: Number(i.total ?? 0), paid: Number(i.amount_paid ?? 0), settled: settled.get(i.id) ?? 0, due: i.due_on });
    r.outstanding += bal;
    if (i.due_on && dayDiff(i.due_on, today) < 0) r.overdue += bal;
    by.set(i.currency, r);
  }
  return [...by.values()].sort((a, b) => a.currency.localeCompare(b.currency));
}

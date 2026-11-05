import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { balance } from "@/lib/modules/finance/core/logic";
import { settledByInvoice } from "@/lib/modules/finance/core/queries";
import { CONTACT_KINDS, daysBetween, dubaiDate, healthScore, isEnded, money, weekStart, type Band, type Health, type Severity } from "./logic";
import type { ClientPage, ClientRow, Escalation, Meeting, Person, Portfolio, PortfolioCard, PortalLogin, Terms } from "./types";

// Reads tables owned by other modules. Column names are listed so a rename is a one-line fix.
//   tickets       (0106_tickets): id, key, status, due_date, client_id, tags text[]
//   time_entries  (0106_tickets): ticket_id, member_id, minutes, date
//   events        (0104_calendar): id, title, kind, client_id, starts_at, meet_link, location, event_attendees
//   sla_waits     (0109_clientops, assumed): client_id, answered_at
//   invoices      (0110_finance_core, assumed like Home): client_id, status, currency, total, amount_paid, due_on
// A missing table reads as empty, so the pages still render before those modules are applied.

type DB = Awaited<ReturnType<typeof createClient>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const rows = (res: { data: unknown; error: unknown }): Row[] => (res.error || !res.data ? [] : (res.data as Row[]));
const OPEN_INVOICE = ["issued", "partly_paid", "disputed"];

const CLIENT_COLS =
  "id, name, site, services, country, channel, currency, status, start_date, end_date, end_reason, owner_id, manager_id, notes, health_score, health_band, health_factors, health_at, portal_logo_url, portal_color, portal_welcome";

/** Active staff for owner, manager, team and escalation pickers. */
export async function listPeople(db?: DB): Promise<Person[]> {
  const supabase = db ?? (await createClient());
  const [m, d] = await Promise.all([
    supabase.from("members").select("id, name, department_id").eq("kind", "staff").eq("status", "active").order("name"),
    supabase.from("departments").select("id, name"),
  ]);
  const dept = new Map(rows(d).map((x) => [x.id as string, x.name as string]));
  return rows(m).map((p) => ({ id: p.id, name: p.name, department: dept.get(p.department_id) ?? null }));
}

/** Latest contact day per client from the timeline. */
function lastContacts(timeline: Row[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const t of timeline) {
    const cur = out.get(t.client_id);
    if (!cur || t.happened_on > cur) out.set(t.client_id, t.happened_on);
  }
  return out;
}

function prevMonthName(today: string) {
  const d = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toLocaleString("en-GB", { month: "long", timeZone: "UTC" });
}

export async function getPortfolio(now: Date): Promise<{ data: Portfolio; people: Person[] }> {
  const db = await createClient();
  const today = dubaiDate(now);
  const [clientsRes, people] = await Promise.all([
    db.from("clients").select("id, name, status, services, owner_id, health_score, health_band, end_date, end_reason, currency").order("name"),
    listPeople(db),
  ]);
  const clients = rows(clientsRes);
  const ids = clients.map((c) => c.id as string);
  const names = new Map(people.map((p) => [p.id, p.name]));
  const none = Promise.resolve({ data: [] as Row[], error: null });
  const monthStart = `${today.slice(0, 7)}-01`;
  const weekFrom = new Date(`${weekStart(today)}T00:00:00+04:00`);
  const weekTo = new Date(weekFrom.getTime() + 7 * 86_400_000);

  const [terms, escs, contacts, events, reports, prevHealth] = await Promise.all([
    ids.length ? db.from("client_terms").select("client_id, monthly_fee, currency").in("client_id", ids) : none,
    ids.length ? db.from("escalations").select("client_id, due_at").eq("status", "open").in("client_id", ids) : none,
    ids.length ? db.from("client_timeline").select("client_id, happened_on").in("kind", CONTACT_KINDS).in("client_id", ids).order("happened_on", { ascending: false }).limit(5000) : none,
    ids.length
      ? db.from("events").select("client_id, starts_at").eq("kind", "client_meeting").in("client_id", ids).gte("starts_at", weekFrom.toISOString()).order("starts_at").limit(500)
      : none,
    ids.length ? db.from("tickets").select("client_id, status, due_date").contains("tags", ["report"]).gte("due_date", monthStart).in("client_id", ids) : none,
    // Score 7 days ago or the nearest earlier snapshot (0211). Missing function reads as empty.
    ids.length ? db.rpc("client_health_prev", { p_days: 7 }) : none,
  ]);
  const prev7 = new Map(rows(prevHealth).map((h) => [h.client_id as string, Number(h.score)]));

  const fee = new Map(rows(terms).map((t) => [t.client_id as string, t]));
  const last = lastContacts(rows(contacts));
  const escByClient = new Map<string, number>();
  let pastWindow = 0;
  for (const e of rows(escs)) {
    escByClient.set(e.client_id, (escByClient.get(e.client_id) ?? 0) + 1);
    if (Date.parse(e.due_at) < now.getTime()) pastWindow++;
  }
  const future = rows(events).filter((e) => Date.parse(e.starts_at) >= now.getTime());
  const nextByClient = new Map<string, string>();
  for (const e of future) if (!nextByClient.has(e.client_id)) nextByClient.set(e.client_id, e.starts_at);
  const reportByClient = new Map<string, Row>();
  for (const r of rows(reports)) reportByClient.set(r.client_id, r);
  const reportLabel = (id: string) => {
    const r = reportByClient.get(id);
    if (!r) return "Not due";
    return r.status === "done" ? "Sent" : r.status === "in_review" ? "In review" : "Not sent";
  };

  const live = clients.filter((c) => !isEnded(c.status));
  const ended = clients.filter((c) => isEnded(c.status));
  const ownerName = (c: Row) => (c.owner_id ? names.get(c.owner_id) ?? "" : "");
  const cards: PortfolioCard[] = live.map((c) => {
    const lc = last.get(c.id);
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      band: c.health_band as Band,
      score: c.health_score,
      change7: c.health_score != null && prev7.has(c.id) ? c.health_score - prev7.get(c.id)! : null,
      ownerName: ownerName(c),
      services: c.services ?? [],
      contactDays: lc ? Math.max(0, daysBetween(lc, today)) : null,
      nextMeeting: nextByClient.get(c.id) ?? null,
      report: reportLabel(c.id),
    };
  });
  const weekMeetings = rows(events).filter((e) => Date.parse(e.starts_at) < weekTo.getTime());
  const nextAny = future[0];

  return {
    people,
    data: {
      cards,
      ended: ended.map((c) => {
        const t = fee.get(c.id);
        return { id: c.id, name: c.name, endDate: c.end_date, reason: c.end_reason, fee: t?.monthly_fee != null ? money(Number(t.monthly_fee), t.currency) : null };
      }),
      owners: [...new Set(cards.map((c) => c.ownerName).filter(Boolean))].sort(),
      stats: {
        total: live.length,
        active: live.filter((c) => c.status === "active" || c.status === "onboarding").length,
        paused: live.filter((c) => c.status === "paused").length,
        atRisk: live.filter((c) => c.health_band === "at_risk").map((c) => c.name),
        openEscalations: rows(escs).length,
        pastWindow,
        reportsNotSent: [...reportByClient.values()].filter((r) => r.status !== "done").length,
        reportsSeen: reportByClient.size > 0,
        meetingsThisWeek: weekMeetings.length,
        nextMeeting: nextAny ? { client: clients.find((c) => c.id === nextAny.client_id)?.name ?? "", at: nextAny.starts_at } : null,
      },
      byOwner: live.map((c) => {
        const t = fee.get(c.id);
        return {
          ownerName: ownerName(c),
          band: c.health_band as Band,
          escalations: escByClient.get(c.id) ?? 0,
          fee: t?.monthly_fee != null ? Number(t.monthly_fee) : null,
          currency: t?.currency ?? c.currency,
        };
      }),
      feesVisible: rows(terms).length > 0,
      reportMonth: prevMonthName(today),
    },
  };
}

export async function getClient(id: string, now: Date): Promise<ClientPage | null> {
  const db = await createClient();
  const { data: c } = await db.from("clients").select(CLIENT_COLS).eq("id", id).maybeSingle();
  if (!c) return null;
  const client = c as ClientRow;
  const today = dubaiDate(now);
  const monthStart = `${today.slice(0, 7)}-01`;

  const [people, terms, contacts, team, timeline, escs, events, tickets, logins] = await Promise.all([
    listPeople(db),
    db.from("client_terms").select("*").eq("client_id", id).maybeSingle(),
    db.from("client_contacts").select("id, name, role, email, phone, is_main, gets_reports").eq("client_id", id).order("is_main", { ascending: false }).order("name"),
    db.from("client_team").select("member_id, role").eq("client_id", id),
    db.from("client_timeline").select("id, kind, happened_on, with_name, mood, body, decisions, concerns, action_items, created_by").eq("client_id", id).order("happened_on", { ascending: false }).order("created_at", { ascending: false }).limit(100),
    db.from("escalations").select("id, title, details, severity, owner_id, ticket_id, status, opened_at, due_at, closed_at, client_rating").eq("client_id", id).order("opened_at", { ascending: false }),
    db.from("events").select("id, title, starts_at, meet_link, location, event_attendees(member_id)").eq("client_id", id).gte("starts_at", now.toISOString()).order("starts_at").limit(10),
    db.from("tickets").select("id, key, status, due_date").eq("client_id", id),
    db.from("members").select("id, name, email, status").eq("kind", "client").eq("client_id", id).order("name"),
  ]);
  const names = new Map(people.map((p) => [p.id, p.name]));
  const dept = new Map(people.map((p) => [p.id, p.department]));
  const ticketRows = rows(tickets);
  const ticketById = new Map(ticketRows.map((t) => [t.id as string, t]));
  const open = ticketRows.filter((t) => t.status !== "done");

  // Hours this month on the client's tickets, per person.
  const ticketIds = ticketRows.map((t) => t.id as string);
  const time = ticketIds.length
    ? rows(await db.from("time_entries").select("member_id, minutes").in("ticket_id", ticketIds).gte("date", monthStart))
    : [];
  const minutesBy = new Map<string, number>();
  for (const t of time) minutesBy.set(t.member_id, (minutesBy.get(t.member_id) ?? 0) + Number(t.minutes));

  // Balance due from Finance (if that module is applied and I can see invoices).
  const inv = await db.from("invoices").select("id, status, currency, total, amount_paid, due_on").eq("client_id", id).in("status", OPEN_INVOICE);
  let balanceDue: ClientPage["balance"] = null;
  if (!inv.error) {
    const settled = await settledByInvoice(rows(inv).map((i) => i.id as string));
    const sums = new Map<string, number>();
    for (const i of rows(inv)) {
      const bal = balance({ status: i.status, total: Number(i.total ?? 0), paid: Number(i.amount_paid ?? 0), settled: settled.get(i.id) ?? 0, due: i.due_on });
      sums.set(i.currency, (sums.get(i.currency) ?? 0) + bal);
    }
    balanceDue = [...sums.entries()].map(([currency, amount]) => ({ currency, amount }));
  }

  const loginRows = rows(logins);
  const roleRows = loginRows.length ? rows(await db.from("member_roles").select("member_id, role").in("member_id", loginRows.map((l) => l.id))) : [];
  const portal: PortalLogin[] = loginRows.map((l) => ({
    id: l.id,
    name: l.name,
    email: l.email,
    status: l.status,
    role: roleRows.find((r) => r.member_id === l.id)?.role ?? null,
  }));

  const timelineRows = rows(timeline);
  const lastContact = timelineRows.find((t) => CONTACT_KINDS.includes(t.kind))?.happened_on ?? null;

  return {
    client,
    ownerName: client.owner_id ? names.get(client.owner_id) ?? null : null,
    managerName: client.manager_id ? names.get(client.manager_id) ?? null : null,
    terms: (terms.data as Terms | null) ?? null,
    contacts: rows(contacts) as ClientPage["contacts"],
    team: rows(team)
      .map((t) => ({ member_id: t.member_id, role: t.role, name: names.get(t.member_id) ?? "Former member", department: dept.get(t.member_id) ?? null, minutes: minutesBy.get(t.member_id) ?? 0 }))
      .sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) || a.name.localeCompare(b.name)),
    timeline: timelineRows.map((t) => ({ ...t, action_items: t.action_items ?? [], by: t.created_by ? names.get(t.created_by) ?? null : null })) as ClientPage["timeline"],
    escalations: rows(escs).map(
      (e): Escalation => ({
        id: e.id,
        title: e.title,
        details: e.details,
        severity: e.severity,
        owner: e.owner_id ? names.get(e.owner_id) ?? null : null,
        ticketKey: e.ticket_id ? ticketById.get(e.ticket_id)?.key ?? null : null,
        ticketStatus: e.ticket_id ? ticketById.get(e.ticket_id)?.status ?? null : null,
        status: e.status,
        opened_at: e.opened_at,
        due_at: e.due_at,
        closed_at: e.closed_at,
        client_rating: e.client_rating,
      }),
    ),
    meetings: rows(events).map(
      (e): Meeting => ({
        id: e.id,
        title: e.title,
        starts_at: e.starts_at,
        where: e.meet_link ? "Google Meet" : e.location,
        people: ((e.event_attendees ?? []) as Row[]).map((a) => names.get(a.member_id)).filter(Boolean) as string[],
      }),
    ),
    openTickets: open.length,
    overdueTickets: open.filter((t) => t.due_date && t.due_date < today).length,
    hoursThisMonth: Math.round([...minutesBy.values()].reduce((a, b) => a + b, 0) / 60),
    balance: balanceDue,
    lastContact,
    logins: portal,
  };
}

const ROLE_ORDER = ["delivery_lead", "delivery", "account_executive", "backup"];

/**
 * Live health for one client. Pass a service client (after a can() check) so the counts are complete,
 * not limited to what the caller can see.
 */
export async function computeHealth(db: SupabaseClient, id: string, now: Date): Promise<Health | null> {
  const { data: c } = await db.from("clients").select("status, start_date").eq("id", id).maybeSingle();
  if (!c) return null;
  const today = dubaiDate(now);
  const [tickets, contact, waits, invoices, escs] = await Promise.all([
    db.from("tickets").select("id").eq("client_id", id).neq("status", "done").lt("due_date", today),
    db.from("client_timeline").select("happened_on").eq("client_id", id).in("kind", CONTACT_KINDS).order("happened_on", { ascending: false }).limit(1),
    db.from("sla_waits").select("id").eq("client_id", id).is("answered_at", null),
    db.from("invoices").select("id").eq("client_id", id).in("status", OPEN_INVOICE).lt("due_on", today),
    db.from("escalations").select("severity").eq("client_id", id).eq("status", "open"),
  ]);
  return healthScore({
    status: c.status,
    startDate: c.start_date,
    today,
    overdueTickets: rows(tickets).length,
    lastContact: rows(contact)[0]?.happened_on ?? null,
    openWaits: rows(waits).length,
    overdueInvoices: rows(invoices).length,
    openEscalations: rows(escs).map((e) => e.severity as Severity),
  });
}

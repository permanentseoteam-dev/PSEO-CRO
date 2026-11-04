import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  byClient,
  byPerson,
  summarize,
  waitState,
  weekStartDate,
  workingMinutes,
  zoneDate,
  zoneMidnight,
  type Measured,
  type Range,
  type WaitKind,
  type WorkHours,
} from "./logic";
import type { AnsweredWait, BrandKit, ClientFile, Folder, Meeting, OpenWait, Option, SearchHit, SlaSettings } from "./types";

// Reads tickets (0106: id, key, status) and clients / client_team (0108) besides this module's tables.

type DB = Awaited<ReturnType<typeof createClient>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const rows = (res: { data: unknown; error: unknown }): Row[] => (res.error || !res.data ? [] : (res.data as Row[]));
const one = <T>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

export const DEFAULT_SETTINGS: SlaSettings = {
  replyHours: 1,
  requestHours: 4,
  changesHours: 8,
  timezone: "Asia/Dubai",
  dayStart: "09:00",
  dayEnd: "18:00",
  workdays: [1, 2, 3, 4, 5],
  ontimeGoal: 90,
  alertAnswerer: true,
  alertManager: true,
  postDaily: false,
};

export const hoursOf = (s: SlaSettings): WorkHours => ({ timezone: s.timezone, dayStart: s.dayStart, dayEnd: s.dayEnd, workdays: s.workdays });

export async function getSettings(db?: DB): Promise<SlaSettings> {
  const supabase = db ?? (await createClient());
  const { data: r } = await supabase.from("sla_settings").select("*").maybeSingle();
  if (!r) return DEFAULT_SETTINGS;
  return {
    replyHours: Number(r.reply_hours),
    requestHours: Number(r.request_hours),
    changesHours: Number(r.changes_hours),
    timezone: r.timezone,
    dayStart: String(r.day_start).slice(0, 5),
    dayEnd: String(r.day_end).slice(0, 5),
    workdays: (r.workdays as number[]) ?? [],
    ontimeGoal: r.ontime_goal,
    alertAnswerer: r.alert_answerer,
    alertManager: r.alert_manager,
    postDaily: r.post_daily,
  };
}

/** Staff names by id (for answerers and meeting attendees). */
export async function staffNames(db?: DB): Promise<Map<string, string>> {
  const supabase = db ?? (await createClient());
  const res = await supabase.from("members").select("id, name").eq("kind", "staff");
  return new Map(rows(res).map((m) => [m.id as string, m.name as string]));
}

export async function listStaff(db?: DB): Promise<Option[]> {
  const supabase = db ?? (await createClient());
  const res = await supabase.from("members").select("id, name").eq("kind", "staff").eq("status", "active").order("name");
  return rows(res).map((m) => ({ id: m.id, name: m.name }));
}

/** Clients the signed-in staff member can see, by name. */
export async function listClients(db?: DB): Promise<Option[]> {
  const supabase = db ?? (await createClient());
  const res = await supabase.from("clients").select("id, name").neq("status", "internal").order("name");
  return rows(res).map((c) => ({ id: c.id, name: c.name }));
}

// ---------------------------------------------------------------- response times

export async function getResponseTimes(range: Range, now: Date) {
  const db = await createClient();
  const settings = await getSettings(db);
  const hours = hoursOf(settings);
  const since = new Date(now.getTime() - range * 86400000).toISOString();
  const cols = "id, client_id, kind, subject, from_name, answerer_id, answered_by, target_hours, started_at, answered_at, clients(name)";
  const [openRes, doneRes, names] = await Promise.all([
    db.from("sla_waits").select(cols).is("answered_at", null).order("started_at"),
    db.from("sla_waits").select(cols).gte("answered_at", since).order("answered_at", { ascending: false }).limit(5000),
    staffNames(db),
  ]);

  const measure = (w: Row, end: Date): Measured => ({
    clientId: w.client_id,
    clientName: one<Row>(w.clients)?.name ?? "Unknown client",
    answererId: w.answerer_id,
    answeredById: w.answered_by,
    targetMin: Math.round(Number(w.target_hours) * 60),
    minutes: workingMinutes(new Date(w.started_at), end, hours),
    answered: w.answered_at != null,
  });

  const openRows = rows(openRes);
  const doneRows = rows(doneRes);
  const open = openRows.map((w) => measure(w, now));
  const done = doneRows.map((w) => measure(w, new Date(w.answered_at)));

  const waiting: OpenWait[] = openRows
    .map((w, i) => ({
      id: w.id as string,
      clientName: open[i].clientName,
      fromName: w.from_name,
      kind: w.kind as WaitKind,
      subject: w.subject,
      waitedMin: open[i].minutes,
      targetMin: open[i].targetMin,
      answererName: w.answerer_id ? (names.get(w.answerer_id) ?? null) : null,
      state: waitState(open[i].minutes, open[i].targetMin),
    }))
    .sort((a, b) => b.waitedMin / b.targetMin - a.waitedMin / a.targetMin);

  const answered: AnsweredWait[] = doneRows.slice(0, 100).map((w, i) => ({
    id: w.id,
    clientName: done[i].clientName,
    kind: w.kind,
    askedAt: w.started_at,
    answeredByName: w.answered_by ? (names.get(w.answered_by) ?? null) : null,
    tookMin: done[i].minutes,
    targetMin: done[i].targetMin,
  }));

  return {
    settings,
    summary: summarize(done),
    waitingNow: waiting.length,
    late: waiting.filter((w) => w.state.late).length,
    past2x: waiting.filter((w) => w.state.past2x).length,
    waiting,
    answered,
    people: byPerson(done, open).map((p) => ({ ...p, name: names.get(p.id) ?? "Former member" })),
    clients: byClient(done, open),
  };
}

// ---------------------------------------------------------------- meetings

/** Clients where I am owner, manager or on the client team. */
async function myClientIds(db: DB, meId: string): Promise<Set<string>> {
  const [own, team] = await Promise.all([
    db.from("clients").select("id").or(`owner_id.eq.${meId},manager_id.eq.${meId}`),
    db.from("client_team").select("client_id").eq("member_id", meId),
  ]);
  return new Set([...rows(own).map((r) => r.id as string), ...rows(team).map((r) => r.client_id as string)]);
}

export async function getMeetings(meId: string, mine: boolean, now: Date) {
  const db = await createClient();
  const [res, names, mineIds] = await Promise.all([
    db
      .from("meetings")
      .select(
        "id, client_id, title, held_at, duration_min, our_people, guests, attendee_emails, summary, decisions, concerns, status, reviewed_at, clients(name), meeting_actions(id, position, title, owner_name, outcome, done, ticket_id, tickets(key, status))",
      )
      .neq("status", "not_client")
      .order("held_at", { ascending: false })
      .limit(500),
    staffNames(db),
    mine ? myClientIds(db, meId) : Promise.resolve(null),
  ]);

  const all: (Meeting & { ticketDone: boolean[]; reviewedAt: string | null })[] = rows(res).map((m) => {
    const acts = ((m.meeting_actions as Row[]) ?? []).sort((a, b) => a.position - b.position);
    return {
      id: m.id,
      clientId: m.client_id,
      clientName: one<Row>(m.clients)?.name ?? null,
      title: m.title,
      heldAt: m.held_at,
      durationMin: m.duration_min,
      people: ((m.our_people as string[]) ?? []).map((id) => names.get(id)).filter((n): n is string => !!n),
      guests: m.guests,
      attendeeEmails: m.attendee_emails,
      summary: m.summary,
      decisions: m.decisions ?? [],
      concerns: m.concerns ?? [],
      status: m.status,
      reviewedAt: m.reviewed_at,
      actions: acts.map((a) => ({
        id: a.id,
        title: a.title,
        ownerName: a.owner_name,
        outcome: a.outcome,
        ticketKey: one<Row>(a.tickets)?.key ?? null,
        done: a.done,
      })),
      ticketDone: acts.map((a) => one<Row>(a.tickets)?.status === "done"),
    };
  });

  const list = mineIds ? all.filter((m) => m.clientId && mineIds.has(m.clientId)) : all;
  const tz = "Asia/Dubai";
  const weekStart = zoneMidnight(weekStartDate(now, tz), tz).getTime();
  const monthStart = zoneMidnight(`${zoneDate(now, tz).slice(0, 7)}-01`, tz).getTime();

  let openActions = 0;
  let openTodos = 0;
  let ticketsThisMonth = 0;
  for (const m of all) {
    if (m.status !== "reviewed") continue;
    m.actions.forEach((a, i) => {
      if (a.outcome === "todo" && !a.done) {
        openActions++;
        openTodos++;
      }
      if (a.outcome === "ticket" && !m.ticketDone[i]) openActions++;
      if (a.outcome === "ticket" && a.ticketKey && m.reviewedAt && new Date(m.reviewedAt).getTime() >= monthStart) ticketsThisMonth++;
    });
  }

  return {
    toReview: list.filter((m) => m.status === "to_review" && m.clientId),
    recent: list.filter((m) => m.status === "reviewed").slice(0, 50),
    noClient: all.filter((m) => m.status === "to_review" && !m.clientId),
    stats: {
      callsThisWeek: all.filter((m) => new Date(m.heldAt).getTime() >= weekStart).length,
      openActions,
      openTodos,
      ticketsThisMonth,
    },
  };
}

// ---------------------------------------------------------------- files

export async function getFiles(clientId: string, folderId: string | undefined) {
  const db = await createClient();
  const [folderRes, countRes, kitRes] = await Promise.all([
    db.from("client_folders").select("id, name, kind, client_visible, position").eq("client_id", clientId).order("position").order("name"),
    db.from("client_files").select("folder_id").eq("client_id", clientId),
    db.from("brand_kits").select("colours, fonts, tone, dos, donts").eq("client_id", clientId).maybeSingle(),
  ]);
  const counts = new Map<string, number>();
  for (const f of rows(countRes)) counts.set(f.folder_id, (counts.get(f.folder_id) ?? 0) + 1);
  const folders: Folder[] = rows(folderRes).map((f) => ({
    id: f.id,
    name: f.name,
    kind: f.kind,
    clientVisible: f.client_visible,
    count: counts.get(f.id) ?? 0,
  }));
  const folder = folders.find((f) => f.id === folderId) ?? folders[0] ?? null;

  let files: ClientFile[] = [];
  if (folder) {
    const res = await db
      .from("client_files")
      .select("id, name, shared, file_versions(id, version, size_bytes, created_at, uploader_name, members(name))")
      .eq("folder_id", folder.id)
      .order("name");
    files = rows(res).map((f) => ({
      id: f.id,
      name: f.name,
      shared: f.shared,
      versions: ((f.file_versions as Row[]) ?? [])
        .map((v) => ({
          id: v.id,
          version: v.version,
          sizeBytes: Number(v.size_bytes),
          uploadedBy: one<Row>(v.members)?.name ?? v.uploader_name ?? null,
          createdAt: v.created_at,
        }))
        .sort((a, b) => b.version - a.version),
    }));
  }

  const k = kitRes.data as Row | null;
  const brandKit: BrandKit | null = k
    ? { colours: k.colours ?? [], fonts: k.fonts, tone: k.tone, dos: k.dos ?? [], donts: k.donts ?? [] }
    : null;

  return { folders, folder, files, brandKit };
}

/** Strip characters that have meaning in PostgREST filters and LIKE patterns. */
const clean = (q: string) => q.replace(/[%_,()*\\:."']/g, " ").trim();

export async function searchFiles(q: string): Promise<{ hits: SearchHit[]; total: number }> {
  const term = clean(q);
  if (term.length < 2) return { hits: [], total: 0 };
  const db = await createClient();
  const clientRes = await db.from("clients").select("id").ilike("name", `%${term}%`);
  const ids = rows(clientRes).map((c) => c.id as string);
  const filter = ids.length ? `name.ilike.%${term}%,client_id.in.(${ids.join(",")})` : `name.ilike.%${term}%`;
  const res = await db
    .from("client_files")
    .select("id, name, client_id, folder_id, updated_at, clients(name), client_folders(name), file_versions(version)", { count: "exact" })
    .or(filter)
    .order("updated_at", { ascending: false })
    .limit(12);
  const hits = rows(res).map((f) => ({
    id: f.id,
    name: f.name,
    clientId: f.client_id,
    clientName: one<Row>(f.clients)?.name ?? "",
    folderId: f.folder_id,
    folderName: one<Row>(f.client_folders)?.name ?? "",
    version: Math.max(1, ...((f.file_versions as Row[]) ?? []).map((v) => v.version as number)),
    date: f.updated_at,
  }));
  return { hits, total: res.count ?? hits.length };
}

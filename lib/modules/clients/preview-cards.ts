import "server-only";
import { createClient } from "@/lib/supabase/server";

// Facts for the staff "Client view" picker. Reads under the staff member's RLS, one batched query per table.
// Counts match what the client's portal shows: client-visible top-level tickets that aren't done, approvals
// waiting, client-visible events from now on, shared activity lines. A failed read leaves that fact null.

export type PreviewCard = {
  id: string;
  name: string;
  status: string | null;
  services: string[];
  openWork: number | null;
  waiting: number | null;
  /** ISO start of the next client meeting; null = none booked; undefined = couldn't read. */
  nextMeeting: string | null | undefined;
  /** ISO time of the latest shared activity; null = none; undefined = couldn't read. */
  lastActivity: string | null | undefined;
};

type Rows = { data: unknown; error: unknown };
type Row = { client_id: string; at?: string };

/** Pure: turns the batched rows into one card per client. A null rows list means that read failed. */
export function buildPreviewCards(
  clients: { id: string; name: string; status?: string | null; services?: string[] | null }[],
  tickets: Row[] | null,
  approvals: Row[] | null,
  meetings: Row[] | null,
  activity: Row[] | null,
): PreviewCard[] {
  const count = (list: Row[] | null) => {
    if (!list) return null;
    const m = new Map<string, number>();
    for (const r of list) m.set(r.client_id, (m.get(r.client_id) ?? 0) + 1);
    return m;
  };
  // Lists arrive sorted (meetings soonest first, activity newest first), so the first row per client wins.
  const first = (list: Row[] | null) => {
    if (!list) return null;
    const m = new Map<string, string>();
    for (const r of list) if (r.at && !m.has(r.client_id)) m.set(r.client_id, r.at);
    return m;
  };
  const open = count(tickets);
  const wait = count(approvals);
  const next = first(meetings);
  const last = first(activity);
  return clients.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status ?? null,
    services: c.services ?? [],
    openWork: open ? (open.get(c.id) ?? 0) : null,
    waiting: wait ? (wait.get(c.id) ?? 0) : null,
    nextMeeting: next ? (next.get(c.id) ?? null) : undefined,
    lastActivity: last ? (last.get(c.id) ?? null) : undefined,
  }));
}

const ok = (res: Rows): Row[] | null => (res.error || !Array.isArray(res.data) ? null : (res.data as Row[]));

/** Clients this staff member can preview, with their facts. Returns null when the client list itself fails. */
export async function listPreviewCards(): Promise<PreviewCard[] | null> {
  const db = await createClient();
  const { data: clients, error } = await db.from("clients").select("id, name, status, services").order("name");
  if (error || !clients) return null;
  if (!clients.length) return [];

  const ids = clients.map((c) => c.id as string);
  const nowIso = new Date().toISOString();
  const [tickets, approvals, meetings, activity] = await Promise.all([
    db.from("tickets").select("client_id").in("client_id", ids).eq("client_visible", true).is("parent_id", null).neq("status", "done"),
    db.from("approvals").select("client_id").in("client_id", ids).eq("status", "waiting"),
    db.from("events").select("client_id, at:starts_at").in("client_id", ids).eq("visibility", "client").gte("starts_at", nowIso).order("starts_at"),
    db.from("shared_activity").select("client_id, at:happened_at").in("client_id", ids).eq("visibility", "shared").order("happened_at", { ascending: false }),
  ]);
  return buildPreviewCards(clients, ok(tickets), ok(approvals), ok(meetings), ok(activity));
}

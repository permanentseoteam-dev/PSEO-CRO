import "server-only";
import { createClient } from "@/lib/supabase/server";
import { fromLocal, toLocal, type Repeat, type Rsvp } from "./logic";
import type { BusyBlock, CalEvent, ClientOption, Person, Visibility } from "./types";

// Reads clients (0108_clients: id, name). If that table is not there yet, client names are simply blank.

type EventRow = {
  id: string;
  title: string;
  kind: CalEvent["kind"];
  client_id: string | null;
  starts_at: string;
  minutes: number;
  meet_link: string | null;
  location: string | null;
  agenda: string | null;
  guests: string[] | null;
  repeat: Repeat;
  series_id: string | null;
  visibility: Visibility;
  send_invites: boolean;
  created_by: string;
  event_attendees: { member_id: string; rsvp: Rsvp; member: { name: string } | { name: string }[] | null }[];
};

const EVENT_COLS =
  "id, title, kind, client_id, starts_at, minutes, meet_link, location, agenda, guests, repeat, series_id, visibility, send_invites, created_by, event_attendees(member_id, rsvp, member:members(name))";

export async function listClients(): Promise<ClientOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").select("id, name").order("name");
  return error ? [] : ((data ?? []) as ClientOption[]);
}

export async function listPeople(): Promise<Person[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("members").select("id, name").eq("kind", "staff").eq("status", "active").order("name");
  return (data ?? []) as Person[];
}

/** Meetings I organise or am invited to, between two office dates [from, to). */
export async function listMyEvents(meId: string, from: string, to: string, clients: ClientOption[]): Promise<CalEvent[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select(EVENT_COLS)
    .gte("starts_at", fromLocal(from, "00:00"))
    .lt("starts_at", fromLocal(to, "00:00"))
    .order("starts_at");
  const clientName = new Map(clients.map((c) => [c.id, c.name]));
  return ((data ?? []) as unknown as EventRow[])
    .filter((e) => e.created_by === meId || e.event_attendees.some((a) => a.member_id === meId))
    .map((e): CalEvent => {
      const { date, min } = toLocal(e.starts_at);
      return {
        id: e.id,
        title: e.title,
        kind: e.kind,
        clientId: e.client_id,
        clientName: e.client_id ? (clientName.get(e.client_id) ?? null) : null,
        date,
        start: min,
        mins: e.minutes,
        meetLink: e.meet_link,
        location: e.location,
        agenda: e.agenda,
        guests: e.guests ?? [],
        repeat: e.repeat,
        seriesId: e.series_id,
        visibility: e.visibility,
        sendInvites: e.send_invites,
        createdBy: e.created_by,
        attendees: e.event_attendees
          .map((a) => ({
            id: a.member_id,
            name: (Array.isArray(a.member) ? a.member[0]?.name : a.member?.name) ?? "Former member",
            rsvp: a.rsvp,
          }))
          // organiser first, then by name
          .sort((x, y) => Number(y.id === e.created_by) - Number(x.id === e.created_by) || x.name.localeCompare(y.name)),
      };
    });
}

/** Busy time (no details) for everyone between two office dates. */
export async function listBusy(from: string, to: string): Promise<BusyBlock[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("calendar_busy", {
    range_from: fromLocal(from, "00:00"),
    range_to: fromLocal(to, "00:00"),
  });
  if (error) return [];
  return ((data ?? []) as { member_id: string; starts_at: string; minutes: number }[]).map((b) => {
    const { date, min } = toLocal(b.starts_at);
    return { memberId: b.member_id, date, start: min, mins: b.minutes };
  });
}

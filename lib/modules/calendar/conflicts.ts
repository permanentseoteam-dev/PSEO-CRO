import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { addDays, fmtT, fromLocal, overlaps, toLocal, toMin } from "./logic";

/** A clash for one attendee. Times are office "HH:MM"; title is "Busy" when I may not see the meeting. */
export type Conflict = { memberId: string; memberName: string; title: string; date: string; start: string; end: string };

type Row = {
  id: string;
  title: string;
  starts_at: string;
  minutes: number;
  event_attendees: { member_id: string; rsvp: string }[];
};

/**
 * Meetings that clash with a planned slot on each of `dates` (office dates; pass every occurrence of a series)
 * for the given people. Declined attendees are ignored (cancelled meetings are deleted, so there is no cancelled state).
 * Meetings I can see (RLS: can_see_event) show their title; others, e.g. colleagues' private meetings, come from
 * calendar_busy and show "Busy". `excludeEventId` skips the meeting being edited.
 * Three reads, run together, each once over the whole window: visible events, busy blocks, member names.
 */
export async function findConflicts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  opts: { dates: string[]; time: string; minutes: number; memberIds: string[]; excludeEventId?: string },
): Promise<Conflict[]> {
  const { time, minutes, excludeEventId } = opts;
  const people = new Set(opts.memberIds);
  const dates = new Set(opts.dates);
  if (!people.size || !dates.size) return [];
  const sorted = [...dates].sort();
  const from = fromLocal(sorted[0], "00:00");
  const to = fromLocal(addDays(sorted[sorted.length - 1], 1), "00:00");
  const start = toMin(time);

  const [evRes, busyRes, memRes] = await Promise.all([
    supabase
      .from("events")
      .select("id, title, starts_at, minutes, event_attendees!inner(member_id, rsvp)")
      .in("event_attendees.member_id", [...people])
      .gte("starts_at", from)
      .lt("starts_at", to),
    supabase.rpc("calendar_busy", { range_from: from, range_to: to }),
    supabase.from("members").select("id, name").in("id", [...people]),
  ]);
  const names = new Map(((memRes.data ?? []) as { id: string; name: string }[]).map((m) => [m.id, m.name]));
  const events = (evRes.data ?? []) as Row[];

  const out: Conflict[] = [];
  const push = (memberId: string, startsAt: string, mins: number, title: string) => {
    const at = toLocal(startsAt);
    if (!dates.has(at.date) || !overlaps(start, minutes, at.min, mins)) return;
    out.push({ memberId, memberName: names.get(memberId) ?? "A team member", title, date: at.date, start: fmtT(at.min), end: fmtT(at.min + mins) });
  };
  // Busy blocks repeat what the events query already returned (and the meeting being edited); count those to skip them.
  const known = new Map<string, number>();
  const key = (memberId: string, startsAt: string, mins: number) => `${memberId}|${new Date(startsAt).getTime()}|${mins}`;
  for (const e of events)
    for (const a of e.event_attendees) {
      if (!people.has(a.member_id) || a.rsvp === "no") continue;
      const k = key(a.member_id, e.starts_at, e.minutes);
      known.set(k, (known.get(k) ?? 0) + 1);
      if (e.id !== excludeEventId) push(a.member_id, e.starts_at, e.minutes, e.title);
    }
  for (const b of (busyRes.data ?? []) as { member_id: string; starts_at: string; minutes: number }[]) {
    if (!people.has(b.member_id)) continue;
    const k = key(b.member_id, b.starts_at, b.minutes);
    const n = known.get(k) ?? 0;
    if (n) known.set(k, n - 1);
    else push(b.member_id, b.starts_at, b.minutes, "Busy");
  }

  return out.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start) || a.memberName.localeCompare(b.memberName));
}

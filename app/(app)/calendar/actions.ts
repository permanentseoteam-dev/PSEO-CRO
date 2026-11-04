"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getMe, can } from "@/lib/auth/can";
import { createClient } from "@/lib/supabase/server";
import { listBusy } from "@/lib/modules/calendar/queries";
import {
  REPEATS,
  addDays,
  fmtShort,
  fmtT,
  freeSlots,
  fromLocal,
  occurrences,
  parseGuests,
  toLocal,
} from "@/lib/modules/calendar/logic";

type Fail = { ok: false; error: string };
const fail = (error: string): Fail => ({ ok: false, error });
const NO = "You don't have access to do that.";

async function calendarUser() {
  const me = await getMe();
  return me && me.kind === "staff" && can(me, "calendar.use") ? me : null;
}

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^([01]\d|2[0-3]):(00|15|30|45)$/);
const uuid = z.string().uuid();

const MeetingIn = z
  .object({
    id: uuid.optional().or(z.literal("")),
    clientId: uuid.optional().or(z.literal("")),
    title: z.string().trim().min(1).max(200),
    date,
    start: time,
    minutes: z.coerce.number().int().refine((n) => [15, 30, 45, 60, 90, 120].includes(n)),
    guests: z.string().max(2000).default(""),
    memberIds: z.array(uuid).max(50).default([]),
    where: z.enum(["meet", "loc"]),
    meetLink: z.string().trim().max(300).default(""),
    location: z.string().trim().max(200).default(""),
    agenda: z.string().trim().max(4000).default(""),
    repeat: z.enum(REPEATS),
    visibility: z.enum(["team", "private", "client"]),
    invite: z.boolean().default(true),
  })
  .refine((v) => v.visibility !== "client" || !!v.clientId, { message: "Pick a client to share it in their portal." });

/** Accepts "meet.google.com/abc" or a full https link. */
function normaliseLink(s: string): string | null {
  if (!s) return null;
  const url = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  try {
    const u = new URL(url);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export async function saveMeeting(raw: unknown): Promise<{ ok: true; date: string } | Fail> {
  const parsed = MeetingIn.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues.find((i) => i.code === "custom")?.message ?? "Check the form and try again.");
  const me = await calendarUser();
  if (!me) return fail(NO);
  const v = parsed.data;

  const guests = parseGuests(v.guests);
  if (!guests) return fail("Guests must be email addresses, separated by commas.");
  const meetLink = v.where === "meet" ? normaliseLink(v.meetLink) : null;
  if (v.where === "meet" && v.meetLink && !meetLink) return fail("Enter a valid Meet link, or leave it blank.");

  const clientId = v.clientId || null;
  const fields = {
    title: v.title,
    kind: clientId ? "client_meeting" : "internal",
    client_id: clientId,
    minutes: v.minutes,
    meet_link: meetLink,
    location: v.where === "loc" ? v.location || "Office" : null,
    agenda: v.agenda || null,
    guests,
    visibility: v.visibility,
    send_invites: v.invite,
  };
  const team = [...new Set(v.memberIds.filter((id) => id !== me.id))];
  const supabase = await createClient();

  if (v.id) {
    const { data: ev } = await supabase.from("events").select("id, created_by").eq("id", v.id).maybeSingle();
    if (!ev) return fail("That meeting no longer exists.");
    const organiser = (ev as { created_by: string }).created_by;
    if (organiser !== me.id && !can(me, "calendar.use", "all")) return fail(NO);

    const { error } = await supabase.from("events").update({ ...fields, starts_at: fromLocal(v.date, v.start) }).eq("id", v.id);
    if (error) return fail(error.message);

    const keep = new Set([organiser, ...team]);
    const { data: cur } = await supabase.from("event_attendees").select("member_id").eq("event_id", v.id);
    const current = new Set(((cur ?? []) as { member_id: string }[]).map((a) => a.member_id));
    const remove = [...current].filter((id) => !keep.has(id));
    const add = [...keep].filter((id) => !current.has(id));
    if (remove.length) await supabase.from("event_attendees").delete().eq("event_id", v.id).in("member_id", remove);
    if (add.length) {
      const { error: e2 } = await supabase
        .from("event_attendees")
        .insert(add.map((id) => ({ event_id: v.id, member_id: id, rsvp: id === me.id ? "yes" : "pending" })));
      if (e2) return fail(e2.message);
    }
    if (v.invite) await notify(supabase, me.id, add.filter((id) => id !== me.id), "invited you to", v.title, v.date, v.start);
    revalidatePath("/calendar");
    return { ok: true, date: v.date };
  }

  const dates = occurrences(v.date, v.repeat);
  const seriesId = dates.length > 1 ? crypto.randomUUID() : null;
  const rows = dates.map((d) => ({
    ...fields,
    id: crypto.randomUUID(),
    starts_at: fromLocal(d, v.start),
    repeat: v.repeat,
    series_id: seriesId,
    created_by: me.id,
  }));
  const { error } = await supabase.from("events").insert(rows);
  if (error) return fail(error.message);
  const people = [me.id, ...team];
  const { error: e2 } = await supabase
    .from("event_attendees")
    .insert(rows.flatMap((r) => people.map((id) => ({ event_id: r.id, member_id: id, rsvp: id === me.id ? "yes" : "pending" }))));
  if (e2) return fail(e2.message);
  if (v.invite) await notify(supabase, me.id, team, "invited you to", v.title, v.date, v.start);
  revalidatePath("/calendar");
  return { ok: true, date: v.date };
}

/** In-app invite notices (0101_shell). Email invites wait for the email service. */
async function notify(
  supabase: Awaited<ReturnType<typeof createClient>>,
  actorId: string,
  memberIds: string[],
  action: string,
  title: string,
  date: string,
  start: string,
) {
  if (!memberIds.length) return;
  await supabase.from("notifications").insert(
    memberIds.map((id) => ({
      member_id: id,
      actor_id: actorId,
      kind: "meeting",
      action,
      subject: title,
      detail: `for ${fmtShort(date)} ${start}`,
      href: `/calendar?view=day&d=${date}`,
    })),
  );
}

const RsvpIn = z.object({ eventId: uuid, rsvp: z.enum(["yes", "maybe", "no"]) });

export async function setRsvp(raw: unknown): Promise<{ ok: true } | Fail> {
  const input = RsvpIn.safeParse(raw);
  if (!input.success) return fail("Check the form and try again.");
  const me = await calendarUser();
  if (!me) return fail(NO);
  const supabase = await createClient();
  const { error } = await supabase
    .from("event_attendees")
    .upsert({ event_id: input.data.eventId, member_id: me.id, rsvp: input.data.rsvp }, { onConflict: "event_id,member_id" });
  if (error) return fail(error.message);
  revalidatePath("/calendar");
  return { ok: true };
}

const CancelIn = z.object({ eventId: uuid, all: z.boolean().default(false) });

export async function cancelMeeting(raw: unknown): Promise<{ ok: true; count: number } | Fail> {
  const input = CancelIn.safeParse(raw);
  if (!input.success) return fail("Check the form and try again.");
  const me = await calendarUser();
  if (!me) return fail(NO);
  const supabase = await createClient();
  const { data: ev } = await supabase.from("events").select("id, title, starts_at, series_id, created_by").eq("id", input.data.eventId).maybeSingle();
  if (!ev) return fail("That meeting no longer exists.");
  const e = ev as { id: string; title: string; starts_at: string; series_id: string | null; created_by: string };
  if (e.created_by !== me.id && !can(me, "calendar.use", "all")) return fail(NO);

  const q = supabase.from("events").select("id, starts_at, event_attendees(member_id)");
  const { data: targets } = input.data.all && e.series_id ? await q.eq("series_id", e.series_id) : await q.eq("id", e.id);
  const list = (targets ?? []) as { id: string; starts_at: string; event_attendees: { member_id: string }[] }[];
  if (!list.length) return fail("That meeting no longer exists.");

  const { error } = await supabase.from("events").delete().in("id", list.map((t) => t.id));
  if (error) return fail(error.message);

  const first = toLocal(e.starts_at);
  const who = [...new Set(list.flatMap((t) => t.event_attendees.map((a) => a.member_id)))].filter((id) => id !== me.id);
  await notify(supabase, me.id, who, list.length > 1 ? "cancelled the series" : "cancelled", e.title, first.date, fmtT(first.min));
  revalidatePath("/calendar");
  return { ok: true, count: list.length };
}

const FindIn = z.object({
  date,
  minutes: z.coerce.number().int().min(15).max(240),
  memberIds: z.array(uuid).max(50).default([]),
});

/** Free start times on a day for me and the people picked, 09:00–18:00. */
export async function findTime(raw: unknown): Promise<{ ok: true; slots: string[] } | Fail> {
  const input = FindIn.safeParse(raw);
  if (!input.success) return fail("Pick a date and length first.");
  const me = await calendarUser();
  if (!me) return fail(NO);
  const { date: d, minutes, memberIds } = input.data;
  const people = new Set([me.id, ...memberIds]);
  const busy = (await listBusy(d, addDays(d, 1))).filter((b) => people.has(b.memberId) && b.date === d);
  const now = toLocal(new Date());
  const slots = freeSlots({
    date: d,
    len: minutes,
    blocks: busy.map((b) => [b.start, b.start + b.mins]),
    notBefore: d === now.date ? now.min : d < now.date ? 24 * 60 : 0,
  });
  return { ok: true, slots: slots.map(fmtT) };
}


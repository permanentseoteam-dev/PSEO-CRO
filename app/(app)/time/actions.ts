"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getMe, can, type Me } from "@/lib/auth/can";
import { createClient } from "@/lib/supabase/server";
import { checkLogEntry, parseDuration, resolveBillable, today, weekStart } from "@/lib/modules/personal/logic";
import type { Result } from "@/lib/modules/personal/types";

// Time writes. Timer start/stop reuse startTimer/stopTimer from lib/modules/tickets/actions.
// The week lock is enforced in the database (time_entries_week_lock trigger in 0113_personal).

const BAD = { ok: false as const, error: "Check the form and try again." };
const NO = { ok: false as const, error: "You don't have access to do that." };
const fail = (e: { message: string } | null) => ({ ok: false as const, error: e?.message ?? "Something went wrong. Try again." });
const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

async function staff(): Promise<Me | null> {
  const me = await getMe();
  return me && me.kind === "staff" ? me : null;
}
const done = () => revalidatePath("/time");

async function ticketHasClient(ticketId: string | null) {
  if (!ticketId) return false;
  const db = await createClient();
  const { data } = await db.from("tickets").select("client_id").eq("id", ticketId).maybeSingle();
  return !!data?.client_id;
}

// ---------------------------------------------------------------- manual entry

const Log = z.object({
  ticketId: uuid.nullable(),
  duration: z.string().max(20),
  date,
  note: z.string().max(500).default(""),
  billable: z.enum(["auto", "yes", "no"]).default("auto"),
});

export async function logEntry(raw: unknown): Promise<Result<{ minutes: number }>> {
  const p = Log.safeParse(raw);
  if (!p.success) return BAD;
  const minutes = parseDuration(p.data.duration);
  if (!minutes || minutes > 1440) return { ok: false, error: "Enter time like 1h 30m (up to 24h)." };
  const problem = checkLogEntry(p.data.date, p.data.note, today());
  if (problem) return { ok: false, error: problem };
  const me = await staff();
  if (!me) return NO;
  const db = await createClient();
  const { error } = await db.from("time_entries").insert({
    member_id: me.id,
    ticket_id: p.data.ticketId,
    date: p.data.date,
    minutes,
    billable: resolveBillable(p.data.billable, await ticketHasClient(p.data.ticketId)),
    note: p.data.note.trim() || null,
  });
  if (error) return fail(error);
  done();
  return { ok: true, data: { minutes } };
}

// ---------------------------------------------------------------- week grid cell

const Cell = z.object({ ticketId: uuid.nullable(), date, value: z.string().max(20) });

/** Sets my total for one ticket on one day: replaces that day's entries with one entry (or none for 0). */
export async function setDayTotal(raw: unknown): Promise<Result<{ minutes: number }>> {
  const p = Cell.safeParse(raw);
  if (!p.success) return BAD;
  const minutes = parseDuration(p.data.value);
  if (minutes === null || minutes > 1440) return { ok: false, error: "Enter time like 1h 30m (up to 24h)." };
  if (p.data.date > today()) return { ok: false, error: "You can't log time ahead of today." };
  const me = await staff();
  if (!me) return NO;
  const db = await createClient();
  let q = db.from("time_entries").select("id, minutes, billable, note").eq("member_id", me.id).eq("date", p.data.date);
  q = p.data.ticketId ? q.eq("ticket_id", p.data.ticketId) : q.is("ticket_id", null);
  const { data: rows, error: readErr } = await q;
  if (readErr) return fail(readErr);
  const existing = (rows ?? []) as { id: string; minutes: number; billable: boolean; note: string | null }[];
  if (existing.reduce((a, r) => a + r.minutes, 0) === minutes) return { ok: true, data: { minutes } };

  if (existing.length) {
    const del = await db.from("time_entries").delete().in("id", existing.map((r) => r.id));
    if (del.error) return fail(del.error);
  }
  if (minutes > 0) {
    const notes = existing.map((r) => r.note).filter(Boolean).join(" · ").slice(0, 500);
    const { error } = await db.from("time_entries").insert({
      member_id: me.id,
      ticket_id: p.data.ticketId,
      date: p.data.date,
      minutes,
      billable: existing.length ? existing[0].billable : await ticketHasClient(p.data.ticketId),
      note: notes || null,
    });
    if (error) return fail(error);
  }
  done();
  return { ok: true, data: { minutes } };
}

// ---------------------------------------------------------------- week flow

export async function submitWeek(raw: unknown): Promise<Result> {
  const p = date.safeParse(raw);
  if (!p.success || weekStart(p.data) !== p.data) return BAD;
  const me = await staff();
  if (!me) return NO;
  const db = await createClient();
  const { error } = await db
    .from("timesheets")
    .upsert(
      { member_id: me.id, week_start: p.data, status: "submitted", submitted_at: new Date().toISOString(), return_note: null },
      { onConflict: "member_id,week_start" },
    );
  if (error) return fail(error);
  done();
  return { ok: true };
}

const Decide = z.object({ id: uuid, decision: z.enum(["approve", "return"]), note: z.string().trim().max(1000).optional() });

export async function decideSheet(raw: unknown): Promise<Result> {
  const p = Decide.safeParse(raw);
  if (!p.success) return BAD;
  if (p.data.decision === "return" && !p.data.note) return { ok: false, error: "Add a note so they know what to fix." };
  const me = await staff();
  if (!me || !can(me, "time.approve", "team")) return NO;
  const db = await createClient();
  const { data, error } = await db
    .from("timesheets")
    .update({
      status: p.data.decision === "approve" ? "approved" : "returned",
      decided_by: me.id,
      decided_at: new Date().toISOString(),
      return_note: p.data.decision === "return" ? p.data.note : null,
    })
    .eq("id", p.data.id)
    .eq("status", "submitted")
    .neq("member_id", me.id)
    .select("id");
  if (error) return fail(error);
  if (!data?.length) return { ok: false, error: "This timesheet isn't waiting for approval." };
  done();
  return { ok: true };
}

const LeaveDecide = z.object({ id: uuid, decision: z.enum(["approve", "decline"]) });

export async function decideLeave(raw: unknown): Promise<Result> {
  const p = LeaveDecide.safeParse(raw);
  if (!p.success) return BAD;
  const me = await staff();
  if (!me || !can(me, "time.approve", "team")) return NO;
  const db = await createClient();
  const { data, error } = await db
    .from("leave_requests")
    .update({ status: p.data.decision === "approve" ? "approved" : "declined", decided_by: me.id, decided_at: new Date().toISOString() })
    .eq("id", p.data.id)
    .eq("status", "pending")
    .neq("member_id", me.id)
    .select("id");
  if (error) return fail(error);
  if (!data?.length) return { ok: false, error: "This request isn't waiting any more." };
  done();
  revalidatePath("/me");
  return { ok: true };
}

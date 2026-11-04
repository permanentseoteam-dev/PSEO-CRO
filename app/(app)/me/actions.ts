"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getMe, can, type Me } from "@/lib/auth/can";
import { createClient } from "@/lib/supabase/server";
import { checkLeave, today, workingDays } from "@/lib/modules/personal/logic";
import type { Result } from "@/lib/modules/personal/types";

const BAD = { ok: false as const, error: "Check the form and try again." };
const NO = { ok: false as const, error: "You don't have access to do that." };
const fail = (e: { message: string } | null) => ({ ok: false as const, error: e?.message ?? "Something went wrong. Try again." });
const opt = (max: number) => z.string().trim().max(max).transform((s) => s || null);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

async function staff(): Promise<Me | null> {
  const me = await getMe();
  return me && me.kind === "staff" ? me : null;
}
const done = () => {
  revalidatePath("/me");
  revalidatePath("/", "layout");
};

// ---------------------------------------------------------------- my details

const Details = z.object({
  bio: opt(2000),
  skills: z.string().max(500),
  phone: opt(40),
  linkedin: opt(200),
  emergencyName: opt(100),
  emergencyPhone: opt(40),
});

export async function saveMyDetails(raw: unknown): Promise<Result> {
  const p = Details.safeParse(raw);
  if (!p.success) return BAD;
  const me = await staff();
  if (!me) return NO;
  const db = await createClient();
  const skills = [...new Set(p.data.skills.split(",").map((s) => s.trim()).filter(Boolean))].slice(0, 20);
  const a = await db.from("member_details").upsert(
    { member_id: me.id, bio: p.data.bio, linkedin: p.data.linkedin, emergency_name: p.data.emergencyName, emergency_phone: p.data.emergencyPhone },
    { onConflict: "member_id" },
  );
  if (a.error) return fail(a.error);
  const b = await db.from("member_profiles").upsert({ member_id: me.id, skills, phone: p.data.phone }, { onConflict: "member_id" });
  if (b.error) return fail(b.error);
  done();
  return { ok: true };
}

const Hr = z.object({
  memberId: z.string().uuid(),
  title: opt(120),
  departmentId: z.string().uuid().nullable(),
  managerId: z.string().uuid().nullable(),
  shift: opt(60),
  joinedOn: date.nullable(),
  contract: z.enum(["full_time", "part_time", "contractor"]),
  location: opt(100),
});

/** HR edits job fields. Title, department and manager live on members (admins only, by the core guard). */
export async function saveHrDetails(raw: unknown): Promise<Result> {
  const p = Hr.safeParse(raw);
  if (!p.success) return BAD;
  const me = await staff();
  if (!me || !can(me, "hr.manage", "all")) return NO;
  if (p.data.managerId === p.data.memberId) return { ok: false, error: "Someone can't be their own manager." };
  const db = await createClient();
  const m = await db.from("members").update({ title: p.data.title, department_id: p.data.departmentId, manager_id: p.data.managerId }).eq("id", p.data.memberId);
  if (m.error) return fail(m.error);
  const a = await db.from("member_profiles").upsert({ member_id: p.data.memberId, shift: p.data.shift, joined_on: p.data.joinedOn }, { onConflict: "member_id" });
  if (a.error) return fail(a.error);
  const b = await db.from("member_details").upsert({ member_id: p.data.memberId, contract: p.data.contract, location: p.data.location }, { onConflict: "member_id" });
  if (b.error) return fail(b.error);
  done();
  return { ok: true };
}

// ---------------------------------------------------------------- clock

const Clock = z.enum(["in", "out", "break_start", "break_end"]);

export async function clock(raw: unknown): Promise<Result> {
  const op = Clock.safeParse(raw);
  if (!op.success) return BAD;
  const me = await staff();
  if (!me) return NO;
  const db = await createClient();
  const { data: open } = await db.from("attendance").select("id, break_minutes, break_started_at").eq("member_id", me.id).is("clock_out", null).maybeSingle();
  const now = new Date();
  const breakMins = (s: { break_minutes: number; break_started_at: string | null }) =>
    s.break_minutes + (s.break_started_at ? Math.max(0, Math.floor((now.getTime() - new Date(s.break_started_at).getTime()) / 60000)) : 0);
  let error: { message: string } | null = null;
  if (op.data === "in") {
    if (open) return { ok: false, error: "You're already clocked in." };
    ({ error } = await db.from("attendance").insert({ member_id: me.id, clock_in: now.toISOString() }));
  } else {
    if (!open) return { ok: false, error: "You're not clocked in." };
    if (op.data === "break_start") {
      if (open.break_started_at) return { ok: false, error: "You're already on a break." };
      ({ error } = await db.from("attendance").update({ break_started_at: now.toISOString() }).eq("id", open.id));
    } else if (op.data === "break_end") {
      ({ error } = await db.from("attendance").update({ break_minutes: breakMins(open), break_started_at: null }).eq("id", open.id));
    } else {
      ({ error } = await db.from("attendance").update({ clock_out: now.toISOString(), break_minutes: breakMins(open), break_started_at: null }).eq("id", open.id));
    }
  }
  if (error) return fail(error);
  done();
  return { ok: true };
}

// ---------------------------------------------------------------- leave, WFH, overtime

const Leave = z.object({
  type: z.enum(["annual", "sick", "wfh", "unpaid", "overtime"]),
  start: date,
  end: date.optional(),
  halfDay: z.boolean().default(false),
  minutes: z.number().int().min(1).max(1440).optional(),
  reason: opt(1000),
});

export async function requestLeave(raw: unknown): Promise<Result> {
  const p = Leave.safeParse(raw);
  if (!p.success) return BAD;
  const me = await staff();
  if (!me) return NO;
  const d = p.data;
  const end = d.halfDay || d.type === "overtime" || !d.end ? d.start : d.end;
  const problem = checkLeave(d.type, d.start, end, today());
  if (problem) return { ok: false, error: problem };
  if (d.type === "overtime" && !d.minutes) return { ok: false, error: "Enter the extra time, like 2h 00m." };
  const days = d.type === "overtime" ? 0 : workingDays(d.start, end, d.halfDay);
  if (d.type !== "overtime" && days === 0) return { ok: false, error: "Those dates are all weekend days." };
  const db = await createClient();
  const { error } = await db.from("leave_requests").insert({
    member_id: me.id, type: d.type, start_date: d.start, end_date: end, half_day: d.halfDay, days,
    minutes: d.type === "overtime" ? d.minutes : null, reason: d.reason,
  });
  if (error) return fail(error);
  done();
  return { ok: true };
}

export async function cancelLeave(raw: unknown): Promise<Result> {
  const id = z.string().uuid().safeParse(raw);
  if (!id.success) return BAD;
  const me = await staff();
  if (!me) return NO;
  const db = await createClient();
  const { error } = await db.from("leave_requests").update({ status: "cancelled" }).eq("id", id.data).eq("member_id", me.id).eq("status", "pending");
  if (error) return fail(error);
  done();
  return { ok: true };
}

// ---------------------------------------------------------------- documents

const NewDoc = z.object({
  path: z.string().min(3).max(400),
  name: z.string().trim().min(1).max(200),
  type: z.enum(["id", "visa", "contract", "letter", "education", "other"]),
  expiresOn: date.nullable(),
  hrOnly: z.boolean(),
  size: z.number().int().min(0).max(15 * 1024 * 1024),
});

/** Saves the row for a file the browser already uploaded to member-docs/<my id>/… */
export async function addDocument(raw: unknown): Promise<Result> {
  const p = NewDoc.safeParse(raw);
  if (!p.success) return BAD;
  const me = await staff();
  if (!me) return NO;
  if (!p.data.path.startsWith(`${me.id}/`)) return BAD;
  if (p.data.hrOnly && !can(me, "hr.manage", "all")) return { ok: false, error: "Only HR can mark a document HR only." };
  const db = await createClient();
  const { error } = await db.from("documents").insert({
    member_id: me.id, name: p.data.name, type: p.data.type, hr_only: p.data.hrOnly, expires_on: p.data.expiresOn, storage_path: p.data.path, size_bytes: p.data.size,
  });
  if (error) {
    await db.storage.from("member-docs").remove([p.data.path]);
    return fail(error);
  }
  done();
  return { ok: true };
}

/** A short-lived link to open a document. */
export async function documentUrl(raw: unknown): Promise<Result<{ url: string }>> {
  const id = z.string().uuid().safeParse(raw);
  if (!id.success) return BAD;
  const me = await staff();
  if (!me) return NO;
  const db = await createClient();
  const { data: doc } = await db.from("documents").select("storage_path").eq("id", id.data).maybeSingle();
  if (!doc?.storage_path) return { ok: false, error: "There's no file for this document yet." };
  const { data, error } = await db.storage.from("member-docs").createSignedUrl(doc.storage_path as string, 60);
  if (error || !data) return fail(error);
  return { ok: true, data: { url: data.signedUrl } };
}

// ---------------------------------------------------------------- reviews

export async function acknowledgeReview(raw: unknown): Promise<Result> {
  const id = z.string().uuid().safeParse(raw);
  if (!id.success) return BAD;
  const me = await staff();
  if (!me) return NO;
  const db = await createClient();
  const { data, error } = await db
    .from("perf_reviews")
    .update({ status: "acknowledged" })
    .eq("id", id.data)
    .eq("member_id", me.id)
    .eq("status", "shared")
    .select("id");
  if (error) return fail(error);
  if (!data?.length) return { ok: false, error: "This review isn't waiting for you." };
  done();
  return { ok: true };
}

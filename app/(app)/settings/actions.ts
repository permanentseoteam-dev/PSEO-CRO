"use server";
import { z } from "zod";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { can, getMe } from "@/lib/auth/can";
import { LOGO_BUCKET, accentProblem } from "@/lib/modules/portal-design/logic";
import { createClient } from "@/lib/supabase/server";
import type { Result } from "@/lib/modules/personal/types";

const BAD = { ok: false as const, error: "Check the form and try again." };
const NO = { ok: false as const, error: "You don't have access to do that." };
const fail = (e: { message: string } | null) => ({ ok: false as const, error: e?.message ?? "Something went wrong. Try again." });
const YEAR = 60 * 60 * 24 * 365;

async function upsertSettings(memberId: string, values: Record<string, unknown>): Promise<Result> {
  const db = await createClient();
  const { error } = await db.from("user_settings").upsert({ member_id: memberId, ...values }, { onConflict: "member_id" });
  return error ? fail(error) : { ok: true };
}

const Design = z.object({ theme: z.enum(["system", "light", "dark"]), density: z.enum(["comfortable", "compact"]) });

/** Saves theme and density, and sets the cookies the root layout reads for the first paint. */
export async function saveDesign(raw: unknown): Promise<Result> {
  const p = Design.safeParse(raw);
  if (!p.success) return BAD;
  const me = await getMe();
  if (!me) return NO;
  const jar = await cookies();
  const opts = { path: "/", maxAge: YEAR, sameSite: "lax" as const };
  if (p.data.theme === "system") jar.delete("theme");
  else jar.set("theme", p.data.theme, opts);
  if (p.data.density === "compact") jar.set("density", "compact", opts);
  else jar.delete("density");
  const r = await upsertSettings(me.id, { theme: p.data.theme, density: p.data.density });
  if (r.ok) revalidatePath("/", "layout");
  return r;
}

export async function saveEmail(raw: unknown): Promise<Result> {
  const p = z.enum(["daily", "urgent", "off"]).safeParse(raw);
  if (!p.success) return BAD;
  const me = await getMe();
  if (!me) return NO;
  return upsertSettings(me.id, { email_digest: p.data });
}

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const Quiet = z.object({ from: time.or(z.literal("")), to: time.or(z.literal("")) });

export async function saveQuiet(raw: unknown): Promise<Result> {
  const p = Quiet.safeParse(raw);
  if (!p.success) return BAD;
  if (!p.data.from !== !p.data.to) return { ok: false, error: "Set both times, or clear both." };
  const me = await getMe();
  if (!me) return NO;
  return upsertSettings(me.id, { quiet_from: p.data.from || null, quiet_to: p.data.to || null });
}

const Notif = z.object({
  event: z.enum(["assigned", "mention", "client_reply", "watch_change", "review_wait", "invoice_overdue"]),
  inApp: z.boolean(),
  email: z.boolean(),
  phone: z.boolean(),
});

export async function saveNotif(raw: unknown): Promise<Result> {
  const p = Notif.safeParse(raw);
  if (!p.success) return BAD;
  const me = await getMe();
  if (!me) return NO;
  const db = await createClient();
  const { error } = await db
    .from("notification_prefs")
    .upsert({ member_id: me.id, event: p.data.event, in_app: p.data.inApp, email: p.data.email, phone: p.data.phone }, { onConflict: "member_id,event" });
  return error ? fail(error) : { ok: true };
}

const Profile = z.object({
  name: z.string().trim().min(2).max(80),
  slackUserId: z.string().trim().max(30).regex(/^[A-Z0-9]*$/, "Slack IDs look like U04QJ7K2M1P."),
});

export async function saveProfile(raw: unknown): Promise<Result> {
  const p = Profile.safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? BAD.error };
  const me = await getMe();
  if (!me) return NO;
  const db = await createClient();
  const a = await db.from("members").update({ name: p.data.name }).eq("id", me.id);
  if (a.error) return fail(a.error);
  if (me.kind === "staff") {
    const b = await db.from("member_details").upsert({ member_id: me.id, slack_user_id: p.data.slackUserId || null }, { onConflict: "member_id" });
    if (b.error) return fail(b.error);
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------- admin: 2-step policy and client portal design

const isAdmin = (me: Awaited<ReturnType<typeof getMe>>) => can(me, "admin.access.manage", "all");

/** Staff roles that must use 2-step sign-in. Unknown or client roles are rejected. */
export async function saveTwoStepPolicy(raw: unknown): Promise<Result> {
  const p = z.array(z.string().min(1).max(60)).max(100).safeParse(raw);
  if (!p.success) return BAD;
  const me = await getMe();
  if (!isAdmin(me)) return NO;
  const db = await createClient();
  const roles = [...new Set(p.data)];
  if (roles.length) {
    const { data, error } = await db.from("roles").select("key").eq("kind", "staff").in("key", roles);
    if (error) return fail(error);
    if ((data ?? []).length !== roles.length) return BAD;
  }
  const { error } = await db.from("security_settings").upsert({ id: true, mfa_required_roles: roles, updated_by: me!.id }, { onConflict: "id" });
  if (error) return fail(error);
  revalidatePath("/settings");
  return { ok: true };
}

const PortalDesign = z.object({
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  theme: z.enum(["system", "light", "dark"]),
  density: z.enum(["comfortable", "compact"]),
});

/** Company defaults for client portals. The accent must reach 4.5:1 on white. */
export async function savePortalDesign(raw: unknown): Promise<Result> {
  const p = PortalDesign.safeParse(raw);
  if (!p.success) return BAD;
  const problem = accentProblem(p.data.accent);
  if (problem) return { ok: false, error: problem };
  const me = await getMe();
  if (!isAdmin(me)) return NO;
  const db = await createClient();
  const { error } = await db
    .from("portal_design_settings")
    .upsert({ id: true, accent: p.data.accent.toLowerCase(), theme: p.data.theme, density: p.data.density, updated_by: me!.id }, { onConflict: "id" });
  if (error) return fail(error);
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Records the default logo after the browser uploaded it to "portal-branding" (RLS and the bucket's
 * type/size limits check the file). Pass null to remove it. The old file is deleted.
 */
export async function savePortalLogo(raw: unknown): Promise<Result> {
  const p = z.union([z.string().regex(/^defaults\/logo-\d+\.(png|jpg|webp)$/), z.null()]).safeParse(raw);
  if (!p.success) return BAD;
  const me = await getMe();
  if (!isAdmin(me)) return NO;
  const db = await createClient();
  const { data: cur } = await db.from("portal_design_settings").select("logo_path").maybeSingle();
  const { error } = await db.from("portal_design_settings").upsert({ id: true, logo_path: p.data, updated_by: me!.id }, { onConflict: "id" });
  if (error) return fail(error);
  if (cur?.logo_path && cur.logo_path !== p.data) await db.storage.from(LOGO_BUCKET).remove([cur.logo_path]);
  revalidatePath("/", "layout");
  return { ok: true };
}

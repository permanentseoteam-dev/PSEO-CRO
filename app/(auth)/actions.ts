"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authErrorMessage, homeFor, inviteState, safeNext } from "@/lib/modules/access/logic";
import { getInviteByToken } from "@/lib/modules/access/queries";
import { siteOrigin } from "@/lib/modules/access/site";
import { needsVerify, verifyPath } from "@/lib/auth/mfa-logic";

type Result = { ok: true } | { ok: false; error: string };

const Email = z.string().trim().toLowerCase().email();
const Password = z.string().min(8, "Use at least 8 characters.").max(200);

/**
 * After a successful sign-in: people with 2-step on go to /login/verify first; then active members
 * go to `next` (or their home), everyone else to /no-access.
 */
async function land(next?: string): Promise<never> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (needsVerify(aal)) redirect(verifyPath(next));
  }
  const { data: m } = auth.user
    ? await supabase.from("members").select("kind, status").eq("id", auth.user.id).maybeSingle()
    : { data: null };
  if (!m || m.status !== "active") redirect("/no-access");
  redirect(safeNext(next, homeFor(m.kind)));
}

const PasswordIn = z.object({ email: Email, password: z.string().min(1).max(200), next: z.string().optional() });

export async function signInWithPassword(raw: unknown): Promise<Result> {
  const input = PasswordIn.safeParse(raw);
  if (!input.success) return { ok: false, error: "Enter your email and password." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: input.data.email, password: input.data.password });
  if (error) return { ok: false, error: authErrorMessage(error.message) };
  return land(input.data.next);
}

export async function sendLoginCode(raw: unknown): Promise<Result> {
  const input = z.object({ email: Email }).safeParse(raw);
  if (!input.success) return { ok: false, error: "Enter a valid work email." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ email: input.data.email, options: { shouldCreateUser: false } });
  if (error) return { ok: false, error: authErrorMessage(error.message) };
  return { ok: true };
}

const CodeIn = z.object({ email: Email, code: z.string().trim().regex(/^\d{6}$/), next: z.string().optional() });

export async function verifyLoginCode(raw: unknown): Promise<Result> {
  const input = CodeIn.safeParse(raw);
  if (!input.success) return { ok: false, error: "Enter the 6-digit code from the email." };
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email: input.data.email, token: input.data.code, type: "email" });
  if (error) return { ok: false, error: authErrorMessage(error.message) };
  return land(input.data.next);
}

const TwoStepIn = z.object({ code: z.string().trim().regex(/^\d{6}$/), next: z.string().optional() });

/** Second step of sign-in: check the authenticator code, which lifts the session to aal2. */
export async function verifyTwoStep(raw: unknown): Promise<Result> {
  const input = TwoStepIn.safeParse(raw);
  if (!input.success) return { ok: false, error: "Enter the 6-digit code from your authenticator app." };
  const supabase = await createClient();
  const { data: factors, error: listErr } = await supabase.auth.mfa.listFactors();
  if (listErr) return { ok: false, error: "Your session has ended. Sign in again." };
  const factor = factors.totp[0];
  if (!factor) return land(input.data.next);
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: input.data.code });
  if (error) return { ok: false, error: /invalid|expired/i.test(error.message) ? "That code isn't right. Check your app and try again." : authErrorMessage(error.message) };
  return land(input.data.next);
}

export async function requestPasswordReset(raw: unknown): Promise<Result> {
  const input = z.object({ email: Email }).safeParse(raw);
  if (!input.success) return { ok: false, error: "Enter a valid work email." };
  const supabase = await createClient();
  const origin = await siteOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(input.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset/new`,
  });
  // Don't reveal whether the email has an account; only surface rate limits.
  if (error && /rate|too many|security purposes/i.test(error.message)) return { ok: false, error: authErrorMessage(error.message) };
  return { ok: true };
}

const NewPasswordIn = z
  .object({ password: Password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: "The passwords don't match." });

export async function setNewPassword(raw: unknown): Promise<Result> {
  const input = NewPasswordIn.safeParse(raw);
  if (!input.success) return { ok: false, error: input.error.issues[0]?.message ?? "Check the form and try again." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "This reset link has expired. Ask for a new one." };
  const { error } = await supabase.auth.updateUser({ password: input.data.password });
  if (error) return { ok: false, error: authErrorMessage(error.message) };
  return land();
}

const AcceptIn = z.object({
  token: z.string().min(1).max(200),
  name: z.string().trim().min(2, "Enter your name.").max(120),
  password: Password,
});

/** Accept an invite: create the login and member row with the service key, then sign in. */
export async function acceptInvite(raw: unknown): Promise<Result> {
  const input = AcceptIn.safeParse(raw);
  if (!input.success) return { ok: false, error: input.error.issues[0]?.message ?? "Check the form and try again." };
  const { token, name, password } = input.data;

  const inv = await getInviteByToken(token);
  if (!inv || inviteState(inv) !== "waiting" || !inv.roleKind)
    return { ok: false, error: "This invite link doesn't work any more. Ask for a new one." };
  if (inv.roleKind === "client" && !inv.client_id) return { ok: false, error: "This invite is missing its client. Ask for a new one." };

  const admin = createAdminClient();
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: inv.email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (createErr || !created.user) return { ok: false, error: authErrorMessage(createErr?.message) };
  const uid = created.user.id;

  const { error: memberErr } = await admin.from("members").insert({
    id: uid,
    email: inv.email,
    name,
    kind: inv.roleKind,
    client_id: inv.roleKind === "client" ? inv.client_id : null,
    department_id: inv.roleKind === "staff" ? inv.department_id : null,
    status: "active",
  });
  const { error: roleErr } = memberErr ? { error: memberErr } : await admin.from("member_roles").insert({ member_id: uid, role: inv.role });
  if (memberErr || roleErr) {
    await admin.auth.admin.deleteUser(uid); // cascades to members and member_roles
    return { ok: false, error: "We couldn't set up your account. Try again or ask for a new invite." };
  }
  await admin.from("invites").update({ status: "accepted", accepted_at: new Date().toISOString(), member_id: uid }).eq("id", inv.id);
  await admin.from("audit_log").insert({
    actor_id: uid,
    action: "invite.accept",
    summary: `${name} accepted the invite as ${inv.roleName}`,
    target_type: "invite",
    target_id: inv.id,
    client_id: inv.roleKind === "client" ? inv.client_id : null,
  });

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: inv.email, password });
  if (error) redirect("/login");
  redirect(homeFor(inv.roleKind));
}

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getMe, can } from "@/lib/auth/can";
import { SCOPES } from "@/lib/auth/perms";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/modules/access/audit";
import { sendInviteEmail } from "@/lib/modules/access/email";
import { roleDiff } from "@/lib/modules/access/logic";
import { siteOrigin } from "@/lib/modules/access/site";
import { hashInviteToken, newInviteToken } from "@/lib/modules/access/token";

type Fail = { ok: false; error: string };
const fail = (error: string): Fail => ({ ok: false, error });
const NO = "You don't have access to do that.";
const BAD = "Check the form and try again.";

async function admin() {
  const me = await getMe();
  return me && can(me, "admin.access.manage", "all") ? me : null;
}

async function roleByKey(supabase: Awaited<ReturnType<typeof createClient>>, key: string) {
  const { data } = await supabase.from("roles").select("key, name, kind").eq("key", key).maybeSingle();
  return data as { key: string; name: string; kind: "staff" | "client" } | null;
}

const inviteExpiry = () => new Date(Date.now() + 14 * 864e5).toISOString();

// ---------------------------------------------------------------- invites

const InviteIn = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().max(120).optional(),
  role: z.string().min(1),
  departmentId: z.string().uuid().optional().or(z.literal("")),
  clientId: z.string().uuid().optional().or(z.literal("")),
});

export async function createInvite(raw: unknown): Promise<{ ok: true; link: string; emailed: boolean } | Fail> {
  const input = InviteIn.safeParse(raw);
  if (!input.success) return fail("Enter a valid email and pick a role.");
  const me = await admin();
  if (!me) return fail(NO);
  const { email, name, departmentId, clientId } = input.data;

  const supabase = await createClient();
  const role = await roleByKey(supabase, input.data.role);
  if (!role) return fail("Pick a role.");
  if (role.key === "super_admin" && !me.roles.includes("super_admin")) return fail("Only a super admin can invite a super admin.");
  if (role.kind === "client" && !clientId) return fail("Pick the client this login belongs to.");

  const { data: existing } = await supabase.from("members").select("id").eq("email", email).maybeSingle();
  if (existing) return fail(`${email} already has an account.`);

  const token = newInviteToken();
  const { data: inv, error } = await supabase
    .from("invites")
    .insert({
      email,
      name: name || null,
      role: role.key,
      department_id: role.kind === "staff" ? departmentId || null : null,
      client_id: role.kind === "client" ? clientId : null,
      token_hash: hashInviteToken(token),
      invited_by: me.id,
      expires_at: inviteExpiry(),
    })
    .select("id")
    .single();
  if (error) return fail(error.code === "23505" ? "There's already an open invite for this email. Resend it instead." : error.message);

  const link = `${await siteOrigin()}/invite/${token}`;
  const emailed = await sendInviteEmail(email, link, me.name);
  await logAudit(supabase, me.id, {
    action: "invite.create",
    summary: `Invited ${email} as ${role.name}`,
    targetType: "invite",
    targetId: inv.id,
    clientId: role.kind === "client" ? clientId : null,
  });
  revalidatePath("/admin/invites");
  return { ok: true, link, emailed };
}

const IdIn = z.object({ id: z.string().uuid() });

/** New token (the old link stops working), fresh 14 days, email again. */
export async function resendInvite(raw: unknown): Promise<{ ok: true; link: string; emailed: boolean } | Fail> {
  const input = IdIn.safeParse(raw);
  if (!input.success) return fail(BAD);
  const me = await admin();
  if (!me) return fail(NO);

  const supabase = await createClient();
  const token = newInviteToken();
  const { data: inv, error } = await supabase
    .from("invites")
    .update({ token_hash: hashInviteToken(token), sent_at: new Date().toISOString(), expires_at: inviteExpiry() })
    .eq("id", input.data.id)
    .eq("status", "pending")
    .select("id, email, client_id")
    .maybeSingle();
  if (error) return fail(error.message);
  if (!inv) return fail("This invite is no longer open.");

  const link = `${await siteOrigin()}/invite/${token}`;
  const emailed = await sendInviteEmail(inv.email, link, me.name);
  await logAudit(supabase, me.id, {
    action: "invite.resend",
    summary: `Sent the invite to ${inv.email} again`,
    targetType: "invite",
    targetId: inv.id,
    clientId: inv.client_id,
  });
  revalidatePath("/admin/invites");
  return { ok: true, link, emailed };
}

export async function revokeInvite(raw: unknown): Promise<{ ok: true } | Fail> {
  const input = IdIn.safeParse(raw);
  if (!input.success) return fail(BAD);
  const me = await admin();
  if (!me) return fail(NO);

  const supabase = await createClient();
  const { data: inv, error } = await supabase
    .from("invites")
    .update({ status: "revoked" })
    .eq("id", input.data.id)
    .eq("status", "pending")
    .select("id, email, client_id")
    .maybeSingle();
  if (error) return fail(error.message);
  if (!inv) return fail("This invite is no longer open.");
  await logAudit(supabase, me.id, {
    action: "invite.revoke",
    summary: `Revoked the invite to ${inv.email}`,
    targetType: "invite",
    targetId: inv.id,
    clientId: inv.client_id,
  });
  revalidatePath("/admin/invites");
  return { ok: true };
}

// ---------------------------------------------------------------- roles matrix

const MatrixIn = z.object({
  changes: z.array(z.object({ role: z.string().min(1), perm: z.string().min(1), scope: z.enum(SCOPES) })).min(1).max(500),
});

export async function saveRolePermissions(raw: unknown): Promise<{ ok: true; count: number } | Fail> {
  const input = MatrixIn.safeParse(raw);
  if (!input.success) return fail(BAD);
  const me = await admin();
  if (!me) return fail(NO);
  const { changes } = input.data;
  if (changes.some((c) => c.role === "super_admin")) return fail("Super admin always has every permission.");
  if (changes.some((c) => c.role === "admin" && c.perm === "admin.access.manage"))
    return fail("Admins always keep admin.access.manage, so nobody gets locked out.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("role_permissions")
    .upsert(changes.map((c) => ({ role: c.role, perm_key: c.perm, scope: c.scope })), { onConflict: "role,perm_key" });
  if (error) return fail(error.message);

  const { data: roles } = await supabase.from("roles").select("key, name");
  const roleName = new Map((roles ?? []).map((r) => [r.key as string, r.name as string]));
  for (const c of changes) {
    await logAudit(supabase, me.id, {
      action: "roles.permission",
      summary: `Changed ${c.perm} for ${roleName.get(c.role) ?? c.role} to ${c.scope}`,
      targetType: "role",
      targetId: c.role,
      meta: { perm: c.perm, scope: c.scope },
    });
  }
  revalidatePath("/admin/roles");
  return { ok: true, count: changes.length };
}

// ---------------------------------------------------------------- people

const AccessIn = z.object({
  memberId: z.string().uuid(),
  roles: z.array(z.string().min(1)).min(1, "Give them at least one role.").max(10),
  status: z.enum(["active", "suspended", "left"]),
});

export async function savePersonAccess(raw: unknown): Promise<{ ok: true } | Fail> {
  const input = AccessIn.safeParse(raw);
  if (!input.success) return fail(input.error.issues[0]?.message ?? BAD);
  const me = await admin();
  if (!me) return fail(NO);
  const { memberId, roles, status } = input.data;

  const supabase = await createClient();
  const { data: person } = await supabase
    .from("members")
    .select("id, name, kind, status, member_roles(role)")
    .eq("id", memberId)
    .maybeSingle();
  if (!person) return fail("Person not found.");

  const { data: roleRows } = await supabase.from("roles").select("key, name, kind").in("key", roles);
  if ((roleRows ?? []).length !== roles.length || roleRows!.some((r) => r.kind !== person.kind))
    return fail(person.kind === "client" ? "Client logins can only have client roles." : "Team members can only have team roles.");

  const current = ((person.member_roles ?? []) as { role: string }[]).map((r) => r.role);
  const { add, remove } = roleDiff(current, roles);
  if ([...add, ...remove].includes("super_admin") && !me.roles.includes("super_admin"))
    return fail("Only a super admin can give or take away super admin.");
  if (memberId === me.id && (status !== "active" || !roles.some((r) => r === "admin" || r === "super_admin")))
    return fail("You can't remove your own admin access.");

  if (remove.length) {
    const { error } = await supabase.from("member_roles").delete().eq("member_id", memberId).in("role", remove);
    if (error) return fail(error.message);
  }
  if (add.length) {
    const { error } = await supabase.from("member_roles").insert(add.map((role) => ({ member_id: memberId, role })));
    if (error) return fail(error.message);
  }
  if (status !== person.status) {
    const { error } = await supabase.from("members").update({ status }).eq("id", memberId);
    if (error) return fail(error.message);
  }

  const names = new Map((roleRows ?? []).map((r) => [r.key as string, r.name as string]));
  const bits = [
    add.length || remove.length ? `roles to ${roles.map((r) => names.get(r) ?? r).join(", ")}` : null,
    status !== person.status ? `status to ${status}` : null,
  ].filter(Boolean);
  if (bits.length) {
    await logAudit(supabase, me.id, {
      action: "member.access",
      summary: `Changed ${person.name}'s ${bits.join(" and ")}`,
      targetType: "member",
      targetId: memberId,
    });
  }
  revalidatePath("/admin/people");
  revalidatePath(`/admin/people/${memberId}`);
  return { ok: true };
}

const OverrideIn = z.object({
  memberId: z.string().uuid(),
  perm: z.string().min(1),
  scope: z.enum([...SCOPES, "default"]),
});

/** scope "default" removes the override, so the person's roles decide again. */
export async function setOverride(raw: unknown): Promise<{ ok: true } | Fail> {
  const input = OverrideIn.safeParse(raw);
  if (!input.success) return fail(BAD);
  const me = await admin();
  if (!me) return fail(NO);
  const { memberId, perm, scope } = input.data;
  if (memberId === me.id && perm === "admin.access.manage") return fail("You can't change your own admin access.");

  const supabase = await createClient();
  const { data: person } = await supabase.from("members").select("name").eq("id", memberId).maybeSingle();
  if (!person) return fail("Person not found.");

  const { error } =
    scope === "default"
      ? await supabase.from("member_overrides").delete().eq("member_id", memberId).eq("perm_key", perm)
      : await supabase
          .from("member_overrides")
          .upsert({ member_id: memberId, perm_key: perm, scope, created_by: me.id }, { onConflict: "member_id,perm_key" });
  if (error) return fail(error.message);

  await logAudit(supabase, me.id, {
    action: "member.override",
    summary: scope === "default" ? `Removed ${person.name}'s override for ${perm}` : `Set ${perm} for ${person.name} to ${scope}`,
    targetType: "member",
    targetId: memberId,
    meta: { perm, scope },
  });
  revalidatePath(`/admin/people/${memberId}`);
  return { ok: true };
}

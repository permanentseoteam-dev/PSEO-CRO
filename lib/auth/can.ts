import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { can, resolvePerms, type Me, type Scope } from "./perms";
import { getAal, getTwoStepPolicy, mfaGate, needsVerify, requiredByPolicy } from "./mfa";

export { can, type Me, type Scope };

/**
 * The signed-in member with their roles and effective permissions, or null. Cached per request.
 * Also null while a 2-step sign-in is pending (verified factor, session below aal2), so server actions fail closed.
 */
export const getMe = cache(async (): Promise<Me | null> => {
  const aal = await getAal(); // validates the session with the auth server
  const uid = aal?.userId;
  if (!uid || needsVerify(aal)) return null;
  const supabase = await createClient();

  const { data: m } = await supabase
    .from("members")
    .select("id, email, name, title, kind, client_id, department_id, manager_id, presence, status")
    .eq("id", uid)
    .maybeSingle();
  if (!m || m.status !== "active") return null;

  const [{ data: roleRows }, { data: overrides }, { data: keys }] = await Promise.all([
    supabase.from("member_roles").select("role").eq("member_id", uid),
    supabase.from("member_overrides").select("perm_key, scope").eq("member_id", uid),
    supabase.from("permissions").select("key"),
  ]);
  const roles = (roleRows ?? []).map((r) => r.role as string);
  const { data: grants } = roles.length
    ? await supabase.from("role_permissions").select("role, perm_key, scope").in("role", roles)
    : { data: [] };

  return {
    id: m.id,
    email: m.email,
    name: m.name,
    title: m.title,
    kind: m.kind,
    clientId: m.client_id,
    departmentId: m.department_id,
    managerId: m.manager_id,
    presence: m.presence,
    roles,
    perms: resolvePerms({
      keys: (keys ?? []).map((k) => k.key as string),
      roles,
      grants: (grants ?? []) as { role: string; perm_key: string; scope: Scope }[],
      overrides: (overrides ?? []) as { perm_key: string; scope: Scope }[],
    }),
  };
});

/**
 * Like getMe() but sends signed-out users (or people without an active member row) to /login,
 * sessions waiting for their 2-step code to /login/verify, and staff the admin requires 2-step for
 * (but who haven't set it up) to /login/setup.
 */
export async function requireMe(): Promise<Me> {
  const me = await getMe();
  if (!me) redirect(needsVerify(await getAal()) ? "/login/verify" : "/login");
  const required = requiredByPolicy(me.kind, me.roles, me.kind === "staff" ? await getTwoStepPolicy() : []);
  if (required && mfaGate(await getAal(), true) === "enroll") redirect("/login/setup");
  return me;
}

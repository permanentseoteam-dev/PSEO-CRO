import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { can, resolvePerms, type Me, type Scope } from "./perms";

export { can, type Me, type Scope };

/** The signed-in member with their roles and effective permissions, or null. Cached per request. */
export const getMe = cache(async (): Promise<Me | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (!uid) return null;

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

/** Like getMe() but sends signed-out users (or people without an active member row) to /login. */
export async function requireMe(): Promise<Me> {
  const me = await getMe();
  if (!me) redirect("/login");
  return me;
}

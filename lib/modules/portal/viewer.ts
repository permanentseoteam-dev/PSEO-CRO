import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getMe, requireMe } from "@/lib/auth/can";
import { can, resolvePerms, type Me, type Scope } from "@/lib/auth/perms";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PREVIEW_COOKIE, resolvePortalScope, verifyPreview, type PortalScope } from "./preview";

export type PortalView = {
  /** The signed-in member. */
  me: Me;
  /** Who the portal renders for: `me` for a client login; the client's owner login during a staff preview. */
  viewer: Me;
  scope: Exclude<PortalScope, { mode: "none" }>;
};

/** The verified preview cookie, or null (missing, forged or expired). */
export async function readPreviewCookie() {
  const jar = await cookies();
  return verifyPreview(jar.get(PREVIEW_COOKIE)?.value, process.env.SUPABASE_SECRET_KEY);
}

/** Resolves the portal's client and viewer once per request. Staff without a valid preview go to /home. */
export const getPortalView = cache(async (): Promise<PortalView> => {
  const me = await requireMe();
  const scope = resolvePortalScope(me, me.kind === "staff" ? await readPreviewCookie() : null);
  if (scope.mode === "none") redirect("/home");
  const viewer = scope.mode === "preview" ? await ownerViewer(scope.clientId, me) : me;
  return { me, viewer, scope };
});

/** True when the signed-in staff member has an active preview. For server actions (no redirect). */
export async function previewActive(): Promise<boolean> {
  const me = await getMe();
  if (!me || me.kind !== "staff") return false;
  return resolvePortalScope(me, await readPreviewCookie()).mode === "preview";
}

export async function inPreview(): Promise<boolean> {
  return (await getPortalView()).scope.mode === "preview";
}

/**
 * Supabase client for a portal read of `clientId`.
 * Client login: the user's own client (RLS). Preview: the service client, only for the previewed client,
 * and null when the client's owner login lacks `perm` (callers then return nothing, as RLS would).
 * Callers must keep their client_id and "shared / client-visible" filters: the service client bypasses RLS.
 */
export async function portalDb(clientId: string, perm?: string): Promise<SupabaseClient | null> {
  const { scope, viewer } = await getPortalView();
  if (scope.mode !== "preview") return createClient();
  if (clientId !== scope.clientId) throw new Error("Portal preview read for another client");
  if (perm && !can(viewer, perm)) return null;
  return createAdminClient();
}

/** The client's owner login as a Me (roles, overrides, perms), so the preview shows what they see. */
async function ownerViewer(clientId: string, staff: Me): Promise<Me> {
  const admin = createAdminClient();
  const { data: people } = await admin
    .from("members")
    .select("id, email, name, title")
    .eq("client_id", clientId)
    .eq("kind", "client")
    .eq("status", "active");
  const list = (people ?? []) as { id: string; email: string; name: string; title: string | null }[];
  const { data: ownerRows } = list.length
    ? await admin.from("member_roles").select("member_id").eq("role", "client_owner").in("member_id", list.map((p) => p.id))
    : { data: [] };
  const ownerIds = new Set(((ownerRows ?? []) as { member_id: string }[]).map((r) => r.member_id));
  const owner = list.find((p) => ownerIds.has(p.id)) ?? null;

  const [roleRows, overrides, keys, client] = await Promise.all([
    owner ? admin.from("member_roles").select("role").eq("member_id", owner.id) : Promise.resolve({ data: [{ role: "client_owner" }] }),
    owner ? admin.from("member_overrides").select("perm_key, scope").eq("member_id", owner.id) : Promise.resolve({ data: [] }),
    admin.from("permissions").select("key"),
    admin.from("clients").select("name").eq("id", clientId).maybeSingle(),
  ]);
  const roles = ((roleRows.data ?? []) as { role: string }[]).map((r) => r.role);
  const { data: grants } = roles.length ? await admin.from("role_permissions").select("role, perm_key, scope").in("role", roles) : { data: [] };

  return {
    // No owner login yet: the staff id stands in; it is only used for reads that come back empty.
    id: owner?.id ?? staff.id,
    email: owner?.email ?? "",
    // No owner login: the client's own name, so the greeting and sidebar read "Harbor Legal", not a person.
    name: owner?.name ?? (client.data as { name: string } | null)?.name ?? "there",
    title: owner?.title ?? null,
    kind: "client",
    clientId,
    departmentId: null,
    managerId: null,
    presence: "available",
    roles,
    perms: resolvePerms({
      keys: ((keys.data ?? []) as { key: string }[]).map((k) => k.key),
      roles,
      grants: (grants ?? []) as { role: string; perm_key: string; scope: Scope }[],
      overrides: (overrides.data ?? []) as { perm_key: string; scope: Scope }[],
    }),
  };
}

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashInviteToken } from "./token";
import type { AuditRow, GrantRow, InviteRow, Option, OverrideRow, PermissionRow, PersonRow, RoleRow } from "./types";

export async function listRoles(): Promise<RoleRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("roles").select("key, name, kind, description");
  const order = ["super_admin", "admin", "finance_head", "dept_head", "member", "client_owner", "client_viewer"];
  return ((data ?? []) as RoleRow[]).sort((a, b) => {
    const ia = order.indexOf(a.key), ib = order.indexOf(b.key);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.name.localeCompare(b.name);
  });
}

export async function listPermissions(): Promise<PermissionRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("permissions").select("key, area, label").order("area").order("key");
  return (data ?? []) as PermissionRow[];
}

export async function listGrants(): Promise<GrantRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("role_permissions").select("role, perm_key, scope");
  return (data ?? []) as GrantRow[];
}

export async function listDepartments(): Promise<Option[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("departments").select("id, name").order("name");
  return (data ?? []) as Option[];
}

/** Clients come from the clients module; empty if that table isn't there yet. */
export async function listClientOptions(): Promise<Option[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("clients").select("id, name").order("name");
  return error ? [] : ((data ?? []) as Option[]);
}

type MemberWithRoles = Omit<PersonRow, "roles"> & { member_roles: { role: string }[] | null };

export async function listPeople(kind?: "staff" | "client"): Promise<PersonRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from("members")
    .select("id, name, email, title, kind, status, department_id, client_id, member_roles(role)")
    .order("name");
  if (kind) q = q.eq("kind", kind);
  const { data } = await q;
  return ((data ?? []) as MemberWithRoles[]).map(({ member_roles, ...m }) => ({ ...m, roles: (member_roles ?? []).map((r) => r.role) }));
}

export async function getPerson(id: string): Promise<{ person: PersonRow; overrides: OverrideRow[] } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("members")
    .select("id, name, email, title, kind, status, department_id, client_id, member_roles(role)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const { member_roles, ...m } = data as MemberWithRoles;
  const { data: ov } = await supabase.from("member_overrides").select("perm_key, scope, note").eq("member_id", id);
  return { person: { ...m, roles: (member_roles ?? []).map((r) => r.role) }, overrides: (ov ?? []) as OverrideRow[] };
}

export async function listInvites(): Promise<InviteRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("invites")
    .select("id, email, name, role, department_id, client_id, status, sent_at, expires_at, accepted_at")
    .order("sent_at", { ascending: false })
    .limit(200);
  return (data ?? []) as InviteRow[];
}

export const AUDIT_PAGE_SIZE = 50;

export async function listAudit(page: number): Promise<{ rows: AuditRow[]; more: boolean }> {
  const supabase = await createClient();
  const from = page * AUDIT_PAGE_SIZE;
  const { data } = await supabase
    .from("audit_log")
    .select("id, created_at, summary, action, actor:members(name)")
    .order("created_at", { ascending: false })
    .range(from, from + AUDIT_PAGE_SIZE); // one extra row tells us there is a next page
  const rows = ((data ?? []) as unknown as (Omit<AuditRow, "actor"> & { actor: { name: string } | null })[]).map((r) => ({
    ...r,
    actor: r.actor?.name ?? null,
  }));
  return { rows: rows.slice(0, AUDIT_PAGE_SIZE), more: rows.length > AUDIT_PAGE_SIZE };
}

export type InviteForAccept = InviteRow & { roleKind: "staff" | "client" | null; roleName: string; inviter: string | null };

/**
 * Invite lookup for the public /invite/[token] page. Uses the service client because the
 * visitor is signed out; the token hash is the only key.
 */
export async function getInviteByToken(token: string): Promise<InviteForAccept | null> {
  if (!token || token.length > 200) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("invites")
    .select("id, email, name, role, department_id, client_id, status, sent_at, expires_at, accepted_at, roles(kind, name), inviter:members!invites_invited_by_fkey(name)")
    .eq("token_hash", hashInviteToken(token))
    .maybeSingle();
  if (!data) return null;
  const { roles, inviter, ...inv } = data as unknown as InviteRow & {
    roles: { kind: "staff" | "client"; name: string } | null;
    inviter: { name: string } | null;
  };
  return { ...inv, roleKind: roles?.kind ?? null, roleName: roles?.name ?? inv.role, inviter: inviter?.name ?? null };
}

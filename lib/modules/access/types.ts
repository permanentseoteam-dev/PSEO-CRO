import type { Scope } from "@/lib/auth/perms";

export type RoleRow = { key: string; name: string; kind: "staff" | "client"; description: string | null };
export type PermissionRow = { key: string; area: string; label: string };
export type GrantRow = { role: string; perm_key: string; scope: Scope };
export type OverrideRow = { perm_key: string; scope: Scope; note: string | null };

export type PersonRow = {
  id: string;
  name: string;
  email: string;
  title: string | null;
  kind: "staff" | "client";
  status: "active" | "invited" | "suspended" | "left";
  department_id: string | null;
  client_id: string | null;
  roles: string[];
};

export type InviteRow = {
  id: string;
  email: string;
  name: string | null;
  role: string;
  department_id: string | null;
  client_id: string | null;
  status: "pending" | "accepted" | "revoked";
  sent_at: string;
  expires_at: string;
  accepted_at: string | null;
};

export type AuditRow = { id: string; created_at: string; summary: string; action: string; actor: string | null };

export type Option = { id: string; name: string };

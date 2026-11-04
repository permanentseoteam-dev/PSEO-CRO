// Pure permission logic, shared by server and client code. Mirrors perm_scope() in 0001_core.sql.

export const SCOPES = ["none", "own", "team", "all"] as const;
export type Scope = (typeof SCOPES)[number];

export type Me = {
  id: string;
  email: string;
  name: string;
  title: string | null;
  kind: "staff" | "client";
  clientId: string | null;
  departmentId: string | null;
  managerId: string | null;
  presence: string;
  roles: string[];
  /** Effective scope per permission key; missing key = none. */
  perms: Record<string, Scope>;
};

const rank = (s: Scope) => SCOPES.indexOf(s);

/**
 * Effective scopes: super_admin gets "all" on every key; otherwise the best scope across roles,
 * and a member override replaces it (it can raise or lower).
 */
export function resolvePerms(input: {
  keys: string[];
  roles: string[];
  grants: { role: string; perm_key: string; scope: Scope }[];
  overrides: { perm_key: string; scope: Scope }[];
}): Record<string, Scope> {
  const out: Record<string, Scope> = {};
  if (input.roles.includes("super_admin")) {
    for (const k of input.keys) out[k] = "all";
    return out;
  }
  for (const g of input.grants) {
    if (!input.roles.includes(g.role)) continue;
    const cur = out[g.perm_key] ?? "none";
    if (rank(g.scope) > rank(cur)) out[g.perm_key] = g.scope;
  }
  for (const o of input.overrides) out[o.perm_key] = o.scope;
  for (const k of Object.keys(out)) if (out[k] === "none") delete out[k];
  return out;
}

/** can(me, "finance.invoices.view", "all"): true when my scope is at least `scope`. */
export function can(me: Pick<Me, "perms"> | null | undefined, perm: string, scope: Exclude<Scope, "none"> = "own") {
  if (!me) return false;
  return rank(me.perms[perm] ?? "none") >= rank(scope);
}

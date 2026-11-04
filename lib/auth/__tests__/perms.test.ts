import { describe, expect, it } from "vitest";
import { can, resolvePerms } from "../perms";

const keys = ["finance.invoices.view", "chat.use", "clients.view"];
const grants = [
  { role: "member", perm_key: "chat.use", scope: "own" as const },
  { role: "member", perm_key: "clients.view", scope: "own" as const },
  { role: "dept_head", perm_key: "clients.view", scope: "all" as const },
];

describe("resolvePerms", () => {
  it("takes the best scope across roles", () => {
    expect(resolvePerms({ keys, roles: ["member", "dept_head"], grants, overrides: [] })).toEqual({
      "chat.use": "own",
      "clients.view": "all",
    });
  });

  it("lets an override lower or raise a scope", () => {
    const p = resolvePerms({
      keys,
      roles: ["member", "dept_head"],
      grants,
      overrides: [
        { perm_key: "clients.view", scope: "none" },
        { perm_key: "finance.invoices.view", scope: "team" },
      ],
    });
    expect(p).toEqual({ "chat.use": "own", "finance.invoices.view": "team" });
  });

  it("gives super_admin everything", () => {
    const p = resolvePerms({ keys, roles: ["super_admin"], grants: [], overrides: [] });
    expect(p["finance.invoices.view"]).toBe("all");
  });

  it("ignores grants for roles the member does not have", () => {
    expect(resolvePerms({ keys, roles: [], grants, overrides: [] })).toEqual({});
  });
});

describe("can", () => {
  const me = { perms: { "clients.view": "team" as const } };
  it("compares scopes in order none < own < team < all", () => {
    expect(can(me, "clients.view")).toBe(true);
    expect(can(me, "clients.view", "team")).toBe(true);
    expect(can(me, "clients.view", "all")).toBe(false);
    expect(can(me, "chat.use")).toBe(false);
    expect(can(null, "clients.view")).toBe(false);
  });
});

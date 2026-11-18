import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Me } from "@/lib/auth/perms";
import { newPreview, signPreview, staffMayPreview } from "../preview";

const CLIENT = "c0000000-0000-4000-8000-000000000002";
const STAFF = "00000000-0000-4000-8000-000000000001";

const MEMBER_PERMS = {
  "calendar.use": "own", "chat.use": "own", "clients.data.manage": "own", "clients.vault.view": "own", "clients.view": "own",
  "hr.directory.view": "all", "tickets.manage": "own", "tickets.view": "all", "time.view": "own",
  "work.recurring.manage": "own", "work.workload.view": "own",
} as Me["perms"];
const FINANCE_PERMS = { ...MEMBER_PERMS, "clients.view": "all", "finance.invoices.view": "all", "clients.billing.view": "all" } as Me["perms"];
const OWNER_PERMS = { "chat.use": "own", "clients.billing.view": "own", "finance.invoices.view": "own", "portal.approve": "own", "tickets.view": "own" } as Me["perms"];

describe("staffMayPreview", () => {
  it("keeps a member out of invoices but lets them see tickets, approvals and chat", () => {
    const m = { perms: MEMBER_PERMS };
    expect(staffMayPreview(m, "finance.invoices.view")).toBe(false);
    expect(staffMayPreview(m, "tickets.view")).toBe(true);
    expect(staffMayPreview(m, "portal.approve")).toBe(true);
    expect(staffMayPreview(m, "chat.use")).toBe(true);
  });
  it("lets finance (finance.invoices.view:all) see invoices; own scope is not enough", () => {
    expect(staffMayPreview({ perms: FINANCE_PERMS }, "finance.invoices.view")).toBe(true);
    expect(staffMayPreview({ perms: { "finance.invoices.view": "own" } }, "finance.invoices.view")).toBe(false);
  });
  it("fails closed on unknown perms", () => {
    expect(staffMayPreview({ perms: { "x.y": "all" } as Me["perms"] }, "x.y")).toBe(false);
  });
});

// portalDb: a preview read needs the owner's perm AND the staff member's equivalent.
const h = vi.hoisted(() => ({ me: null as unknown as Me, cookie: "" as string | undefined }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: vi.fn(() => { throw new Error("redirect"); }) }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => (h.cookie ? { value: h.cookie } : undefined) }) }));
vi.mock("@/lib/auth/can", () => ({ getMe: async () => h.me, requireMe: async () => h.me }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rls: true }) }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => {
    // ownerViewer: no owner login, so the viewer falls back to the client_owner role's grants.
    const res = (data: unknown) => ({ data, error: null });
    const q: Record<string, unknown> = {};
    let table = "";
    for (const k of ["select", "eq", "in"]) q[k] = () => q;
    q.maybeSingle = async () => res({ name: "Harbor" });
    q.then = (ok: (v: unknown) => unknown) =>
      ok(
        table === "permissions"
          ? res(Object.keys({ ...FINANCE_PERMS, ...OWNER_PERMS }).map((key) => ({ key })))
          : table === "role_permissions"
            ? res(Object.entries(OWNER_PERMS).map(([perm_key, scope]) => ({ role: "client_owner", perm_key, scope })))
            : res([]),
      );
    return { admin: true, from: (t: string) => ((table = t), q) };
  },
}));

const staff = (perms: Me["perms"]): Me => ({
  id: STAFF, email: "", name: "S", title: null, kind: "staff", clientId: null, departmentId: null, managerId: null,
  presence: "available", roles: [], perms,
});

describe("portalDb in preview", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.SUPABASE_SECRET_KEY = "test-secret";
    h.cookie = signPreview(newPreview(CLIENT, STAFF), "test-secret");
  });

  it("denies invoices to a member, allows tickets", async () => {
    h.me = staff(MEMBER_PERMS);
    const { portalDb } = await import("../viewer");
    expect(await portalDb(CLIENT, "finance.invoices.view")).toBeNull();
    expect(await portalDb(CLIENT, "tickets.view")).toMatchObject({ admin: true });
  });

  it("allows invoices to finance", async () => {
    h.me = staff(FINANCE_PERMS);
    const { portalDb } = await import("../viewer");
    expect(await portalDb(CLIENT, "finance.invoices.view")).toMatchObject({ admin: true });
  });
});

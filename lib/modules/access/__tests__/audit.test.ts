import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const { createAdminClient, insert } = vi.hoisted(() => {
  const insert = vi.fn(async () => ({ error: null }));
  return { insert, createAdminClient: vi.fn(() => ({ from: () => ({ insert }) })) };
});
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));

import { logAudit } from "../audit";

describe("logAudit", () => {
  beforeEach(() => {
    insert.mockClear();
    createAdminClient.mockClear();
  });

  it("writes with the service role, not the caller's (RLS-bound) client", async () => {
    const userDb = { from: vi.fn() } as unknown as SupabaseClient;
    await logAudit(userDb, "u1", { action: "role.update", summary: "Changed roles", targetType: "member", targetId: "m1" });
    expect(userDb.from).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith({
      actor_id: "u1", action: "role.update", summary: "Changed roles",
      target_type: "member", target_id: "m1", client_id: null, meta: {},
    });
  });

  it("never throws when the service role isn't configured", async () => {
    createAdminClient.mockImplementationOnce(() => { throw new Error("SUPABASE_SECRET_KEY is not set"); });
    await expect(logAudit({} as SupabaseClient, "u1", { action: "a", summary: "s" })).resolves.toBeUndefined();
  });
});

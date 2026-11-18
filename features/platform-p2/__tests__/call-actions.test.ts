import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getMe: vi.fn(), can: vi.fn(), createClient: vi.fn(), updated: [] as unknown[] }));

vi.mock("@/lib/auth/can", () => ({ getMe: mocks.getMe, can: mocks.can }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { assignCallClient } from "../actions";

const CALL = "00000000-0000-4000-8000-0000000000c1";
const CLIENT = "00000000-0000-4000-8000-0000000000a1";

describe("assignCallClient", () => {
  beforeEach(() => {
    mocks.updated = [];
    mocks.getMe.mockResolvedValue({ id: "00000000-0000-4000-8000-000000000001", kind: "staff" });
    mocks.createClient.mockResolvedValue({
      from: () => ({
        update: (row: unknown) => ({ eq: () => ({ select: async () => (mocks.updated.push(row), { data: [{ id: CALL }], error: null }) }) }),
      }),
    });
  });

  it("refuses staff without clients.manage (view-only members)", async () => {
    mocks.can.mockImplementation((_me: unknown, perm: string) => perm === "clients.view");
    expect(await assignCallClient({ id: CALL, clientId: CLIENT })).toMatchObject({ ok: false });
    expect(mocks.updated).toHaveLength(0);
  });

  it("lets clients.manage assign the client", async () => {
    mocks.can.mockImplementation((_me: unknown, perm: string) => perm === "clients.manage");
    expect(await assignCallClient({ id: CALL, clientId: CLIENT })).toEqual({ ok: true });
    expect(mocks.updated[0]).toMatchObject({ client_id: CLIENT, match_method: "manual" });
  });
});

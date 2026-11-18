import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getMe: vi.fn(), can: vi.fn(), createClient: vi.fn(), inserted: [] as unknown[] }));

vi.mock("@/lib/auth/can", () => ({ getMe: mocks.getMe, can: mocks.can }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../queries", () => ({ listAllSubAccountLinks: vi.fn(async () => []) }));
vi.mock("../adapters", () => ({ getAdapter: vi.fn() }));

import { linkSubAccount, unlinkSubAccount } from "../actions";

const PARENT = "00000000-0000-4000-8000-0000000000a1";
const CHILD = "00000000-0000-4000-8000-0000000000a2";

describe("linkSubAccount billing", () => {
  beforeEach(() => {
    mocks.inserted = [];
    mocks.getMe.mockResolvedValue({ id: "00000000-0000-4000-8000-000000000001", kind: "staff" });
    mocks.createClient.mockResolvedValue({
      from: () => ({ insert: async (row: unknown) => (mocks.inserted.push(row), { error: null }) }),
    });
  });

  it("forces billing 'own' without clients.billing.edit at all", async () => {
    mocks.can.mockImplementation((_me: unknown, perm: string) => perm === "clients.data.manage");
    expect(await linkSubAccount({ parentId: PARENT, childId: CHILD, billing: "parent" })).toEqual({ ok: true });
    expect(mocks.inserted[0]).toMatchObject({ billing: "own" });
  });

  it("keeps billing 'parent' for finance (billing.edit at all)", async () => {
    mocks.can.mockReturnValue(true);
    await linkSubAccount({ parentId: PARENT, childId: CHILD, billing: "parent" });
    expect(mocks.inserted[0]).toMatchObject({ billing: "parent" });
    expect(mocks.can).toHaveBeenCalledWith(expect.anything(), "clients.billing.edit", "all");
  });
});

describe("unlinkSubAccount", () => {
  const LINK = "00000000-0000-4000-8000-0000000000b1";
  const clientDeleting = (rows: unknown[]) => {
    const q = { eq: () => q, select: async () => ({ data: rows, error: null }) };
    return { from: () => ({ delete: () => q }) };
  };

  beforeEach(() => {
    mocks.getMe.mockResolvedValue({ id: "00000000-0000-4000-8000-000000000001", kind: "staff" });
    mocks.can.mockImplementation((_me: unknown, perm: string) => perm === "clients.data.manage");
  });

  it("errors when RLS removes nothing", async () => {
    mocks.createClient.mockResolvedValue(clientDeleting([]));
    const res = await unlinkSubAccount({ id: LINK, parentId: PARENT });
    expect(res.ok).toBe(false);
  });

  it("succeeds when the row is removed", async () => {
    mocks.createClient.mockResolvedValue(clientDeleting([{ id: LINK }]));
    expect(await unlinkSubAccount({ id: LINK, parentId: PARENT })).toEqual({ ok: true });
  });
});

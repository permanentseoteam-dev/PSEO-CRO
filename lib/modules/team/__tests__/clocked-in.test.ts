import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ createClient: vi.fn(), rpc: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { listPeople } from "../queries";

const A = "00000000-0000-4000-8000-000000000001";
const B = "00000000-0000-4000-8000-000000000002";

// Thenable query stub: every chained call returns itself and awaiting it gives `res`.
const query = (res: { data: unknown; error: unknown }) => {
  const q: Record<string, unknown> = {};
  for (const k of ["select", "eq", "is", "order"]) q[k] = () => q;
  q.then = (ok: (v: unknown) => unknown) => Promise.resolve(res).then(ok);
  return q;
};

describe("listPeople clock-in state", () => {
  it("reads clocked-in ids from clocked_in_member_ids(), not the private attendance table", async () => {
    const from = vi.fn((t: string) =>
      t === "members"
        ? query({ data: [{ id: A, name: "A" }, { id: B, name: "B" }], error: null })
        : query({ data: [], error: null }),
    );
    mocks.rpc.mockResolvedValue({ data: [{ member_id: B }], error: null });
    mocks.createClient.mockResolvedValue({ from, rpc: mocks.rpc });

    const { people } = await listPeople();

    expect(mocks.rpc).toHaveBeenCalledWith("clocked_in_member_ids");
    expect(from).not.toHaveBeenCalledWith("attendance");
    expect(people.map((p) => [p.id, p.clockedIn])).toEqual([[A, false], [B, true]]);
  });
});

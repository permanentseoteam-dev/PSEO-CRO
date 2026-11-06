import { beforeEach, describe, expect, it, vi } from "vitest";

const { assignee } = vi.hoisted(() => ({
  assignee: vi.fn(async (_db: unknown, _projectId: unknown, requested: unknown) => (requested === undefined ? "creator" : requested)),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/auth/can", () => ({ getMe: async () => ({ id: "me", kind: "staff" }), can: () => true }));
vi.mock("../assignment", () => ({ newTicketAssignee: assignee }));

const ORIGINAL = "6f9619ff-8b86-4d01-b42d-00cf4fc964a1";
const SUB_ORIGINAL = "6f9619ff-8b86-4d01-b42d-00cf4fc964a2";
const source = { id: "src", key: "CPD-1", priority: "normal", due_date: null, description: null, done_when: null, tags: [], assignee_id: ORIGINAL };
const subtasks = [{ title: "Sub task", priority: "low", assignee_id: SUB_ORIGINAL }];

// Just enough of the Supabase query builder for copyTicket and createTicket.
function query(table: string) {
  const q = {
    select: () => q,
    eq: () => q,
    order: () => q,
    insert: () => q,
    update: () => q,
    maybeSingle: async () => ({ data: table === "tickets" ? source : null }),
    single: async () => ({ data: { id: "6f9619ff-8b86-4d01-b42d-00cf4fc964b1", key: "CPD-2" }, error: null }),
    then: (done: (v: unknown) => unknown) => done({ data: table === "tickets" ? subtasks : [], error: null }),
  };
  return q;
}
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: (table: string) => query(table) }) }));

import { copyTicket } from "../actions";

const projectId = "6f9619ff-8b86-4d01-b42d-00cf4fc964ff";
const base = { id: "6f9619ff-8b86-4d01-b42d-00cf4fc964fe", projectId, title: "Copied", checklist: false, subtasks: true };

describe("copy to another project", () => {
  beforeEach(() => assignee.mockClear());

  it("defaults the copy and its subtasks to the project creator when assignees are not copied", async () => {
    expect(await copyTicket({ ...base, assignees: false })).toEqual({ ok: true, data: { key: "CPD-2" } });
    expect(assignee.mock.calls.map((c) => [c[1], c[2]])).toEqual([[projectId, undefined], [projectId, undefined]]);
  });

  it("keeps the original assignees when the user chooses to copy them", async () => {
    expect(await copyTicket({ ...base, assignees: true })).toEqual({ ok: true, data: { key: "CPD-2" } });
    expect(assignee.mock.calls.map((c) => c[2])).toEqual([ORIGINAL, SUB_ORIGINAL]);
  });
});

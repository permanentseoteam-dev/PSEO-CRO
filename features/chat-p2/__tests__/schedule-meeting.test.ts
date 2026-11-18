import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getMe: vi.fn(), can: vi.fn(), createClient: vi.fn(), notify: vi.fn(), findConflicts: vi.fn() }));

vi.mock("@/lib/auth/can", () => ({ getMe: mocks.getMe, can: mocks.can }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/modules/calendar/notify", () => ({ notify: mocks.notify }));
vi.mock("@/lib/modules/calendar/conflicts", () => ({ findConflicts: mocks.findConflicts }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("../queries", () => ({ getChannelExtras: vi.fn() }));

import { scheduleChannelMeeting } from "../actions";
import { dubaiTomorrow } from "../logic";

const ME = "00000000-0000-4000-8000-000000000001";
const OTHER = "00000000-0000-4000-8000-000000000002";
const CHANNEL = "00000000-0000-4000-8000-0000000000c1";

let inserts: Record<string, unknown[]>;
let noteError: { code: string } | null;

function fakeSupabase() {
  return {
    from: (table: string) => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { kind: "group", client_id: null } }) }) }),
      insert: (row: unknown) => {
        (inserts[table] ??= []).push(row);
        const res = { error: table === "messages" ? noteError : null };
        return Object.assign(Promise.resolve(res), {
          select: () => ({ single: async () => ({ data: { id: "ev1" }, error: null }) }),
        });
      },
    }),
  };
}

describe("scheduleChannelMeeting", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.findConflicts.mockResolvedValue([]);
    inserts = {};
    noteError = null;
    mocks.getMe.mockResolvedValue({ id: ME, kind: "staff", name: "Sam" });
    mocks.can.mockReturnValue(true);
    mocks.createClient.mockResolvedValue(fakeSupabase());
  });

  const input = { channelId: CHANNEL, title: "Kickoff", date: "2026-11-19", time: "15:00", minutes: "30", attendees: [OTHER] };

  it("stores 15:00 office time as 11:00Z and notes it in the chat", async () => {
    expect(await scheduleChannelMeeting(input)).toEqual({ ok: true, data: { warning: null } });
    expect(inserts.events[0]).toMatchObject({ starts_at: "2026-11-19T11:00:00.000Z", minutes: 30 });
    expect(String((inserts.messages[0] as { body: string }).body)).toContain("3:00");
  });

  it("invites the other attendees, not me", async () => {
    await scheduleChannelMeeting(input);
    expect(mocks.notify).toHaveBeenCalledWith(expect.anything(), ME, [OTHER], "invited you to", "Kickoff", "2026-11-19", "15:00");
  });

  it("rejects a malformed time", async () => {
    expect(await scheduleChannelMeeting({ ...input, time: "3pm" })).toMatchObject({ ok: false });
    expect(mocks.createClient).not.toHaveBeenCalled();
  });

  it("reports a refused chat note instead of swallowing it", async () => {
    noteError = { code: "42501" };
    const res = await scheduleChannelMeeting(input);
    expect(res.ok && res.data?.warning).toMatch(/note couldn't be posted/);
  });
  it("refuses a meeting that runs past midnight", async () => {
    const res = await scheduleChannelMeeting({ ...input, time: "23:50", minutes: "30" });
    expect(res).toMatchObject({ ok: false, error: expect.stringMatching(/midnight/) });
    expect(inserts.events).toBeUndefined();
  });

  it("returns clashes without saving, and books anyway with force", async () => {
    const clash = { memberId: OTHER, memberName: "Hamza", title: "Weekly sync", date: "2026-11-19", start: "15:00", end: "15:30" };
    mocks.findConflicts.mockResolvedValue([clash]);
    expect(await scheduleChannelMeeting(input)).toMatchObject({ ok: false, conflicts: [clash] });
    expect(inserts.events).toBeUndefined();
    expect(await scheduleChannelMeeting({ ...input, force: true })).toMatchObject({ ok: true });
    expect(inserts.events).toHaveLength(1);
  });
});

describe("dubaiTomorrow", () => {
  it("uses the Dubai date at 01:00 Dubai (21:00Z the day before)", () => {
    expect(dubaiTomorrow(new Date("2026-11-18T21:00:00Z"))).toBe("2026-11-20");
  });
});

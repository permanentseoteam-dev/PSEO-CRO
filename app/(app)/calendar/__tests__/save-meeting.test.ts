import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getMe: vi.fn(), can: vi.fn(), createClient: vi.fn(), findConflicts: vi.fn(), insert: vi.fn() }));

vi.mock("@/lib/auth/can", () => ({ getMe: mocks.getMe, can: mocks.can }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("@/lib/modules/calendar/conflicts", () => ({ findConflicts: mocks.findConflicts }));
vi.mock("@/lib/modules/calendar/notify", () => ({ notify: vi.fn() }));
vi.mock("@/lib/modules/calendar/queries", () => ({ listBusy: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { saveMeeting } from "../actions";
import { MIDNIGHT_ERROR } from "@/lib/modules/calendar/logic";

const ME = "00000000-0000-4000-8000-000000000001";
const HAMZA = "00000000-0000-4000-8000-000000000002";
const CLASH = { memberId: HAMZA, memberName: "Hamza", title: "Weekly sync", date: "2026-11-19", start: "11:00", end: "11:30" };
const input = (over: Record<string, unknown> = {}) => ({
  title: "Kick-off",
  date: "2026-11-19",
  start: "11:00",
  minutes: 30,
  memberIds: [HAMZA],
  where: "meet",
  repeat: "none",
  visibility: "team",
  ...over,
});

describe("saveMeeting", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getMe.mockResolvedValue({ id: ME, kind: "staff" });
    mocks.can.mockReturnValue(true);
    mocks.insert.mockResolvedValue({ error: null });
    mocks.createClient.mockResolvedValue({ from: () => ({ insert: mocks.insert }) });
  });

  it("rejects a meeting that runs past midnight", async () => {
    expect(await saveMeeting(input({ start: "23:50", minutes: 30 }))).toEqual({ ok: false, error: MIDNIGHT_ERROR });
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("allows a meeting that ends exactly at midnight", async () => {
    mocks.findConflicts.mockResolvedValue([]);
    expect(await saveMeeting(input({ start: "23:30", minutes: 30 }))).toEqual({ ok: true, date: "2026-11-19" });
  });

  it("returns clashes without saving", async () => {
    mocks.findConflicts.mockResolvedValue([CLASH]);
    const r = await saveMeeting(input());
    expect(r).toMatchObject({ ok: false, conflicts: [CLASH] });
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.findConflicts.mock.calls[0][1]).toMatchObject({ dates: ["2026-11-19"], time: "11:00", minutes: 30, memberIds: [ME, HAMZA] });
  });

  it("checks every occurrence of a series", async () => {
    mocks.findConflicts.mockResolvedValue([CLASH]);
    await saveMeeting(input({ repeat: "weekly" }));
    expect(mocks.findConflicts.mock.calls[0][1].dates.length).toBeGreaterThan(10);
  });

  it("books anyway with force", async () => {
    mocks.findConflicts.mockResolvedValue([CLASH]);
    expect(await saveMeeting(input({ force: true }))).toEqual({ ok: true, date: "2026-11-19" });
    expect(mocks.findConflicts).not.toHaveBeenCalled();
    expect(mocks.insert).toHaveBeenCalledTimes(2); // events, then attendees
  });
});

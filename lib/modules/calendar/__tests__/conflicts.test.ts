import { describe, expect, it } from "vitest";
import { findConflicts } from "../conflicts";
import { fromLocal } from "../logic";

const A = "a", B = "b";
const at = (t: string) => fromLocal("2026-11-19", t);

// Chainable fake: every builder method returns itself; awaiting gives the canned result.
function fake(events: unknown[], busy: unknown[]) {
  const q = (data: unknown) => {
    const b: Record<string, unknown> = {};
    for (const m of ["select", "in", "gte", "lt"]) b[m] = () => b;
    b.then = (res: (v: unknown) => unknown) => res({ data, error: null });
    return b;
  };
  return {
    from: (t: string) => (t === "events" ? q(events) : q([{ id: A, name: "Amna" }, { id: B, name: "Bilal" }])),
    rpc: () => q(busy),
  } as never;
}

describe("findConflicts", () => {
  const ev = (id: string, title: string, t: string, mins: number, att: [string, string][]) => ({
    id, title, starts_at: at(t), minutes: mins, event_attendees: att.map(([member_id, rsvp]) => ({ member_id, rsvp })),
  });
  const busyOf = (e: ReturnType<typeof ev>) => e.event_attendees.filter((a) => a.rsvp !== "no").map((a) => ({ member_id: a.member_id, starts_at: e.starts_at, minutes: e.minutes }));

  it("names visible meetings, says Busy for hidden ones, skips declined, touching and the excluded meeting", async () => {
    const sync = ev("e1", "Weekly sync", "11:00", 30, [[A, "yes"], [B, "no"]]);
    const self = ev("e2", "Kick-off", "11:00", 30, [[A, "yes"]]);
    const touch = ev("e3", "Lunch", "11:30", 30, [[B, "yes"]]);
    const hidden = { member_id: B, starts_at: at("10:45"), minutes: 30 };
    const busy = [...busyOf(sync), ...busyOf(self), ...busyOf(touch), hidden];
    const r = await findConflicts(fake([sync, self, touch], busy), {
      dates: ["2026-11-19"], time: "11:00", minutes: 30, memberIds: [A, B], excludeEventId: "e2",
    });
    expect(r).toEqual([
      { memberId: B, memberName: "Bilal", title: "Busy", date: "2026-11-19", start: "10:45", end: "11:15" },
      { memberId: A, memberName: "Amna", title: "Weekly sync", date: "2026-11-19", start: "11:00", end: "11:30" },
    ]);
  });
});

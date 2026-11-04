import { describe, expect, it } from "vitest";
import {
  actionSummary,
  byClient,
  byPerson,
  formatBytes,
  formatMinutes,
  parseActions,
  parseColours,
  parseConcerns,
  parseRange,
  shortDate,
  storageName,
  summarize,
  targetHours,
  waitState,
  weekStartDate,
  whenLabel,
  workingMinutes,
  zoneMidnight,
  type Measured,
  type WorkHours,
} from "../logic";

const DUBAI: WorkHours = { timezone: "Asia/Dubai", dayStart: "09:00", dayEnd: "18:00", workdays: [1, 2, 3, 4, 5] };
const at = (s: string) => new Date(s);

describe("workingMinutes", () => {
  it("counts time inside one working day", () => {
    expect(workingMinutes(at("2026-11-04T09:30:00+04:00"), at("2026-11-04T11:00:00+04:00"), DUBAI)).toBe(90);
  });

  it("ignores time before the day starts and after it ends", () => {
    expect(workingMinutes(at("2026-11-04T07:00:00+04:00"), at("2026-11-04T20:00:00+04:00"), DUBAI)).toBe(9 * 60);
  });

  it("carries over night into the next morning", () => {
    // Tue 17:00 -> Wed 10:00 = 1h + 1h
    expect(workingMinutes(at("2026-11-03T17:00:00+04:00"), at("2026-11-04T10:00:00+04:00"), DUBAI)).toBe(120);
  });

  it("skips the weekend", () => {
    // Fri 2026-11-06 17:00 -> Mon 2026-11-09 10:00 = 1h + 1h
    expect(workingMinutes(at("2026-11-06T17:00:00+04:00"), at("2026-11-09T10:00:00+04:00"), DUBAI)).toBe(120);
  });

  it("returns 0 for a wait that starts and ends on a weekend", () => {
    expect(workingMinutes(at("2026-11-07T10:00:00+04:00"), at("2026-11-08T15:00:00+04:00"), DUBAI)).toBe(0);
  });

  it("returns 0 when end is not after start, or there are no workdays", () => {
    const t = at("2026-11-04T10:00:00+04:00");
    expect(workingMinutes(t, t, DUBAI)).toBe(0);
    expect(workingMinutes(at("2026-11-04T12:00:00+04:00"), t, DUBAI)).toBe(0);
    expect(workingMinutes(t, at("2026-11-04T12:00:00+04:00"), { ...DUBAI, workdays: [] })).toBe(0);
  });

  it("uses the configured time zone, not the machine's", () => {
    // 04:00Z-07:00Z is 08:00-11:00 in Dubai (2h of work) but 09:00-12:00 in Karachi (3h).
    const a = at("2026-11-04T04:00:00Z");
    const b = at("2026-11-04T07:00:00Z");
    expect(workingMinutes(a, b, DUBAI)).toBe(120);
    expect(workingMinutes(a, b, { ...DUBAI, timezone: "Asia/Karachi" })).toBe(180);
  });

  it("handles a daylight-saving change (London, last Sunday of October)", () => {
    const LDN: WorkHours = { timezone: "Europe/London", dayStart: "09:00", dayEnd: "17:00", workdays: [1, 2, 3, 4, 5] };
    // Fri 23 Oct 2026 16:00 BST -> Mon 26 Oct 2026 10:00 GMT = 1h + 1h
    expect(workingMinutes(at("2026-10-23T15:00:00Z"), at("2026-10-26T10:00:00Z"), LDN)).toBe(120);
  });

  it("sums whole weeks", () => {
    expect(workingMinutes(at("2026-11-02T00:00:00+04:00"), at("2026-11-16T00:00:00+04:00"), DUBAI)).toBe(10 * 9 * 60);
  });
});

describe("formatting", () => {
  it("formats minutes like the mockup", () => {
    expect(formatMinutes(48)).toBe("48m");
    expect(formatMinutes(125)).toBe("2h 05m");
    expect(formatMinutes(240)).toBe("4h");
    expect(formatMinutes(30 * 60)).toBe("1d 6h");
    expect(formatMinutes(-5)).toBe("0m");
  });

  it("formats bytes", () => {
    expect(formatBytes(820 * 1024)).toBe("820 KB");
    expect(formatBytes(6.2 * 1024 * 1024)).toBe("6.2 MB");
    expect(formatBytes(142 * 1024 * 1024)).toBe("142 MB");
    expect(formatBytes(12)).toBe("12 B");
  });
});

describe("SLA rules", () => {
  it("picks the target by kind", () => {
    const t = { replyHours: 1, requestHours: 4, changesHours: 8 };
    expect(targetHours("message", t)).toBe(1);
    expect(targetHours("comment", t)).toBe(1);
    expect(targetHours("request", t)).toBe(4);
    expect(targetHours("changes", t)).toBe(8);
  });

  it("gives the state of an open wait", () => {
    expect(waitState(22, 60)).toMatchObject({ label: "On time", tone: "ok" });
    expect(waitState(48, 60)).toMatchObject({ label: "Due in 12m", tone: "warn" });
    expect(waitState(100, 60)).toMatchObject({ label: "Late", tone: "danger", late: true, past2x: false });
    expect(waitState(480, 240)).toMatchObject({ label: "Past 2× target", past2x: true });
  });

  const w = (o: Partial<Measured>): Measured => ({
    clientId: "a", clientName: "Alba Motors", answererId: "p1", answeredById: "p1", targetMin: 60, minutes: 30, answered: true, ...o,
  });

  it("summarises answered waits", () => {
    const s = summarize([w({ minutes: 10 }), w({ minutes: 50 }), w({ minutes: 90, clientName: "Luma Skincare" }), w({ minutes: 20 })]);
    expect(s).toEqual({ answered: 4, onTimePct: 75, typicalMin: 35, slowest: { minutes: 90, clientName: "Luma Skincare" } });
    expect(summarize([])).toEqual({ answered: 0, onTimePct: null, typicalMin: null, slowest: null });
  });

  it("groups by person and client", () => {
    const answered = [w({ minutes: 10 }), w({ minutes: 100, answeredById: "p2", clientId: "l", clientName: "Luma" })];
    const open = [w({ answered: false, minutes: 70, answererId: "p2", answeredById: null }), w({ answered: false, minutes: 5, answeredById: null })];
    expect(byPerson(answered, open)).toEqual([
      { id: "p1", answered: 1, onTimePct: 100, typicalMin: 10, lateNow: 0 },
      { id: "p2", answered: 1, onTimePct: 0, typicalMin: 100, lateNow: 1 },
    ]);
    const c = byClient(answered, open);
    expect(c[0]).toMatchObject({ clientId: "a", waits: 3, waitingNow: 2, onTimePct: 100 });
    expect(c[1]).toMatchObject({ clientId: "l", waits: 1, slowestMin: 100, waitingNow: 0 });
  });

  it("parses the range with 30 as default", () => {
    expect(parseRange("7")).toBe(7);
    expect(parseRange("90")).toBe(90);
    expect(parseRange(undefined)).toBe(30);
    expect(parseRange("abc")).toBe(30);
  });
});

describe("meeting notes", () => {
  it("parses concerns with and without quotes", () => {
    expect(parseConcerns('Lead emails late: "We got the leads a day late."\n\nMeta value')).toEqual([
      { topic: "Lead emails late", quote: "We got the leads a day late." },
      { topic: "Meta value", quote: null },
    ]);
  });

  it("parses action items and matches owners", () => {
    const people = [{ id: "d", name: "Daniel Reyes" }, { id: "l", name: "Lina Saeed" }];
    expect(parseActions("- Fix lead routing - Daniel Reyes\n2. Make SUV creatives – lina\nSend price list - Rania Youssef\nLook into TikTok", people)).toEqual([
      { title: "Fix lead routing", ownerName: "Daniel Reyes", assigneeId: "d" },
      { title: "Make SUV creatives", ownerName: "lina", assigneeId: "l" },
      { title: "Send price list", ownerName: "Rania Youssef", assigneeId: null },
      { title: "Look into TikTok", ownerName: null, assigneeId: null },
    ]);
  });

  it("keeps hyphenated words in titles", () => {
    expect(parseActions("Set up follow-up emails", [])[0]).toEqual({ title: "Set up follow-up emails", ownerName: null, assigneeId: null });
  });

  it("summarises action outcomes", () => {
    expect(actionSummary(["ticket", "ticket", "todo", "todo", "skip"])).toBe("5 · 2 tickets, 2 to-dos, 1 skipped");
    expect(actionSummary(["ticket"])).toBe("1 · 1 ticket");
    expect(actionSummary([])).toBe("None");
  });
});

describe("files", () => {
  it("parses brand colours", () => {
    expect(parseColours("Alba red #C8102E\nCharcoal: #2b2b2b\nno colour here\n#ffffff")).toEqual([
      { name: "Alba red", hex: "#c8102e" },
      { name: "Charcoal", hex: "#2b2b2b" },
      { name: "#ffffff", hex: "#ffffff" },
    ]);
  });

  it("makes safe storage names", () => {
    expect(storageName("Q4 price list (final).xlsx")).toBe("Q4-price-list-final-.xlsx");
    expect(storageName("???")).toBe("file");
  });
});

describe("dates", () => {
  const now = new Date("2026-11-04T10:00:00+04:00");
  it("labels times relative to today in the zone", () => {
    expect(whenLabel("2026-11-04T09:02:00+04:00", now, "Asia/Dubai")).toBe("Today 09:02");
    expect(whenLabel("2026-11-03T15:40:00+04:00", now, "Asia/Dubai")).toBe("Yesterday 15:40");
    expect(whenLabel("2026-11-02T16:05:00+04:00", now, "Asia/Dubai")).toBe("2 Nov 16:05");
    expect(shortDate("2025-02-01T11:00:00+04:00", now, "Asia/Dubai")).toBe("1 Feb 2025");
  });
  it("finds the week start and zone midnight", () => {
    expect(weekStartDate(now, "Asia/Dubai")).toBe("2026-11-02");
    expect(weekStartDate(new Date("2026-11-08T22:00:00+04:00"), "Asia/Dubai")).toBe("2026-11-02");
    expect(zoneMidnight("2026-11-02", "Asia/Dubai").toISOString()).toBe("2026-11-01T20:00:00.000Z");
  });
});

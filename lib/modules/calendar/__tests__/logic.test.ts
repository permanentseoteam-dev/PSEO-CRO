import { describe, expect, it } from "vitest";
import {
  addMonths,
  freeSlots,
  fromLocal,
  isDate,
  occurrences,
  parseGuests,
  parseParams,
  stepCursor,
  toLocal,
  viewRange,
  viewTitle,
  weekStart,
} from "../logic";

describe("office time", () => {
  it("round-trips Dubai local time through UTC", () => {
    expect(fromLocal("2026-11-04", "11:00")).toBe("2026-11-04T07:00:00.000Z");
    expect(toLocal("2026-11-04T07:00:00Z")).toEqual({ date: "2026-11-04", min: 660 });
    expect(toLocal("2026-11-04T21:30:00Z")).toEqual({ date: "2026-11-05", min: 90 });
  });
});

describe("dates", () => {
  it("weeks start on Monday", () => {
    expect(weekStart("2026-11-04")).toBe("2026-11-02");
    expect(weekStart("2026-11-08")).toBe("2026-11-02");
    expect(weekStart("2026-11-09")).toBe("2026-11-09");
  });
  it("addMonths clamps to the month's last day", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-11-04", -1)).toBe("2026-10-04");
  });
  it("validates dates", () => {
    expect(isDate("2026-11-04")).toBe(true);
    expect(isDate("2026-02-30")).toBe(false);
    expect(isDate("nope")).toBe(false);
  });
});

describe("views", () => {
  it("month covers whole weeks", () => {
    expect(viewRange("month", "2026-11-04")).toEqual({ from: "2026-10-26", to: "2026-12-07" });
  });
  it("week, day and agenda ranges", () => {
    expect(viewRange("week", "2026-11-04")).toEqual({ from: "2026-11-02", to: "2026-11-09" });
    expect(viewRange("day", "2026-11-04")).toEqual({ from: "2026-11-04", to: "2026-11-05" });
    expect(viewRange("agenda", "2026-11-04")).toEqual({ from: "2026-11-04", to: "2026-12-04" });
  });
  it("steps per view", () => {
    expect(stepCursor("month", "2026-11-04", 1)).toBe("2026-12-01");
    expect(stepCursor("week", "2026-11-04", -1)).toBe("2026-10-28");
    expect(stepCursor("agenda", "2026-11-04", 1)).toBe("2026-12-04");
  });
  it("titles", () => {
    expect(viewTitle("month", "2026-11-04")).toBe("November 2026");
    expect(viewTitle("week", "2026-11-04")).toBe("2 Nov – 8 Nov 2026");
    expect(viewTitle("day", "2026-11-04")).toBe("Wednesday, 4 November 2026");
  });
  it("parses query params with safe defaults", () => {
    expect(parseParams({ view: "week", d: "2026-11-10", col: "1" }, "2026-11-04")).toEqual({ view: "week", cursor: "2026-11-10", showCol: true });
    expect(parseParams({ view: "year", d: "bad" }, "2026-11-04")).toEqual({ view: "month", cursor: "2026-11-04", showCol: false });
  });
});

describe("occurrences", () => {
  it("one-off", () => expect(occurrences("2026-11-04", "none")).toEqual(["2026-11-04"]));
  it("weekdays only for daily", () => {
    expect(occurrences("2026-11-05", "daily", 4)).toEqual(["2026-11-05", "2026-11-06", "2026-11-09"]);
  });
  it("weekly, every 2 weeks, monthly", () => {
    expect(occurrences("2026-11-04", "weekly", 14)).toEqual(["2026-11-04", "2026-11-11", "2026-11-18"]);
    expect(occurrences("2026-11-04", "biweekly", 28)).toEqual(["2026-11-04", "2026-11-18", "2026-12-02"]);
    expect(occurrences("2026-11-04", "monthly", 62)).toEqual(["2026-11-04", "2026-12-04", "2027-01-04"]);
  });
});

describe("freeSlots", () => {
  it("skips busy blocks and returns at most 5", () => {
    const slots = freeSlots({ date: "2026-11-04", len: 60, blocks: [[600, 660], [780, 870]] });
    // 09:00 fits (ends 10:00); 09:30 clashes 10:00; 11:00 fits ...
    expect(slots).toEqual([540, 660, 690, 720, 870]);
  });
  it("respects notBefore and the 18:00 end", () => {
    expect(freeSlots({ date: "2026-11-04", len: 60, blocks: [], notBefore: 16 * 60 + 10 })).toEqual([990, 1020]);
  });
  it("nothing on weekends", () => {
    expect(freeSlots({ date: "2026-11-07", len: 30, blocks: [] })).toEqual([]);
  });
});

describe("parseGuests", () => {
  it("splits, lowercases and de-duplicates", () => {
    expect(parseGuests("Nina@LumaSkin.com, nina@lumaskin.com; a@b.co")).toEqual(["nina@lumaskin.com", "a@b.co"]);
    expect(parseGuests("")).toEqual([]);
  });
  it("rejects non-emails", () => expect(parseGuests("nina, a@b.co")).toBeNull());
});


import { describe, expect, it } from "vitest";
import {
  canMoveReport,
  checkInOverdue,
  commitmentCounts,
  lines,
  monthLabel,
  monthStart,
  nextOccurrence,
  nextQbrStatus,
  profileCompletion,
  quarterOf,
  ratingAverages,
  reportDueOn,
  reportLate,
  reportStatus,
  scoreTone,
  shortDate,
  upcomingMoments,
} from "../logic";

const TODAY = "2026-11-04";

describe("dates", () => {
  it("formats short dates with the year only outside the current year", () => {
    expect(shortDate("2026-11-03", TODAY)).toBe("3 Nov");
    expect(shortDate("2027-02-01", TODAY)).toBe("1 Feb 2027");
  });
  it("shifts months across year ends", () => {
    expect(monthStart("2026-11-04")).toBe("2026-11-01");
    expect(monthStart("2026-11-04", 2)).toBe("2027-01-01");
    expect(monthStart("2026-01-15", -1)).toBe("2025-12-01");
    expect(monthLabel("2026-10-01")).toBe("October 2026");
  });
});

describe("commitments", () => {
  it("counts by status", () => {
    const c = commitmentCounts([{ status: "met" }, { status: "met" }, { status: "missed" }, { status: "on_track" }]);
    expect(c).toEqual({ total: 4, met: 2, on_track: 1, at_risk: 0, missed: 1 });
  });
  it("flags overdue check-ins by cadence", () => {
    expect(checkInOverdue("weekly", "2026-10-25", TODAY)).toBe(true);
    expect(checkInOverdue("weekly", "2026-11-01", TODAY)).toBe(false);
    expect(checkInOverdue("monthly", null, TODAY)).toBe(true);
    expect(checkInOverdue("once", null, TODAY)).toBe(false);
  });
});

describe("relationship", () => {
  it("rolls yearly dates forward and keeps one-off dates", () => {
    expect(nextOccurrence({ on_date: "1980-12-14", yearly: true }, TODAY)).toBe("2026-12-14");
    expect(nextOccurrence({ on_date: "2025-03-09", yearly: true }, TODAY)).toBe("2027-03-09");
    expect(nextOccurrence({ on_date: "2026-11-04", yearly: true }, TODAY)).toBe("2026-11-04");
    expect(nextOccurrence({ on_date: "2026-01-01", yearly: false }, TODAY)).toBe("2026-01-01");
    expect(nextOccurrence({ on_date: "1992-02-29", yearly: true }, "2027-01-10")).toBe("2027-02-28");
  });
  it("lists moments in the next 90 days, soonest first, with birthdays", () => {
    const m = upcomingMoments(
      [
        { id: "1", title: "Contract renewal", on_date: "2027-02-01", yearly: false, person_id: null },
        { id: "2", title: "Dubai Motor Show", on_date: "2026-11-18", yearly: false, person_id: null },
        { id: "3", title: "Old event", on_date: "2026-10-01", yearly: false, person_id: null },
        { id: "4", title: "UAE National Day", on_date: "1971-12-02", yearly: true, person_id: null },
      ],
      [{ name: "Karim Alba", birthday: "1978-12-14" }, { name: "No birthday", birthday: null }],
      TODAY,
    );
    expect(m.map((x) => x.title)).toEqual(["Dubai Motor Show", "UAE National Day", "Karim Alba birthday", "Contract renewal"]);
    expect(m[3].on).toBe("2027-02-01"); // 89 days out
  });
  it("scores profile completion", () => {
    expect(profileCompletion({ profile: null, people: [], hasDates: false, hasBrief: false, hasSocial: false })).toBe(0);
    const full = profileCompletion({
      profile: { tier: "A", rapport: 4, niche_profile: "Car dealer" },
      people: [{ role: "CEO", decision_power: "Budget", personal_notes: "Padel", birthday: "1978-12-14" }],
      hasDates: true,
      hasBrief: true,
      hasSocial: true,
    });
    expect(full).toBe(100);
    const half = profileCompletion({
      profile: { tier: "A", rapport: null, niche_profile: " " },
      people: [{ role: "CEO", decision_power: null, personal_notes: null, birthday: null }],
      hasDates: true,
      hasBrief: false,
      hasSocial: false,
    });
    expect(half).toBe(Math.round((4 / 11) * 100));
  });
});

describe("reports", () => {
  it("follows draft → submitted → approved/changes → sent", () => {
    expect(canMoveReport("draft", "submitted")).toBe(true);
    expect(canMoveReport("draft", "sent")).toBe(false);
    expect(canMoveReport("submitted", "changes")).toBe(true);
    expect(canMoveReport("changes", "submitted")).toBe(true);
    expect(canMoveReport("approved", "sent")).toBe(true);
    expect(canMoveReport("sent", "draft")).toBe(false);
  });
  it("labels sent reports that went through changes", () => {
    expect(reportStatus("sent", true).label).toBe("Sent after changes");
    expect(reportStatus("sent", false).label).toBe("Sent");
    expect(reportStatus("submitted", false).tone).toBe("violet");
  });
  it("puts the due date in the following month and clamps the day", () => {
    expect(reportDueOn("2026-10-01", 5)).toBe("2026-11-05");
    expect(reportDueOn("2026-12-01", 31)).toBe("2027-01-28");
    expect(reportDueOn("2026-12-01", 0)).toBe("2027-01-01");
  });
  it("flags late reports until sent", () => {
    expect(reportLate("submitted", "2026-11-03", TODAY)).toBe(true);
    expect(reportLate("submitted", "2026-11-05", TODAY)).toBe(false);
    expect(reportLate("sent", "2026-11-03", TODAY)).toBe(false);
  });
  it("moves QBRs draft → ready → presented", () => {
    expect(nextQbrStatus("draft")).toBe("ready");
    expect(nextQbrStatus("ready")).toBe("presented");
    expect(nextQbrStatus("presented")).toBeNull();
    expect(quarterOf("2026-11-04")).toBe("2026-Q4");
    expect(quarterOf("2026-01-01")).toBe("2026-Q1");
  });
});

describe("delivery ratings", () => {
  const r = (month: string, quality: number, on_time: number, communication: number) => ({ month, quality, on_time, communication });
  it("averages the last three full months only", () => {
    const a = ratingAverages(
      [r("2026-10-01", 4, 3, 4), r("2026-10-01", 5, 4, 5), r("2026-09-01", 5, 4, 5), r("2026-08-01", 4, 4, 4), r("2026-07-01", 1, 1, 1), r("2026-11-01", 1, 1, 1)],
      TODAY,
    );
    expect(a).toEqual({ quality: 4.5, on_time: 3.8, communication: 4.5, count: 4 });
  });
  it("returns null with no ratings", () => {
    expect(ratingAverages([], TODAY).quality).toBeNull();
    expect(scoreTone(null)).toBeUndefined();
    expect(scoreTone(2.9)).toBe("danger");
    expect(scoreTone(3.7)).toBe("warn");
    expect(scoreTone(4.2)).toBeUndefined();
  });
});

it("splits text into trimmed lines", () => {
  expect(lines(" a \n\n b\n")).toEqual(["a", "b"]);
  expect(lines(null)).toEqual([]);
});

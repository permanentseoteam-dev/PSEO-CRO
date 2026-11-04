import { describe, expect, it } from "vitest";
import {
  fillTitle, formatSubtasks, groupInOrder, normalizeKey, parseLines, parseSubtasks, projectStats, qualityBy, qualityStats, rangeStart,
  reasonCounts,
} from "../logic";
import type { ReviewFact } from "../types";

const rv = (p: Partial<ReviewFact>): ReviewFact => ({
  ticket_id: "t1", round: 1, status: "approved", reasons: [], submitted_at: "2026-11-01T08:00:00Z", decided_at: "2026-11-01T18:00:00Z",
  owner_id: "a", department_id: "d1", client_id: "c1", ...p,
});

describe("normalizeKey", () => {
  it("upper-cases 2-8 letters and rejects the rest", () => {
    expect(normalizeKey(" cpd ")).toBe("CPD");
    expect(normalizeKey("ABCDEFGH")).toBe("ABCDEFGH");
    expect(normalizeKey("A")).toBeNull();
    expect(normalizeKey("ABCDEFGHI")).toBeNull();
    expect(normalizeKey("CP1")).toBeNull();
  });
});

describe("projectStats", () => {
  it("counts open, overdue and done in the last 30 days", () => {
    const s = projectStats(
      [
        { project_id: "p", status: "todo", due_date: "2026-11-01", completed_at: null },
        { project_id: "p", status: "in_progress", due_date: "2026-11-04", completed_at: null },
        { project_id: "p", status: "done", due_date: "2026-10-01", completed_at: "2026-10-20T10:00:00Z" },
        { project_id: "p", status: "done", due_date: "2026-09-01", completed_at: "2026-09-01T10:00:00Z" },
        { project_id: null, status: "todo", due_date: null, completed_at: null },
      ],
      "2026-11-04",
    );
    expect(s).toEqual({ p: { open: 2, overdue: 1, done30: 1 } });
  });
});

describe("fillTitle", () => {
  it("fills every placeholder", () => {
    expect(fillTitle("{client} SEO report · {month}", { client: "Cedar & Pine Dental", today: "2026-11-04" })).toBe(
      "Cedar & Pine Dental SEO report · November 2026",
    );
    expect(fillTitle("{project} pacing · {date}", { project: "Alba Motors Ads", today: "2026-11-09" })).toBe("Alba Motors Ads pacing · Nov 9");
  });
  it("drops empty placeholders cleanly", () => {
    expect(fillTitle("{client} landing page", { today: "2026-11-04" })).toBe("landing page");
  });
});

describe("subtasks", () => {
  it("parses title | +Nd and plain titles", () => {
    expect(parseSubtasks("Outline | +2d\nDraft|5\n\nPublish")).toEqual([
      { title: "Outline", due_offset_days: 2 },
      { title: "Draft", due_offset_days: 5 },
      { title: "Publish", due_offset_days: null },
    ]);
  });
  it("round-trips through formatSubtasks", () => {
    const text = "Outline | +2d\nPublish";
    expect(formatSubtasks(parseSubtasks(text))).toBe(text);
  });
  it("parseLines trims and skips blanks", () => {
    expect(parseLines(" a \r\n\n b")).toEqual(["a", "b"]);
  });
});

describe("rangeStart", () => {
  it("goes back 30, 90 or 365 days", () => {
    expect(rangeStart("30d", "2026-11-04")).toBe("2026-10-05");
    expect(rangeStart("90d", "2026-11-04")).toBe("2026-08-06");
    expect(rangeStart("year", "2026-11-04")).toBe("2025-11-04");
  });
});

describe("quality", () => {
  const rows = [
    rv({ ticket_id: "t1", round: 1, status: "approved" }), // 10h, first time
    rv({ ticket_id: "t2", round: 1, status: "changes", reasons: ["Accuracy"], decided_at: "2026-11-02T10:00:00Z", owner_id: "b" }), // 26h
    rv({ ticket_id: "t2", round: 2, status: "approved", owner_id: "b" }),
    rv({ ticket_id: "t3", round: 1, status: "waiting", decided_at: null }),
  ];

  it("ignores waiting rounds and computes the headline numbers", () => {
    const s = qualityStats(rows);
    expect(s.reviewed).toBe(2);
    expect(s.firstPass).toBe(0.5);
    expect(s.avgRounds).toBe(1.5);
    expect(s.avgWaitH).toBeCloseTo((10 + 26 + 10) / 3);
    expect(s.over24).toBe(1);
  });

  it("returns nulls when nothing was reviewed", () => {
    expect(qualityStats([])).toEqual({ reviewed: 0, firstPass: null, avgRounds: null, avgWaitH: null, over24: 0 });
  });

  it("groups by a key, most reviewed first", () => {
    const by = qualityBy([...rows, rv({ ticket_id: "t4", owner_id: "b" })], (r) => r.owner_id, (k) => k.toUpperCase());
    expect(by.map((r) => [r.label, r.reviewed])).toEqual([["B", 2], ["A", 1]]);
  });

  it("counts send-back reasons", () => {
    expect(reasonCounts([...rows, rv({ status: "changes", reasons: ["Accuracy", "Quality"] })])).toEqual([["Accuracy", 2], ["Quality", 1]]);
  });
});

describe("groupInOrder", () => {
  it("keeps the given order first, then A-Z", () => {
    const g = groupInOrder(["x:Web", "y:SEO", "z:Zed", "w:Ads"], (s) => s.split(":")[1], ["SEO", "Web"]);
    expect(g.map(([l]) => l)).toEqual(["SEO", "Web", "Ads", "Zed"]);
  });
});

import { describe, expect, it } from "vitest";
import {
  agoLabel,
  bearerOk,
  dubaiDate,
  hoursLabel,
  isAppJob,
  isDubaiDayOfMonth,
  isReportDue,
  JOBS,
  monthLabel,
  monthStartOf,
  previousMonth,
  profitabilityDetail,
  slaMarks,
  withLastRuns,
} from "../logic";

describe("Dubai dates", () => {
  it("rolls over at 20:00 UTC (midnight in Dubai)", () => {
    expect(dubaiDate(new Date("2026-10-31T19:59:59Z"))).toBe("2026-10-31");
    expect(dubaiDate(new Date("2026-10-31T20:00:00Z"))).toBe("2026-11-01");
  });

  it("matches the 1st only in Dubai time", () => {
    expect(isDubaiDayOfMonth(new Date("2026-10-31T20:30:00Z"), 1)).toBe(true); // 00:30 on 1 Nov in Dubai
    expect(isDubaiDayOfMonth(new Date("2026-10-31T19:30:00Z"), 1)).toBe(false); // 23:30 on 31 Oct in Dubai
    expect(isDubaiDayOfMonth(new Date("2026-11-01T02:00:00Z"), 1)).toBe(true); // the 06:00 Dubai run
    expect(isDubaiDayOfMonth(new Date("2026-11-01T20:00:00Z"), 1)).toBe(false); // already the 2nd in Dubai
  });

  it("matches the 2nd", () => {
    expect(isDubaiDayOfMonth(new Date("2026-11-02T05:00:00Z"), 2)).toBe(true); // the 09:00 Dubai run
    expect(isDubaiDayOfMonth(new Date("2026-11-01T19:59:00Z"), 2)).toBe(false);
    expect(isDubaiDayOfMonth(new Date("2026-11-01T20:00:00Z"), 2)).toBe(true);
    expect(isDubaiDayOfMonth(new Date("2026-11-03T05:00:00Z"), 2)).toBe(false);
  });

  it("handles year ends", () => {
    expect(dubaiDate(new Date("2026-12-31T20:00:00Z"))).toBe("2027-01-01");
    expect(previousMonth("2027-01-02")).toBe("2026-12");
    expect(previousMonth("2026-11-02")).toBe("2026-10");
    expect(monthStartOf("2026-11-01")).toBe("2026-11-01");
    expect(monthStartOf("2027-02-28")).toBe("2027-02-01");
  });

  it("labels months", () => {
    expect(monthLabel("2026-10")).toBe("October 2026");
    expect(monthLabel("2027-01-01")).toBe("January 2027");
  });
});

describe("report due-day matching", () => {
  const base = { status: "approved", autoSend: true, dueOn: "2026-11-05", sentAt: null };
  it("is due on its due day and after it", () => {
    expect(isReportDue(base, "2026-11-04")).toBe(false);
    expect(isReportDue(base, "2026-11-05")).toBe(true);
    expect(isReportDue(base, "2026-11-07")).toBe(true);
  });
  it("needs approved, auto-send and not sent", () => {
    expect(isReportDue({ ...base, status: "submitted" }, "2026-11-05")).toBe(false);
    expect(isReportDue({ ...base, autoSend: false }, "2026-11-05")).toBe(false);
    expect(isReportDue({ ...base, sentAt: "2026-11-05T05:00:00Z" }, "2026-11-05")).toBe(false);
  });
  it("uses the Dubai date at the boundary", () => {
    // 21:00 UTC on 4 Nov is already 5 Nov in Dubai.
    expect(isReportDue(base, dubaiDate(new Date("2026-11-04T21:00:00Z")))).toBe(true);
    expect(isReportDue(base, dubaiDate(new Date("2026-11-04T19:00:00Z")))).toBe(false);
  });
});

describe("SLA marks", () => {
  const none = { lateAt: null, late2xAt: null };
  it("fires at the target and at 2x", () => {
    expect(slaMarks(239, 4, none)).toEqual({ late: false, late2x: false });
    expect(slaMarks(240, 4, none)).toEqual({ late: true, late2x: false });
    expect(slaMarks(480, 4, none)).toEqual({ late: true, late2x: true });
  });
  it("fires each mark once", () => {
    expect(slaMarks(500, 4, { lateAt: "x", late2xAt: null })).toEqual({ late: false, late2x: true });
    expect(slaMarks(500, 4, { lateAt: "x", late2xAt: "y" })).toEqual({ late: false, late2x: false });
  });
  it("formats targets", () => {
    expect(hoursLabel(4)).toBe("4h");
    expect(hoursLabel(0.5)).toBe("30m");
    expect(hoursLabel(1.5)).toBe("1h 30m");
  });
});

describe("cron auth", () => {
  it("needs the exact bearer secret", () => {
    expect(bearerOk("Bearer s3cret", "s3cret")).toBe(true);
    expect(bearerOk("Bearer s3cre", "s3cret")).toBe(false);
    expect(bearerOk("bearer s3cret", "s3cret")).toBe(false);
    expect(bearerOk(null, "s3cret")).toBe(false);
    expect(bearerOk("Bearer ", "")).toBe(false);
    expect(bearerOk("Bearer undefined", undefined)).toBe(false);
  });
});

describe("job list", () => {
  it("has unique names and knows app jobs", () => {
    expect(new Set(JOBS.map((j) => j.name)).size).toBe(JOBS.length);
    expect(isAppJob("sla-alerts")).toBe(true);
    expect(isAppJob("health-recalc")).toBe(true);
    expect(isAppJob("timer-cleanup")).toBe(false); // database job
    expect(isAppJob("nope")).toBe(false);
  });

  it("picks the latest run per job", () => {
    const rows = withLastRuns([
      { job: "sla-alerts", started_at: "2026-11-05T10:00:00Z", finished_at: null, status: "ok", detail: "a" },
      { job: "sla-alerts", started_at: "2026-11-05T10:15:00Z", finished_at: null, status: "error", detail: "b" },
    ]);
    expect(rows).toHaveLength(JOBS.length);
    expect(rows.find((r) => r.job.name === "sla-alerts")?.last?.detail).toBe("b");
    expect(rows.find((r) => r.job.name === "inbox-poll")?.last).toBeNull();
  });

  it("formats ages and the profitability line", () => {
    const now = new Date("2026-11-05T10:00:00Z");
    expect(agoLabel("2026-11-05T09:59:30Z", now)).toBe("just now");
    expect(agoLabel("2026-11-05T09:48:00Z", now)).toBe("12 min ago");
    expect(agoLabel("2026-11-04T09:00:00Z", now)).toBe("1 day ago");
    expect(profitabilityDetail(32.4, 0, 35)).toBe("is ready: margin 32%.");
    expect(profitabilityDetail(32.4, 2, 35)).toBe("is ready: margin 32%, 2 clients under 35%.");
  });
});

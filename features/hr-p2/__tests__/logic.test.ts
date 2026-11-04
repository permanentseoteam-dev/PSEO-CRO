import { describe, expect, it } from "vitest";
import {
  DEFAULT_SPLIT,
  checklistProgress,
  clockState,
  extendProbation,
  fmtMinutes,
  isEarlyClockOut,
  kpiWeightTotal,
  localDate,
  localHm,
  maskSecret,
  parseSteps,
  pathProgress,
  payGross,
  splitGross,
  stepStatuses,
  workedMinutes,
} from "../logic";

describe("splitGross", () => {
  it("splits 18,000 AED with the default 60/25/5/5/5", () => {
    const r = splitGross(18000, DEFAULT_SPLIT);
    expect(r.parts).toEqual({ basic: 10800, house_rent: 4500, utilities: 900, medical: 900, other: 900 });
    expect(r.total).toBe(18000);
    expect(r.ok).toBe(true);
  });

  it("puts the rounding remainder on Basic so parts add up exactly", () => {
    const r = splitGross(1000.01, { basic: 33.33, house_rent: 33.33, utilities: 33.34, medical: 0, other: 0 });
    expect(r.ok).toBe(true);
    expect(r.total).toBe(1000.01);
    expect(r.parts.house_rent).toBe(333.3);
  });

  it("flags percents that don't add to 100 and leaves the parts unadjusted", () => {
    const r = splitGross(10000, { basic: 50, house_rent: 25, utilities: 5, medical: 5, other: 5 });
    expect(r.ok).toBe(false);
    expect(r.totalPct).toBe(90);
    expect(r.total).toBe(9000);
  });

  it("treats negative or empty gross as zero", () => {
    expect(splitGross(-5, DEFAULT_SPLIT).total).toBe(0);
    expect(splitGross(Number.NaN, DEFAULT_SPLIT).total).toBe(0);
  });
});

describe("payGross", () => {
  it("adds the five components without float drift", () => {
    expect(payGross({ basic: 0.1, house_rent: 0.2, utilities: 0, medical: 0, other: 0 })).toBe(0.3);
  });
});

describe("maskSecret", () => {
  it("keeps the first and last 4 of an IBAN and its spaces", () => {
    expect(maskSecret("AE07 0260 0010 1234 5674 521")).toBe("AE07 **** **** **** ***4 521");
  });
  it("keeps dashes in an Emirates ID", () => {
    expect(maskSecret("784-1991-4471321-1")).toBe("784-1***-****321-1");
  });
  it("keeps only the last 2 of a short value", () => {
    expect(maskSecret("123456")).toBe("****56");
  });
  it("returns null for empty values", () => {
    expect(maskSecret("")).toBeNull();
    expect(maskSecret(null)).toBeNull();
  });
});

describe("clock", () => {
  it("reads local Dubai time", () => {
    expect(localHm("2026-11-04T04:56:00Z")).toBe("08:56");
    expect(localDate(new Date("2026-11-04T21:30:00Z"))).toBe("2026-11-05");
  });

  it("warns before the shift end, not after", () => {
    expect(isEarlyClockOut(new Date("2026-11-04T13:59:00Z"), "18:00")).toBe(true); // 17:59 Dubai
    expect(isEarlyClockOut(new Date("2026-11-04T14:00:00Z"), "18:00:00")).toBe(false); // 18:00 Dubai
  });

  it("derives the state from the day row", () => {
    expect(clockState(null)).toBe("out");
    expect(clockState({ clock_out_at: null, break_started_at: null })).toBe("in");
    expect(clockState({ clock_out_at: null, break_started_at: "2026-11-04T08:00:00Z" })).toBe("break");
    expect(clockState({ clock_out_at: "2026-11-04T14:00:00Z", break_started_at: null })).toBe("done");
  });

  it("takes finished and running breaks out of worked time", () => {
    const day = { clock_in_at: "2026-11-04T05:00:00Z", clock_out_at: null, break_started_at: "2026-11-04T09:00:00Z", break_minutes: 30 };
    expect(workedMinutes(day, new Date("2026-11-04T09:15:00Z"))).toBe(255 - 30 - 15);
    expect(workedMinutes({ ...day, break_started_at: null, clock_out_at: "2026-11-04T14:00:00Z" }, new Date())).toBe(540 - 30);
    expect(fmtMinutes(425)).toBe("7h 05m");
  });
});

describe("probation", () => {
  it("extends from the current end, or from today when there is none", () => {
    expect(extendProbation("2026-11-20", 30, "2026-11-04")).toBe("2026-12-20");
    expect(extendProbation(null, 90, "2026-11-04")).toBe("2027-02-02");
  });
});

describe("offboarding checklist", () => {
  it("counts done items and completion", () => {
    expect(checklistProgress([{ done_at: "x" }, { done_at: null }])).toEqual({ done: 1, total: 2, complete: false });
    expect(checklistProgress([{ done_at: "x" }])).toEqual({ done: 1, total: 1, complete: true });
    expect(checklistProgress([]).complete).toBe(false);
  });
});

describe("kpiWeightTotal", () => {
  const kpis = [
    { weight: 25, department_id: null, active: true },
    { weight: 25, department_id: "cs", active: true },
    { weight: 15, department_id: "ppc", active: true },
    { weight: 50, department_id: null, active: false },
  ];
  it("counts everyone KPIs plus the department's own, active only", () => {
    expect(kpiWeightTotal(kpis, "cs")).toBe(50);
    expect(kpiWeightTotal(kpis, null)).toBe(25);
  });
});

describe("training", () => {
  it("parses one step per line and reports bad lines", () => {
    const r = parseSteps("Course: Running QBRs\n\nvideo - Handling an unhappy client\nPodcast: nope\nReading:");
    expect(r.steps).toEqual([
      { kind: "course", title: "Running QBRs" },
      { kind: "video", title: "Handling an unhappy client" },
    ]);
    expect(r.errors).toEqual([4, 5]);
  });

  it("marks done steps, then one Next, then Not started", () => {
    const steps = [
      { id: "c", position: 3 },
      { id: "a", position: 1 },
      { id: "b", position: 2 },
      { id: "d", position: 4 },
    ];
    expect(stepStatuses(steps, ["a", "c"]).map((s) => s.status)).toEqual(["done", "next", "done", "not_started"]);
    expect(pathProgress(steps, ["a", "c", "zz"])).toEqual({ done: 2, total: 4, pct: 50 });
  });
});

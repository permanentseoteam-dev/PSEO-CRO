import { describe, expect, it } from "vitest";
import {
  buildAlerts,
  buildWorkload,
  checkScope,
  failedChecks,
  firstRun,
  isoDow,
  mondayOf,
  mostRevised,
  moveTargets,
  nextRun,
  parseTicketKey,
  planTicket,
  qualityGroups,
  renderTitle,
  repeatsLabel,
  splitTerms,
  visiblePeople,
  weekTitle,
  wouldCycle,
} from "../logic";
import { DEFAULT_CAPACITY, DEFAULT_SETTINGS, type LoadTicket, type Person, type ReviewRound } from "../types";

const TODAY = "2026-11-04"; // Wednesday
const MON = "2026-11-02";
const person = (id: string, extra: Partial<Person> = {}): Person => ({ id, name: id.toUpperCase(), departmentId: null, managerId: null, ...extra });
const ticket = (id: string, extra: Partial<LoadTicket>): LoadTicket => ({ id, key: id.toUpperCase(), title: id, assigneeId: "a", estimateMin: 60, start: null, due: null, ...extra });

describe("dates", () => {
  it("finds the Monday and weekday", () => {
    expect(isoDow(TODAY)).toBe(3);
    expect(mondayOf(TODAY)).toBe(MON);
    expect(mondayOf("2026-11-08")).toBe(MON);
    expect(weekTitle(MON)).toBe("Week of Nov 2 – 8");
    expect(weekTitle("2026-11-30")).toBe("Week of Nov 30 – Dec 6");
  });
});

describe("planTicket", () => {
  const cap = { workdays: [1, 2, 3, 4, 5] };
  it("spreads the estimate over workdays from start to due", () => {
    const m = planTicket(ticket("t", { estimateMin: 600, start: "2026-11-06", due: "2026-11-09" }), cap, DEFAULT_SETTINGS);
    expect([...m]).toEqual([
      ["2026-11-06", 300],
      ["2026-11-09", 300],
    ]);
  });
  it("puts it on the due day with no start, and uses the default estimate", () => {
    expect([...planTicket(ticket("t", { estimateMin: null, due: TODAY }), cap, DEFAULT_SETTINGS)]).toEqual([[TODAY, 60]]);
  });
  it("leaves unscheduled tickets off, and keeps weekend-only work on the due day", () => {
    expect(planTicket(ticket("t", { due: null }), cap, DEFAULT_SETTINGS).size).toBe(0);
    expect([...planTicket(ticket("t", { due: "2026-11-08", start: "2026-11-07" }), cap, DEFAULT_SETTINGS)]).toEqual([["2026-11-08", 60]]);
  });
});

describe("workload grid and alerts", () => {
  const people = [person("a"), person("b"), person("c")];
  const tickets = [
    ticket("big", { assigneeId: "a", estimateMin: 40 * 60, start: MON, due: "2026-11-06" }),
    ticket("small", { assigneeId: "a", estimateMin: 60, due: "2026-11-05" }),
    ticket("late1", { assigneeId: "b", estimateMin: 60, due: "2026-10-20" }),
    ticket("late2", { assigneeId: "b", estimateMin: 60, due: "2026-10-30" }),
    ticket("noest", { assigneeId: "b", estimateMin: null, due: "2026-11-05" }),
  ];
  const caps = [{ member_id: "a", weekly_hours: 30, workdays: [1, 2, 3, 4, 5] }];
  const rows = buildWorkload(people, tickets, caps, DEFAULT_SETTINGS, MON, DEFAULT_CAPACITY);

  it("sums planned hours per day against capacity", () => {
    const a = rows[0];
    expect(a.days.map((d) => d.planned)).toEqual([8, 8, 8, 9, 8, 0, 0]);
    expect(a.days[0].capacity).toBe(6);
    expect(a.days[5].capacity).toBe(0);
    expect(a.planned).toBe(41);
    expect(a.pct).toBe(137);
    expect(rows[1].capacity).toBe(38); // default capacity
    expect(rows[2].pct).toBe(0);
  });

  it("raises overloaded, overdue, has room and unestimated alerts in order", () => {
    const alerts = buildAlerts(rows, tickets, DEFAULT_SETTINGS, TODAY, MON);
    expect(alerts.map((x) => `${x.kind}:${x.memberId}`)).toEqual(["overloaded:a", "overdue:b", "has_room:b", "has_room:c", "unestimated:b"]);
    expect(alerts[0].moveTicket?.key).toBe("BIG");
    expect(alerts[1]).toMatchObject({ detail: "2 overdue", moveTicket: { key: "LATE1" } });
    expect(alerts[4].detail).toBe("1 ticket with no estimate");
  });

  it("offers lighter people as move targets", () => {
    expect(moveTargets(rows, "a").map((t) => t.id)).toEqual(["c", "b"]);
  });
});

describe("visiblePeople", () => {
  const people = [person("me", { departmentId: "d1" }), person("mate", { departmentId: "d1" }), person("report", { managerId: "me" }), person("other")];
  const me = { id: "me", departmentId: "d1" };
  it("filters by scope", () => {
    expect(visiblePeople(people, me, "all")).toHaveLength(4);
    expect(visiblePeople(people, me, "team").map((p) => p.id)).toEqual(["me", "mate", "report"]);
    expect(visiblePeople(people, me, "own").map((p) => p.id)).toEqual(["me"]);
    expect(visiblePeople(people, me, "none")).toEqual([]);
  });
});

describe("recurring rules", () => {
  it("finds the next run for each frequency", () => {
    expect(nextRun({ frequency: "daily", weekday: null, month_day: null }, TODAY)).toBe(TODAY);
    expect(nextRun({ frequency: "weekdays", weekday: null, month_day: null }, "2026-11-07")).toBe("2026-11-09");
    expect(nextRun({ frequency: "weekly", weekday: 1, month_day: null }, TODAY)).toBe("2026-11-09");
    expect(nextRun({ frequency: "weekly", weekday: 3, month_day: null }, TODAY)).toBe(TODAY);
    expect(nextRun({ frequency: "monthly", weekday: null, month_day: 20 }, TODAY)).toBe("2026-11-20");
    expect(nextRun({ frequency: "monthly", weekday: null, month_day: 1 }, TODAY)).toBe("2026-12-01");
    expect(nextRun({ frequency: "monthly", weekday: null, month_day: 1 }, "2026-12-15")).toBe("2027-01-01");
  });
  it("never starts before the start date", () => {
    expect(firstRun({ frequency: "monthly", weekday: null, month_day: 1, starts_on: "2027-02-10" }, TODAY)).toBe("2027-03-01");
  });
  it("labels and renders titles", () => {
    expect(repeatsLabel({ frequency: "weekly", weekday: 1, month_day: null })).toBe("Weekly on Monday");
    expect(repeatsLabel({ frequency: "monthly", weekday: null, month_day: 15 })).toBe("Monthly on day 15");
    expect(renderTitle("{client} SEO report · {month}", { client: "Cedar & Pine Dental", project: "Cedar & Pine SEO", runOn: "2026-12-01" })).toBe(
      "Cedar & Pine Dental SEO report · December 2026",
    );
    expect(renderTitle("{project} pacing · {date}", { client: null, project: "Alba Motors Ads", runOn: "2026-11-09" })).toBe("Alba Motors Ads pacing · Nov 9");
  });
});

describe("dependencies", () => {
  const edges = [
    { ticketId: "b", blockedById: "a" },
    { ticketId: "c", blockedById: "b" },
  ];
  it("spots loops", () => {
    expect(wouldCycle(edges, "a", "c")).toBe(true);
    expect(wouldCycle(edges, "a", "a")).toBe(true);
    expect(wouldCycle(edges, "c", "a")).toBe(false);
    expect(wouldCycle(edges, "d", "c")).toBe(false);
  });
  it("parses ticket keys", () => {
    expect(parseTicketKey(" cpd-139 ")).toBe("CPD-139");
    expect(parseTicketKey("CPD-142.1")).toBe("CPD-142.1");
    expect(parseTicketKey("hello")).toBeNull();
  });
});

describe("scope", () => {
  const terms = { inScope: splitTerms("SEO content\nTechnical SEO"), outOfScope: splitTerms(["Paid ads management", "Logo design"]) };
  it("splits text and arrays", () => {
    expect(splitTerms("- One\n- Two; Three")).toEqual(["One", "Two", "Three"]);
    expect(splitTerms(null)).toEqual([]);
  });
  it("flags out-of-scope work first", () => {
    expect(checkScope("Set up paid ads management for spring", terms)).toEqual({ status: "out_of_scope", term: "Paid ads management" });
    expect(checkScope("New logo design ideas", terms).status).toBe("out_of_scope");
    expect(checkScope("Monthly SEO content brief", terms)).toEqual({ status: "in_scope", term: "SEO content" });
    expect(checkScope("Team lunch", terms).status).toBe("unsure");
  });
});

describe("quality report", () => {
  const r = (ticketId: string, round: number, status: ReviewRound["status"], reasons: string[] = [], waitH = 10): ReviewRound => ({
    ticketId,
    round,
    status,
    reasons,
    submittedAt: "2026-10-01T00:00:00Z",
    decidedAt: status === "waiting" ? null : new Date(Date.parse("2026-10-01T00:00:00Z") + waitH * 3_600_000).toISOString(),
  });
  const rounds = [
    r("t1", 1, "approved"),
    r("t2", 1, "changes", ["Accuracy"], 20),
    r("t2", 2, "changes", ["Accuracy", "Quality"], 30),
    r("t2", 3, "approved"),
    r("t3", 1, "waiting"),
    r("t4", 1, "changes", ["Missing parts"]),
  ];
  const service: Record<string, string> = { t1: "SEO", t2: "SEO", t3: "Web", t4: "Web" };

  it("groups by service", () => {
    expect(qualityGroups(rounds, (id) => service[id])).toEqual([
      { name: "SEO", reviewed: 2, firstTimePct: 50, avgRounds: 2, avgWaitH: 18 },
      { name: "Web", reviewed: 1, firstTimePct: 0, avgRounds: 1, avgWaitH: 10 },
    ]);
  });
  it("lists the most revised tickets with the main reason", () => {
    expect(mostRevised(rounds)).toEqual([
      { ticketId: "t2", rounds: 3, mainReason: "Accuracy" },
      { ticketId: "t4", rounds: 1, mainReason: "Missing parts" },
    ]);
  });
  it("counts failed QA checks", () => {
    expect(
      failedChecks([
        { label: "Links tested", passed: false },
        { label: "Links tested", passed: false },
        { label: "Images compressed", passed: false },
        { label: "Images compressed", passed: true },
      ]),
    ).toEqual([
      ["Links tested", 2],
      ["Images compressed", 1],
    ]);
  });
});

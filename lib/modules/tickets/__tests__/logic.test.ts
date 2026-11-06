import { describe, expect, it } from "vitest";
import {
  byStatusTab, dueBucket, fileProblem, filterTickets, fmtClock, fmtMinutes, groupTickets, historyText, minutesBetween, monthCells,
  moveItem, parseDuration, parseFilters, parseTags, shiftMonth, sortTickets, statusCounts, toQuery, weekEnd,
} from "../logic";
import type { TicketRow } from "../types";

const TODAY = "2026-11-04"; // Wednesday
const ME = "m1";

const t = (over: Partial<TicketRow>): TicketRow => ({
  id: over.key ?? "x", key: "CPD-1", title: "Ticket", status: "todo", priority: "normal", assigneeId: null, coAssigneeIds: [],
  reporterId: null, projectId: null, parentId: null, due: null, tags: [], updatedAt: "2026-11-01T00:00:00Z", checkDone: 0, checkTotal: 0,
  ...over,
});

const rows = [
  t({ key: "CPD-142", title: "Rewrite service pages", status: "in_review", priority: "high", assigneeId: ME, due: "2026-11-04", tags: ["content"], projectId: "p1" }),
  t({ key: "CPD-9", title: "Fix titles", status: "done", assigneeId: "m2", due: "2026-10-30", projectId: "p1" }),
  t({ key: "ALB-88", title: "Launch campaign", status: "in_progress", priority: "urgent", assigneeId: "m2", coAssigneeIds: [ME], due: "2026-11-02", projectId: "p2" }),
  t({ key: "ALB-91", title: "Negative keywords", status: "todo", assigneeId: null, due: "2026-11-20", projectId: "p2", tags: ["ads"] }),
  t({ key: "LUM-1", title: "Keyword map", status: "blocked", priority: "low", assigneeId: "m3", due: null }),
];
const ctx = { meId: ME, teamIds: [ME, "m3"], today: TODAY };
const f = (sp: Record<string, string>) => parseFilters(sp, TODAY);

describe("parseFilters / toQuery", () => {
  it("defaults to Board while preserving explicit List links", () => {
    expect(f({}).view).toBe("board");
    expect(toQuery(f({}))).toBe("");
    expect(f({ view: "list" }).view).toBe("list");
    expect(f(Object.fromEntries(new URLSearchParams(toQuery(f({ view: "list" }))))).view).toBe("list");
  });
  it("falls back to defaults on bad values", () => {
    const x = f({ view: "nope", st: "x", sort: "y", month: "2026-13-1" });
    expect(x).toMatchObject({ view: "board", st: "active", sort: "due", month: "2026-11" });
  });
  it("round-trips and drops defaults", () => {
    expect(toQuery(f({ st: "done", q: "seo", view: "list" }))).toBe("view=list&st=done&q=seo");
    expect(toQuery({ ...f({ view: "cal" }), month: "2026-12" })).toBe("view=cal&month=2026-12");
  });
});

describe("dates", () => {
  it("week ends on Sunday", () => expect(weekEnd(TODAY)).toBe("2026-11-08"));
  it("buckets due dates", () => {
    expect(dueBucket("2026-11-02", "todo", TODAY)).toBe("overdue");
    expect(dueBucket("2026-11-02", "done", TODAY)).toBe("later");
    expect(dueBucket(TODAY, "todo", TODAY)).toBe("today");
    expect(dueBucket("2026-11-08", "todo", TODAY)).toBe("week");
    expect(dueBucket("2026-11-09", "todo", TODAY)).toBe("later");
    expect(dueBucket(null, "todo", TODAY)).toBe("none");
  });
  it("builds a 6-week Monday-first month grid", () => {
    const cells = monthCells("2026-11");
    expect(cells).toHaveLength(42);
    expect(cells[0]).toEqual({ date: "2026-10-26", inMonth: false });
    expect(cells.filter((c) => c.inMonth)).toHaveLength(30);
  });
  it("shifts months across years", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
});

describe("filtering and counts", () => {
  it("filters by who: me includes co-assignee, none, team", () => {
    expect(filterTickets(rows, f({ who: "me" }), ctx).map((r) => r.key)).toEqual(["CPD-142", "ALB-88"]);
    expect(filterTickets(rows, f({ who: "none" }), ctx).map((r) => r.key)).toEqual(["ALB-91"]);
    expect(filterTickets(rows, f({ who: "team" }), ctx).map((r) => r.key)).toEqual(["CPD-142", "ALB-88", "LUM-1"]);
  });
  it("filters by due, search, tag and project", () => {
    expect(filterTickets(rows, f({ due: "overdue" }), ctx).map((r) => r.key)).toEqual(["ALB-88"]);
    expect(filterTickets(rows, f({ due: "week" }), ctx).map((r) => r.key)).toEqual(["CPD-142"]);
    expect(filterTickets(rows, f({ due: "none" }), ctx).map((r) => r.key)).toEqual(["LUM-1"]);
    expect(filterTickets(rows, f({ q: "keyword" }), ctx).map((r) => r.key)).toEqual(["ALB-91", "LUM-1"]);
    expect(filterTickets(rows, f({ tag: "ads" }), ctx).map((r) => r.key)).toEqual(["ALB-91"]);
    expect(filterTickets(rows, f({ proj: "p1" }), ctx)).toHaveLength(2);
  });
  it("counts tabs with Active = not done", () => {
    expect(statusCounts(rows)).toEqual({ active: 4, todo: 1, in_progress: 1, in_review: 1, blocked: 1, done: 1 });
    expect(byStatusTab(rows, "active")).toHaveLength(4);
    expect(byStatusTab(rows, "done").map((r) => r.key)).toEqual(["CPD-9"]);
  });
});

describe("sorting and grouping", () => {
  it("sorts by due with no-date last, by priority, by key numerically", () => {
    expect(sortTickets(rows, "due").map((r) => r.key)).toEqual(["CPD-9", "ALB-88", "CPD-142", "ALB-91", "LUM-1"]);
    expect(sortTickets(rows, "priority")[0].key).toBe("ALB-88");
    expect(sortTickets(rows, "key").map((r) => r.key)).toEqual(["ALB-88", "ALB-91", "CPD-9", "CPD-142", "LUM-1"]);
  });
  it("groups in a fixed order and names unassigned", () => {
    const names = { people: { [ME]: "Sara", m2: "Omar", m3: "Ayesha" }, projects: { p1: "Cedar", p2: "Alba" }, today: TODAY };
    expect(groupTickets(rows, "status", names).map((g) => g.label)).toEqual(["To do", "In progress", "In review", "Blocked", "Done"]);
    expect(groupTickets(rows, "assignee", names).map((g) => g.label)).toEqual(["Ayesha", "Omar", "Sara", "Unassigned"]);
    expect(groupTickets(rows, "due", names).map((g) => g.key)).toEqual(["overdue", "today", "later", "none"]);
    expect(groupTickets(rows, "", names)).toHaveLength(1);
  });
});

describe("durations, tags, files, misc", () => {
  it("parses durations", () => {
    expect(parseDuration("1h 30m")).toBe(90);
    expect(parseDuration("1.5h")).toBe(90);
    expect(parseDuration("45m")).toBe(45);
    expect(parseDuration("2h")).toBe(120);
    expect(parseDuration("90")).toBe(90);
    expect(parseDuration("1:05")).toBe(65);
    expect(parseDuration("soon")).toBeNull();
    expect(parseDuration("")).toBeNull();
  });
  it("formats minutes and clocks", () => {
    expect(fmtMinutes(400)).toBe("6h 40m");
    expect(fmtMinutes(45)).toBe("45m");
    expect(fmtMinutes(120)).toBe("2h");
    expect(fmtClock(307)).toBe("05:07");
    expect(fmtClock(3907)).toBe("1:05:07");
    expect(minutesBetween("2026-11-04T10:00:00Z", new Date("2026-11-04T10:59:59Z"))).toBe(59);
    expect(minutesBetween("2026-11-04T10:00:00Z", new Date("2026-11-04T09:00:00Z"))).toBe(0);
  });
  it("parses tags", () => expect(parseTags("#Content, onpage content  ads")).toEqual(["content", "onpage", "ads"]));
  it("blocks dangerous and large files", () => {
    expect(fileProblem("brief.pdf", 1000)).toBeNull();
    expect(fileProblem("setup.EXE", 10)).toMatch(/blocked/);
    expect(fileProblem("big.png", 3 * 1024 * 1024)).toMatch(/2 MB/);
  });
  it("moves items within bounds", () => {
    expect(moveItem([1, 2, 3], 0, 1)).toEqual([2, 1, 3]);
    expect(moveItem([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
  });
  it("writes history in plain words", () => {
    const name = (id: string | null) => (id === "m2" ? "Omar Haddad" : "Someone");
    expect(historyText({ actor: "Omar Haddad", field: "status", oldValue: "in_progress", newValue: "in_review" }, name))
      .toBe("Omar Haddad changed status from In progress to In review");
    expect(historyText({ actor: "Sara", field: "assignee", oldValue: null, newValue: "m2" }, name)).toBe("Sara assigned Omar Haddad");
    expect(historyText({ actor: "Priya", field: "time", oldValue: null, newValue: "130" }, name)).toBe("Priya logged 2h 10m");
  });
});

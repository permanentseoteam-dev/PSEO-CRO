import { describe, expect, it } from "vitest";
import {
  ago,
  dayDiff,
  dueGroup,
  dueLabel,
  groupTickets,
  homeStats,
  inView,
  lastDone,
  loadBar,
  metaLine,
  reportStatus,
  todayItems,
  upNext,
  whyFor,
} from "../logic";
import type { MyEvent, MyTicket } from "../types";

const ME = "me";
const TODAY = "2026-11-04"; // Wednesday

let n = 0;
const t = (o: Partial<MyTicket>): MyTicket => ({
  id: `id${++n}`,
  key: `T-${n}`,
  title: "Ticket",
  status: "todo",
  priority: "normal",
  assigneeId: ME,
  assigneeName: "Me",
  reporterId: "other",
  watching: false,
  due: null,
  doneOn: null,
  projectName: null,
  subtasks: 0,
  checklistDone: 0,
  checklistTotal: 0,
  comments: 0,
  ...o,
});

describe("dates", () => {
  it("counts days", () => {
    expect(dayDiff("2026-11-02", TODAY)).toBe(-2);
    expect(dayDiff("2026-12-04", TODAY)).toBe(30);
  });

  it("groups by due date with this week ending Sunday", () => {
    expect(dueGroup(null, TODAY)).toBe("none");
    expect(dueGroup("2026-11-03", TODAY)).toBe("overdue");
    expect(dueGroup(TODAY, TODAY)).toBe("today");
    expect(dueGroup("2026-11-08", TODAY)).toBe("week"); // Sunday
    expect(dueGroup("2026-11-09", TODAY)).toBe("later"); // Monday
  });

  it("labels the due cell", () => {
    expect(dueLabel("2026-11-02", TODAY)).toEqual({ text: "2 days late", tone: "late" });
    expect(dueLabel("2026-11-03", TODAY).text).toBe("1 day late");
    expect(dueLabel(TODAY, TODAY).text).toBe("Today");
    expect(dueLabel("2026-11-06", TODAY).text).toBe("Fri 6 Nov");
    expect(dueLabel(null, TODAY).text).toBe("None");
  });

  it("says how long ago", () => {
    const now = new Date("2026-11-04T08:00:00Z"); // 12:00 Dubai
    expect(ago("2026-11-04T07:48:00Z", now)).toBe("12 min ago");
    expect(ago("2026-11-04T05:00:00Z", now)).toBe("3 h ago");
    expect(ago("2026-11-03T10:00:00Z", now)).toBe("Yesterday");
    expect(ago("2026-11-01T10:00:00Z", now)).toBe("Sun 1 Nov");
  });
});

describe("views", () => {
  const assigned = t({});
  const reported = t({ assigneeId: "x", reporterId: ME });
  const watched = t({ assigneeId: "x", watching: true });
  const selfMade = t({ reporterId: ME });

  it("filters each tab", () => {
    const all = [assigned, reported, watched, selfMade];
    expect(all.filter((x) => inView(x, "assigned", ME))).toEqual([assigned, selfMade]);
    expect(all.filter((x) => inView(x, "on", ME))).toHaveLength(4);
    expect(all.filter((x) => inView(x, "watching", ME))).toEqual([watched]);
    expect(all.filter((x) => inView(x, "asked", ME))).toEqual([reported]);
  });

  it("explains why an update reached me", () => {
    expect(whyFor(assigned, ME)).toBe("assigned");
    expect(whyFor(reported, ME)).toBe("reported");
    expect(whyFor(watched, ME)).toBe("watching");
    expect(whyFor(undefined, ME)).toBeNull();
  });
});

describe("grouping and stats", () => {
  const list = [
    t({ due: "2026-11-02", status: "in_progress", priority: "high" }),
    t({ due: "2026-10-31", status: "blocked" }),
    t({ due: TODAY, status: "in_progress" }),
    t({ due: TODAY, status: "in_review", priority: "urgent" }),
    t({ due: "2026-11-20" }),
    t({ due: null, priority: "low" }),
    t({ status: "done", doneOn: "2026-11-01" }),
    t({ status: "done", doneOn: "2026-11-03" }),
  ];

  it("groups open tickets, oldest first", () => {
    const g = groupTickets(list, TODAY);
    expect(g.overdue.map((x) => x.due)).toEqual(["2026-10-31", "2026-11-02"]);
    expect(g.today).toHaveLength(2);
    expect(g.week).toHaveLength(0);
    expect(g.later).toHaveLength(1);
    expect(g.none).toHaveLength(1);
  });

  it("keeps the newest done tickets", () => {
    expect(lastDone(list).map((x) => x.doneOn)).toEqual(["2026-11-03", "2026-11-01"]);
    expect(lastDone(list, 1)).toHaveLength(1);
  });

  it("computes the stat cards", () => {
    expect(homeStats(list, TODAY)).toEqual({
      open: 6,
      urgent: 2,
      overdue: 2,
      oldestLate: 4,
      dueToday: 2,
      dueTodayInProgress: 1,
      blocked: 1,
      review: 1,
    });
  });

  it("orders up next by due date then priority, skipping blocked and done", () => {
    const keys = upNext(list).map((x) => x.due + ":" + x.priority);
    expect(keys).toEqual(["2026-11-02:high", `${TODAY}:urgent`, `${TODAY}:normal`, "2026-11-20:normal", "null:low"]);
  });

  it("writes the meta line", () => {
    expect(metaLine(t({ projectName: "Alba Motors PPC", subtasks: 1, checklistDone: 2, checklistTotal: 5, comments: 4 }))).toBe(
      "Alba Motors PPC · 1 subtask · 2/5 checklist · 4 comments",
    );
    expect(metaLine(t({}))).toBe("");
  });
});

describe("today list", () => {
  const now = new Date("2026-11-04T06:42:00Z"); // 10:42 Dubai
  const ev = (id: string, start: string, end: string, meet: string | null = null): MyEvent => ({
    id,
    title: id,
    startsAt: start,
    endsAt: end,
    meetLink: meet,
    clientName: null,
    attendees: [],
  });
  const events = [
    ev("standup", "2026-11-04T05:30:00Z", "2026-11-04T06:00:00Z"), // 09:30, finished
    ev("alba", "2026-11-04T07:00:00Z", "2026-11-04T07:45:00Z", "https://meet.google.com/x"), // 11:00, in 18 min
    ev("luma", "2026-11-04T10:00:00Z", "2026-11-04T11:00:00Z"), // 14:00
    ev("running", "2026-11-04T06:30:00Z", "2026-11-04T07:00:00Z"), // 10:30, running now
    ev("tomorrow", "2026-11-05T06:00:00Z", "2026-11-05T07:00:00Z"),
  ];
  const tickets = [t({ key: "LATE-1", due: "2026-11-02" }), t({ key: "DUE-1", due: TODAY }), t({ key: "DUE-2", due: TODAY })];

  it("orders late, meetings, then due today, with tags", () => {
    const items = todayItems(tickets, events, now, TODAY);
    expect(items.map((i) => [i.time, i.tag])).toEqual([
      ["Late", "now"],
      ["10:30", "now"],
      ["11:00", "soon"],
      ["14:00", "later"],
      ["Due", "soon"],
      ["Due", "later"],
    ]);
    expect(items[2].join).toBe("https://meet.google.com/x");
    expect(items[0].href).toBe("/t/LATE-1");
  });
});

describe("clients and load", () => {
  it("reports monthly report status", () => {
    expect(reportStatus(null, TODAY)).toEqual({ label: "Not sent", tone: "warn" });
    expect(reportStatus({ status: "done", due: "2026-11-02", doneOn: "2026-11-02" }, TODAY)).toEqual({ label: "Sent 2 Nov", tone: "ok" });
    expect(reportStatus({ status: "todo", due: "2026-11-07", doneOn: null }, TODAY)).toEqual({ label: "Due 7 Nov", tone: "warn" });
    expect(reportStatus({ status: "todo", due: "2026-11-02", doneOn: null }, TODAY)).toEqual({ label: "2 days late", tone: "danger" });
  });

  it("tones the load bar", () => {
    expect(loadBar(16, 14)).toEqual({ pct: 100, tone: "danger" });
    expect(loadBar(12, 14)).toEqual({ pct: 86, tone: "warn" });
    expect(loadBar(3, 6)).toEqual({ pct: 50, tone: null });
  });
});

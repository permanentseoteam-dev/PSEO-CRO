import { describe, expect, it } from "vitest";
import {
  attendanceMonth,
  attendanceStats,
  buildWeekGrid,
  checkLeave,
  checkLogEntry,
  clockedByDay,
  expiryInfo,
  inScope,
  fmtMinutes,
  fmtRange,
  leaveSummary,
  localDate,
  localTime,
  notifMatrix,
  parseDuration,
  resolveBillable,
  underLogged,
  weekStart,
  workingDays,
} from "../logic";
import type { Entry, LeaveRequest, Session } from "../types";

const entry = (over: Partial<Entry>): Entry => ({
  id: "e", memberId: "m", ticketId: "t1", ticketKey: "CPD-147", ticketTitle: "Report", clientId: "c", date: "2026-11-02", minutes: 60, billable: true, ...over,
});
const session = (inAt: string, outAt: string | null, over: Partial<Session> = {}): Session => ({
  id: inAt, clockIn: inAt, clockOut: outAt, breakMinutes: 0, breakStartedAt: null, wfh: false, ...over,
});
const req = (over: Partial<LeaveRequest>): LeaveRequest => ({
  id: "r", memberId: "m", type: "annual", start: "2026-08-10", end: "2026-08-14", halfDay: false, days: 5, minutes: null, reason: null, status: "approved", decidedBy: null, ...over,
});

describe("dates", () => {
  it("finds the Monday of a week", () => {
    expect(weekStart("2026-11-04")).toBe("2026-11-02");
    expect(weekStart("2026-11-08")).toBe("2026-11-02");
    expect(weekStart("2026-11-02")).toBe("2026-11-02");
  });
  it("converts instants to Dubai time", () => {
    expect(localDate("2026-11-03T21:30:00Z")).toBe("2026-11-04");
    expect(localTime("2026-11-04T04:56:00Z")).toBe("08:56");
  });
  it("formats ranges", () => {
    expect(fmtRange("2026-12-22", "2026-12-24")).toBe("22–24 Dec 2026");
    expect(fmtRange("2026-10-15", "2026-10-15")).toBe("15 Oct 2026");
    expect(fmtRange("2026-10-26", "2026-11-01")).toBe("26 Oct – 1 Nov 2026");
  });
});

describe("durations", () => {
  it("parses and formats", () => {
    expect(parseDuration("1h 30m")).toBe(90);
    expect(parseDuration("1.5h")).toBe(90);
    expect(parseDuration("1:30")).toBe(90);
    expect(parseDuration("45")).toBe(45);
    expect(parseDuration("")).toBe(0);
    expect(parseDuration("soon")).toBeNull();
    expect(fmtMinutes(95)).toBe("1h 35m");
    expect(fmtMinutes(120)).toBe("2h");
    expect(fmtMinutes(30)).toBe("30m");
  });
});

describe("manual entry rules", () => {
  it("allows today without a note", () => expect(checkLogEntry("2026-11-04", "", "2026-11-04")).toBeNull());
  it("needs a note for past days", () => expect(checkLogEntry("2026-11-03", " ", "2026-11-04")).toMatch(/note/));
  it("allows 7 days back, not 8", () => {
    expect(checkLogEntry("2026-10-28", "x", "2026-11-04")).toBeNull();
    expect(checkLogEntry("2026-10-27", "x", "2026-11-04")).toMatch(/7 days/);
  });
  it("blocks future days", () => expect(checkLogEntry("2026-11-05", "", "2026-11-04")).toMatch(/ahead/));
  it("auto billable follows the client", () => {
    expect(resolveBillable("auto", true)).toBe(true);
    expect(resolveBillable("auto", false)).toBe(false);
    expect(resolveBillable("no", true)).toBe(false);
  });
});

describe("week grid", () => {
  it("groups by ticket and totals days", () => {
    const g = buildWeekGrid(
      [
        entry({ minutes: 95 }),
        entry({ date: "2026-11-03", minutes: 40 }),
        entry({ ticketId: null, ticketKey: null, ticketTitle: null, minutes: 45, billable: false }),
        entry({ ticketId: "t2", ticketKey: "ALB-88", date: "2026-11-04", minutes: 45 }),
        entry({ date: "2026-11-10", minutes: 999 }),
      ],
      "2026-11-02",
    );
    expect(g.rows.map((r) => r.key)).toEqual(["ALB-88", "CPD-147", null]);
    expect(g.rows[2].title).toBe("No ticket");
    expect(g.dayTotals.slice(0, 3)).toEqual([140, 40, 45]);
    expect(g.total).toBe(225);
    expect(g.billable).toBe(180);
  });
});

describe("clocked time", () => {
  it("takes breaks out and counts open sessions to now", () => {
    const now = new Date("2026-11-04T09:00:00Z");
    const c = clockedByDay(
      [
        session("2026-11-02T04:52:00Z", "2026-11-02T14:12:00Z", { breakMinutes: 40 }),
        session("2026-11-04T04:56:00Z", null),
      ],
      now,
    );
    expect(c["2026-11-02"]).toBe(520);
    expect(c["2026-11-04"]).toBe(244);
  });
  it("flags logged under half of clocked", () => {
    expect(underLogged(1140, 2400)).toBe(true);
    expect(underLogged(1200, 2400)).toBe(false);
    expect(underLogged(0, 0)).toBe(false);
  });
});

describe("attendance month", () => {
  it("marks late, weekends and absences", () => {
    const now = new Date("2026-11-04T10:00:00Z");
    const days = attendanceMonth(
      [session("2026-10-01T05:20:00Z", "2026-10-01T14:00:00Z"), session("2026-10-02T04:55:00Z", "2026-10-02T14:00:00Z", { wfh: true })],
      [req({ type: "sick", start: "2026-10-05", end: "2026-10-05", days: 1 })],
      "2026-10",
      now,
    );
    expect(days[0]).toMatchObject({ inTime: "09:20", late: true });
    expect(days[1]).toMatchObject({ inTime: "08:55", late: false, wfh: true });
    expect(days[2].off).toBe(true);
    expect(days[2].absent).toBeNull();
    expect(days[4].absent).toBe("Sick");
    expect(days[5].absent).toBe("Absent");
    const s = attendanceStats(days);
    expect(s.worked).toBe(2);
    expect(s.late).toBe(1);
    expect(s.punctuality).toBe(50);
    expect(s.sick).toBe(1);
  });
});

describe("leave", () => {
  it("counts working days and half days", () => {
    expect(workingDays("2026-12-22", "2026-12-24", false)).toBe(3);
    expect(workingDays("2026-11-06", "2026-11-09", false)).toBe(2);
    expect(workingDays("2026-06-02", "2026-06-02", true)).toBe(0.5);
  });
  it("summarises balances", () => {
    const s = leaveSummary(
      [
        { type: "annual", allowance: 22, per: "year" },
        { type: "wfh", allowance: 4, per: "month" },
      ],
      [req({}), req({ start: "2026-06-02", end: "2026-06-02", halfDay: true, days: 0.5 }), req({ status: "pending", days: 3 }), req({ type: "wfh", start: "2026-11-03", end: "2026-11-03", days: 1 }), req({ type: "wfh", start: "2026-10-03", end: "2026-10-03", days: 1 })],
      "2026-11-04",
    );
    expect(s.find((b) => b.type === "annual")).toMatchObject({ used: 5.5, left: 16.5 });
    expect(s.find((b) => b.type === "wfh")).toMatchObject({ used: 1, left: 3 });
    expect(s.find((b) => b.type === "unpaid")).toMatchObject({ used: 0, allowance: 0 });
  });
  it("needs 7 days' notice for annual leave", () => {
    expect(checkLeave("annual", "2026-11-08", "2026-11-09", "2026-11-04")).toMatch(/notice/);
    expect(checkLeave("annual", "2026-11-16", "2026-11-17", "2026-11-04")).toBeNull();
    expect(checkLeave("sick", "2026-11-04", "2026-11-04", "2026-11-04")).toBeNull();
  });
});

describe("documents and settings", () => {
  it("warns on expiry inside 60 days", () => {
    expect(expiryInfo("2026-12-20", "2026-11-04")).toEqual({ label: "20 Dec 2026 · 46 days", warn: true });
    expect(expiryInfo("2031-05-14", "2026-11-04")?.warn).toBe(false);
    expect(expiryInfo(null, "2026-11-04")).toBeNull();
  });
  it("merges saved notification prefs over defaults", () => {
    const m = notifMatrix([{ event: "mention", in_app: false, email: true, phone: false }]);
    expect(m.find((r) => r.event === "mention")).toMatchObject({ inApp: false, email: true, phone: false });
    expect(m.find((r) => r.event === "assigned")).toMatchObject({ inApp: true, email: true, phone: true });
  });
});

describe("scope", () => {
  const me = { id: "a", departmentId: "d1" };
  it("limits people by scope", () => {
    expect(inScope({ id: "b", managerId: "a", departmentId: "d2" }, me, "team")).toBe(true);
    expect(inScope({ id: "c", managerId: null, departmentId: "d1" }, me, "team")).toBe(true);
    expect(inScope({ id: "d", managerId: null, departmentId: "d2" }, me, "team")).toBe(false);
    expect(inScope({ id: "d", managerId: null, departmentId: "d2" }, me, "all")).toBe(true);
    expect(inScope({ id: "a", managerId: null, departmentId: "d1" }, me, "own")).toBe(true);
  });
});

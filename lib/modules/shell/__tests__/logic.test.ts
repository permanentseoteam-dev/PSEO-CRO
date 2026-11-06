import { describe, expect, it } from "vitest";
import { STAFF_NAV } from "@/lib/nav";
import {
  activeHref, fmtClock, fmtMinutes, LONG_SESSION_MIN, minutesWithin, nextTheme, openSession, pageFor, parseTags, runningMinutes,
  sinceLabel, timeAgo, timerMinutes, todaySessions, visibleNav, WORKDAY_MIN, workedMinutes,
} from "../logic";

describe("pageFor", () => {
  it("uses nav titles, overrides and detail routes", () => {
    expect(pageFor("/tickets").title).toBe("Task");
    expect(pageFor("/clients").title).toBe("Clients");
    expect(pageFor("/finance").title).toBe("Finance");
    expect(pageFor("/finance/invoices").title).toBe("Invoices");
    expect(pageFor("/finance/invoices/abc").title).toBe("Invoice");
    expect(pageFor("/t/CPD-142").title).toBe("Ticket");
    expect(pageFor("/clients/c1").title).toBe("Client");
    expect(pageFor("/people/org").title).toBe("Org chart");
    expect(pageFor("/portal/files").title).toBe("Files");
    expect(pageFor("/tickets/").desc).toMatch(/list or a board/);
  });
  it("falls back for unknown paths", () => {
    expect(pageFor("/nowhere")).toEqual({ title: "Permanent SEO", desc: "" });
  });
});

describe("activeHref", () => {
  const hrefs = ["/finance", "/finance/invoices", "/people", "/people/org"];
  it("picks the longest matching prefix", () => {
    expect(activeHref("/finance/invoices/123", hrefs)).toBe("/finance/invoices");
    expect(activeHref("/finance", hrefs)).toBe("/finance");
    expect(activeHref("/people/org", hrefs)).toBe("/people/org");
    expect(activeHref("/financex", hrefs)).toBeNull();
  });
});

describe("visibleNav", () => {
  it("hides items without permission and drops empty groups", () => {
    const groups = visibleNav(STAFF_NAV, { perms: {} });
    const names = groups.map((g) => g.name);
    expect(names).not.toContain("Finance");
    expect(groups.find((g) => g.name === "Core")?.items.map((i) => i.href)).toEqual(["/home", "/my"]);
    const fin = visibleNav(STAFF_NAV, { perms: { "finance.invoices.view": "own" } }).find((g) => g.name === "Finance");
    expect(fin?.items.map((i) => i.href)).toEqual(["/finance/invoices"]);
  });
});

describe("clock maths", () => {
  const now = new Date(2026, 10, 4, 14, 43);
  const at = (h: number, m: number, day = 4) => new Date(2026, 10, day, h, m).toISOString();
  it("sums today's sessions with an open one counting to now", () => {
    const sessions = [
      { clockIn: at(9, 2), clockOut: at(12, 0) },
      { clockIn: at(12, 30), clockOut: null },
      { clockIn: at(9, 0, 3), clockOut: at(17, 0, 3) },
    ];
    const today = todaySessions(sessions, now);
    expect(today).toHaveLength(2);
    expect(workedMinutes(today, now)).toBe(178 + 133);
  });
  it("formats minutes and clocks", () => {
    expect(fmtMinutes(341)).toBe("5h 41m");
    expect(fmtMinutes(45)).toBe("45m");
    expect(fmtClock(23 * 60 + 10)).toBe("00:23:10");
    expect(fmtClock(-5)).toBe("00:00:00");
  });
});

describe("overnight clock sessions", () => {
  const at = (day: number, h: number, m: number) => new Date(2026, 10, day, h, m).toISOString();
  const dayStart = new Date(2026, 10, 5);
  const dayEnd = new Date(2026, 10, 6);

  it("clips a session at local midnight", () => {
    const s = { clockIn: at(4, 8, 56), clockOut: at(5, 10, 21) };
    expect(minutesWithin(s, dayStart, dayEnd, new Date(2026, 10, 5, 12, 0))).toBe(10 * 60 + 21);
    expect(minutesWithin(s, new Date(2026, 10, 4), dayStart, new Date(2026, 10, 5, 12, 0))).toBe(15 * 60 + 4);
    expect(minutesWithin(s, new Date(2026, 10, 6), new Date(2026, 10, 7), new Date(2026, 10, 6, 12, 0))).toBe(0);
  });

  it("keeps an open session from yesterday and counts only today's part", () => {
    const now = new Date(2026, 10, 6, 8, 0);
    const sessions = [{ clockIn: at(4, 8, 56), clockOut: at(5, 10, 21) }, { clockIn: at(5, 18, 0), clockOut: null }];
    const today = todaySessions(sessions, now);
    expect(today).toEqual([sessions[1]]);
    expect(workedMinutes(today, now)).toBe(8 * 60);
    const open = openSession(sessions)!;
    expect(open).toBe(sessions[1]);
    expect(runningMinutes(open, now)).toBe(14 * 60);
    expect(sinceLabel(open.clockIn, now)).toBe("yesterday 18:00");
  });

  it("labels older and same-day starts", () => {
    const now = new Date(2026, 10, 6, 8, 0); // Friday
    expect(sinceLabel(at(6, 0, 11), now)).toBe("00:11");
    expect(sinceLabel(at(3, 18, 0), now)).toBe("Tue 18:00");
    expect(sinceLabel(new Date(2026, 9, 20, 18, 0).toISOString(), now)).toBe("20 Oct 18:00");
  });

  it("sums several sessions, including one that ended this morning", () => {
    const now = new Date(2026, 10, 5, 15, 0);
    const sessions = [
      { clockIn: at(4, 8, 56), clockOut: at(5, 10, 21) },
      { clockIn: at(5, 11, 0), clockOut: at(5, 12, 30) },
      { clockIn: at(5, 13, 0), clockOut: null },
    ];
    const today = todaySessions(sessions, now);
    expect(today).toHaveLength(3);
    expect(workedMinutes(today, now)).toBe(621 + 90 + 120);
  });

  it("flags open sessions of 12h or more", () => {
    const s = { clockIn: at(5, 18, 0), clockOut: null };
    expect(runningMinutes(s, new Date(2026, 10, 6, 5, 59)) >= LONG_SESSION_MIN).toBe(false);
    expect(runningMinutes(s, new Date(2026, 10, 6, 6, 0)) >= LONG_SESSION_MIN).toBe(true);
  });

  it("supports a custom workday length", () => {
    expect(WORKDAY_MIN).toBe(480);
    const workday = 7 * 60 + 30;
    const now = new Date(2026, 10, 5, 15, 10);
    const worked = workedMinutes([{ clockIn: at(5, 9, 0), clockOut: null }], now);
    expect(`${fmtMinutes(worked)} of ${fmtMinutes(workday)}`).toBe("6h 10m of 7h 30m");
    expect(Math.round((worked / workday) * 100)).toBe(82);
  });
});

describe("timerMinutes", () => {
  it("logs whole minutes and nothing under 1 minute", () => {
    const start = "2026-11-04T10:00:00.000Z";
    expect(timerMinutes(start, new Date("2026-11-04T10:00:59.000Z"))).toBe(0);
    expect(timerMinutes(start, new Date("2026-11-04T10:01:00.000Z"))).toBe(1);
    expect(timerMinutes(start, new Date("2026-11-04T10:23:10.000Z"))).toBe(23);
  });
});

describe("timeAgo", () => {
  const now = new Date(2026, 10, 4, 14, 44);
  it("reads like the mockup", () => {
    expect(timeAgo(new Date(2026, 10, 4, 14, 44, 20).toISOString(), now)).toBe("Just now");
    expect(timeAgo(new Date(2026, 10, 4, 14, 38).toISOString(), now)).toBe("6 min ago");
    expect(timeAgo(new Date(2026, 10, 4, 12, 30).toISOString(), now)).toBe("2 h ago");
    expect(timeAgo(new Date(2026, 10, 3, 16, 0).toISOString(), now)).toBe("Yesterday");
    expect(timeAgo(new Date(2026, 10, 1, 9, 0).toISOString(), now)).toBe("1 Nov");
  });
});

describe("small helpers", () => {
  it("cycles theme system > light > dark > system", () => {
    expect(nextTheme("system")).toBe("light");
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBe("system");
  });
  it("parses tags", () => {
    expect(parseTags(" Technical, on-page,,technical ")).toEqual(["technical", "on-page"]);
  });
});

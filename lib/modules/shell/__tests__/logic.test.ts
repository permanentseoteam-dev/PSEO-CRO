import { describe, expect, it } from "vitest";
import { STAFF_NAV } from "@/lib/nav";
import {
  activeHref, fmtClock, fmtMinutes, nextTheme, pageFor, parseTags, timeAgo, timerMinutes, todaySessions, visibleNav, workedMinutes,
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

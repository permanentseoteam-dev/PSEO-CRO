import { describe, expect, it } from "vitest";
import { addWorkingHours, byOwner, healthScore, matches, NO_FILTER, weekStart, windowStatus, type HealthInput } from "../logic";

const base: HealthInput = {
  status: "active",
  startDate: "2025-02-01",
  today: "2026-11-04",
  overdueTickets: 0,
  lastContact: "2026-11-04",
  openWaits: 0,
  overdueInvoices: 0,
  openEscalations: [],
};

describe("healthScore", () => {
  it("is 100 and healthy with nothing wrong", () => {
    expect(healthScore(base)).toMatchObject({ score: 100, band: "healthy" });
  });

  it("matches the Alba Motors example (61, watch)", () => {
    const h = healthScore({ ...base, overdueTickets: 2, lastContact: "2026-11-03", openWaits: 2, overdueInvoices: 1, openEscalations: ["high", "medium"] });
    expect(h.score).toBe(61);
    expect(h.band).toBe("watch");
    expect(h.factors.map((f) => f.points)).toEqual([-12, 0, -8, -10, -9]);
  });

  it("caps each factor and never goes below 0", () => {
    const h = healthScore({ ...base, overdueTickets: 50, lastContact: null, openWaits: 50, overdueInvoices: 50, openEscalations: ["critical", "critical", "critical"] });
    expect(h.factors.map((f) => f.points)).toEqual([-30, -20, -20, -20, -20]);
    expect(h.score).toBe(0);
    expect(h.band).toBe("at_risk");
  });

  it("uses band edges 75 and 50", () => {
    expect(healthScore({ ...base, overdueInvoices: 2, openWaits: 1, lastContact: "2026-11-03" }).band).toBe("healthy"); // 76
    expect(healthScore({ ...base, overdueTickets: 5 }).band).toBe("watch"); // 70
    expect(healthScore({ ...base, overdueTickets: 5, overdueInvoices: 2 }).score).toBe(50);
    expect(healthScore({ ...base, overdueTickets: 5, overdueInvoices: 2, openEscalations: ["low"] }).band).toBe("at_risk");
  });

  it("is New for the first 30 days and No data when not active", () => {
    expect(healthScore({ ...base, startDate: "2026-10-20", status: "onboarding" })).toEqual({ score: null, band: "new", factors: [] });
    expect(healthScore({ ...base, status: "paused" }).band).toBe("no_data");
    expect(healthScore({ ...base, status: "churned" }).score).toBeNull();
  });
});

describe("addWorkingHours (Mon-Fri 09:00-18:00 Dubai)", () => {
  it("stays within the same day", () => {
    expect(addWorkingHours(new Date("2026-10-29T10:00:00+04:00"), 2).toISOString()).toBe(new Date("2026-10-29T12:00:00+04:00").toISOString());
  });
  it("rolls over the evening and the weekend", () => {
    // Fri 30 Oct 2026 15:00 + 8h = 3h Friday + 5h Monday -> Mon 2 Nov 14:00
    expect(addWorkingHours(new Date("2026-10-30T15:00:00+04:00"), 8).toISOString()).toBe(new Date("2026-11-02T14:00:00+04:00").toISOString());
  });
  it("starts at 09:00 when opened outside hours", () => {
    // Sat 31 Oct 2026 -> Monday 09:00 + 2h
    expect(addWorkingHours(new Date("2026-10-31T22:00:00+04:00"), 2).toISOString()).toBe(new Date("2026-11-02T11:00:00+04:00").toISOString());
  });
  it("handles 24 working hours across days", () => {
    // Tue 3 Nov 15:00: 3h Tue, 9h Wed, 9h Thu, 3h Fri -> Fri 6 Nov 12:00
    expect(addWorkingHours(new Date("2026-11-03T15:00:00+04:00"), 24).toISOString()).toBe(new Date("2026-11-06T12:00:00+04:00").toISOString());
  });
});

describe("windowStatus", () => {
  const now = new Date("2026-11-04T10:00:00+04:00");
  it("flags a passed window", () => {
    expect(windowStatus({ severity: "high", dueAt: "2026-10-31T18:00:00+04:00", closedAt: null }, now)).toMatchObject({ past: true, text: "8 working hours · passed" });
  });
  it("shows hours left", () => {
    expect(windowStatus({ severity: "medium", dueAt: "2026-11-04T19:00:00+04:00", closedAt: null }, now).text).toBe("24 working hours · 9h left");
  });
  it("says met or missed once closed", () => {
    expect(windowStatus({ severity: "low", dueAt: "2026-09-23T11:00:00+04:00", closedAt: "2026-09-14T16:00:00+04:00" }, now).text).toContain("met");
    expect(windowStatus({ severity: "low", dueAt: "2026-09-23T11:00:00+04:00", closedAt: "2026-09-24T16:00:00+04:00" }, now).text).toContain("missed");
  });
});

describe("portfolio helpers", () => {
  const c = { id: "1", name: "Alba Motors", status: "active", band: "watch" as const, ownerName: "Sara Malik", services: ["PPC", "Social"] };
  it("filters by band, owner, service, status and search", () => {
    expect(matches(c, NO_FILTER)).toBe(true);
    expect(matches(c, { ...NO_FILTER, band: "watch", owner: "Sara Malik", service: "PPC", status: "Active", q: "alba" })).toBe(true);
    expect(matches(c, { ...NO_FILTER, band: "at_risk" })).toBe(false);
    expect(matches(c, { ...NO_FILTER, service: "SEO" })).toBe(false);
    expect(matches({ ...c, status: "churned" }, { ...NO_FILTER, status: "Ended" })).toBe(true);
  });

  it("groups by owner and sums fees per currency", () => {
    const rows = byOwner([
      { ownerName: "Sara Malik", band: "watch", escalations: 2, fee: 14000, currency: "AED" },
      { ownerName: "Sara Malik", band: "healthy", escalations: 0, fee: 3000, currency: "USD" },
      { ownerName: "Sara Malik", band: "healthy", escalations: 0, fee: 1000, currency: "USD" },
      { ownerName: "Hamza Qureshi", band: "new", escalations: 0, fee: null, currency: "AED" },
    ]);
    expect(rows.map((r) => r.owner)).toEqual(["Hamza Qureshi", "Sara Malik"]);
    expect(rows[1]).toMatchObject({ clients: 3, healthy: 2, watch: 1, escalations: 2, fees: [{ currency: "AED", amount: 14000 }, { currency: "USD", amount: 4000 }] });
    expect(rows[0]).toMatchObject({ newOrNoData: 1, fees: [] });
  });

  it("finds Monday of the week", () => {
    expect(weekStart("2026-11-04")).toBe("2026-11-02");
    expect(weekStart("2026-11-08")).toBe("2026-11-02");
    expect(weekStart("2026-11-02")).toBe("2026-11-02");
  });
});

describe("formats", () => {
  it("formats days and meetings in Dubai time", async () => {
    const { fmtDay, fmtMeeting, fmtMonth } = await import("../logic");
    expect(fmtDay("2026-11-03", "2026")).toBe("3 Nov");
    expect(fmtDay("2025-12-14", "2026")).toBe("14 Dec 2025");
    expect(fmtMeeting("2026-11-05T10:30:00Z")).toBe("Thu 5 Nov, 14:30");
    expect(fmtMonth("2025-02-01")).toBe("Feb 2025");
  });
});

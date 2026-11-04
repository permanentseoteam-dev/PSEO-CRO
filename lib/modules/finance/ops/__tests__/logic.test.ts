import { describe, expect, it } from "vitest";
import {
  allocateOldestFirst,
  allocationError,
  byService,
  computeProfitability,
  currentStage,
  firstName,
  groupReminders,
  leftOver,
  looksDuplicate,
  monthRange,
  monthlyAgreedFee,
  shiftMonth,
  stageDates,
  type ReminderLike,
} from "../logic";

describe("allocateOldestFirst", () => {
  const open = [
    { id: "b", due: "2026-11-15", balance: 5975 },
    { id: "a", due: "2026-10-15", balance: 8700 },
  ];

  it("pays the oldest due invoice first", () => {
    const r = allocateOldestFirst(10000, open);
    expect(r.allocations).toEqual([
      { invoiceId: "a", amount: 8700 },
      { invoiceId: "b", amount: 1300 },
    ]);
    expect(r.credit).toBe(0);
  });

  it("turns money left over into credit", () => {
    const r = allocateOldestFirst(15000, open);
    expect(r.allocations.map((a) => a.amount)).toEqual([8700, 5975]);
    expect(r.credit).toBe(325);
  });

  it("skips unticked invoices", () => {
    const r = allocateOldestFirst(3000, open, new Set(["a"]));
    expect(r.allocations).toEqual([
      { invoiceId: "a", amount: 0 },
      { invoiceId: "b", amount: 3000 },
    ]);
  });

  it("is all credit with no open invoices, and handles cents", () => {
    expect(allocateOldestFirst(250, []).credit).toBe(250);
    const r = allocateOldestFirst(100.1, [{ id: "x", due: "2026-01-01", balance: 33.37 }]);
    expect(r.credit).toBe(66.73);
  });

  it("checks manual allocations", () => {
    expect(leftOver(100, [{ invoiceId: "a", amount: 60 }])).toBe(40);
    expect(allocationError(100, [{ invoiceId: "a", amount: 120 }], open)).toBe("You applied more than was received.");
    expect(allocationError(10000, [{ invoiceId: "b", amount: 6000 }], open)).toMatch(/more than that invoice/);
    expect(allocationError(0, [], open)).toMatch(/amount/);
    expect(allocationError(500, [{ invoiceId: "a", amount: 500 }], open)).toBeNull();
  });
});

describe("looksDuplicate", () => {
  const rc = [{ clientId: "c1", amount: 4000, date: "2026-11-03", status: "recorded" }];
  it("flags the same amount from the same client within 14 days", () => {
    expect(looksDuplicate(rc, "c1", 4000, "2026-11-04")).toBe(true);
    expect(looksDuplicate(rc, "c1", 4000, "2026-11-20")).toBe(false);
    expect(looksDuplicate(rc, "c2", 4000, "2026-11-04")).toBe(false);
    expect(looksDuplicate([{ ...rc[0], status: "void" }], "c1", 4000, "2026-11-04")).toBe(false);
  });
});

describe("reminder stages", () => {
  it("dates each stage from the due date", () => {
    expect(stageDates("2026-11-07")).toEqual({
      before: "2026-11-04",
      late_1: "2026-11-08",
      late_7: "2026-11-14",
      late_14: "2026-11-21",
      late_30: "2026-12-07",
    });
    expect(stageDates("2026-10-05").late_30).toBe("2026-11-04");
  });

  it("finds the latest stage already due", () => {
    expect(currentStage("2026-11-30", "2026-11-04")).toBeNull();
    expect(currentStage("2026-11-07", "2026-11-04")).toBe("before");
    expect(currentStage("2026-10-21", "2026-11-04")).toBe("late_14");
    expect(currentStage("2026-10-21", "2026-11-04", ["before", "late_1", "late_7"])).toBe("late_7");
  });

  it("groups rows into due today, paused, upcoming and recent", () => {
    const row = (p: Partial<ReminderLike> & { id: string }): ReminderLike & { id: string } => ({
      invoiceId: "i1",
      stage: "before",
      sendOn: "2026-11-04",
      status: "pending",
      pausedUntil: null,
      sentAt: null,
      ...p,
    });
    const rows = [
      row({ id: "1", invoiceId: "i1", stage: "before", sendOn: "2026-11-04" }),
      row({ id: "2", invoiceId: "i1", stage: "late_1", sendOn: "2026-11-08" }),
      row({ id: "3", invoiceId: "i2", stage: "late_14", sendOn: "2026-10-31", pausedUntil: "2026-11-20" }),
      row({ id: "4", invoiceId: "i2", stage: "late_30", sendOn: "2026-11-16", pausedUntil: "2026-11-20" }),
      row({ id: "5", invoiceId: "i3", stage: "late_7", sendOn: "2026-10-28", status: "sent", sentAt: "2026-10-28T06:00:00Z" }),
      row({ id: "6", invoiceId: "i3", stage: "late_14", sendOn: "2026-11-04" }),
      row({ id: "7", invoiceId: "i4", stage: "late_30", sendOn: "2026-08-07", pausedUntil: "2026-11-01" }),
    ];
    const g = groupReminders(rows, "2026-11-04");
    expect(g.today.map((r) => r.id)).toEqual(["7", "6", "1"]); // a pause that ended counts as due again
    expect(g.paused.map((r) => r.id)).toEqual(["3"]);
    expect(g.upcoming.map((r) => r.id)).toEqual(["2"]);
    expect(g.recent.map((r) => r.id)).toEqual(["5"]);
  });

  it("greets by first name", () => {
    expect(firstName("Dr. Rania Aziz")).toBe("Rania");
    expect(firstName("Khalid Mansour")).toBe("Khalid");
    expect(firstName(null)).toBe("there");
  });
});

describe("profitability", () => {
  const base = {
    workingHours: 160,
    members: [
      { id: "omar", name: "Omar", department: "SEO", salary: 3200 }, // 20 an hour
      { id: "sara", name: "Sara", department: "Client Success", salary: 1600 }, // 10 an hour
      { id: "bilal", name: "Bilal", department: "Finance", salary: 2600 },
    ],
    team: [
      { clientId: "c1", memberId: "omar" },
      { clientId: "c1", memberId: "sara" },
      { clientId: "c2", memberId: "sara" },
    ],
    clients: [
      { id: "c1", name: "Cedar", services: ["SEO", "Content"], invoiced: 5000, agreedFee: 4000, hoursBudget: 60 },
      { id: "c2", name: "Alba", services: ["PPC"], invoiced: null, agreedFee: 3000, hoursBudget: null },
    ],
  };

  it("splits logged and estimated cost and puts non-client roles in overhead", () => {
    const entries = [
      { memberId: "omar", clientId: "c1", minutes: 60 * 40 }, // 40 h on c1 = 800
      { memberId: "omar", clientId: "c2", minutes: 60 * 40 }, // 40 h on c2 = 800
      { memberId: "omar", clientId: null, minutes: 60 * 20 }, // internal
    ];
    const r = computeProfitability({ ...base, entries });
    const c1 = r.clients.find((c) => c.id === "c1")!;
    const c2 = r.clients.find((c) => c.id === "c2")!;
    // Omar: logged 1600, rest 1600 split by logged hours 50/50. Sara logged nothing: 1600 split evenly over c1, c2.
    expect(c1.logged).toBe(800);
    expect(c1.estimated).toBe(800 + 800);
    expect(c2.logged).toBe(800);
    expect(c2.estimated).toBe(800 + 800);
    expect(c1.fee).toBe(5000);
    expect(c1.basis).toBe("Invoiced");
    expect(c2.fee).toBe(3000);
    expect(c2.basis).toBe("Agreed fee");
    expect(c1.hours).toBe(40);
    expect(r.totals.overhead).toBe(2600);
    expect(r.totals.cost).toBe(4800);
    expect(r.totals.salaries).toBe(7400);
    expect(r.totals.after).toBe(8000 - 4800 - 2600);
    expect(r.totals.agreedFeeUsed).toBe(true);

    const seo = r.depts.find((d) => d.department === "SEO")!;
    expect(seo.hours).toBe(100);
    expect(seo.onClients).toBeCloseTo(0.8);
    expect(seo.toClients).toBe(3200);
    expect(seo.overhead).toBe(0);
    expect(r.depts.find((d) => d.department === "Finance")!.overhead).toBe(2600);
  });

  it("charges logged time beyond the salary in full", () => {
    const r = computeProfitability({ ...base, entries: [{ memberId: "omar", clientId: "c1", minutes: 60 * 200 }] });
    expect(r.clients.find((c) => c.id === "c1")!.logged).toBe(4000);
  });

  it("splits by service evenly", () => {
    const r = computeProfitability({ ...base, entries: [] });
    const s = byService(r.clients);
    expect(s.find((x) => x.service === "SEO")!.fee).toBe(2500);
    expect(s.find((x) => x.service === "PPC")!.fee).toBe(3000);
  });

  it("turns agreed fees into a month", () => {
    expect(monthlyAgreedFee(1000, "monthly", 0)).toBe(1000);
    expect(monthlyAgreedFee(1200, "weekly", 0)).toBe(5200);
    expect(monthlyAgreedFee(50, "hourly", 12)).toBe(600);
    expect(monthlyAgreedFee(3000, "one_time", 10)).toBe(0);
  });

  it("moves between months", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-11", 1)).toBe("2026-12");
    expect(monthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });
});

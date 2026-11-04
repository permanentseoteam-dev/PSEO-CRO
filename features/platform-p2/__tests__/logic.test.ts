import { describe, expect, it } from "vitest";
import {
  balancesByCurrency,
  bearerKey,
  checklistProgress,
  inboxCounts,
  matchCall,
  money,
  monthBounds,
  overdueByPerson,
  pipelineOpen,
  pulse,
  syncLabel,
  visibleAnnouncements,
  workdaysElapsed,
} from "../logic";
import { generateApiKey, hashApiKey, prefixOf } from "../api-keys";

describe("dates", () => {
  it("month bounds cross the year", () => {
    expect(monthBounds("2026-11-04")).toEqual({ start: "2026-11-01", prevStart: "2026-10-01", nextStart: "2026-12-01" });
    expect(monthBounds("2026-01-15")).toEqual({ start: "2026-01-01", prevStart: "2025-12-01", nextStart: "2026-02-01" });
  });
  it("counts Mon-Fri from the 1st", () => {
    // Nov 2026: 1st is a Sunday; 2, 3, 4 are Mon-Wed.
    expect(workdaysElapsed("2026-11-04")).toBe(3);
    expect(workdaysElapsed("2026-11-01")).toBe(0);
  });
  it("sync label", () => {
    const now = new Date("2026-11-04T10:40:00Z");
    expect(syncLabel(null, now)).toBe("Never");
    expect(syncLabel("2026-11-04T10:39:40Z", now)).toBe("Just now");
    expect(syncLabel("2026-11-04T10:28:00Z", now)).toBe("12 min ago");
    expect(syncLabel("2026-11-04T07:40:00Z", now)).toBe("3 h ago");
    expect(syncLabel("2026-11-02T09:05:00Z", now)).toBe("2 Nov 09:05");
  });
});

describe("announcements", () => {
  it("drops expired, keeps expiry day, pinned first then newest", () => {
    const rows = [
      { id: "a", pinned: false, expires_on: null, created_at: "2026-11-03T10:00:00Z" },
      { id: "b", pinned: true, expires_on: "2026-12-04", created_at: "2026-11-02T10:00:00Z" },
      { id: "c", pinned: true, expires_on: "2026-11-03", created_at: "2026-11-04T10:00:00Z" },
      { id: "d", pinned: false, expires_on: "2026-11-04", created_at: "2026-11-04T08:00:00Z" },
    ];
    expect(visibleAnnouncements(rows, "2026-11-04").map((r) => r.id)).toEqual(["b", "d", "a"]);
  });
});

describe("getting started", () => {
  it("progress ignores unknown steps", () => {
    expect(checklistProgress(["photo", "calendar", "nope"])).toEqual({ count: 2, total: 6, pct: 33, complete: false });
    expect(checklistProgress(["photo", "calendar", "hours", "channel", "push", "first_hour"]).complete).toBe(true);
  });
});

describe("overdue by person", () => {
  it("groups past-due tickets, most overdue first", () => {
    const rows = overdueByPerson(
      [
        { assignee_id: "omar", due_date: "2026-11-01" },
        { assignee_id: "omar", due_date: "2026-10-28" },
        { assignee_id: "priya", due_date: "2026-10-20" },
        { assignee_id: null, due_date: "2026-11-03" },
        { assignee_id: "priya", due_date: "2026-11-04" }, // due today is not overdue
      ],
      "2026-11-04",
    );
    expect(rows).toEqual([
      { memberId: "omar", count: 2, oldest: "2026-10-28" },
      { memberId: "priya", count: 1, oldest: "2026-10-20" },
      { memberId: null, count: 1, oldest: "2026-11-03" },
    ]);
  });
});

describe("finance & accounts", () => {
  it("outstanding and overdue per currency, open statuses only", () => {
    const { rows, overdueCount } = balancesByCurrency(
      [
        { currency: "USD", total: 4200, amount_paid: 0, due_on: "2026-10-20", status: "issued" },
        { currency: "AED", total: 30000, amount_paid: 1500.5, due_on: "2026-11-20", status: "partly_paid" },
        { currency: "AED", total: 14000, amount_paid: 0, due_on: "2026-10-30", status: "disputed" },
        { currency: "AED", total: 999, amount_paid: 0, due_on: "2026-10-01", status: "draft" },
        { currency: "PKR", total: 1000, amount_paid: 1000, due_on: "2026-10-01", status: "issued" },
      ],
      "2026-11-04",
    );
    expect(rows).toEqual([
      { currency: "AED", outstanding: 42499.5, overdue: 14000 },
      { currency: "USD", outstanding: 4200, overdue: 4200 },
    ]);
    expect(overdueCount).toBe(2);
  });
});

describe("CEO pulse", () => {
  it("revenue change, clients, at risk and utilisation", () => {
    const p = pulse(
      {
        invoicesThisMonth: [{ currency: "AED", total: 108000 }, { currency: "USD", total: 500 }],
        invoicesLastMonth: [{ currency: "AED", total: 100000 }],
        clients: [
          { name: "Luma Skincare", status: "active", created_at: "2025-02-01T00:00:00Z", health_score: 44, health_band: "at_risk" },
          { name: "Harbor Legal", status: "active", created_at: "2025-02-01T00:00:00Z", health_score: 48, health_band: "at_risk" },
          { name: "Nova Fitness", status: "active", created_at: "2026-11-02T00:00:00Z", health_score: null, health_band: "new" },
          { name: "Old Co", status: "churned", created_at: "2024-01-01T00:00:00Z", health_score: 10, health_band: "at_risk" },
        ],
        loggedMinutes: 10 * 3 * 8 * 60 * 0.78,
        staffCount: 10,
        workdaysElapsed: 3,
      },
      "2026-11-01",
    );
    expect(p.revenue).toBe(108000);
    expect(p.changePct).toBe(8);
    expect(p.others).toEqual([["USD", 500]]);
    expect(p.activeClients).toBe(3);
    expect(p.newThisMonth).toBe(1);
    expect(p.atRisk).toBe(2);
    expect(p.lowest?.name).toBe("Luma Skincare");
    expect(p.utilisationPct).toBe(78);
  });
  it("no last month and no staff", () => {
    const p = pulse({ invoicesThisMonth: [], invoicesLastMonth: [], clients: [], loggedMinutes: 50, staffCount: 0, workdaysElapsed: 0 }, "2026-11-01");
    expect(p.changePct).toBeNull();
    expect(p.utilisationPct).toBe(0);
  });
});

describe("pipeline", () => {
  it("open value excludes won and lost", () => {
    expect(
      pipelineOpen([
        { stage: "proposal", value: 18000, currency: "AED" },
        { stage: "negotiation", value: 22500, currency: "AED" },
        { stage: "won", value: 8500, currency: "AED" },
        { stage: "discovery", value: 3000, currency: "USD" },
      ]),
    ).toEqual({ AED: 40500, USD: 3000 });
  });
});

describe("API keys", () => {
  it("generates a key whose prefix and hash match", () => {
    const k = generateApiKey();
    expect(k.key).toMatch(/^pk_[a-z0-9]{6}_[A-Za-z0-9_-]{43}$/);
    expect(prefixOf(k.key)).toBe(k.prefix);
    expect(k.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashApiKey(k.key)).toBe(k.hash);
    expect(generateApiKey().key).not.toBe(k.key);
  });
  it("reads the bearer header", () => {
    const { key } = generateApiKey();
    expect(bearerKey(`Bearer ${key}`)).toBe(key);
    expect(bearerKey(key)).toBeNull();
    expect(bearerKey("Bearer sk_live_123")).toBeNull();
    expect(bearerKey(null)).toBeNull();
  });
});

describe("Fireflies matching", () => {
  const clients = [
    { id: "alba", name: "Alba Motors", emails: ["rania@albamotors.ae"], domains: ["albamotors.ae"] },
    { id: "luma", name: "Luma Skincare", emails: [], domains: ["lumaskin.com"] },
    { id: "cedar", name: "Cedar & Pine Dental", emails: [], domains: [] },
  ];
  const ours = ["permanentseo.ae"];
  it("email beats domain beats title", () => {
    expect(matchCall({ title: "Luma catch-up", participants: ["Rania@AlbaMotors.ae"] }, clients, ours)).toEqual({ clientId: "alba", method: "email" });
    expect(matchCall({ title: "x", participants: ["sara@permanentseo.ae", "dina@lumaskin.com"] }, clients, ours)).toEqual({ clientId: "luma", method: "domain" });
    expect(matchCall({ title: "Cedar & Pine Dental: monthly", participants: ["sara@permanentseo.ae"] }, clients, ours)).toEqual({ clientId: "cedar", method: "title" });
  });
  it("ignores our own and free-mail domains, and partial words", () => {
    const withGmail = [...clients, { id: "g", name: "Gee", emails: [], domains: ["gmail.com", "permanentseo.ae"] }];
    expect(matchCall({ title: "Albanian market", participants: ["x@gmail.com", "y@permanentseo.ae"] }, withGmail, ours)).toEqual({ clientId: null, method: "none" });
  });
});

describe("inbox counts and money", () => {
  it("counts each outcome", () => {
    expect(inboxCounts([{ outcome: "new_ticket" }, { outcome: "from_us" }, { outcome: "from_us" }])).toEqual({
      new_ticket: 1,
      added_to_ticket: 0,
      not_client: 0,
      automatic: 0,
      from_us: 2,
    });
  });
  it("formats money", () => {
    expect(money(42500, "AED")).toBe("AED 42,500");
    expect(money(1500.5, "USD")).toBe("USD 1,500.50");
    expect(money(450000.4, "PKR")).toBe("PKR 450,000");
  });
});

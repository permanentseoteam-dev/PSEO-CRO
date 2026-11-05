import { describe, expect, it } from "vitest";
import {
  buildEmailPrompt,
  deleteCheck,
  DROP_POINTS,
  endedLine,
  hasOpenAlert,
  hoursUsage,
  isEnded,
  nameMatches,
  renewalDate,
  renewalReminder,
  sentimentLine,
  sparkPoints,
  suggestChurnTriggers,
  termLabel,
} from "../logic";

describe("terms", () => {
  it("renewal is start + term unless set", () => {
    expect(renewalDate({ renewal_on: null, start_date: "2025-02-01", term_months: 12 })).toBe("2026-02-01");
    expect(renewalDate({ renewal_on: "2027-02-01", start_date: "2025-02-01", term_months: 12 })).toBe("2027-02-01");
    expect(renewalDate({ renewal_on: null, start_date: null, term_months: 12 })).toBeNull();
  });
  it("reminder is two months before renewal", () => {
    expect(renewalReminder("2027-02-01")).toBe("2026-12-01");
  });
  it("term label", () => {
    expect(termLabel({ term_months: 12, start_date: "2025-02-01" })).toBe("12 months, from 1 Feb 2025");
    expect(termLabel({ term_months: null, start_date: null })).toBe("Rolling");
  });
  it("hours bar warns at 80% and flags 100%", () => {
    expect(hoursUsage(50, 60)).toEqual({ pct: 83, tone: "warn", note: "Past 80% of the monthly hours budget" });
    expect(hoursUsage(30, 60).tone).toBe("ok");
    expect(hoursUsage(60, 60).tone).toBe("danger");
    expect(hoursUsage(47.9, 60).tone).toBe("ok");
    expect(hoursUsage(5, 0).tone).toBe("muted");
  });
});

describe("health", () => {
  it("sentiment line with trend", () => {
    expect(sentimentLine([])).toBe("Sentiment: not recorded");
    expect(sentimentLine([{ sentiment: "neutral" }, { sentiment: "positive" }])).toBe("Sentiment: neutral, trending down");
    expect(sentimentLine([{ sentiment: "positive" }, { sentiment: "neutral" }])).toBe("Sentiment: positive, trending up");
    expect(sentimentLine([{ sentiment: "neutral" }])).toBe("Sentiment: neutral");
  });
  it("suggests risk, drop and sentiment triggers", () => {
    expect(
      suggestChurnTriggers({
        healthScore: 45,
        prevHealthScore: 70,
        sentiments: [{ sentiment: "neutral" }, { sentiment: "positive" }],
        alerts: [],
      }),
    ).toEqual(["risk", "drop", "sentiment"]);
  });
  it("skips triggers that already have an open alert, and healthy clients", () => {
    expect(
      suggestChurnTriggers({ healthScore: 40, prevHealthScore: null, sentiments: [{ sentiment: "negative" }], alerts: [{ trigger_kind: "risk", outcome: "open" }] }),
    ).toEqual(["sentiment"]);
    expect(
      suggestChurnTriggers({ healthScore: 40, prevHealthScore: null, sentiments: [], alerts: [{ trigger_kind: "risk", outcome: "saved" }] }),
    ).toEqual(["risk"]);
    expect(suggestChurnTriggers({ healthScore: 80, prevHealthScore: 85, sentiments: [{ sentiment: "positive" }], alerts: [] })).toEqual([]);
  });
});

describe("win-back", () => {
  it("ended statuses", () => {
    expect(isEnded("churned")).toBe(true);
    expect(isEnded("terminated")).toBe(true);
    expect(isEnded("paused")).toBe(false);
  });
  it("ended line", () => {
    expect(endedLine({ ended_on: "2026-06-30", end_reason: "Budget cut after Q2", monthly_fee: 7500, currency: "AED" })).toBe(
      "Ended 30 Jun 2026 · Budget cut after Q2 · was AED 7,500/month",
    );
    expect(endedLine({ ended_on: null, end_reason: null, monthly_fee: null, currency: null })).toBe("Ended");
  });
});

describe("delete client", () => {
  it("name must match exactly, ignoring outer and doubled spaces", () => {
    expect(nameMatches("Alba Motors", "Alba Motors")).toBe(true);
    expect(nameMatches("  Alba  Motors ", "Alba Motors")).toBe(true);
    expect(nameMatches("alba motors", "Alba Motors")).toBe(false);
    expect(nameMatches("Alba", "Alba Motors")).toBe(false);
    expect(nameMatches("", "")).toBe(false);
  });
  it("invoices turn a delete into an archive; the rest is listed", () => {
    expect(deleteCheck({ tickets: 3, files: 1, logins: 0, invoices: 0 })).toEqual({
      allowed: true,
      blockers: [],
      removes: ["3 tickets", "1 file"],
    });
    const blocked = deleteCheck({ tickets: 0, files: 0, logins: 2, invoices: 1 });
    expect(blocked.allowed).toBe(false);
    expect(blocked.blockers[0]).toMatch(/^1 invoice in Finance/);
    expect(blocked.blockers[0]).toMatch(/archived instead/);
  });
});

describe("AI email prompt", () => {
  it("carries the tone and only the typed facts", () => {
    const p = buildEmailPrompt({
      tone: "Brief",
      clientName: "Alba Motors",
      contactName: "Rania Youssef",
      senderName: "Sara Malik",
      subject: "October results",
      points: "  142 leads, up 18%.  ",
    });
    expect(p.system).toContain("Three sentences at most");
    expect(p.system).toContain("Never invent numbers");
    expect(p.user).toContain("Client: Alba Motors");
    expect(p.user).toContain("To: Rania Youssef");
    expect(p.user.endsWith("142 leads, up 18%.")).toBe(true);
  });
});

describe("health drop alerts", () => {
  const base = { sentiments: [], alerts: [] as { trigger_kind: "risk" | "drop" | "sentiment" | "not_renewing" | "nps"; outcome: "open" | "saved" | "reduced_scope" | "lost" }[] };

  it("drop fires at 15 points, not 14", () => {
    expect(suggestChurnTriggers({ ...base, healthScore: 60, prevHealthScore: 75 })).toContain("drop");
    expect(suggestChurnTriggers({ ...base, healthScore: 61, prevHealthScore: 75 })).not.toContain("drop");
    expect(DROP_POINTS).toBe(15);
  });

  it("no drop without a previous score or when the score rose", () => {
    expect(suggestChurnTriggers({ ...base, healthScore: 60, prevHealthScore: null })).toEqual([]);
    expect(suggestChurnTriggers({ ...base, healthScore: 90, prevHealthScore: 60 })).toEqual([]);
  });

  it("suppresses a drop when an open drop alert exists, not when it is closed", () => {
    const open = [{ trigger_kind: "drop" as const, outcome: "open" as const }];
    const closed = [{ trigger_kind: "drop" as const, outcome: "saved" as const }];
    expect(suggestChurnTriggers({ ...base, healthScore: 55, prevHealthScore: 80, alerts: open })).toEqual([]);
    expect(suggestChurnTriggers({ ...base, healthScore: 55, prevHealthScore: 80, alerts: closed })).toEqual(["drop"]);
    expect(hasOpenAlert(open, "drop")).toBe(true);
    expect(hasOpenAlert(open, "risk")).toBe(false);
    expect(hasOpenAlert(closed, "drop")).toBe(false);
  });

  it("sparkline maps 0-100 to the box, oldest on the left", () => {
    expect(sparkPoints([], 100, 40)).toBe("");
    expect(sparkPoints([100, 0], 100, 40, 0)).toBe("0.0,0.0 100.0,40.0");
    expect(sparkPoints([50], 100, 40, 0)).toBe("0.0,20.0");
  });
});

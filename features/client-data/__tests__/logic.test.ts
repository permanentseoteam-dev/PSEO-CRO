import { describe, expect, it } from "vitest";
import {
  allSources,
  budgetPacing,
  changePct,
  checkSubAccountLink,
  daysBetween,
  leadsByChannel,
  leadStats,
  leadsToCsv,
  positionChange,
  seoSummary,
  snapshot28,
  visibleDataTabs,
} from "../logic";
import type { AdCampaign, Lead, MetricDay } from "../types";

const lead = (p: Partial<Lead>): Lead => ({
  id: "x",
  receivedAt: "2026-11-03T10:00:00Z",
  name: "Test",
  email: null,
  phone: null,
  source: "website_form",
  interest: null,
  outcome: "new",
  firstContactAt: null,
  value: null,
  currency: null,
  ...p,
});

const campaign = (p: Partial<AdCampaign>): AdCampaign => ({
  id: "c",
  platform: "google_ads",
  name: "C",
  status: "running",
  currency: "AED",
  spend28d: 0,
  clicks28d: 0,
  leads28d: 0,
  spendMtd: 0,
  leadsMtd: 0,
  ...p,
});

describe("dates", () => {
  it("counts days between ISO dates across months", () => {
    expect(daysBetween("2026-10-31", "2026-11-03")).toBe(3);
    expect(daysBetween("2026-11-03", "2026-11-03")).toBe(0);
  });
});

describe("snapshot28", () => {
  const asOf = "2026-11-03";
  const day = (ago: number) => new Date(Date.UTC(2026, 10, 3) - ago * 86_400_000).toISOString().slice(0, 10);
  const rows: MetricDay[] = [];
  for (let i = 0; i < 56; i++) {
    const current = i < 28;
    rows.push({ source: "ga4", metric: "sessions", day: day(i), value: current ? 10 : 8, currency: null });
    rows.push({ source: "ga4", metric: "leads", day: day(i), value: current ? 2 : 1, currency: null });
    rows.push({ source: "google_ads", metric: "ad_spend", day: day(i), value: 100, currency: "AED" });
  }
  // Outside both windows: ignored.
  rows.push({ source: "ga4", metric: "sessions", day: day(56), value: 9999, currency: null });
  rows.push({ source: "ga4", metric: "sessions", day: "2026-11-04", value: 9999, currency: null });

  const { rows: out, currency } = snapshot28(rows, asOf);
  const get = (k: string) => out.find((r) => r.key === k)!;

  it("sums the last 28 days and the prior 28", () => {
    expect(get("sessions").current).toBe(280);
    expect(get("sessions").prior).toBe(224);
    expect(get("sessions").changePct).toBeCloseTo(25);
    expect(get("sessions").good).toBe(true);
  });

  it("derives cost per lead and treats a drop as good", () => {
    expect(get("cost_per_lead").current).toBe(50);
    expect(get("cost_per_lead").prior).toBe(100);
    expect(get("cost_per_lead").good).toBe(true);
    expect(get("cost_per_lead").money).toBe(true);
    expect(currency).toBe("AED");
  });

  it("returns null for metrics with no data", () => {
    expect(get("gbp_calls").current).toBeNull();
    expect(get("gbp_calls").changePct).toBeNull();
    expect(get("gbp_calls").good).toBeNull();
  });
});

describe("changePct", () => {
  it("is null when there is nothing to compare against", () => {
    expect(changePct(5, 0)).toBeNull();
    expect(changePct(90, 100)).toBeCloseTo(-10);
  });
});

describe("budgetPacing", () => {
  it("is on pace when spend tracks time", () => {
    const p = budgetPacing(4920, 40000, "2026-11-04");
    expect(p.daysInMonth).toBe(30);
    expect(p.spentPct).toBeCloseTo(12.3, 1);
    expect(p.pace).toBe("on");
  });
  it("flags spending ahead and behind", () => {
    expect(budgetPacing(20000, 40000, "2026-11-04").pace).toBe("ahead");
    expect(budgetPacing(0, 40000, "2026-11-20").pace).toBe("behind");
  });
  it("handles a zero budget", () => {
    expect(budgetPacing(100, 0, "2026-02-01").spentPct).toBe(0);
  });
});

describe("leadStats", () => {
  const now = "2026-11-04T12:00:00Z";
  const leads = [
    lead({ receivedAt: "2026-11-04T09:00:00Z", firstContactAt: "2026-11-04T09:30:00Z", outcome: "contacted" }),
    lead({ receivedAt: "2026-11-03T09:00:00Z", firstContactAt: "2026-11-03T12:00:00Z", outcome: "booked" }),
    lead({ receivedAt: "2026-11-01T09:00:00Z", firstContactAt: "2026-11-01T09:10:00Z", outcome: "won", value: 100000, currency: "AED" }),
    lead({ receivedAt: "2026-10-30T09:00:00Z", outcome: "not_lead" }),
    lead({ receivedAt: "2026-09-01T09:00:00Z", outcome: "won", value: 5 }), // older than 28 days
  ];
  const s = leadStats(leads, now);
  it("counts the last 28 days only", () => {
    expect(s.total).toBe(4);
    expect(s.won).toBe(1);
    expect(s.wonValue).toBe(100000);
    expect(s.wonCurrency).toBe("AED");
  });
  it("counts won as booked and excludes non-leads from the 1-hour rate", () => {
    expect(s.booked).toBe(2);
    expect(s.contactedFastPct).toBeCloseTo((2 / 3) * 100);
  });
  it("has no rate without leads", () => {
    expect(leadStats([], now).contactedFastPct).toBeNull();
  });
});

describe("leadsByChannel", () => {
  it("groups, shares and prices paid channels", () => {
    const now = "2026-11-04T12:00:00Z";
    const leads = [
      lead({ source: "google_ads" }),
      lead({ source: "google_ads" }),
      lead({ source: "google_ads" }),
      lead({ source: "website_form" }),
      lead({ source: "website_form", outcome: "not_lead" }),
    ];
    const out = leadsByChannel(leads, [campaign({ spend28d: 600 }), campaign({ platform: "meta_ads", spend28d: 999 })], now);
    expect(out.map((c) => c.source)).toEqual(["google_ads", "website_form"]);
    expect(out[0].sharePct).toBe(75);
    expect(out[0].cpl).toBe(200);
    expect(out[0].currency).toBe("AED");
    expect(out[1].cpl).toBeNull();
  });
});

describe("leadsToCsv", () => {
  it("writes a header and quotes awkward cells", () => {
    const csv = leadsToCsv([lead({ name: 'Ann "A", B', interest: "SUV", outcome: "won", value: 10, currency: "AED" })]);
    const [head, row] = csv.split("\n");
    expect(head).toBe("Received,Name,Email,Phone,Source,Interest,Outcome,Value,Currency");
    expect(row).toBe('2026-11-03T10:00:00Z,"Ann ""A"", B",,,Website form,SUV,Won,10,AED');
  });
});

describe("seo", () => {
  const q = [
    { query: "a", position: 1, priorPosition: 1, clicks: 10, impressions: 100 },
    { query: "b", position: 20, priorPosition: 15, clicks: 1, impressions: 300 },
    { query: "c", position: 9.5, priorPosition: null, clicks: 2, impressions: 0 },
  ];
  it("counts top 10 and weights the average by impressions", () => {
    const s = seoSummary(q);
    expect(s.top10).toBe(2);
    expect(s.avgPosition).toBeCloseTo((1 * 100 + 20 * 300) / 400);
    expect(seoSummary([]).avgPosition).toBeNull();
  });
  it("treats a smaller position as a gain", () => {
    expect(positionChange(q[1])).toBe(-5);
    expect(positionChange(q[2])).toBeNull();
  });
});

describe("checkSubAccountLink", () => {
  const links = [{ parentClientId: "P", childClientId: "C" }];
  it("allows a fresh one-level link", () => {
    expect(checkSubAccountLink("P", "D", links)).toBeNull();
  });
  it("blocks self, double links and nesting", () => {
    expect(checkSubAccountLink("P", "P", links)).toMatch(/own sub-account/);
    expect(checkSubAccountLink("X", "C", links)).toMatch(/already a sub-account/);
    expect(checkSubAccountLink("X", "P", links)).toMatch(/has its own sub-accounts/);
    expect(checkSubAccountLink("C", "D", links)).toMatch(/itself a sub-account/);
  });
});

describe("tabs and sources", () => {
  it("shows Ads only for PPC clients or when campaigns exist", () => {
    expect(visibleDataTabs({ services: ["SEO"], hasCampaigns: false }).map((t) => t.value)).not.toContain("ads");
    expect(visibleDataTabs({ services: ["ppc"], hasCampaigns: false }).map((t) => t.value)).toContain("ads");
    expect(visibleDataTabs({ services: [], hasCampaigns: true }).map((t) => t.value)).toContain("ads");
  });
  it("lists every source, filling gaps as not connected", () => {
    const out = allSources([{ source: "ga4", status: "connected", accountLabel: "x", lastRefreshAt: null, lastError: null }]);
    expect(out.map((s) => s.source)).toEqual(["gsc", "ga4", "gbp", "google_ads", "meta_ads"]);
    expect(out[0].status).toBe("not_connected");
    expect(out[1].status).toBe("connected");
  });
});

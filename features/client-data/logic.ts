// Pure logic for the client data tabs. No I/O.
import type { Tone } from "@/components/ui/tone";
import type {
  AdCampaign,
  CampaignStatus,
  Currency,
  DataSourceRow,
  Lead,
  LeadOutcome,
  LeadSource,
  Metric,
  MetricDay,
  SeoQuery,
  Source,
  SourceStatus,
  SubAccount,
} from "./types";
import { SOURCES } from "./types";

// ---------------------------------------------------------------- labels

export const SOURCE_LABEL: Record<Source, string> = {
  gsc: "Google Search Console",
  ga4: "GA4",
  gbp: "Google Business Profile",
  google_ads: "Google Ads",
  meta_ads: "Meta Ads",
};

export const SOURCE_STATUS: Record<SourceStatus, { label: string; tone: Tone }> = {
  not_connected: { label: "Not connected", tone: "muted" },
  connected: { label: "Connected", tone: "ok" },
  refreshing: { label: "Refreshing", tone: "blue" },
  error: { label: "Needs attention", tone: "danger" },
};

export const LEAD_OUTCOME_LABEL: Record<LeadOutcome, string> = {
  new: "New",
  contacted: "Contacted",
  booked: "Appointment booked",
  won: "Won",
  lost: "Lost",
  not_lead: "Not a sales lead",
};

export const LEAD_SOURCE_LABEL: Record<LeadSource, string> = {
  google_ads: "Google Ads",
  meta_lead_form: "Meta lead form",
  website_form: "Website form",
  whatsapp: "WhatsApp",
  phone: "Phone call",
  gbp: "Google Business Profile",
  other: "Other",
};

export const CAMPAIGN_STATUS: Record<CampaignStatus, { label: string; tone: Tone }> = {
  running: { label: "Running", tone: "ok" },
  learning: { label: "Learning", tone: "blue" },
  fatigued: { label: "Fatigued", tone: "warn" },
  paused: { label: "Paused", tone: "muted" },
  ended: { label: "Ended", tone: "muted" },
};

// ---------------------------------------------------------------- tabs

export const CLIENT_DATA_TABS = [
  { value: "accounts", label: "Accounts & projects" },
  { value: "perf", label: "Performance" },
  { value: "analysis", label: "Analysis" },
  { value: "ads", label: "Ads" },
  { value: "leads", label: "Leads" },
  { value: "web", label: "Website" },
  { value: "seo", label: "SEO" },
] as const;
export type ClientDataTab = (typeof CLIENT_DATA_TABS)[number]["value"];

/** Ads shows only for clients with PPC (or campaigns already synced). Everything else always shows. */
export function visibleDataTabs(input: { services: string[]; hasCampaigns: boolean }) {
  const ppc = input.services.some((s) => s.toLowerCase() === "ppc");
  return CLIENT_DATA_TABS.filter((t) => t.value !== "ads" || ppc || input.hasCampaigns);
}

// ---------------------------------------------------------------- data sources

/** Always one row per source, in a fixed order; missing rows are "not connected". */
export function allSources(rows: DataSourceRow[]): DataSourceRow[] {
  return SOURCES.map(
    (source) =>
      rows.find((r) => r.source === source) ?? { source, status: "not_connected", accountLabel: null, lastRefreshAt: null, lastError: null },
  );
}

// ---------------------------------------------------------------- dates

const DAY = 86_400_000;
const toDay = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));

/** Days from a to b (b - a), both "YYYY-MM-DD". */
export function daysBetween(a: string, b: string) {
  return Math.round((toDay(b) - toDay(a)) / DAY);
}

// ---------------------------------------------------------------- 28 vs prior 28

export type SnapshotMetric = Metric | "cost_per_lead";

export const SNAPSHOT_ROWS: { key: SnapshotMetric; label: string; money?: boolean; lowerIsBetter?: boolean }[] = [
  { key: "sessions", label: "Sessions" },
  { key: "organic_clicks", label: "Organic clicks" },
  { key: "leads", label: "Leads" },
  { key: "gbp_calls", label: "Calls from Google Business Profile" },
  { key: "ad_spend", label: "Ad spend", money: true },
  { key: "cost_per_lead", label: "Cost per lead", money: true, lowerIsBetter: true },
];

export type SnapshotRow = {
  key: SnapshotMetric;
  label: string;
  current: number | null;
  prior: number | null;
  changePct: number | null;
  good: boolean | null;
  money: boolean;
};

export function changePct(current: number, prior: number): number | null {
  if (!prior) return null;
  return ((current - prior) / prior) * 100;
}

/**
 * Sum each metric over the 28 days ending `asOf` (inclusive) and the 28 days before that.
 * Metrics with no data in either window come back as null so the UI can show a dash.
 * Cost per lead = ad spend ÷ leads.
 */
export function snapshot28(days: MetricDay[], asOf: string): { rows: SnapshotRow[]; currency: Currency | null } {
  const cur = new Map<Metric, number>();
  const pri = new Map<Metric, number>();
  let currency: Currency | null = null;
  for (const d of days) {
    const ago = daysBetween(d.day, asOf);
    if (ago < 0 || ago >= 56) continue;
    const bucket = ago < 28 ? cur : pri;
    bucket.set(d.metric, (bucket.get(d.metric) ?? 0) + d.value);
    if (d.currency && !currency) currency = d.currency;
  }
  const get = (m: Map<Metric, number>, k: Metric) => (m.has(k) ? m.get(k)! : null);
  const cpl = (m: Map<Metric, number>) => {
    const spend = get(m, "ad_spend");
    const leads = get(m, "leads");
    return spend != null && leads ? spend / leads : null;
  };

  const rows = SNAPSHOT_ROWS.map((r) => {
    const current = r.key === "cost_per_lead" ? cpl(cur) : get(cur, r.key);
    const prior = r.key === "cost_per_lead" ? cpl(pri) : get(pri, r.key);
    const pct = current != null && prior != null ? changePct(current, prior) : null;
    const good = pct == null || pct === 0 ? null : r.lowerIsBetter ? pct < 0 : pct > 0;
    return { key: r.key, label: r.label, current, prior, changePct: pct, good, money: !!r.money };
  });
  return { rows, currency };
}

// ---------------------------------------------------------------- ads

export function costPerLead(spend: number, leads: number): number | null {
  return leads > 0 ? spend / leads : null;
}

/**
 * Budget pacing for the month of `today`: share of budget spent vs share of the month gone.
 * "ahead" when spend runs more than 10 points ahead of time, "behind" when more than 10 points behind.
 */
export function budgetPacing(spendMtd: number, budget: number, today: string) {
  const y = +today.slice(0, 4);
  const m = +today.slice(5, 7);
  const dayOfMonth = +today.slice(8, 10);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const spentPct = budget > 0 ? (spendMtd / budget) * 100 : 0;
  const timePct = (dayOfMonth / daysInMonth) * 100;
  const pace: "on" | "ahead" | "behind" = spentPct > timePct + 10 ? "ahead" : spentPct < timePct - 10 ? "behind" : "on";
  return { spentPct, timePct, dayOfMonth, daysInMonth, pace };
}

export function adTotals(campaigns: AdCampaign[]) {
  const spendMtd = campaigns.reduce((s, c) => s + c.spendMtd, 0);
  const leadsMtd = campaigns.reduce((s, c) => s + c.leadsMtd, 0);
  return { spendMtd, leadsMtd, cplMtd: costPerLead(spendMtd, leadsMtd) };
}

// ---------------------------------------------------------------- leads

/** Lead stats over the 28 days ending `now`. "Contacted within 1 hour" counts leads with a first contact time. */
export function leadStats(leads: Lead[], now: string) {
  const end = Date.parse(now);
  const recent = leads.filter((l) => {
    const t = Date.parse(l.receivedAt);
    return t <= end && end - t < 28 * DAY;
  });
  const fast = recent.filter((l) => l.firstContactAt && Date.parse(l.firstContactAt) - Date.parse(l.receivedAt) <= 3_600_000);
  const won = recent.filter((l) => l.outcome === "won");
  const real = recent.filter((l) => l.outcome !== "not_lead");
  return {
    total: recent.length,
    contactedFastPct: real.length ? (fast.length / real.length) * 100 : null,
    booked: recent.filter((l) => l.outcome === "booked" || l.outcome === "won").length,
    won: won.length,
    wonValue: won.reduce((s, l) => s + (l.value ?? 0), 0),
    wonCurrency: won.find((l) => l.currency)?.currency ?? null,
  };
}

const PAID_PLATFORM: Partial<Record<LeadSource, AdCampaign["platform"]>> = { google_ads: "google_ads", meta_lead_form: "meta_ads" };

/** Leads in the 28 days ending `now`, grouped by source, biggest first. Paid sources get cost per lead from 28-day campaign spend. */
export function leadsByChannel(leads: Lead[], campaigns: AdCampaign[], now: string) {
  const end = Date.parse(now);
  const counts = new Map<LeadSource, number>();
  for (const l of leads) {
    const t = Date.parse(l.receivedAt);
    if (t > end || end - t >= 28 * DAY || l.outcome === "not_lead") continue;
    counts.set(l.source, (counts.get(l.source) ?? 0) + 1);
  }
  const total = [...counts.values()].reduce((s, n) => s + n, 0);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([source, count]) => {
      const platform = PAID_PLATFORM[source];
      const spend = platform ? campaigns.filter((c) => c.platform === platform).reduce((s, c) => s + c.spend28d, 0) : null;
      return {
        source,
        label: LEAD_SOURCE_LABEL[source],
        count,
        sharePct: total ? (count / total) * 100 : 0,
        cpl: spend != null ? costPerLead(spend, count) : null,
        currency: platform ? (campaigns.find((c) => c.platform === platform)?.currency ?? null) : null,
      };
    });
}

const csvCell =(v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function leadsToCsv(leads: Lead[]): string {
  const head = ["Received", "Name", "Email", "Phone", "Source", "Interest", "Outcome", "Value", "Currency"];
  const lines = leads.map((l) =>
    [
      l.receivedAt,
      l.name,
      l.email ?? "",
      l.phone ?? "",
      LEAD_SOURCE_LABEL[l.source],
      l.interest ?? "",
      LEAD_OUTCOME_LABEL[l.outcome],
      l.value == null ? "" : String(l.value),
      l.currency ?? "",
    ]
      .map(csvCell)
      .join(","),
  );
  return [head.join(","), ...lines].join("\n");
}

// ---------------------------------------------------------------- SEO

/** Keywords in the top 10 and impression-weighted average position. */
export function seoSummary(queries: SeoQuery[]) {
  const impressions = queries.reduce((s, q) => s + q.impressions, 0);
  const avgPosition = impressions ? queries.reduce((s, q) => s + q.position * q.impressions, 0) / impressions : null;
  return { top10: queries.filter((q) => q.position <= 10).length, avgPosition };
}

/** Positive = moved up (a smaller position number is better). */
export function positionChange(q: SeoQuery): number | null {
  return q.priorPosition == null ? null : q.priorPosition - q.position;
}

// ---------------------------------------------------------------- sub-accounts

/**
 * One level only: a sub-account can't be the parent itself, can't already belong to someone,
 * and a parent that is itself a sub-account can't take sub-accounts.
 */
export function checkSubAccountLink(parentId: string, childId: string, links: Pick<SubAccount, "parentClientId" | "childClientId">[]): string | null {
  if (parentId === childId) return "A client can't be its own sub-account.";
  if (links.some((l) => l.childClientId === childId)) return "That client is already a sub-account.";
  if (links.some((l) => l.parentClientId === childId)) return "That client has its own sub-accounts.";
  if (links.some((l) => l.childClientId === parentId)) return "This client is itself a sub-account.";
  return null;
}

// ---------------------------------------------------------------- formatting

export function formatNumber(n: number, digits = 0) {
  return n.toLocaleString("en-GB", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function formatMoney(n: number, currency: Currency | null) {
  return `${currency ?? ""} ${formatNumber(Math.round(n))}`.trim();
}

export function formatPct(n: number, signed = false) {
  const s = `${formatNumber(Math.abs(n), 1)}%`;
  if (!signed) return s;
  return n > 0 ? `+${s}` : n < 0 ? `-${s}` : s;
}

/** First day of the month for a "YYYY-MM-DD" date. */
export function monthStart(day: string) {
  return `${day.slice(0, 7)}-01`;
}

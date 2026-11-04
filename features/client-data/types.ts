// Row and view types for the client page data tabs (0202_client_data).

export const SOURCES = ["gsc", "ga4", "gbp", "google_ads", "meta_ads"] as const;
export type Source = (typeof SOURCES)[number];

export const SOURCE_STATUSES = ["not_connected", "connected", "refreshing", "error"] as const;
export type SourceStatus = (typeof SOURCE_STATUSES)[number];

export const METRICS = ["sessions", "organic_clicks", "impressions", "leads", "gbp_calls", "ad_spend", "ad_clicks", "ad_leads"] as const;
export type Metric = (typeof METRICS)[number];

export const CURRENCIES = ["AED", "USD", "PKR"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const LEAD_SOURCES = ["google_ads", "meta_lead_form", "website_form", "whatsapp", "phone", "gbp", "other"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_OUTCOMES = ["new", "contacted", "booked", "won", "lost", "not_lead"] as const;
export type LeadOutcome = (typeof LEAD_OUTCOMES)[number];

export const CAMPAIGN_STATUSES = ["running", "learning", "fatigued", "paused", "ended"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export type SubAccount = {
  id: string;
  parentClientId: string;
  childClientId: string;
  childName: string;
  billing: "parent" | "own";
};

export type ClientProject = { id: string; key: string; name: string };

export type DataSourceRow = {
  source: Source;
  status: SourceStatus;
  accountLabel: string | null;
  lastRefreshAt: string | null;
  lastError: string | null;
};

export type MetricDay = { source: Source; metric: Metric; day: string; value: number; currency: Currency | null };

export type Analysis = { period: string; whatChanged: string[]; why: string[]; nextSteps: string[] };

export type AdCampaign = {
  id: string;
  platform: "google_ads" | "meta_ads";
  name: string;
  status: CampaignStatus;
  currency: Currency;
  spend28d: number;
  clicks28d: number;
  leads28d: number;
  spendMtd: number;
  leadsMtd: number;
};

export type AdBudget = { month: string; amount: number; currency: Currency };

export type Lead = {
  id: string;
  receivedAt: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: LeadSource;
  interest: string | null;
  outcome: LeadOutcome;
  firstContactAt: string | null;
  value: number | null;
  currency: Currency | null;
};

export type Website = {
  url: string;
  platform: string | null;
  hosting: string | null;
  sslRenewsOn: string | null;
  domainRenewsOn: string | null;
  tracking: string[];
  uptime30d: number | null;
  mobileSpeed: number | null;
  lcpMs: number | null;
  formsTotal: number;
  formsWorking: number;
  formsTestedAt: string | null;
  lastBackupAt: string | null;
};

export type ChangeRequest = { key: string; title: string; status: "todo" | "in_progress" | "in_review" | "blocked" | "done" };

export type SeoQuery = {
  query: string;
  position: number;
  priorPosition: number | null;
  clicks: number;
  impressions: number;
};

export type ActionResult = { ok: true } | { ok: false; error: string };

// Data source adapters. Each source (GSC, GA4, GBP, Google Ads, Meta Ads) implements DataSourceAdapter.
// None is configured yet: they all return { ok: false, reason: "not_configured" } and make no API calls.
// When API access is added, replace the entry in ADAPTERS with a real implementation (server-only, tokens in Supabase Vault).
import type { AdCampaign, MetricDay, SeoQuery, Source } from "./types";
import { SOURCE_LABEL } from "./logic";

export type AdapterResult<T> = { ok: true; data: T } | { ok: false; reason: "not_configured" | "auth_expired" | "failed"; message: string };

export type DataSourceAdapter = {
  source: Source;
  configured: boolean;
  /** Start the OAuth flow for one client. Returns the URL to send the user to. */
  connect(input: { clientId: string; returnTo: string }): Promise<AdapterResult<{ authUrl: string }>>;
  /** Daily metric values between two dates (inclusive, "YYYY-MM-DD"). */
  fetchDaily(input: { externalId: string; from: string; to: string }): Promise<AdapterResult<Omit<MetricDay, "source">[]>>;
  /** Ads sources only: campaign rows with rolling totals. */
  fetchCampaigns?(input: { externalId: string; asOf: string }): Promise<AdapterResult<Omit<AdCampaign, "id">[]>>;
  /** GSC only: top queries for the last 28 days. */
  fetchQueries?(input: { externalId: string; asOf: string }): Promise<AdapterResult<SeoQuery[]>>;
  /** Revoke access on the provider side. */
  disconnect(input: { externalId: string }): Promise<AdapterResult<null>>;
};

function notConfigured(source: Source): DataSourceAdapter {
  const fail = async () =>
    ({
      ok: false,
      reason: "not_configured",
      message: `${SOURCE_LABEL[source]} isn't set up yet. Ask an admin to add API access.`,
    }) as const;
  return {
    source,
    configured: false,
    connect: fail,
    fetchDaily: fail,
    fetchCampaigns: source === "google_ads" || source === "meta_ads" ? fail : undefined,
    fetchQueries: source === "gsc" ? fail : undefined,
    // Nothing to revoke when there is no provider connection; the row is still cleared locally.
    disconnect: async () => ({ ok: true, data: null }),
  };
}

export const ADAPTERS: Record<Source, DataSourceAdapter> = {
  gsc: notConfigured("gsc"),
  ga4: notConfigured("ga4"),
  gbp: notConfigured("gbp"),
  google_ads: notConfigured("google_ads"),
  meta_ads: notConfigured("meta_ads"),
};

export function getAdapter(source: Source): DataSourceAdapter {
  return ADAPTERS[source];
}

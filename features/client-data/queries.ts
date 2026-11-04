import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  AdBudget,
  AdCampaign,
  Analysis,
  ChangeRequest,
  ClientProject,
  DataSourceRow,
  Lead,
  MetricDay,
  SeoQuery,
  SubAccount,
  Website,
} from "./types";

// Server reads for the client data tabs. All run as the signed-in user, so RLS decides what comes back.
// Phase 1 tables (clients, projects, tickets) are read with the column names from docs/PLAN.md;
// a read that fails returns an empty result instead of breaking the tab.

const num = (v: unknown) => (v == null ? 0 : Number(v));
const numOrNull = (v: unknown) => (v == null ? null : Number(v));

export type ClientBasics = { id: string; name: string; services: string[] };

export async function getClientBasics(clientId: string): Promise<ClientBasics | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("id, name, services").eq("id", clientId).maybeSingle();
  if (!data) return null;
  return { id: data.id, name: data.name, services: Array.isArray(data.services) ? data.services : [] };
}

/** Clients a sub-account can be picked from (everything the user can see, minus this one). */
export async function listClientOptions(excludeId: string): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("clients").select("id, name").neq("id", excludeId).order("name");
  return (data ?? []).map((c) => ({ id: c.id, name: c.name }));
}

export async function listSubAccounts(parentId: string): Promise<SubAccount[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_sub_accounts")
    .select("id, parent_client_id, child_client_id, billing, child:clients!client_sub_accounts_child_client_id_fkey(name)")
    .eq("parent_client_id", parentId)
    .order("created_at");
  return (data ?? []).map((r) => {
    const child = Array.isArray(r.child) ? r.child[0] : r.child;
    return {
      id: r.id,
      parentClientId: r.parent_client_id,
      childClientId: r.child_client_id,
      childName: (child as { name?: string } | null)?.name ?? "Unknown client",
      billing: r.billing,
    };
  });
}

/** Every link, for the one-level check when linking. */
export async function listAllSubAccountLinks(): Promise<Pick<SubAccount, "parentClientId" | "childClientId">[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("client_sub_accounts").select("parent_client_id, child_client_id");
  return (data ?? []).map((r) => ({ parentClientId: r.parent_client_id, childClientId: r.child_client_id }));
}

/** Projects for a set of clients (the parent and its sub-accounts). Reads 0107 `projects`. */
export async function listProjects(clientIds: string[]): Promise<(ClientProject & { clientId: string })[]> {
  if (!clientIds.length) return [];
  const supabase = await createClient();
  const { data, error } = await supabase.from("projects").select("id, key, name, client_id").in("client_id", clientIds).order("key");
  if (error) return [];
  return (data ?? []).map((p) => ({ id: p.id, key: p.key, name: p.name, clientId: p.client_id }));
}

export async function listDataSources(clientId: string): Promise<DataSourceRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_data_sources")
    .select("source, status, account_label, last_refresh_at, last_error")
    .eq("client_id", clientId);
  return (data ?? []).map((r) => ({
    source: r.source,
    status: r.status,
    accountLabel: r.account_label,
    lastRefreshAt: r.last_refresh_at,
    lastError: r.last_error,
  }));
}

/** Daily values for the 56 days ending `asOf` (enough for 28 vs prior 28). */
export async function listMetricDays(clientId: string, asOf: string): Promise<MetricDay[]> {
  const supabase = await createClient();
  const from = new Date(Date.parse(`${asOf}T00:00:00Z`) - 55 * 86_400_000).toISOString().slice(0, 10);
  const { data } = await supabase
    .from("client_metric_daily")
    .select("source, metric, day, value, currency")
    .eq("client_id", clientId)
    .gte("day", from)
    .lte("day", asOf)
    .limit(5000);
  return (data ?? []).map((r) => ({ source: r.source, metric: r.metric, day: r.day, value: num(r.value), currency: r.currency }));
}

export async function getLatestAnalysis(clientId: string): Promise<Analysis | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_analyses")
    .select("period, what_changed, why, next_steps")
    .eq("client_id", clientId)
    .order("period", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { period: data.period, whatChanged: data.what_changed ?? [], why: data.why ?? [], nextSteps: data.next_steps ?? [] };
}

export async function listCampaigns(clientId: string): Promise<AdCampaign[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ad_campaigns")
    .select("id, platform, name, status, currency, spend_28d, clicks_28d, leads_28d, spend_mtd, leads_mtd")
    .eq("client_id", clientId)
    .order("spend_28d", { ascending: false });
  return (data ?? []).map((r) => ({
    id: r.id,
    platform: r.platform,
    name: r.name,
    status: r.status,
    currency: r.currency,
    spend28d: num(r.spend_28d),
    clicks28d: num(r.clicks_28d),
    leads28d: num(r.leads_28d),
    spendMtd: num(r.spend_mtd),
    leadsMtd: num(r.leads_mtd),
  }));
}

export async function getAdBudget(clientId: string, month: string): Promise<AdBudget | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("ad_budgets").select("month, amount, currency").eq("client_id", clientId).eq("month", month).maybeSingle();
  return data ? { month: data.month, amount: num(data.amount), currency: data.currency } : null;
}

export async function listLeads(clientId: string, limit = 200): Promise<Lead[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("client_leads")
    .select("id, received_at, name, email, phone, source, interest, outcome, first_contact_at, value, currency")
    .eq("client_id", clientId)
    .order("received_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => ({
    id: r.id,
    receivedAt: r.received_at,
    name: r.name,
    email: r.email,
    phone: r.phone,
    source: r.source,
    interest: r.interest,
    outcome: r.outcome,
    firstContactAt: r.first_contact_at,
    value: numOrNull(r.value),
    currency: r.currency,
  }));
}

export async function getWebsite(clientId: string): Promise<Website | null> {
  const supabase = await createClient();
  const { data: r } = await supabase.from("client_websites").select("*").eq("client_id", clientId).maybeSingle();
  if (!r) return null;
  return {
    url: r.url,
    platform: r.platform,
    hosting: r.hosting,
    sslRenewsOn: r.ssl_renews_on,
    domainRenewsOn: r.domain_renews_on,
    tracking: r.tracking ?? [],
    uptime30d: numOrNull(r.uptime_30d),
    mobileSpeed: r.mobile_speed,
    lcpMs: r.lcp_ms,
    formsTotal: r.forms_total,
    formsWorking: r.forms_working,
    formsTestedAt: r.forms_tested_at,
    lastBackupAt: r.last_backup_at,
  };
}

/** Open website tickets for the client: 0106 `tickets` tagged "website" in the client's projects. */
export async function listWebsiteChangeRequests(clientId: string): Promise<ChangeRequest[]> {
  const projects = await listProjects([clientId]);
  if (!projects.length) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tickets")
    .select("key, title, status")
    .in("project_id", projects.map((p) => p.id))
    .contains("tags", ["website"])
    .neq("status", "done")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return [];
  return (data ?? []).map((t) => ({ key: t.key, title: t.title, status: t.status }));
}

export async function listSeoQueries(clientId: string): Promise<SeoQuery[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("seo_queries")
    .select("query, position, prior_position, clicks, impressions")
    .eq("client_id", clientId)
    .order("clicks", { ascending: false })
    .limit(50);
  return (data ?? []).map((r) => ({
    query: r.query,
    position: num(r.position),
    priorPosition: numOrNull(r.prior_position),
    clicks: r.clicks,
    impressions: r.impressions,
  }));
}

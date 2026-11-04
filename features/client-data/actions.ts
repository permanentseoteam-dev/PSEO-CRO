"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getMe, can } from "@/lib/auth/can";
import { createClient } from "@/lib/supabase/server";
import { getAdapter } from "./adapters";
import { checkSubAccountLink } from "./logic";
import { listAllSubAccountLinks } from "./queries";
import { CURRENCIES, LEAD_OUTCOMES, SOURCES, type ActionResult } from "./types";

const NO_ACCESS = { ok: false as const, error: "You don't have access to do that." };
const BAD_INPUT = { ok: false as const, error: "Check the form and try again." };

const id = z.string().uuid();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const optionalDay = z.union([day, z.literal("")]).transform((v) => v || null);
const lines = z.array(z.string().trim().max(300)).max(12).transform((a) => a.filter(Boolean));

async function manager() {
  const me = await getMe();
  return me && me.kind === "staff" && can(me, "clients.data.manage") ? me : null;
}

const done = (clientId: string): ActionResult => {
  revalidatePath(`/clients/${clientId}`);
  return { ok: true };
};

// ---------------------------------------------------------------- sub-accounts

const LinkInput = z.object({ parentId: id, childId: id, billing: z.enum(["parent", "own"]) });

export async function linkSubAccount(raw: unknown): Promise<ActionResult> {
  const input = LinkInput.safeParse(raw);
  if (!input.success) return BAD_INPUT;
  const me = await manager();
  if (!me) return NO_ACCESS;
  const { parentId, childId, billing } = input.data;
  const problem = checkSubAccountLink(parentId, childId, await listAllSubAccountLinks());
  if (problem) return { ok: false, error: problem };
  const supabase = await createClient();
  const { error } = await supabase
    .from("client_sub_accounts")
    .insert({ parent_client_id: parentId, child_client_id: childId, billing, linked_by: me.id });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/clients/${childId}`);
  return done(parentId);
}

const UnlinkInput = z.object({ id, parentId: id });

export async function unlinkSubAccount(raw: unknown): Promise<ActionResult> {
  const input = UnlinkInput.safeParse(raw);
  if (!input.success) return BAD_INPUT;
  if (!(await manager())) return NO_ACCESS;
  const supabase = await createClient();
  const { error } = await supabase.from("client_sub_accounts").delete().eq("id", input.data.id).eq("parent_client_id", input.data.parentId);
  if (error) return { ok: false, error: error.message };
  return done(input.data.parentId);
}

// ---------------------------------------------------------------- data sources

const SourceInput = z.object({ clientId: id, source: z.enum(SOURCES) });

/** Starts the provider's sign-in. Returns the URL to open, or why it can't start. */
export async function connectSource(raw: unknown): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const input = SourceInput.safeParse(raw);
  if (!input.success) return BAD_INPUT;
  if (!(await manager())) return NO_ACCESS;
  const res = await getAdapter(input.data.source).connect({
    clientId: input.data.clientId,
    returnTo: `/clients/${input.data.clientId}?tab=perf`,
  });
  return res.ok ? { ok: true, url: res.data.authUrl } : { ok: false, error: res.message };
}

export async function refreshSource(raw: unknown): Promise<ActionResult> {
  const input = SourceInput.safeParse(raw);
  if (!input.success) return BAD_INPUT;
  if (!(await manager())) return NO_ACCESS;
  const { clientId, source } = input.data;
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("client_data_sources")
    .select("external_id, status")
    .eq("client_id", clientId)
    .eq("source", source)
    .maybeSingle();
  if (!row || row.status === "not_connected") return { ok: false, error: "Connect this source first." };

  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 55 * 86_400_000).toISOString().slice(0, 10);
  const res = await getAdapter(source).fetchDaily({ externalId: row.external_id ?? "", from, to });
  if (!res.ok) {
    // A missing setup is not the account's fault, so the row keeps its state.
    if (res.reason !== "not_configured") {
      await supabase.from("client_data_sources").update({ status: "error", last_error: res.message }).eq("client_id", clientId).eq("source", source);
      revalidatePath(`/clients/${clientId}`);
    }
    return { ok: false, error: res.message };
  }

  const { error } = await supabase
    .from("client_metric_daily")
    .upsert(res.data.map((d) => ({ client_id: clientId, source, metric: d.metric, day: d.day, value: d.value, currency: d.currency })), {
      onConflict: "client_id,source,metric,day",
    });
  if (error) return { ok: false, error: error.message };
  await supabase
    .from("client_data_sources")
    .update({ status: "connected", last_refresh_at: new Date().toISOString(), last_error: null })
    .eq("client_id", clientId)
    .eq("source", source);
  return done(clientId);
}

export async function disconnectSource(raw: unknown): Promise<ActionResult> {
  const input = SourceInput.safeParse(raw);
  if (!input.success) return BAD_INPUT;
  if (!(await manager())) return NO_ACCESS;
  const { clientId, source } = input.data;
  const supabase = await createClient();
  const { data: row } = await supabase.from("client_data_sources").select("external_id").eq("client_id", clientId).eq("source", source).maybeSingle();
  if (!row) return { ok: false, error: "This source isn't connected." };
  const res = await getAdapter(source).disconnect({ externalId: row.external_id ?? "" });
  if (!res.ok) return { ok: false, error: res.message };
  const { error } = await supabase
    .from("client_data_sources")
    .update({ status: "not_connected", external_id: null, account_label: null, last_error: null, connected_by: null, connected_at: null })
    .eq("client_id", clientId)
    .eq("source", source);
  if (error) return { ok: false, error: error.message };
  return done(clientId);
}

// ---------------------------------------------------------------- leads

const OutcomeInput = z.object({ clientId: id, leadId: id, outcome: z.enum(LEAD_OUTCOMES) });

export async function setLeadOutcome(raw: unknown): Promise<ActionResult> {
  const input = OutcomeInput.safeParse(raw);
  if (!input.success) return BAD_INPUT;
  if (!(await manager())) return NO_ACCESS;
  const { clientId, leadId, outcome } = input.data;
  const supabase = await createClient();
  const { data: lead } = await supabase.from("client_leads").select("first_contact_at").eq("id", leadId).eq("client_id", clientId).maybeSingle();
  if (!lead) return { ok: false, error: "That lead no longer exists." };
  // Leaving "new" for the first time counts as the first contact (feeds "Contacted within 1 hour").
  const patch: Record<string, unknown> = { outcome };
  if (outcome !== "new" && !lead.first_contact_at) patch.first_contact_at = new Date().toISOString();
  const { error } = await supabase.from("client_leads").update(patch).eq("id", leadId).eq("client_id", clientId);
  if (error) return { ok: false, error: error.message };
  return done(clientId);
}

// ---------------------------------------------------------------- analysis

const AnalysisInput = z.object({ clientId: id, period: day, whatChanged: lines, why: lines, nextSteps: lines });

export async function saveAnalysis(raw: unknown): Promise<ActionResult> {
  const input = AnalysisInput.safeParse(raw);
  if (!input.success) return BAD_INPUT;
  const me = await manager();
  if (!me) return NO_ACCESS;
  const { clientId, period, whatChanged, why, nextSteps } = input.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("client_analyses")
    .upsert(
      { client_id: clientId, period: `${period.slice(0, 7)}-01`, what_changed: whatChanged, why, next_steps: nextSteps, author_id: me.id },
      { onConflict: "client_id,period" },
    );
  if (error) return { ok: false, error: error.message };
  return done(clientId);
}

// ---------------------------------------------------------------- ads budget

const BudgetInput = z.object({ clientId: id, month: day, amount: z.coerce.number().min(0).max(1e9), currency: z.enum(CURRENCIES) });

export async function saveAdBudget(raw: unknown): Promise<ActionResult> {
  const input = BudgetInput.safeParse(raw);
  if (!input.success) return BAD_INPUT;
  if (!(await manager())) return NO_ACCESS;
  const { clientId, month, amount, currency } = input.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("ad_budgets")
    .upsert({ client_id: clientId, month: `${month.slice(0, 7)}-01`, amount, currency }, { onConflict: "client_id,month" });
  if (error) return { ok: false, error: error.message };
  return done(clientId);
}

// ---------------------------------------------------------------- website

const WebsiteInput = z.object({
  clientId: id,
  url: z.string().trim().min(3).max(200),
  platform: z.string().trim().max(120),
  hosting: z.string().trim().max(120),
  sslRenewsOn: optionalDay,
  domainRenewsOn: optionalDay,
  tracking: z.string().max(300).transform((s) => s.split(",").map((t) => t.trim()).filter(Boolean)),
});

export async function saveWebsite(raw: unknown): Promise<ActionResult> {
  const input = WebsiteInput.safeParse(raw);
  if (!input.success) return BAD_INPUT;
  if (!(await manager())) return NO_ACCESS;
  const w = input.data;
  const supabase = await createClient();
  const { error } = await supabase.from("client_websites").upsert(
    {
      client_id: w.clientId,
      url: w.url,
      platform: w.platform || null,
      hosting: w.hosting || null,
      ssl_renews_on: w.sslRenewsOn,
      domain_renews_on: w.domainRenewsOn,
      tracking: w.tracking,
    },
    { onConflict: "client_id" },
  );
  if (error) return { ok: false, error: error.message };
  return done(w.clientId);
}

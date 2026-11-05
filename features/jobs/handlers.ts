import "server-only";
// The app jobs: each is called by app/api/cron/* after the CRON_SECRET check, with the service client.
// Each returns an outcome; the caller writes it to job_runs. Schedules live in 0210_scheduled_jobs.sql.
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeHealth } from "@/lib/modules/clients/queries";
import { workingMinutes } from "@/lib/modules/clientops/logic";
import { getProfitability } from "@/lib/modules/finance/ops/queries";
import { getEmailSender, type EmailProvider } from "@/features/finance-p2/email";
import { buildMonthlyDrafts, round2 } from "@/features/finance-p2/logic";
import type { BillingProfile, Currency, FeeBasis, SubLink } from "@/features/finance-p2/types";
import { getMailer } from "@/features/client-success/email";
import { getFirefliesAdapter, getGmailInboxAdapter, getGoogleCalendarAdapter } from "@/features/platform-p2/adapters";
import {
  dubaiDate,
  hoursLabel,
  isDubaiDayOfMonth,
  isReportDue,
  monthLabel,
  monthStartOf,
  previousMonth,
  profitabilityDetail,
  slaMarks,
  type AppJobName,
  type JobOutcome,
} from "./logic";

type Ctx = { db: SupabaseClient; now: Date };
type Row = Record<string, unknown>;
const num = (v: unknown) => (v == null ? 0 : Number(v));
const ok = (detail: string): JobOutcome => ({ status: "ok", detail });
const skipped = (detail: string): JobOutcome => ({ status: "skipped", detail });
const failed = (detail: string): JobOutcome => ({ status: "error", detail });

// ---------------------------------------------------------------- payment reminders: auto-send
async function remindersAutosend({ db, now }: Ctx): Promise<JobOutcome> {
  const today = dubaiDate(now);
  const due = await db
    .from("reminders")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .eq("auto", true)
    .lte("send_on", today)
    .or(`paused_until.is.null,paused_until.lt.${today}`);
  if (due.error) return failed(due.error.message);
  const n = due.count ?? 0;
  const { data: settings } = await db.from("email_settings").select("provider").maybeSingle();
  const sender = getEmailSender(((settings?.provider as EmailProvider | "none" | undefined) ?? "none"));
  if (!sender.configured) return skipped(`Email not configured. ${n} auto reminders due, left pending.`);
  // Reachable once getEmailSender() returns a real sender: wire the reminder email (template + PDF) here.
  return failed(`Email provider is set, but auto-send isn't wired to it yet. ${n} auto reminders due.`);
}

// ---------------------------------------------------------------- monthly draft invoices (the 1st)
async function monthlyDrafts({ db, now }: Ctx): Promise<JobOutcome> {
  if (!isDubaiDayOfMonth(now, 1)) return skipped("Runs on the 1st of the month only.");
  const month = monthStartOf(dubaiDate(now));
  const [bp, ents, clients, links, existing] = await Promise.all([
    db.from("billing_profiles").select("client_id, entity_id, currency, agreed_fee, fee_basis, terms_days"),
    db.from("entities").select("id, name, tax_rate"),
    db.from("clients").select("id, name, status"),
    db.from("client_sub_accounts").select("parent_client_id, child_client_id, billing"),
    db.from("monthly_drafts").select("client_id").eq("month", month),
  ]);
  const err = bp.error ?? ents.error ?? clients.error ?? links.error ?? existing.error;
  if (err) return failed(err.message);

  const ent = new Map(((ents.data ?? []) as Row[]).map((e) => [String(e.id), e]));
  // Only clients being worked for, and only profiles with an entity (invoices need one).
  const live = new Map(((clients.data ?? []) as Row[]).filter((c) => c.status === "active" || c.status === "onboarding").map((c) => [String(c.id), String(c.name)]));
  const profiles: BillingProfile[] = ((bp.data ?? []) as Row[])
    .filter((p) => live.has(String(p.client_id)) && p.entity_id && ent.has(String(p.entity_id)))
    .map((p) => {
      const e = ent.get(String(p.entity_id))!;
      return {
        clientId: String(p.client_id),
        clientName: live.get(String(p.client_id))!,
        entityId: String(p.entity_id),
        entityName: String(e.name),
        currency: p.currency as Currency,
        agreedFee: num(p.agreed_fee),
        feeBasis: p.fee_basis as FeeBasis,
        termsDays: num(p.terms_days),
        taxRate: num(e.tax_rate),
      };
    });
  const subLinks: SubLink[] = ((links.data ?? []) as Row[]).map((l) => ({
    parentId: String(l.parent_client_id),
    childId: String(l.child_client_id),
    billing: l.billing as SubLink["billing"],
  }));
  const plans = buildMonthlyDrafts({
    profiles,
    links: subLinks,
    month,
    existingClientIds: ((existing.data ?? []) as Row[]).map((r) => String(r.client_id)),
  });

  let created = 0;
  const errors: string[] = [];
  for (const p of plans) {
    // Claim the month first (unique client_id + month), so a second run can't make a duplicate.
    const claim = await db
      .from("monthly_drafts")
      .insert({ month, client_id: p.clientId, amount: p.total, currency: p.currency, sub_client_ids: p.subClientIds })
      .select("id")
      .single();
    if (claim.error || !claim.data) continue;
    const inv = await db
      .from("invoices")
      .insert({
        client_id: p.clientId,
        entity_id: p.entityId,
        currency: p.currency,
        status: "draft",
        title: p.title,
        issued_on: p.issuedOn,
        due_on: p.dueOn,
        subtotal: p.subtotal,
        tax_total: p.tax,
        total: p.total,
      })
      .select("id")
      .single();
    if (inv.error || !inv.data) {
      await db.from("monthly_drafts").delete().eq("id", claim.data.id);
      errors.push(`${p.clientName}: ${inv.error?.message ?? "insert failed"}`);
      continue;
    }
    await db.from("invoice_lines").insert(
      p.lines.map((l, i) => ({ invoice_id: inv.data.id, position: i, description: l.description, qty: l.qty, rate: l.rate, tax_pct: l.taxPct, amount: round2(l.qty * l.rate) })),
    );
    await db.from("monthly_drafts").update({ invoice_id: inv.data.id }).eq("id", claim.data.id);
    created++;
  }
  const detail = `${created} draft invoices for ${monthLabel(month)}.`;
  return errors.length ? failed(`${detail} Failed: ${errors.join("; ")}`) : ok(detail);
}

// ---------------------------------------------------------------- monthly client reports: auto-send
async function reportAutosend({ db, now }: Ctx): Promise<JobOutcome> {
  const today = dubaiDate(now);
  const res = await db
    .from("monthly_reports")
    .select("id, client_id, month, status, auto_send, due_on, sent_at, send_pending_at, summary, highlights, plan")
    .eq("status", "approved")
    .eq("auto_send", true)
    .is("sent_at", null)
    .lte("due_on", today);
  if (res.error) return failed(res.error.message);
  const due = ((res.data ?? []) as Row[]).filter((r) =>
    isReportDue({ status: String(r.status), autoSend: Boolean(r.auto_send), dueOn: String(r.due_on), sentAt: (r.sent_at as string) ?? null }, today),
  );
  if (!due.length) return ok("No reports due.");

  const mailer = getMailer();
  if (!mailer.configured) {
    const fresh = due.filter((r) => !r.send_pending_at).map((r) => String(r.id));
    if (fresh.length) {
      const { error } = await db.from("monthly_reports").update({ send_pending_at: now.toISOString() }).in("id", fresh);
      if (error) return failed(error.message);
    }
    return skipped(`Email not configured. ${due.length} reports due, ${fresh.length} newly marked pending send.`);
  }

  const { data: profiles } = await db
    .from("client_success_profiles")
    .select("client_id, report_recipient")
    .in("client_id", due.map((r) => String(r.client_id)));
  const { data: clients } = await db.from("clients").select("id, name").in("id", due.map((r) => String(r.client_id)));
  const to = new Map(((profiles ?? []) as Row[]).map((p) => [String(p.client_id), (p.report_recipient as string) ?? ""]));
  const names = new Map(((clients ?? []) as Row[]).map((c) => [String(c.id), String(c.name)]));
  let sent = 0;
  const problems: string[] = [];
  for (const r of due) {
    const name = names.get(String(r.client_id)) ?? "Client";
    const recipient = to.get(String(r.client_id));
    if (!recipient) {
      problems.push(`${name}: no report recipient`);
      continue;
    }
    const text = [r.summary, r.highlights && `Highlights\n${r.highlights}`, r.plan && `Next month\n${r.plan}`].filter(Boolean).join("\n\n");
    const res2 = await mailer.send({ to: recipient, subject: `${name}: ${monthLabel(String(r.month))} report`, text });
    if (!res2.ok) {
      problems.push(`${name}: ${res2.error}`);
      continue;
    }
    await db.from("monthly_reports").update({ status: "sent", sent_at: new Date().toISOString(), send_pending_at: null }).eq("id", String(r.id));
    sent++;
  }
  return problems.length ? failed(`${sent} sent. ${problems.join("; ")}`) : ok(`${sent} reports sent.`);
}

// ---------------------------------------------------------------- integrations (no-op until an adapter is set up)
async function calendarSync(): Promise<JobOutcome> {
  if (!getGoogleCalendarAdapter().configured) return skipped("Google Calendar not configured.");
  return failed("Google Calendar is configured, but the scheduled sync isn't built yet.");
}

async function inboxPoll(): Promise<JobOutcome> {
  if (!getGmailInboxAdapter().configured) return skipped("Gmail inbox not configured.");
  return failed("Gmail is configured, but the scheduled poll isn't built yet.");
}

async function firefliesImport(): Promise<JobOutcome> {
  if (!getFirefliesAdapter().configured) return skipped("Fireflies not configured.");
  return failed("Fireflies is configured, but the scheduled import isn't built yet.");
}

// ---------------------------------------------------------------- client health (before the 02:00 snapshot)
async function healthRecalc({ db, now }: Ctx): Promise<JobOutcome> {
  const res = await db.from("clients").select("id").in("status", ["active", "onboarding"]);
  if (res.error) return failed(res.error.message);
  let saved = 0;
  const errors: string[] = [];
  for (const c of (res.data ?? []) as Row[]) {
    const id = String(c.id);
    const h = await computeHealth(db, id, now);
    if (!h) continue;
    const { error } = await db
      .from("clients")
      .update({ health_score: h.score, health_band: h.band, health_factors: h.factors, health_at: now.toISOString() })
      .eq("id", id);
    if (error) errors.push(`${id}: ${error.message}`);
    else saved++;
  }
  const detail = `${saved} clients scored.`;
  return errors.length ? failed(`${detail} Failed: ${errors.slice(0, 5).join("; ")}`) : ok(detail);
}

// ---------------------------------------------------------------- response times: late marks + alerts
async function slaAlerts({ db, now }: Ctx): Promise<JobOutcome> {
  const [settingsRes, waitsRes] = await Promise.all([
    db.from("sla_settings").select("timezone, day_start, day_end, workdays, alert_answerer, alert_manager").maybeSingle(),
    db
      .from("sla_waits")
      .select("id, client_id, subject, answerer_id, target_hours, started_at, late_at, late2x_at")
      .is("answered_at", null)
      .or("late_at.is.null,late2x_at.is.null"),
  ]);
  if (settingsRes.error) return failed(settingsRes.error.message);
  if (waitsRes.error) return failed(waitsRes.error.message);
  const s = settingsRes.data as Row | null;
  const hours = {
    timezone: (s?.timezone as string) ?? "Asia/Dubai",
    dayStart: String(s?.day_start ?? "09:00").slice(0, 5),
    dayEnd: String(s?.day_end ?? "18:00").slice(0, 5),
    workdays: ((s?.workdays as number[]) ?? [1, 2, 3, 4, 5]).map(Number),
  };
  const alertAnswerer = s ? Boolean(s.alert_answerer) : true;
  const alertManager = s ? Boolean(s.alert_manager) : true;

  const waits = (waitsRes.data ?? []) as Row[];
  const marked = waits
    .map((w) => ({
      w,
      m: slaMarks(workingMinutes(new Date(String(w.started_at)), now, hours), num(w.target_hours), {
        lateAt: (w.late_at as string) ?? null,
        late2xAt: (w.late2x_at as string) ?? null,
      }),
    }))
    .filter((x) => x.m.late || x.m.late2x);
  if (!marked.length) return ok(`${waits.length} open waits checked, none newly late.`);

  const clientIds = [...new Set(marked.map((x) => String(x.w.client_id)))];
  const answererIds = [...new Set(marked.map((x) => x.w.answerer_id).filter(Boolean).map(String))];
  const [clientsRes, membersRes] = await Promise.all([
    db.from("clients").select("id, name, manager_id").in("id", clientIds),
    answererIds.length ? db.from("members").select("id, manager_id").in("id", answererIds) : Promise.resolve({ data: [] as Row[], error: null }),
  ]);
  const clients = new Map(((clientsRes.data ?? []) as Row[]).map((c) => [String(c.id), c]));
  const managerOf = new Map(((membersRes.data ?? []) as Row[]).map((m) => [String(m.id), (m.manager_id as string) ?? null]));

  const stamp = now.toISOString();
  const notes: Row[] = [];
  let late = 0;
  let late2x = 0;
  for (const { w, m } of marked) {
    const patch: Row = {};
    if (m.late) patch.late_at = stamp;
    if (m.late2x) patch.late2x_at = stamp;
    // Only the run that sets the mark sends the alert, so a second overlapping run sends nothing.
    let q = db.from("sla_waits").update(patch).eq("id", String(w.id));
    if (m.late) q = q.is("late_at", null);
    if (m.late2x) q = q.is("late2x_at", null);
    const upd = await q.select("id");
    if (upd.error || !upd.data?.length) continue;

    const client = clients.get(String(w.client_id));
    const clientName = client ? String(client.name) : "a client";
    const detail = `· ${String(w.subject)} (target ${hoursLabel(num(w.target_hours))})`;
    const answerer = (w.answerer_id as string) ?? null;
    if (m.late) {
      late++;
      if (alertAnswerer && answerer)
        notes.push({ member_id: answerer, actor_id: null, kind: "client", action: "Reply is late for", subject: clientName, detail, href: "/response-times" });
    }
    if (m.late2x) {
      late2x++;
      const manager = (answerer && managerOf.get(answerer)) || ((client?.manager_id as string) ?? null);
      if (alertManager && manager)
        notes.push({ member_id: manager, actor_id: null, kind: "client", action: "Reply is past 2× target for", subject: clientName, detail, href: "/response-times" });
    }
  }
  if (notes.length) {
    const { error } = await db.from("notifications").insert(notes);
    if (error) return failed(`Marked ${late} late, ${late2x} past 2×, but notifications failed: ${error.message}`);
  }
  return ok(`${late} newly late, ${late2x} past 2× target, ${notes.length} notifications.`);
}

// ---------------------------------------------------------------- monthly profitability alert (the 2nd)
async function profitabilityAlert({ db, now }: Ctx): Promise<JobOutcome> {
  if (!isDubaiDayOfMonth(now, 2)) return skipped("Runs on the 2nd of the month only.");
  const today = dubaiDate(now);
  // One alert per month: skip when today's run already succeeded.
  const dayStart = new Date(`${today}T00:00:00+04:00`).toISOString();
  const prior = await db.from("job_runs").select("id").eq("job", "profitability-alert").eq("status", "ok").gte("started_at", dayStart).limit(1);
  if (prior.data?.length) return skipped("Already sent today.");

  const ym = previousMonth(today);
  const { data: settings } = await db.from("finance_ops_settings").select("working_hours, margin_alert_pct").maybeSingle();
  const workingHours = num(settings?.working_hours) || 160;
  const alertPct = settings?.margin_alert_pct == null ? 35 : num(settings.margin_alert_pct);
  const [month] = await getProfitability([ym], workingHours);
  const below = month.clients.filter((c) => c.marginPct < alertPct).length;

  const holders = await db.rpc("job_perm_holders", { perm: "finance.profitability.view", min_scope: "all" });
  if (holders.error) return failed(holders.error.message);
  const ids = (holders.data ?? []) as string[]; // setof uuid comes back as an array of ids
  if (!ids.length) return ok(`${monthLabel(ym)}: nobody has profitability view.`);

  const detail = profitabilityDetail(month.totals.marginPct, below, alertPct);
  const { error } = await db.from("notifications").insert(
    ids.map((member_id) => ({
      member_id,
      actor_id: null,
      kind: "system",
      action: "Profitability for",
      subject: monthLabel(ym),
      detail,
      href: `/finance/profitability?m=${ym}`,
    })),
  );
  if (error) return failed(error.message);
  return ok(`${monthLabel(ym)} ${detail} Sent to ${ids.length}.`);
}

export const APP_JOBS: Record<AppJobName, (ctx: Ctx) => Promise<JobOutcome>> = {
  "reminders-autosend": remindersAutosend,
  "monthly-drafts": monthlyDrafts,
  "report-autosend": reportAutosend,
  "health-recalc": healthRecalc,
  "calendar-sync": calendarSync,
  "inbox-poll": inboxPoll,
  "fireflies-import": firefliesImport,
  "sla-alerts": slaAlerts,
  "profitability-alert": profitabilityAlert,
};

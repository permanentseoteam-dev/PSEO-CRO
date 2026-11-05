"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getMe, can } from "@/lib/auth/can";
import { createClient } from "@/lib/supabase/server";
import { getMailer } from "./email";
import { canMoveReport, lines, monthLabel, nextQbrStatus, reportDueOn, reviewLogEntry } from "./logic";
import {
  CADENCES,
  COMMITMENT_KINDS,
  COMMITMENT_STATUSES,
  LOG_KINDS,
  MOODS,
  OPPORTUNITY_STAGES,
  REVIEW_STATUSES,
  TIERS,
  type QbrStatus,
  type ReportStatus,
  type Result,
} from "./types";

// Every action: zod parse -> can() check -> Supabase write (RLS is the real guard) -> revalidate the client page.

const FORM_ERROR = "Check the form and try again.";
const NO_ACCESS = "You don't have access to do that.";

const id = z.uuid();
const date = z.iso.date();
const text = (max = 2000) => z.string().trim().max(max);
const optText = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));
const optDate = z
  .union([date, z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null));

async function staff(perm = "clients.manage") {
  const me = await getMe();
  return me && me.kind === "staff" && can(me, perm) ? me : null;
}

function done(clientId: string): Result {
  revalidatePath(`/clients/${clientId}`);
  return { ok: true };
}

/** Runs an RLS-guarded write and turns "0 rows changed" into a no-access error. */
async function changed(q: PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<string | null> {
  const { data, error } = await q;
  if (error) return error.message;
  return Array.isArray(data) && data.length === 0 ? NO_ACCESS : null;
}

// ---------------------------------------------------------------- profile and settings
const ProfileInput = z.object({
  clientId: id,
  tier: z.enum(TIERS).nullable(),
  rapport: z.number().int().min(1).max(5).nullable(),
  rapport_note: optText(200),
  niche_profile: optText(),
});

export async function saveProfile(raw: unknown): Promise<Result> {
  const p = ProfileInput.safeParse(raw);
  if (!p.success) return { ok: false, error: FORM_ERROR };
  if (!(await staff())) return { ok: false, error: NO_ACCESS };
  const { clientId, ...rest } = p.data;
  const supabase = await createClient();
  const err = await changed(supabase.from("client_success_profiles").upsert({ client_id: clientId, ...rest }).select("client_id"));
  return err ? { ok: false, error: err } : done(clientId);
}

const ReportSettingsInput = z.object({
  clientId: id,
  report_due_day: z.number().int().min(1).max(28),
  auto_send: z.boolean(),
  report_recipient: optText(200),
});

export async function saveReportSettings(raw: unknown): Promise<Result> {
  const p = ReportSettingsInput.safeParse(raw);
  if (!p.success) return { ok: false, error: FORM_ERROR };
  if (!(await staff())) return { ok: false, error: NO_ACCESS };
  const { clientId, ...rest } = p.data;
  const supabase = await createClient();
  const err = await changed(supabase.from("client_success_profiles").upsert({ client_id: clientId, ...rest }).select("client_id"));
  return err ? { ok: false, error: err } : done(clientId);
}

// ---------------------------------------------------------------- commitments
const CommitmentInput = z.object({
  clientId: id,
  title: text(200).min(1),
  kind: z.enum(COMMITMENT_KINDS),
  cadence: z.enum(CADENCES),
  target: text(100),
  owner_id: id.nullable(),
  client_visible: z.boolean(),
});

export async function addCommitment(raw: unknown): Promise<Result> {
  const p = CommitmentInput.safeParse(raw);
  if (!p.success) return { ok: false, error: FORM_ERROR };
  if (!(await staff())) return { ok: false, error: NO_ACCESS };
  const { clientId, ...rest } = p.data;
  const supabase = await createClient();
  const { error } = await supabase.from("commitments").insert({ client_id: clientId, ...rest });
  return error ? { ok: false, error: error.message } : done(clientId);
}

const CheckInInput = z.object({
  clientId: id,
  commitment_id: id,
  value: optText(100),
  status: z.enum(COMMITMENT_STATUSES),
  note: optText(),
  checked_on: date,
});

export async function logCheckIn(raw: unknown): Promise<Result> {
  const p = CheckInInput.safeParse(raw);
  if (!p.success) return { ok: false, error: FORM_ERROR };
  const me = await staff();
  if (!me) return { ok: false, error: NO_ACCESS };
  const { clientId, ...rest } = p.data;
  const supabase = await createClient();
  // The insert trigger copies value, status and date onto the commitment.
  const { error } = await supabase.from("commitment_checkins").insert({ client_id: clientId, by_id: me.id, ...rest });
  return error ? { ok: false, error: error.message } : done(clientId);
}

// ---------------------------------------------------------------- relationship
const PersonInput = z.object({
  clientId: id,
  id: id.optional(),
  name: text(120).min(1),
  role: optText(120),
  decision_power: optText(120),
  personal_notes: optText(),
  birthday: optDate,
});

export async function savePerson(raw: unknown): Promise<Result> {
  const p = PersonInput.safeParse(raw);
  if (!p.success) return { ok: false, error: FORM_ERROR };
  if (!(await staff())) return { ok: false, error: NO_ACCESS };
  const { clientId, id: personId, ...rest } = p.data;
  const supabase = await createClient();
  const err = personId
    ? await changed(supabase.from("relationship_people").update(rest).eq("id", personId).eq("client_id", clientId).select("id"))
    : (await supabase.from("relationship_people").insert({ client_id: clientId, ...rest })).error?.message ?? null;
  return err ? { ok: false, error: err } : done(clientId);
}

const DateInput = z.object({ clientId: id, title: text(120).min(1), on_date: date, yearly: z.boolean(), person_id: id.nullable() });

export async function addDate(raw: unknown): Promise<Result> {
  const p = DateInput.safeParse(raw);
  if (!p.success) return { ok: false, error: FORM_ERROR };
  if (!(await staff())) return { ok: false, error: NO_ACCESS };
  const { clientId, ...rest } = p.data;
  const supabase = await createClient();
  const { error } = await supabase.from("relationship_dates").insert({ client_id: clientId, ...rest });
  return error ? { ok: false, error: error.message } : done(clientId);
}

const LogInput = z.object({
  clientId: id,
  kind: z.enum(LOG_KINDS),
  mood: z.enum(MOODS).nullable(),
  note: text().min(1),
  on_date: date,
  person_id: id.nullable(),
});

export async function addLogEntry(raw: unknown): Promise<Result> {
  const p = LogInput.safeParse(raw);
  if (!p.success) return { ok: false, error: FORM_ERROR };
  const me = await staff();
  if (!me) return { ok: false, error: NO_ACCESS };
  const { clientId, ...rest } = p.data;
  const supabase = await createClient();
  const { error } = await supabase.from("relationship_log").insert({ client_id: clientId, by_id: me.id, ...rest });
  return error ? { ok: false, error: error.message } : done(clientId);
}

const BriefInput = z.object({ clientId: id, id: id.optional(), title: text(120).min(1), meeting_on: date, points: text(4000) });

export async function saveBrief(raw: unknown): Promise<Result> {
  const p = BriefInput.safeParse(raw);
  if (!p.success) return { ok: false, error: FORM_ERROR };
  const me = await staff();
  if (!me) return { ok: false, error: NO_ACCESS };
  const { clientId, id: briefId, ...rest } = p.data;
  const supabase = await createClient();
  const err = briefId
    ? await changed(supabase.from("meeting_briefs").update(rest).eq("id", briefId).eq("client_id", clientId).select("id"))
    : (await supabase.from("meeting_briefs").insert({ client_id: clientId, by_id: me.id, ...rest })).error?.message ?? null;
  return err ? { ok: false, error: err } : done(clientId);
}

const SocialInput = z.object({
  clientId: id,
  name: text(120).min(1),
  is_client: z.boolean(),
  instagram_followers: z.number().int().min(0).nullable(),
  ads_running: z.number().int().min(0).nullable(),
  note: optText(300),
});

export async function addSocialProfile(raw: unknown): Promise<Result> {
  const p = SocialInput.safeParse(raw);
  if (!p.success) return { ok: false, error: FORM_ERROR };
  if (!(await staff())) return { ok: false, error: NO_ACCESS };
  const { clientId, ...rest } = p.data;
  const supabase = await createClient();
  const { error } = await supabase.from("social_profiles").insert({ client_id: clientId, ...rest });
  return error ? { ok: false, error: error.message } : done(clientId);
}

const OpportunityInput = z.object({
  clientId: id,
  id: id.optional(),
  title: text(200).min(1),
  value: z.number().min(0).nullable(),
  currency: z.enum(["AED", "USD", "PKR"]),
  billing: z.enum(["monthly", "once"]),
  stage: z.enum(OPPORTUNITY_STAGES),
  stage_note: optText(120),
});

export async function saveOpportunity(raw: unknown): Promise<Result> {
  const p = OpportunityInput.safeParse(raw);
  if (!p.success) return { ok: false, error: FORM_ERROR };
  const me = await staff();
  if (!me) return { ok: false, error: NO_ACCESS };
  const { clientId, id: oppId, ...rest } = p.data;
  const supabase = await createClient();
  const err = oppId
    ? await changed(supabase.from("client_opportunities").update(rest).eq("id", oppId).eq("client_id", clientId).select("id"))
    : (await supabase.from("client_opportunities").insert({ client_id: clientId, owner_id: me.id, ...rest })).error?.message ?? null;
  return err ? { ok: false, error: err } : done(clientId);
}

/** Remove on request: deletes the person, their dates and log entries, and records that it happened. */
export async function removePersonOnRequest(raw: unknown): Promise<Result> {
  const p = z.object({ clientId: id, personId: id }).safeParse(raw);
  if (!p.success) return { ok: false, error: FORM_ERROR };
  if (!(await staff())) return { ok: false, error: NO_ACCESS };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cs_remove_person", { target: p.data.personId });
  return error ? { ok: false, error: error.message } : done(p.data.clientId);
}

// ---------------------------------------------------------------- monthly reports
export async function createReport(raw: unknown): Promise<Result> {
  const p = z.object({ clientId: id, month: date }).safeParse(raw);
  if (!p.success || !p.data.month.endsWith("-01")) return { ok: false, error: FORM_ERROR };
  const me = await staff();
  if (!me) return { ok: false, error: NO_ACCESS };
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("client_success_profiles")
    .select("report_due_day, auto_send")
    .eq("client_id", p.data.clientId)
    .maybeSingle();
  const { error } = await supabase.from("monthly_reports").insert({
    client_id: p.data.clientId,
    month: p.data.month,
    due_on: reportDueOn(p.data.month, profile?.report_due_day ?? 5),
    auto_send: profile?.auto_send ?? false,
    owner_id: me.id,
  });
  if (error) return { ok: false, error: error.code === "23505" ? "That month already has a report." : error.message };
  return done(p.data.clientId);
}

const DraftInput = z.object({ clientId: id, id, summary: optText(), highlights: optText(4000), plan: optText(4000) });

export async function saveReportDraft(raw: unknown): Promise<Result> {
  const p = DraftInput.safeParse(raw);
  if (!p.success) return { ok: false, error: FORM_ERROR };
  if (!(await staff())) return { ok: false, error: NO_ACCESS };
  const { clientId, id: reportId, ...rest } = p.data;
  const supabase = await createClient();
  const err = await changed(
    supabase.from("monthly_reports").update(rest).eq("id", reportId).eq("client_id", clientId).neq("status", "sent").select("id"),
  );
  return err ? { ok: false, error: err } : done(clientId);
}

const MoveInput = z.object({
  clientId: id,
  id,
  to: z.enum(["submitted", "changes", "approved", "sent"]),
  changes_note: optText(),
  /** Send: true records it as sent without emailing (sent by hand). */
  byHand: z.boolean().optional(),
});

export async function moveReport(raw: unknown): Promise<Result> {
  const p = MoveInput.safeParse(raw);
  if (!p.success) return { ok: false, error: FORM_ERROR };
  const { clientId, id: reportId, to, changes_note, byHand } = p.data;
  const me = await staff(to === "submitted" ? "clients.manage" : "clients.reports.approve");
  if (!me) return { ok: false, error: NO_ACCESS };

  const supabase = await createClient();
  const { data: report } = await supabase
    .from("monthly_reports")
    .select("status, month, summary, highlights, plan")
    .eq("id", reportId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (!report) return { ok: false, error: NO_ACCESS };
  if (!canMoveReport(report.status as ReportStatus, to)) return { ok: false, error: "This report can't move to that step." };

  const patch: Record<string, unknown> = { status: to };
  if (to === "changes") Object.assign(patch, { changes_note, had_changes: true });
  if (to === "approved") Object.assign(patch, { approved_by: me.id, approved_at: new Date().toISOString() });
  if (to === "sent") {
    if (!byHand) {
      const [{ data: profile }, { data: client }] = await Promise.all([
        supabase.from("client_success_profiles").select("report_recipient").eq("client_id", clientId).maybeSingle(),
        supabase.from("clients").select("name").eq("id", clientId).maybeSingle(),
      ]);
      const recipient = profile?.report_recipient as string | null | undefined;
      if (!recipient || !recipient.includes("@")) return { ok: false, error: "Add the report recipient's email in Report settings first." };
      const sent = await getMailer().send({
        to: recipient,
        subject: `${client?.name ?? "Your"} report: ${monthLabel(report.month as string)}`,
        text: [report.summary, "Highlights", ...lines(report.highlights as string | null), "Plan", ...lines(report.plan as string | null)]
          .filter(Boolean)
          .join("\n"),
      });
      if (!sent.ok) return sent;
    }
    patch.sent_at = new Date().toISOString();
  }

  const err = await changed(supabase.from("monthly_reports").update(patch).eq("id", reportId).eq("client_id", clientId).select("id"));
  return err ? { ok: false, error: err } : done(clientId);
}

// ---------------------------------------------------------------- QBRs
const QbrInput = z.object({ clientId: id, quarter: z.string().regex(/^\d{4}-Q[1-4]$/), meeting_on: optDate });

export async function createQbr(raw: unknown): Promise<Result> {
  const p = QbrInput.safeParse(raw);
  if (!p.success) return { ok: false, error: FORM_ERROR };
  if (!(await staff())) return { ok: false, error: NO_ACCESS };
  const { clientId, ...rest } = p.data;
  const supabase = await createClient();
  const { error } = await supabase.from("qbrs").insert({ client_id: clientId, ...rest });
  if (error) return { ok: false, error: error.code === "23505" ? "That quarter already has a QBR." : error.message };
  return done(clientId);
}

export async function advanceQbr(raw: unknown): Promise<Result> {
  const p = z.object({ clientId: id, id, from: z.enum(["draft", "ready"]) }).safeParse(raw);
  if (!p.success) return { ok: false, error: FORM_ERROR };
  if (!(await staff())) return { ok: false, error: NO_ACCESS };
  const next = nextQbrStatus(p.data.from as QbrStatus);
  const supabase = await createClient();
  // Matching on the current status stops a double click from skipping a step.
  const err = await changed(
    supabase.from("qbrs").update({ status: next }).eq("id", p.data.id).eq("client_id", p.data.clientId).eq("status", p.data.from).select("id"),
  );
  return err ? { ok: false, error: err === NO_ACCESS ? "This QBR has already moved on. Refresh the page." : err } : done(p.data.clientId);
}

// ---------------------------------------------------------------- delivery ratings
const score = z.number().int().min(1).max(5);
const RatingInput = z.object({
  clientId: id,
  month: date,
  department_id: id,
  quality: score,
  on_time: score,
  communication: score,
  rated_by_name: optText(120),
});

/** Staff record a rating the client gave them (call, email). Client logins rate from the portal with rated_by = themselves. */
export async function saveRating(raw: unknown): Promise<Result> {
  const p = RatingInput.safeParse(raw);
  if (!p.success || !p.data.month.endsWith("-01")) return { ok: false, error: FORM_ERROR };
  const me = await getMe();
  if (!me) return { ok: false, error: NO_ACCESS };
  const isClient = me.kind === "client";
  if (isClient ? me.clientId !== p.data.clientId : !can(me, "clients.manage")) return { ok: false, error: NO_ACCESS };
  const { clientId, ...rest } = p.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("delivery_ratings")
    .upsert(
      { client_id: clientId, ...rest, rated_by: isClient ? me.id : null, rated_by_name: isClient ? me.name : rest.rated_by_name },
      { onConflict: "client_id,month,department_id" },
    );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/portal");
  return done(clientId);
}

/** Emails the client's report recipient asking for this month's rating. Needs an email provider. */
export async function requestRating(raw: unknown): Promise<Result> {
  const p = z.object({ clientId: id, month: date }).safeParse(raw);
  if (!p.success) return { ok: false, error: FORM_ERROR };
  if (!(await staff())) return { ok: false, error: NO_ACCESS };
  const supabase = await createClient();
  const { data: profile } = await supabase.from("client_success_profiles").select("report_recipient").eq("client_id", p.data.clientId).maybeSingle();
  const mailer = getMailer();
  if (!mailer.configured) return mailer.send({ to: "", subject: "", text: "" });
  const to = profile?.report_recipient as string | null | undefined;
  if (!to || !to.includes("@")) return { ok: false, error: "Add the report recipient's email in Report settings first." };
  return mailer.send({
    to,
    subject: `How did we do in ${monthLabel(p.data.month)}?`,
    text: "Please rate our quality, timeliness and communication from 1 to 5 in your client portal.",
  });
}

// ---------------------------------------------------------------- status review (portfolio)
const ReviewInput = z.object({
  rows: z.array(z.object({ clientId: id, status: z.enum(REVIEW_STATUSES), note: text(500) })).min(1).max(500),
});

/** One relationship log note per client. Rows the caller can't write (RLS) are counted, not fatal. */
export async function saveStatusReview(raw: unknown): Promise<Result> {
  const p = ReviewInput.safeParse(raw);
  if (!p.success) return { ok: false, error: FORM_ERROR };
  const me = await staff();
  if (!me) return { ok: false, error: NO_ACCESS };
  const supabase = await createClient();
  const results = await Promise.all(
    p.data.rows.map((r) => supabase.from("relationship_log").insert({ client_id: r.clientId, by_id: me.id, ...reviewLogEntry(r.status, r.note) })),
  );
  const failed = results.filter((r) => r.error).length;
  revalidatePath("/(app)/clients/[id]", "page");
  if (failed === p.data.rows.length) return { ok: false, error: results[0].error?.message ?? NO_ACCESS };
  return failed ? { ok: false, error: `Saved ${p.data.rows.length - failed} of ${p.data.rows.length}. You can't log notes on the rest.` } : { ok: true };
}

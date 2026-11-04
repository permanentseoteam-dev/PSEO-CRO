"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getMe, can } from "@/lib/auth/can";
import { createClient } from "@/lib/supabase/server";
import { MAX_KEY_RESULTS, QUARTER_RE } from "@/lib/modules/team/logic";

type Result = { ok: true } | { ok: false; error: string };
const FORM_ERROR = { ok: false as const, error: "Check the form and try again." };
const NO_ACCESS = { ok: false as const, error: "You don't have access to do that." };

async function staff() {
  const me = await getMe();
  return me && me.kind === "staff" ? me : null;
}

const optText = (max: number) => z.string().trim().max(max).transform((v) => v || null);

// ---------------------------------------------------------------- KPI value

const KpiInput = z.object({ id: z.string().uuid(), value: z.coerce.number().min(0).max(1e9), note: optText(500) });

/** Update one KPI value. RLS allows your own row, or rows of people you manage. */
export async function updateKpiValue(raw: unknown): Promise<Result> {
  const input = KpiInput.safeParse(raw);
  if (!input.success) return FORM_ERROR;
  const me = await staff();
  if (!me) return NO_ACCESS;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kpi_values")
    .update({ value: input.data.value, note: input.data.note, updated_by: me.id })
    .eq("id", input.data.id)
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return NO_ACCESS;
  revalidatePath("/performance");
  return { ok: true };
}

// ---------------------------------------------------------------- self-review

const SelfInput = z.object({
  cycleId: z.string().uuid(),
  wentWell: z.string().trim().min(1).max(4000),
  toImprove: z.string().trim().min(1).max(4000),
  rating: z.coerce.number().int().min(1).max(5),
  nextGoal: optText(500),
});

/** Submit my self-review; it moves on to my manager. */
export async function submitSelfReview(raw: unknown): Promise<Result> {
  const input = SelfInput.safeParse(raw);
  if (!input.success) return FORM_ERROR;
  const me = await staff();
  if (!me) return NO_ACCESS;
  const supabase = await createClient();

  const { data: cycle } = await supabase.from("review_cycles").select("status").eq("id", input.data.cycleId).maybeSingle();
  if (!cycle || cycle.status !== "open") return { ok: false, error: "This review cycle is closed." };
  const { data: existing } = await supabase
    .from("perf_reviews")
    .select("status")
    .eq("cycle_id", input.data.cycleId)
    .eq("member_id", me.id)
    .maybeSingle();
  if (existing && existing.status !== "self_review") return { ok: false, error: "Your self-review is already in." };

  const { error } = await supabase.from("perf_reviews").upsert(
    {
      cycle_id: input.data.cycleId,
      member_id: me.id,
      reviewer_id: me.managerId,
      status: "manager_review",
      went_well: input.data.wentWell,
      to_improve: input.data.toImprove,
      self_rating: input.data.rating,
      next_goal: input.data.nextGoal,
    },
    { onConflict: "cycle_id,member_id" },
  );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/performance");
  return { ok: true };
}

// ---------------------------------------------------------------- OKRs

const ObjectiveInput = z.object({
  title: z.string().trim().min(1).max(200),
  ownerId: z.string().uuid(),
  quarter: z.string().regex(QUARTER_RE),
  keyResults: z
    .array(z.string().trim().max(200))
    .transform((a) => a.filter(Boolean))
    .pipe(z.array(z.string()).min(1).max(MAX_KEY_RESULTS)),
});

export async function createObjective(raw: unknown): Promise<Result> {
  const input = ObjectiveInput.safeParse(raw);
  if (!input.success) return { ok: false, error: `Add a title and 1 to ${MAX_KEY_RESULTS} key results.` };
  const me = await staff();
  if (!me) return NO_ACCESS;
  if (input.data.ownerId !== me.id && !can(me, "performance.manage", "team")) return NO_ACCESS;
  const supabase = await createClient();

  const { data: okr, error } = await supabase
    .from("okrs")
    .insert({ title: input.data.title, owner_id: input.data.ownerId, quarter: input.data.quarter, created_by: me.id })
    .select("id")
    .single();
  if (error || !okr) return { ok: false, error: error?.message ?? NO_ACCESS.error };

  const { error: krErr } = await supabase
    .from("key_results")
    .insert(input.data.keyResults.map((title, i) => ({ okr_id: okr.id, position: i + 1, title })));
  if (krErr) {
    await supabase.from("okrs").delete().eq("id", okr.id);
    return { ok: false, error: krErr.message };
  }
  revalidatePath("/performance");
  return { ok: true };
}

const CheckInInput = z.object({
  keyResultId: z.string().uuid(),
  progress: z.coerce.number().int().min(0).max(100),
  confidence: z.enum(["on_track", "at_risk", "off_track"]),
  note: optText(1000),
});

/** Log a check-in and move the key result's progress and confidence. */
export async function checkIn(raw: unknown): Promise<Result> {
  const input = CheckInInput.safeParse(raw);
  if (!input.success) return FORM_ERROR;
  const me = await staff();
  if (!me) return NO_ACCESS;
  const supabase = await createClient();
  const { keyResultId, progress, confidence, note } = input.data;

  const { data, error } = await supabase.from("key_results").update({ progress, confidence }).eq("id", keyResultId).select("id");
  if (error) return { ok: false, error: error.message };
  if (!data?.length) return NO_ACCESS;
  const { error: logErr } = await supabase
    .from("kr_checkins")
    .insert({ key_result_id: keyResultId, member_id: me.id, progress, confidence, note });
  if (logErr) return { ok: false, error: logErr.message };
  revalidatePath("/performance");
  return { ok: true };
}

// ---------------------------------------------------------------- review cycles

const CycleInput = z.object({ id: z.string().uuid(), status: z.enum(["open", "closed"]) });

export async function setCycleStatus(raw: unknown): Promise<Result> {
  const input = CycleInput.safeParse(raw);
  if (!input.success) return FORM_ERROR;
  const me = await staff();
  if (!me || !can(me, "performance.manage", "all")) return NO_ACCESS;
  const supabase = await createClient();
  const { error } = await supabase.from("review_cycles").update({ status: input.data.status }).eq("id", input.data.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/performance");
  return { ok: true };
}

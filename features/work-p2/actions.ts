"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { can, getMe } from "@/lib/auth/can";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { firstRun, parseTicketKey, wouldCycle } from "./logic";
import { getBlockerEdges, todayIso } from "./queries";
import { FREQUENCIES, SCOPE_STATUSES, type Result } from "./types";

// Every action: zod parse -> can() check -> Supabase write (RLS is the real guard) -> revalidate.
const FORM_ERROR = "Check the form and try again.";
const NO_ACCESS = "You don't have access to do that.";
const bad = { ok: false as const, error: FORM_ERROR };
const no = { ok: false as const, error: NO_ACCESS };

const id = z.uuid();
const isoDate = z.iso.date();

async function staff() {
  const me = await getMe();
  return me && me.kind === "staff" ? me : null;
}

const ticketPage = () => revalidatePath("/t/[key]", "page");
const workloadPage = () => revalidatePath("/tickets");
const recurringPage = () => revalidatePath("/tickets/recurring");

// ---------------------------------------------------------------- workload
const Settings = z.object({
  overloaded_pct: z.coerce.number().int().min(50).max(300),
  overdue_count: z.coerce.number().int().min(0).max(50),
  has_room_pct: z.coerce.number().int().min(0).max(100),
  default_estimate_min: z.coerce.number().int().min(0).max(2400),
});

export async function saveWorkloadSettings(raw: unknown): Promise<Result> {
  const input = Settings.safeParse(raw);
  if (!input.success) return bad;
  const me = await staff();
  if (!me || !can(me, "work.workload.manage", "all")) return no;
  const db = await createClient();
  const { error } = await db.from("workload_settings").upsert({ singleton: true, ...input.data, updated_by: me.id }, { onConflict: "singleton" });
  if (error) return { ok: false, error: error.message };
  workloadPage();
  return { ok: true };
}

const CapacityInput = z.object({
  memberId: id,
  weeklyHours: z.coerce.number().min(0).max(120),
  workdays: z.array(z.coerce.number().int().min(1).max(7)).max(7),
});

export async function saveCapacity(raw: unknown): Promise<Result> {
  const input = CapacityInput.safeParse(raw);
  if (!input.success) return bad;
  const me = await staff();
  if (!me || !can(me, "work.workload.manage")) return no;
  const db = await createClient();
  const d = input.data;
  const { error } = await db
    .from("member_capacity")
    .upsert({ member_id: d.memberId, weekly_hours: d.weeklyHours, workdays: [...new Set(d.workdays)].sort() }, { onConflict: "member_id" });
  if (error) return { ok: false, error: error.message };
  workloadPage();
  return { ok: true };
}

const Handle = z.object({
  memberId: id,
  weekStart: isoDate,
  kind: z.enum(["overloaded", "overdue", "has_room", "unestimated"]),
  moveTicketId: id.optional(),
  moveTo: id.optional(),
});

/** Marks an alert handled. With a ticket and a person, also moves the ticket ("Move to…"). */
export async function handleAlert(raw: unknown): Promise<Result> {
  const input = Handle.safeParse(raw);
  if (!input.success) return bad;
  const me = await staff();
  if (!me || !can(me, "work.workload.manage")) return no;
  const d = input.data;
  const db = await createClient();
  let movedFrom: string | null = null;
  if (d.moveTicketId && d.moveTo) {
    const { data: t } = await db.from("tickets").select("assignee_id").eq("id", d.moveTicketId).maybeSingle();
    if (!t) return { ok: false, error: "That ticket is gone or hidden from you." };
    movedFrom = (t as { assignee_id: string | null }).assignee_id;
    const { error } = await db.from("tickets").update({ assignee_id: d.moveTo }).eq("id", d.moveTicketId);
    if (error) return { ok: false, error: error.message };
  }
  const { error } = await db.from("workload_alerts").upsert(
    {
      member_id: d.memberId,
      week_start: d.weekStart,
      kind: d.kind,
      status: "handled",
      moved_ticket_id: d.moveTo ? (d.moveTicketId ?? null) : null,
      moved_from: movedFrom,
      moved_to: d.moveTo ?? null,
      handled_by: me.id,
    },
    { onConflict: "member_id,week_start,kind" },
  );
  if (error) return { ok: false, error: error.message };
  workloadPage();
  return { ok: true };
}

/** Undo "Handled". If a ticket was moved and still sits with the new person, it goes back. */
export async function undoAlert(raw: unknown): Promise<Result> {
  const input = id.safeParse(raw);
  if (!input.success) return bad;
  const me = await staff();
  if (!me || !can(me, "work.workload.manage")) return no;
  const db = await createClient();
  const { data: row } = await db.from("workload_alerts").select("moved_ticket_id, moved_from, moved_to").eq("id", input.data).maybeSingle();
  const a = row as { moved_ticket_id: string | null; moved_from: string | null; moved_to: string | null } | null;
  if (!a) return { ok: false, error: "That alert is already open." };
  if (a.moved_ticket_id && a.moved_to) {
    const { error } = await db.from("tickets").update({ assignee_id: a.moved_from }).eq("id", a.moved_ticket_id).eq("assignee_id", a.moved_to);
    if (error) return { ok: false, error: error.message };
  }
  const { error } = await db.from("workload_alerts").delete().eq("id", input.data);
  if (error) return { ok: false, error: error.message };
  workloadPage();
  return { ok: true };
}

// ---------------------------------------------------------------- recurring rules
const Rule = z
  .object({
    id: id.optional(),
    templateId: id.nullable().optional(),
    titlePattern: z.string().trim().min(2).max(200),
    description: z.string().trim().max(4000).optional(),
    projectId: id,
    assigneeId: id.nullable(),
    priority: z.enum(["urgent", "high", "normal", "low"]),
    frequency: z.enum(FREQUENCIES),
    weekday: z.coerce.number().int().min(1).max(7).nullable(),
    monthDay: z.coerce.number().int().min(1).max(28).nullable(),
    dueOffsetDays: z.coerce.number().int().min(0).max(90),
    startsOn: isoDate,
  })
  .refine((r) => (r.frequency !== "weekly" || r.weekday) && (r.frequency !== "monthly" || r.monthDay));

export async function saveRule(raw: unknown): Promise<Result> {
  const input = Rule.safeParse(raw);
  if (!input.success) return bad;
  const me = await staff();
  if (!me || !can(me, "work.recurring.manage")) return no;
  const d = input.data;
  if (!can(me, "work.recurring.manage", "team") && d.assigneeId !== me.id) return { ok: false, error: "You can only set up repeats for your own tickets." };
  const shape = {
    frequency: d.frequency,
    weekday: d.frequency === "weekly" ? d.weekday : null,
    month_day: d.frequency === "monthly" ? d.monthDay : null,
  };
  // Phase 1 recurring_rules (0107) keeps weekday / day of month in one `day` column and the start in `start_date`.
  const row = {
    template_id: d.templateId ?? null,
    title_pattern: d.titlePattern,
    description: d.description || null,
    project_id: d.projectId,
    assignee_id: d.assigneeId,
    priority: d.priority,
    frequency: d.frequency,
    day: shape.weekday ?? shape.month_day,
    due_offset_days: d.dueOffsetDays,
    start_date: d.startsOn,
    next_run: firstRun({ ...shape, starts_on: d.startsOn }, todayIso()),
  };
  const db = await createClient();
  const { error } = d.id
    ? await db.from("recurring_rules").update(row).eq("id", d.id)
    : await db.from("recurring_rules").insert({ ...row, created_by: me.id });
  if (error) return { ok: false, error: error.message };
  recurringPage();
  return { ok: true };
}

export async function setRulePaused(raw: unknown): Promise<Result> {
  const input = z.object({ id, paused: z.boolean() }).safeParse(raw);
  if (!input.success) return bad;
  const me = await staff();
  if (!me || !can(me, "work.recurring.manage")) return no;
  const db = await createClient();
  const { data: rule } = await db.from("recurring_rules").select("frequency, day, start_date").eq("id", input.data.id).maybeSingle();
  if (!rule) return { ok: false, error: "That rule is gone or hidden from you." };
  const raw0 = rule as { frequency: (typeof FREQUENCIES)[number]; day: number | null; start_date: string };
  const r = {
    frequency: raw0.frequency,
    weekday: raw0.frequency === "weekly" ? raw0.day : null,
    month_day: raw0.frequency === "monthly" ? raw0.day : null,
    starts_on: raw0.start_date,
  };
  const patch = input.data.paused ? { paused: true } : { paused: false, next_run: firstRun(r, todayIso()) };
  const { error } = await db.from("recurring_rules").update(patch).eq("id", input.data.id);
  if (error) return { ok: false, error: error.message };
  recurringPage();
  return { ok: true };
}

export async function deleteRule(raw: unknown): Promise<Result> {
  const input = id.safeParse(raw);
  if (!input.success) return bad;
  const me = await staff();
  if (!me || !can(me, "work.recurring.manage")) return no;
  const db = await createClient();
  const { error } = await db.from("recurring_rules").delete().eq("id", input.data);
  if (error) return { ok: false, error: error.message };
  recurringPage();
  return { ok: true };
}

/** "Run due rules now": same job pg_cron runs nightly. Admin only; uses the service client after the check. */
export async function runDueRules(): Promise<Result<{ made: number }>> {
  const me = await staff();
  if (!me || !can(me, "work.recurring.manage", "all")) return no;
  const { data, error } = await createAdminClient().rpc("run_recurring_rules", { today: todayIso() });
  if (error) return { ok: false, error: error.message };
  recurringPage();
  workloadPage();
  return { ok: true, data: { made: Number(data ?? 0) } };
}

// ---------------------------------------------------------------- dependencies
const AddBlocker = z.object({ ticketId: id, key: z.string().max(20), direction: z.enum(["blocked_by", "blocks"]) });

export async function addDependency(raw: unknown): Promise<Result> {
  const input = AddBlocker.safeParse(raw);
  if (!input.success) return bad;
  const key = parseTicketKey(input.data.key);
  if (!key) return { ok: false, error: "Type a ticket key like CPD-139." };
  const me = await staff();
  if (!me) return no;
  const db = await createClient();
  const { data: other } = await db.from("tickets").select("id").eq("key", key).maybeSingle();
  if (!other) return { ok: false, error: `No ticket ${key} that you can see.` };
  const otherId = (other as { id: string }).id;
  const [ticketId, blockerId] = input.data.direction === "blocked_by" ? [input.data.ticketId, otherId] : [otherId, input.data.ticketId];
  if (wouldCycle(await getBlockerEdges(), ticketId, blockerId)) return { ok: false, error: "That would make the tickets wait on each other." };
  const { error } = await db.from("ticket_blockers").insert({ ticket_id: ticketId, blocked_by_id: blockerId, created_by: me.id });
  if (error) return { ok: false, error: error.code === "23505" ? "That link is already there." : error.message };
  ticketPage();
  return { ok: true };
}

export async function removeDependency(raw: unknown): Promise<Result> {
  const input = id.safeParse(raw);
  if (!input.success) return bad;
  if (!(await staff())) return no;
  const db = await createClient();
  const { error } = await db.from("ticket_blockers").delete().eq("id", input.data);
  if (error) return { ok: false, error: error.message };
  ticketPage();
  return { ok: true };
}

// ---------------------------------------------------------------- co-assignees and watchers
const People = z.object({ ticketId: id, kind: z.enum(["co", "watch"]), memberIds: z.array(id).max(50) });

/** Replaces the co-assignee or watcher list of a ticket with `memberIds`. */
export async function setTicketPeople(raw: unknown): Promise<Result> {
  const input = People.safeParse(raw);
  if (!input.success) return bad;
  const me = await staff();
  if (!me) return no;
  const { ticketId, kind, memberIds } = input.data;
  const db = await createClient();
  if (kind === "co") {
    // Co-assignees live on tickets.co_assignee_ids (0106_tickets).
    const { error } = await db.from("tickets").update({ co_assignee_ids: [...new Set(memberIds)] }).eq("id", ticketId);
    if (error) return { ok: false, error: error.message };
    ticketPage();
    revalidatePath("/my");
    return { ok: true };
  }
  const table = "ticket_watchers";
  const { data } = await db.from(table).select("member_id").eq("ticket_id", ticketId);
  const current = ((data ?? []) as { member_id: string }[]).map((r) => r.member_id);
  const want = new Set(memberIds);
  const drop = current.filter((m) => !want.has(m));
  const add = [...want].filter((m) => !current.includes(m));
  if (drop.length) {
    const { error } = await db.from(table).delete().eq("ticket_id", ticketId).in("member_id", drop);
    if (error) return { ok: false, error: error.message };
  }
  if (add.length) {
    const { error } = await db.from(table).insert(add.map((member_id) => ({ ticket_id: ticketId, member_id })));
    if (error) return { ok: false, error: error.message };
  }
  ticketPage();
  revalidatePath("/my");
  return { ok: true };
}

// ---------------------------------------------------------------- client card
const Card = z.object({
  ticketId: id,
  clientId: id,
  showInPortal: z.boolean(),
  clientTitle: z.string().trim().max(200),
  clientDetails: z.string().trim().max(4000),
  needsApproval: z.boolean(),
  sharedFileIds: z.array(id).max(100),
});

export async function saveClientCard(raw: unknown): Promise<Result> {
  const input = Card.safeParse(raw);
  if (!input.success) return bad;
  const d = input.data;
  if (d.showInPortal && !d.clientTitle) return { ok: false, error: "Add a title the client will see." };
  const me = await staff();
  if (!me) return no;
  const db = await createClient();
  // The client card lives on the ticket (0106 client_visible / client_title, 0204 adds the rest).
  const { error } = await db
    .from("tickets")
    .update({
      client_visible: d.showInPortal,
      client_title: d.clientTitle || null,
      client_details: d.clientDetails || null,
      client_needs_approval: d.needsApproval,
      client_file_ids: d.sharedFileIds,
    })
    .eq("id", d.ticketId);
  if (error) return { ok: false, error: error.message };
  ticketPage();
  revalidatePath("/portal/work");
  return { ok: true };
}

// ---------------------------------------------------------------- scope flag
const Scope = z.object({
  ticketId: id,
  clientId: id,
  status: z.enum(SCOPE_STATUSES),
  matchedTerm: z.string().max(300).nullable(),
  reason: z.string().trim().max(1000),
});

export async function saveScopeFlag(raw: unknown): Promise<Result> {
  const input = Scope.safeParse(raw);
  if (!input.success) return bad;
  const me = await staff();
  if (!me) return no;
  const d = input.data;
  const db = await createClient();
  const { error } = await db.from("ticket_scope_flags").upsert(
    { ticket_id: d.ticketId, client_id: d.clientId, status: d.status, matched_term: d.matchedTerm, reason: d.reason || null, flagged_by: me.id },
    { onConflict: "ticket_id" },
  );
  if (error) return { ok: false, error: error.message };
  ticketPage();
  return { ok: true };
}

"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getMe, can } from "@/lib/auth/can";
import { createClient } from "@/lib/supabase/server";
import { lines, parseActions, parseConcerns } from "@/lib/modules/clientops/logic";
import { listStaff } from "@/lib/modules/clientops/queries";

const FORM_ERROR = { ok: false as const, error: "Check the form and try again." };
const NO_ACCESS = { ok: false as const, error: "You don't have access to do that." };

async function staff() {
  const me = await getMe();
  return me && me.kind === "staff" && can(me, "clients.view") ? me : null;
}

function refresh() {
  revalidatePath("/meetings");
}

// ---------------------------------------------------------------- log notes
const LogInput = z.object({
  clientId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().max(4000),
  decisions: z.string().max(4000),
  concerns: z.string().max(4000),
  actions: z.string().max(4000),
});

export async function logMeeting(raw: unknown) {
  const input = LogInput.safeParse(raw);
  if (!input.success) return FORM_ERROR;
  const me = await staff();
  if (!me) return NO_ACCESS;
  const v = input.data;
  const supabase = await createClient();
  const { data: meeting, error } = await supabase
    .from("meetings")
    .insert({
      client_id: v.clientId,
      title: v.title,
      held_at: `${v.date}T12:00:00+04:00`,
      our_people: [me.id],
      summary: v.summary || null,
      decisions: lines(v.decisions),
      concerns: parseConcerns(v.concerns),
      status: "to_review",
      created_by: me.id,
    })
    .select("id")
    .single();
  if (error || !meeting) return { ok: false as const, error: error?.message ?? "Could not save the notes." };

  const parsed = parseActions(v.actions, await listStaff(supabase));
  if (parsed.length) {
    const { error: e2 } = await supabase.from("meeting_actions").insert(
      parsed.map((a, i) => ({
        meeting_id: meeting.id,
        position: i,
        title: a.title.slice(0, 300),
        owner_name: a.ownerName,
        assignee_id: a.assigneeId,
        // Our people get tickets; a named owner we don't know is the client's to-do.
        outcome: a.ownerName && !a.assigneeId ? "todo" : "ticket",
      })),
    );
    if (e2) return { ok: false as const, error: e2.message };
  }
  refresh();
  return { ok: true as const };
}

// ---------------------------------------------------------------- review: tickets, to-dos, skip
const ReviewInput = z.object({
  meetingId: z.string().uuid(),
  outcomes: z.array(z.object({ id: z.string().uuid(), outcome: z.enum(["ticket", "todo", "skip"]) })).max(100),
});

export async function reviewMeeting(raw: unknown) {
  const input = ReviewInput.safeParse(raw);
  if (!input.success) return FORM_ERROR;
  const me = await staff();
  if (!me) return NO_ACCESS;
  const { meetingId, outcomes } = input.data;
  const wantsTickets = outcomes.some((o) => o.outcome === "ticket");
  if (wantsTickets && !can(me, "tickets.manage")) return { ok: false as const, error: "You can't create tickets. Choose Client's to-do or Skip." };

  const supabase = await createClient();
  const { data: m } = await supabase
    .from("meetings")
    .select("id, client_id, title, held_at, status, meeting_actions(id, title, assignee_id, ticket_id)")
    .eq("id", meetingId)
    .maybeSingle();
  if (!m || !m.client_id) return { ok: false as const, error: "Meeting not found." };
  if (m.status !== "to_review") return { ok: false as const, error: "These notes were already reviewed." };

  // A project of this client gives the tickets its key prefix (ALB-…); none means TK-….
  const { data: project } = await supabase.from("projects").select("id").eq("client_id", m.client_id).eq("status", "active").limit(1).maybeSingle();

  const acts = new Map((m.meeting_actions ?? []).map((a: { id: string; title: string; assignee_id: string | null; ticket_id: string | null }) => [a.id, a]));
  let created = 0;
  for (const o of outcomes) {
    const a = acts.get(o.id);
    if (!a) continue;
    let ticketId = a.ticket_id;
    if (o.outcome === "ticket" && !ticketId) {
      const { data: t, error } = await supabase
        .from("tickets")
        .insert({
          title: a.title.slice(0, 200),
          client_id: m.client_id,
          project_id: project?.id ?? null,
          assignee_id: a.assignee_id,
          reporter_id: me.id,
          source: "meeting",
          description: `From the meeting "${m.title}" on ${String(m.held_at).slice(0, 10)}.`,
        })
        .select("id")
        .single();
      if (error || !t) return { ok: false as const, error: `Ticket for "${a.title}" failed: ${error?.message ?? "unknown error"}` };
      ticketId = t.id;
      created++;
    }
    const { error } = await supabase.from("meeting_actions").update({ outcome: o.outcome, ticket_id: ticketId }).eq("id", o.id);
    if (error) return { ok: false as const, error: error.message };
  }

  const { error } = await supabase
    .from("meetings")
    .update({ status: "reviewed", reviewed_by: me.id, reviewed_at: new Date().toISOString() })
    .eq("id", meetingId);
  if (error) return { ok: false as const, error: error.message };
  refresh();
  revalidatePath("/tickets");
  return { ok: true as const, created };
}

// ---------------------------------------------------------------- no client yet
const AssignInput = z.object({ meetingId: z.string().uuid(), clientId: z.string().uuid() });

export async function assignClient(raw: unknown) {
  const input = AssignInput.safeParse(raw);
  if (!input.success) return { ok: false as const, error: "Choose a client first." };
  const me = await staff();
  if (!me) return NO_ACCESS;
  const supabase = await createClient();
  const { error } = await supabase.from("meetings").update({ client_id: input.data.clientId }).eq("id", input.data.meetingId).is("client_id", null);
  if (error) return { ok: false as const, error: error.message };
  refresh();
  return { ok: true as const };
}

export async function markNotClient(raw: unknown) {
  const input = z.object({ meetingId: z.string().uuid() }).safeParse(raw);
  if (!input.success) return FORM_ERROR;
  const me = await staff();
  if (!me) return NO_ACCESS;
  const supabase = await createClient();
  const { error } = await supabase.from("meetings").update({ status: "not_client" }).eq("id", input.data.meetingId).is("client_id", null);
  if (error) return { ok: false as const, error: error.message };
  refresh();
  return { ok: true as const };
}

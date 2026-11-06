import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Omitted = project originator; explicit null = deliberately unassigned. Never use the current user. */
export async function newTicketAssignee(db: SupabaseClient, projectId: string | null | undefined, requested: string | null | undefined): Promise<string | null> {
  if (requested !== undefined) return requested;
  if (!projectId) return null;
  // Read * so installations awaiting the additive originator migration still create tasks safely.
  const { data: project } = await db.from("projects").select("*").eq("id", projectId).maybeSingle();
  const creatorId = project?.created_by;
  if (typeof creatorId !== "string") return null;
  const { data: creator } = await db.from("members").select("id").eq("id", creatorId).eq("kind", "staff").eq("status", "active").maybeSingle();
  return creator?.id ?? null;
}

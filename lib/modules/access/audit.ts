import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Append a line to the audit log as the signed-in user. Other modules may call this
 * (e.g. "Voided invoice INV-1042"). Failures are swallowed: the audit line must never block the action.
 */
export async function logAudit(
  supabase: SupabaseClient,
  actorId: string | null,
  entry: { action: string; summary: string; targetType?: string; targetId?: string; clientId?: string | null; meta?: Record<string, unknown> },
) {
  await supabase.from("audit_log").insert({
    actor_id: actorId,
    action: entry.action,
    summary: entry.summary,
    target_type: entry.targetType ?? null,
    target_id: entry.targetId ?? null,
    client_id: entry.clientId ?? null,
    meta: entry.meta ?? {},
  });
}

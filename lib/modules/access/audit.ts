import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Append a line to the audit log. Other modules may call this (e.g. "Voided invoice INV-1042").
 * Writes with the service role so browsers can't forge lines; actorId must come from a server-checked getMe().
 * `_supabase` is unused and kept so callers don't change. Failures are swallowed: the audit line must never block the action.
 */
export async function logAudit(
  _supabase: SupabaseClient,
  actorId: string | null,
  entry: { action: string; summary: string; targetType?: string; targetId?: string; clientId?: string | null; meta?: Record<string, unknown> },
) {
  try {
    await createAdminClient().from("audit_log").insert({
      actor_id: actorId,
      action: entry.action,
      summary: entry.summary,
      target_type: entry.targetType ?? null,
      target_id: entry.targetId ?? null,
      client_id: entry.clientId ?? null,
      meta: entry.meta ?? {},
    });
  } catch {
    // best effort
  }
}

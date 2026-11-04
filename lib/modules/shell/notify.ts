import "server-only";
import { createClient } from "@/lib/supabase/server";

export type NotifyInput = {
  /** Recipients (member ids). The signed-in user is skipped. */
  to: string[];
  kind: "ticket" | "mention" | "review" | "invoice" | "client" | "meeting" | "chat" | "system";
  /** "moved", "mentioned you on" */
  action: string;
  /** Shown bold: "CPD-142" */
  subject?: string;
  /** "to In review" */
  detail?: string;
  /** Where a click goes, e.g. "/t/CPD-142" */
  href?: string;
};

/**
 * Sends a bell notification from the signed-in user. Call it from other modules' server actions:
 * `await notify({ to: [assigneeId], kind: "ticket", action: "assigned you", subject: "CPD-142", href: "/t/CPD-142" })`.
 * Never throws; a failed notification must not fail the action that sent it.
 */
export async function notify(n: NotifyInput): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const actor = data.user?.id;
  if (!actor) return;
  const rows = [...new Set(n.to)]
    .filter((id) => id !== actor)
    .map((member_id) => ({
      member_id,
      actor_id: actor,
      kind: n.kind,
      action: n.action,
      subject: n.subject ?? null,
      detail: n.detail ?? null,
      href: n.href ?? null,
    }));
  if (rows.length) await supabase.from("notifications").insert(rows);
}

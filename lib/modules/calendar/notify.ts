import type { createClient } from "@/lib/supabase/server";
import { fmt12 } from "@/lib/format-time";
import { fmtShort } from "./logic";

/** In-app invite notices (0101_shell). Email invites wait for the email service. */
export async function notify(
  supabase: Awaited<ReturnType<typeof createClient>>,
  actorId: string,
  memberIds: string[],
  action: string,
  title: string,
  date: string,
  start: string,
) {
  if (!memberIds.length) return;
  await supabase.from("notifications").insert(
    memberIds.map((id) => ({
      member_id: id,
      actor_id: actorId,
      kind: "meeting",
      action,
      subject: title,
      detail: `for ${fmtShort(date)} ${fmt12(start)}`,
      href: `/calendar?view=day&d=${date}`,
    })),
  );
}

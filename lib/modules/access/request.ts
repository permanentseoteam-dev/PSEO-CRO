"use server";
import { z } from "zod";
import { getMe, requireMe, can } from "@/lib/auth/can";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/modules/shell/notify";
import { ADMIN_ROLES, REQUEST_ACTION, DEDUPE_MS, accessNotice, alreadyAsked, pickAdmins } from "./request-logic";

type Db = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>;

async function admins(db: Db, meId: string) {
  const { data } = await db
    .from("member_roles")
    .select("member_id, member:members!inner(name, status, kind)")
    .in("role", [...ADMIN_ROLES]);
  return pickAdmins((data ?? []) as Parameters<typeof pickAdmins>[0], meId);
}

/**
 * Who can help on the no-access screen. Staff get the active admins (not themselves) and whether they
 * can message them; client logins get an empty list.
 */
export async function accessHelp(): Promise<{ admins: { id: string; name: string }[]; canMessage: boolean }> {
  const me = await getMe();
  if (!me || me.kind !== "staff") return { admins: [], canMessage: false };
  return { admins: await admins(await createClient(), me.id), canMessage: can(me, "chat.use") };
}

const RequestIn = z.object({ path: z.string().startsWith("/").max(300), title: z.string().trim().min(1).max(120) });

/** Bell notification to every active admin: "{name} asked for access to {title}". Once per path per 24h. */
export async function requestAccess(raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const p = RequestIn.safeParse(raw);
  if (!p.success) return { ok: false, error: "Check the form and try again." };
  const me = await requireMe();
  // Service client: client logins can't read member_roles, and nobody can read notifications they sent.
  const db = createAdminClient();

  const { data: sent } = await db
    .from("notifications")
    .select("action, detail, created_at")
    .eq("actor_id", me.id)
    .eq("action", REQUEST_ACTION)
    .gte("created_at", new Date(Date.now() - DEDUPE_MS).toISOString());
  if (alreadyAsked(sent ?? [], p.data.path, new Date())) return { ok: true };

  const to = (await admins(db, me.id)).map((a) => a.id);
  if (!to.length) return { ok: false, error: "There's no admin to ask yet." };
  await notify({ to, ...accessNotice({ requesterId: me.id, title: p.data.title, path: p.data.path }) });
  return { ok: true };
}

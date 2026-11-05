"use server";

import { z } from "zod";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getMe, can } from "@/lib/auth/can";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/modules/access/audit";
import { newPreview, PREVIEW_COOKIE, PREVIEW_TTL_MS, signPreview } from "@/lib/modules/portal/preview";

type Result = { ok: false; error: string };

/**
 * "See as client": staff with clients.view on this client get a signed 30-minute read-only preview
 * of the client's portal, then land on /portal/home.
 */
export async function startClientPreview(raw: unknown): Promise<Result> {
  const p = z.string().uuid().safeParse(raw);
  if (!p.success) return { ok: false, error: "Check the form and try again." };
  const me = await getMe();
  if (!me || me.kind !== "staff" || !can(me, "clients.view")) return { ok: false, error: "You don't have access to do that." };

  // RLS decides whether this staff member's clients.view scope covers this client.
  const supabase = await createClient();
  const { data: client } = await supabase.from("clients").select("id, name").eq("id", p.data).maybeSingle();
  if (!client) return { ok: false, error: "You don't have access to do that." };

  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) return { ok: false, error: "Preview is not set up on this server." };

  const payload = newPreview(client.id, me.id);
  (await cookies()).set(PREVIEW_COOKIE, signPreview(payload, secret), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: PREVIEW_TTL_MS / 1000,
  });
  await logAudit(supabase, me.id, {
    action: "client.preview",
    summary: `Opened the portal as ${client.name} (read-only, 30 min)`,
    targetType: "client",
    targetId: client.id,
    clientId: client.id,
    meta: { expiresAt: new Date(payload.exp).toISOString() },
  });
  redirect("/portal/home");
}

/** Ends the preview and goes back to the client's page. */
export async function exitClientPreview(raw: unknown): Promise<void> {
  (await cookies()).delete(PREVIEW_COOKIE);
  const id = z.string().uuid().safeParse(raw);
  redirect(id.success ? `/clients/${id.data}` : "/clients");
}

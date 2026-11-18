// "See as client": a staff member views one client's portal, read-only, for 30 minutes.
// Pure helpers (no Next or Supabase imports) so the proxy, server code and tests share them.
import { createHmac, timingSafeEqual } from "node:crypto";
import { can, type Me } from "@/lib/auth/perms";

export const PREVIEW_COOKIE = "portal_preview";
export const PREVIEW_TTL_MS = 30 * 60 * 1000;
export const READ_ONLY = "Read-only preview";

/** Cookie payload. `exp` is epoch milliseconds. */
export type PreviewPayload = { clientId: string; staffId: string; exp: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const mac = (body: string, secret: string) => createHmac("sha256", secret).update(body).digest("base64url");

export function newPreview(clientId: string, staffId: string, now = Date.now()): PreviewPayload {
  return { clientId, staffId, exp: now + PREVIEW_TTL_MS };
}

/** `<base64url json>.<base64url hmac-sha256>` */
export function signPreview(p: PreviewPayload, secret: string): string {
  if (!secret) throw new Error("Missing signing secret");
  const body = Buffer.from(JSON.stringify({ clientId: p.clientId, staffId: p.staffId, exp: p.exp })).toString("base64url");
  return `${body}.${mac(body, secret)}`;
}

/** The payload when the signature is right and it has not expired; otherwise null. */
export function verifyPreview(token: string | null | undefined, secret: string | null | undefined, now = Date.now()): PreviewPayload | null {
  if (!token || !secret) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  const [body, sig] = parts;
  const want = Buffer.from(mac(body, secret));
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;

  let p: unknown;
  try {
    p = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!p || typeof p !== "object") return null;
  const { clientId, staffId, exp } = p as Record<string, unknown>;
  if (typeof clientId !== "string" || !UUID.test(clientId)) return null;
  if (typeof staffId !== "string" || !UUID.test(staffId)) return null;
  if (typeof exp !== "number" || !Number.isFinite(exp)) return null;
  if (exp <= now || exp > now + PREVIEW_TTL_MS + 60_000) return null;
  return { clientId, staffId, exp };
}

/**
 * Which client a portal request shows.
 * - client login: its own client (a preview cookie is ignored);
 * - staff with a valid preview of their own and clients.view: the cookie's client;
 * - anyone else: none (the portal sends them to /home).
 */
export type PortalScope =
  | { mode: "client"; clientId: string | null }
  | { mode: "preview"; clientId: string; staffId: string; exp: number }
  | { mode: "none" };

export function resolvePortalScope(me: Pick<Me, "id" | "kind" | "clientId" | "perms">, preview: PreviewPayload | null): PortalScope {
  if (me.kind === "client") return { mode: "client", clientId: me.clientId };
  if (preview && preview.staffId === me.id && can(me, "clients.view")) {
    return { mode: "preview", clientId: preview.clientId, staffId: preview.staffId, exp: preview.exp };
  }
  return { mode: "none" };
}

/**
 * The staff perm (and scope) a preview reader needs for each portal perm used with portalDb. The preview
 * reads with the service client, so without this a staff member could read what the client's owner can,
 * not what they can. Scopes follow the staff RLS: "all" where the policy narrows "own"/"team" to rows the
 * preview's service client would not narrow (invoices by owner/manager, tickets by assignee).
 * portal.approve: approvals_select lets any staff who sees the client read them (clients.view, already
 * required by resolvePortalScope). chat.use: listPreviewMessages also keeps to the staff member's channels
 * unless chat.use is "all". Unknown perms fail closed.
 */
const STAFF_EQUIVALENT: Record<string, { perm: string; scope: "own" | "all" }> = {
  "finance.invoices.view": { perm: "finance.invoices.view", scope: "all" },
  "tickets.view": { perm: "tickets.view", scope: "all" },
  "portal.approve": { perm: "clients.view", scope: "own" },
  "chat.use": { perm: "chat.use", scope: "own" },
};

/** True when the previewing staff member may read data the portal gates behind `portalPerm`. */
export function staffMayPreview(staff: Pick<Me, "perms">, portalPerm: string): boolean {
  const eq = STAFF_EQUIVALENT[portalPerm];
  return !!eq && can(staff, eq.perm, eq.scope);
}

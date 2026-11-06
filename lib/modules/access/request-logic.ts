// Pure helpers for "Request access" on the no-access screen. Shared by the server action and tests.

/** Roles whose holders get access requests and show up as "who can help". */
export const ADMIN_ROLES = ["admin", "super_admin"] as const;

export const REQUEST_ACTION = "asked for access to";
export const DEDUPE_MS = 24 * 60 * 60 * 1000;

const SITE_SUFFIX = " · Permanent SEO";

/** "Clients · Permanent SEO" -> "Clients"; falls back to the path when the tab has no page title. */
export function pageTitleFrom(docTitle: string, path: string): string {
  const t = docTitle.endsWith(SITE_SUFFIX) ? docTitle.slice(0, -SITE_SUFFIX.length) : docTitle;
  const clean = t.trim();
  return clean && clean !== "Permanent SEO" ? clean.slice(0, 120) : path;
}

/** Detail line; also the dedupe key for a path. */
export const requestDetail = (path: string) => `(${path})`;

/**
 * The bell row each admin gets. The bell shows "{actor} {action} {subject} {detail}", e.g.
 * "Sara Khan asked for access to Clients (/clients)", and a click opens the person's access page.
 */
export function accessNotice(input: { requesterId: string; title: string; path: string }) {
  return {
    kind: "system" as const,
    action: REQUEST_ACTION,
    subject: input.title,
    detail: requestDetail(input.path),
    href: `/admin/people/${input.requesterId}`,
  };
}

/** Plain-text version of the bell row (for tests and logs). */
export function accessMessage(name: string, title: string, path: string) {
  return `${name} ${REQUEST_ACTION} ${title} ${requestDetail(path)}`;
}

/** True when one of my earlier requests (rows I sent) was for this path within the last 24h. */
export function alreadyAsked(rows: { action: string; detail: string | null; created_at: string }[], path: string, now: Date): boolean {
  const since = now.getTime() - DEDUPE_MS;
  const key = requestDetail(path);
  return rows.some((r) => r.action === REQUEST_ACTION && r.detail === key && new Date(r.created_at).getTime() >= since);
}

/** Unique, active staff admins, minus me, sorted by name. */
export function pickAdmins(
  rows: { member_id: string; member: { name: string; status: string; kind: string } | { name: string; status: string; kind: string }[] | null }[],
  meId: string,
): { id: string; name: string }[] {
  const out = new Map<string, string>();
  for (const r of rows) {
    const m = Array.isArray(r.member) ? r.member[0] : r.member;
    if (!m || m.status !== "active" || m.kind !== "staff" || r.member_id === meId) continue;
    out.set(r.member_id, m.name);
  }
  return [...out].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}

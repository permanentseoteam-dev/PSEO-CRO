// Pure shell logic: page titles, nav filtering, clock and timer maths. No I/O.
import type { NavGroup } from "@/lib/nav";
import { STAFF_NAV, PORTAL_NAV } from "@/lib/nav";
import { can, type Me } from "@/lib/auth/perms";
import type { ClockSession, Presence, Theme } from "./types";

export const MAX_PINS = 12;
export const WORKDAY_MIN = 8 * 60;

export const PRESENCE: { value: Presence; label: string; tone: "ok" | "violet" | "blue" | "warn" | "danger" }[] = [
  { value: "available", label: "Available", tone: "ok" },
  { value: "meeting", label: "Meeting", tone: "violet" },
  { value: "focus", label: "Focus", tone: "blue" },
  { value: "away", label: "Away", tone: "warn" },
  { value: "sick", label: "Sick", tone: "danger" },
];

/** Title overrides (where the top bar differs from the sidebar label) and the "?" help text, by href. */
const PAGES: Record<string, { title?: string; desc: string }> = {
  "/home": { desc: "Your day at a glance: due work, reviews waiting on you, meetings and client health." },
  "/my": { desc: "Every ticket assigned to you, grouped by due date." },
  "/calendar": { desc: "Due dates, meetings and leave across the team." },
  "/chat": { desc: "Team and client conversations, updated live." },
  "/tickets": { desc: "All tickets across projects, as a list or a board." },
  "/projects": { desc: "Client projects with leads, progress and budgets." },
  "/reviews": { desc: "Work waiting for approval before it goes to the client." },
  "/templates": { desc: "Reusable ticket checklists for repeat work." },
  "/clients": { title: "Clients", desc: "Every client with health, services, owner and fee." },
  "/response-times": { desc: "How fast we answer client emails and messages." },
  "/meetings": { desc: "Client meetings with notes and action items." },
  "/files": { desc: "Shared files and deliverables by client." },
  "/finance": { title: "Finance", desc: "Revenue, outstanding balances and cash flow." },
  "/finance/invoices": { desc: "Draft, sent, paid and overdue invoices." },
  "/finance/profitability": { desc: "Fee against time cost for each client." },
  "/finance/payments": { desc: "Payments received and how they were matched." },
  "/finance/clients": { desc: "Billing details and currency for each client." },
  "/finance/reminders": { title: "Payment reminders", desc: "Automatic reminders for unpaid invoices." },
  "/finance/settings": { title: "Finance setup", desc: "Entities, payment channels and exchange rates." },
  "/people": { desc: "Everyone on the team and how to reach them." },
  "/people/org": { desc: "Who reports to whom." },
  "/performance": { desc: "Delivery, on-time rate and review scores by person." },
  "/me": { desc: "Your details, skills and working hours." },
  "/time": { desc: "Your timesheet and logged hours." },
  "/settings": { desc: "Theme, density, notifications and account settings." },
  "/admin": { title: "Admin", desc: "Roles, permissions, invites and the audit log." },
  "/portal": { desc: "What is happening on your account right now." },
  "/portal/work": { desc: "Work in progress and work waiting for your approval." },
  "/portal/meetings": { desc: "Upcoming and past meetings with our team." },
  "/portal/files": { desc: "Reports and deliverables we have shared with you." },
  "/portal/invoices": { desc: "Your invoices and payment status." },
  "/portal/messages": { desc: "Message your account team." },
};

/** Detail routes reached by links, matched before the sidebar prefixes. */
const DETAIL: { re: RegExp; title: string; desc: string }[] = [
  { re: /^\/t\/[^/]+/, title: "Ticket", desc: "Details, checklist, comments and time for this ticket." },
  { re: /^\/clients\/[^/]+/, title: "Client", desc: "Everything about this client in one place." },
  { re: /^\/people\/(?!org(\/|$))[^/]+/, title: "Person", desc: "Role, team, skills and contact details." },
  { re: /^\/finance\/invoices\/[^/]+/, title: "Invoice", desc: "Lines, payments and history for this invoice." },
];

const NAV_TITLES = new Map([...STAFF_NAV, ...PORTAL_NAV].flatMap((g) => g.items.map((i) => [i.href, i.title] as const)));
const KNOWN = [...new Set([...NAV_TITLES.keys(), ...Object.keys(PAGES)])].sort((a, b) => b.length - a.length);

/** Title and help text for a pathname: detail routes first, then the longest known prefix. */
export function pageFor(pathname: string): { title: string; desc: string } {
  const path = pathname.replace(/\/+$/, "") || "/";
  for (const d of DETAIL) if (d.re.test(path)) return { title: d.title, desc: d.desc };
  const href = KNOWN.find((h) => path === h || path.startsWith(h + "/"));
  if (!href) return { title: "Permanent SEO", desc: "" };
  const p = PAGES[href];
  return { title: p?.title ?? NAV_TITLES.get(href) ?? "Permanent SEO", desc: p?.desc ?? "" };
}

/** The nav item a pathname belongs to (longest matching href), for the active link. */
export function activeHref(pathname: string, hrefs: string[]): string | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  let best: string | null = null;
  for (const h of hrefs) if ((path === h || path.startsWith(h + "/")) && (!best || h.length > best.length)) best = h;
  return best;
}

/** Nav groups with the items this person may see; empty groups are dropped. */
export function visibleNav(groups: NavGroup[], me: Pick<Me, "perms">): NavGroup[] {
  return groups
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.perm || can(me, i.perm)) }))
    .filter((g) => g.items.length > 0);
}

export const nextTheme = (t: Theme): Theme => ({ system: "light", light: "dark", dark: "system" } as const)[t];

const sameLocalDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Today's clock-in sessions (local day of `now`), oldest first. */
export function todaySessions(sessions: ClockSession[], now: Date): ClockSession[] {
  return sessions
    .filter((s) => sameLocalDay(new Date(s.clockIn), now))
    .sort((a, b) => a.clockIn.localeCompare(b.clockIn));
}

/** Minutes worked across sessions; an open session counts up to `now`. */
export function workedMinutes(sessions: ClockSession[], now: Date): number {
  let ms = 0;
  for (const s of sessions) {
    const end = s.clockOut ? new Date(s.clockOut).getTime() : now.getTime();
    ms += Math.max(0, end - new Date(s.clockIn).getTime());
  }
  return Math.floor(ms / 60000);
}

/** "5h 41m", "45m". */
export function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

/** "00:23:10" from seconds. */
export function fmtClock(secs: number): string {
  const s = Math.max(0, Math.floor(secs));
  return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((n) => String(n).padStart(2, "0")).join(":");
}

/** Minutes a stopped timer logs: whole minutes, and nothing under 1 minute. */
export function timerMinutes(startedAt: string, stoppedAt: Date): number {
  const min = Math.floor((stoppedAt.getTime() - new Date(startedAt).getTime()) / 60000);
  return min >= 1 ? min : 0;
}

/** "Just now", "6 min ago", "2 h ago", "Yesterday", "1 Nov". */
export function timeAgo(iso: string, now: Date): string {
  const then = new Date(iso);
  const min = Math.floor((now.getTime() - then.getTime()) / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  if (sameLocalDay(then, now)) return `${Math.floor(min / 60)} h ago`;
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  if (sameLocalDay(then, y)) return "Yesterday";
  return then.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** "a, b" -> ["a","b"]; trims and drops empties and duplicates. */
export function parseTags(raw: string): string[] {
  return [...new Set(raw.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean))];
}

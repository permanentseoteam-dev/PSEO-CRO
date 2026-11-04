// Pure helpers for auth and access admin. No I/O.
import type { Scope } from "@/lib/auth/perms";
import type { Tone } from "@/components/ui/tone";

/** Only same-site paths are allowed as a post-login target. */
export function safeNext(next: string | null | undefined, fallback = "/home"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

/** Where a signed-in person lands by default. */
export function homeFor(kind: "staff" | "client") {
  return kind === "client" ? "/portal" : "/home";
}

export type InviteState = "waiting" | "accepted" | "revoked" | "expired";

export const INVITE_STATE: Record<InviteState, { label: string; tone: Tone }> = {
  waiting: { label: "Waiting", tone: "warn" },
  accepted: { label: "Accepted", tone: "ok" },
  revoked: { label: "Revoked", tone: "muted" },
  expired: { label: "Expired", tone: "danger" },
};

export function inviteState(inv: { status: string; expires_at: string }, now: Date = new Date()): InviteState {
  if (inv.status === "accepted") return "accepted";
  if (inv.status === "revoked") return "revoked";
  return new Date(inv.expires_at).getTime() <= now.getTime() ? "expired" : "waiting";
}

/** Cell key in the roles matrix. */
export const cellKey = (role: string, perm: string) => `${role}|${perm}`;

/** Cells whose scope changed between the saved matrix and the edited one. Missing = none. */
export function matrixChanges(saved: Record<string, Scope>, edited: Record<string, Scope>) {
  const out: { role: string; perm: string; scope: Scope }[] = [];
  for (const [key, scope] of Object.entries(edited)) {
    if ((saved[key] ?? "none") === scope) continue;
    const [role, perm] = key.split("|");
    out.push({ role, perm, scope });
  }
  return out;
}

const TZ = "Asia/Dubai";

function parts(d: Date, tz: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: tz, year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return { y: p.year, m: p.month, d: p.day, time: `${p.hour}:${p.minute}` };
}

/** Audit-log time: "Today 09:14", "3 Nov 17:40", or "3 Nov 2025 17:40" for another year. */
export function formatWhen(iso: string, now: Date = new Date(), tz = TZ): string {
  const a = parts(new Date(iso), tz);
  const b = parts(now, tz);
  if (a.y === b.y && a.m === b.m && a.d === b.d) return `Today ${a.time}`;
  return a.y === b.y ? `${a.d} ${a.m} ${a.time}` : `${a.d} ${a.m} ${a.y} ${a.time}`;
}

/** Date only: "2 Nov 2026". */
export function formatDay(iso: string, tz = TZ): string {
  const a = parts(new Date(iso), tz);
  return `${a.d} ${a.m} ${a.y}`;
}

/** Turn Supabase auth errors into short, plain messages. */
export function authErrorMessage(message: string | undefined): string {
  const m = (message ?? "").toLowerCase();
  if (m.includes("invalid login credentials")) return "Wrong email or password.";
  if (m.includes("token has expired") || m.includes("otp") || m.includes("invalid token")) return "That code is wrong or has expired. Send a new one.";
  if (m.includes("rate limit") || m.includes("too many") || m.includes("security purposes")) return "Too many tries. Wait a minute and try again.";
  if (m.includes("signups not allowed") || m.includes("user not found")) return "We couldn't find an account for that email.";
  if (m.includes("email not confirmed")) return "Confirm your email first, or sign in with a code.";
  if (m.includes("password") && (m.includes("weak") || m.includes("short") || m.includes("at least"))) return "Pick a longer password (at least 8 characters).";
  if (m.includes("already") && m.includes("registered")) return "This email already has an account. Sign in instead.";
  return "Something went wrong. Try again.";
}

export const MEMBER_STATUS: Record<string, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "ok" },
  invited: { label: "Invited", tone: "warn" },
  suspended: { label: "Suspended", tone: "danger" },
  left: { label: "Left", tone: "muted" },
};

/** Roles to add and remove to go from `current` to `next`. */
export function roleDiff(current: string[], next: string[]) {
  return {
    add: next.filter((r) => !current.includes(r)),
    remove: current.filter((r) => !next.includes(r)),
  };
}

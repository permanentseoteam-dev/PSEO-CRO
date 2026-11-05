// Pure 2-step sign-in (TOTP) decisions, shared by server code and tests.
import { safeNext } from "@/lib/modules/access/logic";

/** "verify": has a verified factor but this session is below aal2. "enroll": policy requires 2-step, none set up. */
export type MfaGate = "ok" | "verify" | "enroll";

/** Levels as returned by supabase.auth.mfa.getAuthenticatorAssuranceLevel(). */
export type AalState = { currentLevel: string | null; nextLevel: string | null };

/** True when the person has a verified factor but this session hasn't used it yet. */
export const needsVerify = (aal: AalState | null | undefined) => aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2";

/** True when the admin policy covers one of this staff member's roles. Client logins are never covered. */
export function requiredByPolicy(kind: "staff" | "client", roles: string[], requiredRoles: string[]): boolean {
  return kind === "staff" && roles.some((r) => requiredRoles.includes(r));
}

/** What this session must do before it may use the app. */
export function mfaGate(aal: AalState | null | undefined, required: boolean): MfaGate {
  if (needsVerify(aal)) return "verify";
  if (required && aal?.nextLevel !== "aal2") return "enroll";
  return "ok";
}

/** Path for the 2-step code screen, keeping a safe `next`. */
export function verifyPath(next?: string | null): string {
  const n = safeNext(next, "");
  return n ? `/login/verify?next=${encodeURIComponent(n)}` : "/login/verify";
}

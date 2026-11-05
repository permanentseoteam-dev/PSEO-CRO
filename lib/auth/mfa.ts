import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { AalState } from "./mfa-logic";

export { mfaGate, needsVerify, requiredByPolicy, verifyPath, type MfaGate } from "./mfa-logic";

/**
 * The signed-in user's id and this session's assurance levels, or null when signed out. Cached per request.
 * Verified factors come from getUser() (checked by the auth server, never a stale cookie copy);
 * the current level is the aal claim of that same, just-validated access token.
 */
export const getAal = cache(async (): Promise<(AalState & { userId: string }) | null> => {
  const sb = await createClient();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return null;
  const { data } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  const currentLevel = data?.currentLevel ?? null;
  const hasFactor = (u.user.factors ?? []).some((f) => f.status === "verified");
  return { userId: u.user.id, currentLevel, nextLevel: hasFactor ? "aal2" : currentLevel };
});

/** Staff role keys the admin requires 2-step for (security_settings, 0212). Empty when unset or unreadable. */
export const getTwoStepPolicy = cache(async (): Promise<string[]> => {
  const { data, error } = await (await createClient()).from("security_settings").select("mfa_required_roles").maybeSingle();
  return error || !data ? [] : ((data.mfa_required_roles as string[] | null) ?? []);
});

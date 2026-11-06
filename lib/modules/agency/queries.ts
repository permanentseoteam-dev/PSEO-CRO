import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { agencyFromRow, type AgencyBrand, type AgencySettings } from "./logic";

// Reads agency_settings (0218). A missing table, row or failed read falls back to DEFAULT_AGENCY,
// so every page still renders before the migration is applied.

/** Full settings for signed-in users (RLS: authenticated read). Once per request. */
export const getAgencySettings = cache(async (): Promise<AgencySettings> => {
  try {
    const db = await createClient();
    const { data, error } = await db
      .from("agency_settings")
      .select("name, subtitle, initials, logo_url, workday_minutes")
      .maybeSingle();
    return agencyFromRow(error ? null : data);
  } catch {
    return agencyFromRow(null);
  }
});

/** Brand fields only, through public.agency_brand(); works before sign-in. Once per request. */
export const getAgencyBrand = cache(async (): Promise<AgencyBrand> => {
  let row = null;
  try {
    const db = await createClient();
    const { data, error } = await db.rpc("agency_brand").maybeSingle();
    row = error ? null : (data as { name: string; subtitle: string; initials: string | null; logo_url: string | null } | null);
  } catch {
    // fall through to the defaults
  }
  const { name, subtitle, initials, logoUrl } = agencyFromRow(row);
  return { name, subtitle, initials, logoUrl };
});

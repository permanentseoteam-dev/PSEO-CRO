// Pure agency-branding logic: defaults, initials, the save schema and row-to-settings fallback.
import { z } from "zod";

export type AgencyBrand = { name: string; subtitle: string; initials: string; logoUrl: string | null };
export type AgencySettings = AgencyBrand & { workdayMinutes: number };

/** Used before 0218 is applied, or when a read fails. */
export const DEFAULT_AGENCY: AgencySettings = {
  name: "Permanent SEO",
  subtitle: "Agency portal",
  initials: "PS",
  logoUrl: null,
  workdayMinutes: 480,
};

/** First letters of the first two words, upper case. "" for a blank name. */
export const suggestInitials = (name: string) =>
  name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

const HTTPS = /^https:\/\/\S+$/i;

/** Settings form input. Workday is entered in hours (1 to 16) and stored as minutes. */
export const AgencyInput = z.object({
  name: z.string().trim().min(1, "Enter the company name.").max(80),
  subtitle: z.string().trim().max(80),
  initials: z.string().trim().max(3, "Use up to 3 characters for the initials."),
  logoUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || HTTPS.test(v), "The logo URL must start with https://."),
  workdayHours: z.number().min(1, "Workday must be 1 to 16 hours.").max(16, "Workday must be 1 to 16 hours."),
});

/** Validated input as the row to save. Blank initials fall back to ones made from the name. */
export function toRow(input: z.infer<typeof AgencyInput>) {
  return {
    name: input.name,
    subtitle: input.subtitle,
    initials: (input.initials || suggestInitials(input.name)).toUpperCase() || null,
    logo_url: input.logoUrl || null,
    workday_minutes: Math.round(input.workdayHours * 60),
  };
}

type Row = { name?: string | null; subtitle?: string | null; initials?: string | null; logo_url?: string | null; workday_minutes?: number | null };

/** A stored row to settings; missing or bad values fall back to DEFAULT_AGENCY. */
export function agencyFromRow(row: Row | null | undefined): AgencySettings {
  const name = row?.name?.trim() || DEFAULT_AGENCY.name;
  const w = row?.workday_minutes;
  return {
    name,
    subtitle: row?.subtitle ?? DEFAULT_AGENCY.subtitle,
    initials: row?.initials?.trim() || suggestInitials(name) || DEFAULT_AGENCY.initials,
    logoUrl: row?.logo_url && HTTPS.test(row.logo_url) ? row.logo_url : null,
    workdayMinutes: typeof w === "number" && w >= 60 && w <= 960 ? w : DEFAULT_AGENCY.workdayMinutes,
  };
}

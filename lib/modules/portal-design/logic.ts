// Pure portal-design logic: colour contrast and merging per-client branding over the company defaults.

export type PortalTheme = "system" | "light" | "dark";
export type PortalDensity = "comfortable" | "compact";
export type PortalDesign = { accent: string; logoUrl: string | null; theme: PortalTheme; density: PortalDensity };

/** WCAG AA for normal text: white text on the accent (and accent text on white) needs this ratio. */
export const MIN_CONTRAST = 4.5;

/** Used when nothing is saved yet. Bordio blue, darkened to pass AA: 4.7:1 on white (#0d8df4 is only 3.4:1). */
export const DEFAULT_DESIGN: PortalDesign = { accent: "#0a74d1", logoUrl: null, theme: "system", density: "comfortable" };

/** Accessible accents offered as one-click choices (all 4.5:1 or better on white). */
export const ACCENT_CHOICES = ["#0a74d1", "#0f766e", "#1d4ed8", "#6d28d9", "#be123c", "#b45309", "#15803d", "#334155"];

const HEX = /^#[0-9a-f]{6}$/i;
export const isHex = (v: unknown): v is string => typeof v === "string" && HEX.test(v);

/** WCAG relative luminance of a #rrggbb colour. */
export function luminance(hex: string): number {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = ch.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio between two #rrggbb colours, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** null when the accent is fine on white; otherwise the reason to show. */
export function accentProblem(accent: string): string | null {
  if (!isHex(accent)) return "Use a colour like #0a74d1.";
  const r = contrastRatio(accent, "#ffffff");
  // Round down so a near miss never reads as "4.5:1".
  if (r < MIN_CONTRAST) return `Too light on white (${(Math.floor(r * 10) / 10).toFixed(1)}:1). Pick a darker colour with ${MIN_CONTRAST}:1 or more.`;
  return null;
}

/** Per-client branding wins over the defaults; theme and density always come from the defaults. */
export function mergeDesign(
  defaults: PortalDesign,
  client: { portal_color?: string | null; portal_logo_url?: string | null } | null | undefined,
): PortalDesign {
  return {
    accent: isHex(client?.portal_color) ? client.portal_color.toLowerCase() : defaults.accent,
    logoUrl: client?.portal_logo_url || defaults.logoUrl,
    theme: defaults.theme,
    density: defaults.density,
  };
}

/** Defaults row (portal_design_settings) to a design; bad or missing values fall back to DEFAULT_DESIGN. */
export function defaultsFromRow(
  row: { accent?: string | null; theme?: string | null; density?: string | null } | null | undefined,
  logoUrl: string | null,
): PortalDesign {
  const theme = row?.theme === "light" || row?.theme === "dark" || row?.theme === "system" ? row.theme : DEFAULT_DESIGN.theme;
  const density = row?.density === "compact" || row?.density === "comfortable" ? row.density : DEFAULT_DESIGN.density;
  return { accent: isHex(row?.accent) ? row.accent.toLowerCase() : DEFAULT_DESIGN.accent, logoUrl, theme, density };
}

export const LOGO_BUCKET = "portal-branding";
export const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/** File extension for an allowed logo type, or null when the type isn't allowed. */
export const logoExt = (type: string) => EXT[type] ?? null;

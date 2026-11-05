import "server-only";
import { createClient } from "@/lib/supabase/server";
import { LOGO_BUCKET, defaultsFromRow, mergeDesign, type PortalDesign } from "./logic";

// Reads portal_design_settings (0212) and clients.portal_color / portal_logo_url (0108) under RLS.
// A missing row, table or denied read falls back to the built-in defaults, so portal pages still render.

type Db = Awaited<ReturnType<typeof createClient>>;

async function readDefaults(db: Db): Promise<PortalDesign & { logoPath: string | null }> {
  const { data, error } = await db.from("portal_design_settings").select("accent, theme, density, logo_path").maybeSingle();
  const row = error ? null : data;
  const logoPath: string | null = row?.logo_path ?? null;
  const logoUrl = logoPath ? db.storage.from(LOGO_BUCKET).getPublicUrl(logoPath).data.publicUrl : null;
  return { ...defaultsFromRow(row, logoUrl), logoPath };
}

/** Company defaults for the settings page, with the stored logo path. */
export async function getPortalDesignDefaults(): Promise<PortalDesign & { logoPath: string | null }> {
  return readDefaults(await createClient());
}

/** The portal look for a client: their branding (accent, logo) over the company defaults. No id = defaults only. */
export async function getPortalDesign(clientId?: string): Promise<{
  accent: string;
  logoUrl: string | null;
  theme: "system" | "light" | "dark";
  density: "comfortable" | "compact";
}> {
  const db = await createClient();
  const [defaults, client] = await Promise.all([
    readDefaults(db),
    clientId
      ? db.from("clients").select("portal_color, portal_logo_url").eq("id", clientId).maybeSingle().then((r) => (r.error ? null : r.data))
      : Promise.resolve(null),
  ]);
  const { accent, logoUrl, theme, density } = mergeDesign(defaults, client);
  return { accent, logoUrl, theme, density };
}

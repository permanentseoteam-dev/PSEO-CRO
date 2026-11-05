import { cookies } from "next/headers";
import { Shell } from "@/components/shell/shell";
import { getShellData } from "@/lib/modules/shell/queries";
import type { Theme } from "@/lib/modules/shell/types";
import { getPortalClient } from "@/lib/modules/portal/queries";
import { getPortalView } from "@/lib/modules/portal/viewer";
import { portalAccentCss } from "@/lib/modules/portal/logic";
import { getPortalDesign } from "@/lib/modules/portal-design/queries";
import { PreviewBanner } from "./_components/preview-banner";
import { PortalDocAttrs } from "./_components/portal-doc-attrs";

// Client portal shell. A client login sees its own client. A staff member sees it only during a
// "See as client" preview (signed cookie, 30 min, read-only), rendered as the client's owner login;
// staff without a preview are sent to /home by getPortalView().
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { viewer, scope } = await getPortalView();
  const clientId = scope.clientId ?? undefined;

  const [client, data, jar, design] = await Promise.all([
    getPortalClient(scope.clientId),
    getShellData(viewer.id, { staff: false }),
    cookies(),
    getPortalDesign(clientId),
  ]);
  const t = jar.get("theme")?.value;
  const theme: Theme = design.theme !== "system" ? design.theme : t === "light" || t === "dark" ? t : "system";
  const accentCss = portalAccentCss(design.accent);
  const logo = design.logoUrl && /^https?:\/\//i.test(design.logoUrl) ? design.logoUrl : null;

  return (
    <>
      {accentCss ? <style>{accentCss}</style> : null}
      <PortalDocAttrs theme={design.theme} density={design.density} />
      <Shell variant="portal" me={viewer} org={client?.name} logo={logo} viewSwitch={false} theme={theme} data={data}>
        {scope.mode === "preview" ? <PreviewBanner clientId={scope.clientId} clientName={client?.name ?? "this client"} exp={scope.exp} /> : null}
        {children}
      </Shell>
    </>
  );
}

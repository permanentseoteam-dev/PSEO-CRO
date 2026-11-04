import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireMe, can } from "@/lib/auth/can";
import { Shell } from "@/components/shell/shell";
import { getShellData } from "@/lib/modules/shell/queries";
import type { Theme } from "@/lib/modules/shell/types";
import { getPortalClient, listPreviewClients } from "@/lib/modules/portal/queries";
import { PreviewPicker } from "./_components/preview-picker";

// Client portal shell. Client logins only ever see their own client; staff who can see clients
// get a preview with a client picker (writes stay client-only).
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const me = await requireMe();
  if (me.kind === "staff" && !can(me, "clients.view")) redirect("/home");

  const [client, data, jar, previewClients] = await Promise.all([
    getPortalClient(me),
    getShellData(me.id, { staff: false }),
    cookies(),
    me.kind === "staff" ? listPreviewClients() : Promise.resolve([]),
  ]);
  const t = jar.get("theme")?.value;
  const theme: Theme = t === "light" || t === "dark" ? t : "system";

  return (
    <Shell variant="portal" me={me} org={client?.name} viewSwitch={me.kind === "staff"} theme={theme} data={data}>
      {me.kind === "staff" ? <PreviewPicker clients={previewClients} value={client?.id ?? ""} /> : null}
      {children}
    </Shell>
  );
}

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireMe, can } from "@/lib/auth/can";
import { Shell } from "@/components/shell/shell";
import { getShellData } from "@/lib/modules/shell/queries";
import { listSidebarProjects } from "@/lib/modules/work/space";
import type { Theme } from "@/lib/modules/shell/types";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await requireMe();
  if (me.kind === "client") redirect("/portal");

  const [data, jar, list] = await Promise.all([
    getShellData(me.id, { staff: true }),
    cookies(),
    // An empty list (not a crash) if the projects tables are not applied yet.
    listSidebarProjects().catch(() => ({ folders: [], loose: [] })),
  ]);
  const t = jar.get("theme")?.value;
  const theme: Theme = t === "light" || t === "dark" ? t : "system";

  return (
    <Shell
      variant="staff"
      me={me}
      viewSwitch={can(me, "clients.view")}
      theme={theme}
      data={data}
      projects={{ list, canManage: can(me, "work.projects.manage", "team") }}
    >
      {children}
    </Shell>
  );
}

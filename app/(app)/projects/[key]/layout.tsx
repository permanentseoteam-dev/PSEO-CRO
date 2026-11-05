import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { requireMe } from "@/lib/auth/can";
import { NoAccess } from "@/components/ui";
import { getProjectSpace } from "@/lib/modules/work/space";
import { ToolsShell } from "./_components/tools-nav";

export default async function ProjectSpaceLayout({ children, params }: { children: ReactNode; params: Promise<{ key: string }> }) {
  const me = await requireMe();
  if (me.kind !== "staff") return <NoAccess />;
  const { key } = await params;
  const space = await getProjectSpace(key);
  if (!space) notFound();

  return <ToolsShell projectKey={space.key}>{children}</ToolsShell>;
}

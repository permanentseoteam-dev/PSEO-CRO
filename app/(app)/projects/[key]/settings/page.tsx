import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMe } from "@/lib/auth/can";
import { NoAccess } from "@/components/ui";
import { getProjectSpace } from "@/lib/modules/work/space";
import { listDepartments, listStaff, projectDepartmentIds } from "@/lib/modules/work/queries";
import { cn } from "@/lib/utils";
import { DetailsTab } from "./details-tab";
import { ConfigTab } from "./config-tab";
import s from "./settings.module.css";

export const metadata = { title: "Project settings" };

export default async function SettingsPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ tab?: string }> }) {
  const me = await requireMe();
  if (me.kind !== "staff") return <NoAccess />;
  const [{ key }, { tab }] = await Promise.all([params, searchParams]);
  const space = await getProjectSpace(key);
  if (!space) notFound();
  const config = tab === "configuration";
  const base = `/projects/${space.key}/settings`;
  // Only the details tab needs these.
  const [departments, staff, deptIds] = await Promise.all([
    config ? [] : listDepartments(),
    config ? [] : listStaff(),
    config ? new Map<string, string[]>() : projectDepartmentIds([{ id: space.id, department_id: space.departmentId }]),
  ]);

  return (
    <div className={s.page}>
      <h1 className={s.title}>Project settings</h1>
      <nav className={s.tabs} aria-label="Settings sections">
        <Link href={base} className={cn(s.tab, !config && s.on)} aria-current={!config ? "page" : undefined}>
          Details
        </Link>
        <Link href={`${base}?tab=configuration`} className={cn(s.tab, config && s.on)} aria-current={config ? "page" : undefined}>
          Configuration
        </Link>
      </nav>
      {config ? (
        <ConfigTab projectId={space.id} mode={space.configMode} config={space.config} canManage={space.canManage} />
      ) : (
        <DetailsTab
          // Remount when the saved values change: the form keeps its own state from the first render.
          key={`${space.id}:${space.leadId ?? ""}:${(deptIds.get(space.id) ?? []).join()}`}
          projectId={space.id}
          name={space.name}
          projectKey={space.key}
          canManage={space.canManage}
          departments={departments}
          people={staff.map(({ id, name }) => ({ id, name }))}
          departmentIds={deptIds.get(space.id) ?? []}
          leadId={space.leadId}
        />
      )}
    </div>
  );
}

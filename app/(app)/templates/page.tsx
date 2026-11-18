import { requireMe, can } from "@/lib/auth/can";
import { NoAccess } from "@/components/ui";
import { listDepartments, listQaChecklists, listStaff, listTemplates } from "@/lib/modules/work/queries";
import { listServiceNames } from "@/lib/modules/services/queries";
import { TemplatesView } from "./_components/templates-view";

export const metadata = { title: "Ticket templates" };

export default async function TemplatesPage() {
  const me = await requireMe();
  if (me.kind !== "staff") return <NoAccess />;

  const [templates, services, departments, staff, qaLists] = await Promise.all([listTemplates(), listServiceNames(), listDepartments(), listStaff(), listQaChecklists()]);

  return (
    <TemplatesView
      templates={templates}
      services={services}
      departments={departments}
      people={staff.map(({ id, name }) => ({ id, name }))}
      qaLists={qaLists.map(({ id, name, active }) => ({ id, name, active }))}
      canManage={can(me, "work.templates.manage")}
    />
  );
}

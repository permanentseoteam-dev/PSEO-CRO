import { NoAccess, Seg } from "@/components/ui";
import { requireMe, can } from "@/lib/auth/can";
import { createClient } from "@/lib/supabase/server";
import { listDepartmentStats } from "@/lib/modules/departments/queries";
import { todayIn } from "@/lib/modules/tickets/logic";
import { DepartmentsManager } from "../settings/_components/departments";

export const metadata = { title: "Departments" };

export default async function DepartmentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireMe();
  if (me.kind !== "staff" || !can(me, "admin.access.manage", "all")) return <NoAccess />;
  const view = (await searchParams).view === "list" ? "list" : "board";
  const db = await createClient();
  const [depts, staff] = await Promise.all([
    db.from("departments").select("id, name, head_id").order("name"),
    db.from("members").select("id, name, department_id").eq("kind", "staff").eq("status", "active").order("name"),
  ]);
  const departments = (depts.data ?? []).map((d) => ({ id: d.id as string, name: d.name as string, headId: (d.head_id as string | null) ?? null }));
  const stats = view === "board" ? await listDepartmentStats(departments.map((d) => d.id), todayIn()) : undefined;
  return (
    <div className="page">
      <h1>Departments</h1>
      <DepartmentsManager
        departments={departments}
        staff={(staff.data ?? []).map((m) => ({ id: m.id as string, name: m.name as string, departmentId: (m.department_id as string | null) ?? null }))}
        view={view}
        stats={stats}
        viewSwitch={
          <Seg
            label="View"
            value={view}
            items={[
              { value: "list", label: "List", href: "/departments?view=list" },
              { value: "board", label: "Board", href: "/departments" },
            ]}
          />
        }
      />
    </div>
  );
}

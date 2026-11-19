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
  const view = (await searchParams).view === "board" ? "board" : "list";
  const db = await createClient();
  const [depts, staff] = await Promise.all([
    db.from("departments").select("id, name, head_id").order("name"),
    db.from("members").select("id, name").eq("kind", "staff").eq("status", "active").order("name"),
  ]);
  const departments = (depts.data ?? []).map((d) => ({ id: d.id as string, name: d.name as string, headId: (d.head_id as string | null) ?? null }));
  const stats = view === "board" ? await listDepartmentStats(departments.map((d) => d.id), todayIn()) : undefined;
  return (
    <div className="page">
      <h1>Departments</h1>
      <Seg
        label="View"
        className="self-start"
        value={view}
        items={[
          { value: "list", label: "List", href: "/departments" },
          { value: "board", label: "Board", href: "/departments?view=board" },
        ]}
      />
      <DepartmentsManager departments={departments} staff={(staff.data ?? []) as { id: string; name: string }[]} view={view} stats={stats} />
    </div>
  );
}

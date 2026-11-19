import { NoAccess } from "@/components/ui";
import { requireMe, can } from "@/lib/auth/can";
import { createClient } from "@/lib/supabase/server";
import { DepartmentsManager } from "../settings/_components/departments";

export const metadata = { title: "Departments" };

export default async function DepartmentsPage() {
  const me = await requireMe();
  if (me.kind !== "staff" || !can(me, "admin.access.manage", "all")) return <NoAccess />;
  const db = await createClient();
  const [depts, staff] = await Promise.all([
    db.from("departments").select("id, name, head_id").order("name"),
    db.from("members").select("id, name").eq("kind", "staff").eq("status", "active").order("name"),
  ]);
  const departments = (depts.data ?? []).map((d) => ({ id: d.id as string, name: d.name as string, headId: (d.head_id as string | null) ?? null }));
  return (
    <div className="page">
      <h1>Departments</h1>
      <DepartmentsManager departments={departments} staff={(staff.data ?? []) as { id: string; name: string }[]} />
    </div>
  );
}

import { getMe, can } from "@/lib/auth/can";
import { NoAccess } from "@/components/ui";
import { listCycles, listDepartments, listKpis, listPaths, listStaff } from "../queries";
import { SetupTabClient } from "./setup-client";

/**
 * Performance → Setup tab: KPIs (source, weight, direction, applies to), training paths (create, assign),
 * review cycles (open/close with self and manager due dates). Team-scope managers can only assign training.
 */
export async function SetupTab() {
  const me = await getMe();
  if (!me || me.kind !== "staff" || !can(me, "perf.setup.manage", "team")) return <NoAccess />;
  const [kpis, paths, cycles, departments, staff] = await Promise.all([listKpis(), listPaths(), listCycles(), listDepartments(), listStaff()]);
  return <SetupTabClient kpis={kpis} paths={paths} cycles={cycles} departments={departments} staff={staff} canEdit={can(me, "perf.setup.manage", "all")} />;
}

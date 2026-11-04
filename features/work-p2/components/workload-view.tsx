import { NoAccess } from "@/components/ui";
import { can, requireMe } from "@/lib/auth/can";
import { addDays, buildAlerts, buildWorkload, isIsoDate, mondayOf, visiblePeople } from "../logic";
import { getWorkloadData, todayIso } from "../queries";
import { DEFAULT_CAPACITY } from "../types";
import { WorkloadClient } from "./workload-client";

/**
 * Tickets → Workload view. Server component; mount it when `?view=workload`.
 * `week` is any date in the week ("YYYY-MM-DD", defaults to this week); `dept` is a department id.
 * `basePath` is the URL the week and department links build on.
 */
export async function WorkloadView({ week, dept, basePath = "/tickets?view=workload" }: { week?: string; dept?: string; basePath?: string }) {
  const me = await requireMe();
  const scope = me.perms["work.workload.view"] ?? "none";
  if (me.kind !== "staff" || !can(me, "work.workload.view")) return <NoAccess />;

  const today = todayIso();
  const monday = mondayOf(week && isIsoDate(week) ? week : today);
  const data = await getWorkloadData(monday);
  let people = visiblePeople(data.people, me, scope);
  if (dept) people = people.filter((p) => p.departmentId === dept);

  const rows = buildWorkload(people, data.tickets, data.capacities, data.settings, monday, DEFAULT_CAPACITY);
  const alerts = buildAlerts(rows, data.tickets, data.settings, today, monday);
  const href = (w: string) => `${basePath}${basePath.includes("?") ? "&" : "?"}week=${w}${dept ? `&dept=${dept}` : ""}`;

  return (
    <WorkloadClient
      monday={monday}
      rows={rows}
      alerts={alerts}
      handled={data.handled}
      settings={data.settings}
      capacities={data.capacities}
      departments={data.departments}
      dept={dept ?? ""}
      links={{ prev: href(addDays(monday, -7)), next: href(addDays(monday, 7)), today: href(mondayOf(today)), base: basePath, week: monday }}
      isThisWeek={monday === mondayOf(today)}
      canManage={can(me, "work.workload.manage")}
      canSettings={can(me, "work.workload.manage", "all")}
    />
  );
}

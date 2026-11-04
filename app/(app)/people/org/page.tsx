import { requireMe, can } from "@/lib/auth/can";
import { NoAccess } from "@/components/ui";
import { buildOrg, unplacedReason } from "@/lib/modules/team/logic";
import { listPeople } from "@/lib/modules/team/queries";
import { OrgChart } from "./_components/org-chart";

export const metadata = { title: "Org chart" };

export default async function OrgPage() {
  const me = await requireMe();
  if (me.kind !== "staff" || !can(me, "hr.directory.view")) return <NoAccess />;
  const { people, departments } = await listPeople();
  const { roots, unplaced } = buildOrg(people, departments);
  const now = new Date();

  return (
    <div className="page">
      <OrgChart
        roots={roots}
        unplaced={unplaced.map((p) => ({ id: p.id, name: p.name, title: p.title, reason: unplacedReason(p, now) }))}
        people={people.map((p) => ({ id: p.id, name: p.name }))}
        canPlace={can(me, "admin.access.manage", "all")}
      />
    </div>
  );
}

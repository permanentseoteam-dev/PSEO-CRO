import { requireMe, can } from "@/lib/auth/can";
import { NoAccess } from "@/components/ui";
import { listPeople } from "@/lib/modules/team/queries";
import { Directory } from "./_components/directory";

export const metadata = { title: "Team directory" };

export default async function DirectoryPage() {
  const me = await requireMe();
  if (me.kind !== "staff" || !can(me, "hr.directory.view")) return <NoAccess />;
  const { people } = await listPeople();
  const clockedIn = people.filter((p) => p.clockedIn).length;

  return (
    <div className="page">
      <div className="row between">
        <h2>
          <b className="text-accent">{clockedIn}</b> clocked in
        </h2>
        <span className="muted small">{people.length} people</span>
      </div>
      <Directory people={people} />
    </div>
  );
}

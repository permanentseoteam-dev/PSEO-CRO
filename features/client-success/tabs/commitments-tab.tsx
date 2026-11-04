import { NoAccess } from "@/components/ui";
import { can, requireMe } from "@/lib/auth/can";
import { CommitmentsView } from "../components/commitments-view";
import { getCommitments, listStaff } from "../queries";
import { todayIso } from "./today";

/** Client page tab "Commitments". Server component: mount as <CommitmentsTab clientId={id} />. */
export async function CommitmentsTab({ clientId }: { clientId: string }) {
  const me = await requireMe();
  if (me.kind !== "staff" || !can(me, "clients.view")) return <NoAccess />;
  const [{ commitments, checkins }, staff] = await Promise.all([getCommitments(clientId), listStaff()]);
  return (
    <CommitmentsView
      clientId={clientId}
      commitments={commitments}
      checkins={checkins}
      staff={staff}
      canManage={can(me, "clients.manage")}
      today={todayIso()}
    />
  );
}

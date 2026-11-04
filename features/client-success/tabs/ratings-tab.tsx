import { NoAccess } from "@/components/ui";
import { can, requireMe } from "@/lib/auth/can";
import { RatingsView } from "../components/ratings-view";
import { getMailer } from "../email";
import { getRatings, listDepartments } from "../queries";
import { todayIso } from "./today";

/** Client page tab "Delivery ratings". */
export async function RatingsTab({ clientId }: { clientId: string }) {
  const me = await requireMe();
  if (me.kind !== "staff" || !can(me, "clients.view")) return <NoAccess />;
  const [ratings, departments] = await Promise.all([getRatings(clientId), listDepartments()]);
  return (
    <RatingsView
      clientId={clientId}
      ratings={ratings}
      departments={departments}
      canManage={can(me, "clients.manage")}
      emailConnected={getMailer().configured}
      today={todayIso()}
    />
  );
}

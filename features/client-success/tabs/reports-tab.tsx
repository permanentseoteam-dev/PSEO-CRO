import { NoAccess } from "@/components/ui";
import { can, requireMe } from "@/lib/auth/can";
import { ReportsView } from "../components/reports-view";
import { getMailer } from "../email";
import { getClientName, getProfile, getReports } from "../queries";
import { todayIso } from "./today";

/** Client page tab "Reports": monthly reports and QBRs. */
export async function ReportsTab({ clientId }: { clientId: string }) {
  const me = await requireMe();
  if (me.kind !== "staff" || !can(me, "clients.view")) return <NoAccess />;
  const [profile, { reports, qbrs }, clientName] = await Promise.all([getProfile(clientId), getReports(clientId), getClientName(clientId)]);
  return (
    <ReportsView
      clientId={clientId}
      clientName={clientName}
      profile={profile}
      reports={reports}
      qbrs={qbrs}
      canManage={can(me, "clients.manage")}
      canApprove={can(me, "clients.reports.approve")}
      emailConnected={getMailer().configured}
      today={todayIso()}
    />
  );
}

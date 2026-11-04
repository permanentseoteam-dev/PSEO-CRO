import { NoAccess } from "@/components/ui";
import { can, requireMe } from "@/lib/auth/can";
import { RelationshipView } from "../components/relationship-view";
import { getProfile, getRelationship } from "../queries";
import { todayIso } from "./today";

/** Client page tab "Relationship" (staff only; personal notes never reach the portal). */
export async function RelationshipTab({ clientId }: { clientId: string }) {
  const me = await requireMe();
  if (me.kind !== "staff" || !can(me, "clients.view")) return <NoAccess />;
  const [profile, rel] = await Promise.all([getProfile(clientId), getRelationship(clientId)]);
  return <RelationshipView clientId={clientId} profile={profile} {...rel} canManage={can(me, "clients.manage")} today={todayIso()} />;
}

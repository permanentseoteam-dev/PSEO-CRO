import { getMe, can } from "@/lib/auth/can";
import { NoAccess } from "@/components/ui";
import { getLatestExit } from "../queries";
import { LeavingTabClient } from "./leaving-client";

/** Profile → Leaving tab (HR only): exit details, offboarding checklist, "They're staying". */
export async function LeavingTab({ memberId }: { memberId: string }) {
  const me = await getMe();
  if (!me || me.kind !== "staff" || !can(me, "hr.records.manage", "team") || me.id === memberId) return <NoAccess />;
  const exit = await getLatestExit(memberId);
  return <LeavingTabClient memberId={memberId} exit={exit} />;
}

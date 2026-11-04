import { getMe, can } from "@/lib/auth/can";
import { NoAccess } from "@/components/ui";
import { listTools } from "../queries";
import { ToolsTabClient } from "./tools-client";

/** Profile → Tools tab: which tools someone can use and at what level. Logins only, never passwords. */
export async function ToolsTab({ memberId }: { memberId: string }) {
  const me = await getMe();
  if (!me || me.kind !== "staff" || (me.id !== memberId && !can(me, "hr.records.manage", "team"))) return <NoAccess />;
  const tools = await listTools(memberId);
  return <ToolsTabClient memberId={memberId} tools={tools} canManage={can(me, "hr.records.manage", "team")} />;
}

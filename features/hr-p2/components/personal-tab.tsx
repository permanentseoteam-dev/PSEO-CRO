import { getMe, can } from "@/lib/auth/can";
import { NoAccess } from "@/components/ui";
import { getPersonal, listStaff } from "../queries";
import { PersonalTabClient } from "./personal-client";

/** Profile → Personal tab: DOB, ID, tax number, bank and IBAN (masked until Show) and a change log without values. */
export async function PersonalTab({ memberId }: { memberId: string }) {
  const me = await getMe();
  if (!me || me.kind !== "staff" || (me.id !== memberId && !can(me, "hr.personal.view", "team"))) return <NoAccess />;
  const [{ details, changes }, staff] = await Promise.all([getPersonal(memberId), listStaff()]);
  const names = Object.fromEntries(staff.map((s) => [s.id, s.name]));
  return (
    <PersonalTabClient
      memberId={memberId}
      details={details}
      changes={changes.map((c) => ({ ...c, by: c.changed_by ? (names[c.changed_by] ?? "Someone") : "System" }))}
      canEdit={me.id === memberId || can(me, "hr.records.manage", "all")}
    />
  );
}

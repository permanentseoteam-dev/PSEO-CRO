import { getMe, can } from "@/lib/auth/can";
import { NoAccess } from "@/components/ui";
import { getPay } from "../queries";
import { localDate } from "../logic";
import { PayTabClient } from "./pay-client";

/**
 * Profile → Pay tab: salary components, split-a-gross helper, pay history, payslips.
 * Shown to the person themselves and to anyone with hr.pay.view (team/all). `payslipBase` is the route that
 * serves payslip PDFs (see WIRING.md); the link is `${payslipBase}/${id}`.
 */
export async function PayTab({ memberId, payslipBase = "/me/payslips" }: { memberId: string; payslipBase?: string }) {
  const me = await getMe();
  if (!me || me.kind !== "staff" || (me.id !== memberId && !can(me, "hr.pay.view", "team"))) return <NoAccess />;
  const pay = await getPay(memberId, localDate(new Date()));
  return <PayTabClient memberId={memberId} {...pay} canManage={can(me, "hr.pay.manage", "all")} payslipBase={payslipBase} />;
}

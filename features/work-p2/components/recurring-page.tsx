import Link from "next/link";
import { NoAccess } from "@/components/ui";
import { can, requireMe } from "@/lib/auth/can";
import { getRecurringData, todayIso } from "../queries";
import { RecurringClient } from "./recurring-client";

/** Tickets → Recurring. Whole page body; mount at /tickets/recurring. */
export async function RecurringPage() {
  const me = await requireMe();
  if (me.kind !== "staff") return <NoAccess />;
  const data = await getRecurringData();
  return (
    <div className="page stack" style={{ gap: 16 }}>
      <div className="small muted">
        <Link href="/tickets">Tickets</Link> / <span>Recurring</span>
      </div>
      <RecurringClient
        {...data}
        today={todayIso()}
        meId={me.id}
        canManage={can(me, "work.recurring.manage")}
        canManageAll={can(me, "work.recurring.manage", "team")}
        canRunNow={can(me, "work.recurring.manage", "all")}
      />
    </div>
  );
}

import Link from "next/link";
import { requireMe, can } from "@/lib/auth/can";
import { NoAccess } from "@/components/ui";
import { getOpsSettings, getSettingsData, todayIso } from "@/lib/modules/finance/ops/queries";
import { SettingsView } from "./_components/settings-view";

export const metadata = { title: "Finance settings" };

export default async function FinanceSettingsPage() {
  const me = await requireMe();
  if (me.kind !== "staff" || !can(me, "finance.settings.manage", "all")) return <NoAccess />;
  const [data, ops] = await Promise.all([getSettingsData(), getOpsSettings()]);
  return (
    <div className="page">
      <div className="stack" style={{ gap: 4 }}>
        <Link className="small" href="/finance">
          ← Finance
        </Link>
        <h1>Finance settings</h1>
      </div>
      <SettingsView {...data} today={todayIso()} reminderFrom={ops.reminderFrom} />
    </div>
  );
}

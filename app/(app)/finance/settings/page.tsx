import Link from "next/link";
import { requireMe, can } from "@/lib/auth/can";
import { NoAccess } from "@/components/ui";
import { getSettingsData, todayIso } from "@/lib/modules/finance/ops/queries";
import { EmailSendingSection } from "@/features/finance-p2/sections";
import { SettingsView } from "./_components/settings-view";

export const metadata = { title: "Finance settings" };

export default async function FinanceSettingsPage() {
  const me = await requireMe();
  if (me.kind !== "staff" || !can(me, "finance.settings.manage", "all")) return <NoAccess />;
  const data = await getSettingsData();
  return (
    <div className="page">
      <div className="stack" style={{ gap: 4 }}>
        <Link className="small" href="/finance">
          ← Finance
        </Link>
        <h1>Finance settings</h1>
      </div>
      <SettingsView {...data} today={todayIso()} emailSending={<EmailSendingSection />} />
    </div>
  );
}

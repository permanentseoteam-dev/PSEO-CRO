import { requireMe, can } from "@/lib/auth/can";
import { NoAccess } from "@/components/ui";
import { groupReminders } from "@/lib/modules/finance/ops/logic";
import { getOpsSettings, getReminderRows, syncReminders, todayIso } from "@/lib/modules/finance/ops/queries";
import { RemindersView } from "./_components/reminders-view";

export const metadata = { title: "Payment reminders" };

export default async function RemindersPage() {
  const me = await requireMe();
  if (me.kind !== "staff" || !can(me, "finance.invoices.send")) return <NoAccess />;
  const canSend = can(me, "finance.invoices.send", "all");
  // Bring reminder rows in line with today's open invoices (idempotent; the daily job does the same).
  if (canSend) await syncReminders();
  const today = todayIso();
  const [rows, settings] = await Promise.all([getReminderRows(), getOpsSettings()]);
  const lists = groupReminders(rows, today);
  return (
    <div className="page">
      <RemindersView lists={lists} settings={settings} today={today} canSend={canSend} />
    </div>
  );
}

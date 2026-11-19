import { redirect } from "next/navigation";
import { NotificationsLogSection } from "@/features/platform-p2/components/server";
import { requireMe } from "@/lib/auth/can";
import { getTwoStepPolicy, requiredByPolicy } from "@/lib/auth/mfa";
import { notifMatrix } from "@/lib/modules/personal/logic";
import { getSettings } from "@/lib/modules/personal/queries";
import { SettingsView } from "../settings/_components/settings-view";

export const metadata = { title: "My account" };

export default async function AccountPage() {
  const me = await requireMe();
  if (me.kind !== "staff") redirect("/portal");
  const [s, policy] = await Promise.all([getSettings(me.id), getTwoStepPolicy()]);
  return (
    <div className="page">
      <h1>My account</h1>
      <SettingsView
        mode="account"
        email={me.email}
        name={me.name}
        twoStepRequired={requiredByPolicy(me.kind, me.roles, policy)}
        notifLog={<NotificationsLogSection />}
        initial={{
          theme: s.theme,
          density: s.density,
          email: s.email,
          quietFrom: s.quietFrom,
          quietTo: s.quietTo,
          notif: notifMatrix(s.notif),
        }}
      />
    </div>
  );
}

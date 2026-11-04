import { requireMe, can } from "@/lib/auth/can";
import { notifMatrix } from "@/lib/modules/personal/logic";
import { getSettings } from "@/lib/modules/personal/queries";
import { SettingsView } from "./_components/settings-view";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const me = await requireMe();
  const s = await getSettings(me.id);
  return (
    <div className="page">
      <SettingsView
        email={me.email}
        name={me.name}
        isStaff={me.kind === "staff"}
        isAdmin={can(me, "admin.access.manage", "all")}
        initial={{
          theme: s.theme,
          density: s.density,
          email: s.email,
          quietFrom: s.quietFrom,
          quietTo: s.quietTo,
          slackUserId: s.slackUserId,
          notif: notifMatrix(s.notif),
        }}
      />
    </div>
  );
}

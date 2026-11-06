import { ScheduledJobsSection } from "@/features/jobs/components/scheduled-jobs";
import { ApiKeysSection, NotificationsLogSection } from "@/features/platform-p2/components/server";
import { requireMe, can } from "@/lib/auth/can";
import { getTwoStepPolicy, requiredByPolicy } from "@/lib/auth/mfa";
import { getAgencySettings } from "@/lib/modules/agency/queries";
import { notifMatrix } from "@/lib/modules/personal/logic";
import { getSettings } from "@/lib/modules/personal/queries";
import { getPortalDesignDefaults } from "@/lib/modules/portal-design/queries";
import { createClient } from "@/lib/supabase/server";
import { AgencyBrandingForm } from "./_components/agency-branding";
import { PortalDesignForm } from "./_components/portal-design";
import { SettingsView } from "./_components/settings-view";
import { TwoStepPolicy } from "./_components/two-step-policy";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const me = await requireMe();
  const isAdmin = can(me, "admin.access.manage", "all");
  const [s, policy, admin] = await Promise.all([getSettings(me.id), getTwoStepPolicy(), isAdmin ? adminData() : null]);
  return (
    <div className="page">
      <SettingsView
        email={me.email}
        name={me.name}
        isStaff={me.kind === "staff"}
        isAdmin={isAdmin}
        twoStepRequired={requiredByPolicy(me.kind, me.roles, policy)}
        apiKeys={isAdmin ? <ApiKeysSection /> : undefined}
        notifLog={me.kind === "staff" ? <NotificationsLogSection /> : undefined}
        adminSections={
          admin
            ? [
                { id: "agency", label: "Agency branding", node: <AgencyBrandingForm initial={admin.agency} /> },
                { id: "portal", label: "Client portal design", node: <PortalDesignForm initial={admin.design} /> },
                { id: "twostep", label: "2-step sign-in policy", node: <TwoStepPolicy roles={admin.staffRoles} required={policy} /> },
                { id: "jobs", label: "Scheduled jobs", node: <ScheduledJobsSection /> },
              ]
            : undefined
        }
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

async function adminData() {
  const db = await createClient();
  const [design, roles, agency] = await Promise.all([getPortalDesignDefaults(), db.from("roles").select("key, name").eq("kind", "staff").order("name"), getAgencySettings()]);
  const { accent, logoUrl, theme, density } = design;
  return { agency, design: { accent, logoUrl, theme, density }, staffRoles: (roles.data ?? []) as { key: string; name: string }[] };
}

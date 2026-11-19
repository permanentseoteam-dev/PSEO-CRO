import { redirect } from "next/navigation";
import { ScheduledJobsSection } from "@/features/jobs/components/scheduled-jobs";
import { ApiKeysSection } from "@/features/platform-p2/components/server";
import { requireMe, can } from "@/lib/auth/can";
import { getTwoStepPolicy } from "@/lib/auth/mfa";
import { getAgencySettings } from "@/lib/modules/agency/queries";
import { getPortalDesignDefaults } from "@/lib/modules/portal-design/queries";
import { createClient } from "@/lib/supabase/server";
import { AgencyBrandingForm } from "./_components/agency-branding";
import { PortalDesignForm } from "./_components/portal-design";
import { SettingsView } from "./_components/settings-view";
import { TwoStepPolicy } from "./_components/two-step-policy";

export const metadata = { title: "General Settings" };

export default async function SettingsPage() {
  const me = await requireMe();
  if (!can(me, "admin.access.manage", "all")) redirect("/account");
  const [policy, admin] = await Promise.all([getTwoStepPolicy(), adminData()]);
  return (
    <div className="page">
      <h1>General Settings</h1>
      <SettingsView
        mode="general"
        apiKeys={<ApiKeysSection />}
        adminSections={[
          { id: "agency", label: "Agency branding", editable: true, node: <AgencyBrandingForm initial={admin.agency} /> },
          { id: "portal", label: "Client portal design", editable: true, node: <PortalDesignForm initial={admin.design} /> },
          { id: "twostep", label: "2-step sign-in policy", editable: true, node: <TwoStepPolicy roles={admin.staffRoles} required={policy} /> },
          { id: "jobs", label: "Scheduled jobs", node: <ScheduledJobsSection /> },
        ]}
      />
    </div>
  );
}

async function adminData() {
  const db = await createClient();
  const [design, roles, agency] = await Promise.all([
    getPortalDesignDefaults(),
    db.from("roles").select("key, name").eq("kind", "staff").order("name"),
    getAgencySettings(),
  ]);
  const { accent, logoUrl, theme, density } = design;
  return {
    agency,
    design: { accent, logoUrl, theme, density },
    staffRoles: (roles.data ?? []) as { key: string; name: string }[],
  };
}

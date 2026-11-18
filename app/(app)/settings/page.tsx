import { ScheduledJobsSection } from "@/features/jobs/components/scheduled-jobs";
import { ApiKeysSection, NotificationsLogSection } from "@/features/platform-p2/components/server";
import { requireMe, can } from "@/lib/auth/can";
import { getTwoStepPolicy, requiredByPolicy } from "@/lib/auth/mfa";
import { getAgencySettings } from "@/lib/modules/agency/queries";
import { notifMatrix } from "@/lib/modules/personal/logic";
import { getSettings } from "@/lib/modules/personal/queries";
import { listServices } from "@/lib/modules/services/queries";
import { getPortalDesignDefaults } from "@/lib/modules/portal-design/queries";
import { createClient } from "@/lib/supabase/server";
import { AgencyBrandingForm } from "./_components/agency-branding";
import { DepartmentsManager } from "./_components/departments";
import { PortalDesignForm } from "./_components/portal-design";
import { ServicesManager } from "./_components/services";
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
        isAdmin={isAdmin}
        twoStepRequired={requiredByPolicy(me.kind, me.roles, policy)}
        apiKeys={isAdmin ? <ApiKeysSection /> : undefined}
        notifLog={me.kind === "staff" ? <NotificationsLogSection /> : undefined}
        adminSections={
          admin
            ? [
                { id: "agency", label: "Agency branding", editable: true, node: <AgencyBrandingForm initial={admin.agency} /> },
                { id: "departments", label: "Departments", node: <DepartmentsManager departments={admin.departments} staff={admin.staff} /> },
                { id: "services", label: "Services", node: <ServicesManager services={admin.services} /> },
                { id: "portal", label: "Client portal design", editable: true, node: <PortalDesignForm initial={admin.design} /> },
                { id: "twostep", label: "2-step sign-in policy", editable: true, node: <TwoStepPolicy roles={admin.staffRoles} required={policy} /> },
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
          notif: notifMatrix(s.notif),
        }}
      />
    </div>
  );
}

async function adminData() {
  const db = await createClient();
  const [design, roles, agency, depts, staff, services] = await Promise.all([
    getPortalDesignDefaults(),
    db.from("roles").select("key, name").eq("kind", "staff").order("name"),
    getAgencySettings(),
    db.from("departments").select("id, name, head_id").order("name"),
    db.from("members").select("id, name").eq("kind", "staff").eq("status", "active").order("name"),
    listServices(),
  ]);
  const { accent, logoUrl, theme, density } = design;
  return {
    agency,
    design: { accent, logoUrl, theme, density },
    staffRoles: (roles.data ?? []) as { key: string; name: string }[],
    departments: (depts.data ?? []).map((d) => ({ id: d.id as string, name: d.name as string, headId: (d.head_id as string | null) ?? null })),
    staff: (staff.data ?? []) as { id: string; name: string }[],
    services,
  };
}

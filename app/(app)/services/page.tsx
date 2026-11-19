import { NoAccess } from "@/components/ui";
import { requireMe, can } from "@/lib/auth/can";
import { listServices } from "@/lib/modules/services/queries";
import { ServicesManager } from "../settings/_components/services";

export const metadata = { title: "Services" };

export default async function ServicesPage() {
  const me = await requireMe();
  if (!can(me, "admin.access.manage", "all")) return <NoAccess />;
  return (
    <div className="page">
      <h1>Services</h1>
      <ServicesManager services={await listServices()} />
    </div>
  );
}

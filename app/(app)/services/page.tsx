import { NoAccess, Seg } from "@/components/ui";
import { requireMe, can } from "@/lib/auth/can";
import { listServices, listServiceUsage } from "@/lib/modules/services/queries";
import { ServicesManager } from "../settings/_components/services";

export const metadata = { title: "Services" };

export default async function ServicesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const me = await requireMe();
  if (!can(me, "admin.access.manage", "all")) return <NoAccess />;
  const view = (await searchParams).view === "list" ? "list" : "board";
  const services = await listServices();
  const usage = view === "board" ? await listServiceUsage(services) : undefined;
  return (
    <div className="page">
      <h1>Services</h1>
      <ServicesManager
        services={services}
        view={view}
        usage={usage}
        viewSwitch={
          <Seg
            label="View"
            value={view}
            items={[
              { value: "list", label: "List", href: "/services?view=list" },
              { value: "board", label: "Board", href: "/services" },
            ]}
          />
        }
      />
    </div>
  );
}

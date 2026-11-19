import "server-only";
import { createClient } from "@/lib/supabase/server";
import { usageCounts, type Service, type ServiceUsage } from "./logic";

/** Services in list order (sort, then name). Empty on error. */
export async function listServices(): Promise<Service[]> {
  const db = await createClient();
  const { data } = await db.from("services").select("id, name").order("sort", { nullsFirst: false }).order("name");
  return (data ?? []) as Service[];
}

export async function listServiceNames(): Promise<string[]> {
  return (await listServices()).map((s) => s.name);
}

/** Usage of every service in two queries, for the Board view. Empty on error. */
export async function listServiceUsage(services: Service[]): Promise<Record<string, ServiceUsage>> {
  const db = await createClient();
  const [t, c] = await Promise.all([db.from("templates").select("service"), db.from("clients").select("services")]);
  return usageCounts(services, (t.data ?? []) as { service: string | null }[], (c.data ?? []) as { services: string[] | null }[]);
}

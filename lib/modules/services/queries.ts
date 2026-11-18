import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Service } from "./logic";

/** Services in list order (sort, then name). Empty on error. */
export async function listServices(): Promise<Service[]> {
  const db = await createClient();
  const { data } = await db.from("services").select("id, name").order("sort", { nullsFirst: false }).order("name");
  return (data ?? []) as Service[];
}

export async function listServiceNames(): Promise<string[]> {
  return (await listServices()).map((s) => s.name);
}

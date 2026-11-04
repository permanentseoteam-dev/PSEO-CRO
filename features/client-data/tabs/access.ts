import "server-only";
import { getMe, can } from "@/lib/auth/can";

/** Staff with clients.view can open the data tabs; clients.data.manage can change things. */
export async function dataAccess() {
  const me = await getMe();
  const view = !!me && me.kind === "staff" && can(me, "clients.view");
  return { me, view, manage: view && can(me, "clients.data.manage") };
}

/** Today and yesterday as "YYYY-MM-DD" (UTC). Metrics run to yesterday: today's data isn't complete. */
export function today() {
  const now = new Date();
  return {
    now: now.toISOString(),
    today: now.toISOString().slice(0, 10),
    yesterday: new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10),
  };
}

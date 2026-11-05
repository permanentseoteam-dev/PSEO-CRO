import { ApiDocs } from "@/features/platform-p2/components/server";
import { requireMe, can } from "@/lib/auth/can";
import { NoAccess } from "@/components/ui";
export const metadata = { title: "API docs" };
export default async function Page() {
  const me = await requireMe();
  if (!can(me, "admin.access.manage", "all")) return <NoAccess />;
  return <ApiDocs />;
}

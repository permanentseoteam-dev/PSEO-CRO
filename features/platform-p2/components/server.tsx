// Server wrappers: each loads its own data and renders the client piece. Drop them into Phase 1 pages.
import { can, getMe } from "@/lib/auth/can";
import { getConnection, getInboxSummary, listApiKeys, listClientOptions, listDeliveries, listFirefliesCalls } from "../queries";
import { inboxCounts, syncLabel } from "../logic";
import { ApiKeysCard } from "./api-keys-card";
import { CalendarSync } from "./calendar-sync";
import { FirefliesCalls } from "./fireflies-calls";
import { InboxCard } from "./inbox-card";
import { NotificationsLog } from "./notifications-log";

export { HomeRolePanels } from "./home-panels";
export { ApiDocs } from "./api-docs";
export { PushPrompt } from "./push-prompt";

/** Calendar toolbar: Google sync status + "Sync now". */
export async function CalendarSyncBar() {
  const me = await getMe();
  if (!me || me.kind !== "staff" || !can(me, "calendar.use")) return null;
  const conn = await getConnection("google_calendar", me.id);
  return <CalendarSync status={conn?.status ?? "not_configured"} lastSync={syncLabel(conn?.last_sync_at ?? null, new Date())} />;
}

/** Meetings page: Fireflies calls. `noClient` lists unmatched calls with a client picker; `clientId` filters for a client page. */
export async function FirefliesCallsCard({ clientId, noClient }: { clientId?: string; noClient?: boolean }) {
  const me = await getMe();
  if (!me || me.kind !== "staff" || !can(me, "clients.view")) return null;
  const [calls, conn, clients] = await Promise.all([
    listFirefliesCalls({ clientId, unmatchedOnly: noClient }),
    getConnection("fireflies"),
    noClient ? listClientOptions() : Promise.resolve(undefined),
  ]);
  return <FirefliesCalls calls={calls} status={conn?.status ?? "not_configured"} clients={clients} title={noClient ? "Calls with no client" : "Fireflies calls"} />;
}

/** Response times: client email inbox counts. */
export async function InboxCountsCard({ days = 7 }: { days?: number }) {
  const me = await getMe();
  if (!me || me.kind !== "staff" || !can(me, "clients.view")) return null;
  const { rows, connection } = await getInboxSummary(days);
  return (
    <InboxCard
      mailbox={connection?.account_label ?? null}
      status={connection?.status ?? "not_configured"}
      lastCheck={syncLabel(connection?.last_sync_at ?? null, new Date())}
      counts={inboxCounts(rows)}
      days={days}
    />
  );
}

/** Settings → API keys (admins only). */
export async function ApiKeysSection() {
  const me = await getMe();
  if (!me || !can(me, "admin.access.manage", "all")) return null;
  return <ApiKeysCard keys={await listApiKeys()} />;
}

/** Settings → Notifications log. */
export async function NotificationsLogSection() {
  const me = await getMe();
  if (!me || me.kind !== "staff") return null;
  return <NotificationsLog rows={await listDeliveries()} />;
}

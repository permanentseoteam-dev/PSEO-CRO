// Server entry points for the Phase 1 client pages. Each does its own guard and reads and renders nothing
// when the signed-in person may not see it. See WIRING.md for where each one mounts.
import { can, requireMe } from "@/lib/auth/can";
import { addDays, healthChange, scoreOnOrBefore } from "@/lib/modules/clients/logic";
import { getEmailDrafter } from "./ai";
import { ActivityLinesCard } from "./components/activity-lines-card";
import { DeleteClientButton } from "./components/delete-client";
import { EmailDraftButton } from "./components/email-draft";
import { HealthCard } from "./components/health-card";
import { TermsCard } from "./components/terms-card";
import { VaultCard } from "./components/vault-card";
import { WinbackCard } from "./components/winback-card";
import { isEnded, suggestChurnTriggers } from "./logic";
import {
  getActivityLines,
  getAgreement,
  getClientBasics,
  getHealth,
  getHealthHistory,
  getHoursThisMonth,
  getVault,
  listEndedClients,
  todayIso,
} from "./queries";

async function staffWith(perm: string) {
  const me = await requireMe();
  return me.kind === "staff" && can(me, perm) ? me : null;
}

/** Overview tab: Terms card. */
export async function ClientTermsCard({ clientId }: { clientId: string }) {
  const me = await staffWith("clients.view");
  if (!me) return null;
  const [{ agreement, fileUrl }, hoursUsed] = await Promise.all([getAgreement(clientId), getHoursThisMonth(clientId, todayIso())]);
  return <TermsCard clientId={clientId} agreement={agreement} fileUrl={fileUrl} hoursUsed={hoursUsed} canManage={can(me, "clients.manage")} />;
}

/** Overview tab: Health card (score, sentiment, churn alerts). */
export async function ClientHealthCard({ clientId }: { clientId: string }) {
  const me = await staffWith("clients.view");
  if (!me) return null;
  const today = todayIso();
  const from = addDays(today, -29);
  const [client, { sentiments, alerts }, history] = await Promise.all([
    getClientBasics(clientId),
    getHealth(clientId),
    getHealthHistory(clientId, from),
  ]);
  const healthScore = client?.health_score ?? null;
  const prevHealthScore = scoreOnOrBefore(history, addDays(today, -7));
  const suggestions = suggestChurnTriggers({ healthScore, prevHealthScore, sentiments, alerts });
  return (
    <HealthCard
      clientId={clientId}
      trend={history.filter((h) => h.day >= from)}
      change7={healthChange(healthScore, history, today)}
      sentiments={sentiments}
      alerts={alerts}
      suggestions={suggestions}
      canManage={can(me, "clients.manage")}
    />
  );
}

/** Client portal tab: Vault card. */
export async function ClientVaultCard({ clientId }: { clientId: string }) {
  const me = await staffWith("clients.vault.view");
  if (!me) return null;
  const items = await getVault(clientId);
  return <VaultCard clientId={clientId} items={items} canManage={can(me, "clients.vault.manage")} />;
}

/** Client portal tab: Activity lines card. */
export async function ClientActivityLinesCard({ clientId }: { clientId: string }) {
  const me = await staffWith("clients.view");
  if (!me) return null;
  const lines = await getActivityLines(clientId);
  return <ActivityLinesCard clientId={clientId} lines={lines} canManage={can(me, "clients.manage")} today={todayIso()} />;
}

/** Client Portfolio: Ended clients card with win-back. */
export async function EndedClientsCard() {
  const me = await staffWith("clients.view");
  if (!me) return null;
  const clients = await listEndedClients();
  return <WinbackCard clients={clients} canManage={can(me, "clients.manage")} />;
}

/** Client page header: "Email client" button. Pass the main contact from client_contacts when known. */
export async function ClientEmailButton({ clientId, to = "", contactName = "" }: { clientId: string; to?: string; contactName?: string }) {
  const me = await staffWith("clients.view");
  if (!me) return null;
  return <EmailDraftButton clientId={clientId} to={to} contactName={contactName} aiConnected={getEmailDrafter().configured} />;
}

/** Edit client dialog (or header menu): "Delete client" button, which archives instead when invoices exist. Only for clients.delete 'all'. */
export async function ClientDeleteButton({ clientId }: { clientId: string }) {
  const me = await requireMe();
  if (me.kind !== "staff" || !can(me, "clients.delete", "all")) return null;
  const client = await getClientBasics(clientId);
  if (!client) return null;
  return <DeleteClientButton clientId={clientId} clientName={client.name} ended={isEnded(client.status)} />;
}

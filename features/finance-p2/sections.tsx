// Server entry points for the Phase 1 finance pages. Each does its own guard and reads, and renders nothing
// when the signed-in person may not see it. See WIRING.md for where each one mounts.
import type { ReactNode } from "react";
import { can, requireMe } from "@/lib/auth/can";
import { ApplyCreditButton, ClientCreditCard } from "./components/credit";
import { EmailSendingCard } from "./components/email-sending-card";
import { ExportsPanel } from "./components/exports";
import { InvoicePortalCard } from "./components/invoice-portal-card";
import { MonthlyDrafts } from "./components/monthly-drafts";
import { RecordPastInvoiceButton } from "./components/past-invoice";
import { SubAccountsField } from "./components/sub-accounts";
import { UpworkPanel } from "./components/upwork";
import { getEmailSender } from "./email";
import { isPortalVisible, monthName, monthStart, sendSummary, upworkStats } from "./logic";
import {
  getCredit,
  getDraftPreview,
  getEmailStatus,
  getInvoiceExtra,
  getOpenInvoicesFor,
  getSubAccounts,
  getSubAccountsFor,
  getUpwork,
  listClients,
  listEntities,
  listRecentExports,
  loadInvoices,
  todayIso,
} from "./queries";

async function staffWith(perm: string) {
  const me = await requireMe();
  return me.kind === "staff" && can(me, perm) ? me : null;
}

/** Invoices tab "Monthly drafts". */
export async function MonthlyDraftsSection() {
  const me = await staffWith("finance.invoices.view");
  if (!me) return null;
  const { month, plans, made } = await getDraftPreview();
  return <MonthlyDrafts month={month} monthName={monthName(month)} plans={plans} made={made} canCreate={can(me, "finance.drafts.create")} />;
}

/** Invoices header button "Record past invoice". */
export async function RecordPastInvoiceSection() {
  const me = await staffWith("finance.invoices.record_past");
  if (!me) return null;
  const [clients, entities] = await Promise.all([listClients(), listEntities()]);
  return <RecordPastInvoiceButton clients={clients} entities={entities} />;
}

/** Invoice page side card: portal visibility and original document. */
export async function InvoicePortalSection({ invoiceId }: { invoiceId: string }) {
  const me = await staffWith("finance.invoices.view");
  if (!me) return null;
  const [[inv], { extra, docUrl }] = await Promise.all([loadInvoices({ ids: [invoiceId] }), getInvoiceExtra(invoiceId)]);
  if (!inv) return null;
  return (
    <InvoicePortalCard
      invoiceId={inv.id}
      clientId={inv.clientId}
      isDraft={inv.status === "draft"}
      visible={isPortalVisible(inv.status, extra)}
      isPast={extra?.is_past ?? false}
      paidBeforePortal={Number(extra?.paid_before_portal ?? 0)}
      currency={inv.currency}
      docName={extra?.original_doc_name ?? null}
      docUrl={docUrl}
      canEdit={can(me, "finance.invoices.create") || can(me, "finance.invoices.record_past")}
    />
  );
}

async function creditData() {
  const { balances, movements } = await getCredit();
  const invoices = await getOpenInvoicesFor([...new Set(balances.map((b) => b.clientId))]);
  return { balances, movements, invoices };
}

/** Payments header button "Apply credit". */
export async function ApplyCreditSection() {
  const me = await staffWith("finance.payments.record");
  if (!me) return null;
  const { balances, invoices } = await creditData();
  return <ApplyCreditButton balances={balances} invoices={invoices} />;
}

/** Payments > Still owed: "Client credit" card. */
export async function ClientCreditSection() {
  const me = await staffWith("finance.payments.view");
  if (!me) return null;
  const { balances, movements, invoices } = await creditData();
  return <ClientCreditCard balances={balances} invoices={invoices} movements={movements} canRecord={can(me, "finance.payments.record")} />;
}

/** Invoices tab "Upwork earnings". */
export async function UpworkSection() {
  const me = await staffWith("finance.payments.view");
  if (!me) return null;
  const today = todayIso();
  const { earnings, withdrawals, month } = await getUpwork(today);
  return (
    <UpworkPanel
      earnings={earnings}
      withdrawals={withdrawals}
      stats={upworkStats(earnings, withdrawals, month)}
      today={today}
      canRecord={can(me, "finance.payments.record")}
    />
  );
}

/** Invoices tab "Exports". Defaults to last month. */
export async function ExportsSection() {
  const me = await staffWith("finance.invoices.view");
  if (!me) return null;
  const today = todayIso();
  const thisMonth = monthStart(today);
  const last = new Date(`${thisMonth}T00:00:00Z`);
  last.setUTCDate(0); // last day of previous month
  const to = last.toISOString().slice(0, 10);
  const [entities, recent] = await Promise.all([listEntities(), listRecentExports()]);
  return <ExportsPanel entities={entities} recent={recent} from={monthStart(to)} to={to} />;
}

/** Finance settings: "Email sending" card. */
export async function EmailSendingSection() {
  const me = await staffWith("finance.settings.manage");
  if (!me) return null;
  const { settings, log } = await getEmailStatus();
  const connected = getEmailSender(settings?.provider ?? "none").configured;
  return <EmailSendingCard settings={settings} summary={sendSummary(log, todayIso())} connected={connected} canManage />;
}

/** Billing clients table: one SubAccountsField per client, read once. Pass into the client dialog as slots. */
export async function subAccountsSlots(clientIds: string[]): Promise<Record<string, ReactNode>> {
  const me = await staffWith("clients.billing.view");
  if (!me) return {};
  const all = await getSubAccountsFor(clientIds);
  const canEdit = can(me, "clients.billing.edit");
  return Object.fromEntries(
    clientIds.map((id) => {
      const { subs, candidates } = all.get(id)!;
      return [
        id,
        <SubAccountsField
          key={id}
          clientId={id}
          subs={subs.map((s) => ({ childId: s.childId, name: s.name, billing: s.billing }))}
          candidates={candidates}
          canEdit={canEdit}
        />,
      ];
    }),
  );
}

/** Billing clients > Edit billing dialog: sub-accounts billed under this client. */
export async function SubAccountsSection({ clientId }: { clientId: string }) {
  const me = await staffWith("clients.billing.view");
  if (!me) return null;
  const { subs, candidates } = await getSubAccounts(clientId);
  return (
    <SubAccountsField
      clientId={clientId}
      subs={subs.map((s) => ({ childId: s.childId, name: s.name, billing: s.billing }))}
      candidates={candidates}
      canEdit={can(me, "clients.billing.edit")}
    />
  );
}

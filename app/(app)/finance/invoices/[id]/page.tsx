import Link from "next/link";
import { notFound } from "next/navigation";
import { PageTitle } from "@/components/shell/page-title";
import { requireMe, can } from "@/lib/auth/can";
import { Avatar, Card, CardHead, NoAccess, StatusDot } from "@/components/ui";
import { balance, displayStatus, fmtDate, invoiceLabel, money, round2, settledOutside } from "@/lib/modules/finance/core/logic";
import { getInvoice, getRefData, todayIso } from "@/lib/modules/finance/core/queries";
import { InvoicePortalSection } from "@/features/finance-p2/sections";
import { InvoiceActions } from "../_components/invoice-actions";
import { InvoiceEditor } from "../_components/invoice-editor";
import s from "../../_core/finance.module.css";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = /^[0-9a-f-]{36}$/i.test(id) ? await getInvoice(id) : null;
  return { title: found ? invoiceLabel(found.invoice) : "Invoice" };
}

const stamp = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Dubai" });

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireMe();
  if (me.kind !== "staff" || !can(me, "finance.invoices.view")) return <NoAccess />;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [found, ref] = await Promise.all([getInvoice(id), getRefData()]);
  if (!found) notFound();
  const { invoice: i, events } = found;
  const today = todayIso();

  const m = { status: i.status, total: i.total, paid: i.amount_paid, settled: settledOutside(i), due: i.due_on };
  const st = displayStatus(m, today);
  const bal = balance(m);
  const paid = round2(i.amount_paid - i.amount_refunded);
  const issued = i.status !== "draft";
  const closed = ["void", "written_off", "refunded"].includes(i.status);
  const canEdit = can(me, "finance.invoices.create", "all") && (!issued || can(me, "finance.invoices.edit_issued", "all")) && !closed;
  const label = invoiceLabel(i);
  // A deleted or hidden client still shows in the list, so the editor keeps the invoice's own client as an option.
  const clients = ref.clients.some((c) => c.id === i.client_id) ? ref.clients : [...ref.clients, { id: i.client_id, name: i.client_name, currency: i.currency }];

  const note = closed
    ? `This invoice is ${st.label.toLowerCase()}${i.status_reason ? `: ${i.status_reason}` : "."}`
    : i.status === "disputed"
      ? `Disputed${i.status_reason ? `: ${i.status_reason}` : "."} Reminders are paused.`
      : issued
        ? `This invoice is issued. Client and entity are locked, and saving asks for a reason.${paid > 0 ? ` The total can't drop below the ${money(paid, i.currency)} already paid.` : ""}`
        : "This is a draft. It gets its number when you issue it.";

  return (
    <div className="page">
      <PageTitle title={label} />
      <div className="row between" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div className="stack" style={{ gap: 4 }}>
          <Link className="small" href="/finance/invoices">
            ← Invoices
          </Link>
          <h1 className="num">{label}</h1>
          <div className="row small">
            <StatusDot tone={st.tone}>{st.label}</StatusDot>
            <span className="muted">
              {i.client_name} · due {fmtDate(i.due_on)}
            </span>
          </div>
        </div>
        <InvoiceActions
          inv={{
            id: i.id,
            label,
            status: i.status,
            clientId: i.client_id,
            currency: i.currency,
            dueOn: i.due_on,
            title: i.title,
            balance: bal,
            paid,
            payLink: i.pay_link,
            email: i.bill_to.email ?? "",
            cc: i.bill_to.cc ?? "",
            contact: i.bill_to.contact ?? "",
          }}
          perms={{
            create: can(me, "finance.invoices.create", "all"),
            send: can(me, "finance.invoices.send", "all"),
            void: can(me, "finance.invoices.void", "all"),
            refund: can(me, "finance.payments.record", "all") || can(me, "finance.invoices.create", "all"),
            recordPayment: can(me, "finance.payments.record", "all"),
          }}
          sender={me.name}
          channels={ref.channels.map((c) => ({ id: c.id, name: c.name }))}
        />
      </div>

      <div className={i.status === "disputed" ? `${s.note} ${s.noteDanger}` : s.note}>{note}</div>

      <InvoiceEditor
        initial={{
          id: i.id,
          label,
          client_id: i.client_id,
          entity_id: i.entity_id,
          currency: i.currency,
          issued_on: i.issued_on,
          due_on: i.due_on,
          po_ref: i.po_ref ?? "",
          title: i.title,
          discount: i.discount,
          channel_id: i.channel_id ?? "",
          pay_link: i.pay_link ?? "",
          notes: i.notes ?? "",
          terms: i.terms ?? "",
          lines: i.lines,
        }}
        issued={issued}
        readOnly={!canEdit}
        paid={issued ? paid : 0}
        billTo={i.bill_to}
        entities={ref.entities}
        channels={ref.channels}
        clients={clients}
      >
        <InvoicePortalSection invoiceId={i.id} />
        <Card>
          <CardHead title="History" />
          {events.length ? (
            <div className="list">
              {events.map((e) => (
                <div key={e.id} className={`item ${s.hist}`}>
                  {e.actor_name ? <Avatar name={e.actor_name} size={28} /> : <span className={s.autoAvatar}>A</span>}
                  <div>
                    <div>{e.note}</div>
                    <div className="small muted">
                      {e.actor_name ?? "Auto"} · {stamp(e.created_at)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty">No history yet.</div>
          )}
        </Card>
      </InvoiceEditor>
    </div>
  );
}

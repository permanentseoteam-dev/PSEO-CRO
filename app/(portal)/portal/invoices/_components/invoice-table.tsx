"use client";

import { useState } from "react";
import { Button, Dialog, StatusDot, Table, Td, Th } from "@/components/ui";
import { fmtDate, invoiceView, money } from "@/lib/modules/portal/logic";
import type { PayChannel, PortalInvoice } from "@/lib/modules/portal/types";
import s from "../../portal.module.css";

const pdfHref = (id: string) => `/api/finance/invoices/${id}/pdf`;
const view = (i: PortalInvoice, today: string) =>
  invoiceView({ status: i.status, due_on: i.dueOn, total: i.total, amount_paid: i.amountPaid, written_off_amount: i.writtenOff }, today);

/** Invoice list with a View dialog (lines, totals, how to pay). PDFs come from the finance module's route; `docs` maps invoice id to a signed link to its original document. */
export function InvoiceTable({
  invoices,
  channels,
  today,
  clientName,
  docs = {},
}: {
  invoices: PortalInvoice[];
  channels: PayChannel[];
  today: string;
  clientName: string;
  docs?: Record<string, string>;
}) {
  const [open, setOpen] = useState<PortalInvoice | null>(null);
  const v = open ? view(open, today) : null;
  const channel = open ? channels.find((c) => c.id === open.channelId) : undefined;

  return (
    <>
      <Table>
        <thead>
          <tr>
            <Th>Number</Th>
            <Th hideSm>Issued</Th>
            <Th>Due</Th>
            <Th right hideSm>
              Total
            </Th>
            <Th right>Balance</Th>
            <Th>Status</Th>
            <Th right>
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((i) => {
            const st = view(i, today);
            return (
              <tr key={i.id}>
                <Td num>{i.number}</Td>
                <Td num hideSm>
                  {fmtDate(i.issuedOn)}
                </Td>
                <Td num>{fmtDate(i.dueOn)}</Td>
                <Td num right hideSm>
                  {money(i.total, i.currency)}
                </Td>
                <Td num right>
                  {money(st.balance, i.currency)}
                </Td>
                <Td>
                  <StatusDot tone={st.tone}>{st.label}</StatusDot>
                </Td>
                <Td right>
                  <div className="row" style={{ justifyContent: "flex-end", flexWrap: "nowrap" }}>
                    <Button size="sm" onClick={() => setOpen(i)}>
                      View
                    </Button>
                    <a className="btn ghost sm hide-sm" href={pdfHref(i.id)}>
                      Download PDF
                    </a>
                    {docs[i.id] ? (
                      <a className="btn ghost sm hide-sm" href={docs[i.id]} target="_blank" rel="noopener noreferrer">
                        Original document
                      </a>
                    ) : null}
                  </div>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>

      <Dialog
        open={!!open}
        onClose={() => setOpen(null)}
        title={open ? `Invoice ${open.number}` : "Invoice"}
        footer={
          open ? (
            <>
              <Button variant="ghost" onClick={() => setOpen(null)}>
                Close
              </Button>
              <a className="btn" href={pdfHref(open.id)}>
                Download PDF
              </a>
            </>
          ) : null
        }
      >
        {open && v ? (
          <div className="stack" style={{ gap: 16 }}>
            <div className="row between small">
              <span>
                <b>Permanent SEO</b> to <b>{clientName}</b>
              </span>
              <span className="muted">
                Issued {fmtDate(open.issuedOn)} · Due {fmtDate(open.dueOn)}
              </span>
            </div>
            <table className={s.invLines}>
              <tbody>
                {open.lines.map((l, i) => (
                  <tr key={i}>
                    <td>{l.description}</td>
                    <td className="num right">{money(l.amount, open.currency)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="muted">Subtotal</td>
                  <td className="num right">{money(open.subtotal, open.currency)}</td>
                </tr>
                {open.discount > 0 ? (
                  <tr>
                    <td className="muted">Discount</td>
                    <td className="num right">-{money(open.discount, open.currency)}</td>
                  </tr>
                ) : null}
                {open.taxTotal > 0 ? (
                  <tr>
                    <td className="muted">Tax</td>
                    <td className="num right">{money(open.taxTotal, open.currency)}</td>
                  </tr>
                ) : null}
                <tr>
                  <td className="muted">Total</td>
                  <td className="num right">{money(open.total, open.currency)}</td>
                </tr>
                <tr className={s.tot}>
                  <td>Balance due</td>
                  <td className="num right">{money(v.balance, open.currency)}</td>
                </tr>
              </tbody>
            </table>
            {v.balance > 0 ? (
              <div className={s.howpay}>
                <h4>How to pay</h4>
                <div className={s.kv}>
                  {channel ? (
                    <>
                      <span>Pay by</span>
                      <span>{channel.name}</span>
                      {channel.account ? (
                        <>
                          <span>Account</span>
                          <span className="num">{channel.account}</span>
                        </>
                      ) : null}
                      {channel.details ? (
                        <>
                          <span>Details</span>
                          <span>{channel.details}</span>
                        </>
                      ) : null}
                    </>
                  ) : null}
                  <span>Reference</span>
                  <span className="num">{open.number}</span>
                </div>
                {open.payLink && /^https?:\/\//i.test(open.payLink) ? (
                  <div>
                    <a className="btn primary" href={open.payLink} target="_blank" rel="noopener noreferrer">
                      Pay {money(v.balance, open.currency)}
                    </a>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </Dialog>
    </>
  );
}

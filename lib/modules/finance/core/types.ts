import type { Currency, InvoiceStatus } from "./logic";

export type Entity = {
  id: string;
  code: string;
  name: string;
  short_name: string;
  country: string | null;
  address: string | null;
  tax_id: string | null;
  invoice_prefix: string;
  tax_label: string;
  tax_rate: number;
  currency: Currency;
};

export type PayChannel = { id: string; name: string; type: string; account: string | null; details: string | null };

export type ClientOption = { id: string; name: string; currency: Currency };

export type BillTo = { name?: string; contact?: string; address?: string; tax_id?: string; email?: string; cc?: string };

export type InvoiceRow = {
  id: string;
  number: string | null;
  draft_no: number;
  status: InvoiceStatus;
  client_id: string;
  client_name: string;
  entity_id: string;
  currency: Currency;
  issued_on: string;
  due_on: string;
  title: string;
  total: number;
  amount_paid: number;
  amount_refunded: number;
  written_off_amount: number;
  fx_rate_usd: number | null;
};

export type InvoiceLine = {
  id?: string;
  description: string;
  detail: string;
  qty: number;
  rate: number;
  tax_pct: number;
};

export type InvoiceDetail = InvoiceRow & {
  po_ref: string | null;
  discount: number;
  subtotal: number;
  tax_total: number;
  channel_id: string | null;
  pay_link: string | null;
  notes: string | null;
  terms: string | null;
  bill_to: BillTo;
  status_reason: string | null;
  lines: InvoiceLine[];
};

export type InvoiceEvent = {
  id: string;
  kind: string;
  note: string | null;
  amount: number | null;
  created_at: string;
  actor_name: string | null;
};

/** A payment received (from 0111 receipts). `rate` is the USD rate saved when it was recorded. */
export type Receipt = { date: string; amount: number; fee: number; currency: Currency; rate: number | null; channelId: string | null };
export type Refund = { date: string; amount: number; currency: Currency; rate: number | null };

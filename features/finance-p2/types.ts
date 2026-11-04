// Row and view types for finance-p2 (migration 0206_finance_p2) and the Phase 1 finance rows it reads.

export type Result<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

export const CURRENCIES = ["AED", "USD", "PKR"] as const;
export type Currency = (typeof CURRENCIES)[number];

/** Phase 1 invoice statuses (0110_finance_core). Overdue is derived, never stored. */
export type InvoiceStatus =
  | "draft"
  | "issued"
  | "partly_paid"
  | "paid"
  | "void"
  | "refunded"
  | "partly_refunded"
  | "written_off"
  | "disputed";

export type FeeBasis = "monthly" | "weekly" | "hourly" | "one_time";

/** A billing profile joined with its client name and entity tax rate. */
export type BillingProfile = {
  clientId: string;
  clientName: string;
  entityId: string;
  entityName: string;
  currency: Currency;
  agreedFee: number;
  feeBasis: FeeBasis;
  termsDays: number;
  taxRate: number;
};

/** client_sub_accounts (0202_client_data). billing = 'parent' means the child is billed under the parent. */
export type SubLink = { parentId: string; childId: string; billing: "parent" | "own" };

export type DraftLine = { description: string; qty: number; rate: number; taxPct: number };

export type DraftPlan = {
  clientId: string;
  clientName: string;
  entityId: string;
  entityName: string;
  currency: Currency;
  title: string;
  issuedOn: string;
  dueOn: string;
  lines: DraftLine[];
  subtotal: number;
  tax: number;
  total: number;
  subClientIds: string[];
};

/** An invoice as finance-p2 needs it. Balance = total - amountPaid - paidBeforePortal - creditApplied. */
export type InvoiceLite = {
  id: string;
  number: string | null;
  clientId: string;
  clientName: string;
  entityId: string | null;
  currency: Currency;
  status: InvoiceStatus;
  title: string | null;
  issuedOn: string | null;
  dueOn: string | null;
  total: number;
  amountPaid: number;
  paidBeforePortal: number;
  creditApplied: number;
};

export type InvoiceExtra = {
  invoice_id: string;
  client_id: string;
  portal_visible: boolean;
  is_past: boolean;
  paid_before_portal: number;
  original_doc_path: string | null;
  original_doc_name: string | null;
};

export type CreditKind = "applied" | "given_back";
export type CreditIn = { clientId: string; currency: Currency; amount: number };
export type CreditMovement = {
  id: string;
  clientId: string;
  clientName: string;
  kind: CreditKind;
  amount: number;
  currency: Currency;
  invoiceNumber: string | null;
  channel: string | null;
  reference: string | null;
  reason: string | null;
  createdAt: string;
};
export type CreditBalance = { clientId: string; clientName: string; currency: Currency; amount: number };

export const UPWORK_STATUSES = ["in_review", "pending_release", "released"] as const;
export type UpworkStatus = (typeof UPWORK_STATUSES)[number];
export type UpworkEarning = {
  id: string;
  contract: string;
  upwork_client: string;
  kind: "fixed" | "hourly";
  hours: number | null;
  earned: number;
  fee: number;
  currency: Currency;
  status: UpworkStatus;
  earned_on: string;
  note: string | null;
};
export type UpworkWithdrawal = { id: string; amount: number; currency: Currency; withdrawn_on: string; to_account: string; reference: string | null };

export const EXPORT_KINDS = ["invoices", "payments", "aging"] as const;
export type ExportKind = (typeof EXPORT_KINDS)[number];
export type ExportLog = {
  id: string;
  kind: ExportKind;
  entity_label: string | null;
  from_date: string | null;
  to_date: string | null;
  row_count: number;
  created_at: string;
  by_name: string | null;
};

/** A receipt as the payments export needs it (0111_finance_ops). */
export type ReceiptLite = {
  receivedOn: string;
  clientName: string;
  amount: number;
  fee: number;
  landed: number | null;
  currency: Currency;
  channel: string | null;
  reference: string | null;
};

export const EMAIL_PROVIDERS = ["none", "resend", "brevo", "smtp"] as const;
export type EmailProviderSetting = (typeof EMAIL_PROVIDERS)[number];
export type DnsState = "unknown" | "passing" | "failing" | "missing";
export type EmailSettings = {
  provider: EmailProviderSetting;
  from_name: string | null;
  from_email: string | null;
  reply_to: string | null;
  domain: string | null;
  domain_status: "unknown" | "pending" | "verified" | "failed";
  spf: DnsState;
  dkim: DnsState;
  dmarc: DnsState;
  checked_at: string | null;
};
export type EmailLogRow = { status: "sent" | "bounced" | "failed"; created_at: string };

export type Option = { id: string; name: string };
export type EntityOption = Option & { currency: Currency };

import type { Currency } from "../core/logic";
import type { FeeBasis, Stage } from "./logic";

export type ReceiptRow = {
  id: string;
  no: number;
  clientId: string;
  clientName: string;
  date: string;
  currency: Currency;
  amount: number;
  fee: number;
  landed: number;
  rate: number | null;
  channelId: string | null;
  channelName: string | null;
  account: string | null;
  reference: string | null;
  note: string | null;
  proofPaths: string[];
  noProofReason: string | null;
  status: "recorded" | "void";
  voidReason: string | null;
  allocations: { invoiceId: string; number: string; amount: number }[];
  credit: number;
};

export type CreditRow = { clientId: string; clientName: string; currency: Currency; amount: number; from: string };

export type RefundRow = { date: string; clientName: string; invoiceId: string; number: string; currency: Currency; amount: number; reason: string; rate: number | null };

export type OpenInvoiceRow = {
  id: string;
  number: string;
  clientId: string;
  clientName: string;
  currency: Currency;
  due: string;
  balance: number;
  overdue: boolean;
  /** USD rate saved on the invoice. */
  rate: number | null;
};

export type ClientPick = { id: string; name: string; currency: Currency; channelId: string | null };
export type ChannelPick = { id: string; name: string; account: string | null };

export type BillingRow = {
  clientId: string;
  clientName: string;
  clientCurrency: Currency;
  hasProfile: boolean;
  legalName: string;
  contact: string;
  billingEmail: string;
  cc: string;
  country: string;
  address: string;
  taxId: string;
  entityId: string | null;
  entityShort: string | null;
  currency: Currency;
  channelId: string | null;
  channelName: string | null;
  termsDays: number;
  agreedFee: number;
  feeBasis: FeeBasis;
  hoursBudget: number | null;
  notes: string;
  autoReminders: boolean;
  openBalance: number;
};

export type ReminderRow = {
  id: string;
  invoiceId: string;
  number: string;
  clientId: string;
  clientName: string;
  currency: Currency;
  balance: number;
  due: string;
  stage: Stage;
  sendOn: string;
  status: "pending" | "sent" | "skipped";
  auto: boolean;
  pausedUntil: string | null;
  pauseNote: string | null;
  sentAt: string | null;
  sentByName: string | null;
  result: string | null;
  ownerName: string | null;
  ownerEmail: string | null;
  billingEmail: string;
  cc: string;
  contact: string;
  channelName: string | null;
};

export type OpsSettings = {
  marginAlertPct: number;
  workingHours: number;
  alertMargin: boolean;
  alertBudget: boolean;
  alertNegative: boolean;
  alertTo: "leaders" | "finance";
  reminderStages: Stage[];
  tellAmAt30: boolean;
  reminderRunTime: string;
  reminderFrom: string;
};

export type EntityRow = {
  id: string;
  code: string;
  name: string;
  shortName: string;
  country: string | null;
  address: string | null;
  taxId: string | null;
  prefix: string;
  taxLabel: string;
  taxRate: number;
  currency: Currency;
  nextNumber: number;
  active: boolean;
};

export type ChannelRow = {
  id: string;
  name: string;
  type: "wise" | "paypal" | "slash" | "bank" | "payoneer" | "other";
  account: string | null;
  details: string | null;
  feeNote: string | null;
  active: boolean;
};

export type SalaryRow = { memberId: string; name: string; department: string; amount: number | null; currency: Currency; validFrom: string | null };

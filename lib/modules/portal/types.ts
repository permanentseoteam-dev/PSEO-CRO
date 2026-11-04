import type { TicketStatus } from "./logic";

export type PortalClient = { id: string; name: string; welcome: string | null };

export type ApprovalFile = { name: string; type: string };
export type Approval = {
  id: string;
  title: string;
  body: string | null;
  files: ApprovalFile[];
  status: "waiting" | "approved" | "changes";
  sentBy: string;
  sentAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  changeNote: string | null;
};

export type ClientTicket = {
  id: string;
  title: string;
  status: TicketStatus;
  dueDate: string | null;
  completedAt: string | null;
  assignee: string | null;
};

export type Activity = { id: string; actorName: string; action: string; href: string | null; happenedAt: string };
export type TeamMember = { id: string; name: string; title: string | null; role: string };

export type UpcomingMeeting = { id: string; title: string; startsAt: string; minutes: number; meetLink: string | null; with: string[] };
export type Todo = { id: string; title: string; done: boolean };
export type PastMeeting = {
  id: string;
  title: string;
  heldAt: string;
  people: string[];
  summary: string | null;
  decisions: string[];
  todos: Todo[];
};

export type Folder = { id: string; name: string; kind: "brand" | "from_client" | "custom"; count: number };
export type PortalFile = {
  id: string;
  name: string;
  folderId: string;
  folderName: string;
  addedBy: string;
  date: string;
  size: number;
  versionId: string | null;
};
export type BrandKit = { colours: { name: string; hex: string }[]; fonts: string | null; tone: string | null; dos: string[]; donts: string[] };

export type InvoiceLine = { description: string; amount: number };
export type PortalInvoice = {
  id: string;
  number: string;
  title: string;
  status: string;
  currency: string;
  issuedOn: string;
  dueOn: string;
  subtotal: number;
  discount: number;
  taxTotal: number;
  total: number;
  amountPaid: number;
  writtenOff: number;
  payLink: string | null;
  channelId: string | null;
  lines: InvoiceLine[];
};
export type PayChannel = { id: string; name: string; account: string | null; details: string | null };
export type PortalReceipt = { id: string; no: number; receivedOn: string; amount: number; currency: string; invoiceNumbers: string[] };

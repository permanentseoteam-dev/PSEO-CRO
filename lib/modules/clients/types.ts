import type { Band, HealthFactor, Severity } from "./logic";

export type Person = { id: string; name: string; department: string | null };

export type ClientRow = {
  id: string;
  name: string;
  site: string | null;
  services: string[];
  country: string | null;
  channel: string;
  currency: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  end_reason: string | null;
  owner_id: string | null;
  manager_id: string | null;
  notes: string | null;
  health_score: number | null;
  health_band: Band;
  health_factors: HealthFactor[] | null;
  health_at: string | null;
  portal_logo_url: string | null;
  portal_color: string | null;
  portal_welcome: string | null;
};

export type Terms = {
  client_id: string;
  monthly_fee: number | null;
  currency: string;
  term_months: number | null;
  term_start: string | null;
  notice_days: number | null;
  renewal_date: string | null;
  hours_per_month: number | null;
  in_scope: string | null;
  out_of_scope: string | null;
  agreement_name: string | null;
};

export type PortfolioCard = {
  id: string;
  name: string;
  status: string;
  band: Band;
  score: number | null;
  /** Score change over the last 7 days (client_health_history), null when unknown. */
  change7: number | null;
  ownerName: string;
  services: string[];
  contactDays: number | null;
  nextMeeting: string | null; // ISO
  report: string;
};

export type EndedClient = { id: string; name: string; endDate: string | null; reason: string | null; fee: string | null };

export type Portfolio = {
  cards: PortfolioCard[];
  ended: EndedClient[];
  owners: string[];
  stats: {
    total: number;
    active: number;
    paused: number;
    atRisk: string[];
    openEscalations: number;
    pastWindow: number;
    reportsNotSent: number;
    reportsSeen: boolean;
    meetingsThisWeek: number;
    nextMeeting: { client: string; at: string } | null;
  };
  byOwner: { ownerName: string; band: Band; escalations: number; fee: number | null; currency: string }[];
  feesVisible: boolean;
  reportMonth: string;
};

export type Contact = {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  is_main: boolean;
  gets_reports: boolean;
};

export type TeamMember = { member_id: string; name: string; role: string; department: string | null; minutes: number };

export type TimelineEntry = {
  id: string;
  kind: string;
  happened_on: string;
  with_name: string | null;
  mood: string | null;
  body: string;
  decisions: string | null;
  concerns: string | null;
  action_items: string[];
  by: string | null;
};

export type Escalation = {
  id: string;
  title: string;
  details: string | null;
  severity: Severity;
  owner: string | null;
  ticketKey: string | null;
  ticketStatus: string | null;
  status: "open" | "closed";
  opened_at: string;
  due_at: string;
  closed_at: string | null;
  client_rating: number | null;
};

export type Meeting = { id: string; title: string; starts_at: string; where: string | null; people: string[] };

export type PortalLogin = { id: string; name: string; email: string; status: string; role: string | null };

export type ClientPage = {
  client: ClientRow;
  ownerName: string | null;
  managerName: string | null;
  terms: Terms | null;
  contacts: Contact[];
  team: TeamMember[];
  timeline: TimelineEntry[];
  escalations: Escalation[];
  meetings: Meeting[];
  openTickets: number;
  overdueTickets: number;
  hoursThisMonth: number;
  balance: { currency: string; amount: number }[] | null;
  lastContact: string | null;
  logins: PortalLogin[];
};

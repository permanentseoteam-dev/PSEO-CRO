export type Theme = "system" | "light" | "dark";
export type Presence = "available" | "meeting" | "focus" | "away" | "sick";

export type Pin = { href: string; title: string };

export type Notif = {
  id: string;
  actor: string | null;
  action: string;
  subject: string | null;
  detail: string | null;
  href: string | null;
  read: boolean;
  createdAt: string;
};

/** One clock-in session (Personal module's `attendance` table). */
export type ClockSession = { clockIn: string; clockOut: string | null };

/** The member's running timer (Personal module's `timers` table). */
export type RunningTimer = { id: string; ticketKey: string | null; startedAt: string };

export type ShellData = {
  settings: { collapsed: boolean; folded: string[] };
  pins: Pin[];
  notifications: Notif[];
  unread: number;
  /** null when the attendance table is not available. */
  clock: ClockSession[] | null;
  timer: RunningTimer | null;
};

export type PaletteItem = { section: "Pages" | "Task" | "Clients"; label: string; href: string; meta: string; icon: string };

export type TicketOptions = {
  projects: { id: string; key: string; name: string; createdBy?: string | null }[];
  people: { id: string; name: string }[];
  templates: { id: string; title: string; priority: string | null; dueInDays: number | null }[];
};

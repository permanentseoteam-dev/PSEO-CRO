import {
  BellRing, Building2, CalendarDays, ChartColumn, CircleUser, ClipboardCheck, Clock, FileText, FolderKanban, FolderOpen,
  House, LayoutTemplate, ListChecks, MessagesSquare, Network, Pin, Receipt, Settings, ShieldCheck, Target, Ticket, Timer, TrendingUp,
  Users, Video, Wallet, type LucideIcon,
} from "lucide-react";

// Explicit map (not `import *`) so only these icons ship. Names match lib/nav.ts.
const ICONS: Record<string, LucideIcon> = {
  BellRing, Building2, CalendarDays, ChartColumn, CircleUser, ClipboardCheck, Clock, FileText, FolderKanban, FolderOpen,
  House, LayoutTemplate, ListChecks, MessagesSquare, Network, Pin, Receipt, Settings, ShieldCheck, Target, Ticket, Timer, TrendingUp,
  Users, Video, Wallet,
};

export function NavIcon({ name }: { name: string }) {
  const Icon = ICONS[name] ?? Pin;
  return <Icon aria-hidden="true" />;
}

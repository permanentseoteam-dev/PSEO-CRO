// Sidebar groups and routes. The Shell module renders these; `perm` hides an item when can(me, perm) is false.
// `icon` is a lucide-react component name (import it from "lucide-react" in the shell).

export type NavItem = { href: string; title: string; icon: string; perm?: string };
export type NavGroup = { name: string; label: string | null; items: NavItem[] };

export const STAFF_NAV: NavGroup[] = [
  {
    name: "Core",
    label: null,
    items: [
      { href: "/home", title: "Home", icon: "House" },
      { href: "/my", title: "My work", icon: "ListChecks" },
      { href: "/calendar", title: "Calendar", icon: "CalendarDays", perm: "calendar.use" },
      { href: "/chat", title: "Chat", icon: "MessagesSquare", perm: "chat.use" },
    ],
  },
  {
    name: "Work",
    label: "Work",
    items: [
      { href: "/tickets", title: "Tickets", icon: "Ticket" },
      { href: "/projects", title: "Projects", icon: "FolderKanban" },
      { href: "/reviews", title: "Reviews", icon: "ClipboardCheck" },
      { href: "/templates", title: "Templates", icon: "LayoutTemplate" },
    ],
  },
  {
    name: "Clients",
    label: "Clients",
    items: [
      { href: "/clients", title: "Client Portfolio", icon: "Building2", perm: "clients.view" },
      { href: "/response-times", title: "Response times", icon: "Timer", perm: "clients.view" },
      { href: "/meetings", title: "Meetings", icon: "Video", perm: "clients.view" },
      { href: "/files", title: "Files", icon: "FolderOpen", perm: "clients.view" },
    ],
  },
  {
    name: "Finance",
    label: "Finance",
    items: [
      { href: "/finance", title: "Dashboard", icon: "ChartColumn", perm: "finance.dashboard.view" },
      { href: "/finance/invoices", title: "Invoices", icon: "FileText", perm: "finance.invoices.view" },
      { href: "/finance/profitability", title: "Profitability", icon: "TrendingUp", perm: "finance.profitability.view" },
      { href: "/finance/payments", title: "Payments", icon: "Wallet", perm: "finance.payments.view" },
      { href: "/finance/clients", title: "Billing clients", icon: "Receipt", perm: "clients.billing.view" },
      { href: "/finance/reminders", title: "Payment reminder", icon: "BellRing", perm: "finance.invoices.send" },
    ],
  },
  {
    name: "Team",
    label: "Team",
    items: [
      { href: "/people", title: "Directory", icon: "Users", perm: "hr.directory.view" },
      { href: "/people/org", title: "Org chart", icon: "Network", perm: "hr.directory.view" },
      { href: "/performance", title: "Performance", icon: "Target" },
    ],
  },
  {
    name: "Personal",
    label: "Personal",
    items: [
      { href: "/me", title: "My profile", icon: "CircleUser" },
      { href: "/time", title: "Time", icon: "Clock" },
      { href: "/settings", title: "Settings", icon: "Settings" },
    ],
  },
  {
    name: "Admin",
    label: "Admin",
    items: [{ href: "/admin", title: "Admin", icon: "ShieldCheck", perm: "admin.access.manage" }],
  },
];

// Client portal lives under /portal (route groups share one URL space, so it needs its own prefix).
export const PORTAL_NAV: NavGroup[] = [
  {
    name: "Portal",
    label: null,
    items: [
      { href: "/portal", title: "Home", icon: "House" },
      { href: "/portal/work", title: "Work and approvals", icon: "ListChecks" },
      { href: "/portal/meetings", title: "Meetings", icon: "Video" },
      { href: "/portal/files", title: "Files", icon: "FolderOpen" },
      { href: "/portal/invoices", title: "Invoices", icon: "FileText", perm: "finance.invoices.view" },
      { href: "/portal/messages", title: "Messages", icon: "MessagesSquare", perm: "chat.use" },
    ],
  },
];

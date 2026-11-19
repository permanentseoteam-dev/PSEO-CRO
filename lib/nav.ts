// Sidebar groups and routes. The Shell module renders these; `perm` hides an item when can(me, perm, scope ?? "own") is false.
// `icon` is a lucide-react component name (import it from "lucide-react" in the shell).

import type { Scope } from "@/lib/auth/perms";

export type NavItem = { href: string; title: string; icon: string; perm?: string; scope?: Exclude<Scope, "none"> };
export type NavGroup = { name: string; label: string | null; items: NavItem[] };

export const STAFF_NAV: NavGroup[] = [
  {
    name: "Core",
    label: null,
    items: [
      { href: "/tickets", title: "Task", icon: "Ticket" },
      { href: "/projects", title: "Projects", icon: "FolderKanban" },
      { href: "/departments", title: "Departments", icon: "Layers", perm: "admin.access.manage", scope: "all" },
      { href: "/services", title: "Services", icon: "BriefcaseBusiness", perm: "admin.access.manage", scope: "all" },
      { href: "/settings", title: "General Settings", icon: "Settings", perm: "admin.access.manage", scope: "all" },
    ],
  },
];

// Client portal lives under /portal (route groups share one URL space, so it needs its own prefix).
export const PORTAL_NAV: NavGroup[] = [
  { name: "Portal", label: null, items: [{ href: "/portal/home", title: "Dashboard", icon: "House" }] },
];

// Hidden from the sidebar for now; the pages still work by URL. Move items back into STAFF_NAV/PORTAL_NAV to show them again.
export const UNLISTED_NAV: NavItem[] = [
  { href: "/home", title: "Home", icon: "House" },
  { href: "/my", title: "My work", icon: "ListChecks" },
  { href: "/calendar", title: "Calendar", icon: "CalendarDays", perm: "calendar.use" },
  { href: "/chat", title: "Chat", icon: "MessagesSquare", perm: "chat.use" },
  { href: "/reviews", title: "Reviews", icon: "ClipboardCheck" },
  { href: "/templates", title: "Templates", icon: "LayoutTemplate" },
  { href: "/clients", title: "Client Portfolio", icon: "Building2", perm: "clients.view" },
  { href: "/response-times", title: "Response times", icon: "Timer", perm: "clients.view" },
  { href: "/meetings", title: "Meetings", icon: "Video", perm: "clients.view" },
  { href: "/files", title: "Files", icon: "FolderOpen", perm: "clients.view" },
  { href: "/finance", title: "Dashboard", icon: "ChartColumn", perm: "finance.dashboard.view" },
  { href: "/finance/invoices", title: "Invoices", icon: "FileText", perm: "finance.invoices.view" },
  { href: "/finance/profitability", title: "Profitability", icon: "TrendingUp", perm: "finance.profitability.view" },
  { href: "/finance/payments", title: "Payments", icon: "Wallet", perm: "finance.payments.view" },
  { href: "/finance/clients", title: "Billing clients", icon: "Receipt", perm: "clients.billing.view" },
  { href: "/finance/reminders", title: "Payment reminder", icon: "BellRing", perm: "finance.invoices.send" },
  { href: "/people", title: "Directory", icon: "Users", perm: "hr.directory.view" },
  { href: "/people/org", title: "Org chart", icon: "Network", perm: "hr.directory.view" },
  { href: "/performance", title: "Performance", icon: "Target" },
  { href: "/me", title: "My profile", icon: "CircleUser" },
  { href: "/time", title: "Time", icon: "Clock" },
  { href: "/admin", title: "Admin", icon: "ShieldCheck", perm: "admin.access.manage" },
  { href: "/portal", title: "Home", icon: "House" },
  { href: "/portal/work", title: "Work and approvals", icon: "ListChecks" },
  { href: "/portal/meetings", title: "Meetings", icon: "Video" },
  { href: "/portal/files", title: "Files", icon: "FolderOpen" },
  { href: "/portal/invoices", title: "Invoices", icon: "FileText", perm: "finance.invoices.view" },
  { href: "/portal/messages", title: "Messages", icon: "MessagesSquare", perm: "chat.use" },
];

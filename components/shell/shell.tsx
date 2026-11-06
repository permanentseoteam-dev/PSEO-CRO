"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button, Dialog, useToast } from "@/components/ui";
import { PORTAL_NAV, STAFF_NAV } from "@/lib/nav";
import type { Scope } from "@/lib/auth/perms";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { activeHref, nextTheme, pageFor, visibleNav } from "@/lib/modules/shell/logic";
import { DEFAULT_AGENCY, type AgencySettings } from "@/lib/modules/agency/logic";
import { newTicketOptions, paletteData, saveSidebar, setTheme, togglePin } from "@/lib/modules/shell/actions";
import type { PaletteItem, ShellData, Theme, TicketOptions } from "@/lib/modules/shell/types";
import type { SidebarProjects } from "@/lib/modules/work/space-types";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { Palette } from "./palette";
import { NewTicketDialog } from "./new-ticket";
import { PageTitleContext } from "./page-title";
import { PushPrompt } from "@/features/platform-p2/components/push-prompt";

export type ShellProps = {
  /** "staff" = agency app, "portal" = client portal (client sidebar, no clock or timer). */
  variant: "staff" | "portal";
  me: { id: string; name: string; title: string | null; presence: string; kind: "staff" | "client"; perms: Record<string, Scope> };
  /** Portal brand (the client's name). Ignored for staff. */
  org?: string;
  /** Portal logo URL, shown in place of the initials mark. Ignored for staff. */
  logo?: string | null;
  /** Show the Team view / Client view switch. */
  viewSwitch: boolean;
  theme: Theme;
  /** agency: the agency brand and workday (getShellData); the defaults when absent. */
  data: ShellData & { agency?: AgencySettings | null };
  /** Staff only: sidebar Projects list and whether the "+" menu shows. */
  projects?: { list: SidebarProjects; canManage: boolean };
  children: ReactNode;
};

const SHORTCUTS: [string, string[]][] = [
  ["Search pages, tickets and clients", ["Ctrl K", "/"]],
  ["New ticket", ["C"]],
  ["Collapse or expand the sidebar", ["["]],
  ["Show shortcuts", ["?"]],
  ["Close a menu or dialog", ["Esc"]],
  ["Move through search results", ["↑", "↓", "Enter"]],
];

const initialsOf = (s: string) =>
  s.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

export function Shell({ variant, me, org, logo, viewSwitch, theme: initialTheme, data, projects, children }: ShellProps) {
  const portal = variant === "portal";
  const pathname = usePathname();
  const router = useRouter();
  const toast = useToast();
  const [, start] = useTransition();

  const [collapsed, setCollapsed] = useState(data.settings.collapsed);
  const [folded, setFolded] = useState(data.settings.folded);
  const [drawer, setDrawer] = useState(false);
  const [menu, setMenu] = useState<"me" | "bell" | "help" | null>(null);
  const [theme, setThemeState] = useState<Theme>(initialTheme);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [extra, setExtra] = useState<PaletteItem[]>([]);
  const [newOpen, setNewOpen] = useState(false);
  const [options, setOptions] = useState<TicketOptions | null>(null);
  const [keysOpen, setKeysOpen] = useState(false);
  const [titleOverride, setTitleOverride] = useState<string | null>(null);

  // Close the drawer and menus when the route changes (state adjusted during render, not in an effect).
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setDrawer(false);
    setMenu(null);
  }

  const groups = visibleNav(portal ? PORTAL_NAV : STAFF_NAV, me);
  const navHrefs = groups.flatMap((g) => g.items.map((i) => i.href));
  const active = activeHref(pathname, [...navHrefs, ...data.pins.map((p) => p.href)]);
  const agency = data.agency ?? DEFAULT_AGENCY;
  const page = pageFor(pathname, agency.name);
  const pinned = data.pins.some((p) => p.href === pathname);
  const brand = portal
    ? { name: org ?? "Client portal", sub: "Client portal", mark: initialsOf(org ?? "Client") || "C", logo: logo ?? null }
    : { name: agency.name, sub: agency.subtitle, mark: agency.initials, logo: agency.logoUrl };

  const persistSidebar = (c: boolean, f: string[]) => start(async () => void (await saveSidebar({ collapsed: c, folded: f })));
  const toggleCollapse = () => {
    setCollapsed(!collapsed);
    persistSidebar(!collapsed, folded);
  };
  const toggleFold = (g: string) => {
    const next = folded.includes(g) ? folded.filter((x) => x !== g) : [...folded, g];
    setFolded(next);
    persistSidebar(collapsed, next);
  };

  const cycleTheme = () => {
    const t = nextTheme(theme);
    setThemeState(t);
    const root = document.documentElement;
    if (t === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", t);
    toast(`Theme: ${t}`);
    start(async () => void (await setTheme(t)));
  };

  const pin = () =>
    start(async () => {
      const title = document.title.split(" · ")[0] || page.title;
      const r = await togglePin({ href: pathname, title });
      toast(!r.ok ? r.error : r.data?.pinned ? `Pinned ${title}` : `Unpinned ${title}`);
    });

  const openPalette = () => {
    setMenu(null);
    setDrawer(false);
    setPaletteOpen(true);
    if (!portal) start(async () => setExtra(await paletteData()));
  };

  const openNew = () => {
    setMenu(null);
    setDrawer(false);
    if (portal) {
      toast("Send requests to your account team in Messages");
      router.push("/portal/messages");
      return;
    }
    setNewOpen(true);
    start(async () => setOptions(await newTicketOptions()));
  };

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el?.closest?.("input, textarea, select, [contenteditable='true']");
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openPalette();
        return;
      }
      if (e.key === "Escape") {
        setMenu(null);
        setDrawer(false);
        return;
      }
      if (typing || mod || e.altKey || document.querySelector("dialog[open]")) return;
      if (e.key === "/") {
        e.preventDefault();
        openPalette();
      } else if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        openNew();
      } else if (e.key === "[") {
        e.preventDefault();
        if (window.innerWidth > 900) toggleCollapse();
      } else if (e.key === "?") {
        e.preventDefault();
        setKeysOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  // Click outside a menu closes it.
  useEffect(() => {
    if (!menu) return;
    const onClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".menu, [data-menu-btn]")) setMenu(null);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [menu]);

  // Live bell: a new notification for me re-renders the shell with fresh data.
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`notifications:${me.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `member_id=eq.${me.id}` }, () =>
        router.refresh(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [me.id, router]);

  const pages: PaletteItem[] = groups.flatMap((g) =>
    g.items.map((i) => ({ section: "Pages" as const, label: pageFor(i.href, agency.name).title, href: i.href, meta: g.label ?? "", icon: i.icon })),
  );

  return (
    <div className={cn("app", collapsed && "is-collapsed")}>
      <Sidebar
        portal={portal}
        brand={brand}
        groups={groups}
        pins={data.pins}
        active={active}
        collapsed={collapsed}
        folded={folded}
        onCollapse={toggleCollapse}
        onFold={toggleFold}
        open={drawer}
        me={me}
        clock={data.clock}
        workdayMin={agency.workdayMinutes}
        viewSwitch={viewSwitch}
        menuOpen={menu === "me"}
        onMenu={() => setMenu(menu === "me" ? null : "me")}
        projects={portal ? undefined : projects}
      />
      <div className={cn("backdrop", drawer && "open")} aria-hidden="true" onClick={() => setDrawer(false)} />
      <div className="main-col">
        <Topbar
          title={titleOverride ?? page.title}
          desc={page.desc}
          pinned={pinned}
          onPin={pin}
          onDrawer={() => setDrawer(true)}
          drawerOpen={drawer}
          onPalette={openPalette}
          onNew={openNew}
          newLabel={portal ? "New request" : "New ticket"}
          menu={menu === "me" ? null : menu}
          onMenu={setMenu}
          notifications={data.notifications}
          unread={data.unread}
          timer={portal ? null : data.timer}
          theme={theme}
          onTheme={cycleTheme}
          brandName={agency.name}
        />
        <main id="main" tabIndex={-1}>
          <PageTitleContext.Provider value={setTitleOverride}>{children}</PageTitleContext.Provider>
        </main>
      </div>

      <PushPrompt />
      <Palette open={paletteOpen} onClose={() => setPaletteOpen(false)} items={[...pages, ...extra]} />
      {!portal ? <NewTicketDialog open={newOpen} onClose={() => setNewOpen(false)} options={options} meId={me.id} /> : null}
      <Dialog
        open={keysOpen}
        onClose={() => setKeysOpen(false)}
        title="Keyboard shortcuts"
        footer={<Button onClick={() => setKeysOpen(false)}>Close</Button>}
      >
        <div className="keys">
          {SHORTCUTS.map(([label, keys]) => (
            <div key={label} className="k-row">
              <span>{label}</span>
              <span className="flex gap-1">
                {keys.map((k) => (
                  <kbd key={k}>{k}</kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
      </Dialog>
    </div>
  );
}

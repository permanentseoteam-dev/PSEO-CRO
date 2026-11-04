"use client";

import Link from "next/link";
import { useTransition } from "react";
import { ChevronDown, CircleUser, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Avatar, Seg, StatusDot, useToast } from "@/components/ui";
import type { NavGroup } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { PRESENCE, WORKDAY_MIN, fmtMinutes, todaySessions, workedMinutes } from "@/lib/modules/shell/logic";
import { setPresence, signOut, toggleClock } from "@/lib/modules/shell/actions";
import type { ClockSession, Pin, Presence } from "@/lib/modules/shell/types";
import { NavIcon } from "./icons";
import { useNowSeconds } from "./use-now";

type Props = {
  portal: boolean;
  brand: { name: string; sub: string; mark: string };
  groups: NavGroup[];
  pins: Pin[];
  active: string | null;
  collapsed: boolean;
  folded: string[];
  onCollapse: () => void;
  onFold: (group: string) => void;
  open: boolean;
  me: { name: string; title: string | null; presence: string };
  clock: ClockSession[] | null;
  /** Show the Team view / Client view switch (staff who can preview the portal). */
  viewSwitch: boolean;
  menuOpen: boolean;
  onMenu: () => void;
};

const iconFor = (groups: NavGroup[], href: string) =>
  groups.flatMap((g) => g.items).find((i) => i.href === href)?.icon ?? "Pin";

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

function NavLink({ href, title, icon, on }: { href: string; title: string; icon: string; on: boolean }) {
  return (
    <Link className={cn("nav-link", on && "on")} href={href} title={title} aria-current={on ? "page" : undefined}>
      <NavIcon name={icon} />
      <span className="txt">{title}</span>
    </Link>
  );
}

function ClockWidget({ sessions }: { sessions: ClockSession[] }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const secs = useNowSeconds();
  const isIn = sessions.some((s) => !s.clockOut);
  const now = secs == null ? null : new Date(secs * 1000);
  const today = now ? todaySessions(sessions, now) : [];
  const worked = now ? workedMinutes(today, now) : 0;
  const last = today.at(-1);

  let text: React.ReactNode = " ";
  if (now && isIn && today[0]) text = <>Clocked in <b>{hhmm(today[0].clockIn)}</b> · {fmtMinutes(worked)}</>;
  else if (now && last?.clockOut) text = <>Clocked out at <b>{hhmm(last.clockOut)}</b> · {fmtMinutes(worked)}</>;
  else if (now) text = "Not clocked in yet";

  const click = () =>
    start(async () => {
      const r = await toggleClock();
      if (!r.ok) return toast(r.error);
      const t = hhmm(new Date().toISOString());
      toast(r.data?.clockedIn ? `Clocked in at ${t}` : `Clocked out at ${t} · ${fmtMinutes(worked)} today`);
    });

  return (
    <div className="clock">
      <div className="clock-top">
        <span className="clock-text">{text}</span>
      </div>
      <div className={cn("bar", !isIn && "t-muted")} title={`${fmtMinutes(worked)} of 8h`}>
        <i style={{ width: `${Math.min(100, Math.round((worked / WORKDAY_MIN) * 100))}%` }} />
      </div>
      <button type="button" className="btn sm" onClick={click} disabled={pending}>
        {isIn ? "Clock out" : "Clock in"}
      </button>
    </div>
  );
}

export function Sidebar(p: Props) {
  const toast = useToast();
  const [, start] = useTransition();
  const status = PRESENCE.find((s) => s.value === p.me.presence) ?? PRESENCE[0];

  const pickStatus = (value: Presence, label: string) =>
    start(async () => {
      p.onMenu();
      const r = await setPresence(value);
      toast(r.ok ? `Status set to ${label}` : r.error);
    });

  return (
    <aside id="sidebar" className={cn("sidebar", p.open && "open")} aria-label="Main navigation">
      <div className="brand">
        <span
          className="brand-mark grid place-items-center rounded-lg font-display text-[13px] font-extrabold text-white"
          style={{ background: p.portal ? "var(--blue)" : "var(--accent)" }}
          aria-hidden="true"
        >
          {p.brand.mark}
        </span>
        <span className="brand-name">
          {p.brand.name}
          <span className="brand-sub">{p.brand.sub}</span>
        </span>
        <button
          type="button"
          className="icon-btn sm collapse-btn"
          onClick={p.onCollapse}
          aria-label={p.collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={`${p.collapsed ? "Expand" : "Collapse"} ( [ )`}
        >
          {p.collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </button>
      </div>

      {!p.portal && p.clock ? <ClockWidget sessions={p.clock} /> : null}

      {p.pins.length ? (
        <nav className="nav-group" aria-label="Pinned">
          <span className="side-sec-title">Pinned</span>
          <div className="pinned">
            {p.pins.map((pin) => (
              <NavLink key={pin.href} href={pin.href} title={pin.title} icon={iconFor(p.groups, pin.href)} on={pin.href === p.active} />
            ))}
          </div>
        </nav>
      ) : null}

      {p.groups.map((g) => {
        const folded = Boolean(g.label) && p.folded.includes(g.name);
        return (
          <nav key={g.name} className={cn("nav-group", folded && "folded")} aria-label={g.label ?? "Main"}>
            {g.label ? (
              <button type="button" className="nav-label" onClick={() => p.onFold(g.name)} aria-expanded={!folded}>
                {g.label}
                <ChevronDown aria-hidden="true" />
              </button>
            ) : null}
            <div className="nav-links">
              {g.items.map((i) => (
                <NavLink key={i.href} href={i.href} title={i.title} icon={i.icon} on={i.href === p.active} />
              ))}
            </div>
          </nav>
        );
      })}

      <div className="side-foot">
        {p.viewSwitch ? (
          <Seg
            label="Preview as"
            value={p.portal ? "client" : "team"}
            items={[
              { value: "team", label: "Team view", href: "/home" },
              { value: "client", label: "Client view", href: "/portal" },
            ]}
          />
        ) : null}
        <button type="button" className="me-btn" data-menu-btn onClick={p.onMenu} aria-haspopup="menu" aria-expanded={p.menuOpen}>
          <Avatar name={p.me.name} size={34} />
          <span className="me-meta">
            <b>{p.me.name}</b>
            {p.portal ? (
              <span className="small muted">{p.me.title ?? "Client"}</span>
            ) : (
              <StatusDot tone={status.tone}>{status.label}</StatusDot>
            )}
          </span>
        </button>
        {p.menuOpen ? (
          <div className="menu" role="menu">
            {!p.portal ? (
              <>
                {PRESENCE.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={s.value === status.value}
                    className={cn(s.value === status.value && "on")}
                    onClick={() => pickStatus(s.value, s.label)}
                  >
                    <StatusDot tone={s.tone}>{s.label}</StatusDot>
                  </button>
                ))}
                <hr />
              </>
            ) : null}
            <Link role="menuitem" href={p.portal ? "/portal" : "/me"} onClick={p.onMenu}>
              <CircleUser className="size-4" aria-hidden="true" />
              {p.portal ? "My account" : "My profile"}
            </Link>
            <form action={signOut}>
              <button type="submit" role="menuitem">
                <LogOut className="size-4" aria-hidden="true" />
                Sign out
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

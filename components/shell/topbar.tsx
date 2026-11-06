"use client";

import Link from "next/link";
import { useEffect, useTransition } from "react";
import { Bell, CircleHelp, Menu, Monitor, Moon, Plus, Search, Square, Star, Sun } from "lucide-react";
import { Avatar, Button, useToast } from "@/components/ui";
import { cn } from "@/lib/utils";
import { fmtClock, timeAgo } from "@/lib/modules/shell/logic";
import { heartbeat, markAllRead, markRead, stopTimer } from "@/lib/modules/shell/actions";
import type { Notif, RunningTimer, Theme } from "@/lib/modules/shell/types";
import { useNowSeconds } from "./use-now";

type Menu = "bell" | "help" | null;

type Props = {
  title: string;
  desc: string;
  pinned: boolean;
  onPin: () => void;
  onDrawer: () => void;
  drawerOpen: boolean;
  onPalette: () => void;
  onNew: () => void;
  newLabel: string;
  menu: Menu;
  onMenu: (m: Menu) => void;
  notifications: Notif[];
  unread: number;
  timer: RunningTimer | null;
  theme: Theme;
  onTheme: () => void;
  /** Agency name, the avatar for notifications with no person behind them. */
  brandName: string;
};

const HEARTBEAT_MS = 4 * 60 * 1000;

function TimerChip({ timer }: { timer: RunningTimer }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const secs = useNowSeconds();
  const elapsed = secs == null ? 0 : secs - Math.floor(new Date(timer.startedAt).getTime() / 1000);

  useEffect(() => {
    const t = setInterval(() => void heartbeat(timer.id), HEARTBEAT_MS);
    return () => clearInterval(t);
  }, [timer.id]);

  const stop = () =>
    start(async () => {
      const r = await stopTimer(timer.id);
      if (!r.ok) return toast(r.error);
      const where = timer.ticketKey ? ` to ${timer.ticketKey}` : "";
      toast(r.data?.minutes ? `Timer stopped · ${fmtClock(elapsed)} logged${where}` : "Timer stopped · under 1 minute, nothing logged");
    });

  return (
    <div className="timer" title="Running timer">
      <span className="dot" aria-hidden="true" />
      {timer.ticketKey ? (
        <Link className="tk" href={`/t/${timer.ticketKey}`}>
          {timer.ticketKey}
        </Link>
      ) : null}
      <span className="t" aria-live="off">
        {fmtClock(elapsed)}
      </span>
      <button type="button" className="icon-btn sm" onClick={stop} disabled={pending} aria-label="Stop timer" title="Stop timer">
        <Square />
      </button>
    </div>
  );
}

function BellPanel({ notifications, unread, close, brandName }: { notifications: Notif[]; unread: number; close: () => void; brandName: string }) {
  const toast = useToast();
  const [, start] = useTransition();
  const secs = useNowSeconds();
  const now = secs == null ? null : new Date(secs * 1000);

  const readAll = () =>
    start(async () => {
      const r = await markAllRead();
      toast(r.ok ? "All notifications marked read" : r.error);
    });
  const open = (n: Notif) => {
    close();
    if (!n.read) start(async () => void (await markRead(n.id)));
  };

  return (
    <div className="menu bell-panel">
      <div className="bp-head">
        <h3>Notifications</h3>
        {unread ? (
          <Button variant="ghost" size="sm" onClick={readAll}>
            Mark all read
          </Button>
        ) : null}
      </div>
      <div className="bp-list">
        {notifications.length === 0 ? <p className="pal-empty">You&apos;re all caught up</p> : null}
        {notifications.map((n) => {
          const body = (
            <>
              <Avatar name={n.actor ?? brandName} size={30} />
              <span className="n-body">
                {n.actor ? <b>{n.actor} </b> : null}
                {n.action}
                {n.subject ? <b> {n.subject}</b> : null}
                {n.detail ? ` ${n.detail}` : null}
                <br />
                <span className="n-time">{now ? timeAgo(n.createdAt, now) : " "}</span>
              </span>
            </>
          );
          return n.href ? (
            <Link key={n.id} className={cn("notif", !n.read && "unread")} href={n.href} onClick={() => open(n)}>
              {body}
            </Link>
          ) : (
            <button key={n.id} type="button" className={cn("notif w-full border-0 text-left", !n.read && "unread")} onClick={() => open(n)}>
              {body}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Topbar(p: Props) {
  const ThemeIcon = p.theme === "dark" ? Moon : p.theme === "light" ? Sun : Monitor;
  const themeLabel = `Theme: ${p.theme}`;
  const toggle = (m: Exclude<Menu, null>) => p.onMenu(p.menu === m ? null : m);

  return (
    <header className="topbar" id="topbar">
      <button
        type="button"
        className="icon-btn hamburger"
        onClick={p.onDrawer}
        aria-label="Open menu"
        aria-controls="sidebar"
        aria-expanded={p.drawerOpen}
      >
        <Menu />
      </button>
      <div className="tb-title">
        <h1 id="page-title">{p.title}</h1>
        <button
          type="button"
          className="icon-btn sm pin-btn"
          onClick={p.onPin}
          aria-pressed={p.pinned}
          aria-label={p.pinned ? "Unpin this page" : "Pin this page"}
          title="Pin to sidebar"
        >
          <Star />
        </button>
        {p.desc ? (
          <>
            <button
              type="button"
              className="icon-btn sm help-btn"
              data-menu-btn
              onClick={() => toggle("help")}
              aria-label="About this page"
              aria-expanded={p.menu === "help"}
              title="About this page"
            >
              <CircleHelp />
            </button>
            {p.menu === "help" ? (
              <div className="menu help-pop" role="tooltip">
                {p.desc}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
      <div className="tb-actions">
        <button type="button" className="search-btn" onClick={p.onPalette} aria-label="Search (Ctrl K)">
          <Search aria-hidden="true" />
          <span className="txt">Search</span>
          <kbd>Ctrl K</kbd>
        </button>
        {p.timer ? <TimerChip timer={p.timer} /> : null}
        <button
          type="button"
          className="icon-btn"
          data-menu-btn
          onClick={() => toggle("bell")}
          aria-label={`Notifications, ${p.unread} unread`}
          aria-expanded={p.menu === "bell"}
        >
          <Bell />
        </button>
        <span className="bell-count" aria-hidden="true">
          {p.unread || ""}
        </span>
        {p.menu === "bell" ? <BellPanel notifications={p.notifications} unread={p.unread} close={() => p.onMenu(null)} brandName={p.brandName} /> : null}
        <button type="button" className="icon-btn" onClick={p.onTheme} title={themeLabel} aria-label={`${themeLabel}. Click to change`}>
          <ThemeIcon />
        </button>
        <button type="button" className="btn primary new-ticket" onClick={p.onNew} title={`${p.newLabel} (C)`}>
          <Plus aria-hidden="true" />
          <span className="txt">{p.newLabel}</span>
        </button>
      </div>
    </header>
  );
}

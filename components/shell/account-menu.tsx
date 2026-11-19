"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { ChevronRight, CircleUser, LogOut } from "lucide-react";
import { Avatar, StatusDot, useToast } from "@/components/ui";
import { cn } from "@/lib/utils";
import { PRESENCE } from "@/lib/modules/shell/logic";
import { previewClients, setPresence, signOut } from "@/lib/modules/shell/actions";
import { startClientPreview } from "@/app/(app)/clients/preview-actions";
import type { Presence } from "@/lib/modules/shell/types";

type Props = {
  me: { name: string; email?: string | null; presence: string };
  portal: boolean;
  /** Staff who can preview the client portal ("Login As"). */
  canPreview: boolean;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
};

export function AccountMenu({ me, portal, canPreview, open, onToggle, onClose }: Props) {
  const toast = useToast();
  const [pending, start] = useTransition();
  const [clients, setClients] = useState<{ id: string; name: string }[] | null>(null);
  const [loginAs, setLoginAs] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const status = PRESENCE.find((s) => s.value === me.presence) ?? PRESENCE[0];

  // Focus the first item when the menu opens; give focus back to the avatar when it closes.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) menuRef.current?.querySelector<HTMLElement>("[role^='menuitem']")?.focus();
    else if (wasOpen.current) btnRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  const pickStatus = (value: Presence, label: string) =>
    start(async () => {
      onClose();
      const r = await setPresence(value);
      toast(r.ok ? `Status set to ${label}` : r.error);
    });

  const toggleLoginAs = () => {
    setLoginAs(!loginAs);
    if (!clients) start(async () => setClients(await previewClients()));
  };

  const preview = (id: string) =>
    start(async () => {
      // On success the action redirects to the portal, so only an error comes back.
      const r = await startClientPreview(id);
      toast(r.error);
    });

  // Up/Down move between items, like a native menu.
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...(menuRef.current?.querySelectorAll<HTMLElement>("[role^='menuitem']") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length]?.focus();
  };

  return (
    <div className="acct">
      <button
        ref={btnRef}
        type="button"
        className="acct-btn"
        data-menu-btn
        onClick={onToggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${me.name}`}
      >
        <Avatar name={me.name} size={34} />
      </button>
      {open ? (
        <div ref={menuRef} className="menu acct-menu" role="menu" aria-label="Account" onKeyDown={onKey}>
          <div className="acct-head">
            <Avatar name={me.name} size={38} />
            <span className="acct-meta">
              <b>{me.name}</b>
              {me.email ? <span>{me.email}</span> : null}
            </span>
          </div>
          <hr />
          {!portal ? (
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
          {canPreview && !portal ? (
            <>
              <button type="button" role="menuitem" aria-expanded={loginAs} onClick={toggleLoginAs}>
                <span className="flex-1">Login As</span>
                <ChevronRight className={cn("size-4 acct-chev", loginAs && "open")} aria-hidden="true" />
              </button>
              {loginAs ? (
                <div className="acct-list" role="group" aria-label="Clients">
                  {clients == null ? <p className="acct-note">Loading clients…</p> : null}
                  {clients?.length === 0 ? <p className="acct-note">No active clients you can preview.</p> : null}
                  {clients?.map((c) => (
                    <button key={c.id} type="button" role="menuitem" disabled={pending} onClick={() => preview(c.id)}>
                      <Avatar name={c.name} size={24} />
                      <span className="truncate">{c.name}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
          <Link role="menuitem" href={portal ? "/portal" : "/account"} onClick={onClose}>
            <CircleUser className="size-4" aria-hidden="true" />
            My account
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
  );
}

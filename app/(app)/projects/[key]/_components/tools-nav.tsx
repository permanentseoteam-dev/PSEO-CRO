"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, FileText, Settings, SquareCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import s from "./tools-nav.module.css";

const STORE_KEY = "project-tools-hidden";

/** Two-column project workspace: a "Tools" panel on the left (a tab row on mobile) and the page on the right. */
export function ToolsShell({ projectKey, children }: { projectKey: string; children: ReactNode }) {
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);

  // localStorage is browser-only, so read it after mount.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHidden(localStorage.getItem(STORE_KEY) === "1");
  }, []);

  function toggle(v: boolean) {
    setHidden(v);
    localStorage.setItem(STORE_KEY, v ? "1" : "0");
  }

  const base = `/projects/${projectKey}`;
  const items = [
    { href: `${base}/tasks`, label: "Tasks", icon: <SquareCheck /> },
    { href: `${base}/notes`, label: "Notes", icon: <FileText /> },
    { href: `${base}/settings`, label: "Settings", icon: <Settings /> },
  ];

  return (
    <div className={cn(s.shell, hidden && s.hidden)}>
      {hidden ? (
        <button type="button" className={s.show} onClick={() => toggle(false)} aria-label="Show tools" title="Show tools">
          <ChevronRight />
        </button>
      ) : null}
      <aside className={s.tools}>
        <h2 className={s.heading}>Tools</h2>
        <nav className={s.nav} aria-label="Project tools">
          {items.map((it) => {
            const on = pathname === it.href || pathname.startsWith(it.href + "/");
            return (
              <Link key={it.href} href={it.href} className={cn(s.item, on && s.on)} aria-current={on ? "page" : undefined}>
                {it.icon}
                {it.label}
              </Link>
            );
          })}
        </nav>
        <button type="button" className={s.hide} onClick={() => toggle(true)}>
          <ChevronLeft /> Hide tools
        </button>
      </aside>
      <div className={s.main}>{children}</div>
    </div>
  );
}

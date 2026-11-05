"use client";

import { useCallback, useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { X } from "lucide-react";
import { IconButton } from "@/components/ui";
import s from "../tasks.module.css";

/** Right-side task panel, opened by ?task=KEY. X, Esc or a click on the backdrop removes the param. */
export function TaskDrawer({ view, crumb, left, right }: { view: "table" | "kanban"; crumb: ReactNode; left: ReactNode; right: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const close = useCallback(
    () => router.replace(view === "kanban" ? `${pathname}?view=kanban` : pathname, { scroll: false }),
    [router, pathname, view],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Esc inside a field or an open modal belongs to that control.
      if (e.key !== "Escape" || e.defaultPrevented || document.querySelector("dialog[open]")) return;
      if ((e.target as HTMLElement | null)?.closest("input, textarea, select")) return;
      close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  return (
    <div className={s.overlay} onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <section className={s.drawer} role="dialog" aria-modal="true" aria-label="Task">
        <header className={s.drawerHead}>
          <nav className={s.crumb} aria-label="Breadcrumb">{crumb}</nav>
          <IconButton label="Close" size="sm" onClick={close}>
            <X size={16} aria-hidden="true" />
          </IconButton>
        </header>
        <div className={s.drawerBody}>
          <div className={s.drawerLeft}>{left}</div>
          {right ? <div className={s.drawerRight}>{right}</div> : null}
        </div>
      </section>
    </div>
  );
}

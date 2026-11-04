"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PaletteItem } from "@/lib/modules/shell/types";
import { NavIcon } from "./icons";

/** Ctrl/Cmd+K command palette. `items` = pages plus tickets and clients loaded when it opens. */
export function Palette({ open, onClose, items }: { open: boolean; onClose: () => void; items: PaletteItem[] }) {
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      input.current?.focus();
    }
    if (!open && d.open) d.close();
  }, [open]);

  const query = q.trim().toLowerCase();
  const list = items.filter((i) => !query || `${i.label} ${i.meta}`.toLowerCase().includes(query)).slice(0, 60);
  const cur = Math.min(sel, Math.max(list.length - 1, 0));

  const close = () => {
    setQ("");
    setSel(0);
    onClose();
  };
  const go = (i: PaletteItem | undefined) => {
    if (!i) return;
    close();
    router.push(i.href);
  };

  return (
    <dialog
      ref={ref}
      className="modal palette"
      aria-label="Search"
      onClose={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="pal-input">
        <Search aria-hidden="true" />
        <input
          ref={input}
          type="text"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setSel(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setSel(Math.min(cur + 1, list.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setSel(Math.max(cur - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              go(list[cur]);
            }
          }}
          placeholder="Search pages, tickets and clients"
          autoComplete="off"
          aria-controls="pal-list"
          aria-label="Search"
        />
        <kbd>Esc</kbd>
      </div>
      <div className="pal-list" id="pal-list" role="listbox">
        {list.length === 0 ? <div className="pal-empty">Nothing matches &quot;{q}&quot;</div> : null}
        {list.map((i, n) => (
          <div key={`${i.section}:${i.href}`}>
            {i.section !== list[n - 1]?.section ? <div className="pal-sec">{i.section}</div> : null}
            <a
              className={cn("pal-item", n === cur && "on")}
              role="option"
              aria-selected={n === cur}
              href={i.href}
              ref={n === cur ? (el) => el?.scrollIntoView({ block: "nearest" }) : undefined}
              onMouseEnter={() => setSel(n)}
              onClick={(e) => {
                e.preventDefault();
                go(i);
              }}
            >
              <NavIcon name={i.icon} />
              <span>{i.label}</span>
              <span className="meta">{i.meta}</span>
            </a>
          </div>
        ))}
      </div>
    </dialog>
  );
}

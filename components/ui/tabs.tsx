"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TabItem = { value: string; label: ReactNode; href?: string; count?: number };

type Props = {
  items: TabItem[];
  value: string;
  /** Client-side switching. Leave out and give each item an href for URL-driven tabs (works from server components). */
  onChange?: (value: string) => void;
  label?: string;
  className?: string;
};

function Items({ items, value, onChange }: Props) {
  return items.map((t) => {
    const on = t.value === value;
    const body = (
      <>
        {t.label}
        {t.count != null ? <span className="count"> {t.count}</span> : null}
      </>
    );
    return t.href ? (
      <Link key={t.value} href={t.href} className={cn(on && "on")} aria-current={on ? "page" : undefined}>
        {body}
      </Link>
    ) : (
      <button key={t.value} type="button" role="tab" aria-selected={on} className={cn(on && "on")} onClick={() => onChange?.(t.value)}>
        {body}
      </button>
    );
  });
}

/** Underline tabs. Counts show as a plain bold number, never a badge. */
export function Tabs(props: Props) {
  return (
    <div className={cn("tabs", props.className)} role="tablist" aria-label={props.label}>
      <Items {...props} />
    </div>
  );
}

/** Segmented control for small filters (e.g. 7 / 30 / 90 days). */
export function Seg(props: Props) {
  return (
    <div className={cn("seg", props.className)} role="group" aria-label={props.label}>
      <Items {...props} />
    </div>
  );
}

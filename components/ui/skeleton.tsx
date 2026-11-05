import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import s from "./skeleton.module.css";

// Server-safe loading placeholders for loading.tsx files. Reuses the global .page/.card/.stats classes
// so a skeleton sits exactly where the real content will.

type Size = number | string;

/** One shimmering block. Hidden from screen readers; wrap a page in <SkeletonPage> for the announcement. */
export function Skeleton({ w = "100%", h = 14, r, className }: { w?: Size; h?: Size; r?: Size; className?: string }) {
  return <span aria-hidden className={cn(s.sk, className)} style={{ width: w, height: h, borderRadius: r }} />;
}

/** Page wrapper: same spacing as .page, announces loading once. */
export function SkeletonPage({ children }: { children: ReactNode }) {
  return (
    <div className="page" role="status" aria-busy="true">
      <span className={s.srOnly}>Loading</span>
      {children}
    </div>
  );
}

/** Title on the left, `actions` button-sized blocks on the right. */
export function SkeletonPageHeader({ actions = 1, title = true }: { actions?: number; title?: boolean }) {
  return (
    <div className={s.head}>
      {title ? <Skeleton w={200} h={22} /> : <span />}
      {actions > 0 ? (
        <div className={s.actions}>
          {Array.from({ length: actions }, (_, i) => (
            <Skeleton key={i} w={i === 0 ? 110 : 90} h="var(--ctl-h)" />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Filter row: a segmented control and a search box. */
export function SkeletonToolbar({ n = 2 }: { n?: number }) {
  return (
    <div className={s.actions}>
      {Array.from({ length: n }, (_, i) => (
        <Skeleton key={i} w={i === 0 ? 220 : 160} h="var(--ctl-h)" />
      ))}
    </div>
  );
}

export function SkeletonStats({ n = 4 }: { n?: number }) {
  return (
    <div className="stats">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="stat">
          <Skeleton w="55%" h={12} />
          <Skeleton w="40%" h={24} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTabs({ n = 4 }: { n?: number }) {
  return (
    <div className={s.tabs}>
      {Array.from({ length: n }, (_, i) => (
        <Skeleton key={i} w={60 + ((i * 17) % 40)} h={14} />
      ))}
    </div>
  );
}

/** Table inside a card. Phones show the first two columns only. */
export function SkeletonTable({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  const style = { "--cols": Math.max(cols, 2) - 1 } as CSSProperties;
  const cells = (h: number, head: boolean) =>
    Array.from({ length: Math.max(cols, 2) }, (_, c) => <Skeleton key={c} w={c === 0 ? "70%" : head ? "50%" : "65%"} h={h} />);
  return (
    <div className={cn("card", s.table)}>
      <div className={cn(s.tRow, s.tHead)} style={style}>
        {cells(10, true)}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className={s.tRow} style={style}>
          {cells(14, false)}
        </div>
      ))}
    </div>
  );
}

/** One card with a title and a few text lines. */
export function SkeletonPanel({ lines = 4, avatar = false }: { lines?: number; avatar?: boolean }) {
  return (
    <div className={cn("card", s.card)}>
      <div className={s.cardHead}>
        {avatar ? <Skeleton w={36} h={36} r="50%" /> : null}
        <Skeleton w="45%" h={16} />
      </div>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} w={i === lines - 1 ? "60%" : "100%"} h={12} />
      ))}
    </div>
  );
}

/** Responsive grid of cards (one column on phones). */
export function SkeletonCards({ n = 6, lines = 3, avatar = false }: { n?: number; lines?: number; avatar?: boolean }) {
  return (
    <div className={s.cards}>
      {Array.from({ length: n }, (_, i) => (
        <SkeletonPanel key={i} lines={lines} avatar={avatar} />
      ))}
    </div>
  );
}

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Tone } from "./tone";

/** One stat tile. Put several inside <Stats>. */
export function StatCard({ label, value, sub, tone }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: Tone }) {
  return (
    <div className="stat">
      <span className="label">{label}</span>
      <span className={cn("value", tone && `t-${tone}`)}>{value}</span>
      {sub ? <span className="sub">{sub}</span> : null}
    </div>
  );
}

/** Responsive grid of StatCards (2 columns on phones). */
export function Stats({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("stats", className)}>{children}</div>;
}

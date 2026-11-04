import type { Tone } from "./tone";

export type PriorityLevel = "urgent" | "high" | "normal" | "low";

const PRI: Record<PriorityLevel, { label: string; tone: Tone }> = {
  urgent: { label: "Urgent", tone: "danger" },
  high: { label: "High", tone: "warn" },
  normal: { label: "Normal", tone: "muted" },
  low: { label: "Low", tone: "muted" },
};

/** Priority as coloured text. */
export function Priority({ level }: { level: PriorityLevel }) {
  const p = PRI[level];
  return <span className={`pri t-${p.tone}`}>{p.label}</span>;
}

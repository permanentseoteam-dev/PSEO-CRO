import { Avatar } from "@/components/ui";
import { PRESENCE } from "@/lib/modules/team/logic";
import type { Presence } from "@/lib/modules/team/types";

const DOT: Record<string, string> = {
  ok: "var(--ok)",
  violet: "var(--violet)",
  blue: "var(--blue)",
  warn: "var(--warn)",
  danger: "var(--danger)",
  muted: "var(--ink-3)",
};

/** Avatar with a small presence dot in the corner. */
export function AvatarDot({ name, size, presence }: { name: string; size: number; presence: Presence }) {
  const p = PRESENCE[presence] ?? PRESENCE.offline;
  return (
    <span className="relative inline-flex flex-none">
      <Avatar name={name} size={size} />
      <i
        className="absolute right-0 bottom-0 h-[11px] w-[11px] rounded-full border-2 border-surface"
        style={{ background: DOT[p.tone] }}
        title={p.label}
        aria-hidden="true"
      />
    </span>
  );
}

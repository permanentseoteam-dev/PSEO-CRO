// Soft project colours (same family as the task-type palette in 0213). Cards are tinted with them.
export const PROJECT_COLORS = ["#cfe3ff", "#ffd9e1", "#d4f0e7", "#e3d7ff", "#fff1c7", "#d8f3c9", "#ffe0cc", "#d6eef7"] as const;

export const DEFAULT_PROJECT_COLOR = PROJECT_COLORS[0];

/** Background for a card of this project; mixes with the surface so it works in light and dark mode. */
export function projectTint(color: string | null | undefined): string {
  return `color-mix(in srgb, ${color || DEFAULT_PROJECT_COLOR} 70%, var(--surface))`;
}

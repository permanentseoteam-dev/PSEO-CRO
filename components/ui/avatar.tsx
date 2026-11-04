import type { CSSProperties, ReactNode } from "react";

const HUES = [168, 200, 260, 20, 330, 45, 140, 290];

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/** Stable hue per name, so a person keeps the same colour everywhere. */
export function hue(name: string) {
  return HUES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % HUES.length];
}

/** Round initials avatar. */
export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <span className="avatar" style={{ "--s": `${size}px`, "--h": hue(name) } as CSSProperties} title={name}>
      {initials(name)}
    </span>
  );
}

/** Overlapping stack of avatars. */
export function Avatars({ children }: { children: ReactNode }) {
  return <span className="avatars">{children}</span>;
}

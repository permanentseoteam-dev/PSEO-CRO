"use client";

import { useEffect } from "react";

/**
 * Applies the portal design's theme and density to <html> while the portal is open, and puts the
 * previous values back on leaving. "system" and "comfortable" leave the user's own choice alone.
 */
export function PortalDocAttrs({ theme, density }: { theme: "system" | "light" | "dark"; density: "comfortable" | "compact" }) {
  useEffect(() => {
    const el = document.documentElement;
    const prev = { theme: el.dataset.theme, density: el.dataset.density };
    if (theme !== "system") el.dataset.theme = theme;
    if (density === "compact") el.dataset.density = "compact";
    return () => {
      if (prev.theme === undefined) delete el.dataset.theme;
      else el.dataset.theme = prev.theme;
      if (prev.density === undefined) delete el.dataset.density;
      else el.dataset.density = prev.density;
    };
  }, [theme, density]);
  return null;
}

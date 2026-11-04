import type { NextConfig } from "next";

// cacheComponents is off: every app page is per-user (cookies + RLS), so default dynamic rendering is simpler.
// The Tailwind loader runs on globals.css only: applying it to "*.css" with `as: "*.css"` turned
// every *.module.css into plain global CSS, so `styles.x` was undefined and `:global()` failed to parse.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "globals.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

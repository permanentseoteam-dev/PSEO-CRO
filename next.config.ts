import type { NextConfig } from "next";

// cacheComponents is off: every app page is per-user (cookies + RLS), so default dynamic rendering is simpler.
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

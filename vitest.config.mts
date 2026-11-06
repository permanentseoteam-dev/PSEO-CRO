import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // Tests run outside React's server/client split; use the no-op build Next itself uses on the server.
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
  test: { include: ["**/__tests__/**/*.test.ts"], exclude: ["node_modules/**", ".next/**"] },
});

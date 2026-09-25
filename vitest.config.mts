import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/lib/coach/**/*.ts"],
      // IndexedDB-bound glue and the Agent SDK runner are covered by e2e and the smoke test.
      exclude: ["src/lib/coach/server/**", "src/lib/coach/db.ts", "src/lib/coach/persist.ts"],
    },
  },
});

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/** Database tests: need a Postgres server, see tests/db/harness.ts. */
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      "server-only": fileURLToPath(
        new URL("./tests/stubs/empty.ts", import.meta.url),
      ),
    },
  },
  test: {
    include: ["tests/db/**/*.test.ts"],
    environment: "node",
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});

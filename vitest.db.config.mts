import { defineConfig } from "vitest/config";

/** Database tests: need a Postgres server, see tests/db/harness.ts. */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["tests/db/**/*.test.ts"],
    environment: "node",
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});

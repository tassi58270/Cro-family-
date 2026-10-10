import { execFileSync } from "node:child_process";
import path from "node:path";

/**
 * With E2E_RESET_DATABASE=on, the end-to-end tests start from an empty local
 * database built from the migrations (scripts/db.mjs refuses remote ones).
 */
export default function globalSetup() {
  if (process.env.E2E_RESET_DATABASE !== "on" || !process.env.DATABASE_URL)
    return;
  execFileSync(
    "node",
    [path.join(__dirname, "..", "..", "scripts", "db.mjs"), "reset"],
    {
      stdio: "inherit",
      env: process.env,
    },
  );
}

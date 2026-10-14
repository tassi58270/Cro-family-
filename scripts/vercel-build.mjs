// Build command on Vercel: on the production deployment, bring the database
// up to date first (the migrations are applied once each, see db.mjs), then
// build the site. A failing migration stops the deployment: the previous
// version stays online and nothing is half applied (one transaction each).
//
// MIGRATION_DATABASE_URL is Supabase's direct or session pooler address (port
// 5432): the transaction pooler of DATABASE_URL is not meant for schema changes.
import { spawnSync } from "node:child_process";
import pg from "pg";
import { isLocal, migrate } from "./db.mjs";

const url = process.env.MIGRATION_DATABASE_URL;

if (process.env.VERCEL_ENV === "production" && url) {
  const client = new pg.Client({
    connectionString: url,
    // Supabase signs its connections with its own authority, which Node does
    // not know: the connection is encrypted, its certificate is not checked.
    ssl: isLocal(url) ? false : { rejectUnauthorized: false },
    connectionTimeoutMillis: 20_000,
  });
  await client.connect();
  try {
    await migrate(client);
    console.log("database up to date");
  } finally {
    await client.end();
  }
} else {
  console.log(
    "migrations skipped (only on a production deployment with MIGRATION_DATABASE_URL)",
  );
}

const build = spawnSync("npm", ["run", "build"], { stdio: "inherit" });
process.exit(build.status ?? 1);

// Applies the SQL migrations of supabase/migrations, in order, once each.
//
//   node scripts/db.mjs migrate          apply what is missing (DATABASE_URL)
//   node scripts/db.mjs migrate --local  same, after emulating Supabase locally
//   node scripts/db.mjs reset            local only: wipe and rebuild everything
//
// Applied versions are recorded in supabase_migrations.schema_migrations, the
// table the Supabase CLI uses, so both tools can be mixed later.

import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = path.join(root, "supabase", "migrations");
const bootstrapFile = path.join(root, "supabase", "local", "bootstrap.sql");

export async function listMigrations() {
  const files = (await readdir(migrationsDir)).filter((f) =>
    f.endsWith(".sql"),
  );
  return files.sort().map((file) => {
    const [version, ...rest] = file.replace(/\.sql$/, "").split("_");
    return {
      version,
      name: rest.join("_"),
      file: path.join(migrationsDir, file),
    };
  });
}

export async function bootstrap(client) {
  await client.query(await readFile(bootstrapFile, "utf8"));
}

export async function migrate(client, { log = console.log } = {}) {
  await client.query(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (
      version text primary key,
      statements text[],
      name text
    );
  `);
  const { rows } = await client.query(
    "select version from supabase_migrations.schema_migrations",
  );
  const applied = new Set(rows.map((r) => r.version));

  for (const migration of await listMigrations()) {
    if (applied.has(migration.version)) continue;
    const sql = await readFile(migration.file, "utf8");
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query(
        "insert into supabase_migrations.schema_migrations (version, name, statements) values ($1, $2, $3)",
        [migration.version, migration.name, [sql]],
      );
      await client.query("commit");
      log(`applied ${migration.version} ${migration.name}`);
    } catch (error) {
      await client.query("rollback");
      throw new Error(`${path.basename(migration.file)}: ${error.message}`);
    }
  }
}

function isLocal(url) {
  const { hostname } = new URL(url);
  return ["localhost", "127.0.0.1", "::1"].includes(hostname);
}

async function main() {
  const [command, ...flags] = process.argv.slice(2);
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see .env.example).");

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    if (command === "reset") {
      if (!isLocal(url))
        throw new Error("reset only runs on a local database.");
      await client.query(`
        drop schema if exists public, app, private, auth, extensions, supabase_migrations cascade;
        create schema public;
      `);
      await bootstrap(client);
      await migrate(client);
    } else if (command === "migrate") {
      if (flags.includes("--local")) await bootstrap(client);
      await migrate(client);
    } else {
      throw new Error("usage: node scripts/db.mjs migrate [--local] | reset");
    }
  } finally {
    await client.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}

import pg from "pg";
import { bootstrap, migrate } from "../../scripts/db.mjs";

/**
 * Database tests run against a real Postgres (TEST_DATABASE_URL, a local
 * server by default). Each test file gets its own fresh database, built from
 * the migrations exactly as in production, plus the local Supabase emulation.
 */
// Dates stay as written ("1980-06-15"), never shifted by the time zone.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);

const serverUrl =
  process.env.TEST_DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5432/postgres";

export type Viewer = { role: "anon" } | { role: "authenticated"; id: string };

export const visitor: Viewer = { role: "anon" };
export const account = (id: string): Viewer => ({ role: "authenticated", id });

export async function createTestDatabase() {
  const name = `croy_test_${process.pid}_${Date.now()}`;
  const admin = new pg.Client({ connectionString: serverUrl });
  await admin.connect();
  await admin.query(`create database ${name}`);
  await admin.end();

  const url = new URL(serverUrl);
  url.pathname = `/${name}`;
  const db = new pg.Client({ connectionString: url.toString() });
  await db.connect();
  await bootstrap(db);
  await migrate(db, { log: () => {} });

  return {
    db,
    async drop() {
      await db.end();
      const cleaner = new pg.Client({ connectionString: serverUrl });
      await cleaner.connect();
      await cleaner.query(`drop database if exists ${name} with (force)`);
      await cleaner.end();
    },
  };
}

/**
 * Runs `fn` in a transaction as `viewer`, exactly as the site's server does
 * for a request, then rolls everything back.
 */
export async function as<T>(
  db: pg.Client,
  viewer: Viewer,
  fn: (
    q: <R extends pg.QueryResultRow = pg.QueryResultRow>(
      sql: string,
      params?: unknown[],
    ) => Promise<R[]>,
  ) => Promise<T>,
): Promise<T> {
  await db.query("begin");
  try {
    await db.query(`set local role ${viewer.role}`);
    const claims =
      viewer.role === "anon"
        ? { role: "anon" }
        : { sub: viewer.id, role: "authenticated" };
    await db.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify(claims),
    ]);
    return await fn(async (sql, params) => (await db.query(sql, params)).rows);
  } finally {
    await db.query("rollback");
  }
}

/** The error Postgres raises, or null if the statement went through. */
export async function errorOf(
  db: pg.Client,
  viewer: Viewer,
  sql: string,
  params?: unknown[],
): Promise<string | null> {
  try {
    await as(db, viewer, (q) => q(sql, params));
    return null;
  } catch (error) {
    return (error as Error).message;
  }
}

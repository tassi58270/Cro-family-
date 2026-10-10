import "server-only";
import pg from "pg";

/**
 * Access to Postgres. Every query runs inside a transaction under the role
 * of whoever is asking (visitor or signed-in account), so that the access
 * rules of the database apply to the site exactly as they are tested in
 * tests/db. The server never reads content with a privileged role.
 */

// Dates stay as written ("1415-10-25"): no time zone shift.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);
// Counts come back as numbers rather than strings.
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => Number(value));

export type Viewer = { kind: "visitor" } | { kind: "account"; id: string };

export const VISITOR: Viewer = { kind: "visitor" };

const globalForPool = globalThis as unknown as { croyPool?: pg.Pool };

/** False until DATABASE_URL is set: the site then shows its empty states. */
export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function pool(): pg.Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set (see .env.example).");
  }
  globalForPool.croyPool ??= new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
    idleTimeoutMillis: 10_000,
  });
  return globalForPool.croyPool;
}

export type Query = <R extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  params?: unknown[],
) => Promise<R[]>;

/** Runs `fn` in one transaction, as `viewer`. */
export async function withViewer<T>(
  viewer: Viewer,
  fn: (query: Query) => Promise<T>,
): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("begin");
    if (viewer.kind === "visitor") {
      await client.query("set local role anon");
      await client.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ role: "anon" }),
      ]);
    } else {
      await client.query("set local role authenticated");
      await client.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ role: "authenticated", sub: viewer.id }),
      ]);
    }
    const result = await fn(async (sql, params) => {
      const { rows } = await client.query(sql, params);
      return rows;
    });
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

/**
 * For the few server tasks that act outside any visitor, like recording a
 * sign-in: runs with the connection's own role. Never use it to read content
 * shown on a page.
 */
export async function withSystem<T>(
  fn: (query: Query) => Promise<T>,
): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("begin");
    const result = await fn(async (sql, params) => {
      const { rows } = await client.query(sql, params);
      return rows;
    });
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

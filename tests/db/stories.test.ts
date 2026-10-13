import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { account, as, createTestDatabase, errorOf, visitor } from "./harness";

/**
 * Step 8 is done when a story appears by itself on the sheet of each person
 * it cites. A member's story goes from draft to validation; only an
 * administrator publishes it, and only then do visitors see it.
 */

const admin = "a0000000-0000-4000-8000-0000000000a1";
const member = "a0000000-0000-4000-8000-0000000000b1";
const other = "a0000000-0000-4000-8000-0000000000c1";
const story = "d0000000-0000-4000-8000-000000000001";
const ancestor = "e0000000-0000-4000-8000-000000000001";
const living = "e0000000-0000-4000-8000-000000000002";

let db: pg.Client;
let drop: () => Promise<void>;

beforeAll(async () => {
  ({ db, drop } = await createTestDatabase());
  await db.query(`
    insert into private.accounts (id, email) values
      ('${admin}', 'admin@example.org'), ('${member}', 'm@example.org'), ('${other}', 'o@example.org');
    insert into public.profiles (id, role) values
      ('${admin}', 'admin'), ('${member}', 'member'), ('${other}', 'member');
    insert into public.people (id, slug, given_names, birth_date, birth_precision, death_date, death_precision, status) values
      ('${ancestor}', 'ancetre', 'Ancêtre', '1800-01-01', 'year', '1870-01-01', 'year', 'published'),
      ('${living}', 'vivant', 'Vivant', '1990-01-01', 'year', null, null, 'published');
  `);
});

afterAll(async () => {
  await drop?.();
});

async function persist(viewer: Parameters<typeof as>[1], sql: string) {
  await db.query("begin");
  await db.query(`set local role ${viewer.role}`);
  await db.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify(
      viewer.role === "anon"
        ? { role: "anon" }
        : { sub: viewer.id, role: "authenticated" },
    ),
  ]);
  try {
    await db.query(sql);
    await db.query("commit");
  } catch (error) {
    await db.query("rollback");
    throw error;
  }
}

const visibleTo = (viewer: Parameters<typeof as>[1]) =>
  as(db, viewer, (q) =>
    q<{ story_id: string }>(
      `select sp.story_id from public.story_people sp where sp.person_id = '${ancestor}'`,
    ),
  );

describe("a member's story", () => {
  it("starts as a draft that only its author sees", async () => {
    await persist(
      account(member),
      `insert into public.stories (id, slug, author_id, status) values ('${story}', 'le-jardin', '${member}', 'draft');
       insert into public.stories_i18n (story_id, locale, title, body) values ('${story}', 'fr', 'Le jardin', 'Texte.');
       insert into public.story_people (story_id, person_id) values ('${story}', '${ancestor}');`,
    );
    expect(await visibleTo(account(member))).toHaveLength(1);
    expect(await visibleTo(account(other))).toHaveLength(0);
    expect(await visibleTo(visitor)).toHaveLength(0);
  });

  it("is sent for validation, still unpublished", async () => {
    await persist(
      account(member),
      `update public.stories set status = 'pending' where id = '${story}'`,
    );
    expect(await visibleTo(visitor)).toHaveLength(0);
  });

  it("cannot be published by its author", async () => {
    const error = await errorOf(
      db,
      account(member),
      `update public.stories set status = 'published' where id = '${story}'`,
    );
    expect(error).toMatch(/row-level security/);
  });

  it("once published by an administrator, appears with each person it cites", async () => {
    await persist(
      account(admin),
      `update public.stories set status = 'published', published_at = now() where id = '${story}'`,
    );
    expect(await visibleTo(visitor)).toEqual([{ story_id: story }]);
  });

  it("is no longer the author's to change once published", async () => {
    const rows = await as(db, account(member), (q) =>
      q(
        `update public.stories_i18n set title = 'Autre' where story_id = '${story}' returning 1`,
      ),
    );
    expect(rows).toHaveLength(0);
  });

  it("disappears for visitors when it also cites a living person", async () => {
    await persist(
      account(admin),
      `insert into public.story_people (story_id, person_id) values ('${story}', '${living}')`,
    );
    expect(await visibleTo(visitor)).toHaveLength(0);
    expect(await visibleTo(account(other))).toHaveLength(1);
  });
});

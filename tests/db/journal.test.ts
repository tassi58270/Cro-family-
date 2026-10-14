import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { account, createTestDatabase, errorOf, visitor } from "./harness";

/**
 * Step 11: every change is journaled and can be undone (section 7), by an
 * administrator only, as a whole, and never over a later change.
 */

const admin = "a0000000-0000-4000-8000-0000000000a1";
const member = "a0000000-0000-4000-8000-0000000000b1";
const person = "e0000000-0000-4000-8000-000000000001";
const place = "f0000000-0000-4000-8000-000000000001";

let db: pg.Client;
let drop: () => Promise<void>;

beforeAll(async () => {
  ({ db, drop } = await createTestDatabase());
  await db.query(`
    insert into private.accounts (id, email) values
      ('${admin}', 'admin@example.org'), ('${member}', 'm@example.org');
    insert into public.profiles (id, role) values ('${admin}', 'admin'), ('${member}', 'member');
  `);
});

afterAll(async () => {
  await drop?.();
});

/** One committed transaction as the administrator: one change. */
async function asAdmin(sql: string) {
  await db.query("begin");
  await db.query("set local role authenticated");
  await db.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: admin, role: "authenticated" }),
  ]);
  try {
    const result = await db.query(sql);
    await db.query("commit");
    return result.rows;
  } catch (error) {
    await db.query("rollback");
    throw error;
  }
}

async function lastChange() {
  const { rows } = await db.query<{ at: string }>(
    "select at::text from public.audit_log where undoes is null order by id desc limit 1",
  );
  return rows[0].at;
}

const undo = (at: string) =>
  asAdmin(`select public.undo_change('${at}', '${admin}') as n`);

const name = async () =>
  (
    await db.query(
      `select given_names from public.people where id = '${person}'`,
    )
  ).rows[0]?.given_names;

describe("the journal", () => {
  it("records a whole change and undoes it as a whole", async () => {
    await asAdmin(`
      insert into public.people (id, slug, given_names, status) values ('${person}', 'albert', 'Albert', 'published');
      insert into public.people_i18n (person_id, locale, biography) values ('${person}', 'fr', 'Texte');
    `);
    const created = await lastChange();
    await asAdmin(
      `update public.people set given_names = 'Albrecht' where id = '${person}'`,
    );
    const renamed = await lastChange();
    expect(await name()).toBe("Albrecht");

    await undo(renamed);
    expect(await name()).toBe("Albert");

    // Undoing the rename does not block undoing the creation.
    await undo(created);
    expect(await name()).toBeUndefined();
    const { rows } = await db.query(
      `select count(*)::int as n from public.people_i18n where person_id = '${person}'`,
    );
    expect(rows[0].n).toBe(0);
  });

  it("brings back what a deletion took with it", async () => {
    await asAdmin(`
      insert into public.people (id, slug, given_names, status) values ('${person}', 'albert-2', 'Albert', 'published');
      insert into public.people_i18n (person_id, locale, biography) values ('${person}', 'fr', 'Texte');
    `);
    await asAdmin(`delete from public.people where id = '${person}'`);
    const deleted = await lastChange();
    expect(await name()).toBeUndefined();

    await undo(deleted);
    expect(await name()).toBe("Albert");
    const { rows } = await db.query(
      `select biography from public.people_i18n where person_id = '${person}'`,
    );
    expect(rows).toEqual([{ biography: "Texte" }]);
  });

  it("refuses to undo over a later change", async () => {
    await asAdmin(
      `insert into public.places (id, slug, status) values ('${place}', 'lieu', 'published')`,
    );
    const created = await lastChange();
    await asAdmin(
      `update public.places set visitable = true where id = '${place}'`,
    );
    await expect(undo(created)).rejects.toThrow(/changed since/);
  });

  it("is for administrators only", async () => {
    const at = await lastChange();
    expect(
      await errorOf(
        db,
        account(member),
        `select public.undo_change('${at}', '${admin}')`,
      ),
    ).toMatch(/administrators only/);
    expect(
      await errorOf(
        db,
        visitor,
        `select public.undo_change('${at}', '${admin}')`,
      ),
    ).toMatch(/permission denied/);
  });
});

describe("merging duplicates", () => {
  const keep = "e0000000-0000-4000-8000-0000000000a1";
  const duplicate = "e0000000-0000-4000-8000-0000000000a2";
  const child = "e0000000-0000-4000-8000-0000000000a3";
  const story = "d0000000-0000-4000-8000-0000000000a1";

  it("moves every link to the person kept, and the journal can undo it", async () => {
    await asAdmin(`
      insert into public.people (id, slug, given_names, surname, status) values
        ('${keep}', 'jean', 'Jean', 'Exemple', 'published'),
        ('${duplicate}', 'jean-2', 'Jean', 'Exemple', 'published'),
        ('${child}', 'paul', 'Paul', 'Exemple', 'published');
      update public.people set birth_date = '1850-01-01', birth_precision = 'year' where id = '${duplicate}';
      insert into public.people_i18n (person_id, locale, biography) values ('${duplicate}', 'fr', 'Bio du doublon');
      insert into public.parent_child (parent_id, child_id) values ('${duplicate}', '${child}');
      insert into public.stories (id, slug, status) values ('${story}', 'recit', 'published');
      insert into public.story_people (story_id, person_id) values ('${story}', '${keep}'), ('${story}', '${duplicate}');
    `);
    expect(
      await errorOf(
        db,
        account(member),
        `select public.merge_people('${keep}', '${duplicate}')`,
      ),
    ).toMatch(/administrators only/);

    await asAdmin(`select public.merge_people('${keep}', '${duplicate}')`);
    const merged = await lastChange();
    const { rows: people } = await db.query(
      `select id, birth_date from public.people where id in ('${keep}', '${duplicate}')`,
    );
    expect(people).toEqual([{ id: keep, birth_date: "1850-01-01" }]);
    const { rows: links } = await db.query(`
      select (select count(*)::int from public.parent_child where parent_id = '${keep}' and child_id = '${child}') as children,
             (select count(*)::int from public.story_people where story_id = '${story}') as stories,
             (select biography from public.people_i18n where person_id = '${keep}' and locale = 'fr') as biography`);
    expect(links[0]).toEqual({
      children: 1,
      stories: 1,
      biography: "Bio du doublon",
    });

    await undo(merged);
    const { rows: back } = await db.query(`
      select (select count(*)::int from public.people where id = '${duplicate}') as duplicate,
             (select birth_date from public.people where id = '${keep}') as birth,
             (select count(*)::int from public.parent_child where parent_id = '${duplicate}') as children,
             (select count(*)::int from public.story_people where story_id = '${story}') as stories`);
    expect(back[0]).toEqual({
      duplicate: 1,
      birth: null,
      children: 1,
      stories: 2,
    });
  });
});

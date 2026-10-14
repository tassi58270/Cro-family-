import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildSearchIndex } from "@/lib/data/search";
import { account, as, createTestDatabase, visitor } from "./harness";

/**
 * Step 12: the global search never shows the public a living person, not
 * even as the bearer of a title (rule 2, applied by the database).
 */

const member = "a0000000-0000-4000-8000-0000000000b1";
const ancestor = "e0000000-0000-4000-8000-000000000001";
const living = "e0000000-0000-4000-8000-000000000002";
const title = "c0000000-0000-4000-8000-000000000001";

let db: pg.Client;
let drop: () => Promise<void>;

beforeAll(async () => {
  ({ db, drop } = await createTestDatabase());
  await db.query(`
    insert into private.accounts (id, email) values ('${member}', 'm@example.org');
    insert into public.profiles (id, role) values ('${member}', 'member');
    insert into public.people (id, slug, given_names, surname, birth_date, birth_precision, deceased, status) values
      ('${ancestor}', 'aieule-essai', 'Aïeule', 'Essai', '1800-01-01', 'year', true, 'published'),
      ('${living}', 'cousin-vivant', 'Cousin', 'Vivant', '1990-01-01', 'year', false, 'published');
    insert into public.titles (id, slug, status) values ('${title}', 'dame-essai', 'published');
    insert into public.titles_i18n (title_id, locale, name) values ('${title}', 'fr', 'Dame d’Essai');
    insert into public.people_titles (person_id, title_id, rank, status) values
      ('${ancestor}', '${title}', 1, 'published'), ('${living}', '${title}', 2, 'published');
  `);
});

afterAll(async () => {
  await drop?.();
});

describe("search index", () => {
  it("has no living person for the public, not even as a title bearer", async () => {
    const index = await as(db, visitor, (q) => buildSearchIndex(q, "fr"));
    const text = JSON.stringify(index);
    expect(index.find((e) => e.kind === "person")?.name).toBe("Aïeule Essai");
    expect(text).not.toContain("Vivant");
    expect(text).not.toContain("cousin-vivant");
    const dame = index.find((e) => e.kind === "title");
    expect(dame).toMatchObject({ name: "Dame d’Essai", via: "person" });
    expect(dame?.slug).toBe("aieule-essai");
  });

  it("gives members their living relatives", async () => {
    const index = await as(db, account(member), (q) =>
      buildSearchIndex(q, "fr"),
    );
    expect(index.map((e) => e.name)).toContain("Cousin Vivant");
  });
});

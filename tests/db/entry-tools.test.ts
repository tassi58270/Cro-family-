import { readFileSync } from "node:fs";
import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Query } from "@/lib/db";
import { demoPeople } from "@/lib/demo/dataset";
import { demoLoaded, loadDemo, removeDemo } from "@/lib/demo/load";
import { decodeGedcom, parseGedcom } from "@/lib/genealogie/gedcom";
import { importGedcom, previewImport } from "@/lib/genealogie/import";
import { isLiving } from "@/lib/genealogie/living";
import { account, as, createTestDatabase, visitor } from "./harness";

/**
 * Step 4: the demonstration family loads and leaves cleanly, and a GEDCOM
 * file goes into the tree. Both run as an administrator, through the access
 * rules, exactly as from the dashboard.
 */

const admin = "a0000000-0000-4000-8000-0000000000aa";
let db: pg.Client;
let drop: () => Promise<void>;

beforeAll(async () => {
  ({ db, drop } = await createTestDatabase());
  await db.query(`
    insert into private.accounts (id, email) values ('${admin}', 'admin@example.org');
    insert into public.profiles (id, role) values ('${admin}', 'admin');
  `);
});

afterAll(async () => {
  await drop?.();
});

/** Runs as the administrator and keeps the changes. */
async function asAdmin<T>(fn: (q: Query) => Promise<T>): Promise<T> {
  await db.query("begin");
  try {
    await db.query("set local role authenticated");
    await db.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: admin, role: "authenticated" }),
    ]);
    const result = await fn(
      async (sql, params) => (await db.query(sql, params)).rows,
    );
    await db.query("commit");
    return result;
  } catch (error) {
    await db.query("rollback");
    throw error;
  }
}

describe("the demonstration family", () => {
  const livingInDataset = demoPeople.filter((p) =>
    isLiving({
      deceased: Boolean(p.death),
      birth_date: p.birth?.date ?? null,
      birth_precision: p.birth?.precision ?? null,
      death_date: p.death?.date ?? null,
    }),
  ).length;

  it("loads once, everything flagged as demonstration", async () => {
    await asAdmin((q) => loadDemo(q, admin));
    await asAdmin((q) => loadDemo(q, admin));
    const { rows } = await db.query(
      `select count(*)::int as people, count(*) filter (where not is_demo)::int as real
       from public.people`,
    );
    expect(rows[0]).toEqual({ people: demoPeople.length, real: 0 });
    expect(await asAdmin(demoLoaded)).toBe(true);
  });

  it("has living people, whom visitors only see as « Personne vivante »", async () => {
    expect(livingInDataset).toBeGreaterThanOrEqual(3);
    const people = await as(db, visitor, (q) =>
      q("select id from public.people"),
    );
    expect(people).toHaveLength(demoPeople.length - livingInDataset);
    const tree = await as(db, visitor, (q) =>
      q<{ hidden: boolean; given_names: string | null }>(
        "select hidden, given_names from public.tree_people()",
      ),
    );
    expect(tree.filter((p) => p.hidden)).toHaveLength(livingInDataset);
    expect(
      tree.filter((p) => p.hidden).every((p) => p.given_names === null),
    ).toBe(true);
  });

  it("shows its photos to visitors, except the one with living people", async () => {
    const visible = await as(db, visitor, (q) =>
      q<{ storage_path: string }>(
        "select storage_path from public.media order by 1",
      ),
    );
    expect(visible.map((m) => m.storage_path)).not.toContain(
      "photos/exemple/reunion.jpg",
    );
    expect(visible).toHaveLength(5);
    const faces = await as(db, visitor, (q) =>
      q<{ box: number[] | null }>("select box from public.media_people"),
    );
    expect(faces.length).toBeGreaterThanOrEqual(5);
    expect(faces.every((f) => f.box === null || f.box.length === 4)).toBe(true);
  });

  it("keeps the story that names living people for members", async () => {
    const titles = await as(db, visitor, (q) =>
      q<{ slug: string }>(
        "select slug from public.stories where not anecdote order by slug",
      ),
    );
    expect(titles.map((t) => t.slug)).toEqual([
      "exemple-mariage",
      "exemple-verger",
    ]);
  });

  it("goes away in one click, leaving the family's own data", async () => {
    await asAdmin((q) =>
      q(
        `insert into public.people (slug, given_names, status) values ('vraie-personne', 'Vraie', 'published')`,
      ),
    );
    await asAdmin(removeDemo);

    const { rows } = await db.query(`
      select
        (select count(*) from public.people where is_demo)::int
        + (select count(*) from public.places where is_demo)::int
        + (select count(*) from public.branches where is_demo)::int
        + (select count(*) from public.titles where is_demo)::int
        + (select count(*) from public.events where is_demo)::int
        + (select count(*) from public.stories where is_demo)::int
        + (select count(*) from public.sources where is_demo)::int
        + (select count(*) from public.unions where is_demo)::int
        + (select count(*) from public.parent_child where is_demo)::int
        + (select count(*) from public.home_chapters where is_demo)::int
        + (select count(*) from public.home_figures where is_demo)::int
        + (select count(*) from public.arms where is_demo)::int
        + (select count(*) from public.tree_entry_points where is_demo)::int
        + (select count(*) from public.lineages where is_demo)::int
        + (select count(*) from public.home_i18n where summary is not null)::int as demo,
        (select count(*) from public.people)::int as people
    `);
    expect(rows[0]).toEqual({ demo: 0, people: 1 });
  });

  it("leaves every change in the journal, with its author", async () => {
    const { rows } = await db.query(
      `select count(*)::int as n, bool_and(actor_id = $1) as by_admin
       from public.audit_log where table_name = 'people'`,
      [admin],
    );
    expect(rows[0].n).toBeGreaterThan(demoPeople.length * 2);
    expect(rows[0].by_admin).toBe(true);
  });

  it("loads even when the family already has someone of the same name", async () => {
    await asAdmin((q) =>
      q(
        `insert into public.people (slug, given_names, surname, status)
         values ('albert-exemple-1850', 'Albert', 'Exemple', 'published')`,
      ),
    );
    await asAdmin((q) => loadDemo(q, admin));
    const { rows } = await db.query(
      "select slug, is_demo from public.people where slug like 'albert-exemple-1850%' order by slug",
    );
    expect(rows).toEqual([
      { slug: "albert-exemple-1850", is_demo: false },
      { slug: "albert-exemple-1850-2", is_demo: true },
    ]);
    await asAdmin(removeDemo);
    await asAdmin((q) =>
      q("delete from public.people where slug = 'albert-exemple-1850'"),
    );
  });

  it("opens the tree on its entry point and demonstrates its lineage with proofs", async () => {
    await asAdmin((q) => loadDemo(q, admin));
    const rows = await as(db, visitor, (q) =>
      q<{ entries: number; lineages: number; proofs: number }>(`
        select
          (select count(*)::int from public.tree_entry_points) as entries,
          (select count(*)::int from public.lineages) as lineages,
          (select count(*)::int from public.filiation_sources) as proofs
      `),
    );
    // The proofs about living people stay hidden from visitors.
    expect(rows[0]).toEqual({ entries: 2, lineages: 1, proofs: 4 });
    await asAdmin(removeDemo);
  });
});

describe("GEDCOM import", () => {
  const data = parseGedcom(
    decodeGedcom(
      readFileSync(new URL("../fixtures/exemple.ged", import.meta.url)),
    ),
  );

  it("previews without writing anything", async () => {
    const before = (
      await db.query("select count(*)::int as n from public.people")
    ).rows[0].n;
    const preview = await asAdmin((q) => previewImport(q, data));
    expect(preview).toMatchObject({
      people: 4,
      families: 1,
      places: 2,
      duplicates: [],
    });
    expect(preview.undatedDates).toHaveLength(1);
    const after = (
      await db.query("select count(*)::int as n from public.people")
    ).rows[0].n;
    expect(after).toBe(before);
  });

  it("creates people, the marriage and the parent links", async () => {
    const result = await asAdmin((q) =>
      importGedcom(q, data, {
        published: true,
        reuseExisting: true,
        actor: admin,
      }),
    );
    expect(result).toEqual({ people: 4, unions: 1, links: 4, reused: 0 });

    const { rows } = await db.query(`
      select p.given_names, p.surname, p.birth_date, p.birth_precision, p.deceased, pl.name as place
      from public.people p
      left join public.places_i18n pl on pl.place_id = p.birth_place_id
      where p.surname = 'Exemple' order by p.given_names`);
    expect(rows[0]).toMatchObject({
      given_names: "Albert",
      birth_date: "1850-04-02",
      birth_precision: "day",
      deceased: true,
      place: "Exempleville",
    });
    const union = await db.query(
      "select marriage_date, marriage_precision from public.unions",
    );
    expect(union.rows).toEqual([
      { marriage_date: "1878-06-10", marriage_precision: "day" },
    ]);
  });

  it("does not duplicate people imported twice", async () => {
    const result = await asAdmin((q) =>
      importGedcom(q, data, {
        published: true,
        reuseExisting: true,
        actor: admin,
      }),
    );
    expect(result).toEqual({ people: 0, unions: 0, links: 0, reused: 4 });
  });

  it("is refused to anyone who is not an administrator", async () => {
    const member = "a0000000-0000-4000-8000-0000000000bb";
    await db.query(`
      insert into private.accounts (id, email) values ('${member}', 'membre@example.org');
      insert into public.profiles (id, role) values ('${member}', 'member');
    `);
    await expect(
      as(db, account(member), (q) =>
        importGedcom(q, data, {
          published: true,
          reuseExisting: false,
          actor: member,
        }),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { account, as, createTestDatabase, errorOf, visitor } from "./harness";

/**
 * Step 3 is done when tests prove that a visitor cannot read any data of a
 * living person (cahier des charges, section 8). The rule is enforced by the
 * database itself, so these tests talk to Postgres directly, as each role.
 */

const ids = {
  admin: "a0000000-0000-4000-8000-000000000001",
  member: "a0000000-0000-4000-8000-000000000002",
  otherMember: "a0000000-0000-4000-8000-000000000003",
  disabled: "a0000000-0000-4000-8000-000000000004",
  noProfile: "a0000000-0000-4000-8000-000000000005",

  dead: "b0000000-0000-4000-8000-000000000001",
  bornLongAgo: "b0000000-0000-4000-8000-000000000002",
  markedDeceased: "b0000000-0000-4000-8000-000000000003",
  justOver100: "b0000000-0000-4000-8000-000000000004",
  pendingDead: "b0000000-0000-4000-8000-000000000005",

  livingNoDates: "c0000000-0000-4000-8000-000000000001",
  livingYoung: "c0000000-0000-4000-8000-000000000002",
  livingAbout: "c0000000-0000-4000-8000-000000000003",
  livingAfter: "c0000000-0000-4000-8000-000000000004",
  justUnder100: "c0000000-0000-4000-8000-000000000005",
};

const living = [
  ids.livingNoDates,
  ids.livingYoung,
  ids.livingAbout,
  ids.livingAfter,
  ids.justUnder100,
];

/** Strings that only exist on rows about living people. */
const secrets = ["Vivante", "SECRET", "vivante-", ...living, "1980-06-15"];

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

const today = new Date();
const hundredYearsAgo = new Date(
  Date.UTC(
    today.getUTCFullYear() - 100,
    today.getUTCMonth(),
    today.getUTCDate(),
  ),
);
const dayBefore = new Date(hundredYearsAgo.getTime() - 2 * 86_400_000);
const dayAfter = new Date(hundredYearsAgo.getTime() + 2 * 86_400_000);

const fixtures = `
  insert into private.accounts (id, email) values
    ('${ids.admin}', 'admin@example.org'),
    ('${ids.member}', 'member@example.org'),
    ('${ids.otherMember}', 'other@example.org'),
    ('${ids.disabled}', 'disabled@example.org'),
    ('${ids.noProfile}', 'nobody@example.org');
  insert into public.profiles (id, display_name, role, disabled_at) values
    ('${ids.admin}', 'Admin', 'admin', null),
    ('${ids.member}', 'Membre', 'member', null),
    ('${ids.otherMember}', 'Autre', 'member', null),
    ('${ids.disabled}', 'Ancien', 'member', now());

  insert into public.places (id, slug, status) values
    ('d0000000-0000-4000-8000-000000000001', 'lieu-public', 'published');
  insert into public.places_i18n (place_id, locale, name) values
    ('d0000000-0000-4000-8000-000000000001', 'fr', 'Lieu public');

  insert into public.titles (id, slug, status) values
    ('d0000000-0000-4000-8000-000000000002', 'titre', 'published');

  insert into public.people
    (id, slug, given_names, surname, birth_date, birth_precision,
     death_date, death_precision, deceased, status) values
    ('${ids.dead}', 'mort', 'Jean', 'Ancien', '1360-01-01', 'about', '1415-10-25', 'day', false, 'published'),
    ('${ids.bornLongAgo}', 'ne-en-1900', 'Paul', 'Ancien', '1900-05-01', 'day', null, null, false, 'published'),
    ('${ids.markedDeceased}', 'decede', 'Marie', 'Ancien', null, null, null, null, true, 'published'),
    ('${ids.justOver100}', 'cent-ans-passes', 'Louis', 'Ancien', '${isoDate(dayBefore)}', 'day', null, null, false, 'published'),
    ('${ids.pendingDead}', 'en-attente', 'Anne', 'Ancien', null, null, '1700-01-01', 'year', false, 'pending'),
    ('${ids.livingNoDates}', 'vivante-sans-date', 'Claire', 'Vivante', null, null, null, null, false, 'published'),
    ('${ids.livingYoung}', 'vivante-jeune', 'Sophie', 'Vivante', '1980-06-15', 'day', null, null, false, 'published'),
    ('${ids.livingAbout}', 'vivante-vers', 'Hélène', 'Vivante', '1922-01-01', 'about', null, null, false, 'published'),
    ('${ids.livingAfter}', 'vivante-apres', 'Agnès', 'Vivante', '1900-01-01', 'after', null, null, false, 'published'),
    ('${ids.justUnder100}', 'vivante-presque-cent', 'Rose', 'Vivante', '${isoDate(dayAfter)}', 'day', null, null, false, 'published');

  insert into public.people_i18n (person_id, locale, biography) values
    ('${ids.dead}', 'fr', 'Biographie publique.'),
    ('${ids.livingYoung}', 'fr', 'SECRET biographie.');

  insert into public.unions (id, partner_a, partner_b, marriage_date, marriage_precision, status) values
    ('e0000000-0000-4000-8000-000000000001', '${ids.dead}', '${ids.markedDeceased}', '1390-01-01', 'year', 'published'),
    ('e0000000-0000-4000-8000-000000000002', '${ids.bornLongAgo}', '${ids.livingYoung}', '2001-09-08', 'day', 'published');

  insert into public.parent_child (parent_id, child_id, status) values
    ('${ids.dead}', '${ids.bornLongAgo}', 'published'),
    ('${ids.bornLongAgo}', '${ids.livingYoung}', 'published');

  insert into public.people_titles (person_id, title_id, status) values
    ('${ids.dead}', 'd0000000-0000-4000-8000-000000000002', 'published'),
    ('${ids.livingYoung}', 'd0000000-0000-4000-8000-000000000002', 'published');

  insert into public.place_people (place_id, person_id) values
    ('d0000000-0000-4000-8000-000000000001', '${ids.dead}'),
    ('d0000000-0000-4000-8000-000000000001', '${ids.livingYoung}');

  insert into public.media (id, storage_path, mime_type, status, uploaded_by) values
    ('f0000000-0000-4000-8000-000000000001', 'photos/publique.jpg', 'image/jpeg', 'published', null),
    ('f0000000-0000-4000-8000-000000000002', 'photos/vivante-mariage.jpg', 'image/jpeg', 'published', null),
    ('f0000000-0000-4000-8000-000000000003', 'photos/en-attente.jpg', 'image/jpeg', 'pending', '${ids.member}');
  insert into public.media_i18n (media_id, locale, caption) values
    ('f0000000-0000-4000-8000-000000000002', 'fr', 'SECRET mariage');
  insert into public.media_people (media_id, person_id) values
    ('f0000000-0000-4000-8000-000000000001', '${ids.dead}'),
    ('f0000000-0000-4000-8000-000000000002', '${ids.livingYoung}'),
    ('f0000000-0000-4000-8000-000000000002', '${ids.bornLongAgo}');

  insert into public.stories (id, slug, author_id, status) values
    ('a1000000-0000-4000-8000-000000000001', 'histoire-publique', null, 'published'),
    ('a1000000-0000-4000-8000-000000000002', 'histoire-vivante', null, 'published'),
    ('a1000000-0000-4000-8000-000000000003', 'brouillon-du-membre', '${ids.member}', 'draft'),
    ('a1000000-0000-4000-8000-000000000004', 'brouillon-de-l-autre', '${ids.otherMember}', 'draft');
  insert into public.stories_i18n (story_id, locale, title, body) values
    ('a1000000-0000-4000-8000-000000000001', 'fr', 'Histoire publique', 'Texte.'),
    ('a1000000-0000-4000-8000-000000000002', 'fr', 'SECRET histoire', 'SECRET texte.');
  insert into public.story_people (story_id, person_id) values
    ('a1000000-0000-4000-8000-000000000001', '${ids.dead}'),
    ('a1000000-0000-4000-8000-000000000002', '${ids.livingYoung}');

  insert into public.events (id, slug, status) values
    ('a2000000-0000-4000-8000-000000000001', 'evenement-public', 'published'),
    ('a2000000-0000-4000-8000-000000000002', 'evenement-vivant', 'published');
  insert into public.events_i18n (event_id, locale, title) values
    ('a2000000-0000-4000-8000-000000000001', 'fr', 'Bataille'),
    ('a2000000-0000-4000-8000-000000000002', 'fr', 'SECRET naissance');
  insert into public.event_people (event_id, person_id) values
    ('a2000000-0000-4000-8000-000000000001', '${ids.dead}'),
    ('a2000000-0000-4000-8000-000000000002', '${ids.livingYoung}');

  insert into public.sources (id, title, status) values
    ('a3000000-0000-4000-8000-000000000001', 'Charte publique', 'published'),
    ('a3000000-0000-4000-8000-000000000002', 'SECRET acte de naissance', 'published'),
    ('a3000000-0000-4000-8000-000000000003', 'SECRET acte de filiation', 'published'),
    ('a3000000-0000-4000-8000-000000000004', 'SECRET acte de mariage', 'published');
  insert into public.person_sources (source_id, person_id) values
    ('a3000000-0000-4000-8000-000000000001', '${ids.dead}'),
    ('a3000000-0000-4000-8000-000000000002', '${ids.livingYoung}');
  insert into public.filiation_sources (source_id, parent_id, child_id) values
    ('a3000000-0000-4000-8000-000000000003', '${ids.bornLongAgo}', '${ids.livingYoung}');
  insert into public.union_sources (source_id, union_id) values
    ('a3000000-0000-4000-8000-000000000004', 'e0000000-0000-4000-8000-000000000002');

  insert into public.tree_entry_points (id, person_id, is_default, status) values
    ('a4000000-0000-4000-8000-000000000001', '${ids.dead}', true, 'published'),
    ('a4000000-0000-4000-8000-000000000002', '${ids.livingYoung}', false, 'published');
  insert into public.tree_entry_points_i18n (entry_id, locale, label) values
    ('a4000000-0000-4000-8000-000000000001', 'fr', 'Depuis le plus ancien'),
    ('a4000000-0000-4000-8000-000000000002', 'fr', 'SECRET entrée');
  insert into public.lineages (id, start_person_id, end_person_id, status) values
    ('a5000000-0000-4000-8000-000000000001', '${ids.dead}', '${ids.bornLongAgo}', 'published'),
    ('a5000000-0000-4000-8000-000000000002', '${ids.dead}', '${ids.livingYoung}', 'published');
  insert into public.lineages_i18n (lineage_id, locale, title) values
    ('a5000000-0000-4000-8000-000000000001', 'fr', 'Lignée publique'),
    ('a5000000-0000-4000-8000-000000000002', 'fr', 'SECRET lignée');

  insert into public.suggestions (author_id, kind, payload) values
    ('${ids.otherMember}', 'correction', '{"note": "SECRET suggestion"}');
`;

let db: pg.Client;
let drop: () => Promise<void>;

beforeAll(async () => {
  ({ db, drop } = await createTestDatabase());
  await db.query(fixtures);
});

afterAll(async () => {
  await drop?.();
});

/** Every table of the public schema, read in full by `viewer`. */
async function everythingReadableBy(viewer: Parameters<typeof as>[1]) {
  const { rows: tables } = await db.query<{ name: string }>(
    `select tablename as name from pg_tables where schemaname = 'public' order by 1`,
  );
  const readable: Record<string, unknown[]> = {};
  for (const { name } of tables) {
    try {
      readable[name] = await as(db, viewer, (q) =>
        q(`select * from public.${name}`),
      );
    } catch (error) {
      expect((error as Error).message).toMatch(/permission denied/);
    }
  }
  return readable;
}

describe("a visitor", () => {
  it("only sees published people who are certainly dead", async () => {
    const rows = await as(db, visitor, (q) =>
      q<{ id: string }>("select id from public.people order by slug"),
    );
    expect(rows.map((r) => r.id).sort()).toEqual(
      [ids.dead, ids.bornLongAgo, ids.markedDeceased, ids.justOver100].sort(),
    );
  });

  it("cannot read a single field of a living person, in any table", async () => {
    const readable = await everythingReadableBy(visitor);
    expect(Object.keys(readable)).toContain("people");
    const dump = JSON.stringify(readable);
    for (const secret of secrets) {
      expect(dump, `"${secret}" leaked`).not.toContain(secret);
    }
  });

  it("does not see links, photos, stories, events or sources about the living", async () => {
    const counts = await as(db, visitor, (q) =>
      q<Record<string, string>>(`
        select
          (select count(*) from public.unions) as unions,
          (select count(*) from public.parent_child) as filiations,
          (select count(*) from public.media) as media,
          (select count(*) from public.media_people) as identified,
          (select count(*) from public.stories) as stories,
          (select count(*) from public.events) as events,
          (select count(*) from public.sources) as sources,
          (select count(*) from public.people_titles) as titles,
          (select count(*) from public.place_people) as places
      `),
    );
    expect(counts[0]).toEqual({
      unions: "1",
      filiations: "1",
      media: "1",
      identified: "1",
      stories: "1",
      events: "1",
      sources: "1",
      titles: "1",
      places: "1",
    });
  });

  it("sees living people in the tree only as « Personne vivante »", async () => {
    const rows = await as(db, visitor, (q) =>
      q<Record<string, unknown>>("select * from public.tree_people()"),
    );
    const hidden = rows.filter((r) => r.hidden);
    expect(hidden.map((r) => r.id).sort()).toEqual([...living].sort());
    for (const row of hidden) {
      const shown = Object.entries(row).filter(
        ([key, value]) =>
          !["id", "branch_id", "hidden"].includes(key) && value !== null,
      );
      expect(shown).toEqual([]);
    }
    expect(rows.some((r) => r.id === ids.pendingDead)).toBe(false);
    expect(JSON.stringify(rows)).not.toMatch(/Vivante|vivante-|1980/);
  });

  it("sees the shape of the tree without the dates of a living person's marriage", async () => {
    const links = await as(db, visitor, (q) =>
      q<Record<string, unknown>>("select * from public.tree_links()"),
    );
    const marriage = links.find(
      (l) => l.union_id === "e0000000-0000-4000-8000-000000000002",
    );
    expect(marriage).toMatchObject({
      marriage_date: null,
      marriage_precision: null,
    });
    expect(links.filter((l) => l.kind === "parent")).toHaveLength(2);
  });

  it("does not see entry points or lineages that lead to the living", async () => {
    const rows = await as(db, visitor, (q) =>
      q<Record<string, string>>(`
        select
          (select string_agg(label, ',') from public.tree_entry_points_i18n) as entries,
          (select string_agg(title, ',') from public.lineages_i18n) as lineages
      `),
    );
    expect(rows[0]).toEqual({
      entries: "Depuis le plus ancien",
      lineages: "Lignée publique",
    });
  });

  it("cannot read accounts, profiles, suggestions, requests or the journal", async () => {
    for (const table of [
      "private.accounts",
      "private.sessions",
      "private.login_tokens",
      "public.profiles",
      "public.suggestions",
      "public.access_requests",
      "public.invitations",
      "public.audit_log",
    ]) {
      expect(
        await errorOf(db, visitor, `select * from ${table}`),
        table,
      ).toMatch(/permission denied/);
    }
  });

  it("cannot change anything", async () => {
    expect(
      await errorOf(db, visitor, "update public.people set surname = 'X'"),
    ).toMatch(/permission denied/);
    expect(await errorOf(db, visitor, "delete from public.stories")).toMatch(
      /permission denied/,
    );
    expect(
      await errorOf(
        db,
        visitor,
        "insert into public.people (slug) values ('intrus')",
      ),
    ).toMatch(/permission denied/);
  });

  it("can ask for family access, and only that", async () => {
    expect(
      await errorOf(
        db,
        visitor,
        `insert into public.access_requests (email, full_name, relation)
         values ('cousin@example.org', 'Un cousin', 'Petit-fils de…')`,
      ),
    ).toBeNull();
    expect(
      await errorOf(
        db,
        visitor,
        `insert into public.access_requests (email, full_name, relation, state)
         values ('cousin@example.org', 'Un cousin', 'Petit-fils de…', 'approved')`,
      ),
    ).toMatch(/row-level security/);
  });
});

describe("an account that is not, or no longer, a member", () => {
  for (const [label, id] of [
    ["disabled", ids.disabled],
    ["without profile", ids.noProfile],
  ] as const) {
    it(`(${label}) sees exactly what a visitor sees`, async () => {
      const readable = JSON.stringify(await everythingReadableBy(account(id)));
      for (const secret of secrets) {
        expect(readable, `"${secret}" leaked`).not.toContain(secret);
      }
    });
  }
});

describe("a member", () => {
  const member = account(ids.member);

  it("sees the living people of the family and what concerns them", async () => {
    const rows = await as(db, member, (q) =>
      q<Record<string, string>>(`
        select
          (select count(*) from public.people) as people,
          (select biography from public.people_i18n where person_id = '${ids.livingYoung}') as bio,
          (select count(*) from public.media where status = 'published') as media,
          (select count(*) from public.events) as events,
          (select count(*) from public.tree_entry_points) as entries,
          (select count(*) from public.lineages_i18n) as lineages
      `),
    );
    expect(rows[0]).toEqual({
      people: "9",
      bio: "SECRET biographie.",
      media: "2",
      events: "2",
      entries: "2",
      lineages: "2",
    });
  });

  it("sees living people with their names in the tree", async () => {
    const rows = await as(db, member, (q) =>
      q<{ hidden: boolean }>("select hidden from public.tree_people()"),
    );
    expect(rows).toHaveLength(9);
    expect(rows.every((r) => !r.hidden)).toBe(true);
  });

  it("does not see what waits for validation, except their own", async () => {
    const people = await as(db, member, (q) =>
      q(`select id from public.people where id = '${ids.pendingDead}'`),
    );
    expect(people).toHaveLength(0);
    const stories = await as(db, member, (q) =>
      q<{ slug: string }>(
        "select slug from public.stories where status = 'draft'",
      ),
    );
    expect(stories.map((s) => s.slug)).toEqual(["brouillon-du-membre"]);
    const media = await as(db, member, (q) =>
      q("select id from public.media where status = 'pending'"),
    );
    expect(media).toHaveLength(1);
  });

  it("cannot change the tree directly", async () => {
    const changed = await as(db, member, (q) =>
      q(
        `update public.people set surname = 'X' where id = '${ids.dead}' returning id`,
      ),
    );
    expect(changed).toHaveLength(0);
    expect(
      await errorOf(
        db,
        member,
        "insert into public.people (slug, status) values ('nouveau', 'published')",
      ),
    ).toMatch(/row-level security/);
  });

  it("writes stories as drafts, never published", async () => {
    expect(
      await errorOf(
        db,
        member,
        `insert into public.stories (slug, author_id, status)
         values ('mon-histoire', '${ids.member}', 'pending')`,
      ),
    ).toBeNull();
    expect(
      await errorOf(
        db,
        member,
        `insert into public.stories (slug, author_id, status)
         values ('publiee', '${ids.member}', 'published')`,
      ),
    ).toMatch(/row-level security/);
    expect(
      await errorOf(
        db,
        member,
        `insert into public.stories (slug, author_id, status)
         values ('au-nom-d-un-autre', '${ids.otherMember}', 'draft')`,
      ),
    ).toMatch(/row-level security/);
    const edited = await as(db, member, (q) =>
      q(
        `update public.stories set slug = 'pirate' where author_id = '${ids.otherMember}' returning id`,
      ),
    );
    expect(edited).toHaveLength(0);
  });

  it("sends suggestions in their own name and only follows their own", async () => {
    expect(
      await errorOf(
        db,
        member,
        `insert into public.suggestions (author_id, kind, payload)
         values ('${ids.member}', 'correction', '{}')`,
      ),
    ).toBeNull();
    expect(
      await errorOf(
        db,
        member,
        `insert into public.suggestions (author_id, kind, payload)
         values ('${ids.otherMember}', 'correction', '{}')`,
      ),
    ).toMatch(/row-level security/);
    expect(
      await errorOf(
        db,
        member,
        `insert into public.suggestions (author_id, kind, payload, state)
         values ('${ids.member}', 'correction', '{}', 'accepted')`,
      ),
    ).toMatch(/row-level security/);
    const seen = await as(db, member, (q) =>
      q("select * from public.suggestions"),
    );
    expect(JSON.stringify(seen)).not.toContain("SECRET");
  });

  it("changes their own name, but not their role", async () => {
    expect(
      await errorOf(
        db,
        member,
        `update public.profiles set display_name = 'Nouveau nom' where id = '${ids.member}'`,
      ),
    ).toBeNull();
    expect(
      await errorOf(
        db,
        member,
        `update public.profiles set role = 'admin' where id = '${ids.member}'`,
      ),
    ).toMatch(/only an administrator/);
    const others = await as(db, member, (q) =>
      q("select id from public.profiles"),
    );
    expect(others).toEqual([{ id: ids.member }]);
  });

  it("cannot read the journal", async () => {
    const rows = await as(db, member, (q) =>
      q("select * from public.audit_log"),
    );
    expect(rows).toHaveLength(0);
  });
});

describe("an administrator", () => {
  const admin = account(ids.admin);

  it("sees everything, drafts included", async () => {
    const rows = await as(db, admin, (q) =>
      q<{ people: string; stories: string }>(`
        select (select count(*) from public.people) as people,
               (select count(*) from public.stories) as stories
      `),
    );
    expect(rows[0]).toEqual({ people: "10", stories: "4" });
  });

  it("changes are journaled with who, what, before and after", async () => {
    const entries = await as(db, admin, async (q) => {
      await q(
        `update public.people set surname = 'Corrigé' where id = '${ids.dead}'`,
      );
      return q<Record<string, unknown>>(
        `select actor_id, table_name, action, row_key,
                old_data ->> 'surname' as before, new_data ->> 'surname' as after
         from public.audit_log where table_name = 'people' order by id desc limit 1`,
      );
    });
    expect(entries[0]).toEqual({
      actor_id: ids.admin,
      table_name: "people",
      action: "update",
      row_key: { id: ids.dead },
      before: "Ancien",
      after: "Corrigé",
    });
  });

  it("can promote a member", async () => {
    expect(
      await errorOf(
        db,
        admin,
        `update public.profiles set role = 'admin' where id = '${ids.member}'`,
      ),
    ).toBeNull();
  });
});

describe("the living rule", () => {
  it.each([
    ["no date at all", null, null, false, null, true],
    ["ticked as deceased", null, null, true, null, false],
    ["with a death date", "1990-01-01", "day", false, "2020-01-01", false],
    ["born in 1980", "1980-01-01", "year", false, null, true],
    ["born « vers 1922 »", "1922-01-01", "about", false, null, true],
    ["born « vers 1900 »", "1900-01-01", "about", false, null, false],
    ["born « après 1850 »", "1850-01-01", "after", false, null, true],
    ["born « avant 1925 »", "1925-01-01", "before", false, null, false],
  ])(
    "%s → living: %s",
    async (_, birth, precision, deceased, death, expected) => {
      const { rows } = await db.query(
        "select app.is_living($1, $2::date, $3::public.date_precision, $4::date) as living",
        [deceased, birth, precision, death],
      );
      expect(rows[0].living).toBe(expected);
    },
  );
});

import type pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { account, as, createTestDatabase, errorOf, visitor } from "./harness";

/**
 * Step 10: accounts and contributions. Addresses and emails stay out of
 * reach; a member sends their own proposals and follows only them; only an
 * administrator answers, and sees who the members are.
 */

const admin = "a0000000-0000-4000-8000-0000000000a1";
const member = "a0000000-0000-4000-8000-0000000000b1";
const other = "a0000000-0000-4000-8000-0000000000c1";
const person = "e0000000-0000-4000-8000-000000000001";

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
      ('${person}', 'ancetre', 'Ancêtre', '1800-01-01', 'year', '1870-01-01', 'year', 'published');
    insert into private.emails (recipient, subject, body, topic, delivery) values
      ('admin@example.org', 'Nouvelle proposition', 'Texte', 'suggestion', 'logged');
  `);
});

afterAll(async () => {
  await drop?.();
});

describe("the email log", () => {
  it("is out of reach of visitors and members", async () => {
    for (const viewer of [visitor, account(member), account(admin)]) {
      expect(await errorOf(db, viewer, "select * from private.emails")).toMatch(
        /permission denied/,
      );
    }
  });
});

describe("the list of members", () => {
  it("is for administrators only", async () => {
    expect(
      await errorOf(db, visitor, "select * from public.admin_members()"),
    ).toMatch(/permission denied/);
    expect(
      await errorOf(
        db,
        account(member),
        "select * from public.admin_members()",
      ),
    ).toMatch(/administrators only/);
    const rows = await as(db, account(admin), (q) =>
      q<{ email: string }>("select email from public.admin_members()"),
    );
    expect(rows.map((r) => r.email).sort()).toEqual([
      "admin@example.org",
      "m@example.org",
      "o@example.org",
    ]);
  });
});

describe("proposals", () => {
  it("are sent by a member in their own name only", async () => {
    await as(db, account(member), (q) =>
      q(
        `insert into public.suggestions (author_id, kind, target_table, target_id, payload)
         values ($1, 'claim', 'people', $2, '{}')`,
        [member, person],
      ),
    );
    expect(
      await errorOf(
        db,
        account(member),
        `insert into public.suggestions (author_id, kind, payload)
         values ('${other}', 'correction', '{"text":"x"}')`,
      ),
    ).toMatch(/row-level security/);
    expect(
      await errorOf(
        db,
        account(member),
        `insert into public.suggestions (author_id, kind, payload, state)
         values ('${member}', 'correction', '{"text":"x"}', 'accepted')`,
      ),
    ).toMatch(/row-level security/);
  });

  it("are followed by their author, not by other members", async () => {
    await db.query(
      `insert into public.suggestions (author_id, kind, payload)
       values ('${member}', 'correction', '{"text":"Date fausse"}')`,
    );
    const mine = await as(db, account(member), (q) =>
      q("select id from public.suggestions"),
    );
    const theirs = await as(db, account(other), (q) =>
      q("select id from public.suggestions"),
    );
    expect(mine).toHaveLength(1);
    expect(theirs).toHaveLength(0);
  });

  it("are answered by an administrator only", async () => {
    const byMember = await as(db, account(member), (q) =>
      q(
        `update public.suggestions set state = 'accepted' where author_id = $1 returning id`,
        [member],
      ),
    );
    expect(byMember).toHaveLength(0);
    const byAdmin = await as(db, account(admin), (q) =>
      q(
        `update public.suggestions set state = 'accepted', admin_reply = 'Merci'
         where author_id = $1 returning id`,
        [member],
      ),
    );
    expect(byAdmin).toHaveLength(1);
  });

  it("let only an administrator link an account to a person", async () => {
    expect(
      await errorOf(
        db,
        account(member),
        `update public.profiles set person_id = '${person}' where id = '${member}'`,
      ),
    ).toMatch(/only an administrator/);
    const linked = await as(db, account(admin), (q) =>
      q<{ person_id: string }>(
        "update public.profiles set person_id = $2 where id = $1 returning person_id",
        [member, person],
      ),
    );
    expect(linked).toEqual([{ person_id: person }]);
  });
});

describe("access requests", () => {
  it("are sent by visitors, who cannot read them back", async () => {
    expect(
      await errorOf(
        db,
        visitor,
        `insert into public.access_requests (email, full_name, relation, locale)
         values ('cousin@example.org', 'Cousin', 'Petit-fils de…', 'en')`,
      ),
    ).toBeNull();
    await db.query(
      `insert into public.access_requests (email, full_name, relation, locale)
       values ('cousin@example.org', 'Cousin', 'Petit-fils de…', 'en')`,
    );
    expect(
      await errorOf(db, visitor, "select * from public.access_requests"),
    ).toMatch(/permission denied/);
    expect(
      await as(db, account(member), (q) =>
        q("select * from public.access_requests"),
      ),
    ).toHaveLength(0);
    const seen = await as(db, account(admin), (q) =>
      q<{ locale: string }>("select locale from public.access_requests"),
    );
    expect(seen).toEqual([{ locale: "en" }]);
  });

  it("cannot be approved by the visitor who sends them", async () => {
    expect(
      await errorOf(
        db,
        visitor,
        `insert into public.access_requests (email, full_name, relation, state)
         values ('x@example.org', 'X', 'Y', 'approved')`,
      ),
    ).toMatch(/row-level security/);
  });
});

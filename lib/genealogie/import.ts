import "server-only";
import { randomUUID } from "node:crypto";
import { findOrCreatePlace } from "@/lib/data/places";
import type { Query } from "@/lib/db";
import { slugify } from "@/lib/slug";
import { lifespanYears } from "./names";
import type { GedcomData, GedcomPerson } from "./gedcom";
import { isLiving } from "./living";

export type ImportPreview = {
  people: number;
  families: number;
  places: number;
  living: number;
  duplicates: string[];
  sample: string[];
  undatedDates: string[];
  missing: number;
  notes: number;
};

function dated(p: GedcomPerson) {
  return {
    deceased: p.deceased,
    birth_date: p.birth?.date?.date ?? null,
    birth_precision: p.birth?.date?.precision ?? null,
    death_date: p.death?.date?.date ?? null,
    death_precision: p.death?.date?.precision ?? null,
  };
}

function label(p: GedcomPerson) {
  const name = [p.givenNames, p.surname].filter(Boolean).join(" ") || p.xref;
  const years = lifespanYears(dated(p));
  return years ? `${name} (${years})` : name;
}

/** People already in the tree with the same name and birth year. */
async function existingMatches(q: Query, people: GedcomPerson[]) {
  const rows = await q<{ id: string; key: string }>(
    `select id, lower(coalesce(given_names, '')) || '|' || lower(coalesce(surname, '')) || '|' ||
            coalesce(extract(year from birth_date)::text, '') as key
     from public.people`,
  );
  const byKey = new Map(rows.map((r) => [r.key, r.id]));
  const matches = new Map<string, string>();
  for (const p of people) {
    const key = `${p.givenNames.toLowerCase()}|${p.surname.toLowerCase()}|${p.birth?.date?.date.slice(0, 4) ?? ""}`;
    const id = byKey.get(key);
    if (id && (p.givenNames || p.surname)) matches.set(p.xref, id);
  }
  return matches;
}

export async function previewImport(
  q: Query,
  data: GedcomData,
): Promise<ImportPreview> {
  const matches = await existingMatches(q, data.people);
  const places = new Set(
    data.people
      .flatMap((p) => [p.birth?.place, p.death?.place])
      .concat(data.families.map((f) => f.marriage?.place))
      .filter(Boolean),
  );
  return {
    people: data.people.length,
    families: data.families.length,
    places: places.size,
    living: data.people.filter((p) => isLiving(dated(p))).length,
    duplicates: data.people.filter((p) => matches.has(p.xref)).map(label),
    sample: data.people.slice(0, 8).map(label),
    undatedDates: data.warnings
      .filter((w) => w.code === "date")
      .map((w) => w.detail),
    missing: data.warnings.filter((w) => w.code === "missing").length,
    notes: Number(data.warnings.find((w) => w.code === "notes")?.detail ?? 0),
  };
}

export type ImportResult = {
  people: number;
  unions: number;
  links: number;
  reused: number;
};

/**
 * Loads a GEDCOM file into the tree, in one transaction, with bulk inserts
 * so that a few thousand people take seconds. People already present (same
 * name and birth year) can be reused instead of duplicated.
 */
export async function importGedcom(
  q: Query,
  data: GedcomData,
  options: { published: boolean; reuseExisting: boolean; actor: string },
): Promise<ImportResult> {
  const status = options.published ? "published" : "draft";
  const matches = options.reuseExisting
    ? await existingMatches(q, data.people)
    : new Map();

  const placeIds = new Map<string, string | null>();
  const place = async (name: string | undefined) => {
    const clean = name?.trim();
    if (!clean) return null;
    if (!placeIds.has(clean))
      placeIds.set(clean, await findOrCreatePlace(q, clean));
    return placeIds.get(clean) ?? null;
  };

  const taken = new Set(
    (await q<{ slug: string }>("select slug from public.people")).map(
      (r) => r.slug,
    ),
  );
  const uniqueSlug = (base: string) => {
    let slug = base;
    for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;
    taken.add(slug);
    return slug;
  };

  const ids = new Map<string, string>(matches);
  const columns: unknown[][] = Array.from({ length: 15 }, () => []);
  for (const p of data.people) {
    if (ids.has(p.xref)) continue;
    const id = randomUUID();
    ids.set(p.xref, id);
    const values = [
      id,
      uniqueSlug(
        slugify(
          [p.givenNames, p.surname, p.birth?.date?.date.slice(0, 4)]
            .filter(Boolean)
            .join(" "),
        ),
      ),
      p.givenNames || null,
      p.surname || null,
      p.epithet || null,
      p.sex,
      p.birth?.date?.date ?? null,
      p.birth?.date?.precision ?? null,
      await place(p.birth?.place),
      p.death?.date?.date ?? null,
      p.death?.date?.precision ?? null,
      await place(p.death?.place),
      p.deceased,
      status,
      options.actor,
    ];
    values.forEach((v, i) => columns[i].push(v));
  }

  if (columns[0].length) {
    await q(
      `insert into public.people
         (id, slug, given_names, surname, epithet, sex, birth_date, birth_precision,
          birth_place_id, death_date, death_precision, death_place_id, deceased, status, created_by)
       select * from unnest(
         $1::uuid[], $2::text[], $3::text[], $4::text[], $5::text[], $6::public.sex[],
         $7::date[], $8::public.date_precision[], $9::uuid[], $10::date[],
         $11::public.date_precision[], $12::uuid[], $13::boolean[],
         $14::public.content_status[], $15::uuid[])`,
      columns,
    );
  }

  // Unions, numbered in the order of each person's families.
  const familiesOf = new Map<string, number>();
  const unions: unknown[][] = Array.from({ length: 8 }, () => []);
  const unionIds = new Map<string, string>();
  for (const f of data.families) {
    if (f.partners.length !== 2) continue;
    const [a, b] = f.partners.map((x) => ids.get(x)!);
    const existing = await q<{ id: string }>(
      `select id from public.unions
       where (partner_a = $1 and partner_b = $2) or (partner_a = $2 and partner_b = $1)`,
      [a, b],
    );
    if (existing[0]) {
      unionIds.set(f.xref, existing[0].id);
      continue;
    }
    const order = (familiesOf.get(a) ?? 0) + 1;
    familiesOf.set(a, order);
    const id = randomUUID();
    unionIds.set(f.xref, id);
    [
      id,
      a,
      b,
      order,
      f.marriage?.date?.date ?? null,
      f.marriage?.date?.precision ?? null,
      await place(f.marriage?.place),
      status,
    ].forEach((v, i) => unions[i].push(v));
  }
  if (unions[0].length) {
    await q(
      `insert into public.unions
         (id, partner_a, partner_b, union_order, marriage_date, marriage_precision, place_id, status, created_by)
       select u.*, $9::uuid from unnest(
         $1::uuid[], $2::uuid[], $3::uuid[], $4::smallint[], $5::date[],
         $6::public.date_precision[], $7::uuid[], $8::public.content_status[]) as u`,
      [...unions, options.actor],
    );
  }

  const links: unknown[][] = [[], [], []];
  const seen = new Set<string>();
  for (const f of data.families) {
    for (const childRef of f.children) {
      for (const parentRef of f.partners) {
        const parent = ids.get(parentRef)!;
        const child = ids.get(childRef)!;
        const key = `${parent}|${child}`;
        if (parent === child || seen.has(key)) continue;
        seen.add(key);
        links[0].push(parent);
        links[1].push(child);
        links[2].push(unionIds.get(f.xref) ?? null);
      }
    }
  }
  let linked = 0;
  if (links[0].length) {
    const [row] = await q<{ n: number }>(
      `with inserted as (
         insert into public.parent_child (parent_id, child_id, union_id, status, created_by)
         select l.parent, l.child, l.union_id, $4::public.content_status, $5::uuid
         from unnest($1::uuid[], $2::uuid[], $3::uuid[]) as l(parent, child, union_id)
         on conflict do nothing
         returning 1
       )
       select count(*)::int as n from inserted`,
      [...links, status, options.actor],
    );
    linked = row.n;
  }

  return {
    people: columns[0].length,
    unions: unions[0].length,
    links: linked,
    reused: matches.size,
  };
}

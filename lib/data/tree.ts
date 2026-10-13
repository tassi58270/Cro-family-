import "server-only";
import { hasDatabase, withViewer, type Query, type Viewer } from "@/lib/db";
import type { DatePrecision } from "@/lib/genealogie/dates";
import type { Locale } from "@/lib/i18n/routing";

/**
 * The family tree as one compact file (cahier des charges, section 5,
 * « Rendu et mise à jour »): visitors get a version built from
 * tree_people() and tree_links(), where living people are placeholders
 * without name or date; members get a full one. People refer to each other
 * by index in `people`.
 */

export type TreePerson = {
  id: string;
  slug: string | null;
  given: string | null;
  surname: string | null;
  epithet: string | null;
  sex: "female" | "male" | "unknown" | null;
  birth: number | null;
  birthPrecision: DatePrecision | null;
  death: number | null;
  deathPrecision: DatePrecision | null;
  deceased: boolean;
  /** Index in `branches`, or -1. */
  branch: number;
  /** A living person shown to visitors: « Personne vivante », nothing else. */
  hidden: boolean;
  portrait: boolean;
  /** Indexes in `titles`. */
  titles: number[];
  /** Birth and death places, for the search. */
  places: string[];
  /** Arms shown next to the person: index in `arms`, or -1. */
  arms: number;
  /** Arms of the family they come from, for spouses: index in `arms`, or -1. */
  originArms: number;
  originFamily: string | null;
};

export type TreeData = {
  people: TreePerson[];
  /** [parent, child, union or -1, certainty 0 attested · 1 tradition · 2 debated] */
  links: [number, number, number, 0 | 1 | 2][];
  /** [partner, partner or -1, order, marriage year or null, certainty] */
  unions: [number, number, number, number | null, 0 | 1 | 2][];
  branches: {
    id: string;
    slug: string;
    name: string;
    color: string | null;
    extinct: boolean;
    extinctYear: number | null;
    founder: number;
    parent: number;
    /** Index in `arms`, or -1. */
    arms: number;
  }[];
  titles: { id: string; slug: string; name: string }[];
  arms: { builtin: string | null; url: string | null; name: string | null }[];
  entryPoints: { label: string; person: number; isDefault: boolean }[];
  lineages: {
    id: string;
    title: string;
    intro: string | null;
    start: number;
    end: number;
  }[];
  members: boolean;
};

const CERTAINTY = { attested: 0, tradition: 1, debated: 2 } as const;

function byLocale<T extends { locale: Locale }>(rows: T[], locale: Locale) {
  return (
    rows.find((r) => r.locale === locale) ??
    rows.find((r) => r.locale === "fr") ??
    rows[0]
  );
}

export async function loadTree(
  viewer: Viewer,
  locale: Locale,
): Promise<TreeData> {
  const empty: TreeData = {
    people: [],
    links: [],
    unions: [],
    branches: [],
    titles: [],
    arms: [],
    entryPoints: [],
    lineages: [],
    members: viewer.kind === "account",
  };
  if (!hasDatabase()) return empty;
  return withViewer(viewer, (q) => build(q, locale, viewer));
}

async function build(
  q: Query,
  locale: Locale,
  viewer: Viewer,
): Promise<TreeData> {
  const rows = await q<{
    id: string;
    slug: string | null;
    given_names: string | null;
    surname: string | null;
    epithet: string | null;
    sex: TreePerson["sex"];
    birth_date: string | null;
    birth_precision: DatePrecision | null;
    death_date: string | null;
    death_precision: DatePrecision | null;
    deceased: boolean | null;
    branch_id: string | null;
    portrait_id: string | null;
    hidden: boolean;
  }>(
    "select * from public.tree_people() order by birth_date nulls last, surname, given_names",
  );
  const index = new Map(rows.map((r, i) => [r.id, i]));

  const branchRows = await q<{
    id: string;
    slug: string;
    parent_id: string | null;
    founder_id: string | null;
    state: "extant" | "extinct";
    extinct_male_year: number | null;
    extinct_female_year: number | null;
    color: string | null;
  }>("select * from public.branches order by sort_order, created_at");
  const branchNames = await q<{
    branch_id: string;
    locale: Locale;
    name: string;
  }>("select branch_id, locale, name from public.branches_i18n");
  const branchIndex = new Map(branchRows.map((b, i) => [b.id, i]));

  const titleRows = await q<{ id: string; slug: string }>(
    "select id, slug from public.titles order by created_date nulls last, sort_order",
  );
  const titleNames = await q<{
    title_id: string;
    locale: Locale;
    name: string;
  }>("select title_id, locale, name from public.titles_i18n");
  const titleIndex = new Map(titleRows.map((t, i) => [t.id, i]));
  const held = await q<{ person_id: string; title_id: string }>(
    "select distinct person_id, title_id from public.people_titles",
  );

  const placeRows = await q<{
    id: string;
    birth: string | null;
    death: string | null;
  }>(
    `select p.id, b.name as birth, d.name as death
     from public.people p
     left join public.places_i18n b on b.place_id = p.birth_place_id and b.locale = 'fr'
     left join public.places_i18n d on d.place_id = p.death_place_id and d.locale = 'fr'
     where p.birth_place_id is not null or p.death_place_id is not null`,
  );
  const placesOf = new Map(
    placeRows.map((p) => [
      p.id,
      [p.birth, p.death].filter((x): x is string => Boolean(x)),
    ]),
  );

  const armsRows = await q<{
    id: string;
    builtin: string | null;
    svg_path: string | null;
    branch_id: string | null;
    person_id: string | null;
  }>(
    `select a.id, a.builtin, m.storage_path as svg_path, a.branch_id, a.person_id
     from public.arms a left join public.media m on m.id = a.svg_id
     order by a.sort_order, a.created_at`,
  );
  const armsNames = await q<{ arms_id: string; locale: Locale; name: string }>(
    "select arms_id, locale, name from public.arms_i18n",
  );
  const armsIndex = new Map(armsRows.map((a, i) => [a.id, i]));
  const originArms = await q<{
    id: string;
    origin_arms_id: string | null;
    origin_family: string | null;
  }>(
    "select id, origin_arms_id, origin_family from public.people where origin_arms_id is not null or origin_family is not null",
  );
  const originOf = new Map(originArms.map((o) => [o.id, o]));

  const people: TreePerson[] = rows.map((r) => {
    const personArms = armsRows.find((a) => a.person_id === r.id);
    const branchArms = r.branch_id
      ? armsRows.find((a) => a.branch_id === r.branch_id)
      : undefined;
    const origin = r.hidden ? undefined : originOf.get(r.id);
    return {
      id: r.id,
      slug: r.slug,
      given: r.given_names,
      surname: r.surname,
      epithet: r.epithet,
      sex: r.sex,
      birth: r.birth_date ? Number(r.birth_date.slice(0, 4)) : null,
      birthPrecision: r.birth_precision,
      death: r.death_date ? Number(r.death_date.slice(0, 4)) : null,
      deathPrecision: r.death_precision,
      deceased: Boolean(r.deceased),
      branch: r.branch_id ? (branchIndex.get(r.branch_id) ?? -1) : -1,
      hidden: r.hidden,
      portrait: Boolean(r.portrait_id),
      titles: r.hidden
        ? []
        : held
            .filter((h) => h.person_id === r.id)
            .map((h) => titleIndex.get(h.title_id) ?? -1)
            .filter((i) => i >= 0),
      places: r.hidden ? [] : (placesOf.get(r.id) ?? []),
      arms: r.hidden
        ? -1
        : (armsIndex.get((personArms ?? branchArms)?.id ?? "") ?? -1),
      originArms: origin?.origin_arms_id
        ? (armsIndex.get(origin.origin_arms_id) ?? -1)
        : -1,
      originFamily: origin?.origin_family ?? null,
    };
  });

  const linkRows = await q<{
    kind: "parent" | "union";
    from_id: string;
    to_id: string | null;
    union_id: string | null;
    union_order: number | null;
    marriage_date: string | null;
    certainty: keyof typeof CERTAINTY;
  }>("select * from public.tree_links()");

  const unionRows = linkRows.filter((l) => l.kind === "union");
  const unionIndex = new Map(unionRows.map((u, i) => [u.union_id!, i]));
  const unions: TreeData["unions"] = unionRows.map((u) => [
    index.get(u.from_id)!,
    u.to_id ? (index.get(u.to_id) ?? -1) : -1,
    u.union_order ?? 1,
    u.marriage_date ? Number(u.marriage_date.slice(0, 4)) : null,
    CERTAINTY[u.certainty],
  ]);
  const links: TreeData["links"] = linkRows
    .filter(
      (l) =>
        l.kind === "parent" &&
        index.has(l.from_id) &&
        l.to_id &&
        index.has(l.to_id),
    )
    .map((l) => [
      index.get(l.from_id)!,
      index.get(l.to_id!)!,
      l.union_id ? (unionIndex.get(l.union_id) ?? -1) : -1,
      CERTAINTY[l.certainty],
    ]);

  const entryRows = await q<{
    id: string;
    person_id: string;
    is_default: boolean;
  }>(
    "select id, person_id, is_default from public.tree_entry_points order by sort_order, created_at",
  );
  const entryLabels = await q<{
    entry_id: string;
    locale: Locale;
    label: string;
  }>("select entry_id, locale, label from public.tree_entry_points_i18n");
  const lineageRows = await q<{
    id: string;
    start_person_id: string;
    end_person_id: string;
  }>(
    "select id, start_person_id, end_person_id from public.lineages order by sort_order, created_at",
  );
  const lineageTexts = await q<{
    lineage_id: string;
    locale: Locale;
    title: string;
    intro: string | null;
  }>("select lineage_id, locale, title, intro from public.lineages_i18n");

  return {
    people,
    links,
    unions,
    branches: branchRows.map((b) => ({
      id: b.id,
      slug: b.slug,
      name:
        byLocale(
          branchNames.filter((n) => n.branch_id === b.id),
          locale,
        )?.name ?? b.slug,
      color: b.color,
      extinct: b.state === "extinct",
      extinctYear: b.extinct_male_year ?? b.extinct_female_year,
      founder: b.founder_id ? (index.get(b.founder_id) ?? -1) : -1,
      parent: b.parent_id ? (branchIndex.get(b.parent_id) ?? -1) : -1,
      arms:
        armsIndex.get(armsRows.find((a) => a.branch_id === b.id)?.id ?? "") ??
        -1,
    })),
    titles: titleRows.map((t) => ({
      id: t.id,
      slug: t.slug,
      name:
        byLocale(
          titleNames.filter((n) => n.title_id === t.id),
          locale,
        )?.name ?? t.slug,
    })),
    arms: armsRows.map((a) => ({
      builtin: a.builtin,
      url: a.svg_path ? `/fichiers/${a.svg_path}` : null,
      name:
        byLocale(
          armsNames.filter((n) => n.arms_id === a.id),
          locale,
        )?.name ?? null,
    })),
    entryPoints: entryRows
      .filter((e) => index.has(e.person_id))
      .map((e) => ({
        label:
          byLocale(
            entryLabels.filter((l) => l.entry_id === e.id),
            locale,
          )?.label ?? "",
        person: index.get(e.person_id)!,
        isDefault: e.is_default,
      })),
    lineages: lineageRows
      .filter((l) => index.has(l.start_person_id) && index.has(l.end_person_id))
      .map((l) => {
        const text = byLocale(
          lineageTexts.filter((t) => t.lineage_id === l.id),
          locale,
        );
        return {
          id: l.id,
          title: text?.title ?? "",
          intro: text?.intro ?? null,
          start: index.get(l.start_person_id)!,
          end: index.get(l.end_person_id)!,
        };
      }),
    members: viewer.kind === "account",
  };
}

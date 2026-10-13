import "server-only";
import { cache } from "react";
import { hasDatabase, withViewer, type Query, type Viewer } from "@/lib/db";
import type { DatePrecision, FuzzyDate } from "@/lib/genealogie/dates";
import { isLiving } from "@/lib/genealogie/living";
import { lifespanYears, personName } from "@/lib/genealogie/names";
import type { Locale } from "@/lib/i18n/routing";
import { typeset } from "@/lib/typography";
import type { Localized } from "./home";

/**
 * Everything the person page shows (cahier des charges, 6.2, « Fiche d'une
 * personne »). Family links come from tree_people() and tree_links(), so a
 * living relative appears to visitors as « Personne vivante », exactly as in
 * the tree; the rest is read under the viewer's access rules.
 */

export type Certainty = "attested" | "tradition" | "debated";

export type Relative = {
  id: string;
  slug: string | null;
  name: string | null;
  years: string;
  sex: "female" | "male" | "unknown" | null;
  hidden: boolean;
  certainty?: Certainty;
};

export type Source = {
  id: string;
  kind: string;
  title: string;
  reference: string | null;
  repository: string | null;
  url: string | null;
  transcription: string | null;
  translation: string | null;
  note: string | null;
};

export type PersonDetail = {
  id: string;
  slug: string;
  name: string;
  givenNames: string | null;
  surname: string | null;
  epithet: string | null;
  sex: "female" | "male" | "unknown";
  birth: (FuzzyDate & { place: string | null }) | null;
  death: (FuzzyDate & { place: string | null }) | null;
  deceased: boolean;
  living: boolean;
  status: string;
  isDemo: boolean;
  branch: { slug: string; name: string; color: string | null } | null;
  arms: { builtin: string | null; name: string | null } | null;
  originFamily: string | null;
  biography: Localized | null;
  roles: Localized | null;
  works: Localized | null;
  titles: {
    slug: string;
    name: string;
    rank: number | null;
    from: number | null;
    to: number | null;
  }[];
  parents: Relative[];
  siblings: Relative[];
  unions: {
    id: string;
    order: number;
    partner: Relative | null;
    partnerFamily: string | null;
    marriage: (FuzzyDate & { place: string | null }) | null;
    certainty: Certainty;
    children: Relative[];
  }[];
  otherChildren: Relative[];
  stories: { slug: string; title: string; excerpt: string | null }[];
  /** Photos and portraits where the person is identified. */
  photos: {
    id: string;
    url: string;
    caption: string | null;
    width: number | null;
    height: number | null;
  }[];
  places: { slug: string; name: string; role: string | null }[];
  events: {
    slug: string;
    title: string;
    year: number | null;
    place: string | null;
  }[];
  sources: Source[];
  /** Proofs of each parent link, by parent id. */
  filiationSources: Record<string, Source[]>;
};

type TreeRow = {
  id: string;
  slug: string | null;
  given_names: string | null;
  surname: string | null;
  epithet: string | null;
  sex: Relative["sex"];
  birth_date: string | null;
  birth_precision: DatePrecision | null;
  death_date: string | null;
  death_precision: DatePrecision | null;
  deceased: boolean | null;
  hidden: boolean;
};

function relative(row: TreeRow, certainty?: Certainty): Relative {
  return {
    id: row.id,
    slug: row.hidden ? null : row.slug,
    name: row.hidden ? null : personName(row),
    years: row.hidden
      ? ""
      : lifespanYears({ ...row, deceased: Boolean(row.deceased) }),
    sex: row.hidden ? null : row.sex,
    hidden: row.hidden,
    certainty,
  };
}

function pick<T extends { locale: Locale }>(
  rows: T[],
  locale: Locale,
): T | undefined {
  return (
    rows.find((r) => r.locale === locale) ??
    rows.find((r) => r.locale === "fr") ??
    rows[0]
  );
}

function localizedField(
  rows: ({ locale: Locale } & Record<string, unknown>)[],
  locale: Locale,
  field: string,
): Localized | null {
  for (const l of [locale, "fr" as const]) {
    const row = rows.find((r) => r.locale === l);
    const value = row?.[field];
    if (typeof value === "string" && value.trim())
      return { text: typeset(value, l), lang: l };
  }
  return null;
}

const SOURCE_COLUMNS = `s.id, s.kind, s.title, s.reference, s.repository, s.url, s.transcription, s.translation`;

async function detail(
  q: Query,
  slug: string,
  locale: Locale,
): Promise<PersonDetail | null> {
  const [p] = await q<{
    id: string;
    slug: string;
    given_names: string | null;
    surname: string | null;
    epithet: string | null;
    sex: PersonDetail["sex"];
    birth_date: string | null;
    birth_precision: DatePrecision | null;
    birth_place: string | null;
    death_date: string | null;
    death_precision: DatePrecision | null;
    death_place: string | null;
    deceased: boolean;
    status: string;
    is_demo: boolean;
    branch_id: string | null;
    origin_family: string | null;
  }>(
    `select p.*, bp.name as birth_place, dp.name as death_place
     from public.people p
     left join public.places_i18n bp on bp.place_id = p.birth_place_id and bp.locale = 'fr'
     left join public.places_i18n dp on dp.place_id = p.death_place_id and dp.locale = 'fr'
     where p.slug = $1`,
    [slug],
  );
  if (!p) return null;

  const texts = await q<{ locale: Locale } & Record<string, unknown>>(
    "select * from public.people_i18n where person_id = $1",
    [p.id],
  );
  const displayName = localizedField(texts, locale, "display_name");

  const branch = p.branch_id
    ? (
        await q<{ slug: string; color: string | null; id: string }>(
          "select id, slug, color from public.branches where id = $1",
          [p.branch_id],
        )
      )[0]
    : undefined;
  const branchNames = branch
    ? await q<{ locale: Locale; name: string }>(
        "select locale, name from public.branches_i18n where branch_id = $1",
        [branch.id],
      )
    : [];

  const [arms] = await q<{ id: string; builtin: string | null }>(
    `select id, builtin from public.arms
     where person_id = $1 or ($2::uuid is not null and branch_id = $2)
     order by (person_id = $1) desc nulls last limit 1`,
    [p.id, p.branch_id],
  );
  const armsNames = arms
    ? await q<{ locale: Locale; name: string }>(
        "select locale, name from public.arms_i18n where arms_id = $1",
        [arms.id],
      )
    : [];

  const titles = await q<{
    slug: string;
    title_id: string;
    rank: number | null;
    start_date: string | null;
    end_date: string | null;
  }>(
    `select t.slug, t.id as title_id, pt.rank, pt.start_date, pt.end_date
     from public.people_titles pt join public.titles t on t.id = pt.title_id
     where pt.person_id = $1 order by pt.start_date nulls last`,
    [p.id],
  );
  const titleNames = titles.length
    ? await q<{ title_id: string; locale: Locale; name: string }>(
        "select title_id, locale, name from public.titles_i18n where title_id = any($1::uuid[])",
        [titles.map((t) => t.title_id)],
      )
    : [];

  // Family, as the tree shows it.
  const links = await q<{
    kind: "parent" | "union";
    from_id: string;
    to_id: string | null;
    union_id: string | null;
    union_order: number | null;
    marriage_date: string | null;
    marriage_precision: DatePrecision | null;
    certainty: Certainty;
  }>("select * from public.tree_links()");
  const parentLinks = links.filter(
    (l) => l.kind === "parent" && l.to_id === p.id,
  );
  const childLinks = links.filter(
    (l) => l.kind === "parent" && l.from_id === p.id,
  );
  const unionLinks = links.filter(
    (l) => l.kind === "union" && (l.from_id === p.id || l.to_id === p.id),
  );
  const parentIds = new Set(parentLinks.map((l) => l.from_id));
  const siblingIds = new Set(
    links
      .filter(
        (l) =>
          l.kind === "parent" && parentIds.has(l.from_id) && l.to_id !== p.id,
      )
      .map((l) => l.to_id!),
  );
  const ids = [
    ...parentIds,
    ...siblingIds,
    ...childLinks.map((l) => l.to_id!),
    ...unionLinks
      .map((l) => (l.from_id === p.id ? l.to_id : l.from_id))
      .filter(Boolean),
  ] as string[];
  const relatives = ids.length
    ? await q<TreeRow>(
        "select * from public.tree_people() where id = any($1::uuid[])",
        [ids],
      )
    : [];
  const rel = (id: string, certainty?: Certainty) => {
    const row = relatives.find((r) => r.id === id);
    return row ? relative(row, certainty) : null;
  };
  const byBirth = (a: Relative, b: Relative) =>
    (a.years || "9999").localeCompare(b.years || "9999");

  const unionPlaces = unionLinks.length
    ? await q<{ id: string; place: string | null; origin: string | null }>(
        `select u.id, pl.name as place, null::text as origin
         from public.unions u
         left join public.places_i18n pl on pl.place_id = u.place_id and pl.locale = 'fr'
         where u.id = any($1::uuid[])`,
        [unionLinks.map((u) => u.union_id)],
      )
    : [];
  const partnerFamilies = await q<{ id: string; origin_family: string | null }>(
    "select id, origin_family from public.people where id = any($1::uuid[])",
    [
      unionLinks
        .map((l) => (l.from_id === p.id ? l.to_id : l.from_id))
        .filter(Boolean),
    ],
  );

  const unions = unionLinks
    .sort((a, b) => (a.union_order ?? 1) - (b.union_order ?? 1))
    .map((u) => {
      const partnerId = u.from_id === p.id ? u.to_id : u.from_id;
      return {
        id: u.union_id!,
        order: u.union_order ?? 1,
        partner: partnerId ? rel(partnerId) : null,
        partnerFamily:
          partnerFamilies.find((f) => f.id === partnerId)?.origin_family ??
          null,
        marriage:
          u.marriage_date && u.marriage_precision
            ? {
                date: u.marriage_date,
                precision: u.marriage_precision,
                place:
                  unionPlaces.find((x) => x.id === u.union_id)?.place ?? null,
              }
            : null,
        certainty: u.certainty,
        children: childLinks
          .filter((c) => c.union_id === u.union_id)
          .map((c) => rel(c.to_id!, c.certainty))
          .filter((r): r is Relative => Boolean(r))
          .sort(byBirth),
      };
    });

  const inUnion = new Set(unions.flatMap((u) => u.children.map((c) => c.id)));

  const photos = await q<{
    id: string;
    path: string;
    width: number | null;
    height: number | null;
    caption: string | null;
  }>(
    `select m.id, m.storage_path as path, m.width, m.height,
            (select caption from public.media_i18n i where i.media_id = m.id
             order by (i.locale = $2) desc, (i.locale = 'fr') desc limit 1) as caption
     from public.media_people mp join public.media m on m.id = mp.media_id
     where mp.person_id = $1 and m.status = 'published' and m.kind <> 'arms'
     order by (m.id = (select portrait_id from public.people where id = $1)) desc,
              m.taken_date nulls last`,
    [p.id, locale],
  );

  const stories = await q<{ id: string; slug: string }>(
    `select s.id, s.slug from public.story_people sp join public.stories s on s.id = sp.story_id
     where sp.person_id = $1 and s.status = 'published' order by s.era_start nulls last`,
    [p.id],
  );
  const storyTexts = stories.length
    ? await q<{
        story_id: string;
        locale: Locale;
        title: string;
        excerpt: string | null;
      }>(
        "select story_id, locale, title, excerpt from public.stories_i18n where story_id = any($1::uuid[])",
        [stories.map((s) => s.id)],
      )
    : [];

  const places = await q<{ slug: string; name: string; role: string | null }>(
    `select pl.slug, pn.name, pp.role from public.place_people pp
     join public.places pl on pl.id = pp.place_id
     join public.places_i18n pn on pn.place_id = pl.id and pn.locale = 'fr'
     where pp.person_id = $1`,
    [p.id],
  );

  const events = await q<{
    id: string;
    slug: string;
    event_date: string | null;
    place: string | null;
  }>(
    `select e.id, e.slug, e.event_date, pn.name as place from public.event_people ep
     join public.events e on e.id = ep.event_id
     left join public.places_i18n pn on pn.place_id = e.place_id and pn.locale = 'fr'
     where ep.person_id = $1 order by e.event_date nulls last`,
    [p.id],
  );
  const eventTexts = events.length
    ? await q<{ event_id: string; locale: Locale; title: string }>(
        "select event_id, locale, title from public.events_i18n where event_id = any($1::uuid[])",
        [events.map((e) => e.id)],
      )
    : [];

  const sources = await q<Source>(
    `select ${SOURCE_COLUMNS}, ps.note from public.person_sources ps
     join public.sources s on s.id = ps.source_id where ps.person_id = $1`,
    [p.id],
  );
  const filiation = await q<Source & { parent_id: string }>(
    `select ${SOURCE_COLUMNS}, fs.note, fs.parent_id from public.filiation_sources fs
     join public.sources s on s.id = fs.source_id where fs.child_id = $1`,
    [p.id],
  );
  const filiationSources: Record<string, Source[]> = {};
  for (const { parent_id, ...source } of filiation) {
    (filiationSources[parent_id] ??= []).push(source);
  }

  return {
    id: p.id,
    slug: p.slug,
    name: displayName?.text ?? personName(p),
    givenNames: p.given_names,
    surname: p.surname,
    epithet: p.epithet,
    sex: p.sex,
    birth:
      p.birth_date && p.birth_precision
        ? {
            date: p.birth_date,
            precision: p.birth_precision,
            place: p.birth_place,
          }
        : null,
    death:
      p.death_date && p.death_precision
        ? {
            date: p.death_date,
            precision: p.death_precision,
            place: p.death_place,
          }
        : null,
    deceased: p.deceased,
    living: isLiving(p),
    status: p.status,
    isDemo: p.is_demo,
    branch: branch
      ? {
          slug: branch.slug,
          color: branch.color,
          name: pick(branchNames, locale)?.name ?? branch.slug,
        }
      : null,
    arms: arms
      ? { builtin: arms.builtin, name: pick(armsNames, locale)?.name ?? null }
      : null,
    originFamily: p.origin_family,
    biography: localizedField(texts, locale, "biography"),
    roles: localizedField(texts, locale, "roles"),
    works: localizedField(texts, locale, "works"),
    titles: titles.map((t) => ({
      slug: t.slug,
      name:
        pick(
          titleNames.filter((n) => n.title_id === t.title_id),
          locale,
        )?.name ?? t.slug,
      rank: t.rank,
      from: t.start_date ? Number(t.start_date.slice(0, 4)) : null,
      to: t.end_date ? Number(t.end_date.slice(0, 4)) : null,
    })),
    parents: parentLinks
      .map((l) => rel(l.from_id, l.certainty))
      .filter((r): r is Relative => Boolean(r)),
    siblings: [...siblingIds]
      .map((id) => rel(id))
      .filter((r): r is Relative => Boolean(r))
      .sort(byBirth),
    unions,
    otherChildren: childLinks
      .filter((c) => !inUnion.has(c.to_id!))
      .map((c) => rel(c.to_id!, c.certainty))
      .filter((r): r is Relative => Boolean(r))
      .sort(byBirth),
    stories: stories.map((s) => {
      const text = pick(
        storyTexts.filter((t) => t.story_id === s.id),
        locale,
      );
      return {
        slug: s.slug,
        title: text?.title ?? s.slug,
        excerpt: text?.excerpt ?? null,
      };
    }),
    photos: photos.map((m) => ({
      id: m.id,
      url: `/fichiers/${m.path}`,
      caption: m.caption,
      width: m.width,
      height: m.height,
    })),
    places,
    events: events.map((e) => ({
      slug: e.slug,
      title:
        pick(
          eventTexts.filter((t) => t.event_id === e.id),
          locale,
        )?.title ?? e.slug,
      year: e.event_date ? Number(e.event_date.slice(0, 4)) : null,
      place: e.place,
    })),
    sources,
    filiationSources,
  };
}

/** A person's page as `viewer` may see it, or null. */
export const loadPerson = cache(
  async (
    viewer: Viewer,
    slug: string,
    locale: Locale,
  ): Promise<PersonDetail | null> => {
    if (!hasDatabase() || !/^[a-z0-9-]{1,120}$/.test(slug)) return null;
    return withViewer(viewer, (q) => detail(q, slug, locale));
  },
);

/** Every person visitors can see, for building their pages in advance. */
export async function publicSlugs(): Promise<string[]> {
  if (!hasDatabase()) return [];
  const rows = await withViewer({ kind: "visitor" }, (q) =>
    q<{ slug: string }>("select slug from public.people"),
  ).catch(() => []);
  return rows.map((r) => r.slug);
}

import "server-only";
import { cache } from "react";
import {
  hasDatabase,
  VISITOR,
  withViewer,
  type Query,
  type Viewer,
} from "@/lib/db";
import type { DatePrecision } from "@/lib/genealogie/dates";
import { lifespanYears, personName } from "@/lib/genealogie/names";
import type { Locale } from "@/lib/i18n/routing";
import { slugify, uniqueSlug } from "@/lib/slug";
import { typeset } from "@/lib/typography";
import type {
  BranchOption,
  EventKind,
  LinkedPerson,
  LinkedStory,
  Localized,
  MapPlace,
  PlaceDetail,
  PlaceKind,
  PlacePhoto,
  PlacesIndex,
  TimelineEvent,
} from "./place-types";

export type * from "./place-types";

/**
 * Places and events (cahier des charges, 6.6), read under the viewer's rules:
 * an event that involves a living person, and the living people linked to a
 * place, are for members only.
 */

type Texts = { id: string; locale: Locale; [field: string]: unknown };

function localized(
  rows: Texts[],
  id: string,
  field: string,
  locale: Locale,
): Localized | null {
  const own = rows.filter((r) => r.id === id);
  for (const l of [locale, "fr" as const, ...own.map((r) => r.locale)]) {
    const value = own.find((r) => r.locale === l)?.[field];
    if (typeof value === "string" && value.trim())
      return { text: typeset(value.trim(), l), lang: l };
  }
  return null;
}

function summaryOf(text: Localized | null): Localized | null {
  if (!text) return null;
  const flat = text.text.replace(/\s+/g, " ").trim();
  if (flat.length <= 200) return { ...text, text: flat };
  return { ...text, text: `${flat.slice(0, 190).replace(/\s+\S*$/, "")}…` };
}

type PersonRow = {
  owner: string;
  slug: string;
  given_names: string | null;
  surname: string | null;
  epithet: string | null;
  birth_date: string | null;
  birth_precision: DatePrecision | null;
  death_date: string | null;
  death_precision: DatePrecision | null;
  deceased: boolean | null;
  branch_id: string | null;
  role: string | null;
  rank: number;
};

const PERSON_COLUMNS = `p.slug, p.given_names, p.surname, p.epithet, p.birth_date, p.birth_precision,
  p.death_date, p.death_precision, p.deceased, p.branch_id`;

const linkedPerson = (p: PersonRow): LinkedPerson => ({
  slug: p.slug,
  name: personName(p),
  years: lifespanYears(p),
});

/** People of a place: linked by hand first, then born, then died there. */
async function placePeople(q: Query, ids: string[]) {
  return q<PersonRow>(
    `select x.place_id as owner, x.role, x.rank, ${PERSON_COLUMNS}
     from (
       select place_id, person_id, role, 0 as rank from public.place_people where place_id = any($1)
       union all
       select birth_place_id, id, null, 1 from public.people where birth_place_id = any($1)
       union all
       select death_place_id, id, null, 2 from public.people where death_place_id = any($1)
     ) x
     join public.people p on p.id = x.person_id
     where p.status = 'published'
     order by x.rank, p.birth_date nulls last, p.surname, p.given_names`,
    [ids],
  );
}

async function linkedStories(
  q: Query,
  table: "story_places" | "story_events",
  key: "place_id" | "event_id",
  ids: string[],
  locale: Locale,
) {
  const rows = await q<{
    owner: string;
    id: string;
    slug: string;
    original_locale: Locale;
  }>(
    `select l.${key} as owner, s.id, s.slug, s.original_locale
     from public.${table} l join public.stories s on s.id = l.story_id
     where l.${key} = any($1) and s.status = 'published'
     order by s.published_at desc nulls last`,
    [ids],
  );
  if (!rows.length) return new Map<string, LinkedStory[]>();
  const texts = await q<Texts>(
    "select story_id as id, locale, title from public.stories_i18n where story_id = any($1)",
    [[...new Set(rows.map((r) => r.id))]],
  );
  const map = new Map<string, LinkedStory[]>();
  for (const r of rows) {
    const title = localized(texts, r.id, "title", locale) ??
      localized(texts, r.id, "title", r.original_locale) ?? {
        text: r.slug,
        lang: r.original_locale,
      };
    map.set(r.owner, [...(map.get(r.owner) ?? []), { slug: r.slug, title }]);
  }
  return map;
}

async function photosOf(
  q: Query,
  ids: string[],
  locale: Locale,
  firstOnly: boolean,
): Promise<Map<string, PlacePhoto[]>> {
  const rows = await q<{
    id: string;
    place_id: string;
    storage_path: string;
    width: number | null;
    height: number | null;
  }>(
    `select ${firstOnly ? "distinct on (m.place_id)" : ""} m.id, m.place_id, m.storage_path, m.width, m.height
     from public.media m
     where m.place_id = any($1) and m.status = 'published'
       and m.kind <> 'arms' and m.mime_type like 'image/%'
     order by m.place_id, (m.kind = 'photo') desc, m.taken_date nulls last, m.created_at`,
    [ids],
  );
  if (!rows.length) return new Map();
  const captions = await q<Texts>(
    "select media_id as id, locale, caption from public.media_i18n where media_id = any($1)",
    [rows.map((r) => r.id)],
  );
  const map = new Map<string, PlacePhoto[]>();
  for (const r of rows) {
    const photo: PlacePhoto = {
      id: r.id,
      path: r.storage_path,
      width: r.width,
      height: r.height,
      caption: localized(captions, r.id, "caption", locale),
    };
    map.set(r.place_id, [...(map.get(r.place_id) ?? []), photo]);
  }
  return map;
}

type PlaceRow = {
  id: string;
  slug: string;
  kind: PlaceKind;
  lat: number | null;
  lng: number | null;
  country_code: string | null;
  period_start: number | null;
  period_end: number | null;
  visitable: boolean;
  is_demo: boolean;
};

async function placesWhere(
  q: Query,
  locale: Locale,
  where: string,
  params: unknown[] = [],
) {
  const rows = await q<PlaceRow>(
    `select id, slug, kind, lat, lng, country_code, period_start, period_end, visitable, is_demo
     from public.places p
     where p.status = 'published' and ${where}`,
    params,
  );
  if (!rows.length) return { places: [] as MapPlace[], texts: [] as Texts[] };
  const ids = rows.map((r) => r.id);
  const texts = await q<Texts>(
    "select place_id as id, locale, name, description, visit_info from public.places_i18n where place_id = any($1)",
    [ids],
  );
  const people = await placePeople(q, ids);
  const stories = await linkedStories(
    q,
    "story_places",
    "place_id",
    ids,
    locale,
  );
  const photos = await photosOf(q, ids, locale, true);
  const collator = new Intl.Collator(locale);
  const places = rows.map((r): MapPlace => {
    const seen = new Set<string>();
    const own = people
      .filter((p) => p.owner === r.id)
      .filter((p) => !seen.has(p.slug) && seen.add(p.slug));
    return {
      id: r.id,
      slug: r.slug,
      name: localized(texts, r.id, "name", locale) ?? {
        text: r.slug,
        lang: "fr",
      },
      kind: r.kind,
      lat: r.lat,
      lng: r.lng,
      country: r.country_code,
      periodStart: r.period_start,
      periodEnd: r.period_end,
      visitable: r.visitable,
      summary: summaryOf(localized(texts, r.id, "description", locale)),
      photo: photos.get(r.id)?.[0] ?? null,
      people: own.slice(0, 8).map(linkedPerson),
      stories: (stories.get(r.id) ?? []).slice(0, 4),
      isDemo: r.is_demo,
    };
  });
  places.sort((a, b) => collator.compare(a.name.text, b.name.text));
  return { places, texts };
}

async function eventsWhere(
  q: Query,
  locale: Locale,
  where: string,
  params: unknown[] = [],
): Promise<TimelineEvent[]> {
  const rows = await q<{
    id: string;
    slug: string;
    kind: EventKind;
    event_date: string | null;
    event_precision: DatePrecision | null;
    place_id: string | null;
    branch_id: string | null;
    is_demo: boolean;
  }>(
    `select e.id, e.slug, e.kind, e.event_date::text, e.event_precision, e.place_id, e.branch_id, e.is_demo
     from public.events e
     where e.status = 'published' and ${where}
     order by e.event_date nulls last, e.created_at`,
    params,
  );
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const texts = await q<Texts>(
    "select event_id as id, locale, title, description from public.events_i18n where event_id = any($1)",
    [ids],
  );
  const people = await q<PersonRow>(
    `select ep.event_id as owner, ep.role, 0 as rank, ${PERSON_COLUMNS}
     from public.event_people ep join public.people p on p.id = ep.person_id
     where ep.event_id = any($1) and p.status = 'published'
     order by p.birth_date nulls last`,
    [ids],
  );
  const stories = await linkedStories(
    q,
    "story_events",
    "event_id",
    ids,
    locale,
  );
  return rows.map((r) => {
    const own = people.filter((p) => p.owner === r.id);
    const branches = new Set<string>();
    if (r.branch_id) branches.add(r.branch_id);
    for (const p of own) if (p.branch_id) branches.add(p.branch_id);
    const date =
      r.event_date && r.event_precision
        ? { date: r.event_date.slice(0, 10), precision: r.event_precision }
        : null;
    return {
      id: r.id,
      slug: r.slug,
      kind: r.kind,
      title: localized(texts, r.id, "title", locale) ?? {
        text: r.slug,
        lang: "fr",
      },
      description: localized(texts, r.id, "description", locale),
      date,
      year: date ? Number(date.date.slice(0, 4)) : null,
      placeId: r.place_id,
      branchIds: [...branches],
      people: own.map(linkedPerson),
      stories: stories.get(r.id) ?? [],
      isDemo: r.is_demo,
    };
  });
}

async function branchOptions(
  q: Query,
  locale: Locale,
): Promise<BranchOption[]> {
  return q<BranchOption>(
    `select b.id, b.color,
       coalesce((select name from public.branches_i18n bi where bi.branch_id = b.id
                 order by (bi.locale = $1) desc, (bi.locale = 'fr') desc limit 1), b.slug) as name
     from public.branches b where b.status = 'published'
     order by b.sort_order, b.slug`,
    [locale],
  );
}

const EMPTY: PlacesIndex = { places: [], events: [], branches: [] };

/** The map and the timeline: every place and event the viewer may see. */
export const loadPlacesIndex = cache(
  async (viewer: Viewer, locale: Locale): Promise<PlacesIndex> => {
    if (!hasDatabase()) return EMPTY;
    return withViewer(viewer, async (q) => {
      const { places } = await placesWhere(q, locale, "true");
      const events = await eventsWhere(q, locale, "true");
      const branches = await branchOptions(q, locale);
      const used = new Set(events.flatMap((e) => e.branchIds));
      return {
        places,
        events,
        branches: branches.filter((b) => used.has(b.id)),
      };
    });
  },
);

/** One place with everything linked to it. */
export const loadPlace = cache(
  async (
    viewer: Viewer,
    slug: string,
    locale: Locale,
  ): Promise<PlaceDetail | null> => {
    if (!hasDatabase() || !/^[a-z0-9-]{1,120}$/.test(slug)) return null;
    return withViewer(viewer, async (q) => {
      const { places, texts } = await placesWhere(q, locale, "p.slug = $1", [
        slug,
      ]);
      const place = places[0];
      if (!place) return null;
      const people = await placePeople(q, [place.id]);
      const photos = await photosOf(q, [place.id], locale, false);
      const stories = await linkedStories(
        q,
        "story_places",
        "place_id",
        [place.id],
        locale,
      );
      const byRank = (rank: number) =>
        people.filter((p) => p.rank === rank).map(linkedPerson);
      return {
        ...place,
        stories: stories.get(place.id) ?? [],
        description: localized(texts, place.id, "description", locale),
        visitInfo: localized(texts, place.id, "visit_info", locale),
        photos: photos.get(place.id) ?? [],
        linked: people
          .filter((p) => p.rank === 0)
          .map((p) => ({ ...linkedPerson(p), role: p.role })),
        born: byRank(1),
        died: byRank(2),
        events: await eventsWhere(q, locale, "e.place_id = $1", [place.id]),
      };
    });
  },
);

/** Places the public may see, for the pages built in advance. */
export async function publicPlaceSlugs(): Promise<string[]> {
  if (!hasDatabase()) return [];
  return withViewer(VISITOR, async (q) =>
    (
      await q<{ slug: string }>(
        "select slug from public.places where status = 'published'",
      )
    ).map((r) => r.slug),
  );
}
/**
 * The place with this French name, created if needed (without coordinates:
 * it can be placed on the map later from the dashboard).
 */
export async function findOrCreatePlace(
  q: Query,
  name: string,
  isDemo = false,
): Promise<string | null> {
  const clean = name.trim().replace(/\s+/g, " ");
  if (!clean) return null;
  const [existing] = await q<{ place_id: string }>(
    `select place_id from public.places_i18n
     where locale = 'fr' and lower(name) = lower($1) limit 1`,
    [clean],
  );
  if (existing) return existing.place_id;

  const slug = await uniqueSlug(slugify(clean), async (s) =>
    Boolean(
      (await q("select 1 from public.places where slug = $1", [s])).length,
    ),
  );
  const [place] = await q<{ id: string }>(
    `insert into public.places (slug, status, is_demo) values ($1, 'published', $2) returning id`,
    [slug, isDemo],
  );
  await q(
    `insert into public.places_i18n (place_id, locale, name) values ($1, 'fr', $2)`,
    [place.id, clean],
  );
  return place.id;
}

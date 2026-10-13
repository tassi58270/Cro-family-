import "server-only";
import { cache } from "react";
import { hasDatabase, withViewer, type Query, type Viewer } from "@/lib/db";
import type { DatePrecision } from "@/lib/genealogie/dates";
import { lifespanYears, personName } from "@/lib/genealogie/names";
import type { Locale } from "@/lib/i18n/routing";
import { typeset } from "@/lib/typography";
import type { Localized } from "./home";
import type { StoryCard, StoryDetail, Theme } from "./story-types";

export type { StoryCard, StoryDetail, StoryPerson, Theme } from "./story-types";

/**
 * Stories (cahier des charges, 6.4): the magazine page, the reading page and
 * what links them to people, places and events. Read under the viewer's
 * access rules: a story about a living person is for members only.
 */

type Row = {
  id: string;
  slug: string;
  era_start: number | null;
  era_end: number | null;
  author_name: string | null;
  anonymous: boolean;
  source: string | null;
  themes: Theme[];
  original_locale: Locale;
  featured: boolean;
  cover_path: string | null;
  cover_width: number | null;
  cover_height: number | null;
  published_at: string | null;
  status: string;
  is_demo: boolean;
};

function localized(
  rows: { locale: Locale; value: string | null }[],
  locale: Locale,
  original: Locale,
): Localized | null {
  for (const l of [locale, original, "fr" as const]) {
    const value = rows.find((r) => r.locale === l)?.value;
    if (value?.trim()) return { text: typeset(value, l), lang: l };
  }
  return null;
}

/** Excerpt written by the author, or the beginning of the story. */
function excerptOf(
  excerpt: Localized | null,
  body: Localized | null,
): Localized | null {
  if (excerpt) return excerpt;
  if (!body) return null;
  const text = body.text.replace(/\s+/g, " ").trim();
  if (text.length <= 220) return { ...body, text };
  return { ...body, text: `${text.slice(0, 210).replace(/\s+\S*$/, "")}…` };
}

async function cards(
  q: Query,
  locale: Locale,
  where: string,
  params: unknown[] = [],
) {
  const rows = await q<Row>(
    `select s.id, s.slug, s.era_start, s.era_end, s.author_name, s.anonymous, s.source, s.themes::text[] as themes,
            s.original_locale, s.featured, m.storage_path as cover_path, m.width as cover_width,
            m.height as cover_height, s.published_at, s.status, s.is_demo
     from public.stories s left join public.media m on m.id = s.cover_id
     where not s.anecdote and ${where}
     order by s.featured desc, s.published_at desc nulls last, s.created_at desc`,
    params,
  );
  if (!rows.length)
    return { rows, cards: [] as (StoryCard & { id: string })[], texts: [] };
  const ids = rows.map((r) => r.id);
  const texts = await q<{
    story_id: string;
    locale: Locale;
    title: string;
    excerpt: string | null;
    body: string | null;
  }>(
    "select story_id, locale, title, excerpt, body from public.stories_i18n where story_id = any($1)",
    [ids],
  );
  const people = await q<{
    story_id: string;
    slug: string;
    given_names: string | null;
    surname: string | null;
    epithet: string | null;
    birth_date: string | null;
    birth_precision: DatePrecision | null;
    death_date: string | null;
    death_precision: DatePrecision | null;
    deceased: boolean | null;
    branch_slug: string | null;
    branch_name: string | null;
  }>(
    `select sp.story_id, p.slug, p.given_names, p.surname, p.epithet, p.birth_date, p.birth_precision,
            p.death_date, p.death_precision, p.deceased, b.slug as branch_slug,
            (select name from public.branches_i18n bi where bi.branch_id = b.id
             order by (bi.locale = $2) desc, (bi.locale = 'fr') desc limit 1) as branch_name
     from public.story_people sp
     join public.people p on p.id = sp.person_id
     left join public.branches b on b.id = p.branch_id
     where sp.story_id = any($1)
     order by p.birth_date nulls last`,
    [ids, locale],
  );
  const captions = await q<{
    media_id: string;
    locale: Locale;
    caption: string | null;
  }>(
    `select mi.media_id, mi.locale, mi.caption from public.media_i18n mi
     join public.stories s on s.cover_id = mi.media_id where s.id = any($1)`,
    [ids],
  );

  const result = rows.map((r) => {
    const own = texts.filter((t) => t.story_id === r.id);
    const pick = (field: "title" | "excerpt" | "body") =>
      localized(
        own.map((t) => ({ locale: t.locale, value: t[field] })),
        locale,
        r.original_locale,
      );
    const title = pick("title") ?? { text: r.slug, lang: r.original_locale };
    return {
      id: r.id,
      slug: r.slug,
      title,
      excerpt: excerptOf(pick("excerpt"), pick("body")),
      eraStart: r.era_start,
      eraEnd: r.era_end,
      themes: r.themes,
      originalLocale: r.original_locale,
      featured: r.featured,
      cover: r.cover_path
        ? {
            url: `/fichiers/${r.cover_path}`,
            width: r.cover_width,
            height: r.cover_height,
            alt:
              captions.find((c) => c.locale === locale)?.caption ?? title.text,
          }
        : null,
      people: people
        .filter((p) => p.story_id === r.id)
        .map((p) => ({
          slug: p.slug,
          name: personName(p),
          years: lifespanYears(p),
          branch: p.branch_slug,
          branchName: p.branch_name,
        })),
      author: r.anonymous ? null : r.author_name,
      publishedAt: r.published_at,
      isDemo: r.is_demo,
    };
  });
  return { rows, cards: result, texts };
}

function withoutId<T extends { id: string }>(item: T): Omit<T, "id"> {
  const copy: Partial<T> = { ...item };
  delete copy.id;
  return copy as Omit<T, "id">;
}

/** Every published story the viewer may read, the featured one first. */
export const loadStories = cache(
  async (viewer: Viewer, locale: Locale): Promise<StoryCard[]> => {
    if (!hasDatabase()) return [];
    return withViewer(viewer, async (q) => {
      const { cards: list } = await cards(q, locale, "s.status = 'published'");
      return list.map(withoutId);
    });
  },
);

/** One story with its links and three neighbours (same people, then same era). */
export const loadStory = cache(
  async (
    viewer: Viewer,
    slug: string,
    locale: Locale,
  ): Promise<StoryDetail | null> => {
    if (!hasDatabase() || !/^[a-z0-9-]{1,120}$/.test(slug)) return null;
    return withViewer(viewer, async (q) => {
      const {
        rows,
        cards: found,
        texts,
      } = await cards(q, locale, "s.slug = $1", [slug]);
      const story = found[0];
      if (!story) return null;
      const row = rows[0];
      const body = localized(
        texts.map((t) => ({ locale: t.locale, value: t.body })),
        locale,
        row.original_locale,
      );
      const places = await q<{ slug: string; name: string }>(
        `select p.slug, (select name from public.places_i18n pi where pi.place_id = p.id
                         order by (pi.locale = $2) desc, (pi.locale = 'fr') desc limit 1) as name
         from public.story_places sp join public.places p on p.id = sp.place_id
         where sp.story_id = $1`,
        [story.id, locale],
      );
      const events = await q<{
        slug: string;
        title: string;
        event_date: string | null;
      }>(
        `select e.slug, e.event_date,
                (select title from public.events_i18n ei where ei.event_id = e.id
                 order by (ei.locale = $2) desc, (ei.locale = 'fr') desc limit 1) as title
         from public.story_events se join public.events e on e.id = se.event_id
         where se.story_id = $1 order by e.event_date nulls last`,
        [story.id, locale],
      );
      const photos = await q<{
        id: string;
        path: string;
        caption: string | null;
        width: number | null;
        height: number | null;
      }>(
        `select m.id, m.storage_path as path, m.width, m.height,
                (select caption from public.media_i18n i where i.media_id = m.id
                 order by (i.locale = $2) desc, (i.locale = 'fr') desc limit 1) as caption
         from public.story_media sm join public.media m on m.id = sm.media_id
         where sm.story_id = $1 and m.status = 'published' order by sm.position`,
        [story.id, locale],
      );
      const { cards: others } = await cards(
        q,
        locale,
        "s.status = 'published' and s.id <> $1",
        [story.id],
      );
      const shared = (c: StoryCard) =>
        c.people.filter((p) => story.people.some((x) => x.slug === p.slug))
          .length;
      const gap = (c: StoryCard) =>
        story.eraStart !== null && c.eraStart !== null
          ? Math.abs(story.eraStart - c.eraStart)
          : 9999;
      const neighbours = others
        .sort((a, b) => shared(b) - shared(a) || gap(a) - gap(b))
        .slice(0, 3)
        .map(withoutId);
      const card = withoutId(story);
      return {
        ...card,
        body,
        source: row.source,
        places: places.filter((p) => p.name),
        events: events.map((e) => ({
          slug: e.slug,
          title: e.title ?? e.slug,
          year: e.event_date ? Number(e.event_date.slice(0, 4)) : null,
        })),
        neighbours,
        photos: photos.map((m) => ({
          id: m.id,
          url: `/fichiers/${m.path}`,
          caption: m.caption,
          width: m.width,
          height: m.height,
        })),
        status: row.status,
      };
    });
  },
);

/** Stories the public may read, built in advance. */
export async function publicStorySlugs(): Promise<string[]> {
  if (!hasDatabase()) return [];
  const rows = await withViewer({ kind: "visitor" }, (q) =>
    q<{ slug: string }>(
      "select slug from public.stories where status = 'published' and not anecdote",
    ),
  ).catch(() => []);
  return rows.map((r) => r.slug);
}

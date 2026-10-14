import "server-only";
import { hasDatabase, VISITOR, withViewer, type Query } from "@/lib/db";
import type { DatePrecision } from "@/lib/genealogie/dates";
import { lifespanYears, personName } from "@/lib/genealogie/names";
import type { Locale } from "@/lib/i18n/routing";
import { typeset } from "@/lib/typography";

/** A text in the visitor's language, or the French one when missing. */
export type Localized = { text: string; lang: Locale };

export type HomeFigure = { id: string; value: number; label: Localized };

export type HomeChapter = {
  id: string;
  prologue: boolean;
  dateLabel: Localized | null;
  title: Localized;
  body: Localized | null;
  eraStart: number | null;
  eraEnd: number | null;
  /** Map target: [longitude, latitude], or null for the whole of Europe. */
  point: [number, number] | null;
  zoom: number;
  placeName: string | null;
};

export type TitleHolder = {
  name: string;
  slug: string | null;
  rank: number | null;
  years: string;
};

export type TitleCard = {
  id: string;
  slug: string;
  name: Localized;
  year: number | null;
  creator: string | null;
  branch: string | null;
  holders: TitleHolder[];
};

export type Anecdote = {
  id: string;
  slug: string;
  featured: boolean;
  title: Localized;
  excerpt: Localized | null;
};

export type HomeData = {
  tagline: Localized | null;
  pronunciation: Localized | null;
  summary: Localized | null;
  figures: HomeFigure[];
  chapters: HomeChapter[];
  titles: TitleCard[];
  anecdotes: Anecdote[];
  counts: Record<string, number>;
  mapPoints: [number, number][];
};

type Row = Record<string, unknown> & { locale: Locale };

/** Picks the row for the language, then French, then any. */
function pick<T extends Row>(rows: T[], locale: Locale): T | undefined {
  return (
    rows.find((r) => r.locale === locale) ??
    rows.find((r) => r.locale === "fr") ??
    rows[0]
  );
}

function localized(row: Row | undefined, field: string): Localized | null {
  const text = row?.[field];
  return typeof text === "string" && text.trim()
    ? { text: typeset(text, row!.locale), lang: row!.locale }
    : null;
}

/** For a field whose value may be empty in one language: fall back field by field. */
function field(rows: Row[], locale: Locale, name: string): Localized | null {
  return (
    localized(
      rows.find((r) => r.locale === locale),
      name,
    ) ??
    localized(
      rows.find((r) => r.locale === "fr"),
      name,
    )
  );
}

const EMPTY: HomeData = {
  tagline: null,
  pronunciation: null,
  summary: null,
  figures: [],
  chapters: [],
  titles: [],
  anecdotes: [],
  counts: {},
  mapPoints: [],
};

export async function loadHome(locale: Locale): Promise<HomeData> {
  if (!hasDatabase()) return EMPTY;
  return withViewer(VISITOR, (q) => home(q, locale)).catch((error) => {
    console.error(error);
    return EMPTY;
  });
}

async function home(q: Query, locale: Locale): Promise<HomeData> {
  const texts = await q<Row>("select * from public.home_i18n");
  const [{ counts }] = await q<{ counts: Record<string, number> }>(
    "select public.home_counts() as counts",
  );

  const figureRows = await q<{
    id: string;
    value: number | null;
    auto: string | null;
  }>(
    "select id, value, auto from public.home_figures order by sort_order, created_at",
  );
  const figureTexts = await q<Row & { figure_id: string }>(
    "select * from public.home_figures_i18n",
  );
  const figures = figureRows.flatMap((f) => {
    const label = localized(
      pick(
        figureTexts.filter((t) => t.figure_id === f.id),
        locale,
      ),
      "label",
    );
    const value = f.auto ? (counts[f.auto] ?? 0) : (f.value ?? 0);
    // A computed figure still at zero says nothing yet: it waits.
    if (!label || (f.auto && value === 0)) return [];
    return [{ id: f.id, value, label }];
  });

  const chapterRows = await q<{
    id: string;
    prologue: boolean;
    era_start: number | null;
    era_end: number | null;
    lat: number | null;
    lng: number | null;
    place_lat: number | null;
    place_lng: number | null;
    place_name: string | null;
    zoom: number;
  }>(
    `select c.id, c.prologue, c.era_start, c.era_end, c.lat, c.lng, c.zoom,
            p.lat as place_lat, p.lng as place_lng, pn.name as place_name
     from public.home_chapters c
     left join public.places p on p.id = c.place_id
     left join public.places_i18n pn on pn.place_id = p.id and pn.locale = 'fr'
     order by c.prologue desc, c.sort_order, c.created_at`,
  );
  const chapterTexts = await q<Row & { chapter_id: string }>(
    "select * from public.home_chapters_i18n",
  );
  const chapters = chapterRows.flatMap((c) => {
    const rows = chapterTexts.filter((t) => t.chapter_id === c.id);
    const title = field(rows, locale, "title");
    if (!title) return [];
    const lat = c.lat ?? c.place_lat;
    const lng = c.lng ?? c.place_lng;
    return [
      {
        id: c.id,
        prologue: c.prologue,
        dateLabel: field(rows, locale, "date_label"),
        title,
        body: field(rows, locale, "body"),
        eraStart: c.era_start,
        eraEnd: c.era_end,
        point:
          lat != null && lng != null ? ([lng, lat] as [number, number]) : null,
        zoom: c.zoom,
        placeName: c.place_name,
      },
    ];
  });

  const titleRows = await q<{
    id: string;
    slug: string;
    created_date: string | null;
    creator: string | null;
    branch_id: string | null;
  }>(
    `select id, slug, created_date, creator, branch_id from public.titles
     order by created_date nulls last, sort_order`,
  );
  const titleTexts = await q<Row & { title_id: string }>(
    "select * from public.titles_i18n",
  );
  const branchTexts = await q<Row & { branch_id: string }>(
    "select * from public.branches_i18n",
  );
  const holderRows = await q<{
    title_id: string;
    rank: number | null;
    slug: string;
    given_names: string | null;
    surname: string | null;
    epithet: string | null;
    birth_date: string | null;
    birth_precision: DatePrecision | null;
    death_date: string | null;
    death_precision: DatePrecision | null;
    deceased: boolean;
  }>(
    `select pt.title_id, pt.rank, p.slug, p.given_names, p.surname, p.epithet,
            p.birth_date, p.birth_precision, p.death_date, p.death_precision, p.deceased
     from public.people_titles pt
     join public.people p on p.id = pt.person_id
     order by pt.rank nulls last, pt.start_date nulls last`,
  );
  const titles = titleRows.flatMap((t) => {
    const name = field(
      titleTexts.filter((x) => x.title_id === t.id),
      locale,
      "name",
    );
    if (!name) return [];
    return [
      {
        id: t.id,
        slug: t.slug,
        name,
        year: t.created_date ? Number(t.created_date.slice(0, 4)) : null,
        creator: t.creator,
        branch: t.branch_id
          ? (field(
              branchTexts.filter((b) => b.branch_id === t.branch_id),
              locale,
              "name",
            )?.text ?? null)
          : null,
        holders: holderRows
          .filter((h) => h.title_id === t.id)
          .map((h) => ({
            name: personName(h),
            slug: h.slug,
            rank: h.rank,
            years: lifespanYears(h),
          })),
      },
    ];
  });

  const anecdoteRows = await q<{ id: string; slug: string; featured: boolean }>(
    `select id, slug, featured from public.stories where anecdote and status = 'published'
     order by featured desc, published_at desc nulls last limit 24`,
  );
  const anecdoteTexts = anecdoteRows.length
    ? await q<Row & { story_id: string }>(
        "select * from public.stories_i18n where story_id = any($1::uuid[])",
        [anecdoteRows.map((a) => a.id)],
      )
    : [];
  const anecdotes = anecdoteRows.flatMap((a) => {
    const rows = anecdoteTexts.filter((t) => t.story_id === a.id);
    const title = field(rows, locale, "title");
    if (!title) return [];
    return [
      {
        id: a.id,
        slug: a.slug,
        featured: a.featured,
        title,
        excerpt: field(rows, locale, "excerpt") ?? field(rows, locale, "body"),
      },
    ];
  });

  const points = await q<{ lng: number; lat: number }>(
    `select lng, lat from public.places where lat is not null limit 40`,
  );

  return {
    tagline: field(texts, locale, "tagline"),
    pronunciation: field(texts, locale, "pronunciation"),
    summary: field(texts, locale, "summary"),
    figures,
    chapters,
    titles,
    anecdotes,
    counts,
    mapPoints: points.map((p) => [p.lng, p.lat]),
  };
}

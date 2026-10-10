import "server-only";
import type { Query } from "@/lib/db";
import type { Locale } from "@/lib/i18n/routing";

type I18n<K extends string> = Partial<
  Record<Locale, Partial<Record<K, string | null>>>
>;

export type AdminHome = {
  texts: Record<
    Locale,
    { tagline: string; pronunciation: string; summary: string }
  >;
  figures: {
    id: string;
    kind: string;
    value: number | null;
    status: string;
    i18n: I18n<"label">;
  }[];
  chapters: {
    id: string;
    prologue: boolean;
    eraStart: number | null;
    eraEnd: number | null;
    placeId: string | null;
    placeName: string | null;
    zoom: number;
    status: string;
    i18n: I18n<"date_label" | "title" | "body">;
  }[];
  anecdotes: { id: string; i18n: I18n<"title" | "body"> }[];
  places: { id: string; name: string; located: boolean }[];
};

function group<K extends string>(
  rows: (Record<string, unknown> & { locale: Locale })[],
  key: string,
  fields: K[],
) {
  const out = new Map<string, I18n<K>>();
  for (const row of rows) {
    const id = row[key] as string;
    const entry = out.get(id) ?? {};
    entry[row.locale] = Object.fromEntries(
      fields.map((f) => [f, (row[f] as string) ?? null]),
    ) as Partial<Record<K, string | null>>;
    out.set(id, entry);
  }
  return out;
}

/** Everything the home page editor shows, read as the administrator. */
export async function adminHome(q: Query): Promise<AdminHome> {
  const textRows = await q<{
    locale: Locale;
    tagline: string | null;
    pronunciation: string | null;
    summary: string | null;
  }>("select locale, tagline, pronunciation, summary from public.home_i18n");
  const texts = Object.fromEntries(
    (["fr", "en", "de"] as const).map((l) => {
      const row = textRows.find((r) => r.locale === l);
      return [
        l,
        {
          tagline: row?.tagline ?? "",
          pronunciation: row?.pronunciation ?? "",
          summary: row?.summary ?? "",
        },
      ];
    }),
  ) as AdminHome["texts"];

  const figureI18n = group(
    await q<{ figure_id: string; locale: Locale; label: string }>(
      "select * from public.home_figures_i18n",
    ),
    "figure_id",
    ["label"],
  );
  const figures = (
    await q<{
      id: string;
      value: number | null;
      auto: string | null;
      status: string;
    }>(
      "select id, value, auto, status from public.home_figures order by sort_order, created_at",
    )
  ).map((f) => ({
    id: f.id,
    kind: f.auto ?? "number",
    value: f.value,
    status: f.status,
    i18n: figureI18n.get(f.id) ?? {},
  }));

  const chapterI18n = group(
    await q<{ chapter_id: string; locale: Locale }>(
      "select * from public.home_chapters_i18n",
    ),
    "chapter_id",
    ["date_label", "title", "body"],
  );
  const chapters = (
    await q<{
      id: string;
      prologue: boolean;
      era_start: number | null;
      era_end: number | null;
      place_id: string | null;
      place_name: string | null;
      zoom: number;
      status: string;
    }>(
      `select c.id, c.prologue, c.era_start, c.era_end, c.place_id, pn.name as place_name, c.zoom, c.status
       from public.home_chapters c
       left join public.places_i18n pn on pn.place_id = c.place_id and pn.locale = 'fr'
       order by c.sort_order, c.created_at`,
    )
  ).map((c) => ({
    id: c.id,
    prologue: c.prologue,
    eraStart: c.era_start,
    eraEnd: c.era_end,
    placeId: c.place_id,
    placeName: c.place_name,
    zoom: c.zoom,
    status: c.status,
    i18n: chapterI18n.get(c.id) ?? {},
  }));

  const anecdoteRows = await q<{ id: string }>(
    "select id from public.stories where anecdote order by created_at desc",
  );
  const anecdoteI18n = group(
    await q<{ story_id: string; locale: Locale }>(
      "select * from public.stories_i18n where story_id = any($1::uuid[])",
      [anecdoteRows.map((a) => a.id)],
    ),
    "story_id",
    ["title", "body"],
  );
  const anecdotes = anecdoteRows.map((a) => ({
    id: a.id,
    i18n: anecdoteI18n.get(a.id) ?? {},
  }));

  const places = await q<{ id: string; name: string; located: boolean }>(
    `select p.id, pn.name, p.lat is not null as located
     from public.places p join public.places_i18n pn on pn.place_id = p.id and pn.locale = 'fr'
     order by pn.name`,
  );

  return { texts, figures, chapters, anecdotes, places };
}

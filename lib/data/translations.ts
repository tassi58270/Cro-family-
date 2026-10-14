import "server-only";
import type { Query } from "@/lib/db";
import type { Locale } from "@/lib/i18n/routing";

/**
 * The Translations screen (section 7): the family's texts in French, English
 * and German side by side. French is the reference; a missing translation
 * falls back on it on the site.
 */

export const TRANSLATABLE = {
  people: {
    table: "people_i18n",
    key: "person_id",
    fields: ["biography", "roles", "works"],
    main: "biography",
    label: `(select concat_ws(' ', p.given_names, p.surname) from public.people p where p.id = f.person_id)`,
  },
  stories: {
    table: "stories_i18n",
    key: "story_id",
    fields: ["title", "excerpt", "body"],
    main: "title",
    label: "f.title",
  },
  places: {
    table: "places_i18n",
    key: "place_id",
    fields: ["name", "description", "visit_info"],
    main: "name",
    label: "f.name",
  },
  events: {
    table: "events_i18n",
    key: "event_id",
    fields: ["title", "description"],
    main: "title",
    label: "f.title",
  },
  branches: {
    table: "branches_i18n",
    key: "branch_id",
    fields: ["name", "description", "fate"],
    main: "name",
    label: "f.name",
  },
  arms: {
    table: "arms_i18n",
    key: "arms_id",
    fields: ["name", "blazon", "explanation", "bearers"],
    main: "name",
    label: "f.name",
  },
  titles: {
    table: "titles_i18n",
    key: "title_id",
    fields: ["name", "description"],
    main: "name",
    label: "f.name",
  },
  albums: {
    table: "albums_i18n",
    key: "album_id",
    fields: ["title", "description"],
    main: "title",
    label: "f.title",
  },
  photos: {
    table: "media_i18n",
    key: "media_id",
    fields: ["caption", "alt"],
    main: "caption",
    label: "f.caption",
  },
} as const;

export type TranslatableKind = keyof typeof TRANSLATABLE;
export const TRANSLATABLE_KINDS = Object.keys(
  TRANSLATABLE,
) as TranslatableKind[];

export type TranslationState = "missing" | "original" | "machine" | "reviewed";

export type TranslationRow = {
  kind: TranslatableKind;
  id: string;
  label: string;
  en: TranslationState;
  de: TranslationState;
};

export type TranslationItem = {
  kind: TranslatableKind;
  id: string;
  label: string;
  fields: readonly string[];
  texts: Record<Locale, Record<string, string>>;
  states: Record<Locale, TranslationState>;
};

/** French texts with a missing or unreviewed translation, by kind. */
function needsWork(kind: TranslatableKind) {
  const c = TRANSLATABLE[kind];
  return `
    select '${kind}' as kind, f.${c.key} as id, coalesce(${c.label}, '') as label,
      coalesce((select e.translation::text from public.${c.table} e
                where e.${c.key} = f.${c.key} and e.locale = 'en'), 'missing') as en,
      coalesce((select d.translation::text from public.${c.table} d
                where d.${c.key} = f.${c.key} and d.locale = 'de'), 'missing') as de
    from public.${c.table} f
    where f.locale = 'fr' and coalesce(f.${c.main}, '') <> ''`;
}

export async function untranslatedCount(q: Query): Promise<number> {
  const [row] = await q<{ n: number }>(
    `select count(*)::int as n from (${TRANSLATABLE_KINDS.map(needsWork).join(
      " union all ",
    )}) x where x.en in ('missing', 'machine') or x.de in ('missing', 'machine')`,
  );
  return row?.n ?? 0;
}

export async function loadTranslations(
  q: Query,
  kind: TranslatableKind | null,
  all: boolean,
): Promise<TranslationRow[]> {
  const kinds = kind ? [kind] : TRANSLATABLE_KINDS;
  return q<TranslationRow>(
    `select * from (${kinds.map(needsWork).join(" union all ")}) x
     ${all ? "" : "where x.en in ('missing', 'machine') or x.de in ('missing', 'machine')"}
     order by x.kind, x.label limit 300`,
  );
}

export async function loadTranslation(
  q: Query,
  kind: TranslatableKind,
  id: string,
): Promise<TranslationItem | null> {
  const c = TRANSLATABLE[kind];
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await q<Record<string, string | null> & { locale: Locale }>(
    `select f.*, f.translation::text as translation, coalesce(${c.label}, '') as label
     from public.${c.table} f where f.${c.key} = $1`,
    [id],
  );
  const fr = rows.find((r) => r.locale === "fr");
  if (!fr) return null;
  const texts = {} as TranslationItem["texts"];
  const states = {} as TranslationItem["states"];
  for (const locale of ["fr", "en", "de"] as const) {
    const row = rows.find((r) => r.locale === locale);
    texts[locale] = Object.fromEntries(
      c.fields.map((f) => [f, row?.[f] ?? ""]),
    );
    states[locale] = (row?.translation as TranslationState) ?? "missing";
  }
  return {
    kind,
    id,
    label: fr.label ?? "",
    fields: c.fields,
    texts,
    states,
  };
}

import "server-only";
import { hasDatabase, withViewer, type Query, type Viewer } from "@/lib/db";
import type { DatePrecision } from "@/lib/genealogie/dates";
import { lifespanYears, personName } from "@/lib/genealogie/names";
import type { Locale } from "@/lib/i18n/routing";
import type { SearchEntry } from "@/lib/search/global";

/**
 * Everything the global search covers (section 5): people, stories, places,
 * events, branches and titles, in one small list. Read under the viewer's
 * role: the public index has no living person, and nothing of theirs.
 */
export async function loadSearchIndex(
  viewer: Viewer,
  locale: Locale,
): Promise<SearchEntry[]> {
  if (!hasDatabase()) return [];
  return withViewer(viewer, (q) => buildSearchIndex(q, locale));
}

export async function buildSearchIndex(
  q: Query,
  locale: Locale,
): Promise<SearchEntry[]> {
  // The text of this language, else the French one.
  const text = (table: string, key: string, alias: string, field: string) =>
    `(select i.${field} from public.${table} i where i.${key} = ${alias}.id
        and coalesce(i.${field}, '') <> ''
        order by (i.locale = $1) desc, (i.locale = 'fr') desc limit 1)`;

  const people = await q<{
    slug: string;
    given_names: string | null;
    surname: string | null;
    epithet: string | null;
    display_name: string | null;
    birth_date: string | null;
    birth_precision: DatePrecision | null;
    death_date: string | null;
    death_precision: DatePrecision | null;
    deceased: boolean;
    branch: string | null;
    titles: string | null;
  }>(
    `select p.slug, p.given_names, p.surname, p.epithet,
              ${text("people_i18n", "person_id", "p", "display_name")} as display_name,
              p.birth_date::text, p.birth_precision, p.death_date::text, p.death_precision,
              p.deceased,
              (select ${text("branches_i18n", "branch_id", "b", "name")}
               from public.branches b where b.id = p.branch_id) as branch,
              (select string_agg(${text("titles_i18n", "title_id", "t", "name")}, ' ')
               from public.people_titles pt join public.titles t on t.id = pt.title_id
               where pt.person_id = p.id) as titles
       from public.people p where p.status = 'published'
       order by p.birth_date nulls last`,
    [locale],
  );

  const stories = await q<{
    slug: string;
    title: string | null;
    excerpt: string | null;
    anecdote: boolean;
  }>(
    `select s.slug, ${text("stories_i18n", "story_id", "s", "title")} as title,
              ${text("stories_i18n", "story_id", "s", "excerpt")} as excerpt, s.anecdote
       from public.stories s where s.status = 'published'
       order by s.era_start nulls last`,
    [locale],
  );

  const places = await q<{
    slug: string;
    name: string | null;
    period_start: number | null;
    period_end: number | null;
  }>(
    `select p.slug, ${text("places_i18n", "place_id", "p", "name")} as name,
              p.period_start, p.period_end
       from public.places p where p.status = 'published'`,
    [locale],
  );

  const events = await q<{
    slug: string;
    title: string | null;
    year: number | null;
    place: string | null;
  }>(
    `select e.slug, ${text("events_i18n", "event_id", "e", "title")} as title,
              extract(year from e.event_date)::int as year,
              (select ${text("places_i18n", "place_id", "p", "name")}
               from public.places p where p.id = e.place_id) as place
       from public.events e where e.status = 'published'
       order by e.event_date nulls last`,
    [locale],
  );

  const branches = await q<{ slug: string; name: string | null }>(
    `select b.slug, ${text("branches_i18n", "branch_id", "b", "name")} as name
       from public.branches b where b.status = 'published' order by b.sort_order`,
    [locale],
  );

  const titles = await q<{
    name: string | null;
    branch: string | null;
    holder: string | null;
    holders: string | null;
  }>(
    `select ${text("titles_i18n", "title_id", "t", "name")} as name,
              (select b.slug from public.branches b where b.id = t.branch_id) as branch,
              (select p.slug from public.people_titles pt join public.people p on p.id = pt.person_id
               where pt.title_id = t.id order by pt.rank nulls last, pt.start_date nulls last limit 1) as holder,
              (select string_agg(concat_ws(' ', p.given_names, p.surname), ', ')
               from public.people_titles pt join public.people p on p.id = pt.person_id
               where pt.title_id = t.id) as holders
       from public.titles t where t.status = 'published' order by t.sort_order`,
    [locale],
  );

  const entries: SearchEntry[] = [];
  for (const p of people) {
    const name = personName(p);
    if (!name) continue;
    entries.push({
      kind: "person",
      slug: p.slug,
      name,
      detail: [lifespanYears(p), p.branch].filter(Boolean).join(" · "),
      words: [p.titles, p.birth_date?.slice(0, 4), p.death_date?.slice(0, 4)]
        .filter(Boolean)
        .join(" "),
    });
  }
  for (const s of stories) {
    if (!s.title) continue;
    entries.push({
      kind: "story",
      slug: s.slug,
      name: s.title,
      detail: s.excerpt ?? "",
      words: "",
      anecdote: s.anecdote,
    });
  }
  for (const p of places) {
    if (!p.name) continue;
    entries.push({
      kind: "place",
      slug: p.slug,
      name: p.name,
      detail:
        p.period_start && p.period_end
          ? `${p.period_start} – ${p.period_end}`
          : String(p.period_start ?? p.period_end ?? ""),
      words: "",
    });
  }
  for (const e of events) {
    if (!e.title) continue;
    entries.push({
      kind: "event",
      slug: e.slug,
      name: e.title,
      detail: [e.year, e.place].filter(Boolean).join(" · "),
      words: "",
    });
  }
  for (const b of branches) {
    if (!b.name) continue;
    entries.push({
      kind: "branch",
      slug: b.slug,
      name: b.name,
      detail: "",
      words: "",
    });
  }
  for (const t of titles) {
    // A title is reached through its branch, else its first bearer.
    const target = t.branch
      ? { via: "branch" as const, slug: t.branch }
      : t.holder
        ? { via: "person" as const, slug: t.holder }
        : null;
    if (!t.name || !target) continue;
    entries.push({
      kind: "title",
      slug: target.slug,
      via: target.via,
      name: t.name,
      detail: t.holders ?? "",
      words: "",
    });
  }
  return entries;
}

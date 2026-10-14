import "server-only";
import type { Query } from "@/lib/db";
import { personName } from "@/lib/genealogie/names";
import type { Locale } from "@/lib/i18n/routing";

/**
 * Anecdotes: short stories (`stories.anecdote`), told in a few lines,
 * shown in « Le saviez-vous ? » and on the sheet of the people they cite.
 */

export type AdminAnecdote = {
  id: string;
  slug: string;
  published: boolean;
  featured: boolean;
  texts: Record<Locale, { title: string; body: string }>;
  people: string[];
  peopleNames: string[];
  places: string[];
};

export async function loadAnecdotes(q: Query): Promise<AdminAnecdote[]> {
  const rows = await q<{
    id: string;
    slug: string;
    status: string;
    featured: boolean;
  }>(
    "select id, slug, status, featured from public.stories where anecdote order by created_at desc",
  );
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const texts = await q<{
    story_id: string;
    locale: Locale;
    title: string;
    body: string | null;
  }>(
    "select story_id, locale, title, body from public.stories_i18n where story_id = any($1)",
    [ids],
  );
  const people = await q<{
    story_id: string;
    person_id: string;
    given_names: string | null;
    surname: string | null;
    epithet: string | null;
  }>(
    `select sp.story_id, sp.person_id, p.given_names, p.surname, p.epithet
     from public.story_people sp join public.people p on p.id = sp.person_id
     where sp.story_id = any($1)`,
    [ids],
  );
  const places = await q<{ story_id: string; place_id: string }>(
    "select story_id, place_id from public.story_places where story_id = any($1)",
    [ids],
  );
  const empty = { title: "", body: "" };
  return rows.map((r) => {
    const own = (l: Locale) => {
      const t = texts.find((x) => x.story_id === r.id && x.locale === l);
      return t ? { title: t.title, body: t.body ?? "" } : empty;
    };
    const linked = people.filter((p) => p.story_id === r.id);
    return {
      id: r.id,
      slug: r.slug,
      published: r.status === "published",
      featured: r.featured,
      texts: { fr: own("fr"), en: own("en"), de: own("de") },
      people: linked.map((p) => p.person_id),
      peopleNames: linked.map((p) => personName(p)),
      places: places.filter((p) => p.story_id === r.id).map((p) => p.place_id),
    };
  });
}

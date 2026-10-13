import "server-only";
import type { Query } from "@/lib/db";
import type { Locale } from "@/lib/i18n/routing";
import type { Theme } from "./story-types";

/** A story as its author (or an administrator) edits it. */

export type EditableStory = {
  id: string;
  slug: string;
  status: "draft" | "pending" | "published" | "rejected";
  title: string;
  excerpt: string;
  body: string;
  eraStart: number | null;
  eraEnd: number | null;
  themes: Theme[];
  originalLocale: Locale;
  anonymous: boolean;
  featured: boolean;
  source: string;
  people: string[];
  places: string[];
  authorName: string | null;
  updatedAt: string;
};

export type StoryListItem = Pick<
  EditableStory,
  "id" | "slug" | "status" | "title" | "authorName" | "featured" | "updatedAt"
>;

export async function storyList(
  q: Query,
  onlyAuthor?: string,
): Promise<StoryListItem[]> {
  return q<StoryListItem>(
    `select s.id, s.slug, s.status, s.featured, s.author_name as "authorName", s.updated_at::text as "updatedAt",
            coalesce((select title from public.stories_i18n i where i.story_id = s.id
                      order by (i.locale = s.original_locale) desc limit 1), s.slug) as title
     from public.stories s
     where not s.anecdote and ($1::uuid is null or s.author_id = $1)
     order by (s.status = 'pending') desc, s.updated_at desc`,
    [onlyAuthor ?? null],
  );
}

export async function editableStory(
  q: Query,
  id: string,
): Promise<EditableStory | null> {
  const [s] = await q<{
    id: string;
    slug: string;
    status: EditableStory["status"];
    era_start: number | null;
    era_end: number | null;
    themes: Theme[];
    original_locale: Locale;
    anonymous: boolean;
    featured: boolean;
    source: string | null;
    author_name: string | null;
    updated_at: string;
  }>(
    "select *, updated_at::text as updated_at, themes::text[] as themes from public.stories where id = $1 and not anecdote",
    [id],
  );
  if (!s) return null;
  const [text] = await q<{
    title: string;
    excerpt: string | null;
    body: string | null;
  }>(
    "select title, excerpt, body from public.stories_i18n where story_id = $1 and locale = $2",
    [id, s.original_locale],
  );
  const people = await q<{ person_id: string }>(
    "select person_id from public.story_people where story_id = $1",
    [id],
  );
  const places = await q<{ place_id: string }>(
    "select place_id from public.story_places where story_id = $1",
    [id],
  );
  return {
    id: s.id,
    slug: s.slug,
    status: s.status,
    title: text?.title ?? "",
    excerpt: text?.excerpt ?? "",
    body: text?.body ?? "",
    eraStart: s.era_start,
    eraEnd: s.era_end,
    themes: s.themes,
    originalLocale: s.original_locale,
    anonymous: s.anonymous,
    featured: s.featured,
    source: s.source ?? "",
    people: people.map((p) => p.person_id),
    places: places.map((p) => p.place_id),
    authorName: s.author_name,
    updatedAt: s.updated_at,
  };
}

/** Places to link a story to, by name. */
export async function placeChoices(q: Query, locale: Locale) {
  return q<{ id: string; name: string }>(
    `select p.id, (select name from public.places_i18n i where i.place_id = p.id
                   order by (i.locale = $1) desc, (i.locale = 'fr') desc limit 1) as name
     from public.places p order by 2`,
    [locale],
  );
}

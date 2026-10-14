import "server-only";
import { hasDatabase, VISITOR, withViewer } from "@/lib/db";

export type SitemapPages = {
  people: { slug: string; at: string }[];
  stories: { slug: string; at: string }[];
  places: { slug: string; at: string }[];
  branches: { slug: string; at: string }[];
  albums: { slug: string; at: string }[];
  photos: { slug: string; at: string }[];
};

/**
 * The pages search engines may know of: published, never the demonstration
 * family, and read as a visitor, so that no living person (nor anything of
 * theirs) can appear, whatever the query says.
 */
export async function loadSitemapPages(): Promise<SitemapPages> {
  const empty: SitemapPages = {
    people: [],
    stories: [],
    places: [],
    branches: [],
    albums: [],
    photos: [],
  };
  if (!hasDatabase()) return empty;
  return withViewer(VISITOR, async (q) => {
    const list = (from: string, slug = "slug", where = "") =>
      q<{ slug: string; at: string }>(
        `select ${slug}::text as slug, updated_at::text as at from public.${from}
         where status = 'published' and not is_demo ${where} order by ${slug}`,
      );
    return {
      people: await list("people"),
      stories: await list("stories"),
      places: await list("places"),
      branches: await list("branches"),
      albums: await list("albums"),
      photos: await list("media", "id", "and kind <> 'arms'"),
    };
  }).catch(() => empty);
}

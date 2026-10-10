import "server-only";
import type { Query } from "@/lib/db";
import { slugify, uniqueSlug } from "@/lib/slug";

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

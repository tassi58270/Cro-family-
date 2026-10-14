import type { MetadataRoute } from "next";
import { loadSitemapPages } from "@/lib/data/sitemap";
import { getPathname } from "@/lib/i18n/navigation";
import { routing } from "@/lib/i18n/routing";
import { isIndexable, siteUrl } from "@/lib/site";

type Href = Parameters<typeof getPathname>[0]["href"];

const SECTIONS = [
  "/",
  "/arbre",
  "/armoiries",
  "/histoires",
  "/photos",
  "/lieux-et-evenements",
  "/contribuer",
] as const;

/**
 * Every public page in its three languages, each with its translations. Empty
 * until the site may be indexed (step 12): the pages say `noindex` until then.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (!isIndexable()) return [];
  const base = siteUrl();
  const url = (locale: (typeof routing.locales)[number], href: Href) =>
    new URL(getPathname({ locale, href }), base).toString();
  const entry = (href: Href, lastModified?: string) =>
    routing.locales.map((locale) => ({
      url: url(locale, href),
      lastModified: lastModified ? new Date(lastModified) : undefined,
      alternates: {
        languages: Object.fromEntries(
          routing.locales.map((l) => [l, url(l, href)]),
        ),
      },
    }));

  const pages = await loadSitemapPages();
  return [
    ...SECTIONS.flatMap((href) => entry(href)),
    ...pages.people.flatMap((p) =>
      entry(
        { pathname: "/arbre/[personne]", params: { personne: p.slug } },
        p.at,
      ),
    ),
    ...pages.stories.flatMap((p) =>
      entry(
        { pathname: "/histoires/[histoire]", params: { histoire: p.slug } },
        p.at,
      ),
    ),
    ...pages.places.flatMap((p) =>
      entry({ pathname: "/lieux/[lieu]", params: { lieu: p.slug } }, p.at),
    ),
    ...pages.branches.flatMap((p) =>
      entry(
        { pathname: "/branches/[branche]", params: { branche: p.slug } },
        p.at,
      ),
    ),
    ...pages.albums.flatMap((p) =>
      entry(
        { pathname: "/photos/albums/[album]", params: { album: p.slug } },
        p.at,
      ),
    ),
    ...pages.photos.flatMap((p) =>
      entry({ pathname: "/photos/[photo]", params: { photo: p.slug } }, p.at),
    ),
  ];
}

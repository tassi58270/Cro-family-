import type { Metadata } from "next";
import { getPathname } from "./navigation";
import { routing, type Locale } from "./routing";

type Href = Parameters<typeof getPathname>[0]["href"];

/**
 * The canonical address of a page in this language and its versions in the
 * others (hreflang), so that each page, not only the home page, is its own
 * canonical.
 */
export function alternatesFor(
  locale: Locale,
  href: Href,
): NonNullable<Metadata["alternates"]> {
  const path = (l: Locale) => getPathname({ locale: l, href });
  return {
    canonical: path(locale),
    languages: {
      ...Object.fromEntries(routing.locales.map((l) => [l, path(l)])),
      "x-default": path(routing.defaultLocale),
    },
  };
}

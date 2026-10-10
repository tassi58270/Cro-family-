import type { MetadataRoute } from "next";
import { routing } from "@/lib/i18n/routing";
import { isIndexable } from "@/lib/site";

/** Member and admin areas are never crawled, in any language. */
const privateRoutes = ["/connexion", "/compte", "/admin"] as const;

export default function robots(): MetadataRoute.Robots {
  if (!isIndexable()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  const disallow = routing.locales.flatMap((locale) =>
    privateRoutes.map((route) => {
      const localized = routing.pathnames[route];
      const segment =
        typeof localized === "string" ? localized : localized[locale];
      return `/${locale}${segment}`;
    }),
  );

  return { rules: { userAgent: "*", allow: "/", disallow } };
}

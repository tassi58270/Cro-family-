/**
 * Public URL of the site, without a trailing slash.
 * Order: explicit setting, then the production domain Vercel provides, then local dev.
 */
export function siteUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return new URL(explicit);

  const vercelProduction = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProduction) return new URL(`https://${vercelProduction}`);

  return new URL(`http://localhost:${process.env.PORT ?? 3000}`);
}

/**
 * Search engines may index the site only once it is officially online
 * (step 12) and only on the production deployment. Until then, every page
 * says `noindex` and robots.txt disallows everything.
 */
export function isIndexable(): boolean {
  return (
    process.env.SITE_INDEXING === "on" &&
    process.env.VERCEL_ENV !== "preview" &&
    process.env.VERCEL_ENV !== "development"
  );
}

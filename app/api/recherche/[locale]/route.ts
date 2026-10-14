import { hasLocale } from "next-intl";
import { loadSearchIndex } from "@/lib/data/search";
import { VISITOR } from "@/lib/db";
import { routing } from "@/lib/i18n/routing";

/** The global search index for the public, regenerated after each publication. */
export const dynamic = "force-static";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/recherche/[locale]">,
) {
  const { locale } = await ctx.params;
  if (!hasLocale(routing.locales, locale))
    return new Response(null, { status: 404 });
  return Response.json(await loadSearchIndex(VISITOR, locale));
}

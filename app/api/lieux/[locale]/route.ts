import { hasLocale } from "next-intl";
import { loadPlacesIndex } from "@/lib/data/places";
import { VISITOR } from "@/lib/db";
import { routing } from "@/lib/i18n/routing";

/** Every place and event the public may see, regenerated after each publication. */
export const dynamic = "force-static";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/lieux/[locale]">,
) {
  const { locale } = await ctx.params;
  if (!hasLocale(routing.locales, locale))
    return new Response(null, { status: 404 });
  return Response.json(await loadPlacesIndex(VISITOR, locale));
}

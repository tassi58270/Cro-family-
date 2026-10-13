import { hasLocale } from "next-intl";
import { loadTree } from "@/lib/data/tree";
import { VISITOR } from "@/lib/db";
import { routing } from "@/lib/i18n/routing";

/**
 * The public tree, without living people: generated once and regenerated
 * whenever an administrator publishes a change (lib/data/revalidate.ts).
 */
export const dynamic = "force-static";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/arbre/[locale]">,
) {
  const { locale } = await ctx.params;
  if (!hasLocale(routing.locales, locale))
    return new Response(null, { status: 404 });
  return Response.json(await loadTree(VISITOR, locale));
}

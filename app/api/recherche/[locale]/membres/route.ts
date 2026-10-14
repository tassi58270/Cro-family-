import { hasLocale } from "next-intl";
import { getSession, viewerOf } from "@/lib/auth/session";
import { loadSearchIndex } from "@/lib/data/search";
import { routing } from "@/lib/i18n/routing";

/** The search index of a member, living relatives included. Never cached. */
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/recherche/[locale]/membres">,
) {
  const { locale } = await ctx.params;
  if (!hasLocale(routing.locales, locale))
    return new Response(null, { status: 404 });
  const session = await getSession();
  if (!session) return new Response(null, { status: 401 });
  return Response.json(await loadSearchIndex(viewerOf(session), locale), {
    headers: { "Cache-Control": "private, no-store" },
  });
}

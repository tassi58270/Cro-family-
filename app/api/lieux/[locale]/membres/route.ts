import { hasLocale } from "next-intl";
import { getSession, viewerOf } from "@/lib/auth/session";
import { loadPlacesIndex } from "@/lib/data/places";
import { routing } from "@/lib/i18n/routing";

/** Every place and event a member may see, living relatives included. Never cached. */
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/lieux/[locale]/membres">,
) {
  const { locale } = await ctx.params;
  if (!hasLocale(routing.locales, locale))
    return new Response(null, { status: 404 });
  const session = await getSession();
  if (!session) return new Response(null, { status: 401 });
  return Response.json(await loadPlacesIndex(viewerOf(session), locale), {
    headers: { "Cache-Control": "private, no-store" },
  });
}

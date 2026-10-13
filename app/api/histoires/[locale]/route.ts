import { hasLocale } from "next-intl";
import { getSession, viewerOf } from "@/lib/auth/session";
import { loadStories } from "@/lib/data/stories";
import { routing } from "@/lib/i18n/routing";

/** Every story a member may read, those about living relatives included. */
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/histoires/[locale]">,
) {
  const { locale } = await ctx.params;
  if (!hasLocale(routing.locales, locale))
    return new Response(null, { status: 404 });
  const session = await getSession();
  if (!session) return new Response(null, { status: 401 });
  return Response.json(await loadStories(viewerOf(session), locale), {
    headers: { "Cache-Control": "private, no-store" },
  });
}

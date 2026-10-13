import { hasLocale } from "next-intl";
import { getSession, viewerOf } from "@/lib/auth/session";
import { loadTree } from "@/lib/data/tree";
import { routing } from "@/lib/i18n/routing";

/** The full tree, living people included: members only, never cached. */
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/arbre/[locale]/membres">,
) {
  const { locale } = await ctx.params;
  if (!hasLocale(routing.locales, locale))
    return new Response(null, { status: 404 });
  const session = await getSession();
  if (!session) return new Response(null, { status: 401 });
  return Response.json(await loadTree(viewerOf(session), locale), {
    headers: { "Cache-Control": "private, no-store" },
  });
}

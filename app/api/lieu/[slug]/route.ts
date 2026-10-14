import { hasLocale } from "next-intl";
import type { NextRequest } from "next/server";
import { currentViewer } from "@/lib/auth/session";
import { loadPlace } from "@/lib/data/places";
import { routing } from "@/lib/i18n/routing";

/** One place as the asking visitor or member may see it. Never cached. */
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/lieu/[slug]">,
) {
  const { slug } = await ctx.params;
  const requested = request.nextUrl.searchParams.get("langue");
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;
  const place = await loadPlace(await currentViewer(), slug, locale);
  if (!place) return new Response(null, { status: 404 });
  return Response.json(place, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

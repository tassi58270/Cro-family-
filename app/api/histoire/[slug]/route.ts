import { hasLocale } from "next-intl";
import type { NextRequest } from "next/server";
import { currentViewer } from "@/lib/auth/session";
import { loadStory } from "@/lib/data/stories";
import { routing } from "@/lib/i18n/routing";

/** One story as the asking visitor or member may read it. Never cached. */
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/histoire/[slug]">,
) {
  const { slug } = await ctx.params;
  const requested = request.nextUrl.searchParams.get("langue");
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;
  const story = await loadStory(await currentViewer(), slug, locale);
  if (!story) return new Response(null, { status: 404 });
  return Response.json(story, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

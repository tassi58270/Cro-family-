import { hasLocale } from "next-intl";
import type { NextRequest } from "next/server";
import { currentViewer } from "@/lib/auth/session";
import { loadPerson } from "@/lib/data/person";
import { routing } from "@/lib/i18n/routing";

/**
 * A person's sheet for the side panel of the tree, as the asking visitor or
 * member may see it. Never cached: members see more than visitors.
 */
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/personne/[slug]">,
) {
  const { slug } = await ctx.params;
  const requested = request.nextUrl.searchParams.get("langue");
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;
  const person = await loadPerson(await currentViewer(), slug, locale);
  if (!person) return new Response(null, { status: 404 });
  return Response.json(person, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

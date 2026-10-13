import { hasLocale } from "next-intl";
import type { NextRequest } from "next/server";
import { currentViewer } from "@/lib/auth/session";
import { loadPhoto } from "@/lib/data/photos";
import { routing } from "@/lib/i18n/routing";

/** One photo as the asking visitor or member may see it. Never cached. */
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/photo/[id]">,
) {
  const { id } = await ctx.params;
  const requested = request.nextUrl.searchParams.get("langue");
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;
  const photo = await loadPhoto(await currentViewer(), id, locale);
  if (!photo) return new Response(null, { status: 404 });
  return Response.json(photo, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

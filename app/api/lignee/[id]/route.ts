import { currentViewer } from "@/lib/auth/session";
import { loadLineage } from "@/lib/data/lineage";

/** The steps of a lineage with their proofs, for « Voir la démonstration ». */
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/lignee/[id]">,
) {
  const { id } = await ctx.params;
  const steps = await loadLineage(await currentViewer(), id);
  if (!steps) return new Response(null, { status: 404 });
  return Response.json(steps, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

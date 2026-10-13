import { getSession } from "@/lib/auth/session";

/** « Me retrouver »: the person of the tree the signed-in member is. */
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return new Response(null, { status: 401 });
  return Response.json(
    { personId: session.personId, role: session.role },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

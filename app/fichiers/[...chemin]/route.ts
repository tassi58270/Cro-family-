import type { NextRequest } from "next/server";
import { currentViewer } from "@/lib/auth/session";
import { hasDatabase, VISITOR, withViewer, type Viewer } from "@/lib/db";
import { fileStore, isSafeKey } from "@/lib/storage";
import { isRaster, resize, variantKey, WIDTHS } from "@/lib/storage/images";

/**
 * Photos and documents, served only to those the database lets see them: a
 * photo of a living person is for members, a pending one for its sender and
 * the administrators. `?l=640` asks for a width suited to the screen.
 */
export const dynamic = "force-dynamic";

async function visibleTo(viewer: Viewer, key: string) {
  const rows = await withViewer(viewer, (q) =>
    q<{ mime_type: string }>(
      "select mime_type from public.media where storage_path = $1",
      [key],
    ),
  );
  return rows[0]?.mime_type ?? null;
}

export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/fichiers/[...chemin]">,
) {
  const { chemin } = await ctx.params;
  const key = chemin.join("/");
  if (!hasDatabase() || !isSafeKey(key))
    return new Response(null, { status: 404 });

  const forEveryone = await visibleTo(VISITOR, key);
  const mime = forEveryone ?? (await visibleTo(await currentViewer(), key));
  if (!mime) return new Response(null, { status: 404 });

  const store = fileStore();
  const width = Number(request.nextUrl.searchParams.get("l"));
  let file = null;
  if ((WIDTHS as readonly number[]).includes(width) && isRaster(mime)) {
    const sized = variantKey(key, width);
    file = await store.get(sized);
    if (!file) {
      const original = await store.get(key);
      if (!original) return new Response(null, { status: 404 });
      file = await resize(original, width);
      await store.put(sized, file.data, file.contentType);
    }
  } else {
    file = await store.get(key);
  }
  if (!file) return new Response(null, { status: 404 });

  const headers: Record<string, string> = {
    "Content-Type": file.contentType,
    "X-Content-Type-Options": "nosniff",
    // Short, so that a photo that becomes private leaves caches quickly.
    "Cache-Control": forEveryone
      ? "public, max-age=600, s-maxage=600"
      : "private, max-age=600",
  };
  if (file.contentType === "image/svg+xml") {
    headers["Content-Security-Policy"] =
      "default-src 'none'; style-src 'unsafe-inline'; sandbox";
  }
  return new Response(new Uint8Array(file.data), { headers });
}

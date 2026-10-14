import { randomUUID } from "node:crypto";
import { getSession, viewerOf } from "@/lib/auth/session";
import { withViewer } from "@/lib/db";
import { fileStore } from "@/lib/storage";
import { ingest } from "@/lib/storage/images";

/**
 * An attachment to a proposal (6.7): a picture or a PDF, kept as a draft
 * document that only its sender and the administrators can open.
 */
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "signin" }, { status: 401 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0)
    return Response.json({ error: "file" }, { status: 400 });
  if (file.size > MAX_BYTES)
    return Response.json({ error: "size" }, { status: 413 });

  const bytes = Buffer.from(await file.arrayBuffer());
  let stored: { data: Buffer; contentType: string; extension: string } | null;
  let size: { width: number | null; height: number | null } = {
    width: null,
    height: null,
  };
  if (bytes.subarray(0, 5).toString("latin1") === "%PDF-") {
    stored = { data: bytes, contentType: "application/pdf", extension: "pdf" };
  } else {
    const image = await ingest(bytes);
    stored = image;
    if (image) size = { width: image.width, height: image.height };
  }
  if (!stored) return Response.json({ error: "type" }, { status: 415 });

  const key = `propositions/${new Date().getFullYear()}/${randomUUID()}.${stored.extension}`;
  await fileStore().put(key, stored.data, stored.contentType);
  try {
    const id = await withViewer(viewerOf(session), async (q) => {
      const [row] = await q<{ id: string }>(
        `insert into public.media
           (storage_path, kind, mime_type, width, height, bytes, provenance, uploaded_by, status)
         values ($1, 'document', $2, $3, $4, $5, $6, $7, 'draft')
         returning id`,
        [
          key,
          stored.contentType,
          size.width,
          size.height,
          stored.data.length,
          file.name.slice(0, 200) || null,
          session.accountId,
        ],
      );
      return row.id;
    });
    return Response.json({ id, path: key, type: stored.contentType });
  } catch (error) {
    console.error(error);
    await fileStore().remove(key);
    return Response.json({ error: "save" }, { status: 500 });
  }
}

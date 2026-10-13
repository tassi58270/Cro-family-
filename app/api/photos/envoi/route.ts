import { randomUUID } from "node:crypto";
import { getSession, viewerOf } from "@/lib/auth/session";
import { contentChanged } from "@/lib/data/revalidate";
import { withViewer } from "@/lib/db";
import { parseFuzzyDate } from "@/lib/genealogie/dates";
import { routing, type Locale } from "@/lib/i18n/routing";
import { fileStore } from "@/lib/storage";
import { ingest } from "@/lib/storage/images";

/**
 * One photo sent by a member (6.5): checked, turned upright, stripped of its
 * metadata, stored, then recorded as waiting for validation. An
 * administrator's photo is published at once.
 */
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS = ["photo", "portrait", "painting", "engraving", "document"];
const MAX_BYTES = 12 * 1024 * 1024;

type Meta = {
  caption?: string;
  date?: string;
  place?: string;
  album?: string;
  people?: string[];
  unidentified?: boolean;
  provenance?: string;
  credit?: string;
  kind?: string;
  locale?: string;
};

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "signin" }, { status: 401 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob) || file.size === 0)
    return Response.json({ error: "file" }, { status: 400 });
  if (file.size > MAX_BYTES)
    return Response.json({ error: "size" }, { status: 413 });
  let meta: Meta = {};
  try {
    meta = JSON.parse(String(form?.get("meta") ?? "{}"));
  } catch {
    return Response.json({ error: "meta" }, { status: 400 });
  }

  const image = await ingest(Buffer.from(await file.arrayBuffer()));
  if (!image) return Response.json({ error: "image" }, { status: 415 });

  const date = meta.date ? parseFuzzyDate(meta.date) : null;
  if (meta.date && !date)
    return Response.json({ error: "date" }, { status: 422 });
  const locale: Locale = (routing.locales as readonly string[]).includes(
    meta.locale ?? "",
  )
    ? (meta.locale as Locale)
    : "fr";
  const key = `photos/${new Date().getFullYear()}/${randomUUID()}.${image.extension}`;
  const admin = session.role === "admin";

  await fileStore().put(key, image.data, image.contentType);
  try {
    const id = await withViewer(viewerOf(session), async (q) => {
      const [row] = await q<{ id: string }>(
        `insert into public.media
           (storage_path, kind, mime_type, width, height, bytes, credit, provenance, taken_date,
            taken_precision, place_id, album_id, unidentified, uploaded_by, status)
         values ($1, $2::public.media_kind, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
                 $15::public.content_status)
         returning id`,
        [
          key,
          KINDS.includes(meta.kind ?? "") ? meta.kind : "photo",
          image.contentType,
          image.width,
          image.height,
          image.data.length,
          meta.credit?.trim().slice(0, 300) || null,
          meta.provenance?.trim().slice(0, 300) || null,
          date?.date ?? null,
          date?.precision ?? null,
          meta.place && UUID.test(meta.place) ? meta.place : null,
          meta.album && UUID.test(meta.album) ? meta.album : null,
          Boolean(meta.unidentified),
          session.accountId,
          admin ? "published" : "pending",
        ],
      );
      if (meta.caption?.trim()) {
        await q(
          "insert into public.media_i18n (media_id, locale, caption) values ($1, $2, $3)",
          [row.id, locale, meta.caption.trim().slice(0, 1000)],
        );
      }
      for (const person of new Set(
        (meta.people ?? []).filter((p) => UUID.test(p)),
      )) {
        await q(
          "insert into public.media_people (media_id, person_id) values ($1, $2)",
          [row.id, person],
        );
      }
      return row.id;
    });
    if (admin) contentChanged();
    return Response.json({ id, published: admin });
  } catch (error) {
    console.error(error);
    await fileStore().remove(key);
    return Response.json({ error: "save" }, { status: 500 });
  }
}

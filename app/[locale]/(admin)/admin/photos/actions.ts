"use server";

import { getSession, viewerOf, type Session } from "@/lib/auth/session";
import { contentChanged } from "@/lib/data/revalidate";
import { withViewer, type Query } from "@/lib/db";
import { parseFuzzyDate } from "@/lib/genealogie/dates";
import { routing } from "@/lib/i18n/routing";
import { slugify, uniqueSlug } from "@/lib/slug";
import { fileStore } from "@/lib/storage";

/**
 * Photos in the dashboard (6.5): publish what members sent, answer « Qui
 * est-ce ? » and removal requests, file photos in albums, outline faces.
 */

export type PhotoFormState = {
  status: "idle" | "saved" | "invalid" | "error";
  errors?: Record<string, "required" | "date">;
  savedAt?: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KINDS = ["photo", "portrait", "painting", "engraving", "document"];

function text(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

function id(form: FormData, name: string) {
  const value = text(form, name);
  return UUID.test(value) ? value : null;
}

async function asAdmin<T>(fn: (q: Query, session: Session) => Promise<T>) {
  const session = await getSession();
  if (!session || session.role !== "admin") throw new Error("forbidden");
  const result = await withViewer(viewerOf(session), (q) => fn(q, session));
  contentChanged();
  return result;
}

export async function reviewPhoto(form: FormData): Promise<void> {
  const media = id(form, "id");
  const decision = text(form, "decision");
  if (!media) return;
  await asAdmin(async (q) => {
    if (decision === "publish")
      await q("update public.media set status = 'published' where id = $1", [
        media,
      ]);
    else if (decision === "reject")
      await q("update public.media set status = 'rejected' where id = $1", [
        media,
      ]);
    else if (decision === "delete") {
      const [row] = await q<{ storage_path: string }>(
        "delete from public.media where id = $1 returning storage_path",
        [media],
      );
      if (row) await fileStore().remove(row.storage_path);
    }
  });
}

/** Accepting a name adds the person to the photo; accepting a removal hides it. */
export async function answerProposal(form: FormData): Promise<void> {
  const suggestion = id(form, "id");
  const accept = text(form, "decision") === "accept";
  if (!suggestion) return;
  await asAdmin(async (q, session) => {
    const [s] = await q<{
      kind: string;
      target_id: string;
      payload: { person_id?: string };
    }>(
      "select kind::text as kind, target_id, payload from public.suggestions where id = $1",
      [suggestion],
    );
    if (!s) return;
    if (
      accept &&
      s.kind === "identification" &&
      s.payload.person_id &&
      UUID.test(s.payload.person_id)
    ) {
      await q(
        "insert into public.media_people (media_id, person_id) values ($1, $2) on conflict do nothing",
        [s.target_id, s.payload.person_id],
      );
    }
    if (accept && s.kind === "removal") {
      await q("update public.media set status = 'rejected' where id = $1", [
        s.target_id,
      ]);
    }
    await q(
      `update public.suggestions set state = $1::public.suggestion_state, reviewed_by = $2, reviewed_at = now()
       where id = $3`,
      [accept ? "accepted" : "rejected", session.accountId, suggestion],
    );
  });
}

export async function saveAlbum(
  _previous: PhotoFormState,
  form: FormData,
): Promise<PhotoFormState> {
  if (!text(form, "title_fr"))
    return { status: "invalid", errors: { title_fr: "required" } };
  try {
    await asAdmin(async (q, session) => {
      let album = id(form, "id");
      if (!album) {
        const slug = await uniqueSlug(
          slugify(text(form, "title_fr")) || "album",
          async (s) =>
            (await q("select 1 from public.albums where slug = $1", [s]))
              .length > 0,
        );
        const [row] = await q<{ id: string }>(
          `insert into public.albums (slug, status, created_by, sort_order)
           values ($1, 'published', $2, (select coalesce(max(sort_order), 0) + 1 from public.albums))
           returning id`,
          [slug, session.accountId],
        );
        album = row.id;
      }
      for (const locale of routing.locales) {
        const title = text(form, `title_${locale}`);
        if (!title) {
          await q(
            "delete from public.albums_i18n where album_id = $1 and locale = $2",
            [album, locale],
          );
          continue;
        }
        await q(
          `insert into public.albums_i18n (album_id, locale, title, description, translation)
           values ($1, $2, $3, $4, $5)
           on conflict (album_id, locale) do update set title = excluded.title,
             description = excluded.description, translation = excluded.translation`,
          [
            album,
            locale,
            title,
            text(form, `description_${locale}`) || null,
            locale === "fr" ? "original" : "reviewed",
          ],
        );
      }
    });
    return { status: "saved", savedAt: Date.now() };
  } catch (error) {
    console.error(error);
    return { status: "error" };
  }
}

export async function deleteAlbum(form: FormData): Promise<void> {
  const album = id(form, "id");
  if (album)
    await asAdmin((q) => q("delete from public.albums where id = $1", [album]));
}

export async function savePhoto(
  _previous: PhotoFormState,
  form: FormData,
): Promise<PhotoFormState> {
  const media = id(form, "id");
  if (!media) return { status: "error" };
  const rawDate = text(form, "date");
  const date = rawDate ? parseFuzzyDate(rawDate) : null;
  if (rawDate && !date) return { status: "invalid", errors: { date: "date" } };
  const kind = text(form, "kind");
  const status = text(form, "status");
  try {
    await asAdmin(async (q) => {
      await q(
        `update public.media set kind = $1::public.media_kind, taken_date = $2, taken_precision = $3,
           place_id = $4, event_id = $5, album_id = $6, credit = $7, provenance = $8, rights = $9,
           unidentified = $10, status = $11::public.content_status
         where id = $12`,
        [
          KINDS.includes(kind) ? kind : "photo",
          date?.date ?? null,
          date?.precision ?? null,
          id(form, "place"),
          id(form, "event"),
          id(form, "album"),
          text(form, "credit") || null,
          text(form, "provenance") || null,
          text(form, "rights") || null,
          form.get("unidentified") === "on",
          ["draft", "pending", "published", "rejected"].includes(status)
            ? status
            : "pending",
          media,
        ],
      );
      for (const locale of routing.locales) {
        const caption = text(form, `caption_${locale}`);
        const alt = text(form, `alt_${locale}`);
        if (!caption && !alt) {
          await q(
            "delete from public.media_i18n where media_id = $1 and locale = $2",
            [media, locale],
          );
          continue;
        }
        await q(
          `insert into public.media_i18n (media_id, locale, caption, alt, translation) values ($1, $2, $3, $4, $5)
           on conflict (media_id, locale) do update set caption = excluded.caption, alt = excluded.alt,
             translation = excluded.translation`,
          [
            media,
            locale,
            caption || null,
            alt || null,
            locale === "fr" ? "original" : "reviewed",
          ],
        );
      }
    });
    return { status: "saved", savedAt: Date.now() };
  } catch (error) {
    console.error(error);
    return { status: "error" };
  }
}

/** Someone on the photo, with the outline of their face when drawn. */
export async function setPersonOnPhoto(form: FormData): Promise<void> {
  const media = id(form, "media");
  const person = id(form, "person");
  if (!media || !person) return;
  const box = text(form, "box")
    .split(",")
    .map(Number)
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 1);
  await asAdmin(async (q) => {
    await q(
      `insert into public.media_people (media_id, person_id, box) values ($1, $2, $3)
       on conflict (media_id, person_id) do update set box = excluded.box`,
      [media, person, box.length === 4 ? box : null],
    );
    if (form.get("portrait") === "on") {
      await q("update public.people set portrait_id = $1 where id = $2", [
        media,
        person,
      ]);
    }
  });
}

export async function removePersonFromPhoto(form: FormData): Promise<void> {
  const media = id(form, "media");
  const person = id(form, "person");
  if (!media || !person) return;
  await asAdmin(async (q) => {
    await q(
      "delete from public.media_people where media_id = $1 and person_id = $2",
      [media, person],
    );
    await q(
      "update public.people set portrait_id = null where id = $1 and portrait_id = $2",
      [person, media],
    );
  });
}

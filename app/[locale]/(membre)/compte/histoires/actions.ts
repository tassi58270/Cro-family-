"use server";

import { getSession, viewerOf } from "@/lib/auth/session";
import { contentChanged } from "@/lib/data/revalidate";
import { withViewer } from "@/lib/db";
import { routing, type Locale } from "@/lib/i18n/routing";
import { slugify, uniqueSlug } from "@/lib/slug";

/**
 * Members write their stories as drafts and send them for validation; an
 * administrator publishes them (cahier des charges, 6.4). The database
 * enforces who may change what.
 */

export type StoryFormState = {
  status: "idle" | "saved" | "invalid" | "error";
  /** Field → message key under storyEditor.errors. */
  errors?: Record<string, "required" | "year" | "order">;
  storyId?: string;
  intent?: "draft" | "submit" | "publish";
  savedAt?: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const THEMES = ["war", "court", "travel", "love", "daily"];

function text(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

function year(form: FormData, name: string): number | null | "invalid" {
  const raw = text(form, name);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 && value < 3000
    ? value
    : "invalid";
}

function ids(form: FormData, name: string) {
  return [
    ...new Set(
      form
        .getAll(name)
        .map(String)
        .filter((v) => UUID.test(v)),
    ),
  ];
}

export async function saveStory(
  _previous: StoryFormState,
  form: FormData,
): Promise<StoryFormState> {
  const session = await getSession();
  if (!session) return { status: "error" };
  const intent = text(form, "intent") as StoryFormState["intent"];
  if (intent === "publish" && session.role !== "admin")
    return { status: "error" };

  const errors: StoryFormState["errors"] = {};
  const title = text(form, "title");
  const body = text(form, "body");
  const start = year(form, "eraStart");
  const end = year(form, "eraEnd");
  if (!title) errors.title = "required";
  if (intent !== "draft" && !body) errors.body = "required";
  if (start === "invalid") errors.eraStart = "year";
  if (end === "invalid") errors.eraEnd = "year";
  if (typeof start === "number" && typeof end === "number" && end < start)
    errors.eraEnd = "order";
  if (Object.keys(errors).length) return { status: "invalid", errors };

  const language = text(form, "language");
  const locale: Locale = (routing.locales as readonly string[]).includes(
    language,
  )
    ? (language as Locale)
    : "fr";
  const themes = form
    .getAll("themes")
    .map(String)
    .filter((t) => THEMES.includes(t));
  const status =
    intent === "publish"
      ? "published"
      : intent === "submit"
        ? "pending"
        : "draft";
  const existing = UUID.test(text(form, "id")) ? text(form, "id") : null;

  try {
    const storyId = await withViewer(viewerOf(session), async (q) => {
      const values = [
        start,
        end,
        themes,
        locale,
        form.get("anonymous") === "on",
        text(form, "source") || null,
        status,
      ];
      let id = existing;
      if (id) {
        const updated = await q(
          `update public.stories set era_start = $1, era_end = $2, themes = $3::public.story_theme[],
             original_locale = $4, anonymous = $5, source = $6, status = $7::public.content_status,
             published_at = case when $7::public.content_status = 'published' then coalesce(published_at, now()) else published_at end
           where id = $8 returning id`,
          [...values, id],
        );
        if (!updated.length) throw new Error("not allowed");
        if (session.role === "admin") {
          await q("update public.stories set featured = $1 where id = $2", [
            form.get("featured") === "on",
            id,
          ]);
        }
      } else {
        const slug = await uniqueSlug(
          slugify(title) || "histoire",
          async (s) =>
            (await q("select 1 from public.stories where slug = $1", [s]))
              .length > 0,
        );
        const [row] = await q<{ id: string }>(
          `insert into public.stories
             (era_start, era_end, themes, original_locale, anonymous, source, status, published_at,
              slug, author_id, author_name)
           values ($1, $2, $3::public.story_theme[], $4, $5, $6, $7::public.content_status,
             case when $7::public.content_status = 'published' then now() end, $8, $9, $10)
           returning id`,
          [...values, slug, session.accountId, session.displayName],
        );
        id = row.id;
      }
      // The story's own language; translations come from the dashboard.
      await q(
        "delete from public.stories_i18n where story_id = $1 and locale <> $2 and translation = 'original'",
        [id, locale],
      );
      await q(
        `insert into public.stories_i18n (story_id, locale, title, excerpt, body, translation)
         values ($1, $2, $3, $4, $5, 'original')
         on conflict (story_id, locale) do update set
           title = excluded.title, excerpt = excluded.excerpt, body = excluded.body`,
        [id, locale, title, text(form, "excerpt") || null, body || null],
      );
      await q("delete from public.story_people where story_id = $1", [id]);
      for (const person of ids(form, "people")) {
        await q(
          "insert into public.story_people (story_id, person_id) values ($1, $2)",
          [id, person],
        );
      }
      const photos = ids(form, "photos");
      await q("delete from public.story_media where story_id = $1", [id]);
      for (const [position, media] of photos.entries()) {
        await q(
          "insert into public.story_media (story_id, media_id, position) values ($1, $2, $3)",
          [id, media, position],
        );
      }
      // The first photo is the cover of the story.
      await q("update public.stories set cover_id = $1 where id = $2", [
        photos[0] ?? null,
        id,
      ]);
      await q("delete from public.story_places where story_id = $1", [id]);
      for (const place of ids(form, "places")) {
        await q(
          "insert into public.story_places (story_id, place_id) values ($1, $2)",
          [id, place],
        );
      }
      return id;
    });
    if (status === "published") contentChanged();
    return { status: "saved", storyId, intent, savedAt: Date.now() };
  } catch (error) {
    console.error(error);
    return { status: "error" };
  }
}

export async function deleteStory(form: FormData): Promise<void> {
  const session = await getSession();
  const id = text(form, "id");
  if (!session || !UUID.test(id)) return;
  await withViewer(viewerOf(session), (q) =>
    q("delete from public.stories where id = $1", [id]),
  );
  contentChanged();
}

/** Administrators: publish, send back or put a story on the front page. */
export async function reviewStory(form: FormData): Promise<void> {
  const session = await getSession();
  const id = text(form, "id");
  const decision = text(form, "decision");
  if (!session || session.role !== "admin" || !UUID.test(id)) return;
  await withViewer(viewerOf(session), async (q) => {
    if (decision === "publish") {
      await q(
        "update public.stories set status = 'published', published_at = coalesce(published_at, now()) where id = $1",
        [id],
      );
    } else if (decision === "reject") {
      await q("update public.stories set status = 'rejected' where id = $1", [
        id,
      ]);
    } else if (decision === "feature" || decision === "unfeature") {
      if (decision === "feature")
        await q("update public.stories set featured = false where featured");
      await q("update public.stories set featured = $1 where id = $2", [
        decision === "feature",
        id,
      ]);
    }
  });
  contentChanged();
}

"use server";

import { asAdmin, id, ids, newSlug, text } from "@/lib/admin/form";
import { routing } from "@/lib/i18n/routing";

/**
 * An anecdote in one short form (section 7, « Anecdotes et histoires »):
 * a title, a few lines, the people and places it concerns, published at
 * once or kept as a draft.
 */

export type AnecdoteState = {
  status: "idle" | "saved" | "invalid" | "error";
  errors?: Record<string, "required">;
  savedAt?: number;
};

export async function saveAnecdote(
  _previous: AnecdoteState,
  form: FormData,
): Promise<AnecdoteState> {
  const errors: AnecdoteState["errors"] = {};
  if (!text(form, "title_fr")) errors.title_fr = "required";
  if (!text(form, "body_fr")) errors.body_fr = "required";
  if (Object.keys(errors).length) return { status: "invalid", errors };
  const published = form.get("published") === "on";
  const featured = form.get("featured") === "on";
  const people = ids(form, "people");
  const places = ids(form, "places");
  try {
    await asAdmin(async (q, session) => {
      let story = id(form, "id");
      if (story) {
        await q(
          `update public.stories set status = $2, featured = $3,
             published_at = case when $2::public.content_status = 'published'
                                 then coalesce(published_at, now()) else published_at end
           where id = $1 and anecdote`,
          [story, published ? "published" : "draft", featured],
        );
      } else {
        const [row] = await q<{ id: string }>(
          `insert into public.stories
             (slug, anecdote, author_id, original_locale, status, featured, published_at)
           values ($1, true, $2, 'fr', $3::public.content_status, $4,
                   case when $3::public.content_status = 'published' then now() end)
           returning id`,
          [
            await newSlug(q, "stories", text(form, "title_fr")),
            session.accountId,
            published ? "published" : "draft",
            featured,
          ],
        );
        story = row.id;
      }
      for (const locale of routing.locales) {
        const title = text(form, `title_${locale}`);
        const body = text(form, `body_${locale}`);
        if (!title || !body) {
          if (locale !== "fr")
            await q(
              "delete from public.stories_i18n where story_id = $1 and locale = $2",
              [story, locale],
            );
          continue;
        }
        await q(
          `insert into public.stories_i18n (story_id, locale, title, excerpt, body, translation)
           values ($1, $2, $3, $4, $4, $5)
           on conflict (story_id, locale) do update
             set title = excluded.title, excerpt = excluded.excerpt, body = excluded.body,
                 translation = excluded.translation`,
          [
            story,
            locale,
            title,
            body,
            locale === "fr" ? "original" : "reviewed",
          ],
        );
      }
      await q(
        "delete from public.story_people where story_id = $1 and not (person_id = any($2))",
        [story, people],
      );
      for (const person of people)
        await q(
          "insert into public.story_people (story_id, person_id) values ($1, $2) on conflict do nothing",
          [story, person],
        );
      await q(
        "delete from public.story_places where story_id = $1 and not (place_id = any($2))",
        [story, places],
      );
      for (const place of places)
        await q(
          "insert into public.story_places (story_id, place_id) values ($1, $2) on conflict do nothing",
          [story, place],
        );
    });
    return { status: "saved", savedAt: Date.now() };
  } catch (error) {
    console.error(error);
    return { status: "error" };
  }
}

export async function deleteAnecdote(form: FormData): Promise<void> {
  const story = id(form, "id");
  if (!story) return;
  await asAdmin((q) =>
    q("delete from public.stories where id = $1 and anecdote", [story]),
  );
}

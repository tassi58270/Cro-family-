"use server";

import { getSession, viewerOf, type Session } from "@/lib/auth/session";
import { contentChanged } from "@/lib/data/revalidate";
import { withViewer, type Query } from "@/lib/db";
import { routing, type Locale } from "@/lib/i18n/routing";
import { slugify, uniqueSlug } from "@/lib/slug";

export type HomeFormState = {
  status: "idle" | "saved" | "invalid" | "error";
  /** Field → message key under admin.home.errors. */
  errors?: Record<string, "required" | "number" | "years">;
  savedAt?: number;
};

const LOCALES = routing.locales;

function text(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

function int(form: FormData, name: string): number | null | "invalid" {
  const raw = text(form, name);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isInteger(value) ? value : "invalid";
}

async function asAdmin<T>(fn: (q: Query, session: Session) => Promise<T>) {
  const session = await getSession();
  if (!session || session.role !== "admin") throw new Error("forbidden");
  const result = await withViewer(viewerOf(session), (q) => fn(q, session));
  contentChanged();
  return result;
}

const saved = (): HomeFormState => ({ status: "saved", savedAt: Date.now() });

/** The line under the name, the pronunciation and the summary, per language. */
export async function saveHomeTexts(
  _previous: HomeFormState,
  form: FormData,
): Promise<HomeFormState> {
  const locale = text(form, "locale") as Locale;
  if (!LOCALES.includes(locale)) return { status: "error" };
  try {
    await asAdmin((q) =>
      q(
        `insert into public.home_i18n (locale, tagline, pronunciation, summary, translation)
         values ($1, $2, $3, $4, $5)
         on conflict (locale) do update set
           tagline = excluded.tagline, pronunciation = excluded.pronunciation,
           summary = excluded.summary, translation = excluded.translation`,
        [
          locale,
          text(form, "tagline") || null,
          text(form, "pronunciation") || null,
          text(form, "summary") || null,
          locale === "fr" ? "original" : "reviewed",
        ],
      ),
    );
    return saved();
  } catch (error) {
    console.error(error);
    return { status: "error" };
  }
}

/** Writes the per-language rows of an item; French is required, others optional. */
async function saveTranslations(
  q: Query,
  table: string,
  key: string,
  id: string,
  form: FormData,
  fields: string[],
) {
  for (const locale of LOCALES) {
    const values = fields.map((f) => text(form, `${f}_${locale}`) || null);
    if (locale !== "fr" && values.every((v) => v === null)) {
      await q(`delete from public.${table} where ${key} = $1 and locale = $2`, [
        id,
        locale,
      ]);
      continue;
    }
    const columns = fields.join(", ");
    const placeholders = fields.map((_, i) => `$${i + 3}`).join(", ");
    const updates = fields.map((f) => `${f} = excluded.${f}`).join(", ");
    await q(
      `insert into public.${table} (${key}, locale, ${columns}, translation)
       values ($1, $2, ${placeholders}, $${fields.length + 3})
       on conflict (${key}, locale) do update set ${updates}, translation = excluded.translation`,
      [id, locale, ...values, locale === "fr" ? "original" : "reviewed"],
    );
  }
}

async function nextOrder(q: Query, table: string) {
  const [row] = await q<{ n: number }>(
    `select coalesce(max(sort_order), -1) + 1 as n from public.${table}`,
  );
  return row.n;
}

const FIGURE_KINDS = [
  "number",
  "people",
  "generations",
  "countries",
  "photos",
  "branches",
  "titles",
  "stories",
  "places",
] as const;

export async function saveFigure(
  _previous: HomeFormState,
  form: FormData,
): Promise<HomeFormState> {
  const kind = text(form, "kind");
  if (!FIGURE_KINDS.includes(kind as (typeof FIGURE_KINDS)[number]))
    return { status: "error" };
  const value = int(form, "value");
  const errors: HomeFormState["errors"] = {};
  if (!text(form, "label_fr")) errors.label_fr = "required";
  if (
    kind === "number" &&
    (value === null || value === "invalid" || value < 0)
  ) {
    errors.value = "number";
  }
  if (Object.keys(errors).length) return { status: "invalid", errors };

  const id = text(form, "id") || null;
  const auto = kind === "number" ? null : kind;
  const status = form.get("published") === "on" ? "published" : "draft";
  try {
    await asAdmin(async (q) => {
      const values = [auto ? null : value, auto, status];
      const figureId = id
        ? (
            await q<{ id: string }>(
              `update public.home_figures set value = $1, auto = $2, status = $3
               where id = $4 returning id`,
              [...values, id],
            )
          )[0].id
        : (
            await q<{ id: string }>(
              `insert into public.home_figures (value, auto, status, sort_order)
               values ($1, $2, $3, $4) returning id`,
              [...values, await nextOrder(q, "home_figures")],
            )
          )[0].id;
      await saveTranslations(
        q,
        "home_figures_i18n",
        "figure_id",
        figureId,
        form,
        ["label"],
      );
    });
    return saved();
  } catch (error) {
    console.error(error);
    return { status: "error" };
  }
}

export async function saveChapter(
  _previous: HomeFormState,
  form: FormData,
): Promise<HomeFormState> {
  const eraStart = int(form, "eraStart");
  const eraEnd = int(form, "eraEnd");
  const errors: HomeFormState["errors"] = {};
  if (!text(form, "title_fr")) errors.title_fr = "required";
  if (eraStart === "invalid" || eraEnd === "invalid")
    errors.eraStart = "number";
  else if (eraStart !== null && eraEnd !== null && eraEnd < eraStart)
    errors.eraStart = "years";
  if (Object.keys(errors).length) return { status: "invalid", errors };

  const id = text(form, "id") || null;
  const placeId = text(form, "placeId") || null;
  const zoom = Number(text(form, "zoom") || 1);
  const values = [
    form.get("prologue") === "on",
    eraStart,
    eraEnd,
    placeId,
    Number.isFinite(zoom) ? Math.min(12, Math.max(1, zoom)) : 1,
    form.get("published") === "on" ? "published" : "draft",
  ];
  try {
    await asAdmin(async (q) => {
      const chapterId = id
        ? (
            await q<{ id: string }>(
              `update public.home_chapters set prologue = $1, era_start = $2, era_end = $3,
                 place_id = $4, zoom = $5, status = $6 where id = $7 returning id`,
              [...values, id],
            )
          )[0].id
        : (
            await q<{ id: string }>(
              `insert into public.home_chapters (prologue, era_start, era_end, place_id, zoom, status, sort_order)
               values ($1, $2, $3, $4, $5, $6, $7) returning id`,
              [...values, await nextOrder(q, "home_chapters")],
            )
          )[0].id;
      await saveTranslations(
        q,
        "home_chapters_i18n",
        "chapter_id",
        chapterId,
        form,
        ["date_label", "title", "body"],
      );
    });
    return saved();
  } catch (error) {
    console.error(error);
    return { status: "error" };
  }
}

/** A short anecdote for « Le saviez-vous ? », published at once. */
export async function saveAnecdote(
  _previous: HomeFormState,
  form: FormData,
): Promise<HomeFormState> {
  const title = text(form, "title_fr");
  const body = text(form, "body_fr");
  const errors: HomeFormState["errors"] = {};
  if (!title) errors.title_fr = "required";
  if (!body) errors.body_fr = "required";
  if (Object.keys(errors).length) return { status: "invalid", errors };

  const id = text(form, "id") || null;
  try {
    await asAdmin(async (q, session) => {
      let storyId = id;
      if (!storyId) {
        const slug = await uniqueSlug(slugify(title), async (s) =>
          Boolean(
            (await q("select 1 from public.stories where slug = $1", [s]))
              .length,
          ),
        );
        storyId = (
          await q<{ id: string }>(
            `insert into public.stories (slug, anecdote, author_id, original_locale, published_at, status)
             values ($1, true, $2, 'fr', now(), 'published') returning id`,
            [slug, session.accountId],
          )
        )[0].id;
      }
      for (const locale of LOCALES) {
        const t = text(form, `title_${locale}`);
        const b = text(form, `body_${locale}`);
        if (!t || !b) {
          if (locale !== "fr") {
            await q(
              "delete from public.stories_i18n where story_id = $1 and locale = $2",
              [storyId, locale],
            );
          }
          continue;
        }
        await q(
          `insert into public.stories_i18n (story_id, locale, title, excerpt, body, translation)
           values ($1, $2, $3, $4, $4, $5)
           on conflict (story_id, locale) do update
             set title = excluded.title, excerpt = excluded.excerpt, body = excluded.body,
                 translation = excluded.translation`,
          [storyId, locale, t, b, locale === "fr" ? "original" : "reviewed"],
        );
      }
    });
    return saved();
  } catch (error) {
    console.error(error);
    return { status: "error" };
  }
}

const ORDERED = { figure: "home_figures", chapter: "home_chapters" } as const;
const DELETABLE = { ...ORDERED, anecdote: "stories" } as const;

export async function deleteHomeItem(kind: keyof typeof DELETABLE, id: string) {
  await asAdmin((q) =>
    q(
      `delete from public.${DELETABLE[kind]} where id = $1${kind === "anecdote" ? " and anecdote" : ""}`,
      [id],
    ),
  );
}

/** Moves an item one place up or down by swapping it with its neighbour. */
export async function moveHomeItem(
  kind: keyof typeof ORDERED,
  id: string,
  direction: -1 | 1,
) {
  const table = ORDERED[kind];
  await asAdmin(async (q) => {
    const rows = await q<{ id: string }>(
      `select id from public.${table} order by sort_order, created_at`,
    );
    const index = rows.findIndex((r) => r.id === id);
    const other = index + direction;
    if (index < 0 || other < 0 || other >= rows.length) return;
    [rows[index], rows[other]] = [rows[other], rows[index]];
    for (const [order, row] of rows.entries()) {
      await q(`update public.${table} set sort_order = $1 where id = $2`, [
        order,
        row.id,
      ]);
    }
  });
}

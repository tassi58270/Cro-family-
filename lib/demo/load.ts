import "server-only";
import type { Query } from "@/lib/db";
import { fileStore } from "@/lib/storage";
import { variantKey, WIDTHS } from "@/lib/storage/images";
import { demoPictures, faceBox, renderDemoPicture } from "./photos";
import {
  demoAlbum,
  demoAnecdotes,
  demoPhotos,
  demoArms,
  demoEntryPoints,
  demoLineages,
  demoBranches,
  demoChapters,
  demoFigures,
  demoSummary,
  demoChildren,
  demoEvents,
  demoPeople,
  demoPlaces,
  demoSources,
  demoStories,
  demoTitles,
  demoUnions,
} from "./dataset";
import { slugify, uniqueSlug } from "@/lib/slug";

export async function demoLoaded(q: Query): Promise<boolean> {
  const [row] = await q<{ loaded: boolean }>(
    "select exists (select 1 from public.people where is_demo) as loaded",
  );
  return row.loaded;
}

/** Loads the fictional family, published, as the given administrator. */
export async function loadDemo(q: Query, actor: string): Promise<void> {
  if (await demoLoaded(q)) return;
  const ids = new Map<string, string>();
  const one = async (sql: string, params: unknown[]) =>
    (await q<{ id: string }>(sql, params))[0].id;

  for (const p of demoPlaces) {
    const id = await one(
      `insert into public.places (slug, lat, lng, kind, country_code, visitable, status, is_demo, created_by)
       values ($1, $2, $3, $4, $5, $6, 'published', true, $7) returning id`,
      [`exemple-${p.key}`, p.lat, p.lng, p.kind, p.country, p.visitable, actor],
    );
    ids.set(`place:${p.key}`, id);
    await q(
      `insert into public.places_i18n (place_id, locale, name, description) values ($1, 'fr', $2, $3)`,
      [id, p.name, "Lieu d’exemple, inventé pour tester la carte."],
    );
  }

  for (const [i, b] of demoBranches.entries()) {
    const id = await one(
      `insert into public.branches (slug, state, extinct_male_year, color, sort_order, status, is_demo, created_by)
       values ($1, $2, $3, $4, $5, 'published', true, $6) returning id`,
      [
        `exemple-${b.key}`,
        b.state,
        "extinctMale" in b ? b.extinctMale : null,
        b.color,
        i,
        actor,
      ],
    );
    ids.set(`branch:${b.key}`, id);
    await q(
      `insert into public.branches_i18n (branch_id, locale, name, description, fate) values ($1, 'fr', $2, $3, $4)`,
      [id, b.name, b.description, "fate" in b ? b.fate : null],
    );
  }

  for (const p of demoPeople) {
    const id = await one(
      `insert into public.people
         (slug, given_names, surname, sex, birth_date, birth_precision, birth_place_id,
          death_date, death_precision, death_place_id, deceased, branch_id, origin_family,
          status, is_demo, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'published', true, $14)
       returning id`,
      [
        // The family may already have someone with the same address.
        await uniqueSlug(
          slugify(`${p.given} ${p.surname} ${p.birth?.date.slice(0, 4) ?? ""}`),
          async (slug) =>
            (await q("select 1 from public.people where slug = $1", [slug]))
              .length > 0,
        ),
        p.given,
        p.surname,
        p.sex,
        p.birth?.date ?? null,
        p.birth?.precision ?? null,
        p.birthPlace ? ids.get(`place:${p.birthPlace}`) : null,
        p.death?.date ?? null,
        p.death?.precision ?? null,
        p.deathPlace ? ids.get(`place:${p.deathPlace}`) : null,
        Boolean(p.death),
        p.branch ? ids.get(`branch:${p.branch}`) : null,
        p.originFamily ?? null,
        actor,
      ],
    );
    ids.set(`person:${p.key}`, id);
    if (p.bio) {
      await q(
        `insert into public.people_i18n (person_id, locale, biography) values ($1, 'fr', $2)`,
        [id, p.bio],
      );
    }
  }

  for (const b of demoBranches) {
    await q(
      `update public.branches set founder_id = $1, last_person_id = $2, parent_id = $3 where id = $4`,
      [
        ids.get(`person:${b.founder}`),
        "last" in b ? ids.get(`person:${b.last}`) : null,
        "parent" in b ? ids.get(`branch:${b.parent}`) : null,
        ids.get(`branch:${b.key}`),
      ],
    );
  }

  for (const u of demoUnions) {
    const id = await one(
      `insert into public.unions (partner_a, partner_b, marriage_date, marriage_precision, place_id, status, is_demo, created_by)
       values ($1, $2, $3, $4, $5, 'published', true, $6) returning id`,
      [
        ids.get(`person:${u.a}`),
        ids.get(`person:${u.b}`),
        u.date.date,
        u.date.precision,
        "place" in u ? ids.get(`place:${u.place}`) : null,
        actor,
      ],
    );
    ids.set(`union:${u.key}`, id);
  }

  for (const c of demoChildren) {
    const union = c.union ? demoUnions.find((u) => u.key === c.union)! : null;
    const parents = union ? [union.a, union.b] : [c.parent!];
    for (const parent of parents) {
      await q(
        `insert into public.parent_child (parent_id, child_id, union_id, certainty, status, is_demo, created_by)
         values ($1, $2, $3, $4, 'published', true, $5)`,
        [
          ids.get(`person:${parent}`),
          ids.get(`person:${c.child}`),
          union ? ids.get(`union:${union.key}`) : null,
          c.certainty ?? "attested",
          actor,
        ],
      );
    }
  }

  for (const [i, t] of demoTitles.entries()) {
    const id = await one(
      `insert into public.titles (slug, created_date, created_precision, creator, branch_id, sort_order, status, is_demo, created_by)
       values ($1, $2, $3, $4, $5, $6, 'published', true, $7) returning id`,
      [
        `exemple-${t.key}`,
        t.created.date,
        t.created.precision,
        t.creator,
        ids.get(`branch:${t.branch}`),
        i,
        actor,
      ],
    );
    await q(
      `insert into public.titles_i18n (title_id, locale, name, description) values ($1, 'fr', $2, $3)`,
      [id, t.name, "Titre d’exemple, inventé pour tester la frise des titres."],
    );
    for (const h of t.holders) {
      await q(
        `insert into public.people_titles
           (person_id, title_id, start_date, start_precision, end_date, end_precision, rank, status, is_demo, created_by)
         values ($1, $2, $3, $4, $5, $6, $7, 'published', true, $8)`,
        [
          ids.get(`person:${h.person}`),
          id,
          h.from.date,
          h.from.precision,
          h.to.date,
          h.to.precision,
          h.rank,
          actor,
        ],
      );
    }
  }

  for (const e of demoEvents) {
    const id = await one(
      `insert into public.events (slug, kind, event_date, event_precision, place_id, status, is_demo, created_by)
       values ($1, $2, $3, $4, $5, 'published', true, $6) returning id`,
      [
        `exemple-${e.key}`,
        e.kind,
        e.date.date,
        e.date.precision,
        ids.get(`place:${e.place}`),
        actor,
      ],
    );
    ids.set(`event:${e.key}`, id);
    await q(
      `insert into public.events_i18n (event_id, locale, title, description) values ($1, 'fr', $2, $3)`,
      [id, e.title, "Événement d’exemple, inventé pour tester la frise."],
    );
    for (const person of e.people) {
      await q(
        `insert into public.event_people (event_id, person_id) values ($1, $2)`,
        [id, ids.get(`person:${person}`)],
      );
    }
  }

  for (const s of demoStories) {
    const id = await one(
      `insert into public.stories
         (slug, era_start, era_end, author_name, themes, original_locale, featured,
          published_at, status, is_demo)
       values ($1, $2, $3, $4, $5::public.story_theme[], 'fr', $6, now(), 'published', true)
       returning id`,
      [
        `exemple-${s.key}`,
        s.era[0],
        s.era[1],
        "Famille Exemple",
        s.themes,
        s.featured,
      ],
    );
    await q(
      `insert into public.stories_i18n (story_id, locale, title, excerpt, body) values ($1, 'fr', $2, $3, $4)`,
      [id, s.title, s.excerpt, s.body],
    );
    for (const person of s.people) {
      await q(
        `insert into public.story_people (story_id, person_id) values ($1, $2)`,
        [id, ids.get(`person:${person}`)],
      );
    }
    for (const place of s.places) {
      await q(
        `insert into public.story_places (story_id, place_id) values ($1, $2)`,
        [id, ids.get(`place:${place}`)],
      );
    }
    for (const event of s.events) {
      await q(
        `insert into public.story_events (story_id, event_id) values ($1, $2)`,
        [id, ids.get(`event:${event}`)],
      );
    }
  }

  await loadDemoHome(q, ids);

  for (const s of demoSources) {
    const id = await one(
      `insert into public.sources (kind, title, reference, repository, transcription, translation, status, is_demo, created_by)
       values ($1, $2, $3, $4, $5, $6, 'published', true, $7) returning id`,
      [
        s.kind,
        s.title,
        s.reference,
        s.repository,
        s.transcription,
        s.translation ?? null,
        actor,
      ],
    );
    for (const person of s.people) {
      await q(
        `insert into public.person_sources (source_id, person_id) values ($1, $2)`,
        [id, ids.get(`person:${person}`)],
      );
    }
    for (const [parent, child] of s.filiations ?? []) {
      await q(
        `insert into public.filiation_sources (source_id, parent_id, child_id) values ($1, $2, $3)`,
        [id, ids.get(`person:${parent}`), ids.get(`person:${child}`)],
      );
    }
  }

  for (const [i, a] of demoArms.entries()) {
    const id = await one(
      `insert into public.arms
         (slug, builtin, kind, branch_id, person_id, family_name, period_start, period_end,
          sort_order, status, is_demo, created_by)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'published', true, $10) returning id`,
      [
        `exemple-${a.key}`,
        a.builtin,
        a.kind,
        a.branch ? ids.get(`branch:${a.branch}`) : null,
        a.person ? ids.get(`person:${a.person}`) : null,
        a.family ?? null,
        a.period?.[0] ?? null,
        a.period?.[1] ?? null,
        100 + i,
        actor,
      ],
    );
    await q(
      `insert into public.arms_i18n (arms_id, locale, name, blazon, explanation) values ($1, 'fr', $2, $3, $4)`,
      [id, a.name, a.blazon, a.explanation],
    );
    for (const person of a.people ?? []) {
      await q(`update public.people set origin_arms_id = $1 where id = $2`, [
        id,
        ids.get(`person:${person}`),
      ]);
    }
  }

  await loadDemoPhotos(q, ids, actor);

  for (const [i, e] of demoEntryPoints.entries()) {
    // The family's own default entry point stays the default.
    const [{ taken }] = await q<{ taken: boolean }>(
      "select exists (select 1 from public.tree_entry_points where is_default) as taken",
    );
    const id = await one(
      `insert into public.tree_entry_points (person_id, sort_order, is_default, status, is_demo)
       values ($1, $2, $3, 'published', true) returning id`,
      [ids.get(`person:${e.person}`), 100 + i, e.isDefault && !taken],
    );
    await q(
      `insert into public.tree_entry_points_i18n (entry_id, locale, label) values ($1, 'fr', $2)`,
      [id, e.label],
    );
  }

  for (const [i, l] of demoLineages.entries()) {
    const id = await one(
      `insert into public.lineages (start_person_id, end_person_id, sort_order, status, is_demo)
       values ($1, $2, $3, 'published', true) returning id`,
      [ids.get(`person:${l.start}`), ids.get(`person:${l.end}`), 100 + i],
    );
    await q(
      `insert into public.lineages_i18n (lineage_id, locale, title, intro) values ($1, 'fr', $2, $3)`,
      [id, l.title, l.intro],
    );
  }
}

/** Drawn pictures, an album, the people on them and the outline of their faces. */
async function loadDemoPhotos(
  q: Query,
  ids: Map<string, string>,
  actor: string,
) {
  const [album] = await q<{ id: string }>(
    `insert into public.albums (slug, status, is_demo, created_by, sort_order)
     values ('exemple-album', 'published', true, $1, 100) returning id`,
    [actor],
  );
  await q(
    `insert into public.albums_i18n (album_id, locale, title, description) values ($1, 'fr', $2, $3)`,
    [album.id, demoAlbum.title, demoAlbum.description],
  );
  const store = fileStore();
  for (const photo of demoPhotos) {
    const picture = demoPictures.find((p) => p.key === photo.picture)!;
    const data = await renderDemoPicture(picture);
    const key = `photos/exemple/${picture.key}.jpg`;
    await store.put(key, data, "image/jpeg");
    const [media] = await q<{ id: string }>(
      `insert into public.media
         (storage_path, kind, mime_type, width, height, bytes, provenance, taken_date, taken_precision,
          place_id, event_id, album_id, unidentified, uploaded_by, status, is_demo)
       values ($1, $2, 'image/jpeg', 1200, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'published', true)
       on conflict (storage_path) do update set status = 'published'
       returning id`,
      [
        key,
        photo.kind,
        picture.height,
        data.length,
        "Image dessinée pour la démonstration",
        photo.date.date,
        photo.date.precision,
        photo.place ? ids.get(`place:${photo.place}`) : null,
        photo.event ? ids.get(`event:${photo.event}`) : null,
        photo.album ? album.id : null,
        Boolean(photo.unidentified),
        actor,
      ],
    );
    await q(
      `insert into public.media_i18n (media_id, locale, caption) values ($1, 'fr', $2)`,
      [media.id, photo.caption],
    );
    for (const [i, person] of photo.people.entries()) {
      const figure = picture.figures[i];
      await q(
        `insert into public.media_people (media_id, person_id, box) values ($1, $2, $3)`,
        [
          media.id,
          ids.get(`person:${person}`),
          figure ? faceBox(figure, picture.height) : null,
        ],
      );
    }
    for (const story of photo.stories ?? []) {
      await q(
        `insert into public.story_media (story_id, media_id, position)
         select id, $2, 0 from public.stories where slug = $1`,
        [`exemple-${story}`, media.id],
      );
      await q(
        `update public.stories set cover_id = $2 where slug = $1 and cover_id is null`,
        [`exemple-${story}`, media.id],
      );
    }
    if (photo.portraitOf) {
      await q(`update public.people set portrait_id = $1 where id = $2`, [
        media.id,
        ids.get(`person:${photo.portraitOf}`),
      ]);
    }
  }
}

/** The home page of the demonstration; the family's own texts are kept. */
async function loadDemoHome(q: Query, ids: Map<string, string>) {
  await q(
    `update public.home_i18n set summary = $1 where locale = 'fr' and coalesce(summary, '') = ''`,
    [demoSummary],
  );
  for (const [i, c] of demoChapters.entries()) {
    const [chapter] = await q<{ id: string }>(
      `insert into public.home_chapters (sort_order, prologue, era_start, era_end, place_id, zoom, status, is_demo)
       values ($1, $2, $3, $4, $5, $6, 'published', true) returning id`,
      [
        i,
        c.prologue,
        c.era?.[0] ?? null,
        c.era?.[1] ?? null,
        c.place ? ids.get(`place:${c.place}`) : null,
        c.zoom,
      ],
    );
    await q(
      `insert into public.home_chapters_i18n (chapter_id, locale, date_label, title, body)
       values ($1, 'fr', $2, $3, $4)`,
      [chapter.id, c.dateLabel, c.title, c.body],
    );
  }
  for (const [i, f] of demoFigures.entries()) {
    const [figure] = await q<{ id: string }>(
      `insert into public.home_figures (sort_order, value, auto, status, is_demo)
       values ($1, $2, $3, 'published', true) returning id`,
      [i, "value" in f ? f.value : null, "auto" in f ? f.auto : null],
    );
    await q(
      `insert into public.home_figures_i18n (figure_id, locale, label) values ($1, 'fr', $2)`,
      [figure.id, f.label],
    );
  }
  for (const a of demoAnecdotes) {
    const [story] = await q<{ id: string }>(
      `insert into public.stories (slug, anecdote, original_locale, published_at, status, is_demo)
       values ($1, true, 'fr', now(), 'published', true) returning id`,
      [`exemple-anecdote-${a.key}`],
    );
    await q(
      `insert into public.stories_i18n (story_id, locale, title, excerpt, body) values ($1, 'fr', $2, $3, $3)`,
      [story.id, a.title, a.excerpt],
    );
  }
}

/** Removes every demonstration row; the family's own content is untouched. */
export async function removeDemo(q: Query): Promise<void> {
  const files = await q<{ storage_path: string }>(
    "select storage_path from public.media where is_demo",
  );
  await q("update public.people set portrait_id = null where is_demo");
  await q("delete from public.tree_entry_points where is_demo");
  await q("delete from public.lineages where is_demo");
  await q("delete from public.arms where is_demo");
  await q("delete from public.stories where is_demo");
  await q("delete from public.home_chapters where is_demo");
  await q("delete from public.home_figures where is_demo");
  await q("update public.home_i18n set summary = null where summary = $1", [
    demoSummary,
  ]);
  for (const table of [
    "events",
    "sources",
    "people_titles",
    "titles",
    "parent_child",
    "unions",
  ]) {
    await q(`delete from public.${table} where is_demo`);
  }
  await q("update public.branches set founder_id = null where is_demo");
  for (const table of ["people", "branches", "media", "albums", "places"]) {
    await q(`delete from public.${table} where is_demo`);
  }
  for (const { storage_path: key } of files) {
    await fileStore().remove(key);
    for (const width of WIDTHS)
      await fileStore().remove(variantKey(key, width));
  }
}

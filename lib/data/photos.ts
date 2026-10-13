import "server-only";
import { cache } from "react";
import {
  hasDatabase,
  VISITOR,
  withViewer,
  type Query,
  type Viewer,
} from "@/lib/db";
import type { DatePrecision } from "@/lib/genealogie/dates";
import { lifespanYears, personName } from "@/lib/genealogie/names";
import type { Locale } from "@/lib/i18n/routing";
import { typeset } from "@/lib/typography";
import type { AlbumItem, FaceItem, PhotoIndex, PhotoItem } from "./photo-types";

export type {
  AlbumItem,
  FaceItem,
  PhotoIndex,
  PhotoItem,
  PhotoPerson,
} from "./photo-types";

/**
 * The photos (cahier des charges, 6.5), read under the viewer's rules: a
 * photo showing a living person is for members, a pending one for its sender
 * and the administrators.
 */

type MediaRow = {
  id: string;
  storage_path: string;
  kind: PhotoItem["kind"];
  width: number | null;
  height: number | null;
  credit: string | null;
  provenance: string | null;
  taken_date: string | null;
  taken_precision: DatePrecision | null;
  place_id: string | null;
  event_id: string | null;
  album_id: string | null;
  unidentified: boolean;
  status: string;
  is_demo: boolean;
};

function pick<T extends { locale: Locale }>(rows: T[], locale: Locale) {
  return (
    rows.find((r) => r.locale === locale) ??
    rows.find((r) => r.locale === "fr") ??
    rows[0]
  );
}

async function photos(
  q: Query,
  locale: Locale,
  where: string,
  params: unknown[] = [],
): Promise<PhotoItem[]> {
  const rows = await q<MediaRow>(
    `select id, storage_path, kind, width, height, credit, provenance, taken_date, taken_precision,
            place_id, event_id, album_id, unidentified, status, is_demo
     from public.media m
     where kind <> 'arms' and mime_type like 'image/%' and ${where}
     order by taken_date nulls last, created_at`,
    params,
  );
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const captions = await q<{
    media_id: string;
    locale: Locale;
    caption: string | null;
    alt: string | null;
  }>(
    "select media_id, locale, caption, alt from public.media_i18n where media_id = any($1)",
    [ids],
  );
  const people = await q<{
    media_id: string;
    id: string;
    slug: string;
    given_names: string | null;
    surname: string | null;
    epithet: string | null;
    box: number[] | null;
    branch: string | null;
  }>(
    `select mp.media_id, p.id, p.slug, p.given_names, p.surname, p.epithet, mp.box, b.slug as branch
     from public.media_people mp
     join public.people p on p.id = mp.person_id
     left join public.branches b on b.id = p.branch_id
     where mp.media_id = any($1)
     order by (mp.box)[1] nulls last`,
    [ids],
  );
  const places = await q<{
    id: string;
    slug: string;
    locale: Locale;
    name: string;
  }>(
    `select p.id, p.slug, i.locale, i.name from public.places p join public.places_i18n i on i.place_id = p.id
     where p.id = any($1)`,
    [rows.map((r) => r.place_id).filter(Boolean)],
  );
  const events = await q<{
    id: string;
    slug: string;
    locale: Locale;
    title: string;
  }>(
    `select e.id, e.slug, i.locale, i.title from public.events e join public.events_i18n i on i.event_id = e.id
     where e.id = any($1)`,
    [rows.map((r) => r.event_id).filter(Boolean)],
  );
  const albums = await q<{
    id: string;
    slug: string;
    locale: Locale;
    title: string;
  }>(
    `select a.id, a.slug, i.locale, i.title from public.albums a join public.albums_i18n i on i.album_id = a.id
     where a.id = any($1)`,
    [rows.map((r) => r.album_id).filter(Boolean)],
  );

  return rows.map((r) => {
    const text = pick(
      captions.filter((c) => c.media_id === r.id),
      locale,
    );
    const place = pick(
      places.filter((p) => p.id === r.place_id),
      locale,
    );
    const event = pick(
      events.filter((e) => e.id === r.event_id),
      locale,
    );
    const album = pick(
      albums.filter((a) => a.id === r.album_id),
      locale,
    );
    return {
      id: r.id,
      url: `/fichiers/${r.storage_path}`,
      width: r.width,
      height: r.height,
      kind: r.kind,
      caption: text?.caption?.trim()
        ? { text: typeset(text.caption, text.locale), lang: text.locale }
        : null,
      alt: text?.alt ?? null,
      date:
        r.taken_date && r.taken_precision
          ? { date: r.taken_date, precision: r.taken_precision }
          : null,
      year: r.taken_date ? Number(r.taken_date.slice(0, 4)) : null,
      place: place ? { slug: place.slug, name: place.name } : null,
      event: event ? { slug: event.slug, title: event.title } : null,
      album: album ? { slug: album.slug, title: album.title } : null,
      people: people
        .filter((p) => p.media_id === r.id)
        .map((p) => ({
          id: p.id,
          slug: p.slug,
          name: personName(p),
          box:
            p.box && p.box.length === 4
              ? (p.box as [number, number, number, number])
              : null,
          branch: p.branch,
        })),
      unidentified: r.unidentified,
      credit: r.credit,
      provenance: r.provenance,
      status: r.status,
      isDemo: r.is_demo,
    };
  });
}

async function index(
  q: Query,
  locale: Locale,
  members: boolean,
): Promise<PhotoIndex> {
  const list = await photos(q, locale, "status = 'published'");
  const albumRows = await q<{ id: string; slug: string; cover: string | null }>(
    `select a.id, a.slug, m.storage_path as cover from public.albums a
     left join public.media m on m.id = a.cover_id
     order by a.sort_order, a.created_at`,
  );
  const albumTexts = await q<{
    album_id: string;
    locale: Locale;
    title: string;
    description: string | null;
  }>("select album_id, locale, title, description from public.albums_i18n");
  const albums: AlbumItem[] = albumRows
    .map((a) => {
      const text = pick(
        albumTexts.filter((t) => t.album_id === a.id),
        locale,
      );
      const inside = list.filter((p) => p.album?.slug === a.slug);
      return {
        slug: a.slug,
        title: text?.title ?? a.slug,
        description: text?.description ?? null,
        count: inside.length,
        cover: a.cover ? `/fichiers/${a.cover}` : (inside[0]?.url ?? null),
      };
    })
    .filter((a) => a.count > 0);

  // A face per person: their chosen portrait, or else the first photo where
  // their face is outlined.
  const portraits = await q<{
    slug: string;
    given_names: string | null;
    surname: string | null;
    epithet: string | null;
    birth_date: string | null;
    birth_precision: DatePrecision | null;
    death_date: string | null;
    death_precision: DatePrecision | null;
    deceased: boolean | null;
    path: string;
  }>(
    `select p.slug, p.given_names, p.surname, p.epithet, p.birth_date, p.birth_precision,
            p.death_date, p.death_precision, p.deceased, m.storage_path as path
     from public.people p join public.media m on m.id = p.portrait_id
     where m.status = 'published'`,
  );
  const faces: FaceItem[] = portraits.map((p) => ({
    slug: p.slug,
    name: personName(p),
    years: lifespanYears(p),
    url: `/fichiers/${p.path}`,
    box: null,
    ratio: 1,
  }));
  for (const photo of list) {
    for (const person of photo.people) {
      if (
        !person.box ||
        !person.slug ||
        !person.name ||
        faces.some((f) => f.slug === person.slug)
      )
        continue;
      faces.push({
        slug: person.slug,
        name: person.name,
        years: "",
        url: photo.url,
        box: person.box,
        ratio: photo.width && photo.height ? photo.width / photo.height : 1,
      });
    }
  }
  faces.sort((a, b) => a.name.localeCompare(b.name, locale));

  const branches = await q<{ slug: string; name: string }>(
    `select b.slug, (select name from public.branches_i18n i where i.branch_id = b.id
                     order by (i.locale = $1) desc, (i.locale = 'fr') desc limit 1) as name
     from public.branches b order by b.sort_order`,
    [locale],
  );
  return { photos: list, albums, faces, branches, members };
}

export const loadPhotoIndex = cache(
  async (viewer: Viewer, locale: Locale): Promise<PhotoIndex> => {
    const members = viewer.kind === "account";
    if (!hasDatabase())
      return { photos: [], albums: [], faces: [], branches: [], members };
    return withViewer(viewer, (q) => index(q, locale, members));
  },
);

export const loadPhoto = cache(
  async (
    viewer: Viewer,
    id: string,
    locale: Locale,
  ): Promise<PhotoItem | null> => {
    if (!hasDatabase() || !/^[0-9a-f-]{36}$/.test(id)) return null;
    const [photo] = await withViewer(viewer, (q) =>
      photos(q, locale, "id = $1", [id]),
    );
    return photo ?? null;
  },
);

/** Photos and albums the public may see, built in advance. */
export async function publicPhotoIds(): Promise<string[]> {
  if (!hasDatabase()) return [];
  const rows = await withViewer(VISITOR, (q) =>
    q<{ id: string }>(
      "select id from public.media where status = 'published' and kind <> 'arms'",
    ),
  ).catch(() => []);
  return rows.map((r) => r.id);
}

export async function albumSlugs(): Promise<string[]> {
  if (!hasDatabase()) return [];
  const rows = await withViewer(VISITOR, (q) =>
    q<{ slug: string }>("select slug from public.albums"),
  ).catch(() => []);
  return rows.map((r) => r.slug);
}

import "server-only";
import type { Query } from "@/lib/db";
import type { DatePrecision } from "@/lib/genealogie/dates";
import { personName } from "@/lib/genealogie/names";
import { routing, type Locale } from "@/lib/i18n/routing";

/** Photos as the dashboard validates and describes them. */

export type PendingPhoto = {
  id: string;
  path: string;
  caption: string | null;
  sender: string | null;
  createdAt: string;
};

/** Every photo of the site, for the library (section 7, « Médias »). */
export type LibraryPhoto = {
  id: string;
  path: string;
  status: "draft" | "pending" | "published" | "rejected";
  caption: string | null;
  people: number;
};

export type Proposal = {
  id: string;
  kind: "identification" | "removal";
  mediaId: string;
  path: string;
  author: string | null;
  personId: string | null;
  personName: string | null;
  name: string | null;
  where: string | null;
  reason: string | null;
};

export type AdminAlbum = {
  id: string;
  slug: string;
  titles: Record<Locale, string>;
  descriptions: Record<Locale, string>;
  count: number;
};

export type EditablePhoto = {
  id: string;
  path: string;
  width: number | null;
  height: number | null;
  kind: string;
  status: string;
  date: { date: string; precision: DatePrecision } | null;
  placeId: string | null;
  eventId: string | null;
  albumId: string | null;
  credit: string;
  provenance: string;
  rights: string;
  unidentified: boolean;
  captions: Record<Locale, string>;
  alts: Record<Locale, string>;
  people: {
    id: string;
    name: string;
    box: [number, number, number, number] | null;
    portrait: boolean;
  }[];
};

const blank = () =>
  Object.fromEntries(routing.locales.map((l) => [l, ""])) as Record<
    Locale,
    string
  >;

export async function photoQueue(q: Query) {
  const pending = await q<PendingPhoto>(
    `select m.id, m.storage_path as path, m.created_at::text as "createdAt",
            (select caption from public.media_i18n i where i.media_id = m.id limit 1) as caption,
            p.display_name as sender
     from public.media m left join public.profiles p on p.id = m.uploaded_by
     where m.status = 'pending' and m.kind <> 'arms'
     order by m.created_at`,
  );
  const rows = await q<{
    id: string;
    kind: Proposal["kind"];
    target_id: string;
    payload: {
      person_id?: string | null;
      name?: string | null;
      where?: string | null;
      reason?: string | null;
    };
    author: string | null;
    path: string | null;
  }>(
    `select s.id, s.kind::text as kind, s.target_id, s.payload, p.display_name as author, m.storage_path as path
     from public.suggestions s
     left join public.profiles p on p.id = s.author_id
     left join public.media m on m.id = s.target_id
     where s.target_table = 'media' and s.state = 'sent' and s.kind::text in ('identification', 'removal')
     order by s.created_at`,
  );
  const people = await q<{
    id: string;
    given_names: string | null;
    surname: string | null;
    epithet: string | null;
  }>(
    "select id, given_names, surname, epithet from public.people where id = any($1)",
    [rows.map((r) => r.payload.person_id).filter(Boolean)],
  );
  const proposals: Proposal[] = rows
    .filter((r) => r.path)
    .map((r) => {
      const person = people.find((p) => p.id === r.payload.person_id);
      return {
        id: r.id,
        kind: r.kind,
        mediaId: r.target_id,
        path: r.path!,
        author: r.author,
        personId: person?.id ?? null,
        personName: person ? personName(person) : null,
        name: r.payload.name ?? null,
        where: r.payload.where ?? null,
        reason: r.payload.reason ?? null,
      };
    });
  const albumRows = await q<{ id: string; slug: string; count: number }>(
    `select a.id, a.slug, (select count(*)::int from public.media m where m.album_id = a.id) as count
     from public.albums a order by a.sort_order, a.created_at`,
  );
  const albumTexts = await q<{
    album_id: string;
    locale: Locale;
    title: string;
    description: string | null;
  }>("select album_id, locale, title, description from public.albums_i18n");
  const albums: AdminAlbum[] = albumRows.map((a) => {
    const titles = blank();
    const descriptions = blank();
    for (const t of albumTexts.filter((x) => x.album_id === a.id)) {
      titles[t.locale] = t.title;
      descriptions[t.locale] = t.description ?? "";
    }
    return { ...a, titles, descriptions };
  });
  const library = await q<LibraryPhoto>(
    `select m.id, m.storage_path as path, m.status,
            (select caption from public.media_i18n i where i.media_id = m.id
             order by (i.locale = 'fr') desc limit 1) as caption,
            (select count(*)::int from public.media_people mp where mp.media_id = m.id) as people
     from public.media m
     where m.kind <> 'arms' and m.mime_type like 'image/%'
       and m.storage_path not like 'propositions/%'
     order by m.created_at desc limit 500`,
  );
  return { pending, proposals, albums, library };
}

export async function editablePhoto(
  q: Query,
  id: string,
): Promise<EditablePhoto | null> {
  const [m] = await q<{
    id: string;
    storage_path: string;
    width: number | null;
    height: number | null;
    kind: string;
    status: string;
    taken_date: string | null;
    taken_precision: DatePrecision | null;
    place_id: string | null;
    event_id: string | null;
    album_id: string | null;
    credit: string | null;
    provenance: string | null;
    rights: string | null;
    unidentified: boolean;
  }>("select * from public.media where id = $1", [id]);
  if (!m) return null;
  const texts = await q<{
    locale: Locale;
    caption: string | null;
    alt: string | null;
  }>("select locale, caption, alt from public.media_i18n where media_id = $1", [
    id,
  ]);
  const captions = blank();
  const alts = blank();
  for (const t of texts) {
    captions[t.locale] = t.caption ?? "";
    alts[t.locale] = t.alt ?? "";
  }
  const people = await q<{
    id: string;
    given_names: string | null;
    surname: string | null;
    epithet: string | null;
    box: number[] | null;
    portrait_id: string | null;
  }>(
    `select p.id, p.given_names, p.surname, p.epithet, mp.box, p.portrait_id
     from public.media_people mp join public.people p on p.id = mp.person_id
     where mp.media_id = $1`,
    [id],
  );
  return {
    id: m.id,
    path: m.storage_path,
    width: m.width,
    height: m.height,
    kind: m.kind,
    status: m.status,
    date:
      m.taken_date && m.taken_precision
        ? { date: m.taken_date, precision: m.taken_precision }
        : null,
    placeId: m.place_id,
    eventId: m.event_id,
    albumId: m.album_id,
    credit: m.credit ?? "",
    provenance: m.provenance ?? "",
    rights: m.rights ?? "",
    unidentified: m.unidentified,
    captions,
    alts,
    people: people.map((p) => ({
      id: p.id,
      name: personName(p),
      box:
        p.box?.length === 4
          ? (p.box as [number, number, number, number])
          : null,
      portrait: p.portrait_id === m.id,
    })),
  };
}

export async function eventChoices(q: Query, locale: Locale) {
  return q<{ id: string; title: string }>(
    `select e.id, (select title from public.events_i18n i where i.event_id = e.id
                   order by (i.locale = $1) desc, (i.locale = 'fr') desc limit 1) as title
     from public.events e order by e.event_date nulls last`,
    [locale],
  );
}

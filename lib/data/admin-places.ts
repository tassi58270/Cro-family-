import "server-only";
import type { Query } from "@/lib/db";
import type { FuzzyDate } from "@/lib/genealogie/dates";
import { routing, type Locale } from "@/lib/i18n/routing";
import type { EventKind, PlaceKind } from "./place-types";

/** Places and events as the dashboard edits them, every language at once. */

type Texts<K extends string> = Record<Locale, Record<K, string>>;

export type AdminPlace = {
  id: string;
  slug: string;
  kind: PlaceKind;
  lat: number | null;
  lng: number | null;
  country: string | null;
  periodStart: number | null;
  periodEnd: number | null;
  visitable: boolean;
  published: boolean;
  isDemo: boolean;
  people: string[];
  texts: Texts<"name" | "description" | "visit_info">;
};

export type AdminEvent = {
  id: string;
  slug: string;
  kind: EventKind;
  date: FuzzyDate | null;
  placeId: string | null;
  branchId: string | null;
  published: boolean;
  isDemo: boolean;
  people: string[];
  texts: Texts<"title" | "description">;
};

function texts<K extends string>(
  rows: ({ locale: Locale } & Record<string, unknown>)[],
  keys: readonly K[],
): Texts<K> {
  return Object.fromEntries(
    routing.locales.map((l) => {
      const row = rows.find((r) => r.locale === l);
      return [
        l,
        Object.fromEntries(
          keys.map((k) => [k, (row?.[k] as string | null) ?? ""]),
        ),
      ];
    }),
  ) as Texts<K>;
}

export async function loadAdminPlaces(q: Query) {
  const placeRows = await q<{
    id: string;
    slug: string;
    kind: PlaceKind;
    lat: number | null;
    lng: number | null;
    country_code: string | null;
    period_start: number | null;
    period_end: number | null;
    visitable: boolean;
    status: string;
    is_demo: boolean;
  }>(
    `select id, slug, kind, lat, lng, country_code, period_start, period_end, visitable, status, is_demo
     from public.places`,
  );
  const placeTexts = await q<{ id: string; locale: Locale }>(
    "select place_id as id, locale, name, description, visit_info from public.places_i18n",
  );
  const placePeople = await q<{ id: string; person_id: string }>(
    "select place_id as id, person_id from public.place_people",
  );
  const eventRows = await q<{
    id: string;
    slug: string;
    kind: EventKind;
    event_date: string | null;
    event_precision: FuzzyDate["precision"] | null;
    place_id: string | null;
    branch_id: string | null;
    status: string;
    is_demo: boolean;
  }>(
    `select id, slug, kind, event_date::text, event_precision, place_id, branch_id, status, is_demo
     from public.events order by event_date nulls last, created_at`,
  );
  const eventTexts = await q<{ id: string; locale: Locale }>(
    "select event_id as id, locale, title, description from public.events_i18n",
  );
  const eventPeople = await q<{ id: string; person_id: string }>(
    "select event_id as id, person_id from public.event_people",
  );
  const branches = await q<{ id: string; name: string }>(
    `select b.id, coalesce((select name from public.branches_i18n bi
       where bi.branch_id = b.id order by (bi.locale = 'fr') desc limit 1), b.slug) as name
     from public.branches b order by b.sort_order, b.slug`,
  );

  const collator = new Intl.Collator("fr");
  const places: AdminPlace[] = placeRows
    .map((r) => ({
      id: r.id,
      slug: r.slug,
      kind: r.kind,
      lat: r.lat,
      lng: r.lng,
      country: r.country_code,
      periodStart: r.period_start,
      periodEnd: r.period_end,
      visitable: r.visitable,
      published: r.status === "published",
      isDemo: r.is_demo,
      people: placePeople.filter((p) => p.id === r.id).map((p) => p.person_id),
      texts: texts(
        placeTexts.filter((t) => t.id === r.id),
        ["name", "description", "visit_info"] as const,
      ),
    }))
    .sort((a, b) =>
      collator.compare(a.texts.fr.name || a.slug, b.texts.fr.name || b.slug),
    );
  const events: AdminEvent[] = eventRows.map((r) => ({
    id: r.id,
    slug: r.slug,
    kind: r.kind,
    date:
      r.event_date && r.event_precision
        ? { date: r.event_date.slice(0, 10), precision: r.event_precision }
        : null,
    placeId: r.place_id,
    branchId: r.branch_id,
    published: r.status === "published",
    isDemo: r.is_demo,
    people: eventPeople.filter((p) => p.id === r.id).map((p) => p.person_id),
    texts: texts(
      eventTexts.filter((t) => t.id === r.id),
      ["title", "description"] as const,
    ),
  }));
  return { places, events, branches };
}

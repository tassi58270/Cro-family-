"use server";

import {
  asAdmin,
  id,
  ids,
  newSlug,
  saveTexts,
  text,
  year,
} from "@/lib/admin/form";
import type { Query } from "@/lib/db";
import { EVENT_KINDS, PLACE_KINDS } from "@/lib/data/place-types";
import { parseCoordinates } from "@/lib/carte/coordinates";
import { parseFuzzyDate } from "@/lib/genealogie/dates";

/**
 * Places and events (cahier des charges, 6.6), entered by an administrator.
 * Every change is journaled by the database.
 */

export type PlaceFormState = {
  status: "idle" | "saved" | "invalid" | "error";
  /** Field → message key under admin.places.errors. */
  errors?: Record<
    string,
    "required" | "year" | "order" | "coordinates" | "date"
  >;
  savedAt?: number;
};

const saved = (): PlaceFormState => ({ status: "saved", savedAt: Date.now() });

async function setPeople(
  q: Query,
  table: "place_people" | "event_people",
  key: "place_id" | "event_id",
  rowId: string,
  people: string[],
) {
  await q(
    `delete from public.${table} where ${key} = $1 and not (person_id = any($2))`,
    [rowId, people],
  );
  for (const person of people)
    await q(
      `insert into public.${table} (${key}, person_id) values ($1, $2) on conflict do nothing`,
      [rowId, person],
    );
}

export async function savePlace(
  _previous: PlaceFormState,
  form: FormData,
): Promise<PlaceFormState> {
  const errors: PlaceFormState["errors"] = {};
  const place = id(form, "id");
  const rawPoint = text(form, "coordinates");
  const point = parseCoordinates(rawPoint);
  const start = year(form, "periodStart");
  const end = year(form, "periodEnd");
  if (!text(form, "name_fr")) errors.name_fr = "required";
  if (rawPoint && !point) errors.coordinates = "coordinates";
  if (start === "invalid") errors.periodStart = "year";
  if (end === "invalid") errors.periodEnd = "year";
  if (typeof start === "number" && typeof end === "number" && end < start)
    errors.periodEnd = "order";
  if (Object.keys(errors).length) return { status: "invalid", errors };
  const kind = text(form, "kind");
  const country = text(form, "country").toUpperCase();
  const values = [
    (PLACE_KINDS as readonly string[]).includes(kind) ? kind : "other",
    point?.[0] ?? null,
    point?.[1] ?? null,
    /^[A-Z]{2}$/.test(country) ? country : null,
    start,
    end,
    form.get("visitable") === "on",
    form.get("published") === "on" ? "published" : "draft",
  ];
  try {
    await asAdmin(async (q, session) => {
      let row = place;
      if (row) {
        await q(
          `update public.places set kind = $1, lat = $2, lng = $3, country_code = $4,
             period_start = $5, period_end = $6, visitable = $7, status = $8 where id = $9`,
          [...values, row],
        );
      } else {
        const [created] = await q<{ id: string }>(
          `insert into public.places
             (kind, lat, lng, country_code, period_start, period_end, visitable, status, slug, created_by)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,
          [
            ...values,
            await newSlug(q, "places", text(form, "name_fr")),
            session.accountId,
          ],
        );
        row = created.id;
      }
      await saveTexts(q, "places_i18n", "place_id", row, form, [
        "name",
        "description",
        "visit_info",
      ]);
      await setPeople(q, "place_people", "place_id", row, ids(form, "people"));
    });
    return saved();
  } catch (error) {
    console.error(error);
    return { status: "error" };
  }
}

export async function deletePlace(form: FormData): Promise<void> {
  const place = id(form, "id");
  if (!place) return;
  await asAdmin((q) => q("delete from public.places where id = $1", [place]));
}

export async function saveEvent(
  _previous: PlaceFormState,
  form: FormData,
): Promise<PlaceFormState> {
  const errors: PlaceFormState["errors"] = {};
  const event = id(form, "id");
  const rawDate = text(form, "date");
  const date = rawDate ? parseFuzzyDate(rawDate) : null;
  if (!text(form, "title_fr")) errors.title_fr = "required";
  if (rawDate && !date) errors.date = "date";
  if (Object.keys(errors).length) return { status: "invalid", errors };
  const kind = text(form, "kind");
  const values = [
    (EVENT_KINDS as readonly string[]).includes(kind) ? kind : "other",
    date?.date ?? null,
    date?.precision ?? null,
    id(form, "place"),
    id(form, "branch"),
    form.get("published") === "on" ? "published" : "draft",
  ];
  try {
    await asAdmin(async (q, session) => {
      let row = event;
      if (row) {
        await q(
          `update public.events set kind = $1, event_date = $2, event_precision = $3,
             place_id = $4, branch_id = $5, status = $6 where id = $7`,
          [...values, row],
        );
      } else {
        const [created] = await q<{ id: string }>(
          `insert into public.events
             (kind, event_date, event_precision, place_id, branch_id, status, slug, created_by)
           values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
          [
            ...values,
            await newSlug(
              q,
              "events",
              [text(form, "title_fr"), date?.date.slice(0, 4)]
                .filter(Boolean)
                .join(" "),
            ),
            session.accountId,
          ],
        );
        row = created.id;
      }
      await saveTexts(q, "events_i18n", "event_id", row, form, [
        "title",
        "description",
      ]);
      await setPeople(q, "event_people", "event_id", row, ids(form, "people"));
    });
    return saved();
  } catch (error) {
    console.error(error);
    return { status: "error" };
  }
}

export async function deleteEvent(form: FormData): Promise<void> {
  const event = id(form, "id");
  if (!event) return;
  await asAdmin((q) => q("delete from public.events where id = $1", [event]));
}

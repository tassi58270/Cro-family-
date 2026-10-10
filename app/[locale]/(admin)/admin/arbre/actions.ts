"use server";

import { getSession, viewerOf } from "@/lib/auth/session";
import { findOrCreatePlace } from "@/lib/data/places";
import { contentChanged } from "@/lib/data/revalidate";
import { withViewer, type Query } from "@/lib/db";
import { parseFuzzyDate, type FuzzyDate } from "@/lib/genealogie/dates";
import { slugify, uniqueSlug } from "@/lib/slug";

export type Relation = "none" | "parent" | "partner" | "child";

export type PersonFormState = {
  status: "idle" | "saved" | "invalid" | "error";
  personId?: string;
  /** Field name → message key under admin.person.errors. */
  errors?: Record<string, string>;
  /** Changes with every save, so the form knows to close. */
  savedAt?: number;
};

type Fields = {
  givenNames: string;
  surname: string;
  epithet: string;
  sex: "female" | "male" | "unknown";
  birth: FuzzyDate | null;
  birthPlace: string;
  death: FuzzyDate | null;
  deathPlace: string;
  deceased: boolean;
  published: boolean;
  marriage: FuzzyDate | null;
  marriagePlace: string;
};

function text(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

function readFields(form: FormData): {
  fields?: Fields;
  errors?: Record<string, string>;
} {
  const errors: Record<string, string> = {};
  const date = (name: string) => {
    const raw = text(form, name);
    if (!raw) return null;
    const parsed = parseFuzzyDate(raw);
    if (!parsed) errors[name] = "date";
    return parsed;
  };
  const sexValue = text(form, "sex");
  const fields: Fields = {
    givenNames: text(form, "givenNames"),
    surname: text(form, "surname"),
    epithet: text(form, "epithet"),
    sex: sexValue === "female" || sexValue === "male" ? sexValue : "unknown",
    birth: date("birth"),
    birthPlace: text(form, "birthPlace"),
    death: date("death"),
    deathPlace: text(form, "deathPlace"),
    deceased: form.get("deceased") === "on",
    published: form.get("published") === "on",
    marriage: date("marriage"),
    marriagePlace: text(form, "marriagePlace"),
  };
  if (!fields.givenNames && !fields.surname) errors.givenNames = "name";
  if (fields.birth && fields.death && fields.death.date < fields.birth.date) {
    errors.death = "order";
  }
  return Object.keys(errors).length ? { errors } : { fields };
}

async function slugFor(q: Query, f: Fields) {
  const base = slugify(
    [f.givenNames, f.surname, f.birth?.date.slice(0, 4)]
      .filter(Boolean)
      .join(" "),
  );
  return uniqueSlug(base, async (s) =>
    Boolean(
      (await q("select 1 from public.people where slug = $1", [s])).length,
    ),
  );
}

async function unionBetween(q: Query, a: string, b: string) {
  const [row] = await q<{ id: string }>(
    `select id from public.unions
     where (partner_a = $1 and partner_b = $2) or (partner_a = $2 and partner_b = $1)
     limit 1`,
    [a, b],
  );
  return row?.id ?? null;
}

async function nextUnionOrder(q: Query, person: string) {
  const [row] = await q<{ n: number }>(
    `select count(*) as n from public.unions where partner_a = $1 or partner_b = $1`,
    [person],
  );
  return row.n + 1;
}

/**
 * Creates or updates a person from the quick form of the family editor and,
 * for a new person, links them to the person they were added from: as a
 * parent, a partner or a child. Everything happens in one transaction, as
 * the signed-in administrator, so the access rules of the database apply.
 */
export async function savePerson(
  _previous: PersonFormState,
  form: FormData,
): Promise<PersonFormState> {
  const session = await getSession();
  if (!session || session.role !== "admin") return { status: "error" };

  const { fields, errors } = readFields(form);
  if (!fields) return { status: "invalid", errors };

  const editId = text(form, "id") || null;
  const relation = (text(form, "relation") || "none") as Relation;
  const relativeId = text(form, "relativeId") || null;
  const unionChoice = text(form, "unionId");

  try {
    const personId = await withViewer(viewerOf(session), async (q) => {
      const birthPlace = await findOrCreatePlace(q, fields.birthPlace);
      const deathPlace = await findOrCreatePlace(q, fields.deathPlace);
      const values = [
        fields.givenNames || null,
        fields.surname || null,
        fields.epithet || null,
        fields.sex,
        fields.birth?.date ?? null,
        fields.birth?.precision ?? null,
        birthPlace,
        fields.death?.date ?? null,
        fields.death?.precision ?? null,
        deathPlace,
        fields.deceased || Boolean(fields.death),
        fields.published ? "published" : "draft",
      ];

      if (editId) {
        await q(
          `update public.people set
             given_names = $1, surname = $2, epithet = $3, sex = $4,
             birth_date = $5, birth_precision = $6, birth_place_id = $7,
             death_date = $8, death_precision = $9, death_place_id = $10,
             deceased = $11, status = $12
           where id = $13`,
          [...values, editId],
        );
        return editId;
      }

      const [created] = await q<{ id: string }>(
        `insert into public.people
           (given_names, surname, epithet, sex, birth_date, birth_precision,
            birth_place_id, death_date, death_precision, death_place_id,
            deceased, status, slug, created_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         returning id`,
        [...values, await slugFor(q, fields), session.accountId],
      );
      const id = created.id;
      const status = fields.published ? "published" : "draft";

      if (relation === "parent" && relativeId) {
        // The other parent, if already known, becomes this one's partner.
        const [other] = await q<{ parent_id: string }>(
          `select parent_id from public.parent_child where child_id = $1 limit 1`,
          [relativeId],
        );
        let unionId: string | null = null;
        if (other) {
          unionId =
            (await unionBetween(q, other.parent_id, id)) ??
            (
              await q<{ id: string }>(
                `insert into public.unions (partner_a, partner_b, union_order, status, created_by)
                 values ($1, $2, $3, $4, $5) returning id`,
                [
                  other.parent_id,
                  id,
                  await nextUnionOrder(q, other.parent_id),
                  status,
                  session.accountId,
                ],
              )
            )[0].id;
          await q(
            `update public.parent_child set union_id = $1
             where child_id = $2 and parent_id = $3 and union_id is null`,
            [unionId, relativeId, other.parent_id],
          );
        }
        await q(
          `insert into public.parent_child (parent_id, child_id, union_id, status, created_by)
           values ($1, $2, $3, $4, $5)`,
          [id, relativeId, unionId, status, session.accountId],
        );
      }

      if (relation === "partner" && relativeId) {
        const place = await findOrCreatePlace(q, fields.marriagePlace);
        await q(
          `insert into public.unions
             (partner_a, partner_b, union_order, marriage_date, marriage_precision,
              place_id, status, created_by)
           values ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            relativeId,
            id,
            await nextUnionOrder(q, relativeId),
            fields.marriage?.date ?? null,
            fields.marriage?.precision ?? null,
            place,
            status,
            session.accountId,
          ],
        );
      }

      if (relation === "child" && relativeId) {
        const unionId =
          unionChoice && unionChoice !== "none" ? unionChoice : null;
        await q(
          `insert into public.parent_child (parent_id, child_id, union_id, status, created_by)
           values ($1, $2, $3, $4, $5)`,
          [relativeId, id, unionId, status, session.accountId],
        );
        if (unionId) {
          const [union] = await q<{ partner: string | null }>(
            `select case when partner_a = $2 then partner_b else partner_a end as partner
             from public.unions where id = $1`,
            [unionId, relativeId],
          );
          if (union?.partner) {
            await q(
              `insert into public.parent_child (parent_id, child_id, union_id, status, created_by)
               values ($1, $2, $3, $4, $5) on conflict do nothing`,
              [union.partner, id, unionId, status, session.accountId],
            );
          }
        }
      }

      return id;
    });

    contentChanged();
    return { status: "saved", personId, savedAt: Date.now() };
  } catch (error) {
    console.error(error);
    return { status: "error" };
  }
}

/** Removes a person and their links. The journal keeps everything for undoing. */
export async function deletePerson(form: FormData): Promise<void> {
  const session = await getSession();
  if (!session || session.role !== "admin") return;
  const id = text(form, "id");
  if (!id) return;
  await withViewer(viewerOf(session), (q) =>
    q("delete from public.people where id = $1", [id]),
  );
  contentChanged();
}

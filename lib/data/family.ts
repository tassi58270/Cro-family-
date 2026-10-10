import "server-only";
import type { DatePrecision } from "@/lib/genealogie/dates";
import type { Query } from "@/lib/db";

export type PersonSummary = {
  id: string;
  slug: string;
  given_names: string | null;
  surname: string | null;
  epithet: string | null;
  sex: "female" | "male" | "unknown";
  birth_date: string | null;
  birth_precision: DatePrecision | null;
  birth_place: string | null;
  death_date: string | null;
  death_precision: DatePrecision | null;
  death_place: string | null;
  deceased: boolean;
  status: "draft" | "pending" | "published" | "rejected";
  is_demo: boolean;
};

export type UnionSummary = {
  id: string;
  union_order: number;
  marriage_date: string | null;
  marriage_precision: DatePrecision | null;
  marriage_place: string | null;
  partner: PersonSummary | null;
};

export type ChildSummary = PersonSummary & { union_id: string | null };

export type FamilyFocus = {
  person: PersonSummary;
  parents: PersonSummary[];
  unions: UnionSummary[];
  children: ChildSummary[];
  siblings: PersonSummary[];
};

const PERSON_COLUMNS = `
  p.id, p.slug, p.given_names, p.surname, p.epithet, p.sex,
  p.birth_date, p.birth_precision, bp.name as birth_place,
  p.death_date, p.death_precision, dp.name as death_place,
  p.deceased, p.status, p.is_demo`;

const PLACE_JOINS = `
  left join public.places_i18n bp on bp.place_id = p.birth_place_id and bp.locale = 'fr'
  left join public.places_i18n dp on dp.place_id = p.death_place_id and dp.locale = 'fr'`;

const ORDER = "p.birth_date nulls last, p.created_at";

/** A person and their close family, as the database lets the viewer see them. */
export async function familyFocus(
  q: Query,
  personId: string,
): Promise<FamilyFocus | null> {
  const [person] = await q<PersonSummary>(
    `select ${PERSON_COLUMNS} from public.people p ${PLACE_JOINS} where p.id = $1`,
    [personId],
  );
  if (!person) return null;

  const parents = await q<PersonSummary>(
    `select ${PERSON_COLUMNS}
     from public.parent_child pc
     join public.people p on p.id = pc.parent_id ${PLACE_JOINS}
     where pc.child_id = $1 order by p.sex desc, ${ORDER}`,
    [personId],
  );

  const unionRows = await q<
    Omit<UnionSummary, "partner"> & { partner_id: string | null }
  >(
    `select u.id, u.union_order, u.marriage_date, u.marriage_precision,
            mp.name as marriage_place,
            case when u.partner_a = $1 then u.partner_b else u.partner_a end as partner_id
     from public.unions u
     left join public.places_i18n mp on mp.place_id = u.place_id and mp.locale = 'fr'
     where u.partner_a = $1 or u.partner_b = $1
     order by u.union_order, u.created_at`,
    [personId],
  );
  const partnerIds = unionRows.map((u) => u.partner_id).filter(Boolean);
  const partners = partnerIds.length
    ? await q<PersonSummary>(
        `select ${PERSON_COLUMNS} from public.people p ${PLACE_JOINS}
         where p.id = any($1::uuid[])`,
        [partnerIds],
      )
    : [];
  const unions = unionRows.map(({ partner_id, ...u }) => ({
    ...u,
    partner: partners.find((p) => p.id === partner_id) ?? null,
  }));

  const children = await q<ChildSummary>(
    `select ${PERSON_COLUMNS}, pc.union_id
     from public.parent_child pc
     join public.people p on p.id = pc.child_id ${PLACE_JOINS}
     where pc.parent_id = $1 order by ${ORDER}`,
    [personId],
  );

  const siblings = await q<PersonSummary>(
    `select distinct on (p.id) ${PERSON_COLUMNS}
     from public.parent_child mine
     join public.parent_child theirs on theirs.parent_id = mine.parent_id
     join public.people p on p.id = theirs.child_id ${PLACE_JOINS}
     where mine.child_id = $1 and theirs.child_id <> $1
     order by p.id`,
    [personId],
  );

  return { person, parents, unions, children, siblings };
}

/** Where the editor opens when no person is chosen: the eldest ancestor. */
export async function defaultFocusId(q: Query): Promise<string | null> {
  const [row] = await q<{ id: string }>(
    `select p.id from public.people p
     where not exists (select 1 from public.parent_child pc where pc.child_id = p.id)
     order by (select count(*) from public.parent_child pc where pc.parent_id = p.id) desc,
              p.birth_date nulls last, p.created_at
     limit 1`,
  );
  return row?.id ?? null;
}

export async function countPeople(q: Query): Promise<number> {
  const [row] = await q<{ n: number }>(
    "select count(*) as n from public.people",
  );
  return row.n;
}

import "server-only";
import type { Query } from "@/lib/db";
import type { DatePrecision } from "@/lib/genealogie/dates";
import { lifespanYears, personName } from "@/lib/genealogie/names";

/**
 * The People screen (section 7): everyone, what each sheet still lacks
 * (« Fiche complète ou non »), and the possible duplicates to merge.
 */

export type Missing = "dates" | "portrait" | "biography" | "translations";

export type AdminPerson = {
  id: string;
  slug: string;
  name: string;
  years: string;
  branch: string | null;
  published: boolean;
  isDemo: boolean;
  missing: Missing[];
};

export async function loadPeopleAdmin(q: Query) {
  const rows = await q<{
    id: string;
    slug: string;
    given_names: string | null;
    surname: string | null;
    epithet: string | null;
    birth_date: string | null;
    birth_precision: DatePrecision | null;
    death_date: string | null;
    death_precision: DatePrecision | null;
    deceased: boolean;
    status: string;
    is_demo: boolean;
    has_portrait: boolean;
    bio_fr: boolean;
    bio_others: number;
    branch: string | null;
  }>(
    `select p.id, p.slug, p.given_names, p.surname, p.epithet, p.birth_date, p.birth_precision,
            p.death_date, p.death_precision, p.deceased, p.status, p.is_demo,
            p.portrait_id is not null as has_portrait,
            exists (select 1 from public.people_i18n i where i.person_id = p.id
                    and i.locale = 'fr' and coalesce(i.biography, '') <> '') as bio_fr,
            (select count(*)::int from public.people_i18n i where i.person_id = p.id
             and i.locale <> 'fr' and coalesce(i.biography, '') <> '') as bio_others,
            (select name from public.branches_i18n b where b.branch_id = p.branch_id
             order by (b.locale = 'fr') desc limit 1) as branch
     from public.people p
     order by p.surname nulls last, p.given_names nulls last, p.birth_date nulls last`,
  );
  const people: AdminPerson[] = rows.map((r) => {
    const missing: Missing[] = [];
    if (!r.birth_date && !r.death_date) missing.push("dates");
    if (!r.has_portrait) missing.push("portrait");
    if (!r.bio_fr) missing.push("biography");
    else if (r.bio_others < 2) missing.push("translations");
    return {
      id: r.id,
      slug: r.slug,
      name: personName(r) || "—",
      years: lifespanYears(r),
      branch: r.branch,
      published: r.status === "published",
      isDemo: r.is_demo,
      missing,
    };
  });
  // Same name and same year of birth (or none): probably the same person.
  const groups = await q<{ ids: string[] }>(
    `select array_agg(id order by created_at) as ids from public.people
     group by lower(trim(coalesce(given_names, ''))), lower(trim(coalesce(surname, ''))),
              extract(year from birth_date)
     having count(*) > 1 and max(coalesce(given_names, surname, '')) <> ''`,
  );
  return { people, duplicates: groups.map((g) => g.ids) };
}

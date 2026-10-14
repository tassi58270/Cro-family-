import "server-only";
import type { Query } from "@/lib/db";
import { formatFuzzyDate, type DatePrecision } from "@/lib/genealogie/dates";
import { personName } from "@/lib/genealogie/names";
import type { Locale } from "@/lib/i18n/routing";

/** Titles and who held them, as the dashboard edits them (section 7). */

export type AdminTitle = {
  id: string;
  slug: string;
  created: string;
  creator: string;
  branchId: string | null;
  published: boolean;
  isDemo: boolean;
  texts: Record<Locale, { name: string; description: string }>;
  holders: {
    personId: string;
    name: string;
    rank: number | null;
    from: string;
    to: string;
  }[];
};

type DateCols = { date: string | null; precision: DatePrecision | null };
const written = ({ date, precision }: DateCols) =>
  date && precision ? formatFuzzyDate({ date, precision }, "fr") : "";

export async function loadAdminTitles(q: Query): Promise<AdminTitle[]> {
  const rows = await q<{
    id: string;
    slug: string;
    created_date: string | null;
    created_precision: DatePrecision | null;
    creator: string | null;
    branch_id: string | null;
    status: string;
    is_demo: boolean;
  }>(
    `select id, slug, created_date::text, created_precision, creator, branch_id, status, is_demo
     from public.titles order by sort_order, created_at`,
  );
  const texts = await q<{
    title_id: string;
    locale: Locale;
    name: string;
    description: string | null;
  }>("select title_id, locale, name, description from public.titles_i18n");
  const holders = await q<{
    title_id: string;
    person_id: string;
    rank: number | null;
    start_date: string | null;
    start_precision: DatePrecision | null;
    end_date: string | null;
    end_precision: DatePrecision | null;
    given_names: string | null;
    surname: string | null;
    epithet: string | null;
  }>(
    `select pt.title_id, pt.person_id, pt.rank, pt.start_date::text, pt.start_precision,
            pt.end_date::text, pt.end_precision, p.given_names, p.surname, p.epithet
     from public.people_titles pt join public.people p on p.id = pt.person_id
     order by pt.rank nulls last, pt.start_date nulls last`,
  );
  const empty = { name: "", description: "" };
  return rows.map((r) => {
    const own = (l: Locale) => {
      const t = texts.find((x) => x.title_id === r.id && x.locale === l);
      return t ? { name: t.name, description: t.description ?? "" } : empty;
    };
    return {
      id: r.id,
      slug: r.slug,
      created: written({
        date: r.created_date,
        precision: r.created_precision,
      }),
      creator: r.creator ?? "",
      branchId: r.branch_id,
      published: r.status === "published",
      isDemo: r.is_demo,
      texts: { fr: own("fr"), en: own("en"), de: own("de") },
      holders: holders
        .filter((h) => h.title_id === r.id)
        .map((h) => ({
          personId: h.person_id,
          name: personName(h),
          rank: h.rank,
          from: written({ date: h.start_date, precision: h.start_precision }),
          to: written({ date: h.end_date, precision: h.end_precision }),
        })),
    };
  });
}

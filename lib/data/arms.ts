import "server-only";
import { cache } from "react";
import { hasDatabase, VISITOR, withViewer, type Query } from "@/lib/db";
import type { DatePrecision } from "@/lib/genealogie/dates";
import { lifespanYears, personName } from "@/lib/genealogie/names";
import type { Locale } from "@/lib/i18n/routing";
import { typeset } from "@/lib/typography";

/**
 * The arms and branches page (cahier des charges, 6.3): every coat of arms
 * the family has entered, every branch with its people, founder, last
 * representative and fate. Read as a visitor: the page is built in advance.
 */

export type PersonLink = {
  slug: string | null;
  name: string | null;
  years: string;
};

export type ArmsItem = {
  id: string;
  slug: string;
  kind: "family" | "alliance" | "commune";
  builtin: string | null;
  url: string | null;
  name: string;
  blazon: string | null;
  explanation: string | null;
  bearers: string | null;
  periodStart: number | null;
  periodEnd: number | null;
  familyName: string | null;
  branch: { slug: string; name: string } | null;
  person: PersonLink | null;
  isDemo: boolean;
};

export type BranchItem = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  fate: string | null;
  color: string | null;
  extinct: boolean;
  extinctMale: number | null;
  extinctFemale: number | null;
  parent: string | null;
  founder: PersonLink | null;
  last: PersonLink | null;
  /** Everyone of the branch, living people counted but never named. */
  people: number;
  /** Year the branch starts: its founder's birth, or its oldest member's. */
  start: number | null;
  arms: number;
  isDemo: boolean;
};

export type ArmsPage = { arms: ArmsItem[]; branches: BranchItem[] };

type PersonRow = {
  id: string;
  slug: string | null;
  given_names: string | null;
  surname: string | null;
  epithet: string | null;
  birth_date: string | null;
  birth_precision: DatePrecision | null;
  death_date: string | null;
  death_precision: DatePrecision | null;
  deceased: boolean | null;
  branch_id: string | null;
  hidden: boolean;
};

function pick<T extends { locale: Locale }>(
  rows: T[],
  locale: Locale,
): T | undefined {
  return (
    rows.find((r) => r.locale === locale) ??
    rows.find((r) => r.locale === "fr") ??
    rows[0]
  );
}

function text(value: string | null | undefined, locale: Locale) {
  return value?.trim() ? typeset(value, locale) : null;
}

async function build(
  q: Query,
  locale: Locale,
): Promise<ArmsPage & { peopleRows: PersonRow[] }> {
  const peopleRows = await q<PersonRow>(
    `select id, slug, given_names, surname, epithet, birth_date, birth_precision,
            death_date, death_precision, deceased, branch_id, hidden
     from public.tree_people()`,
  );
  const people = new Map(peopleRows.map((p) => [p.id, p]));
  const link = (id: string | null): PersonLink | null => {
    const p = id ? people.get(id) : undefined;
    if (!p) return null;
    if (p.hidden) return { slug: null, name: null, years: "" };
    return { slug: p.slug, name: personName(p), years: lifespanYears(p) };
  };

  const branchRows = await q<{
    id: string;
    slug: string;
    parent_id: string | null;
    founder_id: string | null;
    last_person_id: string | null;
    state: "extant" | "extinct";
    extinct_male_year: number | null;
    extinct_female_year: number | null;
    color: string | null;
    is_demo: boolean;
  }>("select * from public.branches order by sort_order, created_at");
  const branchTexts = await q<{
    branch_id: string;
    locale: Locale;
    name: string;
    description: string | null;
    fate: string | null;
  }>(
    "select branch_id, locale, name, description, fate from public.branches_i18n",
  );

  const armsRows = await q<{
    id: string;
    slug: string;
    kind: ArmsItem["kind"];
    builtin: string | null;
    svg_path: string | null;
    period_start: number | null;
    period_end: number | null;
    branch_id: string | null;
    person_id: string | null;
    family_name: string | null;
    is_demo: boolean;
  }>(
    `select a.id, a.slug, a.kind, a.builtin, m.storage_path as svg_path, a.period_start,
            a.period_end, a.branch_id, a.person_id, a.family_name, a.is_demo
     from public.arms a left join public.media m on m.id = a.svg_id
     order by a.sort_order, a.period_start nulls last, a.created_at`,
  );
  const armsTexts = await q<{
    arms_id: string;
    locale: Locale;
    name: string;
    blazon: string | null;
    explanation: string | null;
    bearers: string | null;
  }>(
    "select arms_id, locale, name, blazon, explanation, bearers from public.arms_i18n",
  );

  const branchName = (id: string) =>
    pick(
      branchTexts.filter((t) => t.branch_id === id),
      locale,
    )?.name ??
    branchRows.find((b) => b.id === id)?.slug ??
    "";

  const arms: ArmsItem[] = armsRows.map((a) => {
    const t = pick(
      armsTexts.filter((x) => x.arms_id === a.id),
      locale,
    );
    const branch = a.branch_id
      ? branchRows.find((b) => b.id === a.branch_id)
      : undefined;
    return {
      id: a.id,
      slug: a.slug,
      kind: a.kind,
      builtin: a.builtin,
      url: a.svg_path ? `/fichiers/${a.svg_path}` : null,
      name: t?.name ?? a.slug,
      blazon: text(t?.blazon, locale),
      explanation: text(t?.explanation, locale),
      bearers: text(t?.bearers, locale),
      periodStart: a.period_start,
      periodEnd: a.period_end,
      familyName: a.family_name,
      branch: branch
        ? { slug: branch.slug, name: branchName(branch.id) }
        : null,
      person: link(a.person_id),
      isDemo: a.is_demo,
    };
  });

  const branches: BranchItem[] = branchRows.map((b) => {
    const t = pick(
      branchTexts.filter((x) => x.branch_id === b.id),
      locale,
    );
    const members = peopleRows.filter((p) => p.branch_id === b.id);
    const year = (p: PersonRow | undefined) =>
      p?.birth_date ? Number(p.birth_date.slice(0, 4)) : null;
    const births = members.map(year).filter((y): y is number => y !== null);
    const founder = b.founder_id ? people.get(b.founder_id) : undefined;
    return {
      id: b.id,
      slug: b.slug,
      name: t?.name ?? b.slug,
      description: text(t?.description, locale),
      fate: text(t?.fate, locale),
      color: b.color,
      extinct: b.state === "extinct",
      extinctMale: b.extinct_male_year,
      extinctFemale: b.extinct_female_year,
      parent: b.parent_id
        ? (branchRows.find((x) => x.id === b.parent_id)?.slug ?? null)
        : null,
      founder: link(b.founder_id),
      last: link(b.last_person_id),
      people: members.length,
      start: year(founder) ?? (births.length ? Math.min(...births) : null),
      arms: arms.findIndex(
        (a) => a.branch?.slug === b.slug && a.kind === "family",
      ),
      isDemo: b.is_demo,
    };
  });

  return { arms, branches, peopleRows };
}

export const loadArmsPage = cache(async (locale: Locale): Promise<ArmsPage> => {
  if (!hasDatabase()) return { arms: [], branches: [] };
  const { arms, branches } = await withViewer(VISITOR, (q) => build(q, locale));
  return { arms, branches };
});

export type BranchPage = ArmsPage & {
  branch: BranchItem;
  members: (PersonLink & { birth: number | null })[];
  living: number;
};

/** One branch, with its people, for its own page. */
export const loadBranchPage = cache(
  async (slug: string, locale: Locale): Promise<BranchPage | null> => {
    if (!hasDatabase()) return null;
    return withViewer(VISITOR, async (q) => {
      const { arms, branches, peopleRows } = await build(q, locale);
      const branch = branches.find((b) => b.slug === slug);
      if (!branch) return null;
      const members = peopleRows
        .filter((p) => p.branch_id === branch.id && !p.hidden)
        .map((p) => ({
          slug: p.slug,
          name: personName(p),
          years: lifespanYears(p),
          birth: p.birth_date ? Number(p.birth_date.slice(0, 4)) : null,
        }))
        .sort((a, b) => (a.birth ?? 9999) - (b.birth ?? 9999));
      const living = peopleRows.filter(
        (p) => p.branch_id === branch.id && p.hidden,
      ).length;
      return { arms, branches, branch, members, living };
    });
  },
);

export async function branchSlugs(): Promise<string[]> {
  if (!hasDatabase()) return [];
  const rows = await withViewer(VISITOR, (q) =>
    q<{ slug: string }>("select slug from public.branches"),
  ).catch(() => []);
  return rows.map((r) => r.slug);
}

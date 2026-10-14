import "server-only";
import type { Query } from "@/lib/db";
import { personName } from "@/lib/genealogie/names";
import { routing, type Locale } from "@/lib/i18n/routing";

/** Branches and arms as the dashboard edits them, every language at once. */

type Texts<K extends string> = Record<Locale, Record<K, string>>;

export type AdminBranch = {
  id: string;
  slug: string;
  parentId: string | null;
  founderId: string | null;
  founderName: string | null;
  lastPersonId: string | null;
  extinct: boolean;
  extinctMale: number | null;
  extinctFemale: number | null;
  color: string | null;
  published: boolean;
  isDemo: boolean;
  texts: Texts<"name" | "description" | "fate">;
};

export type AdminArms = {
  id: string;
  slug: string;
  kind: "family" | "alliance" | "commune";
  builtin: string | null;
  /** A file of the family's (SVG or picture), shown instead of a drawing. */
  filePath: string | null;
  branchId: string | null;
  personId: string | null;
  familyName: string | null;
  periodStart: number | null;
  periodEnd: number | null;
  published: boolean;
  isDemo: boolean;
  texts: Texts<"name" | "blazon" | "explanation" | "bearers">;
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

export async function loadAdminArms(q: Query) {
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
    status: string;
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
  const founders = await q<{
    id: string;
    given_names: string | null;
    surname: string | null;
    epithet: string | null;
  }>(
    `select id, given_names, surname, epithet from public.people
     where id in (select founder_id from public.branches)`,
  );
  const armsRows = await q<{
    id: string;
    slug: string;
    kind: AdminArms["kind"];
    builtin: string | null;
    branch_id: string | null;
    person_id: string | null;
    family_name: string | null;
    period_start: number | null;
    period_end: number | null;
    status: string;
    is_demo: boolean;
    file_path: string | null;
  }>(
    `select a.*, m.storage_path as file_path
     from public.arms a left join public.media m on m.id = a.svg_id
     order by a.sort_order, a.created_at`,
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

  const branches: AdminBranch[] = branchRows.map((b) => {
    const founder = founders.find((f) => f.id === b.founder_id);
    return {
      id: b.id,
      slug: b.slug,
      parentId: b.parent_id,
      founderId: b.founder_id,
      founderName: founder ? personName(founder) : null,
      lastPersonId: b.last_person_id,
      extinct: b.state === "extinct",
      extinctMale: b.extinct_male_year,
      extinctFemale: b.extinct_female_year,
      color: b.color,
      published: b.status === "published",
      isDemo: b.is_demo,
      texts: texts(
        branchTexts.filter((t) => t.branch_id === b.id),
        ["name", "description", "fate"] as const,
      ),
    };
  });
  const arms: AdminArms[] = armsRows.map((a) => ({
    id: a.id,
    slug: a.slug,
    kind: a.kind,
    builtin: a.builtin,
    filePath: a.file_path,
    branchId: a.branch_id,
    personId: a.person_id,
    familyName: a.family_name,
    periodStart: a.period_start,
    periodEnd: a.period_end,
    published: a.status === "published",
    isDemo: a.is_demo,
    texts: texts(
      armsTexts.filter((t) => t.arms_id === a.id),
      ["name", "blazon", "explanation", "bearers"] as const,
    ),
  }));
  return { branches, arms };
}

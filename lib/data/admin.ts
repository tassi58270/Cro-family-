import "server-only";
import type { Query } from "@/lib/db";

export type StartupStep = {
  key: "arms" | "home" | "ancestors" | "photos" | "cousins";
  done: boolean;
  /** Where to do it; null while the tool is built in a later step. */
  href: "/admin/arbre" | "/admin/import" | "/admin/accueil" | null;
};

/**
 * The first-sign-in assistant (cahier des charges, section 7, « Remplir le
 * site soi-même »): five things that bring the site to life.
 */
export async function startupSteps(q: Query): Promise<StartupStep[]> {
  const [c] = await q<{
    arms: number;
    people: number;
    media: number;
    invitations: number;
    summary: boolean;
  }>(
    `select
       (select count(*) from public.arms where not is_demo) as arms,
       (select count(*) from public.people where not is_demo) as people,
       (select count(*) from public.media where not is_demo) as media,
       (select count(*) from public.invitations) as invitations,
       exists (select 1 from public.home_i18n where locale = 'fr' and coalesce(summary, '') <> '') as summary`,
  );
  return [
    { key: "arms", done: c.arms > 0, href: null },
    { key: "home", done: c.summary, href: "/admin/accueil" },
    { key: "ancestors", done: c.people >= 3, href: "/admin/arbre" },
    { key: "photos", done: c.media > 0, href: null },
    { key: "cousins", done: c.invitations >= 3, href: null },
  ];
}

export async function overviewCounts(q: Query) {
  const [c] = await q<{
    people: number;
    living: number;
    drafts: number;
    suggestions: number;
    demo: boolean;
  }>(
    `select
       (select count(*) from public.people where not is_demo) as people,
       (select count(*) from public.people p where not is_demo
          and app.is_living(p.deceased, p.birth_date, p.birth_precision, p.death_date)) as living,
       (select count(*) from public.people where status in ('draft', 'pending')) as drafts,
       (select count(*) from public.suggestions where state in ('sent', 'reviewing')) as suggestions,
       exists (select 1 from public.people where is_demo) as demo`,
  );
  return c;
}

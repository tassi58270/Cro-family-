import "server-only";
import type { Query } from "@/lib/db";

export type StartupStep = {
  key: "arms" | "home" | "ancestors" | "photos" | "cousins";
  done: boolean;
  /** Where to do it. */
  href:
    | "/admin/arbre"
    | "/admin/accueil"
    | "/admin/armoiries"
    | "/compte/photos"
    | "/admin/membres";
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
    { key: "arms", done: c.arms > 0, href: "/admin/armoiries" },
    { key: "home", done: c.summary, href: "/admin/accueil" },
    { key: "ancestors", done: c.people >= 3, href: "/admin/arbre" },
    { key: "photos", done: c.media > 0, href: "/compte/photos" },
    { key: "cousins", done: c.invitations >= 3, href: "/admin/membres" },
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

/** What waits for an administrator, with where to handle it. */
export async function overviewTodo(q: Query) {
  const [c] = await q<{
    proposals: number;
    photoProposals: number;
    requests: number;
    photos: number;
    stories: number;
    incomplete: number;
  }>(
    `select
       (select count(*)::int from public.suggestions
        where state in ('sent', 'reviewing') and kind::text not in ('identification', 'removal')) as proposals,
       (select count(*)::int from public.suggestions
        where state = 'sent' and kind::text in ('identification', 'removal')) as "photoProposals",
       (select count(*)::int from public.access_requests where state = 'pending') as requests,
       (select count(*)::int from public.media where status = 'pending' and kind <> 'arms') as photos,
       (select count(*)::int from public.stories where status = 'pending') as stories,
       (select count(*)::int from public.people p
        where p.birth_date is null and p.death_date is null
           or p.portrait_id is null
           or not exists (select 1 from public.people_i18n i
                          where i.person_id = p.id and coalesce(i.biography, '') <> '')) as incomplete`,
  );
  return c;
}

import "server-only";
import type { Session } from "@/lib/auth/session";
import type { Query } from "@/lib/db";
import { summarize, type ProposalPayload } from "@/lib/contributions/kinds";
import { lifespanYears, personName } from "@/lib/genealogie/names";
import type { DatePrecision } from "@/lib/genealogie/dates";
import type { Locale } from "@/lib/i18n/routing";

/** The member space (section 7): profile, place in the tree, proposals. */

export type MyProposal = {
  id: string;
  kind: string;
  summary: string;
  state: "sent" | "reviewing" | "accepted" | "rejected";
  reply: string | null;
  createdAt: string;
};

export type MemberSpace = {
  displayName: string;
  locale: Locale;
  person: {
    slug: string;
    name: string;
    years: string;
    branch: { slug: string; name: string } | null;
  } | null;
  /** A « C’est moi » waiting for an administrator. */
  claimPending: boolean;
  proposals: MyProposal[];
};

export async function loadMemberSpace(
  q: Query,
  session: Session,
): Promise<MemberSpace> {
  const [profile] = await q<{
    display_name: string | null;
    preferred_locale: Locale;
  }>(
    "select display_name, preferred_locale from public.profiles where id = $1",
    [session.accountId],
  );
  const [person] = session.personId
    ? await q<{
        slug: string;
        given_names: string | null;
        surname: string | null;
        epithet: string | null;
        birth_date: string | null;
        birth_precision: DatePrecision | null;
        death_date: string | null;
        death_precision: DatePrecision | null;
        deceased: boolean | null;
        branch_slug: string | null;
        branch_name: string | null;
      }>(
        `select p.slug, p.given_names, p.surname, p.epithet, p.birth_date, p.birth_precision,
                p.death_date, p.death_precision, p.deceased, b.slug as branch_slug,
                (select name from public.branches_i18n bi where bi.branch_id = b.id
                 order by (bi.locale = $2) desc, (bi.locale = 'fr') desc limit 1) as branch_name
         from public.people p left join public.branches b on b.id = p.branch_id
         where p.id = $1`,
        [session.personId, session.locale],
      )
    : [];
  const rows = await q<{
    id: string;
    kind: string;
    payload: ProposalPayload;
    state: MyProposal["state"];
    admin_reply: string | null;
    created_at: string;
  }>(
    `select id, kind::text as kind, payload, state, admin_reply, created_at::text
     from public.suggestions where author_id = $1 order by created_at desc limit 100`,
    [session.accountId],
  );
  return {
    displayName: profile?.display_name ?? "",
    locale: profile?.preferred_locale ?? session.locale,
    person: person
      ? {
          slug: person.slug,
          name: personName(person),
          years: lifespanYears(person),
          branch:
            person.branch_slug && person.branch_name
              ? { slug: person.branch_slug, name: person.branch_name }
              : null,
        }
      : null,
    claimPending: rows.some(
      (r) =>
        r.kind === "claim" && (r.state === "sent" || r.state === "reviewing"),
    ),
    proposals: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      summary: summarize(r.kind, r.payload ?? {}),
      state: r.state,
      reply: r.admin_reply,
      createdAt: r.created_at,
    })),
  };
}

import "server-only";
import type { Query } from "@/lib/db";
import { summarize, type ProposalPayload } from "@/lib/contributions/kinds";
import { lifespanYears, personName } from "@/lib/genealogie/names";
import { formatFuzzyDate, type DatePrecision } from "@/lib/genealogie/dates";

/** The proposals queue of the dashboard (section 7). */

export type ProposalState = "sent" | "reviewing" | "accepted" | "rejected";

export type ProposalRow = {
  id: string;
  kind: string;
  state: ProposalState;
  summary: string;
  author: string;
  createdAt: string;
  reviewedAt: string | null;
};

export type ProposalDetail = ProposalRow & {
  payload: ProposalPayload;
  source: string | null;
  reply: string | null;
  authorEmail: string | null;
  target: {
    id: string;
    slug: string;
    name: string;
    years: string;
    /** The sheet as it is now, to compare with the proposal. */
    facts: { field: "birth" | "death" | "branch"; value: string }[];
  } | null;
  attachments: { id: string; path: string; type: string; name: string }[];
};

type Row = {
  id: string;
  kind: string;
  state: ProposalState;
  payload: ProposalPayload;
  source: string | null;
  admin_reply: string | null;
  author_id: string;
  target_table: string | null;
  target_id: string | null;
  attachments: string[];
  created_at: string;
  reviewed_at: string | null;
};

/** Photo proposals have their own screen (Photos). */
const HERE = "s.kind::text not in ('identification', 'removal')";

async function authors(q: Query) {
  const rows = await q<{
    id: string;
    email: string;
    display_name: string | null;
  }>("select id, email, display_name from public.admin_members()");
  return new Map(rows.map((r) => [r.id, r]));
}

function row(r: Row, people: Awaited<ReturnType<typeof authors>>): ProposalRow {
  const author = people.get(r.author_id);
  return {
    id: r.id,
    kind: r.kind,
    state: r.state,
    summary: summarize(r.kind, r.payload ?? {}),
    author: author?.display_name || author?.email || "—",
    createdAt: r.created_at,
    reviewedAt: r.reviewed_at,
  };
}

const COLUMNS = `s.id, s.kind::text as kind, s.state, s.payload, s.source, s.admin_reply, s.author_id,
  s.target_table, s.target_id, s.attachments::text[] as attachments, s.created_at::text,
  s.reviewed_at::text`;

export async function loadProposals(q: Query) {
  const people = await authors(q);
  const open = await q<Row>(
    `select ${COLUMNS} from public.suggestions s
     where ${HERE} and s.state in ('sent', 'reviewing') order by s.created_at`,
  );
  const closed = await q<Row>(
    `select ${COLUMNS} from public.suggestions s
     where ${HERE} and s.state in ('accepted', 'rejected')
     order by s.reviewed_at desc nulls last limit 50`,
  );
  return {
    open: open.map((r) => row(r, people)),
    closed: closed.map((r) => row(r, people)),
  };
}

export async function loadProposal(
  q: Query,
  id: string,
): Promise<ProposalDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [r] = await q<Row>(
    `select ${COLUMNS} from public.suggestions s where s.id = $1 and ${HERE}`,
    [id],
  );
  if (!r) return null;
  const people = await authors(q);
  const [target] =
    r.target_table === "people" && r.target_id
      ? await q<{
          id: string;
          slug: string;
          given_names: string | null;
          surname: string | null;
          epithet: string | null;
          birth_date: string | null;
          birth_precision: DatePrecision | null;
          death_date: string | null;
          death_precision: DatePrecision | null;
          deceased: boolean | null;
          birth_place: string | null;
          death_place: string | null;
          branch: string | null;
        }>(
          `select p.id, p.slug, p.given_names, p.surname, p.epithet, p.birth_date, p.birth_precision,
                  p.death_date, p.death_precision, p.deceased,
                  (select name from public.places_i18n i where i.place_id = p.birth_place_id and i.locale = 'fr') as birth_place,
                  (select name from public.places_i18n i where i.place_id = p.death_place_id and i.locale = 'fr') as death_place,
                  (select name from public.branches_i18n b where b.branch_id = p.branch_id and b.locale = 'fr') as branch
           from public.people p where p.id = $1`,
          [r.target_id],
        )
      : [];
  const attachments = r.attachments.length
    ? await q<{
        id: string;
        storage_path: string;
        mime_type: string;
        provenance: string | null;
      }>(
        "select id, storage_path, mime_type, provenance from public.media where id = any($1)",
        [r.attachments],
      )
    : [];
  return {
    ...row(r, people),
    payload: r.payload ?? {},
    source: r.source,
    reply: r.admin_reply,
    authorEmail: people.get(r.author_id)?.email ?? null,
    target: target
      ? {
          id: target.id,
          slug: target.slug,
          name: personName(target),
          years: lifespanYears(target),
          facts: [
            {
              field: "birth" as const,
              value: [
                target.birth_date && target.birth_precision
                  ? formatFuzzyDate(
                      {
                        date: target.birth_date,
                        precision: target.birth_precision,
                      },
                      "fr",
                    )
                  : null,
                target.birth_place,
              ]
                .filter(Boolean)
                .join(", "),
            },
            {
              field: "death" as const,
              value: [
                target.death_date && target.death_precision
                  ? formatFuzzyDate(
                      {
                        date: target.death_date,
                        precision: target.death_precision,
                      },
                      "fr",
                    )
                  : null,
                target.death_place,
              ]
                .filter(Boolean)
                .join(", "),
            },
            { field: "branch" as const, value: target.branch ?? "" },
          ].filter((f) => f.value),
        }
      : null,
    attachments: attachments.map((a) => ({
      id: a.id,
      path: a.storage_path,
      type: a.mime_type,
      name: a.provenance ?? a.storage_path.split("/").pop() ?? "",
    })),
  };
}

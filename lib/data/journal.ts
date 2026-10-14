import "server-only";
import type { Query } from "@/lib/db";

/**
 * The journal (section 7): who changed what and when, one line per change
 * (everything a single save wrote), with the values before and after.
 */

export type JournalEntry = {
  table: string;
  action: "insert" | "update" | "delete";
  label: string | null;
  /** For an update: the fields that changed. */
  fields: { name: string; before: string; after: string }[];
};

export type JournalChange = {
  at: string;
  /** The most telling name in the change: a title rather than an address. */
  label: string | null;
  actorId: string | null;
  actor: string | null;
  rows: number;
  reverted: boolean;
  /** This change undid the one made at this time. */
  undoes: string | null;
  entries: JournalEntry[];
};

const HIDDEN = new Set(["created_at", "updated_at"]);
const LABEL_FIELDS = [
  "title",
  "name",
  "display_name",
  "caption",
  "full_name",
  "email",
];

function labelOf(
  table: string,
  data: Record<string, unknown> | null,
  slug = true,
) {
  if (!data) return null;
  if (table === "people") {
    const name = [data.given_names, data.surname].filter(Boolean).join(" ");
    if (name) return name;
  }
  for (const field of slug ? [...LABEL_FIELDS, "slug"] : LABEL_FIELDS) {
    const value = data[field];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function show(value: unknown): string {
  if (value === null || value === undefined) return "—";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > 160 ? `${text.slice(0, 157)}…` : text;
}

export async function loadJournal(
  q: Query,
  { before, limit = 40 }: { before?: string | null; limit?: number } = {},
): Promise<JournalChange[]> {
  const changes = await q<{
    at: string;
    actor_id: string | null;
    rows: number;
    reverted: boolean;
    undoes: string | null;
  }>(
    `select at::text, actor_id, count(*)::int as rows,
            bool_and(reverted_at is not null) as reverted, max(undoes)::text as undoes
     from public.audit_log
     where ($1::timestamptz is null or at < $1::timestamptz)
     group by at, actor_id order by at desc limit $2`,
    [before ?? null, limit],
  );
  if (!changes.length) return [];
  const entries = await q<{
    at: string;
    actor_id: string | null;
    table_name: string;
    action: JournalEntry["action"];
    old_data: Record<string, unknown> | null;
    new_data: Record<string, unknown> | null;
  }>(
    `select at::text, actor_id, table_name, action, old_data, new_data from (
       select l.*, row_number() over (partition by at, actor_id order by id) as n
       from public.audit_log l where at::text = any($1)
     ) x where n <= 12 order by id`,
    [changes.map((c) => c.at)],
  );
  const members = await q<{
    id: string;
    email: string;
    display_name: string | null;
  }>("select id, email, display_name from public.admin_members()");
  return changes.map((c) => {
    const member = members.find((m) => m.id === c.actor_id);
    const own = entries.filter(
      (e) => e.at === c.at && e.actor_id === c.actor_id,
    );
    return {
      at: c.at,
      label:
        own
          .map(
            (e) =>
              labelOf(e.table_name, e.new_data, false) ??
              labelOf(e.table_name, e.old_data, false),
          )
          .find(Boolean) ??
        own
          .map(
            (e) =>
              labelOf(e.table_name, e.new_data) ??
              labelOf(e.table_name, e.old_data),
          )
          .find(Boolean) ??
        null,
      actorId: c.actor_id,
      actor: member ? member.display_name || member.email : null,
      rows: c.rows,
      reverted: c.reverted,
      undoes: c.undoes,
      entries: own.map((e) => ({
        table: e.table_name,
        action: e.action,
        label:
          labelOf(e.table_name, e.new_data) ??
          labelOf(e.table_name, e.old_data),
        fields:
          e.action === "update" && e.old_data && e.new_data
            ? Object.keys(e.new_data)
                .filter(
                  (k) =>
                    !HIDDEN.has(k) &&
                    JSON.stringify(e.old_data![k]) !==
                      JSON.stringify(e.new_data![k]),
                )
                .map((k) => ({
                  name: k,
                  before: show(e.old_data![k]),
                  after: show(e.new_data![k]),
                }))
            : [],
      })),
    };
  });
}

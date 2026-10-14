import "server-only";
import { getSession, viewerOf, type Session } from "@/lib/auth/session";
import { contentChanged } from "@/lib/data/revalidate";
import { withViewer, type Query } from "@/lib/db";
import { routing } from "@/lib/i18n/routing";
import { slugify, uniqueSlug } from "@/lib/slug";

/** What the dashboard forms share: reading fields, saving texts, rights. */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function text(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

export function id(form: FormData, name: string) {
  const value = text(form, name);
  return UUID.test(value) ? value : null;
}

export function ids(form: FormData, name: string) {
  return [
    ...new Set(
      form
        .getAll(name)
        .map(String)
        .filter((v) => UUID.test(v)),
    ),
  ];
}

export function year(form: FormData, name: string): number | null | "invalid" {
  const raw = text(form, name);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 && value < 3000
    ? value
    : "invalid";
}

/** Runs as the signed-in administrator, then regenerates the public pages. */
export async function asAdmin<T>(
  fn: (q: Query, session: Session) => Promise<T>,
) {
  const session = await getSession();
  if (!session || session.role !== "admin") throw new Error("forbidden");
  const result = await withViewer(viewerOf(session), (q) => fn(q, session));
  contentChanged();
  return result;
}

/**
 * The texts of each language, from fields named `{field}_{locale}`. A
 * language whose first field is empty is removed.
 */
export async function saveTexts(
  q: Query,
  table: string,
  key: string,
  rowId: string,
  form: FormData,
  fields: string[],
) {
  for (const locale of routing.locales) {
    const values = fields.map((f) => text(form, `${f}_${locale}`) || null);
    if (!values[0]) {
      await q(`delete from public.${table} where ${key} = $1 and locale = $2`, [
        rowId,
        locale,
      ]);
      continue;
    }
    await q(
      `insert into public.${table} (${key}, locale, ${fields.join(", ")}, translation)
       values ($1, $2, ${fields.map((_, i) => `$${i + 3}`).join(", ")}, $${fields.length + 3})
       on conflict (${key}, locale) do update set
         ${fields.map((f) => `${f} = excluded.${f}`).join(", ")}, translation = excluded.translation`,
      [rowId, locale, ...values, locale === "fr" ? "original" : "reviewed"],
    );
  }
}

export async function newSlug(q: Query, table: string, name: string) {
  return uniqueSlug(
    slugify(name) || table,
    async (s) =>
      (await q(`select 1 from public.${table} where slug = $1`, [s])).length >
      0,
  );
}

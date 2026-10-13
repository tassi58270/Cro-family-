"use server";

import { getSession, viewerOf, type Session } from "@/lib/auth/session";
import { contentChanged } from "@/lib/data/revalidate";
import { withViewer, type Query } from "@/lib/db";
import { routing } from "@/lib/i18n/routing";

/**
 * Entry points of the tree and lineages to demonstrate (cahier des charges,
 * 6.2), with the certainty and the proofs of each link. Administrators
 * only; every change is journaled by the database.
 */

export type TreeSettingsState = {
  status: "idle" | "saved" | "invalid" | "error";
  /** Field → message key under admin.lineages.errors. */
  errors?: Record<string, "required" | "person" | "same">;
  savedAt?: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CERTAINTIES = ["attested", "tradition", "debated"] as const;
const KINDS = [
  "document",
  "book",
  "archive",
  "website",
  "oral",
  "other",
] as const;

function text(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

function id(form: FormData, name: string) {
  const value = text(form, name);
  return UUID.test(value) ? value : null;
}

async function asAdmin<T>(fn: (q: Query, session: Session) => Promise<T>) {
  const session = await getSession();
  if (!session || session.role !== "admin") throw new Error("forbidden");
  const result = await withViewer(viewerOf(session), (q) => fn(q, session));
  contentChanged();
  return result;
}

const saved = (): TreeSettingsState => ({
  status: "saved",
  savedAt: Date.now(),
});

async function saveTexts(
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

export async function saveEntryPoint(
  _previous: TreeSettingsState,
  form: FormData,
): Promise<TreeSettingsState> {
  const person = id(form, "person");
  const errors: TreeSettingsState["errors"] = {};
  if (!person) errors.person = "person";
  if (!text(form, "label_fr")) errors.label_fr = "required";
  if (Object.keys(errors).length) return { status: "invalid", errors };
  const isDefault = form.get("isDefault") === "on";
  try {
    await asAdmin(async (q) => {
      if (isDefault)
        await q(
          "update public.tree_entry_points set is_default = false where is_default",
        );
      let entry = id(form, "id");
      if (entry) {
        await q(
          "update public.tree_entry_points set person_id = $1, is_default = $2, status = 'published' where id = $3",
          [person, isDefault, entry],
        );
      } else {
        const [row] = await q<{ id: string }>(
          `insert into public.tree_entry_points (person_id, is_default, status, sort_order)
           values ($1, $2, 'published', (select coalesce(max(sort_order), 0) + 1 from public.tree_entry_points))
           returning id`,
          [person, isDefault],
        );
        entry = row.id;
      }
      await saveTexts(q, "tree_entry_points_i18n", "entry_id", entry, form, [
        "label",
      ]);
    });
    return saved();
  } catch (error) {
    console.error(error);
    return { status: "error" };
  }
}

export async function deleteEntryPoint(form: FormData): Promise<void> {
  const entry = id(form, "id");
  if (!entry) return;
  await asAdmin((q) =>
    q("delete from public.tree_entry_points where id = $1", [entry]),
  );
}

export async function saveLineage(
  _previous: TreeSettingsState,
  form: FormData,
): Promise<TreeSettingsState> {
  const start = id(form, "start");
  const end = id(form, "end");
  const errors: TreeSettingsState["errors"] = {};
  if (!start) errors.start = "person";
  if (!end) errors.end = "person";
  if (start && end && start === end) errors.end = "same";
  if (!text(form, "title_fr")) errors.title_fr = "required";
  if (Object.keys(errors).length) return { status: "invalid", errors };
  try {
    await asAdmin(async (q) => {
      let lineage = id(form, "id");
      if (lineage) {
        await q(
          "update public.lineages set start_person_id = $1, end_person_id = $2, status = 'published' where id = $3",
          [start, end, lineage],
        );
      } else {
        const [row] = await q<{ id: string }>(
          `insert into public.lineages (start_person_id, end_person_id, status, sort_order)
           values ($1, $2, 'published', (select coalesce(max(sort_order), 0) + 1 from public.lineages))
           returning id`,
          [start, end],
        );
        lineage = row.id;
      }
      await saveTexts(q, "lineages_i18n", "lineage_id", lineage, form, [
        "title",
        "intro",
      ]);
    });
    return saved();
  } catch (error) {
    console.error(error);
    return { status: "error" };
  }
}

export async function deleteLineage(form: FormData): Promise<void> {
  const lineage = id(form, "id");
  if (!lineage) return;
  await asAdmin((q) =>
    q("delete from public.lineages where id = $1", [lineage]),
  );
}

/** Attested, tradition or debated: how sure the family is of one link. */
export async function setLinkCertainty(form: FormData): Promise<void> {
  const parent = id(form, "parent");
  const child = id(form, "child");
  const certainty = text(form, "certainty") as (typeof CERTAINTIES)[number];
  if (!parent || !child || !CERTAINTIES.includes(certainty)) return;
  await asAdmin((q) =>
    q(
      "update public.parent_child set certainty = $1 where parent_id = $2 and child_id = $3",
      [certainty, parent, child],
    ),
  );
}

/** A document that proves one link: written once, shown in the tree. */
export async function addLinkProof(
  _previous: TreeSettingsState,
  form: FormData,
): Promise<TreeSettingsState> {
  const parent = id(form, "parent");
  const child = id(form, "child");
  if (!parent || !child) return { status: "error" };
  if (!text(form, "title"))
    return { status: "invalid", errors: { title: "required" } };
  const kind = text(form, "kind") as (typeof KINDS)[number];
  const url = text(form, "url");
  try {
    await asAdmin(async (q, session) => {
      const [source] = await q<{ id: string }>(
        `insert into public.sources
           (kind, title, reference, repository, url, transcription, translation, status, created_by)
         values ($1, $2, $3, $4, $5, $6, $7, 'published', $8) returning id`,
        [
          KINDS.includes(kind) ? kind : "document",
          text(form, "title"),
          text(form, "reference") || null,
          text(form, "repository") || null,
          /^https?:\/\//.test(url) ? url : null,
          text(form, "transcription") || null,
          text(form, "translation") || null,
          session.accountId,
        ],
      );
      await q(
        "insert into public.filiation_sources (source_id, parent_id, child_id, note) values ($1, $2, $3, $4)",
        [source.id, parent, child, text(form, "note") || null],
      );
    });
    return saved();
  } catch (error) {
    console.error(error);
    return { status: "error" };
  }
}

export async function removeLinkProof(form: FormData): Promise<void> {
  const source = id(form, "source");
  const parent = id(form, "parent");
  const child = id(form, "child");
  if (!source || !parent || !child) return;
  await asAdmin((q) =>
    q(
      "delete from public.filiation_sources where source_id = $1 and parent_id = $2 and child_id = $3",
      [source, parent, child],
    ),
  );
}

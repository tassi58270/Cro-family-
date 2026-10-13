"use server";

import { getSession, viewerOf, type Session } from "@/lib/auth/session";
import { contentChanged } from "@/lib/data/revalidate";
import { withViewer, type Query } from "@/lib/db";
import { BRANCH_COLORS } from "@/lib/design/branch-colors";
import { routing } from "@/lib/i18n/routing";
import { slugify, uniqueSlug } from "@/lib/slug";

/**
 * Branches and coats of arms (cahier des charges, 6.3), entered by an
 * administrator. Every change is journaled by the database.
 */

export type ArmsFormState = {
  status: "idle" | "saved" | "invalid" | "error";
  /** Field → message key under admin.arms.errors. */
  errors?: Record<string, "required" | "year" | "order" | "parent">;
  savedAt?: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUILTIN = ["croy", "croy-renty", "hongrie-ancienne"];
const KINDS = ["family", "alliance", "commune"];

function text(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

function id(form: FormData, name: string) {
  const value = text(form, name);
  return UUID.test(value) ? value : null;
}

function year(form: FormData, name: string): number | null | "invalid" {
  const raw = text(form, name);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 && value < 3000
    ? value
    : "invalid";
}

async function asAdmin<T>(fn: (q: Query, session: Session) => Promise<T>) {
  const session = await getSession();
  if (!session || session.role !== "admin") throw new Error("forbidden");
  const result = await withViewer(viewerOf(session), (q) => fn(q, session));
  contentChanged();
  return result;
}

const saved = (): ArmsFormState => ({ status: "saved", savedAt: Date.now() });

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

async function newSlug(q: Query, table: string, name: string) {
  return uniqueSlug(
    slugify(name) || table,
    async (s) =>
      (await q(`select 1 from public.${table} where slug = $1`, [s])).length >
      0,
  );
}

export async function saveBranch(
  _previous: ArmsFormState,
  form: FormData,
): Promise<ArmsFormState> {
  const errors: ArmsFormState["errors"] = {};
  const branch = id(form, "id");
  const parent = id(form, "parent");
  const male = year(form, "extinctMale");
  const female = year(form, "extinctFemale");
  if (!text(form, "name_fr")) errors.name_fr = "required";
  if (male === "invalid") errors.extinctMale = "year";
  if (female === "invalid") errors.extinctFemale = "year";
  if (branch && parent === branch) errors.parent = "parent";
  if (Object.keys(errors).length) return { status: "invalid", errors };
  const extinct = form.get("extinct") === "on";
  const color = text(form, "color");
  const values = [
    parent,
    id(form, "founder"),
    id(form, "lastPerson"),
    extinct ? "extinct" : "extant",
    extinct ? male : null,
    extinct ? female : null,
    (BRANCH_COLORS as readonly string[]).includes(color) ? color : null,
    form.get("published") === "on" ? "published" : "draft",
  ];
  try {
    await asAdmin(async (q, session) => {
      let row = branch;
      if (row) {
        await q(
          `update public.branches set parent_id = $1, founder_id = $2, last_person_id = $3, state = $4,
             extinct_male_year = $5, extinct_female_year = $6, color = $7, status = $8 where id = $9`,
          [...values, row],
        );
      } else {
        const [created] = await q<{ id: string }>(
          `insert into public.branches
             (parent_id, founder_id, last_person_id, state, extinct_male_year, extinct_female_year,
              color, status, slug, sort_order, created_by)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9,
             (select coalesce(max(sort_order), 0) + 1 from public.branches), $10)
           returning id`,
          [
            ...values,
            await newSlug(q, "branches", text(form, "name_fr")),
            session.accountId,
          ],
        );
        row = created.id;
      }
      await saveTexts(q, "branches_i18n", "branch_id", row, form, [
        "name",
        "description",
        "fate",
      ]);
    });
    return saved();
  } catch (error) {
    console.error(error);
    return { status: "error" };
  }
}

export async function deleteBranch(form: FormData): Promise<void> {
  const branch = id(form, "id");
  if (!branch) return;
  await asAdmin((q) =>
    q("delete from public.branches where id = $1", [branch]),
  );
}

export async function saveArms(
  _previous: ArmsFormState,
  form: FormData,
): Promise<ArmsFormState> {
  const errors: ArmsFormState["errors"] = {};
  const arms = id(form, "id");
  const start = year(form, "periodStart");
  const end = year(form, "periodEnd");
  if (!text(form, "name_fr")) errors.name_fr = "required";
  if (start === "invalid") errors.periodStart = "year";
  if (end === "invalid") errors.periodEnd = "year";
  if (typeof start === "number" && typeof end === "number" && end < start)
    errors.periodEnd = "order";
  if (Object.keys(errors).length) return { status: "invalid", errors };
  const kind = text(form, "kind");
  const builtin = text(form, "builtin");
  const values = [
    KINDS.includes(kind) ? kind : "family",
    BUILTIN.includes(builtin) ? builtin : null,
    id(form, "branch"),
    id(form, "person"),
    text(form, "familyName") || null,
    start,
    end,
    form.get("published") === "on" ? "published" : "draft",
  ];
  try {
    await asAdmin(async (q, session) => {
      let row = arms;
      if (row) {
        // A demonstration shield keeps its fictional drawing.
        await q(
          `update public.arms set kind = $1, builtin = case when is_demo then builtin else $2 end,
             branch_id = $3, person_id = $4, family_name = $5, period_start = $6, period_end = $7,
             status = $8 where id = $9`,
          [...values, row],
        );
      } else {
        const [created] = await q<{ id: string }>(
          `insert into public.arms
             (kind, builtin, branch_id, person_id, family_name, period_start, period_end, status,
              slug, sort_order, created_by)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9,
             (select coalesce(max(sort_order), 0) + 1 from public.arms), $10)
           returning id`,
          [
            ...values,
            await newSlug(q, "arms", text(form, "name_fr")),
            session.accountId,
          ],
        );
        row = created.id;
      }
      await saveTexts(q, "arms_i18n", "arms_id", row, form, [
        "name",
        "blazon",
        "explanation",
        "bearers",
      ]);
    });
    return saved();
  } catch (error) {
    console.error(error);
    return { status: "error" };
  }
}

export async function deleteArms(form: FormData): Promise<void> {
  const arms = id(form, "id");
  if (!arms) return;
  await asAdmin((q) => q("delete from public.arms where id = $1", [arms]));
}

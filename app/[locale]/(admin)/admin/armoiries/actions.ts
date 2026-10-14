"use server";

import { randomUUID } from "node:crypto";
import { asAdmin, id, newSlug, saveTexts, text, year } from "@/lib/admin/form";
import type { Query } from "@/lib/db";
import { fileStore } from "@/lib/storage";
import { ingest } from "@/lib/storage/images";
import { sanitizeSvg } from "@/lib/storage/svg";
import { parseFuzzyDate } from "@/lib/genealogie/dates";
import { BRANCH_COLORS } from "@/lib/design/branch-colors";

/**
 * Branches and coats of arms (cahier des charges, 6.3), entered by an
 * administrator. Every change is journaled by the database.
 */

export type ArmsFormState = {
  status: "idle" | "saved" | "invalid" | "error";
  /** Field → message key under admin.arms.errors. */
  errors?: Record<string, "required" | "year" | "order" | "parent" | "file">;
  savedAt?: number;
};

const BUILTIN = ["croy", "croy-renty", "hongrie-ancienne"];
const KINDS = ["family", "alliance", "commune"];

const saved = (): ArmsFormState => ({ status: "saved", savedAt: Date.now() });

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

type StoredArms = {
  key: string;
  data: Buffer;
  contentType: string;
  width: number | null;
  height: number | null;
};

/** The family's own file of the arms: SVG cleaned, or a picture made safe. */
async function readArmsFile(
  form: FormData,
): Promise<StoredArms | null | "invalid"> {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return null;
  // Server actions take 4 MB in all, the other fields included.
  if (file.size > 3.5 * 1024 * 1024) return "invalid";
  const bytes = Buffer.from(await file.arrayBuffer());
  const looksSvg =
    file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg");
  if (looksSvg) {
    const svg = sanitizeSvg(bytes.toString("utf8"));
    if (!svg) return "invalid";
    return {
      key: `armoiries/${randomUUID()}.svg`,
      data: Buffer.from(svg, "utf8"),
      contentType: "image/svg+xml",
      width: null,
      height: null,
    };
  }
  const image = await ingest(bytes);
  if (!image) return "invalid";
  return {
    key: `armoiries/${randomUUID()}.${image.extension}`,
    data: image.data,
    contentType: image.contentType,
    width: image.width,
    height: image.height,
  };
}

async function attachArmsFile(
  q: Query,
  arms: string,
  file: StoredArms,
  account: string,
) {
  const [media] = await q<{ id: string }>(
    `insert into public.media (storage_path, kind, mime_type, width, height, bytes, uploaded_by, status)
     values ($1, 'arms', $2, $3, $4, $5, $6, 'published') returning id`,
    [
      file.key,
      file.contentType,
      file.width,
      file.height,
      file.data.length,
      account,
    ],
  );
  // The family's file replaces the drawing made for the project.
  await q("update public.arms set svg_id = $2, builtin = null where id = $1", [
    arms,
    media.id,
  ]);
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
  const file = await readArmsFile(form);
  if (file === "invalid") errors.file = "file";
  if (Object.keys(errors).length || file === "invalid")
    return { status: "invalid", errors };
  if (file) await fileStore().put(file.key, file.data, file.contentType);
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
      if (file) await attachArmsFile(q, row, file, session.accountId);
      else if (form.get("removeFile") === "on")
        await q("update public.arms set svg_id = null where id = $1", [row]);
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

export type TitleFormState = {
  status: "idle" | "saved" | "invalid" | "error";
  /** Field → message key under admin.titles.errors. */
  errors?: Record<string, "required" | "date">;
  savedAt?: number;
};

/** A title and, in order, those who held it (section 7, « Titres »). */
export async function saveTitle(
  _previous: TitleFormState,
  form: FormData,
): Promise<TitleFormState> {
  const errors: TitleFormState["errors"] = {};
  const title = id(form, "id");
  if (!text(form, "name_fr")) errors.name_fr = "required";
  const date = (raw: string, field: string) => {
    if (!raw.trim()) return null;
    const parsed = parseFuzzyDate(raw);
    if (!parsed) errors[field] = "date";
    return parsed;
  };
  const created = date(text(form, "created"), "created");
  const people = form.getAll("holder_person").map(String);
  const holders = people
    .map((person, i) => ({
      person,
      rank: Number(form.getAll("holder_rank")[i]) || null,
      from: date(
        String(form.getAll("holder_from")[i] ?? ""),
        `holder_from_${i}`,
      ),
      to: date(String(form.getAll("holder_to")[i] ?? ""), `holder_to_${i}`),
    }))
    .filter((h) => /^[0-9a-f-]{36}$/i.test(h.person));
  if (Object.keys(errors).length) return { status: "invalid", errors };
  const status = form.get("published") === "on" ? "published" : "draft";
  try {
    await asAdmin(async (q, session) => {
      const values = [
        created?.date ?? null,
        created?.precision ?? null,
        text(form, "creator") || null,
        id(form, "branch"),
        status,
      ];
      let row = title;
      if (row) {
        await q(
          `update public.titles set created_date = $1, created_precision = $2, creator = $3,
             branch_id = $4, status = $5 where id = $6`,
          [...values, row],
        );
      } else {
        const [createdRow] = await q<{ id: string }>(
          `insert into public.titles
             (created_date, created_precision, creator, branch_id, status, slug, sort_order, created_by)
           values ($1, $2, $3, $4, $5, $6,
             (select coalesce(max(sort_order), 0) + 1 from public.titles), $7)
           returning id`,
          [
            ...values,
            await newSlug(q, "titles", text(form, "name_fr")),
            session.accountId,
          ],
        );
        row = createdRow.id;
      }
      await saveTexts(q, "titles_i18n", "title_id", row, form, [
        "name",
        "description",
      ]);
      await q("delete from public.people_titles where title_id = $1", [row]);
      for (const h of holders)
        await q(
          `insert into public.people_titles
             (person_id, title_id, rank, start_date, start_precision, end_date, end_precision,
              status, created_by)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            h.person,
            row,
            h.rank,
            h.from?.date ?? null,
            h.from?.precision ?? null,
            h.to?.date ?? null,
            h.to?.precision ?? null,
            status,
            session.accountId,
          ],
        );
    });
    return { status: "saved", savedAt: Date.now() };
  } catch (error) {
    console.error(error);
    return { status: "error" };
  }
}

export async function deleteTitle(form: FormData): Promise<void> {
  const title = id(form, "id");
  if (!title) return;
  await asAdmin((q) => q("delete from public.titles where id = $1", [title]));
}

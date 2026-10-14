"use server";

import { asAdmin, id, text } from "@/lib/admin/form";
import { getSession } from "@/lib/auth/session";
import {
  TRANSLATABLE,
  TRANSLATABLE_KINDS,
  type TranslatableKind,
} from "@/lib/data/translations";

/**
 * Translations (section 7): English and German beside the French. What an
 * administrator saves here is « reviewed »; an automatic proposal only
 * fills the fields, to be read before saving.
 */

export type TranslationFormState = {
  status: "idle" | "saved" | "invalid" | "error";
  errors?: Record<string, "required">;
  savedAt?: number;
};

function kindOf(value: string): TranslatableKind | null {
  return (TRANSLATABLE_KINDS as string[]).includes(value)
    ? (value as TranslatableKind)
    : null;
}

export async function saveTranslation(
  _previous: TranslationFormState,
  form: FormData,
): Promise<TranslationFormState> {
  const kind = kindOf(text(form, "kind"));
  const row = id(form, "id");
  if (!kind || !row) return { status: "error" };
  const c = TRANSLATABLE[kind];
  const errors: TranslationFormState["errors"] = {};
  for (const locale of ["en", "de"] as const) {
    const values = c.fields.map((f) => text(form, `${f}_${locale}`));
    if (values.some(Boolean) && !text(form, `${c.main}_${locale}`))
      errors[`${c.main}_${locale}`] = "required";
  }
  if (Object.keys(errors).length) return { status: "invalid", errors };
  try {
    await asAdmin(async (q) => {
      for (const locale of ["en", "de"] as const) {
        const values = c.fields.map(
          (f) => text(form, `${f}_${locale}`) || null,
        );
        if (!values.some(Boolean)) {
          await q(
            `delete from public.${c.table} where ${c.key} = $1 and locale = $2`,
            [row, locale],
          );
          continue;
        }
        await q(
          `insert into public.${c.table} (${c.key}, locale, ${c.fields.join(", ")}, translation)
           values ($1, $2, ${c.fields.map((_, i) => `$${i + 3}`).join(", ")}, 'reviewed')
           on conflict (${c.key}, locale) do update set
             ${c.fields.map((f) => `${f} = excluded.${f}`).join(", ")},
             translation = 'reviewed'`,
          [row, locale, ...values],
        );
      }
    });
    return { status: "saved", savedAt: Date.now() };
  } catch (error) {
    console.error(error);
    return { status: "error" };
  }
}

/**
 * An automatic proposal from DeepL for the given French texts, to be read
 * and corrected by the administrator before saving.
 */
export async function proposeTranslation(
  texts: string[],
  target: "en" | "de",
): Promise<string[] | null> {
  const session = await getSession();
  const key = process.env.DEEPL_API_KEY;
  if (!session || session.role !== "admin" || !key) return null;
  const filled = texts.map((t) => t.slice(0, 20_000));
  if (!filled.some(Boolean)) return texts.map(() => "");
  const host = key.endsWith(":fx")
    ? "https://api-free.deepl.com"
    : "https://api.deepl.com";
  const response = await fetch(`${host}/v2/translate`, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text: filled.map((t) => t || " "),
      source_lang: "FR",
      target_lang: target === "en" ? "EN-GB" : "DE",
      preserve_formatting: true,
    }),
  }).catch(() => null);
  if (!response?.ok) return null;
  const data = (await response.json()) as { translations: { text: string }[] };
  return data.translations.map((t, i) => (filled[i] ? t.text : ""));
}
